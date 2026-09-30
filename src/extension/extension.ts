/**
 * The side panel's part of the Chrome extension, in the place of
 * src/app/platform.ts (build.mjs swaps them). The panel is the page itself; this
 * is what it does beyond: it hands the open database to the offscreen
 * document on every unlock and save, takes it up from there when opened
 * again, follows the tab beside it, and fills an entry into that tab
 * through the service worker.
 */

import type { FillRequest, FrameReport } from './fill';
import { BlobFile, HandleFile, recentFiles, type DbFile } from '../app/files';
import { t } from '../core/i18n';
import { field, ProtectedValue, titleOf, uuidOf, type Entry } from '../core/kdbx';
import { fits, pageOf, targetOf, type Target } from '../core/match';
import { ensureOffscreen, fromBase64, listen, send, toBase64, type FillAsk, type Masked, type Session, type Settings } from './messages';
import { otpFromFields, totp } from '../core/otp';
import type { OpenState, Platform, PlatformHost, Resumed, TabPage } from '../app/platform';
import { confirmAsk, toast } from '../app/ui';

interface Tab {
  id: number;
  /** Null for a page that takes no login, or one the extension may not see. */
  page: TabPage | null;
  /** The extension may see the tab's address: activeTab, or a site allowed for good. */
  known: boolean;
}

let host: PlatformHost | null = null;
let windowId = -1;
let tab: Tab | null = null;
let settings: Settings = { lockMinutes: 15, clipboardSeconds: 30 };
/** The offscreen document has the database: its idle lock is the one that counts. */
let handedOver = false;
/** A lock asked for by the worker, which needs no telling afterwards. */
let lockingForWorker = false;
let lastPing = 0;
let lastAsk = 0;
/** Counts the locks: a handover still on its way when the database locks is dropped. */
let locks = 0;

const masked = (password: string): Masked | null => {
  if (!password) return null;
  const value = ProtectedValue.fromString(password);
  return { value: toBase64(value.value), salt: toBase64(value.salt) };
};

const unmasked = (password: Masked | null): string =>
  password ? new ProtectedValue(fromBase64(password.value).buffer, fromBase64(password.salt).buffer).getText() : '';

async function currentTab(): Promise<Tab | null> {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id === undefined) return null;
  const page = active.url ? pageOf(active.url) : null;
  return { id: active.id, page: page && active.url ? { ...page, origin: new URL(active.url).origin } : null, known: active.url !== undefined };
}

async function followTab(): Promise<void> {
  const next = await currentTab();
  const moved = next?.id !== tab?.id || next?.page?.origin !== tab?.page?.origin;
  tab = next;
  if (moved) host?.pageChanged();
}

async function take(ask: FillAsk): Promise<void> {
  // The same request can come twice: sent to a panel already open, and asked for by one just started.
  if (ask.at === lastAsk) return;
  lastAsk = ask.at;
  // The click on Fill has just given the extension the tab, and no event says so: its address is there now.
  await followTab();
  if (ask.tabId === tab?.id) host?.fillAsked();
}

/** Where the extension may look for good, to fill a site whose tab it was not given. */
function originsOf(target: Target): string[] {
  const schemes = target.secure ? ['https'] : ['https', 'http'];
  return schemes.flatMap((scheme) => [`${scheme}://${target.site}/*`, `${scheme}://www.${target.site}/*`]);
}

async function fill(entry: Entry, fresh = false): Promise<void> {
  let current = await currentTab();
  const target = targetOf(field(entry, 'URL'));
  if (current && !current.known && target) {
    // Opened by the toolbar icon on another tab, the panel was given that one: this site is asked for once and for good.
    const granted = await chrome.permissions.request({ origins: originsOf(target) }).catch(() => false);
    if (granted) current = await currentTab();
  }
  const page = current?.page;
  if (!current || !page) {
    const unseen = current && !current.known;
    toast(
      unseen && target
        ? t('extension', 'The tab does not show {site}', { site: target.site })
        : unseen
          ? t('extension', 'Click the extension\'s icon on this tab first')
          : t('extension', 'Nothing can be filled on this page'),
      'error',
    );
    return;
  }
  if (target?.secure && !page.secure) {
    toast(t('extension', 'Not filled: the page is not secure (http), and the entry is for https'), 'error');
    return;
  }
  if (!fits(target, page)) {
    const title = titleOf(entry);
    const message = target
      ? t('extension', '"{title}" is for {entry}, but the tab shows {tab}. Fill it in only if you trust {tab}.', { title, entry: target.site, tab: page.site })
      : t('extension', '"{title}" has no website. Fill it into {tab}?', { title, tab: page.site });
    if (!(await confirmAsk(t('extension', 'Fill into another site?'), message, t('extension', 'Fill anyway')))) return;
  }
  const otp = otpFromFields((name) => (entry.fields.has(name) ? field(entry, name) : undefined));
  const request: FillRequest = {
    site: page.site,
    secure: target?.secure ?? page.secure,
    username: field(entry, 'UserName'),
    password: field(entry, 'Password'),
    otp: otp ? await totp(otp) : '',
    fresh,
  };
  const reply = await send<{ frames?: FrameReport[]; error?: string }>('background', { type: 'fill', tabId: current.id, uuid: uuidOf(entry), request });
  if (!reply || reply.error) {
    toast(t('extension', 'Not filled: {reason}', { reason: reply?.error ?? t('extension', 'the extension did not answer') }), 'error');
    return;
  }
  const filled = new Set(reply.frames?.flatMap((frame) => frame.filled));
  if (filled.size === 0) toast(t('extension', 'No login fields on this page'), 'error');
  else toast(t('extension', 'Filled into {site}', { site: page.site }));
}

