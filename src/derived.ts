/**
 * Derived passwords: computed from the master password, the site (the domain
 * of the entry's website), the user name and a version number instead of
 * being stored. Losing the file loses
 * nothing as long as the master password is remembered — the same inputs give
 * the same password on any machine.
 *
 * The entry keeps, in place of the password, a JSON object marked with a
 * fixed GUID: the version and the requirements (length, character sets). The
 * site and the user name are the entry's own fields, not copies of them.
 * Other KeePass apps see that JSON as the password; the format of the file
 * does not change.
 *
 * Generator 3, frozen — changing any constant here changes every password:
 *
 *   salt    = SHA-256("html-password-manager/derived/v3" 0x00
 *                     ‖ u32be(|site|) ‖ site ‖ u32be(|user|) ‖ user ‖ u32be(version))
 *   entropy = Argon2id(NFC(master password), salt, 64 MiB, 3 passes, 1 lane, 32 bytes)
 *   stream  = HMAC-SHA-256(entropy, "hpm-v3-stream" ‖ u32be(i)) for i = 0, 1, 2 …
 *   check   = hex(HMAC-SHA-256(entropy, "hpm-v3-check")[0..4])
 *
 * site is the host of the website, parsed as a WHATWG URL (https:// is put
 * in front when it has no scheme://): lower case, IDN in punycode, no port,
 * a leading "www." dropped. A website that is no URL is used as it is. Then
 * site is trimmed, NFC and lower case; user is trimmed and NFC; strings are
 * UTF-8. The requirements only shape the entropy into characters: each draw
 * takes a big-endian u32 from the stream, rejecting values ≥ 2³² − 2³² mod n;
 * one character from every chosen set, in the order A–Z, a–z, 0–9, symbols,
 * the rest from all of them, then a Fisher–Yates shuffle from the end.
 */

import { argon2id } from 'hash-wasm';
import { t } from './i18n';
import { field, ProtectedValue, type Entry } from './kdbx';

export interface Requirements {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  /** Keep look-alikes such as O/0 and l/1/I. */
  ambiguous: boolean;
}

export interface DerivedSpec extends Requirements {
  /** The domain of the entry's website — not stored, it follows the website. */
  site: string;
  /** 1 … 2³² − 1; the next version is a new password for the same account. */
  version: number;
  /** The check of the entropy the password was saved with, to notice a changed master password. */
  check?: string;
}

export interface Derived {
  password: string;
  check: string;
}

/** Marks a password field that holds derivation settings rather than a password. */
export const DERIVED_MARKER = '6f1c2b9e-4a7d-4e38-9b51-2d0c8a73f5e4';
export const GENERATOR_VERSION = 3;
export const VERSION_MAX = 0xffffffff;

export const REQUIREMENT_DEFAULTS: Requirements = {
  length: 20,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  ambiguous: false,
};

const V3 = {
  domain: 'html-password-manager/derived/v3',
  stream: 'hpm-v3-stream',
  check: 'hpm-v3-check',
  argon2: { memorySize: 64 * 1024, iterations: 3, parallelism: 1, hashLength: 32 },
  lengthMin: 4,
  lengthMax: 128,
  sets: {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    symbols: '!#$%&*+-=?@^_~.,:;()[]{}<>/|',
  },
  ambiguous: 'O0oIl1|',
} as const;

const encoder = new TextEncoder();

/* ------------------------------------------------------------------ *
 * The stored form
 * ------------------------------------------------------------------ */

export class DerivedError extends Error {}

/**
 * The settings in a password field, null for an ordinary password. Throws
 * when the field is marked as derived but cannot be used.
 */
export function parseDerived(text: string, url = ''): DerivedSpec | null {
  if (!text.startsWith('{') || !text.includes(DERIVED_MARKER)) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || data['$derived'] !== DERIVED_MARKER) return null;
  if (data['gen'] !== GENERATOR_VERSION) {
    throw new DerivedError(t('derived', 'This password is derived by generator {version}, which this version of the app does not know', { version: String(data['gen']) }));
  }
  const flag = (name: string): boolean => data[name] === true;
  const spec: DerivedSpec = {
    site: siteOf(url),
    version: Number(data['ver']),
    length: Number(data['len']),
    upper: flag('upper'),
    lower: flag('lower'),
    digits: flag('digits'),
    symbols: flag('symbols'),
    ambiguous: flag('ambiguous'),
  };
  if (typeof data['check'] === 'string') spec.check = data['check'];
  // A missing website is no damage: it is asked for when the password is needed.
  const problem = storedProblem(spec);
  if (problem) throw new DerivedError(t('derived', 'The derived password settings are damaged: {reason}', { reason: problem }));
  return spec;
}

