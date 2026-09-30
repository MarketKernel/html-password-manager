/**
 * The KeePass side: opening, saving and creating .kdbx files with kdbxweb (the
 * library KeeWeb is built on), plus the small field helpers the views share.
 *
 * kdbxweb does everything except Argon2, which it leaves to the host. hash-wasm
 * supplies it as WebAssembly embedded in its own JS, so the single HTML file
 * still needs nothing from the network.
 */

import * as kdbxweb from 'kdbxweb';
import { argon2d, argon2id } from 'hash-wasm';
import { t } from './i18n';

export type Kdbx = kdbxweb.Kdbx;
export type Entry = kdbxweb.KdbxEntry;
export type Group = kdbxweb.KdbxGroup;
export type FieldValue = kdbxweb.KdbxEntryField;
export const ProtectedValue = kdbxweb.ProtectedValue;
export type ProtectedValue = kdbxweb.ProtectedValue;

/** Title, user name, password, URL and notes; everything else is a custom field. */
export const STANDARD_FIELDS = ['Title', 'UserName', 'Password', 'URL', 'Notes'] as const;

/** Argon2 cost for new databases: KeePassXC's defaults, about a second in a browser. */
const NEW_DB_ARGON2 = { memory: 64 * 1024 * 1024, iterations: 10, parallelism: 2 };

kdbxweb.CryptoEngine.setArgon2Impl(async (password, salt, memory, iterations, length, parallelism, type, version) => {
  if (version !== 0x13) throw new Error('Argon2 version 1.0 is not supported, only 1.3');
  const options = {
    password: new Uint8Array(password),
    salt: new Uint8Array(salt),
    memorySize: memory,
    iterations,
    parallelism,
    hashLength: length,
    outputType: 'binary' as const,
  };
  const hash = type === kdbxweb.CryptoEngine.Argon2TypeArgon2id ? await argon2id(options) : await argon2d(options);
  return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength) as ArrayBuffer;
});

export async function credentials(password: string, keyFile: ArrayBuffer | null): Promise<kdbxweb.KdbxCredentials> {
  const creds = new kdbxweb.KdbxCredentials(
    // A database locked with a key file alone has no password component at all.
    password || !keyFile ? kdbxweb.ProtectedValue.fromString(password) : null,
    keyFile,
  );
  await creds.ready;
  return creds;
}

export async function openDatabase(data: ArrayBuffer, password: string, keyFile: ArrayBuffer | null): Promise<Kdbx> {
  return kdbxweb.Kdbx.load(data, await credentials(password, keyFile));
}

/** Trims history to the database's own limits and drops orphaned attachments, as KeePass does. */
export async function saveDatabase(db: Kdbx): Promise<ArrayBuffer> {
  db.cleanup({ historyRules: true, binaries: true });
  return db.save();
}

export async function createDatabase(name: string, password: string, keyFile: ArrayBuffer | null): Promise<Kdbx> {
  const db = kdbxweb.Kdbx.create(await credentials(password, keyFile), name);
  db.setKdf(kdbxweb.Consts.KdfId.Argon2id);
  const params = db.header.kdfParameters;
  if (params) {
    params.set('M', kdbxweb.VarDictionary.ValueType.UInt64, kdbxweb.Int64.from(NEW_DB_ARGON2.memory));
    params.set('I', kdbxweb.VarDictionary.ValueType.UInt64, kdbxweb.Int64.from(NEW_DB_ARGON2.iterations));
    params.set('P', kdbxweb.VarDictionary.ValueType.UInt32, NEW_DB_ARGON2.parallelism);
  }
  const root = db.getDefaultGroup();
  root.name = name;
  const groups = [[t('database', 'General'), 48], [t('database', 'Email'), 19], [t('database', 'Internet'), 1], [t('database', 'Banking'), 37]] as const;
  for (const [title, icon] of groups) {
    db.createGroup(root, title).icon = icon;
  }
  // Kdbx.create makes the recycle bin first; KeePass keeps it at the bottom.
  const bin = recycleBin(db);
  if (bin) db.move(bin, root);
  return db;
}

