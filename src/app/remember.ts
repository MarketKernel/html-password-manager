/**
 * "Remember on this device": the master password of one database, sealed by
 * src/core/seal.ts and kept in IndexedDB, so that the next unlock is a click — and, but for
 * the "device" way, the system's prompt. Never on file:, where every HTML file on the disk
 * shares one origin in Chrome and any page saved there could read the records; the page
 * also never offers it for a database with a key file.
 *
 * Every way but "device" and "keychain" makes a passkey for the database and seals with what
 * its PRF extension returns for the record's random salt: only the passkey's keeper — Google
 * Password Manager, iCloud Keychain, Windows Hello, a security key — gives that back, after
 * its prompt. A record keeps the user verification it was made with, since PRF with and
 * without it are two different secrets. "device" keeps a non-extractable key in the record
 * itself, which stops a casual look at the profile's files and nothing more.
 *
 * "keychain" is for Apple Passwords on a Mac: Chrome does not offer iCloud Keychain to a
 * request that asks for PRF, so this way asks for none and keeps 32 random bytes as the
 * passkey's user handle instead. iCloud Keychain keeps it end to end encrypted with the
 * passkey and gives it to this origin's request after Touch ID; the key comes from it the
 * same way as from PRF. The handle is weaker than PRF in two ways. It is stored data, not a
 * secret computed after the user is verified: a browser the Mac allows to use passkeys can
 * list it without a prompt. And Google Password Manager syncs it in the clear — so a
 * passkey kept there or in the Chrome profile, the two other places Chrome offers, is
 * deleted again and nothing is remembered.
 *
 * There is no server: the challenge is random, no signature is checked, and the passkey is
 * only the keeper of the secret.
 */

import { t } from '../core/i18n';
import { deviceKey, keyFromPrf, seal, SEAL_VERSION, unseal, type Sealed } from '../core/seal';

export type RememberWith = 'system' | 'systemClick' | 'keychain' | 'passkey' | 'passkeyClick' | 'device';

export const REMEMBER_WITH: readonly RememberWith[] = ['system', 'systemClick', 'keychain', 'passkey', 'passkeyClick', 'device'];

type Verification = 'required' | 'discouraged';

interface DeviceRecord {
  name: string;
  with: 'device';
  key: CryptoKey;
  sealed: Sealed;
  v: number;
}

interface PasskeyRecord {
  name: string;
  with: Exclude<RememberWith, 'device' | 'keychain'>;
  credential: Uint8Array<ArrayBuffer>;
  salt: Uint8Array<ArrayBuffer>;
  verification: Verification;
  sealed: Sealed;
  v: number;
}

/** The key's secret is the passkey's user handle, not its PRF. */
interface KeychainRecord {
  name: string;
  with: 'keychain';
  credential: Uint8Array<ArrayBuffer>;
  sealed: Sealed;
  v: number;
}

type Remembered = DeviceRecord | PasskeyRecord | KeychainRecord;

/**
 * Why a remembered password cannot be had. "unsupported": the passkey keeps no PRF secret, so
 * nothing was remembered. "elsewhere": the "keychain" passkey was kept somewhere other than
 * iCloud Keychain, so nothing was remembered. "broken": the record no longer opens — the passkey is gone or the
 * record was damaged — and is best forgotten. A cancelled prompt is not this, but the
 * browser's own NotAllowedError.
 */
export class RememberError extends Error {
  constructor(readonly reason: 'unsupported' | 'elsewhere' | 'broken') {
    super(`remember: ${reason}`);
  }
}

/** What Chrome has and TypeScript's DOM library does not know yet. */
interface CredentialStatics {
  isUserVerifyingPlatformAuthenticatorAvailable(): Promise<boolean>;
  getClientCapabilities?(): Promise<Record<string, boolean>>;
  signalUnknownCredential?(options: { rpId: string; credentialId: string }): Promise<void>;
}

