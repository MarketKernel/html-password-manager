/**
 * Time-based one-time codes (RFC 6238) for entries that carry a TOTP secret.
 *
 * Three ways of storing it are in use, and all are read:
 * - an `otp` field with an `otpauth://totp/…` URL or a bare base32 secret
 *   (KeePassXC, KeeWeb);
 * - `TimeOtp-Secret-Base32` with `TimeOtp-Length`, `-Period`, `-Algorithm`
 *   (KeePass 2.47 and later);
 * - `TOTP Seed` with `TOTP Settings` = `period;digits` (the TrayTOTP plugin).
 */

export type OtpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface OtpParams {
  secret: Uint8Array;
  digits: number;
  period: number;
  algorithm: OtpAlgorithm;
}

/** Names of fields that hold OTP data; the details view hides them behind the code. */
export const OTP_FIELDS = [
  'otp',
  'TimeOtp-Secret-Base32',
  'TimeOtp-Secret',
  'TimeOtp-Secret-Hex',
  'TimeOtp-Length',
  'TimeOtp-Period',
  'TimeOtp-Algorithm',
  'TOTP Seed',
  'TOTP Settings',
];

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input: string): Uint8Array | null {
  const clean = input.replace(/[\s=-]/g, '').toUpperCase();
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    buffer = (buffer << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

function algorithmOf(name: string | null | undefined): OtpAlgorithm {
  const upper = (name ?? '').toUpperCase().replace(/^HMAC-/, '');
  if (upper === 'SHA256' || upper === 'SHA-256') return 'SHA-256';
  if (upper === 'SHA512' || upper === 'SHA-512') return 'SHA-512';
  return 'SHA-1';
}

function bounded(value: string | null | undefined, fallback: number, min: number, max: number): number {
  const number = Number.parseInt(value ?? '', 10);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

export function parseOtpUrl(url: string): OtpParams | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'otpauth:' || parsed.host.toLowerCase() !== 'totp') return null;
  const secret = base32Decode(parsed.searchParams.get('secret') ?? '');
  if (!secret || secret.length === 0) return null;
  return {
    secret,
    digits: bounded(parsed.searchParams.get('digits'), 6, 6, 10),
    period: bounded(parsed.searchParams.get('period'), 30, 1, 3600),
    algorithm: algorithmOf(parsed.searchParams.get('algorithm')),
  };
}

function hexDecode(input: string): Uint8Array | null {
  const clean = input.replace(/\s/g, '');
  if (!clean || clean.length % 2 || /[^0-9a-f]/i.test(clean)) return null;
  return new Uint8Array(clean.match(/../g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
}

/** Reads whatever OTP convention the entry follows; null when it has none. */
export function otpFromFields(get: (name: string) => string | undefined): OtpParams | null {
  const otp = get('otp')?.trim();
  if (otp) {
    if (/^otpauth:/i.test(otp)) return parseOtpUrl(otp);
    const secret = base32Decode(otp);
    return secret && secret.length ? { secret, digits: 6, period: 30, algorithm: 'SHA-1' } : null;
  }

  const b32 = get('TimeOtp-Secret-Base32');
  const hex = get('TimeOtp-Secret-Hex');
  const utf8 = get('TimeOtp-Secret');
  const keepass = b32 ? base32Decode(b32) : hex ? hexDecode(hex) : utf8 ? new TextEncoder().encode(utf8) : null;
  if (keepass && keepass.length) {
    return {
      secret: keepass,
      digits: bounded(get('TimeOtp-Length'), 6, 6, 10),
      period: bounded(get('TimeOtp-Period'), 30, 1, 3600),
      algorithm: algorithmOf(get('TimeOtp-Algorithm')),
    };
  }

  const seed = get('TOTP Seed');
  const tray = seed ? base32Decode(seed) : null;
  if (tray && tray.length) {
    const [period, digits] = (get('TOTP Settings') ?? '').split(';');
    return {
      secret: tray,
      digits: bounded(digits, 6, 6, 10),
      period: bounded(period, 30, 1, 3600),
      algorithm: 'SHA-1',
    };
  }
  return null;
}

export async function totp(params: OtpParams, now = Date.now()): Promise<string> {
  const counter = Math.floor(now / 1000 / params.period);
  const message = new ArrayBuffer(8);
  const view = new DataView(message);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey(
    'raw',
    params.secret as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: params.algorithm },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  const offset = (mac[mac.length - 1] ?? 0) & 0x0f;
  const binary =
    (((mac[offset] ?? 0) & 0x7f) << 24) |
    ((mac[offset + 1] ?? 0) << 16) |
    ((mac[offset + 2] ?? 0) << 8) |
    (mac[offset + 3] ?? 0);
  return String(binary % 10 ** params.digits).padStart(params.digits, '0');
}

/** Seconds until the current code expires. */
export function secondsLeft(params: OtpParams, now = Date.now()): number {
  return params.period - (Math.floor(now / 1000) % params.period);
}

/** "123 456" — easier to read off the screen. */
export function formatCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return code.length >= 6 ? `${code.slice(0, half)} ${code.slice(half)}` : code;
}
