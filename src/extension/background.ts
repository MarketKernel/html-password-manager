/**
 * The Chrome extension's service worker: "Fill" in a page's context menu,
 * "Lock" in the toolbar icon's, the lock that follows the computer's screen,
 * and the one way values reach a web page — executeScript with the function
 * of src/extension/fill.ts, into the frames of the entry's own site only.
 *
 * Whether a click of "Fill" can fill at once must be known at once: Chrome
 * opens the side panel only from inside the click's handler, before any
 * await. So the worker keeps the websites of the open database's entries —
 * no titles, no user names, no passwords — as the offscreen document sends
 * them, and that document keeps the worker running while it is open.
 */

import { loginForm, type FillRequest, type FrameReport } from './fill';
import { fits, pageOf, type Page } from '../core/match';
import { listen, send, type Credentials, type FillAsk, type Indexed } from './messages';

/** The websites of the open database's entries; null while it is locked, or not known yet after a restart. */
let index: Indexed[] | null = null;
/** The entry last filled into each tab: the second step of a sign-in in two gets the same one. */
const chosen = new Map<number, string>();
/** A panel opened to fill a tab, by window, until that panel takes it up. */
const asks = new Map<number, FillAsk>();
const ASK_FOR = 60_000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'fill', title: 'Fill', contexts: ['page', 'frame', 'editable'], documentUrlPatterns: ['https://*/*', 'http://*/*'] });
    chrome.contextMenus.create({ id: 'lock', title: 'Lock', contexts: ['action'] });
  });
});
// The icon opens the popup (src/extension/popup.ts), which gets the tab (activeTab) with the click;
// the panel opens from there, or from the menu — never by Chrome's own setting, which would give it no tab.
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab) tabGiven(tab.windowId);
  if (info.menuItemId === 'lock') void lock('manual');
  else if (info.menuItemId === 'fill' && tab?.id !== undefined) fillFromMenu(tab.id, tab.windowId, tab.url ?? info.pageUrl ?? '');
});

/** A click gave the extension the tab, and no event tells a panel open beside it: its address is there to see now. */
function tabGiven(windowId: number): void {
  void send('panel', { type: 'tab', windowId });
}

chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'locked') void lock('idle');
});

chrome.tabs.onRemoved.addListener((tabId) => chosen.delete(tabId));

function fillFromMenu(tabId: number, windowId: number, url: string): void {
  const page = pageOf(url);
  const entry = page && index ? pick(tabId, page, index) : null;
  if (page && entry) {
    void fillEntry(tabId, page, entry);
    return;
  }
  // Locked, no entry for the site or several: the panel finishes, and it has to open now.
  chrome.sidePanel.open({ windowId }).catch(() => undefined);
  handOver(tabId, windowId);
}

/** The panel, opened already, is to fill the tab: it picks an entry, or makes a password for the page. */
function handOver(tabId: number, windowId: number): void {
  const ask: FillAsk = { tabId, windowId, at: Date.now() };
  asks.set(windowId, ask);
  // A panel open already takes the request at once; a new one asks for it when it starts.
  void send<{ taken: boolean }>('panel', { type: 'ask', windowId, ask }).then((reply) => {
    if (reply?.taken && asks.get(windowId) === ask) asks.delete(windowId);
  });
}

/** The entry to fill without asking: the one chosen for this tab before, or the only one for its site. */
function pick(tabId: number, page: Page, entries: readonly Indexed[]): Indexed | null {
  const fitting = entries.filter((entry) => fits(entry, page));
  const before = chosen.get(tabId);
  return fitting.find((entry) => entry.uuid === before) ?? (fitting.length === 1 ? (fitting[0] ?? null) : null);
}

async function fillEntry(tabId: number, page: Page, entry: Indexed): Promise<void> {
  const values = await send<Credentials>('offscreen', { type: 'credentials', uuid: entry.uuid });
  if (!values) return;
  chosen.set(tabId, entry.uuid);
  await fillTab(tabId, { site: page.site, secure: entry.secure, fresh: false, ...values });
}

/** A frame the request may go to: of the same site, and https when the entry asks for it. */
function frameFits(report: FrameReport, request: FillRequest): boolean {
  const page = pageOf(report.origin);
  return Boolean(page && page.site === request.site && (page.secure || !request.secure));
}

/**
 * First every frame says where it is and what fields it has, with no values
 * sent; then only the frames of the site, and with login fields, get them.
 */
async function fillTab(tabId: number, request: FillRequest): Promise<FrameReport[]> {
  const frames = await inspectTab(tabId);
  const documentIds = frames.filter(({ report }) => frameFits(report, request) && (report.username || report.password || report.otp)).map(({ documentId }) => documentId);
  if (!documentIds.length) return [];
  const results = await chrome.scripting.executeScript({ target: { tabId, documentIds }, func: loginForm, args: [request] });
  return results.flatMap(({ result }) => (result ? [result] : []));
}

async function inspectTab(tabId: number): Promise<{ documentId: string; report: FrameReport }[]> {
  const results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: loginForm, args: [null] });
  return results.flatMap(({ documentId, result }) => (result && documentId ? [{ documentId, report: result }] : []));
}

/**
 * Asks the panels first: one with changes that cannot be saved keeps the
 * database open, as the page itself would. Otherwise the offscreen document
 * closes, and the key with it.
 */
async function lock(reason: 'idle' | 'manual'): Promise<void> {
  const answer = await send<{ kept: boolean }>('panel', { type: 'lock', reason });
  if (!answer?.kept) await close();
}

async function close(): Promise<void> {
  index = null;
  chosen.clear();
  await send('offscreen', { type: 'lock' });
  await chrome.offscreen.closeDocument().catch(() => undefined);
  // Asked for meanwhile by a keep-alive, it came from a document about to close.
  index = null;
  void send('panel', { type: 'locked' });
}

listen('background', {
  /** The websites of the database the offscreen document has just opened. */
  index: (message) => {
    index = message['entries'] as Indexed[];
  },
  /** Every 20 s from the offscreen document; after a restart it brings the index back. */
  alive: async () => {
    if (!index) index = await send<Indexed[]>('offscreen', { type: 'index' });
  },
  idle: () => lock('idle'),
  /** Lock in the popup: as in the toolbar's menu. */
  lockAll: () => lock('manual'),
  /** The popup opened the panel to make a password for the tab's page. */
  handOver: (message) => handOver(Number(message['tabId']), Number(message['windowId'])),
  /** A panel locked the database. */
  lock: () => close(),
  /** A panel fills the entry picked in it into its tab. */
  fill: async (message) => {
    const tabId = Number(message['tabId']);
    const uuid = message['uuid'];
    if (typeof uuid === 'string') chosen.set(tabId, uuid);
    try {
      return { frames: await fillTab(tabId, message['request'] as FillRequest) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
  /** What the tab's frames have: login fields, a user name typed. */
  inspect: async (message) => {
    try {
      return { frames: (await inspectTab(Number(message['tabId']))).map(({ report }) => report) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
  /** A panel has started: a fill it was opened for. */
  hello: (message) => {
    const windowId = Number(message['windowId']);
    const ask = asks.get(windowId);
    asks.delete(windowId);
    return ask && Date.now() - ask.at < ASK_FOR ? ask : null;
  },
  /** The menus in the panel's language. */
  menus: (message) => {
    for (const id of ['fill', 'lock']) chrome.contextMenus.update(id, { title: String(message[id]) }, () => void chrome.runtime.lastError);
  },
});

// Started again while the database is open: its index is back before long.
void send<Indexed[]>('offscreen', { type: 'index' }).then((entries) => {
  if (entries && !index) index = entries;
});