const IDB_NAME = 'html-password-manager-remember';
const IDB_STORE = 'remembered';
const RP_NAME = 'Deterministic Password';

/** The AAGUIDs of the keepers the "keychain" way turns away: Google Password Manager and the Chrome profile. */
const NOT_KEYCHAIN = new Set(['ea9b8d664d011d213ce4b6b48cb575d4', 'adce000235bcc60a648b0b25f1f05503']);

const random = (length: number): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(length));

function allowedHere(): boolean {
  return typeof location !== 'undefined' && location.protocol !== 'file:' && typeof indexedDB !== 'undefined';
}

function statics(): CredentialStatics | null {
  return typeof PublicKeyCredential === 'undefined' || !navigator.credentials ? null : (PublicKeyCredential as unknown as CredentialStatics);
}

/** The ways this browser has here, in the settings' order; none on file:. */
export async function rememberWays(): Promise<RememberWith[]> {
  if (!allowedHere()) return [];
  const ways: RememberWith[] = [];
  const credential = statics();
  if (credential && isSecureContext) {
    const capabilities = await credential.getClientCapabilities?.().catch(() => undefined);
    const prf = capabilities?.['extension:prf'] !== false;
    const platform = await credential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
    if (prf && platform) ways.push('system', 'systemClick');
    if (platform && systemOf() === 'mac') ways.push('keychain');
    if (prf) ways.push('passkey', 'passkeyClick');
  }
  ways.push('device');
  return ways;
}

/** "mac", "windows" or "other": the name of the system's prompt. */
export function systemOf(): 'mac' | 'windows' | 'other' {
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac/i.test(platform) ? 'mac' : /win/i.test(platform) ? 'windows' : 'other';
}

/** The button that opens a remembered database. */
export function unlockLabel(way: RememberWith): string {
  switch (way) {
    case 'system': {
      const system = systemOf();
      return system === 'mac' ? t('gate', 'Unlock with Touch ID') : system === 'windows' ? t('gate', 'Unlock with Windows Hello') : t('gate', 'Unlock with the screen lock');
    }
    case 'systemClick':
      return t('gate', 'Unlock with the system prompt');
    case 'keychain':
      return t('gate', 'Unlock with Touch ID');
    case 'passkey':
    case 'passkeyClick':
      return t('gate', 'Unlock with a passkey');
    case 'device':
      return t('gate', 'Unlock without the password');
  }
}

/** A prompt the user closed, or one the browser would not show: nothing went wrong to tell about. */
export function isCancelled(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError');
}

/**
 * After an unlock with the password typed, the checkbox's answer: the database is remembered
 * from now on, forgotten, or left as it was. One remembered already keeps its record — a new
 * passkey on every typed unlock would only pile up in the password manager.
 */
export async function settle(name: string, wanted: boolean, way: RememberWith, password: string): Promise<'remembered' | 'forgotten' | null> {
  const already = await remembered(name);
  if (!wanted) {
    if (!already) return null;
    await forget(name);
    return 'forgotten';
  }
  if (already) return null;
  await remember(name, way, password);
  return 'remembered';
}

/** What `settle` did, or why it could not, for a toast. */
export function settledText(outcome: 'remembered' | 'forgotten'): string {
  return outcome === 'remembered' ? t('toast', 'Remembered on this device') : t('toast', 'Forgotten on this device');
}

export function notRememberedText(error: unknown): string {
  if (isCancelled(error)) return t('toast', 'Not remembered: the prompt was closed');
  if (error instanceof RememberError && error.reason === 'unsupported') return t('toast', 'Not remembered: this passkey cannot keep the password. Choose another way in the settings.');
  if (error instanceof RememberError && error.reason === 'elsewhere') return t('toast', 'Not remembered: the passkey was not saved in iCloud Keychain.');
  return t('toast', 'Not remembered');
}

