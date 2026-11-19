/**
 * Access to the database file.
 *
 * Chromium hands over a real `FileSystemFileHandle` (file picker or a
 * drag-and-drop `getAsFileSystemHandle`), which reads *and* writes in place.
 * Everywhere else we only get a `File` from `<input type=file>` or a plain
 * drop, so the database is read-only and saving falls back to downloading a
 * fresh copy.
 *
 * Handles of recently opened files are kept in IndexedDB — only the handles,
 * never the contents or a password — so the next visit just asks to unlock.
 */

import { t } from '../core/i18n';
import { isTouch } from './screens';

export interface DbFile {
  readonly name: string;
  /** False → saving offers a download instead of writing to disk. */
  readonly writable: boolean;
  readonly handle: FileHandleLike | null;
  read(): Promise<ArrayBuffer>;
  write(data: ArrayBuffer): Promise<void>;
}

interface WritableLike {
  write(data: ArrayBuffer | Blob): Promise<void>;
  close(): Promise<void>;
}

export interface FileHandleLike {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable?(): Promise<WritableLike>;
  queryPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  isSameEntry?(other: FileHandleLike): Promise<boolean>;
}

interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}

declare global {
  interface Window {
    showOpenFilePicker?(options?: { types?: PickerType[]; excludeAcceptAllOption?: boolean; id?: string }): Promise<FileHandleLike[]>;
    showSaveFilePicker?(options?: { suggestedName?: string; types?: PickerType[]; id?: string }): Promise<FileHandleLike>;
  }
  interface DataTransferItem {
    getAsFileSystemHandle?(): Promise<FileHandleLike | { kind: 'directory' } | null>;
  }
  interface Window {
    launchQueue?: { setConsumer(consumer: (params: { readonly files: readonly (FileHandleLike | { kind: 'directory' })[] }) => void): void };
  }
}

const kdbxType = (): PickerType => ({
  description: t('gate', 'KeePass database'),
  accept: { 'application/octet-stream': ['.kdbx'] },
});

export const canWriteInPlace = typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';

/**
 * Chrome has been seen to stop answering anything about a file remembered from
 * an earlier session — whether the page may open it, whether it is the one
 * just opened — with no error either. Whoever waits on it waits for good: an
 * "Unlocking…" that never ends, and every other file turned away meanwhile.
 * Past two seconds `late` stands for the answer.
 */
export function answered<T>(asked: Promise<T>, late: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => (timer = setTimeout(() => resolve(late), 2000)));
  return Promise.race([asked, timeout]).finally(() => clearTimeout(timer));
}

export class HandleFile implements DbFile {
  writable = false;
  /** False when the browser did not say in time whether the page may write the file: it will not ask the user either. */
  private answers = true;

  constructor(readonly handle: FileHandleLike) {}

  get name(): string {
    return this.handle.name;
  }

  async read(): Promise<ArrayBuffer> {
    return (await this.handle.getFile()).arrayBuffer();
  }

  async write(data: ArrayBuffer): Promise<void> {
    if (!this.handle.createWritable) throw new Error(t('errors', 'This browser cannot write files'));
    // The browser writes to a temporary file and swaps it in on close, so a
    // failure halfway leaves the old database intact.
    const stream = await this.handle.createWritable();
    await stream.write(data);
    await stream.close();
  }

  /** The access the browser says the page has; null when it does not say in time. */
  permission(mode: 'read' | 'readwrite'): Promise<PermissionState | null> {
    if (!this.handle.queryPermission) return Promise.resolve('prompt');
    return answered<PermissionState | null>(this.handle.queryPermission({ mode }), null);
  }

  /** Read access must be re-granted after a reload; this needs a user gesture. */
  async ensureReadable(): Promise<void> {
    if (!this.handle.queryPermission || !this.handle.requestPermission) return;
    // Right after the browser kept silent about writing, asking about reading would only add two seconds.
    const state = this.answers ? await this.permission('read') : null;
    if (state === 'granted') return;
    // Where the browser says nothing about the file, it shows no prompt for it either: the click would do nothing.
    // Picked anew, the same file is a handle it answers for.
    if (state === null) {
      throw new Error(t('errors', 'The browser does not answer for "{name}". Open it with "Open file" — or restart the browser.', { name: this.name }));
    }
    if ((await this.handle.requestPermission({ mode: 'read' })) !== 'granted') {
      throw new Error(t('errors', 'The browser was not allowed to read the file'));
    }
  }

  /** Asks for write access; a refusal, or no answer, only downgrades the database to read-only. */
  async ensureWritable(): Promise<boolean> {
    this.answers = true;
    if (!this.handle.createWritable) return (this.writable = false);
    try {
      if (!this.handle.requestPermission) return (this.writable = true);
      const state = await this.permission('readwrite');
      if (state === 'granted') return (this.writable = true);
      if (state === null) {
        this.answers = false;
        return (this.writable = false);
      }
      return (this.writable = (await this.handle.requestPermission({ mode: 'readwrite' })) === 'granted');
    } catch {
      return (this.writable = false);
    }
  }

  /** Whether `other` is this very file; a browser that does not say in time is taken at the name. */
  async isSame(other: FileHandleLike): Promise<boolean> {
    if (!this.handle.isSameEntry) return false;
    try {
      return (await answered<boolean | null>(this.handle.isSameEntry(other), null)) ?? other.name === this.name;
    } catch {
      return false;
    }
  }
}

