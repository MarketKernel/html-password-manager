/**
 * Legacy password algorithms: two older Windows programs whose passwords are
 * still in use. They are calculators — secret phrases in, a password out —
 * and nothing they are given is written anywhere: the result is kept as an
 * ordinary password, and the phrases, when asked, only in memory until the
 * database locks. Both are frozen; the tests check them against the .NET
 * originals.
 *
 * Legacy 1 (WindowsFormsApplication21):
 *
 *   short(bytes)  = Base64(bytes) without "=", "/", "+", first 10 characters
 *   primary key   = short(SHA-1¹⁰⁰⁰⁰⁰⁰(UTF-8(master key ‖ identifier)))
 *   result        = short(SHA-1(UTF-8(primary key ‖ secondary key)))
 *
 * The primary key is bound to the identifier and was kept on paper, so the
 * master key need not be typed anywhere; the secondary key keeps a stolen
 * note useless on its own.
 *
 * Legacy 2 (Password.Generator 1.0):
 *
 *   digest(a, b, version, n) = SHA-1ⁿ(UTF-8(a) ‖ UTF-8(b) ‖ (version > 0 ? u32le(version) : ""))
 *   key      = select(digest(identifier, primary phrase, 1, 100 000), key length + 2)
 *   password = select(digest(key, secondary phrase, version, 1), password length + 2)
 *
 * select reads the 20-byte digest as five little-endian u32, sets the top bit
 * of each, writes it in base N of the chosen alphabet (symbols, digits, A–Z,
 * a–z, in that order) least significant digit first, keeps 5 characters of
 * each and cuts the 25 to the length. The first two characters are a
 * signature to compare by eye, the rest is the key or the password. The
 * version of the key is always 1: the program has no field for it.
 */

import { ProtectedValue } from './kdbx';

export const LEGACY1_ROUNDS = 1_000_000;
export const LEGACY2_ROUNDS = 100_000;
export const LEGACY2_KEY_VERSION = 1;
export const LEGACY2_SIGN = 2;
export const LEGACY2_LENGTH_MIN = 1;
export const LEGACY2_LENGTH_MAX = 18;
export const LEGACY2_VERSION_MAX = 0xffffffff;

/** Digits are always part of a Legacy 2 alphabet; the other sets are optional. */
export interface Legacy2Sets {
  symbols: boolean;
  upper: boolean;
  lower: boolean;
}

export const LEGACY2_DEFAULTS = { length: 10, symbols: false, upper: true, lower: true } as const;

/** A Legacy 2 key or password: the signature and the value itself. */
export interface Signed {
  sign: string;
  value: string;
}

const ALPHABETS = {
  symbols: "!#$%&'()+,-.",
  digits: '0123456789',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
} as const;

const encoder = new TextEncoder();

/* ------------------------------------------------------------------ *
 * SHA-1 in 32-bit words: a million rounds would take minutes through
 * crypto.subtle, one await each, and well under a second here.
 * ------------------------------------------------------------------ */

const H0 = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0] as const;

/** One compression of the block in m[0..15] into h; m is scratch space of 80 words. */
function compress(h: Int32Array, m: Int32Array): void {
  for (let t = 16; t < 80; t += 1) {
    const x = (m[t - 3] ?? 0) ^ (m[t - 8] ?? 0) ^ (m[t - 14] ?? 0) ^ (m[t - 16] ?? 0);
    m[t] = (x << 1) | (x >>> 31);
  }
  let a = h[0] ?? 0;
  let b = h[1] ?? 0;
  let c = h[2] ?? 0;
  let d = h[3] ?? 0;
  let e = h[4] ?? 0;
  for (let t = 0; t < 80; t += 1) {
    let f: number;
    let k: number;
    if (t < 20) {
      f = (b & c) | (~b & d);
      k = 0x5a827999;
    } else if (t < 40) {
      f = b ^ c ^ d;
      k = 0x6ed9eba1;
    } else if (t < 60) {
      f = (b & c) | (b & d) | (c & d);
      k = 0x8f1bbcdc;
    } else {
      f = b ^ c ^ d;
      k = 0xca62c1d6;
    }
    const next = (((a << 5) | (a >>> 27)) + f + e + k + (m[t] ?? 0)) | 0;
    e = d;
    d = c;
    c = (b << 30) | (b >>> 2);
    b = a;
    a = next;
  }
  h[0] = ((h[0] ?? 0) + a) | 0;
  h[1] = ((h[1] ?? 0) + b) | 0;
  h[2] = ((h[2] ?? 0) + c) | 0;
  h[3] = ((h[3] ?? 0) + d) | 0;
  h[4] = ((h[4] ?? 0) + e) | 0;
}

/** SHA-1 of any bytes, as five big-endian words. */
function sha1(bytes: Uint8Array): Int32Array {
  const length = bytes.length;
  const blocks = ((length + 8) >> 6) + 1;
  const words = new Int32Array(blocks * 16);
  for (let i = 0; i < length; i += 1) words[i >> 2] = (words[i >> 2] ?? 0) | ((bytes[i] ?? 0) << (24 - (i & 3) * 8));
  words[length >> 2] = (words[length >> 2] ?? 0) | (0x80 << (24 - (length & 3) * 8));
  words[blocks * 16 - 1] = length * 8;
  words[blocks * 16 - 2] = Math.floor(length / 0x20000000);
  const h = Int32Array.from(H0);
  const m = new Int32Array(80);
  for (let block = 0; block < blocks; block += 1) {
    m.set(words.subarray(block * 16, block * 16 + 16));
    compress(h, m);
  }
  return h;
}