/** Why a remembered password did not open the database; it is forgotten either way. */
export function recallFailedText(wrongKey: boolean): string {
  return wrongKey
    ? t('gate', 'The remembered password no longer opens this database. Type the master password.')
    : t('gate', 'The remembered password cannot be read any more. Type the master password.');
}

/* ------------------------------------------------------------------ *
 * The records
 * ------------------------------------------------------------------ */

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

async function read(name: string): Promise<Remembered | null> {
  if (!allowedHere()) return null;
  try {
    const record = await withStore<Remembered | undefined>('readonly', (store) => store.get(name) as IDBRequest<Remembered | undefined>);
    return record && record.v === SEAL_VERSION ? record : null;
  } catch {
    return null;
  }
}

/** How the database of this file name is remembered here, or null. */
export async function remembered(name: string): Promise<RememberWith | null> {
  return (await read(name))?.with ?? null;
}

export async function rememberedCount(): Promise<number> {
  if (!allowedHere()) return 0;
  try {
    return await withStore('readonly', (store) => store.count());
  } catch {
    return 0;
  }
}

/** Seals the password the chosen way and keeps it; every way but "device" shows the prompt that makes a passkey. */
export async function remember(name: string, way: RememberWith, password: string): Promise<void> {
  if (!allowedHere()) throw new RememberError('unsupported');
  const record = way === 'device' ? await sealOnDevice(name, password) : way === 'keychain' ? await sealInKeychain(name, password) : await sealWithPasskey(name, way, password);
  await withStore('readwrite', (store) => store.put(record));
}

/** The remembered password, after the passkey's prompt where there is one; NotAllowedError when it is cancelled. */
export async function recall(name: string): Promise<string> {
  const record = await read(name);
  if (!record) throw new RememberError('broken');
  const key =
    record.with === 'device'
      ? record.key
      : record.with === 'keychain'
        ? await keyFromHandle(record.credential)
        : await keyFromPrf(await prfOf(record.credential, record.salt, record.verification));
  try {
    return await unseal(key, record.sealed, name);
  } catch {
    throw new RememberError('broken');
  }
}

async function keyFromHandle(credential: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const handle = await userHandleOf(credential);
  try {
    return await keyFromPrf(handle);
  } finally {
    handle.fill(0);
  }
}

export async function forget(name: string): Promise<void> {
  const record = await read(name);
  if (!record) return;
  try {
    await withStore('readwrite', (store) => store.delete(name));
  } catch {
    /* nothing to forget */
  }
  if (record.with !== 'device') passkeyGone(record.credential);
}

