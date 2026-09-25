/** Small dialogs, a context menu, popovers and toasts — enough to avoid native prompts. */

import { t } from './i18n';

let overlay: HTMLDivElement | null = null;

function shell(): HTMLDivElement {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.hidden = true;
    document.body.append(overlay);
  }
  return overlay;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) node.append(child);
  return node;
}

/* ------------------------------------------------------------------ *
 * Secret inputs
 *
 * On macOS a browser that decides a field holds a password turns on Secure
 * Input, and the system then forces an ASCII keyboard layout: a Cyrillic
 * (or any non-Latin) password cannot be typed at all. Chrome decides so not
 * only for type=password but also, by heuristics, for text fields styled
 * with -webkit-text-security or holding a value made of dots — and once it
 * has, the field stays a "password" for good.
 *
 * So a secret field gives the browser no such hint. It is a plain text input
 * that keeps the real value; the text itself is transparent, and a layer of
 * dots drawn over it shows its length. Both use a monospace font, so every
 * dot sits over its character and the caret lands where it should.
 * ------------------------------------------------------------------ */

const DOT = '\u2022';

/**
 * Hides the input's text without anything a browser reads as a password field.
 * Returns the layer of dots, which the caller puts right after the input, inside
 * a positioned parent. `data-secret` marks the input for good.
 */
export function maskInput(input: HTMLInputElement): HTMLElement {
  input.type = 'text';
  input.dataset['secret'] = '';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocorrect', 'off');
  input.classList.add('secret-input', 'masked');

  const dots = h('span', { class: 'secret-dots' });
  const layer = h('span', { class: 'secret-layer', 'aria-hidden': 'true' }, dots);

  const sync = (): void => {
    const masked = input.classList.contains('masked');
    layer.hidden = !masked || !input.value;
    if (layer.hidden) return;
    dots.textContent = DOT.repeat(Array.from(input.value).length);
    // The layer covers exactly the input's text box, so the dots scroll with the text.
    const style = getComputedStyle(input);
    const padLeft = parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
    const padRight = parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth);
    layer.style.left = `${input.offsetLeft + padLeft}px`;
    layer.style.top = `${input.offsetTop}px`;
    layer.style.width = `${Math.max(0, input.offsetWidth - padLeft - padRight)}px`;
    layer.style.height = `${input.offsetHeight}px`;
    layer.style.font = style.font;
    layer.style.letterSpacing = style.letterSpacing;
    dots.style.transform = `translateX(${-input.scrollLeft}px)`;
  };
  syncs.set(input, sync);

  // While focused, the caret can scroll the text in ways no event reports; follow it per frame.
  let frame = 0;
  const follow = (): void => {
    sync();
    frame = requestAnimationFrame(follow);
  };
  input.addEventListener('focus', () => {
    cancelAnimationFrame(frame);
    follow();
  });
  input.addEventListener('blur', () => {
    cancelAnimationFrame(frame);
    sync();
  });
  input.addEventListener('input', sync);
  new ResizeObserver(sync).observe(input);

  // A masked field must not hand its text out through copy or cut, as type=password does not.
  const guard = (event: Event): void => {
    if (input.classList.contains('masked')) event.preventDefault();
  };
  input.addEventListener('copy', guard);
  input.addEventListener('cut', guard);
  return layer;
}

const syncs = new WeakMap<HTMLInputElement, () => void>();

/** Redraws the dots after the value was set from code, which fires no input event. */
export function syncMask(input: HTMLInputElement): void {
  syncs.get(input)?.();
}

export function setRevealed(input: HTMLInputElement, revealed: boolean): void {
  input.classList.toggle('masked', !revealed);
  syncMask(input);
}

export function isRevealed(input: HTMLInputElement): boolean {
  return !input.classList.contains('masked');
}

/** The alphabet of the last letter in `text` — shows the layout a masked field is being typed in. */
export function layoutOf(text: string): 'РУС' | 'ENG' | null {
  const letters = text.match(/\p{L}/gu);
  const last = letters?.[letters.length - 1];
  if (!last) return null;
  if (/\p{Script=Cyrillic}/u.test(last)) return 'РУС';
  if (/\p{Script=Latin}/u.test(last)) return 'ENG';
  return null;
}

