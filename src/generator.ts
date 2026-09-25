/**
 * Password generation and a strength estimate.
 *
 * Every character is drawn with `crypto.getRandomValues` and rejection
 * sampling, so no character is likelier than another (a plain `byte % n`
 * would favour the start of the alphabet).
 */

export interface GeneratorOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  /** Keep look-alikes such as O/0 and l/1/I in the alphabet. */
  ambiguous: boolean;
}

export const GENERATOR_DEFAULTS: GeneratorOptions = {
  length: 20,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  ambiguous: false,
};

export const LENGTH_MIN = 4;
export const LENGTH_MAX = 128;

export const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!#$%&*+-=?@^_~.,:;()[]{}<>/|',
} as const;

const AMBIGUOUS = new Set('O0oIl1|');

type Random = (bound: number) => number;

/** A uniform integer in [0, bound). */
export function randomInt(bound: number): number {
  if (!Number.isInteger(bound) || bound <= 0 || bound > 2 ** 32) throw new RangeError(`bad bound ${bound}`);
  const limit = 2 ** 32 - (2 ** 32 % bound);
  const cell = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(cell);
    const value = cell[0] ?? 0;
    if (value < limit) return value % bound;
  }
}

export function alphabets(options: GeneratorOptions): string[] {
  const sets: string[] = [];
  for (const key of ['upper', 'lower', 'digits', 'symbols'] as const) {
    if (!options[key]) continue;
    const set = options.ambiguous ? CHARSETS[key] : Array.from(CHARSETS[key]).filter((c) => !AMBIGUOUS.has(c)).join('');
    sets.push(set);
  }
  return sets;
}

/** One character from every chosen set, the rest from all of them, then shuffled. */
export function generatePassword(options: GeneratorOptions, random: Random = randomInt): string {
  const sets = alphabets(options);
  if (sets.length === 0) return '';
  const length = Math.min(LENGTH_MAX, Math.max(LENGTH_MIN, Math.round(options.length)));
  const all = sets.join('');
  const chars: string[] = [];
  for (const set of sets) if (chars.length < length) chars.push(set[random(set.length)] ?? '');
  while (chars.length < length) chars.push(all[random(all.length)] ?? '');
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j] ?? '', chars[i] ?? ''];
  }
  return chars.join('');
}

/** Entropy of a generated password: log2 of the alphabet, times the length. */
export function generatorBits(options: GeneratorOptions): number {
  const size = alphabets(options).join('').length;
  return size > 1 ? Math.round(options.length * Math.log2(size)) : 0;
}

export interface Strength {
  bits: number;
  /** 0 — none, 1 — weak, 2 — fair, 3 — good, 4 — strong. */
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const LABELS = ['Empty', 'Weak', 'Fair', 'Good', 'Strong'] as const;

/**
 * A rough estimate for a password a person typed: the alphabet size its
 * character classes imply, times its length, with repeats and runs such as
 * `aaaa` or `1234` counted once.
 */
export function strength(password: string): Strength {
  const chars = Array.from(password);
  if (chars.length === 0) return { bits: 0, level: 0, label: LABELS[0] };
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(password)) pool += 33;
  if (/[^\x00-\x7f]/.test(password)) pool += 100;

  let effective = 0;
  for (let i = 0; i < chars.length; i += 1) {
    const code = chars[i]?.codePointAt(0) ?? 0;
    const prev = i > 0 ? (chars[i - 1]?.codePointAt(0) ?? 0) : NaN;
    const step = code - prev;
    // A repeat or a step of ±1 from the previous character adds little.
    effective += step === 0 || step === 1 || step === -1 ? 0.25 : 1;
  }
  const bits = Math.round(effective * Math.log2(Math.max(pool, 2)));
  const level = bits < 28 ? 1 : bits < 50 ? 2 : bits < 80 ? 3 : 4;
  return { bits, level, label: LABELS[level] };
}