export async function changeCredentials(db: Kdbx, password: string, keyFile: ArrayBuffer | null): Promise<void> {
  db.credentials = await credentials(password, keyFile);
  db.meta.keyChanged = new Date();
}

/** A human sentence for whatever kdbxweb or the file system threw. */
export function describeError(error: unknown): string {
  if (error instanceof kdbxweb.KdbxError) {
    switch (error.code) {
      case kdbxweb.Consts.ErrorCodes.InvalidKey:
        return t('errors', 'Wrong password or key file');
      case kdbxweb.Consts.ErrorCodes.BadSignature:
        return t('errors', 'This is not a KeePass database');
      case kdbxweb.Consts.ErrorCodes.InvalidVersion:
      case kdbxweb.Consts.ErrorCodes.Unsupported:
        return t('errors', 'This database format is not supported: {reason}', { reason: error.message });
      case kdbxweb.Consts.ErrorCodes.FileCorrupt:
        return t('errors', 'The file is damaged: {reason}', { reason: error.message });
      default:
        return error.message;
    }
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/** "KDBX 4.0 · AES-256 · Argon2id" for the status bar. */
export function describeFormat(db: Kdbx): string {
  const { CipherId, KdfId } = kdbxweb.Consts;
  const cipher = db.header.dataCipherUuid?.id;
  const cipherName = cipher === CipherId.Aes ? 'AES-256' : cipher === CipherId.ChaCha20 ? 'ChaCha20' : 'Twofish';
  let kdf = 'AES-KDF';
  const kdfUuid = db.header.kdfParameters?.get('$UUID');
  if (kdfUuid instanceof ArrayBuffer) {
    const id = kdbxweb.ByteUtils.bytesToBase64(kdfUuid);
    kdf = id === KdfId.Argon2d ? 'Argon2d' : id === KdfId.Argon2id ? 'Argon2id' : 'AES-KDF';
  }
  return `KDBX ${db.versionMajor}.${db.versionMinor} · ${cipherName} · ${kdf}`;
}

/* ------------------------------------------------------------------ *
 * Fields
 * ------------------------------------------------------------------ */

export function text(value: FieldValue | undefined): string {
  if (value === undefined) return '';
  return value instanceof kdbxweb.ProtectedValue ? value.getText() : value;
}

export function field(entry: Entry, name: string): string {
  return text(entry.fields.get(name));
}

export function isProtected(entry: Entry, name: string): boolean {
  return entry.fields.get(name) instanceof kdbxweb.ProtectedValue;
}

export function isStandard(name: string): boolean {
  return (STANDARD_FIELDS as readonly string[]).includes(name);
}

export function customFields(entry: Entry): string[] {
  return Array.from(entry.fields.keys()).filter((name) => !isStandard(name));
}

export function makeValue(value: string, protect: boolean): FieldValue {
  return protect ? kdbxweb.ProtectedValue.fromString(value) : value;
}

export function titleOf(entry: Entry): string {
  return field(entry, 'Title').trim() || t('entry', '(untitled)');
}

export function uuidOf(object: Entry | Group): string {
  return object.uuid.id;
}

/* ------------------------------------------------------------------ *
 * Structure
 * ------------------------------------------------------------------ */

export function recycleBin(db: Kdbx): Group | null {
  const uuid = db.meta.recycleBinUuid;
  if (!db.meta.recycleBinEnabled || !uuid || uuid.empty) return null;
  return db.getGroup(uuid) ?? null;
}

export function isInside(object: Entry | Group, group: Group | null): boolean {
  if (!group) return false;
  for (let node: Group | undefined = object instanceof kdbxweb.KdbxGroup ? object : object.parentGroup; node; node = node.parentGroup) {
    if (node === group) return true;
  }
  return false;
}

export function inRecycleBin(db: Kdbx, object: Entry | Group): boolean {
  return isInside(object, recycleBin(db));
}

/** Group names from the root down, the root itself left out. */
export function groupPath(group: Group | undefined): string[] {
  const names: string[] = [];
  for (let node = group; node?.parentGroup; node = node.parentGroup) names.unshift(node.name ?? '');
  return names;
}

/** Every entry below `group`, the recycle bin skipped unless `group` is inside it. */
export function entriesBelow(db: Kdbx, group: Group): Entry[] {
  const bin = recycleBin(db);
  const skipBin = !isInside(group, bin);
  const out: Entry[] = [];
  const walk = (node: Group): void => {
    if (skipBin && node === bin) return;
    out.push(...node.entries);
    for (const child of node.groups) walk(child);
  };
  walk(group);
  return out;
}

export function allTags(db: Kdbx): Map<string, number> {
  const tags = new Map<string, number>();
  for (const entry of entriesBelow(db, db.getDefaultGroup())) {
    for (const tag of entry.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }
  return new Map([...tags].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })));
}