export async function forgetAll(): Promise<void> {
  if (!allowedHere()) return;
  try {
    const all = await withStore<Remembered[]>('readonly', (store) => store.getAll() as IDBRequest<Remembered[]>);
    for (const record of all) if (record.with !== 'device') passkeyGone(record.credential);
  } catch {
    /* no records to go through */
  }
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(IDB_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

/* ------------------------------------------------------------------ *
 * Sealing
 * ------------------------------------------------------------------ */

async function sealOnDevice(name: string, password: string): Promise<DeviceRecord> {
  const key = await deviceKey();
  return { name, with: 'device', key, sealed: await seal(key, password, name), v: SEAL_VERSION };
}

async function sealWithPasskey(name: string, way: PasskeyRecord['with'], password: string): Promise<PasskeyRecord> {
  if (!statics()) throw new RememberError('unsupported');
  const platform = way === 'system' || way === 'systemClick';
  const verification: Verification = way === 'system' || way === 'passkey' ? 'required' : 'discouraged';
  const salt = random(32);
  const created = (await navigator.credentials.create({
    publicKey: {
      // No id: the default is this origin's host — the PWA's domain, or the extension's id.
      rp: { name: RP_NAME },
      user: { id: random(16), name, displayName: name },
      challenge: random(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { ...(platform ? { authenticatorAttachment: 'platform' } : {}), residentKey: 'preferred', userVerification: verification },
      ...(platform ? { hints: ['client-device'] } : {}),
      extensions: { prf: { eval: { first: salt } } },
    },
  })) as PublicKeyCredential | null;
  if (!created) throw new DOMException('No passkey was made', 'NotAllowedError');
  const credential = new Uint8Array(created.rawId);
  const prf = created.getClientExtensionResults().prf;
  if (prf?.enabled === false) {
    passkeyGone(credential);
    throw new RememberError('unsupported');
  }
  // Some keepers give the PRF secret only when the passkey is used, not when it is made: then it is used once.
  const output = prf?.results?.first ?? (await prfOf(credential, salt, verification));
  const sealed = await seal(await keyFromPrf(output), password, name);
  return { name, with: way, credential, salt, verification, sealed, v: SEAL_VERSION };
}

async function sealInKeychain(name: string, password: string): Promise<KeychainRecord> {
  if (!statics()) throw new RememberError('unsupported');
  const secret = random(32);
  try {
    const created = (await navigator.credentials.create({
      publicKey: {
        rp: { name: RP_NAME },
        user: { id: secret, name, displayName: name },
        challenge: random(32),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        // Only a discoverable passkey keeps its user handle; no hints and no PRF, or Chrome leaves iCloud Keychain out.
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'preferred' },
      },
    })) as PublicKeyCredential | null;
    if (!created) throw new DOMException('No passkey was made', 'NotAllowedError');
    const credential = new Uint8Array(created.rawId);
    if (NOT_KEYCHAIN.has(aaguidOf(created))) {
      passkeyGone(credential);
      throw new RememberError('elsewhere');
    }
    const sealed = await seal(await keyFromPrf(secret), password, name);
    return { name, with: 'keychain', credential, sealed, v: SEAL_VERSION };
  } finally {
    secret.fill(0);
  }
}

/** Who keeps a new passkey, as 32 hex digits; empty when the authenticator data does not say. */
function aaguidOf(created: PublicKeyCredential): string {
  const data = new Uint8Array((created.response as AuthenticatorAttestationResponse).getAuthenticatorData());
  // rpIdHash (32) ‖ flags (1) ‖ signCount (4) ‖ AAGUID (16), present when the flags' AT bit is set.
  if (data.length < 53 || !((data[32] ?? 0) & 0x40)) return '';
  return [...data.subarray(37, 53)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function userHandleOf(credential: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  if (!statics()) throw new RememberError('broken');
  const used = (await navigator.credentials.get({
    publicKey: {
      challenge: random(32),
      allowCredentials: [{ type: 'public-key', id: credential }],
      userVerification: 'preferred',
    },
  })) as PublicKeyCredential | null;
  const handle = (used?.response as AuthenticatorAssertionResponse | undefined)?.userHandle;
  if (!handle || handle.byteLength !== 32) throw new RememberError('broken');
  return new Uint8Array(handle);
}

async function prfOf(credential: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>, verification: Verification): Promise<BufferSource> {
  if (!statics()) throw new RememberError('broken');
  const used = (await navigator.credentials.get({
    publicKey: {
      challenge: random(32),
      allowCredentials: [{ type: 'public-key', id: credential }],
      userVerification: verification,
      extensions: { prf: { eval: { first: salt } } },
    },
  })) as PublicKeyCredential | null;
  const output = used?.getClientExtensionResults().prf?.results?.first;
  if (!output) throw new RememberError('broken');
  return output;
}

/** Tells the passkey's keeper it is of no use any more, where the browser can (Chrome 132 and later); otherwise it stays there, harmless. */
function passkeyGone(credential: Uint8Array<ArrayBuffer>): void {
  const credentialId = btoa(String.fromCharCode(...credential)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // The relying party a passkey was made for: the host of a web page, the whole origin of an extension's.
  const rpId = location.protocol === 'chrome-extension:' ? location.origin : location.hostname;
  void statics()
    ?.signalUnknownCredential?.({ rpId, credentialId })
    .catch(() => undefined);
}