/** Keeps `badge` showing the layout of what is typed into `input`. */
export function bindLayoutBadge(input: HTMLInputElement, badge: HTMLElement): () => void {
  const update = (): void => {
    const layout = layoutOf(input.value);
    badge.hidden = !layout;
    badge.textContent = layout ?? '';
    badge.title = layout === 'РУС' ? t('password', 'Typing in Cyrillic') : t('password', 'Typing in Latin');
  };
  input.addEventListener('input', update);
  update();
  return update;
}

/** A masked input with a layout badge and a show/hide button, for the dialogs. */
function secretField(input: HTMLInputElement): HTMLElement {
  const layer = maskInput(input);
  const badge = h('span', { class: 'layout-badge', 'aria-live': 'polite' });
  bindLayoutBadge(input, badge);
  const reveal = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('password', 'Show password') }, icon(ICONS.eye));
  reveal.addEventListener('click', () => {
    const shown = !isRevealed(input);
    setRevealed(input, shown);
    reveal.title = shown ? t('password', 'Hide password') : t('password', 'Show password');
    reveal.replaceChildren(icon(shown ? ICONS.eyeOff : ICONS.eye));
    input.focus();
  });
  return h('span', { class: 'secret-field' }, input, layer, badge, reveal);
}

export interface FormField {
  name: string;
  label: string;
  type?: 'text' | 'password' | 'file' | 'checkbox';
  value?: string;
  placeholder?: string;
  hint?: string;
}

export interface FormOptions {
  title: string;
  message?: string;
  fields?: FormField[];
  confirm: string;
  danger?: boolean;
  /** Returns an error to show, or null to accept; the dialog stays open on an error. */
  validate?: (values: Record<string, string>, files: Record<string, File | null>) => string | null;
}

export interface FormResult {
  values: Record<string, string>;
  files: Record<string, File | null>;
}

export function form(options: FormOptions): Promise<FormResult | null> {
  const host = shell();
  host.hidden = false;
  host.replaceChildren();

  const box = h('form', { class: 'dialog' }, h('h2', { text: options.title }));
  if (options.message) box.append(h('p', { class: 'dialog-text', text: options.message }));
  const inputs = new Map<string, HTMLInputElement>();
  for (const field of options.fields ?? []) {
    const secret = field.type === 'password';
    const input = h('input', {
      class: field.type === 'checkbox' ? 'dialog-check' : 'dialog-input',
      type: secret ? 'text' : (field.type ?? 'text'),
      name: field.name,
      placeholder: field.placeholder,
      autocomplete: 'off',
      spellcheck: 'false',
    });
    if (field.type === 'checkbox') input.checked = field.value === 'true';
    else if (field.type !== 'file') input.value = field.value ?? '';
    inputs.set(field.name, input);
    const label =
      field.type === 'checkbox'
        ? h('label', { class: 'dialog-label dialog-label--check' }, input, field.label)
        : h('label', { class: 'dialog-label' }, field.label, secret ? secretField(input) : input);
    if (field.hint) label.append(h('span', { class: 'dialog-hint', text: field.hint }));
    box.append(label);
  }
  const error = h('p', { class: 'dialog-error', 'aria-live': 'polite' });
  box.append(
    error,
    h(
      'div',
      { class: 'dialog-row' },
      h('button', { type: 'button', class: 'button button--ghost', 'data-cancel': '', text: t('dialog', 'Cancel') }),
      h('button', { type: 'submit', class: `button ${options.danger ? 'button--danger' : 'button--primary'}`, text: options.confirm }),
    ),
  );
  host.append(box);

  const first = [...inputs.values()].find((input) => input.type !== 'checkbox' && input.type !== 'file');
  if (first) {
    first.focus();
    const dot = first.value.lastIndexOf('.');
    first.setSelectionRange(0, dot > 0 ? dot : first.value.length);
  } else {
    box.querySelector<HTMLButtonElement>('[type=submit]')?.focus();
  }

  return new Promise((resolve) => {
    const close = (result: FormResult | null): void => {
      host.hidden = true;
      host.replaceChildren();
      document.removeEventListener('keydown', onKey, true);
      resolve(result);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(null);
      }
    };
    document.addEventListener('keydown', onKey, true);
    box.addEventListener('submit', (event) => {
      event.preventDefault();
      const values: Record<string, string> = {};
      const files: Record<string, File | null> = {};
      for (const [name, input] of inputs) {
        if (input.type === 'checkbox') values[name] = String(input.checked);
        else if (input.type === 'file') files[name] = input.files?.[0] ?? null;
        // Spaces are part of a password; only names and labels are trimmed.
        else values[name] = input.dataset['secret'] !== undefined ? input.value : input.value.trim();
      }
      const problem = options.validate?.(values, files) ?? null;
      if (problem) {
        error.textContent = problem;
        return;
      }
      close({ values, files });
    });
    box.querySelector('[data-cancel]')?.addEventListener('click', () => close(null));
    host.addEventListener('mousedown', (event) => {
      if (event.target === host) close(null);
    });
  });
}

