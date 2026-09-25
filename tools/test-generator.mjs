/**
 * The password generator, the strength estimate and TOTP codes. The TOTP
 * vectors are the ones published in RFC 6238, appendix B.
 */
import { checker, load } from './load.mjs';

const G = await load('generator', 'otp', 'ui');
const { check, done } = checker();

// Generator
const all = { length: 32, upper: true, lower: true, digits: true, symbols: true, ambiguous: false };
const password = G.generatePassword(all);
check('length', [...password].length, 32);
check('has every class', [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].map((re) => re.test(password)), [true, true, true, true]);
check('no look-alikes', /[O0oIl1|]/.test(G.generatePassword({ ...all, length: 128 })), false);
check('digits only', /^[0-9]{12}$/.test(G.generatePassword({ ...all, length: 12, upper: false, lower: false, symbols: false, ambiguous: true })), true);
check('nothing chosen', G.generatePassword({ ...all, upper: false, lower: false, digits: false, symbols: false }), '');
check('length clamped', G.generatePassword({ ...all, length: 1 }).length, 4);
check('every set present at minimum length', (() => {
  for (let i = 0; i < 200; i += 1) {
    const p = G.generatePassword({ ...all, length: 4 });
    if (![/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].every((re) => re.test(p))) return false;
  }
  return true;
})(), true);
check('bits', G.generatorBits({ ...all, length: 20, ambiguous: true }), Math.round(20 * Math.log2(26 + 26 + 10 + 28)));

// randomInt is uniform: 60 000 draws over 6 buckets stay within 5 %.
const counts = new Array(6).fill(0);
for (let i = 0; i < 60000; i += 1) counts[G.randomInt(6)] += 1;
check('uniform', counts.every((n) => Math.abs(n - 10000) < 500), true);

// Strength
check('empty', G.strength('').level, 0);
check('weak', G.strength('12345').level, 1);
check('repeats count little', G.strength('aaaaaaaaaaaa').level, 1);
check('fair', G.strength('hello2024').level, 2);
check('strong', G.strength(password).level, 4);

// Base32 and TOTP
check('base32', [...G.base32Decode('JBSWY3DPEHPK3PXP')], [...new TextEncoder().encode('Hello!'), 0xde, 0xad, 0xbe, 0xef]);
check('base32 rejects junk', G.base32Decode('not base32!'), null);

const key20 = new TextEncoder().encode('12345678901234567890');
const key32 = new TextEncoder().encode('12345678901234567890123456789012');
const key64 = new TextEncoder().encode('1234567890123456789012345678901234567890123456789012345678901234');
const vectors = [
  [59, '94287082', '46119246', '90693936'],
  [1111111109, '07081804', '68084774', '25091201'],
  [1111111111, '14050471', '67062674', '99943326'],
  [1234567890, '89005924', '91819424', '93441116'],
  [2000000000, '69279037', '90698825', '38618901'],
  [20000000000, '65353130', '77737706', '47863826'],
];
for (const [time, sha1, sha256, sha512] of vectors) {
  const at = time * 1000;
  check(`RFC 6238 SHA-1 @${time}`, await G.totp({ secret: key20, digits: 8, period: 30, algorithm: 'SHA-1' }, at), sha1);
  check(`RFC 6238 SHA-256 @${time}`, await G.totp({ secret: key32, digits: 8, period: 30, algorithm: 'SHA-256' }, at), sha256);
  check(`RFC 6238 SHA-512 @${time}`, await G.totp({ secret: key64, digits: 8, period: 30, algorithm: 'SHA-512' }, at), sha512);
}

// Where the secret comes from
const fromMap = (map) => G.otpFromFields((name) => map[name]);
const url = 'otpauth://totp/Example:me?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Example&digits=8&period=60&algorithm=SHA256';
check('otpauth url', (({ digits, period, algorithm }) => [digits, period, algorithm])(fromMap({ otp: url })), [8, 60, 'SHA-256']);
check('bare secret', fromMap({ otp: 'GEZD GNBV GY3T QOJQ' })?.digits, 6);
check('KeePass fields', (({ digits, period, algorithm }) => [digits, period, algorithm])(fromMap({
  'TimeOtp-Secret-Base32': 'GEZDGNBVGY3TQOJQ', 'TimeOtp-Length': '8', 'TimeOtp-Period': '45', 'TimeOtp-Algorithm': 'HMAC-SHA-512',
})), [8, 45, 'SHA-512']);
check('TrayTOTP fields', (({ digits, period }) => [digits, period])(fromMap({ 'TOTP Seed': 'GEZDGNBVGY3TQOJQ', 'TOTP Settings': '60;7' })), [7, 60]);
check('no otp', fromMap({ Title: 'x' }), null);
check('hotp is not totp', fromMap({ otp: 'otpauth://hotp/x?secret=GEZDGNBV' }), null);
check('seconds left', G.secondsLeft({ period: 30 }, 1000 * 61), 29);
check('format code', G.formatCode('123456'), '123 456');

// The layout badge of masked fields
check('layout: cyrillic', G.layoutOf('Тестовый пароль'), 'РУС');
check('layout: latin', G.layoutOf('Тест password'), 'ENG');
check('layout: last letter wins over digits', G.layoutOf('пароль123!'), 'РУС');
check('layout: no letters', G.layoutOf('12345'), null);

done('generator + otp + ui');
