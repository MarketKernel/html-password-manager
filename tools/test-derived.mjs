/**
 * Derived passwords. The fixed vectors freeze generator 3: if one of them
 * changes, every derived password in every database changes with it. The
 * reference below is written from the specification in src/derived.ts with
 * Node's own crypto, so a password can be recovered from that text alone.
 */
import { createHash, createHmac } from 'node:crypto';
import { argon2id } from 'hash-wasm';
import { checker, load } from './load.mjs';

const D = await load('derived', 'kdbx');
const { check, done } = checker();

const MASTER = 'Тестовый пароль';
const USER = 'me@example.com';
const base = { ...D.REQUIREMENT_DEFAULTS, site: 'github.com', version: 1 };

// Generator 3, frozen
const vectors = [
  [{}, 'A6qVXXF]7<%a)aa<x7*U', 'c0014f12'],
  [{ length: 12, symbols: false }, 'yaM6VJaJFYUQ', 'c0014f12'],
  [{ version: 2 }, '3q_bwppbE8P2+ufKr:P6', '3a47bd70'],
];
for (const [change, password, keyCheck] of vectors) {
  check(`vector ${JSON.stringify(change)}`, await D.derivePassword(MASTER, { ...base, ...change }, USER), { password, check: keyCheck });
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
  const keyCheck = createHmac('sha256', entropy).update('hpm-v3-check').digest().subarray(0, 4).toString('hex');
  return { password: chars.join(''), check: keyCheck };
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
check('NFC master', (await D.derivePassword('cafe\u0301', base, USER)).password, (await D.derivePassword('caf\u00e9', base, USER)).password);

// The requirements shape the same entropy
const long = (await D.derivePassword(MASTER, { ...base, length: 40 }, USER)).password;
check('length only', [...long].length, 40);
check('digits only', /^[0-9]{10}$/.test((await D.derivePassword(MASTER, { ...base, length: 10, upper: false, lower: false, symbols: false }, USER)).password), true);
check('every set', [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].map((re) => re.test(long)), [true, true, true, true]);
check('no look-alikes', /[O0oIl1|]/.test((await D.derivePassword(MASTER, { ...base, length: 128 }, USER)).password), false);
check('other user', (await D.derivePassword(MASTER, base, 'you@example.com')).password !== vectors[0][1], true);
check('other site', (await D.derivePassword(MASTER, { ...base, site: 'gitlab.com' }, USER)).password !== vectors[0][1], true);
check('other master', (await D.derivePassword('другой', base, USER)).password !== vectors[0][1], true);

// The stored form
const stored = D.serializeDerived({ ...base, check: 'c0014f12' });
check('marker', JSON.parse(stored).$derived, D.DERIVED_MARKER);
check('the site is not stored: it follows the website', 'site' in JSON.parse(stored), false);
check('round trip', D.parseDerived(stored, 'https://www.GitHub.com/login'), { site: 'github.com', version: 1, ...D.REQUIREMENT_DEFAULTS, check: 'c0014f12' });
check('no website is no damage', D.parseDerived(stored)?.site, '');
check('ordinary password', D.parseDerived('hunter2'), null);
check('ordinary JSON', D.parseDerived('{"a":1}'), null);
check('broken JSON', D.parseDerived(`{"$derived":"${D.DERIVED_MARKER}"`), null);
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch (error) {
    return error instanceof D.DerivedError;
  }
};
check('newer generator', throws(() => D.parseDerived(stored.replace('"gen":3', '"gen":4'))), true);
check('damaged settings', throws(() => D.parseDerived(stored.replace('"len":20', '"len":2'))), true);
check('version range', [0, 1, 4294967295, 4294967296, 1.5].map((version) => D.specProblem({ ...base, version }) === null), [false, true, true, false, false]);
check('site required', D.specProblem({ ...base, site: '  ' }) !== null, true);
check('a set required', D.specProblem({ ...base, upper: false, lower: false, digits: false, symbols: false }) !== null, true);
check(
  'site of the website',
  ['https://www.GitHub.com/login', 'github.com/x', 'http://user:pw@Example.COM:8443/a?b', 'localhost:8080', 'login.example.com', 'https://пример.рф/', ' My Bank ', ''].map(D.siteOf),
  ['github.com', 'github.com', 'example.com', 'localhost', 'login.example.com', 'xn--e1afmkfd.xn--p1ai', 'my bank', ''],
);
check('bits capped', D.derivedBits({ ...base, length: 128 }), 256);

// The session: the entry's password, and what locking forgets
const db = await D.createDatabase('Derived', MASTER, null);
const entry = D.createEntry(db, db.getDefaultGroup());
entry.fields.set('UserName', USER);
entry.fields.set('Password', D.makeValue(stored, true));
check('no website, no password', await Promise.resolve(D.entryPassword(entry)).then(() => 'derived', (error) => error instanceof D.DerivedError), true);
entry.fields.set('URL', 'https://github.com/');
check('stored entry password', await D.entryPassword(Object.assign(D.createEntry(db, db.getDefaultGroup()), { fields: new Map([['Password', D.makeValue('hunter2', true)]]) })), 'hunter2');
D.setMasterPassword(null);
check('locked', await D.entryPassword(entry).then(() => 'derived', (error) => error instanceof D.DerivedError), true);
D.setMasterPassword(MASTER);
check('derived entry password', await D.entryPassword(entry), vectors[0][1]);
check('cached', D.cachedPassword(base, USER)?.password, vectors[0][1]);
check('reshaped from cached entropy', await D.computePassword({ ...base, length: 12, symbols: false }, USER), { password: vectors[1][1], check: vectors[1][2] });
D.setMasterPassword(null);
check('forgotten on lock', D.cachedPassword(base, USER), undefined);

// Saved and reopened: other apps see JSON, this one the password
const reopened = await D.openDatabase(await D.saveDatabase(db), MASTER, null);
const again = reopened.getDefaultGroup().entries.find((item) => D.field(item, 'UserName') === USER);
D.setMasterPassword(MASTER);
check('survives the file', await D.entryPassword(again), vectors[0][1]);
check('raw field is JSON', D.field(again, 'Password'), stored);
D.setMasterPassword(null);

done('derived');
