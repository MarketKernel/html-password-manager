/**
 * The toolbar icon's popup: the compact way in. It lists the entries for the
 * page in the tab — titles and user names, never a password — fills one with
 * a click and copies its values; a search looks through the whole database.
 * "Full mode" opens the side panel, where everything else is.
 *
 * The popup opens no database itself: the offscreen document has it, and
 * hands over the list and one entry's values at a time, so a popup opened
 * again shows at once, with no key derivation of its own. Locked, it reads
 * the file last opened and gives it, with the password, to that document to
 * decrypt. Choosing a file, a key file and every change to the database are
 * the panel's: a file picker would close the popup anyway.
 */

import type { FillRequest, FrameReport } from './fill';
import { HandleFile, recentFiles, type RecentFile } from '../app/files';
import { copyText } from '../app/clipboard';
import {
  forget,
  isCancelled,
  notRememberedText,
  recall,
  recallFailedText,
  RememberError,
  remembered,
  rememberWays,
  settle,
  settledText,
  unlockLabel,
} from '../app/remember';
import { setLanguage, t } from '../core/i18n';
import { fits, pageOf, type Page } from '../core/match';
import { ensureOffscreen, mask, send, toBase64, type Credentials, type Listed, type Session } from './messages';
import { applyTheme, loadSettings, resolveLanguage } from '../app/settings';
import { bindLayoutBadge, confirmAsk, h, hue, icon, ICONS, isRevealed, maskInput, setRevealed, toast } from '../app/ui';

interface Tab {
  id: number;
  /** Null for a page that takes no login: chrome://, the new tab page, a file. */
  page: Page | null;
}

const USER = '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>';
const CLOCK = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';

const settings = loadSettings();
setLanguage(resolveLanguage(settings.language));
applyTheme(settings.theme);
document.title = t('app', 'Deterministic Password');

let tab: Tab | null = null;
let windowId = -1;
let query = '';
let searchTimer = 0;

const root = document.getElementById('popup') as HTMLElement;
const site = h('span', { class: 'popup-site' });
const lockButton = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('menu', 'Lock') }, icon(ICONS.lock));
const search = h('input', { class: 'popup-search-input', type: 'search', placeholder: t('popup', 'Search all entries'), autocomplete: 'off', spellcheck: 'false' });
const searchBox = h('label', { class: 'search popup-search' }, icon('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'), search);
const body = h('div', { class: 'popup-body' });
const fullButton = h('button', { type: 'button', class: 'button button--small popup-full' }, t('popup', 'Full mode'), icon(ICONS.open));
root.append(h('header', { class: 'popup-head' }, icon(ICONS.globe), site, lockButton), searchBox, body, h('footer', { class: 'popup-foot' }, fullButton));

const list = (): Promise<Listed[] | null> => send<Listed[]>('offscreen', { type: 'entries', page: tab?.page ?? null, query });

/** The list when the offscreen document has the database; the unlock form when it has not. */
async function show(): Promise<void> {
  const entries = await list();
  site.textContent = tab?.page?.site ?? t('list', 'The tab shows no website');
  lockButton.hidden = searchBox.hidden = entries === null;
  if (entries) renderList(entries);
  else renderUnlock(await recentFiles());
}

/* ------------------------------------------------------------------ *
 * The entries
 * ------------------------------------------------------------------ */

function renderList(entries: Listed[]): void {
  const page = tab?.page ?? null;
  if (!entries.length) {
    const empty = h('div', { class: 'popup-empty' });
    if (query) empty.append(h('p', { text: t('list', 'Nothing found') }));
    else if (page) {
      const make = h('button', { type: 'button', class: 'button button--small button--primary', text: t('list', 'New password for {site}', { site: page.site }) });
      make.addEventListener('click', () => passwordForPage());
      empty.append(h('p', { text: t('list', 'No entries for {site}', { site: page.site }) }), make);
    } else empty.append(h('p', { text: t('popup', 'Search finds an entry to copy from.') }));
    body.replaceChildren(empty);
    return;
  }
  body.replaceChildren(h('ul', { class: 'popup-entries' }, ...entries.map((entry) => row(entry, page))));
}

