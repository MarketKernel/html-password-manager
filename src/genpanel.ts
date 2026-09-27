/**
 * The generator popover. It makes a password of one of several kinds, picked
 * from a list — newest derivation first, random last:
 *
 * - derived v3 — derived from the master password, the site, the user name
 *   and a version (src/derived.ts); from an entry it makes the entry's
 *   password derived instead of handing a password over;
 * - derived v2 and v1 (legacy 2 and legacy 1) — the calculators of two older programs
 *   (src/legacy.ts), shown only when the settings ask for them. From an
 *   entry the identifier is suggested; the phrases are gone when the
 *   popover closes, unless kept in memory until the database locks;
 * - random — length, character sets, a live preview and its entropy.
 */

import {
  computePassword,
  derivedBits,
  derivePassword,
  REQUIREMENT_DEFAULTS,
  sessionMasterPassword,
  siteOf,
  specProblem,
  storedProblem,
  VERSION_MAX,
  type DerivedSpec,
  type Requirements,
} from './derived';
import { GENERATOR_KINDS, generatePassword, generatorBits, isLegacy, LENGTH_MAX, LENGTH_MIN, type GeneratorKind, type GeneratorOptions } from './generator';
import { t, tn } from './i18n';
import {
  legacy1Password,
  legacy1PrimaryKey,
  legacy2Key,
  legacy2Password,
  legacyIdentifier,
  rememberedLegacySecret,
  rememberLegacySecret,
  LEGACY2_DEFAULTS,
  LEGACY2_LENGTH_MAX,
  LEGACY2_LENGTH_MIN,
  LEGACY2_VERSION_MAX,
  type Legacy2Sets,
  type LegacySecret,
} from './legacy';
import { bindLayoutBadge, h, icon, ICONS, maskInput, popover, setRevealed } from './ui';

/** The settings a derived password keeps, apart from the site, which follows the website. */
export type DerivedSettings = Requirements & { version: number };

/** The entry the generator was opened from. */
export interface GeneratorEntry {
  site: string;
  user: string;
  /** The entry's derived settings, null for a stored password. */
  derived: DerivedSettings | null;
  /** Version 3 was chosen: the entry's password becomes derived with these settings. */
  onDerive(settings: DerivedSettings): void;
}

export interface GeneratorPanelOptions {
  anchor: HTMLElement;
  options: GeneratorOptions;
  onOptions(options: GeneratorOptions): void;
  kind: GeneratorKind;
  onKind(kind: GeneratorKind): void;
  /** Offer legacy 1 and legacy 2. */
  legacy: boolean;
  /** Legacy 1 takes the database's master password as its master key, legacy 2 as its primary secret phrase. */
  usesMaster: Record<'legacy1' | 'legacy2', boolean>;
  onUsesMaster(kind: 'legacy1' | 'legacy2', uses: boolean): void;
  /** The button label and what happens with the chosen password. */
  useLabel: string;
  onUse(password: string): void;
  /** Opened from an entry's password; absent for the toolbar's generator. */
  entry?: GeneratorEntry;
}

/** One kind of password: its controls, and what the button does. */
interface Mode {
  body: HTMLElement[];
  /** Beside the button, such as the entropy. */
  foot?: HTMLElement;
  ready(): boolean;
  use(): void;
  /** Where the keyboard goes when the kind is picked. */
  focus?: HTMLElement;
}

interface ModeContext {
  config: GeneratorPanelOptions;
  /** Something changed that may enable or disable the button. */
  changed(): void;
  close(): void;
  signal: AbortSignal;
}