export class BlobFile implements DbFile {
  readonly writable = false;
  readonly handle = null;

  constructor(private readonly file: File) {}

  get name(): string {
    return this.file.name;
  }

  read(): Promise<ArrayBuffer> {
    return this.file.arrayBuffer();
  }

  async write(): Promise<void> {
    throw new Error(t('errors', 'The file is open read-only'));
  }
}

/** A database that has not been saved anywhere yet. */
export class NewFile implements DbFile {
  readonly writable = false;
  readonly handle = null;

  constructor(readonly name: string) {}

  async read(): Promise<ArrayBuffer> {
    throw new Error(t('errors', 'The database has not been saved yet'));
  }

  async write(): Promise<void> {
    throw new Error(t('errors', 'The database has not been saved yet'));
  }
}

/** Null when the user dismissed the picker or the browser has none. */
export async function pickFile(): Promise<HandleFile | null> {
  if (!window.showOpenFilePicker) return null;
  try {
    const [handle] = await window.showOpenFilePicker({ types: [kdbxType()], id: 'kdbx' });
    return handle ? new HandleFile(handle) : null;
  } catch (error) {
    if (isAbort(error)) return null;
    throw error;
  }
}

/** A new file on disk to save into; null when dismissed or unsupported. */
export async function pickSaveTarget(suggestedName: string): Promise<HandleFile | null> {
  if (!window.showSaveFilePicker) return null;
  try {
    const handle = await window.showSaveFilePicker({ suggestedName, types: [kdbxType()], id: 'kdbx' });
    const file = new HandleFile(handle);
    file.writable = true;
    return file;
  } catch (error) {
    if (isAbort(error)) return null;
    throw error;
  }
}

/**
 * A .kdbx the system opened with the installed app (the manifest's
 * file_handlers): Chrome hands it to this consumer, in the window already open
 * too, as the manifest's launch_handler asks. A handle, so saving writes in place.
 */
export function onLaunchedFile(open: (file: HandleFile) => void): void {
  window.launchQueue?.setConsumer((params) => {
    const handle = params.files.find((item): item is FileHandleLike => item.kind === 'file');
    if (handle) open(new HandleFile(handle));
  });
}

export async function fileFromDrop(transfer: DataTransfer): Promise<DbFile | null> {
  for (const item of Array.from(transfer.items)) {
    if (item.kind !== 'file' || !item.getAsFileSystemHandle) continue;
    const handle = await item.getAsFileSystemHandle();
    if (handle && handle.kind === 'file') return new HandleFile(handle as FileHandleLike);
  }
  const file = transfer.files[0];
  return file ? new BlobFile(file) : null;
}

export function download(data: ArrayBuffer | Uint8Array, name: string, type = 'application/octet-stream'): void {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const shareable = (data: ArrayBuffer | Uint8Array, name: string): File => new File([data as BlobPart], name, { type: 'application/octet-stream' });

/**
 * Save hands the database to the system's share sheet instead of downloading
 * it: a phone that can take a file that way — on iOS, where "Save to Files"
 * lives, which can put it over the original. Chrome on Android takes only
 * pictures, sound, video and text, so there a download it stays; a computer
 * that could share would still rather download.
 */
export function sharesFiles(): boolean {
  try {
    return (
      isTouch() &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [shareable(new Uint8Array(0), 'Database.kdbx')] })
    );
  } catch {
    return false;
  }
}

/** 'cancelled' when the share sheet was closed without taking the file. */
export async function shareOrDownload(data: ArrayBuffer | Uint8Array, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (sharesFiles()) {
    try {
      await navigator.share({ files: [shareable(data, name)], title: name });
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
      // NotAllowedError: the tap that asked is too long ago, after a slow key derivation.
    }
  }
  download(data, name);
  return 'downloaded';
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/* ------------------------------------------------------------------ *
 * Recent files (IndexedDB)
 * ------------------------------------------------------------------ */

export interface RecentFile {
  name: string;
  handle: FileHandleLike;
  opened: number;
}

const IDB_NAME = 'html-password-manager';
const IDB_STORE = 'recent';
const RECENT_MAX = 6;

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IDB_STORE, { keyPath: 'name' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB is unavailable'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const idb = await openIdb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(idb.transaction(IDB_STORE, mode).objectStore(IDB_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  } finally {
    idb.close();
  }
}

export async function recentFiles(): Promise<RecentFile[]> {
  if (!canWriteInPlace || typeof indexedDB === 'undefined') return [];
  try {
    const all = await withStore<RecentFile[]>('readonly', (store) => store.getAll() as IDBRequest<RecentFile[]>);
    return all.sort((a, b) => b.opened - a.opened);
  } catch {
    return [];
  }
}

export async function rememberFile(file: DbFile): Promise<void> {
  if (!file.handle || typeof indexedDB === 'undefined') return;
  try {
    const record: RecentFile = { name: file.name, handle: file.handle, opened: Date.now() };
    await withStore('readwrite', (store) => store.put(record));
    const all = await recentFiles();
    for (const stale of all.slice(RECENT_MAX)) await forgetFile(stale.name);
  } catch {
    /* no IndexedDB (private mode) — the file simply is not offered next time */
  }
}

export async function forgetFile(name: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(name));
  } catch {
    /* nothing to forget */
  }
}