async function typedUser(): Promise<string> {
  const page = tab?.page;
  if (!tab || !page) return '';
  const reply = await send<{ frames?: FrameReport[] }>('background', { type: 'inspect', tabId: tab.id });
  const own = reply?.frames?.filter((frame) => pageOf(frame.origin)?.site === page.site) ?? [];
  return own.find((frame) => frame.typed)?.typed ?? '';
}

/** The database found again: the file it came from, writable when the browser still allows it. */
async function fileOf(session: Session, data: ArrayBuffer): Promise<DbFile> {
  const recent = (await recentFiles()).find((item) => item.name === session.name);
  if (!recent) return new BlobFile(new File([data], session.name));
  const file = new HandleFile(recent.handle);
  file.writable = Boolean(recent.handle.createWritable) && (await recent.handle.queryPermission?.({ mode: 'readwrite' }).catch(() => 'denied')) === 'granted';
  return file;
}

function translateMenus(): void {
  void send('background', { type: 'menus', fill: t('extension', 'Fill'), lock: t('menu', 'Lock') });
}

export const platform: Platform = {
  start(next) {
    host = next;
    listen(
      'panel',
      {
        ask: (message) => {
          void take(message['ask'] as FillAsk);
          return { taken: true };
        },
        /** A click on the icon or in the menu gave the extension the tab. */
        tab: () => followTab(),
        /** Idle, the screen locked, or Lock in the toolbar's menu. */
        lock: async (message) => {
          lockingForWorker = true;
          try {
            return { kept: !(await next.lock(message['reason'] === 'manual' ? 'manual' : 'idle')) };
          } finally {
            lockingForWorker = false;
          }
        },
        /** The popup unlocked the database: a panel at its gate takes it up. */
        unlocked: () => next.unlocked(),
        /** Locked in another window's panel: the offscreen document is gone, and this panel's own lock counts again. */
        locked: async () => {
          handedOver = false;
          lockingForWorker = true;
          try {
            await next.lock('idle');
          } finally {
            lockingForWorker = false;
          }
        },
      },
      (message) => message['windowId'] === undefined || message['windowId'] === windowId,
    );
    chrome.tabs.onActivated.addListener(() => void followTab());
    chrome.tabs.onUpdated.addListener((id, change) => {
      if (id === tab?.id && (change.url !== undefined || change.status !== undefined)) void followTab();
    });
    chrome.permissions.onAdded.addListener(() => void followTab());
    // The worker says when a click gives the extension the tab; the panel looks again when it is used, too.
    window.addEventListener('focus', () => void followTab());
    translateMenus();
    void (async () => {
      windowId = (await chrome.windows.getCurrent()).id ?? -1;
      await followTab();
      const ask = await send<FillAsk>('background', { type: 'hello', windowId });
      if (ask) await take(ask);
    })();
  },

  async resume(): Promise<Resumed | null> {
    const session = await send<Session>('offscreen', { type: 'session' });
    if (!session?.data) return null;
    handedOver = true;
    const data = fromBase64(session.data).buffer;
    return {
      file: await fileOf(session, data),
      name: session.name,
      data,
      password: unmasked(session.password),
      keyFile: session.keyFile ? { name: session.keyFile.name, data: fromBase64(session.keyFile.data).buffer } : null,
    };
  },

  opened(state: OpenState) {
    const session: Session = {
      name: state.name,
      data: toBase64(state.data),
      password: masked(state.password),
      keyFile: state.keyFile ? { name: state.keyFile.name, data: toBase64(state.keyFile.data) } : null,
    };
    const before = locks;
    void ensureOffscreen()
      .then(() => (locks === before ? send<{ ok?: boolean; error?: string }>('offscreen', { type: 'open', session }) : null))
      .then(
        (reply) => {
          handedOver = Boolean(reply?.ok) && locks === before;
          if (handedOver) void send('offscreen', { type: 'settings', settings });
        },
        () => (handedOver = false),
      );
  },

  locked() {
    locks += 1;
    handedOver = false;
    if (!lockingForWorker) void send('background', { type: 'lock' });
  },

  activity() {
    const now = Date.now();
    if (!handedOver || now - lastPing < 10_000) return;
    lastPing = now;
    void send('offscreen', { type: 'activity' });
  },

  settings(next) {
    settings = { lockMinutes: next.lockMinutes, clipboardSeconds: next.clipboardSeconds };
    if (handedOver) void send('offscreen', { type: 'settings', settings });
  },

  copied(seconds) {
    void send('offscreen', { type: 'copied', seconds });
  },

  idleElsewhere: () => handedOver,
  languageChanged: translateMenus,
  page: () => tab?.page ?? null,
  fill,
  typedUser,
};