export function openGenerator(config: GeneratorPanelOptions): void {
  // Newest derivation first, then the older ones the settings allow, then random: a v4 goes on top.
  const labels: Record<GeneratorKind, string> = {
    v3: t('generator', 'Derived v3'),
    legacy2: t('generator', 'Derived v2'),
    legacy1: t('generator', 'Derived v1'),
    random: t('generator', 'Random'),
  };
  const kinds = GENERATOR_KINDS.filter((k) => config.legacy || !isLegacy(k));
  let kind: GeneratorKind = kinds.includes(config.kind) ? config.kind : (kinds[0] ?? 'random');

  const aborter = new AbortController();
  const body = h('div', { class: 'gen-body' });
  const foot = h('span', { class: 'gen-foot' });
  const use = h('button', { type: 'button', class: 'button button--primary button--small', text: config.useLabel });
  const modes = new Map<GeneratorKind, Mode>();
  const picker = h('select', { class: 'field-input gen-kind', 'aria-label': t('generator', 'Kind of password'), 'data-field': 'gen-kind' });
  for (const value of kinds) {
    const option = h('option', { value, text: labels[value] });
    if (value === 'v3') option.title = t('derived', 'Computed from the master password, the site, the user name and the version: it can be recovered without the file');
    option.selected = value === kind;
    picker.append(option);
  }
  const panel = h('div', { class: 'gen' }, picker, body, h('div', { class: 'gen-row gen-row--foot' }, foot, use));

  let close = (): void => {};
  const changed = (): void => {
    // A kind still being built reports changes too; it is judged once it is shown.
    const mode = modes.get(kind);
    if (mode) use.disabled = !mode.ready();
  };
  const context: ModeContext = { config, changed, close: () => close(), signal: aborter.signal };
  const build: Record<GeneratorKind, () => Mode> = {
    random: () => randomMode(context),
    v3: () => derivedMode(context),
    legacy1: () => legacy1Mode(context),
    legacy2: () => legacy2Mode(context),
  };
  // Each kind is built once, so switching back and forth keeps what was typed.
  const current = (): Mode => {
    let mode = modes.get(kind);
    if (!mode) {
      mode = build[kind]();
      modes.set(kind, mode);
    }
    return mode;
  };
  const show = (): void => {
    const mode = current();
    body.replaceChildren(...mode.body);
    foot.replaceChildren(...(mode.foot ? [mode.foot] : []));
    changed();
  };

  picker.addEventListener('change', () => {
    const value = kinds.find((k) => k === picker.value);
    if (!value || value === kind) return;
    kind = value;
    config.onKind(kind);
    show();
    current().focus?.focus();
  });

  show();
  close = popover(config.anchor, panel, () => aborter.abort());
  use.addEventListener('click', () => {
    if (current().ready()) current().use();
  });
  (current().focus ?? use).focus();
}

/* ------------------------------------------------------------------ *
 * Random
 * ------------------------------------------------------------------ */

function randomMode({ config, changed, close }: ModeContext): Mode {
  const options = { ...config.options };
  const preview = h('output', { class: 'gen-preview', 'aria-live': 'polite' });
  const bits = h('span', { class: 'gen-bits' });
  const regenerate = (): void => {
    preview.textContent = generatePassword(options) || '—';
    showBits(bits, generatorBits(options));
    changed();
  };
  const controls = requirementControls(options, () => {
    regenerate();
    config.onOptions({ ...options });
  });
  const again = h('button', { type: 'button', class: 'icon-button', title: t('generator', 'Another one') }, icon(ICONS.dice));
  again.addEventListener('click', regenerate);
  regenerate();
  const value = (): string => (preview.textContent === '—' ? '' : (preview.textContent ?? ''));
  return {
    body: [h('div', { class: 'gen-row' }, preview, again), ...controls],
    foot: bits,
    ready: () => Boolean(value()),
    use: () => {
      const password = value();
      close();
      config.onUse(password);
    },
  };
}

/* ------------------------------------------------------------------ *
 * Version 3: derived from the master password
 * ------------------------------------------------------------------ */

