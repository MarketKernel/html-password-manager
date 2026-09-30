/**
 * What the page can do beyond itself. The single HTML file and the PWA do
 * nothing more, so every hook here does nothing. The Chrome extension's
 * build puts src/extension/extension.ts in this module's place (build.mjs): there the
 * page is the side panel, which hands the open database to the offscreen
 * document and fills logins into the tab beside it.
 */

import type { DbFile } from './files';
import type { Entry } from '../core/kdbx';
import type { Page } from '../core/match';

/** What opens the database: its file as last read or saved, the password and the key file. */
export interface OpenState {
  name: string;
  data: ArrayBuffer;
  password: string;
  keyFile: { name: string; data: ArrayBuffer } | null;
}

/** A database still open elsewhere, to show again without the password. */
export interface Resumed extends OpenState {
  file: DbFile;
}

/** The page in the tab beside the panel. */
export interface TabPage extends Page {
  /** "https://www.github.com": the website of an entry made for it. */
  origin: string;
}

export interface PlatformHost {
  /** Locks as asked from elsewhere: idle, the screen locked, the toolbar's menu. False when it stayed open. */
  lock(reason: 'idle' | 'manual'): Promise<boolean>;
  /** The tab beside the panel shows another page. */
  pageChanged(): void;
  /** "Fill" in the tab's context menu could not fill by itself, and the panel was opened to finish. */
  fillAsked(): void;
  /** Unlocked elsewhere — in the toolbar's popup: the database is there to take up. */
  unlocked(): void;
}

export interface Platform {
  start(host: PlatformHost): void;
  resume(): Promise<Resumed | null>;
  /** The database was unlocked or saved: this is what opens it now. */
  opened(state: OpenState): void;
  locked(): void;
  /** The user did something: the idle lock starts over. */
  activity(): void;
  settings(settings: { lockMinutes: number; clipboardSeconds: number }): void;
  /** A secret was copied, to be wiped in `seconds` even if this page is gone by then. */
  copied(seconds: number): void;
  /** The idle lock is kept elsewhere, and this page leaves it alone. */
  idleElsewhere(): boolean;
  languageChanged(): void;
  page(): TabPage | null;
  /** Fills an entry into the tab — null where there is no tab. `fresh`: its password was just made for the page. */
  fill: ((entry: Entry, fresh?: boolean) => Promise<void>) | null;
  /** What is typed as the user name on the page. */
  typedUser(): Promise<string>;
}

export const platform: Platform = {
  start: () => undefined,
  resume: async () => null,
  opened: () => undefined,
  locked: () => undefined,
  activity: () => undefined,
  settings: () => undefined,
  copied: () => undefined,
  idleElsewhere: () => false,
  languageChanged: () => undefined,
  page: () => null,
  fill: null,
  typedUser: async () => '',
};