export async function ask(title: string, label: string, value = ''): Promise<string | null> {
  const result = await form({
    title,
    fields: [{ name: 'value', label, value }],
    confirm: t('dialog', 'Done'),
    validate: (values) => (values['value'] ? null : t('dialog', 'The name cannot be empty')),
  });
  return result ? (result.values['value'] ?? '') : null;
}

export async function confirmAsk(title: string, message: string, confirm = t('dialog', 'Delete'), danger = true): Promise<boolean> {
  return (await form({ title, message, confirm, danger })) !== null;
}

export interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  /** A thin line above the item. */
  separated?: boolean;
  hint?: string;
}

export function menu(x: number, y: number, items: MenuItem[]): void {
  document.querySelector('.context-menu')?.remove();
  const list = h('div', { class: 'context-menu', role: 'menu' });
  for (const item of items) {
    if (item.separated) list.append(h('div', { class: 'context-sep' }));
    const button = h(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        class: `context-item${item.danger ? ' context-item--danger' : ''}${item.checked ? ' context-item--checked' : ''}`,
      },
      h('span', { text: item.label }),
      item.hint ? h('kbd', { text: item.hint }) : null,
    );
    button.disabled = Boolean(item.disabled);
    button.addEventListener('click', () => {
      dismiss();
      item.action();
    });
    list.append(button);
  }
  document.body.append(list);
  const width = list.offsetWidth;
  const height = list.offsetHeight;
  list.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
  list.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;

  const onDown = (event: Event): void => {
    if (event.target instanceof Node && list.contains(event.target)) return;
    dismiss();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') dismiss();
  };
  function dismiss(): void {
    list.remove();
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
  }
  window.setTimeout(() => {
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
  });
}

export function menuAt(anchor: HTMLElement, items: MenuItem[]): void {
  const box = anchor.getBoundingClientRect();
  menu(box.left, box.bottom + 4, items);
}

/** A panel pinned under `anchor` that closes on an outside click or Escape. */
export function popover(anchor: HTMLElement, content: HTMLElement, onClose?: () => void): () => void {
  document.querySelector('.popover')?.dispatchEvent(new Event('dismiss'));
  const panel = h('div', { class: 'popover' }, content);
  document.body.append(panel);
  const place = (): void => {
    const box = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left = Math.max(8, Math.min(box.right - width, window.innerWidth - width - 8));
    const below = box.bottom + 6;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, box.top - height - 6) : below;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };
  place();

  const onDown = (event: Event): void => {
    if (event.target instanceof Node && (panel.contains(event.target) || anchor.contains(event.target))) return;
    dismiss();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      dismiss();
    }
  };
  let open = true;
  function dismiss(): void {
    if (!open) return;
    open = false;
    panel.remove();
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    onClose?.();
  }
  panel.addEventListener('dismiss', dismiss);
  window.addEventListener('resize', place);
  window.setTimeout(() => {
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
  });
  return dismiss;
}

let toastTimer = 0;

export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  let box = document.querySelector<HTMLDivElement>('.toast');
  if (!box) {
    box = h('div', { class: 'toast', role: 'status' });
    document.body.append(box);
  }
  box.textContent = message;
  box.classList.toggle('toast--error', kind === 'error');
  box.classList.add('toast--shown');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => box?.classList.remove('toast--shown'), kind === 'error' ? 6000 : 2400);
}

/** One SVG icon from a path list, stroked with the current colour. */
export function icon(paths: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths;
  return svg;
}

export const ICONS = {
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A16.8 16.8 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  clip: '<path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.3 3.3 0 0 1 4.7 4.7L10.2 17.7a1.7 1.7 0 0 1-2.4-2.4L15.5 7.6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
};