function derivedMode({ config, changed, close }: ModeContext): Mode {
  const entry = config.entry;
  const settings: DerivedSettings = { ...REQUIREMENT_DEFAULTS, version: 1, ...entry?.derived };
  const preview = h('output', { class: 'gen-preview', 'aria-live': 'polite', text: '…' });
  const bits = h('span', { class: 'gen-bits' });
  const note = h('div', { class: 'field-note', hidden: '' });
  let password = '';
  let timer = 0;
  let turn = 0;

  // The database's master password by default; another one can be typed, and is kept nowhere.
  const master = secretInput(t('gate', 'Master password'), 'gen-v3-master');
  const session = masterSwitch(master, true, t('generator', 'Derived from the password this database was unlocked with; untick to derive from another master password'), 'gen-v3-session');
  const stored = h('span', { class: 'field-hint', text: t('derived', 'Nothing but these settings is saved; the password is computed each time.') });
  const custom = h('span', { class: 'field-hint', text: t('generator', 'With another master password the result is put in as an ordinary stored password: the entry could not compute it again.') });
  const siteInput = entry ? null : textInput(t('entry', 'Website'), '', 'gen-v3-site');
  const userInput = entry ? null : textInput(t('entry', 'User name'), '', 'gen-v3-user');
  const spec = (): DerivedSpec => ({ ...settings, site: entry ? entry.site : siteOf(siteInput?.value ?? '') });
  const user = (): string => (entry ? entry.user : (userInput?.value ?? ''));

  // Argon2 runs only when the site, user name or version changed; the requirements merely reshape its output.
  const update = (delay: number): void => {
    window.clearTimeout(timer);
    const mine = (turn += 1);
    showBits(bits, derivedBits(settings));
    password = '';
    const own = session.box.checked;
    const wrong = specProblem(spec()) ?? (own || master.input.value ? null : t('generator', 'Enter the master password to derive from'));
    custom.hidden = own || !entry;
    stored.hidden = !own || !entry;
    note.hidden = !wrong;
    note.textContent = wrong ?? '';
    preview.textContent = wrong ? '—' : '…';
    changed();
    if (wrong) return;
    const request = spec();
    const name = user();
    const typed = master.input.value;
    timer = window.setTimeout(() => {
      (own ? computePassword(request, name) : derivePassword(typed, request, name)).then(
        (result) => {
          if (mine !== turn) return;
          password = result.password;
          preview.textContent = password;
          changed();
        },
        (error: unknown) => {
          if (mine !== turn) return;
          preview.textContent = '—';
          note.hidden = false;
          note.textContent = error instanceof Error ? error.message : String(error);
        },
      );
    }, delay);
  };

  const version = h('input', { type: 'number', class: 'field-input derived-version', min: '1', max: String(VERSION_MAX), step: '1', 'aria-label': t('derived', 'Version') });
  version.value = String(settings.version);
  version.addEventListener('input', () => {
    settings.version = version.value.trim() ? Number(version.value) : NaN;
    update(400);
  });
  const next = h('button', { type: 'button', class: 'button button--small button--ghost', text: '+1', title: t('derived', 'Next version: a new password for the same site and user name') });
  next.addEventListener('click', () => {
    settings.version = Number.isInteger(settings.version) && settings.version < VERSION_MAX ? settings.version + 1 : 1;
    version.value = String(settings.version);
    update(0);
  });
  master.input.addEventListener('input', () => update(400));
  session.box.addEventListener('change', () => {
    update(0);
    if (!session.box.checked) master.input.focus();
  });
  siteInput?.addEventListener('input', () => update(400));
  userInput?.addEventListener('input', () => update(400));

  const account = entry
    ? [
        h(
          'div',
          { class: 'gen-account' },
          ...(entry.site ? [h('span', { text: t('derived', 'Site: {site}, from the website', { site: entry.site }) })] : []),
          ...(entry.user ? [h('span', { text: t('generator', 'User name: {user}, from the entry', { user: entry.user }) })] : []),
        ),
      ]
    : [labelled(t('entry', 'Website'), siteInput as HTMLInputElement), labelled(t('entry', 'User name'), userInput as HTMLInputElement)];

  update(0);
  return {
    body: [
      preview,
      note,
      session.node,
      labelled(t('gate', 'Master password'), master.node),
      ...account,
      h('div', { class: 'derived-inputs' }, h('label', { class: 'derived-input' }, h('span', { class: 'derived-caption', text: t('derived', 'Version') }), h('span', { class: 'field-inline' }, version, next))),
      ...requirementControls(settings, () => update(0)),
      ...(entry ? [stored, custom] : []),
    ],
    foot: bits,
    // From an entry, with the database's master password, the settings are enough: a missing website is asked for there.
    ready: () => (entry && session.box.checked ? !storedProblem({ ...settings, site: entry.site }) : Boolean(password)),
    use: () => {
      close();
      if (entry && session.box.checked) entry.onDerive({ ...settings });
      else config.onUse(password);
    },
    focus: session.box.checked ? (siteInput ?? undefined) : master.input,
  };
}

/* ------------------------------------------------------------------ *
 * Legacy 1
 * ------------------------------------------------------------------ */

