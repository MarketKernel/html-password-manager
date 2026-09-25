/** The generator popover: length, character sets, a live preview and its entropy. */

import { generatePassword, generatorBits, LENGTH_MAX, LENGTH_MIN, type GeneratorOptions } from './generator';
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
  const lengthValue = h('span', { class: 'gen-length-value' });
  const slider = h('input', { type: 'range', min: String(LENGTH_MIN), max: '64', class: 'gen-slider', 'aria-label': 'Length' });
  slider.value = String(Math.min(64, options.length));

  const regenerate = (): void => {
    preview.textContent = generatePassword(options) || '—';
    lengthValue.textContent = String(options.length);
    const entropy = generatorBits(options);
    bits.textContent = entropy ? `${entropy} bits` : 'pick at least one set';
    bits.dataset['level'] = entropy < 50 ? '1' : entropy < 80 ? '2' : entropy < 110 ? '3' : '4';
  };

  slider.addEventListener('input', () => {
    options.length = Math.min(LENGTH_MAX, Number(slider.value));
    regenerate();
    config.onOptions({ ...options });
  });

  const checks = h('div', { class: 'gen-checks' });
  const sets: [keyof GeneratorOptions, string, string][] = [
    ['upper', 'A–Z', 'Capital letters'],
    ['lower', 'a–z', 'Small letters'],
    ['digits', '0–9', 'Digits'],
    ['symbols', '#$%', 'Symbols'],
    ['ambiguous', 'O0l1', 'Allow look-alike characters'],
  ];
  for (const [key, label, title] of sets) {
    const box = h('input', { type: 'checkbox' });
    box.checked = Boolean(options[key]);
    box.addEventListener('change', () => {
      (options[key] as boolean) = box.checked;
      regenerate();
      config.onOptions({ ...options });
    });
    checks.append(h('label', { class: 'gen-check', title }, box, h('span', { text: label })));
  }

  const again = h('button', { type: 'button', class: 'icon-button', title: 'Another one' }, icon(ICONS.dice));
  again.addEventListener('click', regenerate);
  const use = h('button', { type: 'button', class: 'button button--primary button--small', text: config.useLabel });

  const panel = h(
    'div',
    { class: 'gen' },
    h('div', { class: 'gen-row' }, preview, again),
    h('div', { class: 'gen-row gen-row--length' }, h('span', { class: 'gen-label', text: 'Length' }), slider, lengthValue),
    checks,
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
