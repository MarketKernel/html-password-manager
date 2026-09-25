/** The generator popover: length, character sets, a live preview and its entropy. */

import type { Requirements } from './derived';
import { generatePassword, generatorBits, LENGTH_MAX, LENGTH_MIN, type GeneratorOptions } from './generator';
import { t, tn } from './i18n';
import { h, icon, ICONS, popover } from './ui';

export interface GeneratorPanelOptions {
  anchor: HTMLElement;
  options: GeneratorOptions;
  onOptions(options: GeneratorOptions): void;
  /** The button label and what happens with the chosen password. */
  useLabel: string;
  onUse(password: string): void;
}

export function openGenerator(config: GeneratorPanelOptions): void {
  const options = { ...config.options };
  const preview = h('output', { class: 'gen-preview', 'aria-live': 'polite' });
  const bits = h('span', { class: 'gen-bits' });
  const controls = requirementControls(options, () => {
    regenerate();
    config.onOptions({ ...options });
  });

  const regenerate = (): void => {
    preview.textContent = generatePassword(options) || '—';
    const entropy = generatorBits(options);
    bits.textContent = entropy ? tn('generator', '{count} bit', '{count} bits', entropy) : t('generator', 'pick at least one set');
    bits.dataset['level'] = bitsLevel(entropy);
  };

  const again = h('button', { type: 'button', class: 'icon-button', title: t('generator', 'Another one') }, icon(ICONS.dice));
  again.addEventListener('click', regenerate);
  const use = h('button', { type: 'button', class: 'button button--primary button--small', text: config.useLabel });

  const panel = h(
    'div',
    { class: 'gen' },
    h('div', { class: 'gen-row' }, preview, again),
    ...controls,
    h('div', { class: 'gen-row gen-row--foot' }, bits, use),
  );
  regenerate();
  const close = popover(config.anchor, panel);
  use.addEventListener('click', () => {
    const value = preview.textContent ?? '';
    if (!value || value === '—') return;
    close();
    config.onUse(value);
  });
  use.focus();
}

/** Colour step for an entropy in bits, as the generator shows it. */
export function bitsLevel(bits: number): string {
  return bits < 50 ? '1' : bits < 80 ? '2' : bits < 110 ? '3' : '4';
}

/** The length slider and the character-set toggles; they change `options` in place. */
export function requirementControls(options: Requirements, onChange: () => void): HTMLElement[] {
  const lengthValue = h('span', { class: 'gen-length-value', text: String(options.length) });
  const slider = h('input', { type: 'range', min: String(LENGTH_MIN), max: '64', class: 'gen-slider', 'aria-label': t('generator', 'Length') });
  slider.value = String(Math.min(64, options.length));
  slider.addEventListener('input', () => {
    options.length = Math.min(LENGTH_MAX, Number(slider.value));
    lengthValue.textContent = String(options.length);
    onChange();
  });

  const checks = h('div', { class: 'gen-checks' });
  const sets: [keyof Omit<Requirements, 'length'>, string, string][] = [
    ['upper', 'A–Z', t('generator', 'Capital letters')],
    ['lower', 'a–z', t('generator', 'Small letters')],
    ['digits', '0–9', t('generator', 'Digits')],
    ['symbols', '#$%', t('generator', 'Symbols')],
    ['ambiguous', 'O0l1', t('generator', 'Allow look-alike characters')],
  ];
  for (const [key, label, title] of sets) {
    const box = h('input', { type: 'checkbox' });
    box.checked = options[key];
    box.addEventListener('change', () => {
      options[key] = box.checked;
      onChange();
    });
    checks.append(h('label', { class: 'gen-check', title }, box, h('span', { text: label })));
  }
  return [h('div', { class: 'gen-row gen-row--length' }, h('span', { class: 'gen-label', text: t('generator', 'Length') }), slider, lengthValue), checks];
}