function legacy1Mode({ config, changed, close, signal }: ModeContext): Mode {
  const master = secretInput(t('generator', 'Master key'), 'gen-l1-master');
  const identifier = textInput(t('generator', 'Identifier'), suggestedIdentifier(config), 'gen-l1-id');
  const primary = secretInput(t('generator', 'Primary key'), 'gen-l1-primary');
  const secondary = secretInput(t('generator', 'Secondary key'), 'gen-l1-secondary');
  const result = h('output', { class: 'gen-preview', 'aria-live': 'polite', text: '—' });
  let password = '';

  const recompute = (): void => {
    password = primary.input.value ? legacy1Password(primary.input.value, secondary.input.value) : '';
    result.textContent = password || '—';
    changed();
  };
  // Filled in from memory first, so that the switch below puts a kept master key aside too.
  const keepMaster = rememberToggle('legacy1-master', master);
  const keepSecondary = rememberToggle('legacy1-secondary', secondary);
  // Instead of a master key typed here, the one the database was unlocked with.
  const session = masterSwitch(master, config.usesMaster.legacy1, t('generator', 'The password this database was unlocked with is the master key: nothing to type or to keep'), 'gen-l1-session');
  const useSession = session.box;
  const masterKey = (): string => (useSession.checked ? (sessionMasterPassword() ?? '') : master.input.value);
  const compute = computeButton(t('generator', 'Compute the primary key'), signal, () => Boolean(masterKey()), async (progress, cancel) => {
    const key = await legacy1PrimaryKey(masterKey(), identifier.value, progress, cancel);
    if (key === null) return;
    primary.set(key);
    recompute();
  });
  // The key being computed is of the old inputs: stop it.
  const inputsChanged = (): void => {
    compute.cancel();
    compute.refresh();
  };
  master.input.addEventListener('input', inputsChanged);
  identifier.addEventListener('input', inputsChanged);
  // A primary key typed by hand wins over one still being computed.
  primary.input.addEventListener('input', () => {
    compute.cancel();
    recompute();
  });
  secondary.input.addEventListener('input', recompute);
  session.alsoOff(keepMaster.setDisabled);
  useSession.addEventListener('change', () => {
    config.onUsesMaster('legacy1', useSession.checked);
    inputsChanged();
    if (useSession.checked && compute.enabled()) compute.start();
    else if (!useSession.checked) master.input.focus();
  });
  compute.refresh();
  recompute();
  // The master key is at hand: the primary key is computed at once.
  if ((useSession.checked || keepMaster.restored) && compute.enabled()) compute.start();
  return {
    body: [
      session.node,
      labelled(t('generator', 'Master key'), master.node, undefined, keepMaster.node),
      labelled(t('generator', 'Identifier'), identifier),
      compute.node,
      labelled(t('generator', 'Primary key'), primary.node, t('generator', 'Tied to the identifier: kept apart from the master key, it can be typed in here directly.')),
      labelled(t('generator', 'Secondary key'), secondary.node, undefined, keepSecondary.node),
      labelled(t('generator', 'Result'), result),
    ],
    ready: () => Boolean(password),
    use: () => {
      close();
      config.onUse(password);
    },
    focus: firstEmpty(master.input, identifier, secondary.input),
  };
}

/* ------------------------------------------------------------------ *
 * Legacy 2
 * ------------------------------------------------------------------ */