function row(entry: Listed, page: Page | null): HTMLElement {
  const title = entry.title || t('entry', '(untitled)');
  const letter = Array.from(entry.title)[0]?.toUpperCase() ?? '';
  const avatar = h('span', { class: 'avatar avatar--small', 'aria-hidden': 'true' }, letter || icon(ICONS.key));
  avatar.style.setProperty('--avatar-hue', String(hue(entry.title || entry.uuid)));
  // Found by a search for another site, it says whose it is.
  const where = entry.target && !fits(entry.target, page) ? entry.target.site : '';
  const text = h(
    'span',
    { class: 'popup-entry-text' },
    h('span', { class: 'popup-entry-title', text: title }),
    h('span', { class: 'popup-entry-sub', text: [entry.username, where].filter(Boolean).join(' · ') }),
  );
  const main = page ? h('button', { type: 'button', class: 'popup-entry-main', title: t('extension', 'Fill') }, avatar, text) : h('span', { class: 'popup-entry-main' }, avatar, text);
  main.addEventListener('click', () => void fill(entry));

  const action = (paths: string, label: string, run: () => void): HTMLElement => {
    const button = h('button', { type: 'button', class: 'icon-button icon-button--small', title: label, 'aria-label': label }, icon(paths));
    button.addEventListener('click', run);
    return button;
  };
  return h(
    'li',
    { class: 'popup-entry' },
    main,
    entry.username ? action(USER, t('menu', 'Copy user name'), () => void copy(entry, 'username')) : null,
    action(ICONS.key, t('menu', 'Copy password'), () => void copy(entry, 'password')),
    entry.otp ? action(CLOCK, t('entry', 'Copy {what}', { what: t('entry', 'One-time code') }), () => void copy(entry, 'otp')) : null,
  );
}

/** One entry's values, or null when the database locked meanwhile — the popup then shows the lock. */
async function valuesOf(entry: Listed): Promise<Credentials | null> {
  const values = await send<Credentials>('offscreen', { type: 'credentials', uuid: entry.uuid });
  if (!values) await show();
  return values;
}

async function copy(entry: Listed, what: keyof Credentials): Promise<void> {
  const values = await valuesOf(entry);
  if (!values) return;
  const label = { username: t('entry', 'User name'), password: t('entry', 'Password'), otp: t('entry', 'One-time code') }[what];
  if (!values[what]) {
    toast(t('toast', '{what}: empty', { what: label }));
    return;
  }
  try {
    // The popup closes before long: the offscreen document wipes the clipboard.
    await copyText(values[what], 0);
    void send('offscreen', { type: 'copied', seconds: settings.clipboardSeconds });
    toast(
      settings.clipboardSeconds
        ? t('toast', '{what} copied · cleared in {seconds} s', { what: label, seconds: settings.clipboardSeconds })
        : t('toast', '{what} copied', { what: label }),
    );
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error');
  }
}

/** As the panel's Fill: the entry's own site, or another one the user trusts, and never https into http. */
async function fill(entry: Listed): Promise<void> {
  const page = tab?.page;
  if (!tab || !page) return;
  const target = entry.target;
  if (target?.secure && !page.secure) {
    toast(t('extension', 'Not filled: the page is not secure (http), and the entry is for https'), 'error');
    return;
  }
  if (!fits(target, page)) {
    const title = entry.title || t('entry', '(untitled)');
    const message = target
      ? t('extension', '"{title}" is for {entry}, but the tab shows {tab}. Fill it in only if you trust {tab}.', { title, entry: target.site, tab: page.site })
      : t('extension', '"{title}" has no website. Fill it into {tab}?', { title, tab: page.site });
    if (!(await confirmAsk(t('extension', 'Fill into another site?'), message, t('extension', 'Fill anyway')))) return;
  }
  const values = await valuesOf(entry);
  if (!values) return;
  const request: FillRequest = { site: page.site, secure: target?.secure ?? page.secure, ...values, fresh: false };
  const reply = await send<{ frames?: FrameReport[]; error?: string }>('background', { type: 'fill', tabId: tab.id, uuid: entry.uuid, request });
  if (!reply || reply.error) {
    toast(t('extension', 'Not filled: {reason}', { reason: reply?.error ?? t('extension', 'the extension did not answer') }), 'error');
    return;
  }
  if (!reply.frames?.some((frame) => frame.filled.length)) {
    toast(t('extension', 'No login fields on this page'), 'error');
    return;
  }
  // Filled: the page is what the user wants to see now.
  window.close();
}

