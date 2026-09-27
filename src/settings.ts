/** Language, theme, panel and security preferences, remembered in localStorage between sessions. */

import { GENERATOR_DEFAULTS, GENERATOR_KINDS, LENGTH_MAX, LENGTH_MIN, type GeneratorKind, type GeneratorOptions } from './generator';
import { detectLanguage, isLanguage, type Language } from './i18n';
import type { SortKey } from './search';

export type Theme = 'system' | 'light' | 'dark';

export type LegacyUsesMaster = Record<'legacy1' | 'legacy2', boolean>;

export interface Settings {
  /** 'auto' follows the browser's languages. */
  language: Language | 'auto';
  theme: Theme;
  /** Width of the group panel. */
  sidebar: number;
  sidebarHidden: boolean;
  /** Width of the entry list. */
  list: number;
  sort: SortKey;
  /** Lock after this many idle minutes; 0 — never. */
  lockMinutes: number;
  /** Clear a copied secret from the clipboard after this many seconds; 0 — never. */
  clipboardSeconds: number;
  /** Write the file shortly after every change, when it can be written in place. */
  autosave: boolean;
  generator: GeneratorOptions;
  /** The kind of password the generator opens with. */
  generatorKind: GeneratorKind;
  /** The generator offers the legacy algorithms, legacy 1 and legacy 2. */
  showLegacy: boolean;
  /** Legacy 1 takes the database's master password as its master key, legacy 2 as its primary secret phrase. */
  legacyUsesMaster: LegacyUsesMaster;
  /** Collapsed groups, by UUID. */
  collapsed: string[];
  /** The recycle bin's deleted groups are shown; folded unless asked. */
  binOpen: boolean;
}

const KEY = 'html-password-manager';

export const LOCK_CHOICES = [0, 1, 5, 10, 15, 30, 60];
export const CLIPBOARD_CHOICES = [0, 10, 20, 30, 60, 120];

const DEFAULTS: Settings = {
  language: 'auto',
  theme: 'system',
  sidebar: 250,
  sidebarHidden: false,
  list: 340,
  sort: 'title',
  lockMinutes: 15,
  clipboardSeconds: 30,
  autosave: true,
  generator: { ...GENERATOR_DEFAULTS },
  generatorKind: 'v3',
  showLegacy: false,
  legacyUsesMaster: { legacy1: false, legacy2: false },
  collapsed: [],
  binOpen: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const stored = JSON.parse(raw) as Partial<Settings>;
    const generator = { ...GENERATOR_DEFAULTS, ...stored.generator };
    generator.length = Math.min(LENGTH_MAX, Math.max(LENGTH_MIN, Number(generator.length) || GENERATOR_DEFAULTS.length));
    return {
      ...DEFAULTS,
      ...stored,
      language: isLanguage(stored.language) ? stored.language : 'auto',
      sidebar: clampWidth(stored.sidebar, DEFAULTS.sidebar, 160, 480),
      list: clampWidth(stored.list, DEFAULTS.list, 220, 640),
      lockMinutes: LOCK_CHOICES.includes(Number(stored.lockMinutes)) ? Number(stored.lockMinutes) : DEFAULTS.lockMinutes,
      clipboardSeconds: CLIPBOARD_CHOICES.includes(Number(stored.clipboardSeconds))
        ? Number(stored.clipboardSeconds)
        : DEFAULTS.clipboardSeconds,
      generator,
      generatorKind: GENERATOR_KINDS.includes(stored.generatorKind as GeneratorKind) ? (stored.generatorKind as GeneratorKind) : DEFAULTS.generatorKind,
      showLegacy: stored.showLegacy === true,
      legacyUsesMaster: usesMasterOf(stored.legacyUsesMaster),
      collapsed: Array.isArray(stored.collapsed) ? stored.collapsed : [],
      binOpen: stored.binOpen === true,
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode or a full quota — the manager works either way */
  }
}

/** Once a single flag for legacy 1 alone. */
function usesMasterOf(value: unknown): LegacyUsesMaster {
  if (typeof value === 'boolean') return { legacy1: value, legacy2: false };
  const flags = (value ?? {}) as Partial<LegacyUsesMaster>;
  return { legacy1: flags.legacy1 === true, legacy2: flags.legacy2 === true };
}

function clampWidth(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

/** The language the interface is shown in. */
export function resolveLanguage(choice: Settings['language']): Language {
  return choice === 'auto' ? detectLanguage() : choice;
}

export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
  document.documentElement.dataset['themeMode'] = theme;
}

export function applyPanels(settings: Settings): void {
  document.documentElement.style.setProperty('--sidebar', `${settings.sidebar}px`);
  document.documentElement.style.setProperty('--list', `${settings.list}px`);
  document.body.classList.toggle('sidebar-hidden', settings.sidebarHidden);
}