function legacy2Mode({ config, changed, close, signal }: ModeContext): Mode {
  const identifier = textInput(t('generator', 'Identifier'), suggestedIdentifier(config), 'gen-l2-id');
  const primaryPhrase = secretInput(t('generator', 'Primary secret phrase'), 'gen-l2-primary');
  const keyLength = numberInput(LEGACY2_LENGTH_MIN, LEGACY2_LENGTH_MAX, LEGACY2_DEFAULTS.length, t('generator', 'Key length'));
  const keySets: Legacy2Sets = { ...LEGACY2_DEFAULTS };
  const keySign = h('output', { class: 'gen-sign', title: t('generator', 'Signature: compare it with the one the program showed') });
  const key = secretInput(t('generator', 'Key'), 'gen-l2-key');

  const secondaryPhrase = secretInput(t('generator', 'Secondary secret phrase'), 'gen-l2-secondary');
  const version = numberInput(0, LEGACY2_VERSION_MAX, 0, t('generator', 'Password version'));
  const passwordLength = numberInput(LEGACY2_LENGTH_MIN, LEGACY2_LENGTH_MAX, LEGACY2_DEFAULTS.length, t('generator', 'Password length'));
  const passwordSets: Legacy2Sets = { ...LEGACY2_DEFAULTS };
  const sign = h('output', { class: 'gen-sign', title: t('generator', 'Signature: compare it with the one the program showed') });
  const result = h('output', { class: 'gen-preview', 'aria-live': 'polite', text: '—' });
  let password = '';

  const recompute = (): void => {
    const ok = Boolean(key.input.value && secondaryPhrase.input.value);
    const out = ok ? legacy2Password(key.input.value, secondaryPhrase.input.value, version.read(), passwordLength.read(), passwordSets) : null;
    password = out?.value ?? '';
    sign.textContent = out?.sign ?? '';
    result.textContent = password || '—';
    changed();
  };
  // Filled in from memory first, so that the switch below puts a kept phrase aside too.
  const keepPrimary = rememberToggle('legacy2-primary', primaryPhrase);
  const keepSecondary = rememberToggle('legacy2-secondary', secondaryPhrase);
  // The primary phrase plays the master key: it can be the one the database was unlocked with.
  const session = masterSwitch(primaryPhrase, config.usesMaster.legacy2, t('generator', 'The password this database was unlocked with is the primary secret phrase: nothing to type or to keep'), 'gen-l2-session');
  session.alsoOff(keepPrimary.setDisabled);
  const phrase = (): string => (session.box.checked ? (sessionMasterPassword() ?? '') : primaryPhrase.input.value);
  const compute = computeButton(t('generator', 'Compute the key'), signal, () => Boolean(identifier.value && phrase()), async (progress, cancel) => {
    const out = await legacy2Key(identifier.value, phrase(), keyLength.read(), keySets, progress, cancel);
    if (!out) return;
    keySign.textContent = out.sign;
    key.set(out.value);
    recompute();
  });
  // The key being computed is of the old inputs: stop it.
  const inputsChanged = (): void => {
    compute.cancel();
    compute.refresh();
  };
  identifier.addEventListener('input', inputsChanged);
  primaryPhrase.input.addEventListener('input', inputsChanged);
  // A key typed by hand has no signature to show, and wins over one still being computed.
  key.input.addEventListener('input', () => {
    compute.cancel();
    keySign.textContent = '';
    recompute();
  });
  secondaryPhrase.input.addEventListener('input', recompute);
  version.input.addEventListener('input', recompute);
  passwordLength.input.addEventListener('input', recompute);
  session.box.addEventListener('change', () => {
    config.onUsesMaster('legacy2', session.box.checked);
    inputsChanged();
    if (session.box.checked && compute.enabled()) compute.start();
    else if (!session.box.checked) primaryPhrase.input.focus();
  });
  compute.refresh();
  recompute();
  // The primary phrase is at hand: the key is computed at once.
  if ((session.box.checked || keepPrimary.restored) && compute.enabled()) compute.start();

  return {
    body: [
      h(
        'fieldset',
        { class: 'gen-group' },
        h('legend', { text: t('generator', 'Primary protection') }),
        labelled(t('generator', 'Identifier'), identifier),
        session.node,
        labelled(t('generator', 'Primary secret phrase'), primaryPhrase.node, undefined, keepPrimary.node),
        h('div', { class: 'gen-row gen-row--wrap' }, labelled(t('generator', 'Key length'), keyLength.input), legacySets(keySets, () => {})),
        compute.node,
        labelled(t('generator', 'Key'), h('span', { class: 'field-inline' }, keySign, key.node)),
      ),
      h(
        'fieldset',
        { class: 'gen-group' },
        h('legend', { text: t('generator', 'Secondary protection') }),
        labelled(t('generator', 'Secondary secret phrase'), secondaryPhrase.node, undefined, keepSecondary.node),
        h('div', { class: 'gen-row gen-row--wrap' }, labelled(t('generator', 'Password version'), version.input), labelled(t('generator', 'Password length'), passwordLength.input)),
        legacySets(passwordSets, recompute),
      ),
      labelled(t('generator', 'Result'), h('span', { class: 'field-inline' }, sign, result)),
    ],
    ready: () => Boolean(password),
    use: () => {
      close();
      config.onUse(password);
    },
    focus: firstEmpty(identifier, primaryPhrase.input, secondaryPhrase.input),
  };
}