/** The generator is the panel's: it opens to make a password for the page, fill it and keep it. */
function passwordForPage(): void {
  const tabId = tab?.id;
  if (tabId === undefined) return;
  // Opened in the click itself, as Chrome wants; the panel then takes the request, open already or starting.
  void chrome.sidePanel
    .open({ windowId })
    .then(() => send('background', { type: 'handOver', tabId, windowId }))
    .finally(() => window.close());
}

/* ------------------------------------------------------------------ *
 * Unlocking
 * ------------------------------------------------------------------ */

function renderUnlock(recent: RecentFile[]): void {
  const [last] = recent;
  if (!last) {
    body.replaceChildren(h('div', { class: 'popup-empty' }, h('p', { text: t('popup', 'Open the database in full mode once: then it unlocks here with the master password alone.') })));
    return;
  }
  const nameOf = (file: RecentFile): string => file.name.replace(/\.kdbx$/i, '');
  let chosen = last;
  const heading =
    recent.length > 1
      ? h('select', { class: 'popup-file', 'aria-label': t('gate', 'Recent') }, ...recent.map((file) => h('option', { value: file.name, text: nameOf(file) })))
      : h('div', { class: 'popup-file', text: nameOf(last) });
  if (heading instanceof HTMLSelectElement) {
    heading.addEventListener('change', () => {
      chosen = recent.find((file) => file.name === heading.value) ?? last;
      void renderRemember();
      password.focus();
    });
  }

  const password = h('input', { class: 'unlock-input', type: 'text', placeholder: t('gate', 'Master password'), 'aria-label': t('gate', 'Master password') });
  const layer = maskInput(password);
  const badge = h('span', { class: 'layout-badge', 'aria-live': 'polite', hidden: '' });
  bindLayoutBadge(password, badge);
  const reveal = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('password', 'Show password') }, icon(ICONS.eye));
  reveal.addEventListener('click', () => {
    const shown = !isRevealed(password);
    setRevealed(password, shown);
    reveal.title = shown ? t('password', 'Hide password') : t('password', 'Show password');
    reveal.replaceChildren(icon(shown ? ICONS.eyeOff : ICONS.eye));
    password.focus();
  });
  const caps = h('p', { class: 'gate-caps', text: t('gate', 'Caps Lock is on'), hidden: '' });
  for (const type of ['keydown', 'keyup'] as const) password.addEventListener(type, (event) => (caps.hidden = !event.getModifierState?.('CapsLock')));
  const submit = h('button', { type: 'submit', class: 'button button--primary unlock-submit', text: t('gate', 'Unlock') });
  const error = h('p', { class: 'gate-error', 'aria-live': 'polite' });
  // As on the panel's gate: the button of a remembered database, and the checkbox that remembers one.
  const quick = h('button', { type: 'button', class: 'button button--primary unlock-submit unlock-remembered' });
  quick.hidden = true;
  const keep = h('input', { type: 'checkbox' });
  const keepRow = h('label', { class: 'unlock-remember popup-remember' }, keep, h('span', { text: t('gate', 'Remember on this device') }));
  keepRow.hidden = true;
  let turn = 0;
  const renderRemember = async (): Promise<void> => {
    const mine = ++turn;
    const [ways, way] = await Promise.all([rememberWays(), remembered(chosen.name)]);
    if (mine !== turn) return;
    keepRow.hidden = way === null && !ways.includes(settings.rememberWith);
    keep.checked = way !== null;
    quick.hidden = way === null;
    if (way) quick.textContent = unlockLabel(way);
    submit.classList.toggle('button--primary', quick.hidden);
  };
  const form = h('form', { class: 'unlock popup-unlock', autocomplete: 'off' }, heading, quick, h('label', { class: 'unlock-field' }, password, layer, badge, reveal), keepRow, submit, caps, error);
  const parts: UnlockForm = { password, submit, quick, keep: () => !keepRow.hidden && keep.checked, error, form, renderRemember };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void unlock(chosen, parts);
  });
  quick.addEventListener('click', () => void unlockRemembered(chosen, parts));
  body.replaceChildren(form);
  void renderRemember();
  password.focus();
}