export function serializeDerived(spec: DerivedSpec): string {
  return JSON.stringify({
    $derived: DERIVED_MARKER,
    gen: GENERATOR_VERSION,
    ver: spec.version,
    len: spec.length,
    upper: spec.upper,
    lower: spec.lower,
    digits: spec.digits,
    symbols: spec.symbols,
    ambiguous: spec.ambiguous,
    ...(spec.check ? { check: spec.check } : {}),
  });
}

/** What is wrong with the settings and the website, or null. */
export function specProblem(spec: DerivedSpec): string | null {
  if (!normalizeSite(spec.site)) return t('derived', 'Enter the website: the password is derived from its domain');
  return storedProblem(spec);
}

function storedProblem(spec: DerivedSpec): string | null {
  if (!Number.isInteger(spec.version) || spec.version < 1 || spec.version > VERSION_MAX) {
    return t('derived', 'The version is a whole number from 1 to {max}', { max: VERSION_MAX });
  }
  if (!Number.isInteger(spec.length) || spec.length < V3.lengthMin || spec.length > V3.lengthMax) {
    return t('derived', 'The length is from {min} to {max}', { min: V3.lengthMin, max: V3.lengthMax });
  }
  if (!spec.upper && !spec.lower && !spec.digits && !spec.symbols) return t('derived', 'Pick at least one character set');
  return null;
}

export function normalizeSite(site: string): string {
  return site.trim().normalize('NFC').toLowerCase();
}

export function normalizeUser(user: string): string {
  return user.trim().normalize('NFC');
}