/** The first input still to fill in, or the first that can be. */
function firstEmpty(...inputs: [HTMLInputElement, ...HTMLInputElement[]]): HTMLInputElement {
  const open = inputs.filter((input) => !input.disabled);
  return open.find((input) => !input.value) ?? open[0] ?? inputs[0];
}

/**
 * "Use the database's master password" over a master password field: while
 * ticked the field is off and what was typed put aside; unticked, it is back.
 * Off, and unticked, when the database opens with a key file alone.
 */
function masterSwitch(field: SecretInput, checked: boolean, title: string, name: string): { node: HTMLElement; box: HTMLInputElement; alsoOff(off: (disabled: boolean) => void): void } {
  const available = sessionMasterPassword() !== null;
  const box = h('input', { type: 'checkbox', 'data-field': name });
  box.checked = checked && available;
  box.disabled = !available;
  const others: ((disabled: boolean) => void)[] = [];
  let typed = '';
  const paint = (): void => {
    const on = box.checked;
    if (on) {
      typed = field.input.value || typed;
      field.set('');
    } else if (!field.input.value) field.set(typed);
    field.setDisabled(on);
    field.input.placeholder = on ? t('generator', 'The database\'s master password') : '';
    for (const off of others) off(on);
  };
  // Before any other listener, so they see the field as it is now.
  box.addEventListener('change', paint);
  paint();
  return {
    node: h(
      'label',
      { class: 'gen-remember gen-remember--session', title: available ? title : t('derived', 'Needs a master password, and this database opens with a key file alone') },
      box,
      h('span', { text: t('generator', 'Use the database\'s master password') }),
    ),
    box,
    alsoOff(off) {
      others.push(off);
      off(box.checked);
    },
  };
}

/** The identifier an entry suggests; it stays editable. */
function suggestedIdentifier(config: GeneratorPanelOptions): string {
  return config.entry ? legacyIdentifier(config.entry.user, config.entry.site) : '';
}

/**
 * "Remember until the database locks" under one phrase: it is filled in from
 * memory when kept before, and kept up to date while the box is ticked.
 */
function rememberToggle(name: LegacySecret, secret: SecretInput): { node: HTMLElement; restored: boolean; setDisabled(disabled: boolean): void } {
  const kept = rememberedLegacySecret(name);
  if (kept !== null) secret.set(kept);
  const box = h('input', { type: 'checkbox', 'data-remember': name });
  box.checked = kept !== null;
  box.addEventListener('change', () => rememberLegacySecret(name, box.checked ? secret.input.value : null));
  secret.input.addEventListener('input', () => box.checked && rememberLegacySecret(name, secret.input.value));
  const node = h(
    'label',
    { class: 'gen-remember', title: t('generator', 'Kept in the memory of this page only, never written to disk; locking the database forgets it.') },
    box,
    h('span', { text: t('generator', 'Remember until the database locks') }),
  );
  return {
    node,
    restored: kept !== null,
    setDisabled(disabled: boolean) {
      box.disabled = disabled;
    },
  };
}

/** Legacy 2's sets: digits are always in, the others are toggles; `sets` changes in place. */
function legacySets(sets: Legacy2Sets, onChange: () => void): HTMLElement {
  const checks = h('div', { class: 'gen-checks' });
  const items: [keyof Legacy2Sets | null, string, string][] = [
    ['upper', 'A–Z', t('generator', 'Capital letters')],
    ['lower', 'a–z', t('generator', 'Small letters')],
    [null, '0–9', t('generator', 'Digits are always included')],
    ['symbols', "!#$'", t('generator', 'Symbols')],
  ];
  for (const [key, label, title] of items) {
    const box = h('input', { type: 'checkbox' });
    box.checked = key ? sets[key] : true;
    box.disabled = !key;
    box.addEventListener('change', () => {
      if (!key) return;
      sets[key] = box.checked;
      onChange();
    });
    checks.append(h('label', { class: 'gen-check', title }, box, h('span', { text: label })));
  }
  return checks;
}

/* ------------------------------------------------------------------ *
 * Shared controls
 * ------------------------------------------------------------------ */