interface UnlockForm {
  password: HTMLInputElement;
  submit: HTMLButtonElement;
  quick: HTMLButtonElement;
  /** The checkbox is shown and ticked. */
  keep(): boolean;
  error: HTMLElement;
  form: HTMLElement;
  renderRemember(): Promise<void>;
}

class WrongKey extends Error {}

/**
 * Gives the file and a password to the offscreen document to open: the password typed, or the
 * remembered one — asked for after the file's permission, which needs the click.
 */
async function openIn(recent: RecentFile, password: () => Promise<string>): Promise<void> {
  const file = new HandleFile(recent.handle);
  // Asked in the click, before any slow work; Chrome's question may close the popup, and the next one needs none.
  await file.ensureReadable();
  const secret = await password();
  const session: Session = { name: recent.name, data: toBase64(await file.read()), password: mask(secret), keyFile: null };
  await ensureOffscreen();
  const reply = await send<{ ok?: boolean; error?: string; wrongKey?: boolean }>('offscreen', { type: 'open', session });
  if (!reply?.ok) throw reply?.wrongKey ? new WrongKey(t('errors', 'Wrong password or key file')) : new Error(reply?.error ?? t('extension', 'the extension did not answer'));
  void send('offscreen', { type: 'settings', settings: { lockMinutes: settings.lockMinutes, clipboardSeconds: settings.clipboardSeconds } });
  void send('panel', { type: 'unlocked' });
}

/** Busy while `run` goes, then the button as it was. */
async function busy(button: HTMLButtonElement, run: () => Promise<void>): Promise<void> {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = t('gate', 'Unlocking…');
  try {
    await run();
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

async function unlock(recent: RecentFile, parts: UnlockForm): Promise<void> {
  const { password, error, form } = parts;
  error.textContent = '';
  const typed = password.value;
  const wanted = parts.keep();
  try {
    await busy(parts.submit, () => openIn(recent, async () => typed));
  } catch (caught) {
    error.textContent = caught instanceof Error ? caught.message : String(caught);
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
    password.select();
    return;
  }
  password.value = '';
  try {
    const outcome = await settle(recent.name, wanted, settings.rememberWith, typed);
    if (outcome) toast(settledText(outcome));
  } catch (caught) {
    toast(notRememberedText(caught), 'error');
  }
  await show();
  search.focus();
}

/** The button of a remembered database: its prompt, then the offscreen document opens the file. */
async function unlockRemembered(recent: RecentFile, parts: UnlockForm): Promise<void> {
  parts.error.textContent = '';
  try {
    await busy(parts.quick, () => openIn(recent, () => recall(recent.name)));
  } catch (caught) {
    // The prompt closed: nothing to say, the button stays.
    if (isCancelled(caught)) return;
    if (caught instanceof WrongKey || caught instanceof RememberError) {
      await forget(recent.name);
      parts.error.textContent = recallFailedText(caught instanceof WrongKey);
      await parts.renderRemember();
      parts.password.focus();
      return;
    }
    parts.error.textContent = caught instanceof Error ? caught.message : String(caught);
    return;
  }
  await show();
  search.focus();
}

/* ------------------------------------------------------------------ *
 * Events and start
 * ------------------------------------------------------------------ */

search.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    query = search.value.trim();
    void show();
  }, 80);
});
// Enter fills the first entry: the site's own one, most of the time the only one.
search.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  body.querySelector<HTMLButtonElement>('button.popup-entry-main')?.click();
});

lockButton.addEventListener('click', async () => {
  await send('background', { type: 'lockAll' });
  await show();
});

fullButton.addEventListener('click', () => {
  void chrome.sidePanel
    .open({ windowId })
    .catch(() => undefined)
    .finally(() => window.close());
});

void (async () => {
  windowId = (await chrome.windows.getCurrent()).id ?? -1;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  tab = active?.id !== undefined ? { id: active.id, page: active.url ? pageOf(active.url) : null } : null;
  await show();
  if (!searchBox.hidden) search.focus();
})();
