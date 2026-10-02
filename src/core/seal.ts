/**
 * The master password sealed for "remember on this device": AES-GCM under a key that never
 * lies beside it in the clear — one derived from a passkey's PRF output, which only the
 * passkey's keeper gives back, or the browser's own non-extractable key for a device that
 * asks nothing. Every remembered database is read back with this, so format 1 does not
 * change:
 *
 *   key  = HKDF-SHA-256(PRF output, salt = empty, info = "hpm/remember/v1") as AES-GCM-256,
 *          or a random AES-GCM-256 key; neither can be exported
 *   iv   = 12 random bytes, new for every seal
 *   aad  = "hpm/remember/v1" 0x00 ‖ UTF-8(the database's file name)
 *   data = AES-GCM(key, iv, aad, UTF-8(the password exactly as typed))
 *
 * The file name in the additional data keeps one database's record from opening as
 * another's. The password is not normalized: it has to open the .kdbx as it did.
 */

export const SEAL_VERSION = 1;

const INFO = 'hpm/remember/v1';
const encoder = new TextEncoder();

export interface Sealed {
  iv: Uint8Array<ArrayBuffer>;
  data: Uint8Array<ArrayBuffer>;
}

/** The key of a passkey's PRF output. */
export async function keyFromPrf(prf: BufferSource): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode(INFO) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** A key of the browser's own, kept in the record itself: for a device that asks nothing. */
export function deviceKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function additionalData(name: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`${INFO}\0${name}`);
}

export async function seal(key: CryptoKey, password: string, name: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = encoder.encode(password);
  try {
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: additionalData(name) }, key, plain));
    return { iv, data };
  } finally {
    plain.fill(0);
  }
}

/** Throws when the key, the name or a single byte is not the one sealed with. */
export async function unseal(key: CryptoKey, sealed: Sealed, name: string): Promise<string> {
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: additionalData(name) }, key, sealed.data));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(plain);
  } finally {
    plain.fill(0);
  }
}