function showBits(node: HTMLElement, bits: number): void {
  node.textContent = bits ? tn('generator', '{count} bit', '{count} bits', bits) : t('generator', 'pick at least one set');
  node.dataset['level'] = bitsLevel(bits);
}

/** Colour step for an entropy in bits, as the generator shows it. */
export function bitsLevel(bits: number): string {
  return bits < 50 ? '1' : bits < 80 ? '2' : bits < 110 ? '3' : '4';
}

function textInput(label: string, value: string, name: string): HTMLInputElement {
  const node = h('input', { class: 'field-input', spellcheck: 'false', autocomplete: 'off', 'aria-label': label, 'data-field': name });
  node.value = value;
  return node;
}

interface SecretInput {
  input: HTMLInputElement;
  node: HTMLElement;
  set(value: string): void;
  setDisabled(disabled: boolean): void;
}

/** A masked input with its layout badge and a show/hide button. */
function secretInput(label: string, name: string): SecretInput {
  const input = textInput(label, '', name);
  input.classList.add('field-input--secret');
  const layer = maskInput(input);
  const badge = h('span', { class: 'layout-badge' });
  const updateLayout = bindLayoutBadge(input, badge);
  const reveal = h('button', { type: 'button', class: 'icon-button icon-button--small' });
  let shown = false;
  const paint = (): void => {
    setRevealed(input, shown);
    reveal.title = shown ? t('entry', 'Hide') : t('entry', 'Show');
    reveal.replaceChildren(icon(shown ? ICONS.eyeOff : ICONS.eye));
  };
  reveal.addEventListener('click', () => {
    shown = !shown;
    paint();
  });
  paint();
  return {
    input,
    node: h('span', { class: 'field-inline' }, h('span', { class: 'secret-field' }, input, layer, badge), reveal),
    set(value: string) {
      input.value = value;
      paint();
      updateLayout();
    },
    setDisabled(disabled: boolean) {
      input.disabled = disabled;
      reveal.disabled = disabled;
    },
  };
}

function numberInput(min: number, max: number, value: number, label: string): { input: HTMLInputElement; read(): number } {
  const input = h('input', { type: 'number', class: 'field-input gen-number', min: String(min), max: String(max), step: '1', 'aria-label': label });
  input.value = String(value);
  const read = (): number => {
    const number = Math.floor(Number(input.value));
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min;
  };
  input.addEventListener('change', () => (input.value = String(read())));
  return { input, read };
}

/** A caption over a control. No <label>: with several controls in one, a click on the text would press the first. */
function labelled(caption: string, control: HTMLElement, hint?: string, extra?: HTMLElement): HTMLElement {
  return h(
    'div',
    { class: 'gen-field' },
    h('span', { class: 'derived-caption', text: caption }),
    control,
    ...(hint ? [h('span', { class: 'field-hint', text: hint })] : []),
    ...(extra ? [extra] : []),
  );
}

/**
 * A button for a long computation, with its progress. `enabled` says whether
 * the inputs allow it; a second press starts over.
 */
function computeButton(
  label: string,
  signal: AbortSignal,
  enabled: () => boolean,
  run: (progress: (share: number) => void, cancel: AbortSignal) => Promise<void>,
): { node: HTMLElement; refresh(): void; enabled(): boolean; start(): void; cancel(): void } {
  const button = h('button', { type: 'button', class: 'button button--small', text: label });
  const bar = h('progress', { class: 'gen-progress', max: '1', value: '0', hidden: '' });
  let running: AbortController | null = null;
  const refresh = (): void => {
    button.disabled = !enabled();
  };
  const start = async (): Promise<void> => {
    running?.abort();
    const mine = new AbortController();
    running = mine;
    signal.addEventListener('abort', () => mine.abort(), { once: true });
    bar.value = 0;
    bar.hidden = false;
    try {
      await run((share) => (bar.value = share), mine.signal);
    } finally {
      if (running === mine) {
        running = null;
        bar.hidden = true;
      }
    }
  };
  button.addEventListener('click', () => void start());
  refresh();
  return {
    node: h('div', { class: 'gen-row gen-row--compute' }, button, bar),
    refresh,
    enabled,
    start: () => void start(),
    cancel: () => running?.abort(),
  };
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