/** Hashes a digest again `rounds` times, in place: a 20-byte message is always one padded block. */
function rehash(h: Int32Array, rounds: number): void {
  const m = new Int32Array(80);
  const s = new Int32Array(5);
  for (let i = 0; i < rounds; i += 1) {
    m.fill(0);
    m.set(h);
    m[5] = 0x80000000 | 0;
    m[15] = 160;
    s.set(H0);
    compress(s, m);
    h.set(s);
  }
}

/**
 * SHA-1 of the message, then `rounds − 1` more times over its own digest, a
 * slice at a time so the page stays responsive. Null when aborted.
 */
async function repeatedSha1(message: Uint8Array, rounds: number, progress?: (share: number) => void, signal?: AbortSignal): Promise<Int32Array | null> {
  const h = sha1(message);
  let done = 1;
  while (done < rounds) {
    if (signal?.aborted) return null;
    const until = performance.now() + 12;
    while (done < rounds && performance.now() < until) {
      const step = Math.min(1000, rounds - done);
      rehash(h, step);
      done += step;
    }
    progress?.(done / rounds);
    if (done < rounds) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return signal?.aborted ? null : h;
}

function digestBytes(h: Int32Array): Uint8Array {
  const out = new Uint8Array(20);
  const view = new DataView(out.buffer);
  h.forEach((word, i) => view.setInt32(i * 4, word));
  return out;
}

/* ------------------------------------------------------------------ *
 * Legacy 1
 * ------------------------------------------------------------------ */

function short(h: Int32Array): string {
  return btoa(String.fromCharCode(...digestBytes(h)))
    .replace(/[=/+]/g, '')
    .substring(0, 10);
}

/** The primary key of a master key and an identifier: a million rounds, null when aborted. */
export async function legacy1PrimaryKey(masterKey: string, identifier: string, progress?: (share: number) => void, signal?: AbortSignal): Promise<string | null> {
  const h = await repeatedSha1(encoder.encode(masterKey + identifier), LEGACY1_ROUNDS, progress, signal);
  return h && short(h);
}

export function legacy1Password(primaryKey: string, secondaryKey: string): string {
  return short(sha1(encoder.encode(primaryKey + secondaryKey)));
}

/* ------------------------------------------------------------------ *
 * Legacy 2
 * ------------------------------------------------------------------ */

function legacy2Message(first: string, second: string, version: number): Uint8Array {
  const a = encoder.encode(first);
  const b = encoder.encode(second);
  const out = new Uint8Array(a.length + b.length + (version > 0 ? 4 : 0));
  out.set(a);
  out.set(b, a.length);
  if (version > 0) new DataView(out.buffer).setUint32(a.length + b.length, version, true);
  return out;
}

function legacy2Alphabet(sets: Legacy2Sets): string {
  return (sets.symbols ? ALPHABETS.symbols : '') + ALPHABETS.digits + (sets.upper ? ALPHABETS.upper : '') + (sets.lower ? ALPHABETS.lower : '');
}

function select(h: Int32Array, length: number, sets: Legacy2Sets): Signed {
  const alphabet = legacy2Alphabet(sets);
  const view = new DataView(digestBytes(h).buffer);
  let text = '';
  for (let part = 0; part < 5; part += 1) {
    let number = (view.getUint32(part * 4, true) | 0x80000000) >>> 0;
    let digits = '';
    do {
      digits += alphabet[number % alphabet.length] ?? '';
      number = Math.floor(number / alphabet.length);
    } while (number !== 0);
    text += digits.substring(0, 5);
  }
  const clamped = Math.min(LEGACY2_LENGTH_MAX, Math.max(LEGACY2_LENGTH_MIN, Math.round(length)));
  return { sign: text.substring(0, LEGACY2_SIGN), value: text.substring(LEGACY2_SIGN, LEGACY2_SIGN + clamped) };
}

/** The key of an identifier and the primary phrase: a hundred thousand rounds, null when aborted. */
export async function legacy2Key(identifier: string, phrase: string, length: number, sets: Legacy2Sets, progress?: (share: number) => void, signal?: AbortSignal): Promise<Signed | null> {
  const h = await repeatedSha1(legacy2Message(identifier, phrase, LEGACY2_KEY_VERSION), LEGACY2_ROUNDS, progress, signal);
  return h && select(h, length, sets);
}

export function legacy2Password(key: string, phrase: string, version: number, length: number, sets: Legacy2Sets): Signed {
  return select(sha1(legacy2Message(key, phrase, version)), length, sets);
}

/* ------------------------------------------------------------------ *
 * From an entry: the identifier, and the phrases kept for the session
 * ------------------------------------------------------------------ */

/**
 * The identifier an entry suggests: a user name that already names its site,
 * such as mail@site.com, as it is; otherwise the user name, "@" and the site
 * (already without "www."). Either alone when the other is missing.
 */
export function legacyIdentifier(user: string, site: string): string {
  const name = user.trim();
  if (name.includes('@') || !site) return name;
  return name ? `${name}@${site}` : site;
}

/** The phrases that can be kept: legacy 1's master key and secondary key, legacy 2's two secret phrases. */
export type LegacySecret = 'legacy1-master' | 'legacy1-secondary' | 'legacy2-primary' | 'legacy2-secondary';

/** Only in this page's memory, XOR-masked, until the database locks: never written anywhere. */
const secrets = new Map<LegacySecret, ProtectedValue>();

/** Keeps one phrase for later generations, or with null forgets it. */
export function rememberLegacySecret(name: LegacySecret, value: string | null): void {
  if (value === null) secrets.delete(name);
  else secrets.set(name, ProtectedValue.fromString(value));
}

export function rememberedLegacySecret(name: LegacySecret): string | null {
  return secrets.get(name)?.getText() ?? null;
}

/** Called on lock, and when the legacy algorithms are turned off. */
export function forgetLegacySecrets(): void {
  secrets.clear();
}
