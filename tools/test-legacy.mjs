/**
 * Legacy password algorithms. The fixed vectors come from the original .NET
 * programs (the decompiled WindowsFormsApplication21 and the sources of
 * Password.Generator 1.0), run under .NET 10; a second, independent
 * implementation with Node's crypto follows the specification in
 * src/legacy.ts.
 */
import { createHash } from 'node:crypto';
import { checker, load } from './load.mjs';

const L = await load('legacy');
const { check, done } = checker();

const ALL = { symbols: true, upper: true, lower: true };
const LETTERS = { symbols: false, upper: true, lower: true };

// Legacy 1, from .NET
for (const [master, id, key, second, empty] of [
  ['master', 'github.com', 'Lj0oFPZfaB', 'wXoWNyEWSG', '1Xph0l8Tnr'],
  ['Мастер-ключ', 'почта', 'ILS9gHiYX7', 'J4Jf9FmDer', 'hvPcdHLQAa'],
  ['', '', 'MEl06WIJhN', 'sy69GrFm0U', 'hmcnRUCmP7'],
]) {
  check(`legacy 1 key ${master}/${id}`, await L.legacy1PrimaryKey(master, id), key);
  check(`legacy 1 password ${key}+second`, L.legacy1Password(key, 'second'), second);
  check(`legacy 1 password ${key}+nothing`, L.legacy1Password(key, ''), empty);
}
check('legacy 1 password, Cyrillic secondary key', L.legacy1Password('8pgYm9fZha', 'вторичный'), 'ymNTa9QXWr');

// Legacy 2, from .NET — the key always with version 1, as the program computes it
const signed = (text) => ({ sign: text.slice(0, 2), value: text.slice(3) });
check('legacy 2 key 1/1', await L.legacy2Key('1', '1', 10, LETTERS), signed('E8 8pgYm9fZha'));
check('legacy 2 key, Cyrillic, 18, every set', await L.legacy2Key('gmail.com', 'секрет', 18, ALL), signed('d3 n$lkXn8XMtbxeG6HH-'));
check('legacy 2 key, 1, digits only', await L.legacy2Key('x', 'y', 1, { symbols: false, upper: false, lower: false }), signed('69 1'));
for (const [key, phrase, version, length, sets, expected] of [
  ['8pgYm9fZha', '1', 0, 10, LETTERS, 'MN aEXTmKcRlO'],
  ['8pgYm9fZha', '1', 1, 10, LETTERS, '6v NBXIxCAjv5'],
  ['Qwerty12345', 'second', 7, 18, { symbols: true, upper: false, lower: false }, '0& 98#.--.,++.1%)!83+'],
  [`long ${'z'.repeat(120)}`, 'ё', 65536, 12, { symbols: false, upper: true, lower: false }, '7C 286UAXEQKEPN'],
  ['k', 's', 0xffffffff, 18, { symbols: true, upper: false, lower: true }, '&h csyeu..!1mq54.bgq0'],
]) {
  check(`legacy 2 password ${key.slice(0, 12)}/${phrase} v${version}`, L.legacy2Password(key, phrase, version, length, sets), signed(expected));
}

// Progress and cancelling
const shares = [];
await L.legacy2Key('1', '1', 10, LETTERS, (share) => shares.push(share));
check('progress ends at 1', shares.at(-1), 1);
check('progress only grows', shares.every((share, i) => i === 0 || share >= shares[i - 1]), true);
const aborted = new AbortController();
aborted.abort();
check('aborted: no key', await L.legacy1PrimaryKey('master', 'github.com', undefined, aborted.signal), null);

// The identifier an entry suggests
check('identifier: an e-mail as it is', L.legacyIdentifier('mail@site.com', 'github.com'), 'mail@site.com');
check('identifier: user name @ site', L.legacyIdentifier(' dmytro ', 'github.com'), 'dmytro@github.com');
check('identifier: no user name', L.legacyIdentifier('', 'github.com'), 'github.com');
check('identifier: no site', L.legacyIdentifier('dmytro', ''), 'dmytro');

// Phrases kept in memory until the database locks, each on its own
check('memory: nothing kept', L.rememberedLegacySecret('legacy1-master'), null);
L.rememberLegacySecret('legacy1-master', 'Мастер-ключ');
L.rememberLegacySecret('legacy2-secondary', '');
check('memory: kept', [L.rememberedLegacySecret('legacy1-master'), L.rememberedLegacySecret('legacy1-secondary'), L.rememberedLegacySecret('legacy2-secondary')], ['Мастер-ключ', null, '']);
L.rememberLegacySecret('legacy2-secondary', null);
check('memory: forgotten one', [L.rememberedLegacySecret('legacy2-secondary'), L.rememberedLegacySecret('legacy1-master')], [null, 'Мастер-ключ']);
L.forgetLegacySecrets();
check('memory: forgotten on lock', L.rememberedLegacySecret('legacy1-master'), null);

// An independent implementation of the specification
const sha1 = (bytes) => createHash('sha1').update(bytes).digest();
const short = (bytes) => bytes.toString('base64').replace(/[=/+]/g, '').slice(0, 10);
const rounds = (bytes, n) => {
  let out = sha1(bytes);
  for (let i = 1; i < n; i += 1) out = sha1(out);
  return out;
};
const message = (a, b, version) => {
  const tail = Buffer.alloc(version > 0 ? 4 : 0);
  if (version > 0) tail.writeUInt32LE(version);
  return Buffer.concat([Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'), tail]);
};
const select = (digest, length, sets) => {
  const alphabet = (sets.symbols ? "!#$%&'()+,-." : '') + '0123456789' + (sets.upper ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : '') + (sets.lower ? 'abcdefghijklmnopqrstuvwxyz' : '');
  let text = '';
  for (let i = 0; i < 5; i += 1) {
    let n = BigInt(digest.readUInt32LE(i * 4)) | 0x80000000n;
    let digits = '';
    do {
      digits += alphabet[Number(n % BigInt(alphabet.length))];
      n /= BigInt(alphabet.length);
    } while (n > 0n);
    text += digits.slice(0, 5);
  }
  return { sign: text.slice(0, 2), value: text.slice(2, 2 + length) };
};
const key = short(rounds(Buffer.from('ключ' + 'id'), 1_000_000));
check('legacy 1 matches the specification', await L.legacy1PrimaryKey('ключ', 'id'), key);
check('legacy 1 password matches the specification', L.legacy1Password(key, 'два'), short(sha1(Buffer.from(key + 'два'))));
for (const [id, phrase, length, sets] of [['site', 'фраза', 18, ALL], ['a', '', 7, LETTERS]]) {
  const spec = select(rounds(message(id, phrase, 1), 100_000), length, sets);
  check(`legacy 2 key matches the specification ${id}`, await L.legacy2Key(id, phrase, length, sets), spec);
  check(`legacy 2 password matches the specification ${id}`, L.legacy2Password(spec.value, phrase, 3, length, sets), select(sha1(message(spec.value, phrase, 3)), length, sets));
}

done('legacy');
