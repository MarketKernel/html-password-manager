/**
 * The Chrome extension's offscreen document: the open database while it
 * stays unlocked, whether the side panel is open or not.
 *
 * On every unlock and save the panel — or the toolbar's popup, which unlocks
 * nothing itself — hands it the file and its key — the
 * password in a ProtectedValue, the key file — which it keeps in memory
 * only, with a copy of the database decrypted from them. The copy is read,
 * never changed: the service worker's menu gets one entry's values from it
 * at a time, the popup a list of titles and user names and then one entry's
 * values, and a panel opened again gets the file and the key back, to
 * decrypt the file itself without asking for the password.
 *
 * The idle lock lives here, for a fill from the menu is activity too; and so
 * does wiping a copied secret from the clipboard, which the panel cannot do
 * once it is closed or has lost the focus. Locking closes this document, and
 * whatever it held goes with it; nothing is written anywhere.
 */

import { entriesBelow, field, kdbxweb, openDatabase, ProtectedValue, uuidOf, type Entry, type Kdbx } from '../core/kdbx';
import { entriesFor, targetOf, type Page } from '../core/match';
import { fromBase64, listen, send, type Credentials, type Indexed, type Listed, type Session, type Settings } from './messages';
import { otpFromFields, totp } from '../core/otp';
import { matches, sortEntries } from '../app/search';

/** Search results in the popup: enough to pick from, the rest is a word more away. */
const FOUND_MAX = 50;

let open: { session: Session; db: Kdbx } | null = null;
let settings: Settings = { lockMinutes: 15, clipboardSeconds: 30 };
let lastActivity = Date.now();
/** When the worker was last told the database is idle; it asks the panels, which may keep it open. */
let idleSent = 0;
let wipeTimer = 0;
let wipePending = false;

function passwordOf(session: Session): string {
  const masked = session.password;
  return masked ? new ProtectedValue(fromBase64(masked.value).buffer, fromBase64(masked.salt).buffer).getText() : '';
}

async function load(session: Session): Promise<void> {
  const db = await openDatabase(fromBase64(session.data).buffer, passwordOf(session), session.keyFile ? fromBase64(session.keyFile.data).buffer : null);
  open = { session, db };
  lastActivity = Date.now();
  idleSent = 0;
  await send('background', { type: 'index', entries: indexOf(db) });
}

/** The websites of the entries outside the recycle bin, for the worker's menu. */
function indexOf(db: Kdbx): Indexed[] {
  return entriesBelow(db, db.getDefaultGroup()).flatMap((entry) => {
    const target = targetOf(field(entry, 'URL'));
    return target ? [{ uuid: uuidOf(entry), ...target }] : [];
  });
}

function find(db: Kdbx, uuid: string): Entry | null {
  return entriesBelow(db, db.getDefaultGroup()).find((entry) => uuidOf(entry) === uuid) ?? null;
}

const hasOtp = (entry: Entry): boolean => otpFromFields((name) => (entry.fields.has(name) ? field(entry, name) : undefined)) !== null;

/** The popup's list: the entries for the tab's page, or those a search finds among all. */
function listed(db: Kdbx, page: Page | null, query: string): Listed[] {
  const all = entriesBelow(db, db.getDefaultGroup());
  const found = query ? sortEntries(all.filter((entry) => matches(entry, query)), 'title').slice(0, FOUND_MAX) : sortEntries(entriesFor(all, (entry) => field(entry, 'URL'), page), 'title');
  return found.map((entry) => ({ uuid: uuidOf(entry), title: field(entry, 'Title').trim(), username: field(entry, 'UserName'), target: targetOf(field(entry, 'URL')), otp: hasOtp(entry) }));
}

async function credentials(entry: Entry): Promise<Credentials> {
  const otp = otpFromFields((name) => (entry.fields.has(name) ? field(entry, name) : undefined));
  return { username: field(entry, 'UserName'), password: field(entry, 'Password'), otp: otp ? await totp(otp) : '' };
}

/** An offscreen document never has the focus, so the clipboard is written the old way: a copy event it fills itself. */
function wipeClipboard(): void {
  window.clearTimeout(wipeTimer);
  if (!wipePending) return;
  wipePending = false;
  const empty = (event: ClipboardEvent): void => {
    event.clipboardData?.setData('text/plain', '');
    event.preventDefault();
  };
  document.addEventListener('copy', empty);
  document.execCommand('copy');
  document.removeEventListener('copy', empty);
}

listen('offscreen', {
  /** The panel unlocked or saved the database, or the popup unlocks it: this is the file, and what opens it. */
  open: async (message) => {
    try {
      await load(message['session'] as Session);
      return { ok: true };
    } catch (error) {
      // The popup says it in the language it speaks.
      const wrongKey = error instanceof kdbxweb.KdbxError && error.code === kdbxweb.Consts.ErrorCodes.InvalidKey;
      return { error: error instanceof Error ? error.message : String(error), wrongKey };
    }
  },
  /** A panel started: the database to take up, or null when it is locked. */
  session: () => {
    lastActivity = Date.now();
    return open?.session ?? null;
  },
  index: () => (open ? indexOf(open.db) : null),
  /** The popup's list, null when locked. Opening the popup is activity. */
  entries: (message) => {
    if (!open) return null;
    lastActivity = Date.now();
    idleSent = 0;
    return listed(open.db, (message['page'] as Page | null) ?? null, String(message['query'] ?? '').trim());
  },
  /** One entry's values, for the worker to fill. */
  credentials: async (message) => {
    if (!open) return null;
    lastActivity = Date.now();
    const entry = find(open.db, String(message['uuid']));
    return entry ? credentials(entry) : null;
  },
  activity: () => {
    lastActivity = Date.now();
    idleSent = 0;
  },
  settings: (message) => {
    settings = message['settings'] as Settings;
  },
  /** A panel copied a secret: it is wiped in so many seconds, unless something else is copied first. */
  copied: (message) => {
    window.clearTimeout(wipeTimer);
    const seconds = Number(message['seconds']);
    wipePending = seconds > 0;
    if (wipePending) wipeTimer = window.setTimeout(wipeClipboard, seconds * 1000);
  },
  /** Locking: the database goes and the clipboard is wiped, then the worker closes this document. */
  lock: () => {
    open = null;
    wipeClipboard();
  },
});

window.setInterval(() => {
  if (!open || settings.lockMinutes === 0) return;
  const now = Date.now();
  // Asked again after a minute, when a panel kept the database open for changes it could not save.
  if (now - lastActivity > settings.lockMinutes * 60_000 && now - idleSent > 60_000) {
    idleSent = now;
    void send('background', { type: 'idle' });
  }
}, 10_000);

// Every event resets the worker's 30-second idle timer: this keeps it — and its index — alive while the database is open.
window.setInterval(() => void send('background', { type: 'alive' }), 20_000);
