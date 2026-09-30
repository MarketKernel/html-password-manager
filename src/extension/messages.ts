/**
 * How the Chrome extension's parts talk: the side panel (src/app/main.ts with
 * src/extension/extension.ts), the toolbar's popup (src/extension/popup.ts), the
 * offscreen document (src/extension/offscreen.ts) and the service worker
 * (src/extension/background.ts). Only chrome.runtime messages, each
 * addressed to one part; a part takes a message only from this extension's
 * own pages and worker — never from a web page, which has no way to send one.
 *
 * Messages go as JSON, so bytes travel in base64. Nothing here imports the
 * database code: the service worker stays small.
 */

export type Part = 'panel' | 'offscreen' | 'background';

/** A ProtectedValue in its two halves, the XOR-masked bytes and the mask, in base64. */
export interface Masked {
  value: string;
  salt: string;
}

/** An open database, as the offscreen document keeps it and a panel takes it up. */
export interface Session {
  /** The file's name; a panel finds its handle among the recent files by it. */
  name: string;
  /** The file as last read or saved, encrypted. */
  data: string;
  password: Masked | null;
  keyFile: { name: string; data: string } | null;
}

/** An entry's website, as the service worker matches a tab against it. */
export interface Indexed {
  uuid: string;
  site: string;
  secure: boolean;
}

/** An entry as the popup lists it: what shows, never a password. */
export interface Listed {
  uuid: string;
  /** Empty for an untitled entry: the popup names it in its own language. */
  title: string;
  username: string;
  /** The entry's website, null when it names none. */
  target: { site: string; secure: boolean } | null;
  /** It has a one-time code. */
  otp: boolean;
}

/** An entry's values for a page. */
export interface Credentials {
  username: string;
  password: string;
  otp: string;
}

/** A panel was opened to fill this tab, and could not. */
export interface FillAsk {
  tabId: number;
  windowId: number;
  at: number;
}

export interface Settings {
  lockMinutes: number;
  clipboardSeconds: number;
}

export function send<T>(to: Part, message: { type: string } & Record<string, unknown>): Promise<T | null> {
  // No part listening at all is not an error here: no offscreen document means no open database.
  return chrome.runtime.sendMessage({ ...message, to }).then(
    (reply: T | undefined) => reply ?? null,
    () => null,
  );
}

type Handler = (message: Record<string, unknown>, sender: chrome.runtime.MessageSender) => unknown;

/**
 * Answers the messages addressed to `me`; a handler's promise is awaited, its
 * result is the reply. One `mine` turns down stays unanswered, for another
 * listener of the same part — the panel of another window — to answer.
 */
export function listen(me: Part, handlers: Record<string, Handler>, mine: (message: Record<string, unknown>) => boolean = () => true): void {
  const own = chrome.runtime.getURL('');
  chrome.runtime.onMessage.addListener((message: Record<string, unknown> | null, sender, reply) => {
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(own) || message?.['to'] !== me || !mine(message)) return false;
    const handler = handlers[String(message['type'])];
    if (!handler) return false;
    Promise.resolve()
      .then(() => handler(message, sender))
      .then(
        (result) => reply(result ?? null),
        (error: unknown) => reply({ error: error instanceof Error ? error.message : String(error) }),
      );
    return true;
  });
}

/** A password as a ProtectedValue keeps it, made without the database code: its UTF-8 bytes XOR a random mask. */
export function mask(text: string): Masked | null {
  if (!text) return null;
  const bytes = new TextEncoder().encode(text);
  const salt = crypto.getRandomValues(new Uint8Array(bytes.length));
  for (let at = 0; at < bytes.length; at += 1) bytes[at] = (bytes[at] ?? 0) ^ (salt[at] ?? 0);
  return { value: toBase64(bytes), salt: toBase64(salt) };
}

export function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text = '';
  for (let at = 0; at < view.length; at += 0x8000) text += String.fromCharCode(...view.subarray(at, at + 0x8000));
  return btoa(text);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let at = 0; at < raw.length; at += 1) out[at] = raw.charCodeAt(at);
  return out;
}

export const OFFSCREEN = 'offscreen.html';

/** Makes the offscreen document unless it is there; Chrome allows one. */
export async function ensureOffscreen(): Promise<void> {
  const url = chrome.runtime.getURL(OFFSCREEN);
  const found = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT], documentUrls: [url] });
  if (found.length) return;
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN,
      reasons: [chrome.offscreen.Reason.DOM_PARSER, chrome.offscreen.Reason.CLIPBOARD],
      justification: 'Keeps the unlocked KeePass database (whose XML kdbxweb reads with DOMParser) until it locks, to fill login forms, and wipes a copied password from the clipboard.',
    });
  } catch (error) {
    // Made meanwhile by another part: that is the one.
    if (!/single offscreen/i.test(String(error))) throw error;
  }
}
