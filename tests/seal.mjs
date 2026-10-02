/**
 * The master password sealed for "remember on this device" (src/core/seal.ts): it comes back
 * as typed, only with the same key and under the same database's name, a changed byte
 * anywhere fails, and neither kind of key can be exported. The fixed vector holds format 1:
 * a remembered database must still open after an update.
 */
import { checker, load } from '../tools/load.mjs';

const S = await load('core/seal');
const { check, done } = checker();

const NAME = 'Database.kdbx';
const prf = (byte) => new Uint8Array(32).fill(byte);
const failure = (promise) => promise.then(
  () => 'opened',
  (error) => error.name,
);
const flip = (bytes, at) => {
  const copy = new Uint8Array(bytes);
  copy[at] ^= 1;
  return copy;
};

// Format 1, made with WebCrypto alone: HKDF info, the additional data and AES-GCM as documented.
const VECTOR = {
  iv: new Uint8Array(12).fill(2),
  data: Uint8Array.from(Buffer.from('d473d4bbec11062f89a988b65ff722d1bdf4cf56ff032fe3f63efdd7365aee1cb0266576da06a9b6783cdb77b2', 'hex')),
};
check('format 1: the fixed vector opens', await S.unseal(await S.keyFromPrf(prf(1)), VECTOR, NAME), 'Тестовый пароль');
check('format 1: its version', S.SEAL_VERSION, 1);

// Back as typed
const key = await S.keyFromPrf(prf(7));
const passwords = ['Тестовый пароль', 'pässwörd 🔑 密码', '', '  spaces around  ', 'x'.repeat(4096), 'é not NFC'];
const opened = [];
for (const password of passwords) opened.push(await S.unseal(key, await S.seal(key, password, NAME), NAME));
check('round trip: Cyrillic, emoji, empty, spaces, long, unnormalized', opened, passwords);

const sealed = await S.seal(key, 'Тестовый пароль', NAME);
const again = await S.seal(key, 'Тестовый пароль', NAME);
check('a new IV for every seal', [sealed.iv.length, Buffer.from(sealed.iv).equals(Buffer.from(again.iv)), Buffer.from(sealed.data).equals(Buffer.from(again.data))], [12, false, false]);
check('the password is not in the sealed bytes', Buffer.from(sealed.data).includes(Buffer.from('Тестовый пароль')), false);

// Only with the same key, under the same name
check('the same PRF output: a key made again opens it', await S.unseal(await S.keyFromPrf(prf(7)), sealed, NAME), 'Тестовый пароль');
check('another PRF output: fails', await failure(S.unseal(await S.keyFromPrf(prf(8)), sealed, NAME)), 'OperationError');
check('another database: fails', await failure(S.unseal(key, sealed, 'Other.kdbx')), 'OperationError');
check('a name differing in case: fails', await failure(S.unseal(key, sealed, 'database.kdbx')), 'OperationError');
check('a changed byte of the data: fails', await failure(S.unseal(key, { ...sealed, data: flip(sealed.data, 0) }, NAME)), 'OperationError');
check('a changed byte of the tag: fails', await failure(S.unseal(key, { ...sealed, data: flip(sealed.data, sealed.data.length - 1) }, NAME)), 'OperationError');
check('a changed byte of the IV: fails', await failure(S.unseal(key, { ...sealed, iv: flip(sealed.iv, 11) }, NAME)), 'OperationError');

// The device's own key
const device = await S.deviceKey();
check('device key: round trip', await S.unseal(device, await S.seal(device, 'Тестовый пароль', NAME), NAME), 'Тестовый пароль');
check('device key: another one fails', await failure(S.unseal(await S.deviceKey(), await S.seal(device, 'x', NAME), NAME)), 'OperationError');

// Neither key leaves WebCrypto
// Node names the refusal InvalidAccessException, browsers InvalidAccessError: what counts is that it is refused.
const refused = async (promise) => (await failure(promise)) !== 'opened';
check('keys cannot be exported', [key.extractable, device.extractable, await refused(crypto.subtle.exportKey('raw', key)), await refused(crypto.subtle.exportKey('raw', device))], [false, false, true, true]);
check('keys only seal and open', [key.usages.sort(), device.usages.sort(), key.algorithm], [['decrypt', 'encrypt'], ['decrypt', 'encrypt'], { name: 'AES-GCM', length: 256 }]);

done('seal');