/** "github.com" from "https://www.github.com/login", or the text itself when it is not a URL. Part of generator 3. */
export function siteOf(url: string): string {
  const text = url.trim();
  if (!text) return '';
  try {
    const host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`).hostname;
    if (host) return normalizeSite(host.replace(/^www\./, ''));
  } catch {
    /* not a URL */
  }
  return normalizeSite(text);
}

/** Entropy of a derived password: log2 of the alphabet times the length, capped by the 256 bits behind it. */
export function derivedBits(requirements: Requirements): number {
  const size = alphabets(requirements).join('').length;
  return size > 1 ? Math.min(256, Math.round(requirements.length * Math.log2(size))) : 0;
}

/* ------------------------------------------------------------------ *
 * Generator 3
 * ------------------------------------------------------------------ */

type Bytes = Uint8Array<ArrayBuffer>;

function u32(value: number): Bytes {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0);
  return out;
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function withLength(text: string): Bytes {
  const bytes = encoder.encode(text);
  return concat(u32(bytes.length), bytes);
}

/** The 32 bytes behind every password of one site, user name and version. */
export async function deriveEntropy(master: string, site: string, user: string, version: number): Promise<Bytes> {
  const salt = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      concat(encoder.encode(V3.domain), new Uint8Array([0]), withLength(normalizeSite(site)), withLength(normalizeUser(user)), u32(version)),
    ),
  );
  return new Uint8Array(await argon2id({ password: encoder.encode(master.normalize('NFC')), salt, ...V3.argon2, outputType: 'binary' }));
}

async function hmac(key: CryptoKey, data: Bytes): Promise<Bytes> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

function hmacKey(entropy: Bytes): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', entropy, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function keyCheck(entropy: Bytes): Promise<string> {
  const mac = await hmac(await hmacKey(entropy), encoder.encode(V3.check));
  return Array.from(mac.subarray(0, 4), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function alphabets(requirements: Requirements): string[] {
  const sets: string[] = [];
  for (const key of ['upper', 'lower', 'digits', 'symbols'] as const) {
    if (!requirements[key]) continue;
    const set = V3.sets[key];
    sets.push(requirements.ambiguous ? set : Array.from(set).filter((c) => !V3.ambiguous.includes(c)).join(''));
  }
  return sets;
}

/** The password the requirements carve out of the entropy. */
export async function shapePassword(entropy: Bytes, requirements: Requirements): Promise<string> {
  const key = await hmacKey(entropy);
  const prefix = encoder.encode(V3.stream);
  let block: Bytes = new Uint8Array(0);
  let offset = 0;
  let counter = 0;
  const word = async (): Promise<number> => {
    if (offset + 4 > block.length) {
      block = await hmac(key, concat(prefix, u32(counter)));
      counter += 1;
      offset = 0;
    }
    const value = new DataView(block.buffer, block.byteOffset + offset, 4).getUint32(0);
    offset += 4;
    return value;
  };
  const draw = async (bound: number): Promise<number> => {
    const limit = 2 ** 32 - (2 ** 32 % bound);
    for (;;) {
      const value = await word();
      if (value < limit) return value % bound;
    }
  };

  const sets = alphabets(requirements);
  const all = sets.join('');
  const length = requirements.length;
  const chars: string[] = [];
  for (const set of sets) chars.push(set[await draw(set.length)] ?? '');
  while (chars.length < length) chars.push(all[await draw(all.length)] ?? '');
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = await draw(i + 1);
    [chars[i], chars[j]] = [chars[j] ?? '', chars[i] ?? ''];
  }
  return chars.join('');
}

export async function derivePassword(master: string, spec: DerivedSpec, user: string): Promise<Derived> {
  const problem = specProblem(spec);
  if (problem) throw new DerivedError(problem);
  const entropy = await deriveEntropy(master, spec.site, user, spec.version);
  try {
    return { password: await shapePassword(entropy, spec), check: await keyCheck(entropy) };
  } finally {
    entropy.fill(0);
  }
}

/* ------------------------------------------------------------------ *
 * The session: the master password of the open database
 * ------------------------------------------------------------------ */

let master: ProtectedValue | null = null;
/**
 * Until the database locks or its password changes: the entropy of each site,
 * user name and version — so new requirements need no Argon2 run — and the
 * passwords already shaped from it.
 */
const entropies = new Map<string, ProtectedValue>();
const passwords = new Map<string, { password: ProtectedValue; check: string }>();

/** Called on unlock, on a password change and (with null) on lock. */
export function setMasterPassword(password: string | null): void {
  master = password ? ProtectedValue.fromString(password) : null;
  entropies.clear();
  passwords.clear();
}

export function hasMasterPassword(): boolean {
  return master !== null;
}

function entropyKey(spec: DerivedSpec, user: string): string {
  return JSON.stringify([normalizeSite(spec.site), normalizeUser(user), spec.version]);
}

function passwordKey(spec: DerivedSpec, user: string): string {
  return JSON.stringify([entropyKey(spec, user), spec.length, spec.upper, spec.lower, spec.digits, spec.symbols, spec.ambiguous]);
}

/** A password computed before, without waiting. */
export function cachedPassword(spec: DerivedSpec, user: string): Derived | undefined {
  const hit = passwords.get(passwordKey(spec, user));
  return hit && { password: hit.password.getText(), check: hit.check };
}

export async function computePassword(spec: DerivedSpec, user: string): Promise<Derived> {
  const hit = cachedPassword(spec, user);
  if (hit) return hit;
  const problem = specProblem(spec);
  if (problem) throw new DerivedError(problem);
  if (!master) throw new DerivedError(t('derived', 'The database has no master password to derive passwords from'));
  const own = master;
  let entropy = entropies.get(entropyKey(spec, user))?.getBinary() as Bytes | undefined;
  if (!entropy) {
    entropy = await deriveEntropy(own.getText(), spec.site, user, spec.version);
    // The database may have been locked or re-keyed while Argon2 ran.
    if (master === own) entropies.set(entropyKey(spec, user), ProtectedValue.fromBinary(entropy.slice().buffer));
  }
  try {
    const result = { password: await shapePassword(entropy, spec), check: await keyCheck(entropy) };
    if (master === own) passwords.set(passwordKey(spec, user), { password: ProtectedValue.fromString(result.password), check: result.check });
    return result;
  } finally {
    entropy.fill(0);
  }
}

/** The settings of the entry's password, null for a stored password. Throws when they are unusable. */
export function derivedSpec(entry: Entry): DerivedSpec | null {
  return parseDerived(field(entry, 'Password'), field(entry, 'URL'));
}

/**
 * What the entry's password is: at once when it is stored or was computed
 * before, a promise while Argon2 still has to run.
 */
export function entryPassword(entry: Entry): string | Promise<string> {
  let spec: DerivedSpec | null;
  try {
    spec = derivedSpec(entry);
  } catch (error) {
    return Promise.reject(error);
  }
  if (!spec) return field(entry, 'Password');
  const user = field(entry, 'UserName');
  return cachedPassword(spec, user)?.password ?? computePassword(spec, user).then((result) => result.password);
}
