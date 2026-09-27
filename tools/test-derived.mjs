/**
 * Derived passwords. The fixed vectors freeze generator 3: if one of them
 * changes, every password ever made with it can no longer be computed again.
 * The reference below is written from the specification in src/derived.ts
 * with Node's own crypto, so a password can be recovered from that text alone.
 */
import { createHash, createHmac } from 'node:crypto';
import { argon2id } from 'hash-wasm';
import { checker, load } from './load.mjs';

const D = await load('derived');
const { check, done } = checker();

const MASTER = 'Тестовый пароль';
const USER = 'me@example.com';
const base = { ...D.REQUIREMENT_DEFAULTS, site: 'github.com', version: 1 };

// Generator 3, frozen
const vectors = [
  [{}, 'A6qVXXF]7<%a)aa<x7*U'],
  [{ length: 12, symbols: false }, 'yaM6VJaJFYUQ'],
  [{ version: 2 }, '3q_bwppbE8P2+ufKr:P6'],
];
for (const [change, password] of vectors) {
  check(`vector ${JSON.stringify(change)}`, await D.derivePassword(MASTER, { ...base, ...change }, USER), password);
}

// An independent implementation of the specification
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
const withLength = (text) => {
  const bytes = Buffer.from(text, 'utf8');
  return Buffer.concat([u32(bytes.length), bytes]);
};
async function reference(master, site, user, version, req) {
  const salt = createHash('sha256')
    .update(Buffer.concat([Buffer.from('html-password-manager/derived/v3'), Buffer.from([0]), withLength(site.trim().normalize('NFC').toLowerCase()), withLength(user.trim().normalize('NFC')), u32(version)]))
    .digest();
  const entropy = await argon2id({ password: master.normalize('NFC'), salt, memorySize: 65536, iterations: 3, parallelism: 1, hashLength: 32, outputType: 'binary' });
  const words = [];
  for (let i = 0; words.length < 1024; i += 1) {
    const block = createHmac('sha256', entropy).update(Buffer.concat([Buffer.from('hpm-v3-stream'), u32(i)])).digest();
    for (let j = 0; j < 32; j += 4) words.push(block.readUInt32BE(j));
  }
  const draw = (bound) => {
    for (;;) {
      const value = words.shift();
      if (value < 2 ** 32 - (2 ** 32 % bound)) return value % bound;
    }
  };
  const all = { upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower: 'abcdefghijklmnopqrstuvwxyz', digits: '0123456789', symbols: '!#$%&*+-=?@^_~.,:;()[]{}<>/|' };
  const sets = ['upper', 'lower', 'digits', 'symbols'].filter((k) => req[k]).map((k) => [...all[k]].filter((c) => req.ambiguous || !'O0oIl1|'.includes(c)).join(''));
  const pool = sets.join('');
  const chars = sets.map((set) => set[draw(set.length)]);
  while (chars.length < req.length) chars.push(pool[draw(pool.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = draw(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
const cases = [
  [MASTER, ' GitHub.COM ', ` ${USER}`, 1, D.REQUIREMENT_DEFAULTS],
  ['correct horse', 'bank.example', 'Иван', 4294967295, { length: 64, upper: false, lower: true, digits: true, symbols: false, ambiguous: true }],
  ['p', 'x', '', 7, { length: 4, upper: true, lower: true, digits: true, symbols: true, ambiguous: false }],
  // é typed as e + a combining accent is the same password as a single é.
  ['cafe\u0301', 'caf\u00e9.fr', 'user', 3, { length: 128, upper: true, lower: false, digits: false, symbols: true, ambiguous: false }],
];
for (const [master, site, user, version, req] of cases) {
  check(`reference ${site}/${version}`, await D.derivePassword(master, { ...req, site, version }, user), await reference(master, site, user, version, req));
}
check('NFC master', await D.derivePassword('cafe\u0301', base, USER), await D.derivePassword('caf\u00e9', base, USER));

// The requirements shape the same entropy
const long = await D.derivePassword(MASTER, { ...base, length: 40 }, USER);
check('length only', [...long].length, 40);
check('digits only', /^[0-9]{10}$/.test(await D.derivePassword(MASTER, { ...base, length: 10, upper: false, lower: false, symbols: false }, USER)), true);
check('every set', [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].map((re) => re.test(long)), [true, true, true, true]);
check('no look-alikes', /[O0oIl1|]/.test(await D.derivePassword(MASTER, { ...base, length: 128 }, USER)), false);
check('other user', (await D.derivePassword(MASTER, base, 'you@example.com')) !== vectors[0][1], true);
check('other site', (await D.derivePassword(MASTER, { ...base, site: 'gitlab.com' }, USER)) !== vectors[0][1], true);
check('other master', (await D.derivePassword('другой', base, USER)) !== vectors[0][1], true);

// What is asked for
check('version range', [0, 1, 4294967295, 4294967296, 1.5].map((version) => D.specProblem({ ...base, version }) === null), [false, true, true, false, false]);
check('site required', D.specProblem({ ...base, site: '  ' }) !== null, true);
check('a set required', D.specProblem({ ...base, upper: false, lower: false, digits: false, symbols: false }) !== null, true);
check(
  'site of the website',
  ['https://www.GitHub.com/login', 'github.com/x', 'http://user:pw@Example.COM:8443/a?b', 'localhost:8080', 'login.example.com', 'https://пример.рф/', ' My Bank ', ''].map(D.siteOf),
  ['github.com', 'github.com', 'example.com', 'localhost', 'login.example.com', 'xn--e1afmkfd.xn--p1ai', 'my bank', ''],
);
check(
  'the domain of an e-mail user name',
  ['test@site.com', ' Test@Mail.Site.COM ', 'test@www.site.com', 'test', 'test@localhost', 'a@b@site.com', ''].map(D.mailDomain),
  ['site.com', 'mail.site.com', 'site.com', null, null, null, null],
);
check('bits capped', D.derivedBits({ ...base, length: 128 }), 256);

// The session: the database's own master password, and what locking forgets
const failed = (promise) => promise.then(() => false, (error) => error instanceof D.DerivedError);
D.setMasterPassword(null);
check('locked: nothing to derive from', await failed(D.computePassword(base, USER)), true);
D.setMasterPassword(MASTER);
check('the session\'s master password', await D.computePassword(base, USER), vectors[0][1]);
check('reshaped from the entropy kept', await D.computePassword({ ...base, length: 12, symbols: false }, USER), vectors[1][1]);
check('no site, no password', await failed(D.computePassword({ ...base, site: '' }, USER)), true);
check('the master password to legacy 1 and 2', D.sessionMasterPassword(), MASTER);
D.setMasterPassword(null);
check('forgotten on lock', D.sessionMasterPassword(), null);

done('derived');