export function createEntry(db: Kdbx, group: Group): Entry {
  return db.createEntry(group);
}

export function createGroup(db: Kdbx, parent: Group, name: string): Group {
  const group = db.createGroup(parent, name);
  group.icon = 48;
  return group;
}

/** To the recycle bin; out of the file for good when it already is in there. */
export function remove(db: Kdbx, object: Entry | Group): 'trashed' | 'deleted' {
  if (inRecycleBin(db, object) || !db.meta.recycleBinEnabled) {
    db.move(object, null);
    return 'deleted';
  }
  db.remove(object);
  return 'trashed';
}

export function emptyRecycleBin(db: Kdbx): void {
  const bin = recycleBin(db);
  if (!bin) return;
  for (const group of bin.groups.slice()) db.move(group, null);
  for (const entry of bin.entries.slice()) db.move(entry, null);
}

/** Back to the group it was deleted from, or to the root when that is gone too. */
export function restore(db: Kdbx, object: Entry | Group): void {
  const previous = object.previousParentGroup ? db.getGroup(object.previousParentGroup) : undefined;
  const target = previous && !inRecycleBin(db, previous) ? previous : db.getDefaultGroup();
  db.move(object, target);
}

/** A group cannot be dropped into itself or anything below it. */
export function canMoveGroup(group: Group, target: Group): boolean {
  return !isInside(target, group) && group.parentGroup !== target;
}

export function touch(object: Entry | Group): void {
  object.times.update();
}

/* ------------------------------------------------------------------ *
 * Attachments and icons
 * ------------------------------------------------------------------ */

export function binaryBytes(value: kdbxweb.KdbxBinary | kdbxweb.KdbxBinaryWithHash): Uint8Array {
  const raw = kdbxweb.KdbxBinaries.isKdbxBinaryWithHash(value) ? value.value : value;
  if (raw instanceof kdbxweb.ProtectedValue) return raw.getBinary();
  return new Uint8Array(raw as ArrayBuffer);
}

export async function addAttachment(db: Kdbx, entry: Entry, name: string, data: ArrayBuffer): Promise<void> {
  entry.binaries.set(name, await db.createBinary(data));
}

export function customIcon(db: Kdbx, object: Entry | Group): ArrayBuffer | null {
  if (!object.customIcon) return null;
  return db.meta.customIcons.get(object.customIcon.id)?.data ?? null;
}

export function cloneEntry(db: Kdbx, entry: Entry): Entry {
  const group = entry.parentGroup ?? db.getDefaultGroup();
  const copy = db.createEntry(group);
  const uuid = copy.uuid;
  copy.copyFrom(entry);
  copy.uuid = uuid;
  copy.history = [];
  copy.times = kdbxweb.KdbxTimes.create();
  copy.fields.set('Title', makeValue(t('entry', '{title} (copy)', { title: field(entry, 'Title') }), isProtected(entry, 'Title')));
  return copy;
}

export { kdbxweb };
