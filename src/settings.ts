/** Language, theme, zoom, panel and security preferences, remembered in localStorage between sessions. */

import { GENERATOR_DEFAULTS, LENGTH_MAX, LENGTH_MIN, type GeneratorOptions } from './generator';
import { detectLanguage, isLanguage, type Language } from './i18n';
import type { SortKey } from './search';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  /** 'auto' follows the browser's languages. */
  language: Language | 'auto';
  theme: Theme;
  /** Percent; the list and the entry scale, the chrome does not. */
  zoom: number;
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
  /** Collapsed groups, by UUID. */
  collapsed: string[];
}

const KEY = 'html-password-manager';

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 10;
export const LOCK_CHOICES = [0, 1, 5, 10, 15, 30, 60];
export const CLIPBOARD_CHOICES = [0, 10, 20, 30, 60, 120];

const DEFAULTS: Settings = {
  language: 'auto',
  theme: 'system',
  zoom: 100,
  sidebar: 250,
  sidebarHidden: false,
  list: 340,
  sort: 'title',
  lockMinutes: 15,
  clipboardSeconds: 30,
  autosave: true,
  generator: { ...GENERATOR_DEFAULTS },
  collapsed: [],
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
      zoom: clampZoom(Number(stored.zoom ?? DEFAULTS.zoom)),
      sidebar: clampWidth(stored.sidebar, DEFAULTS.sidebar, 160, 480),
      list: clampWidth(stored.list, DEFAULTS.list, 220, 640),
      lockMinutes: LOCK_CHOICES.includes(Number(stored.lockMinutes)) ? Number(stored.lockMinutes) : DEFAULTS.lockMinutes,
      clipboardSeconds: CLIPBOARD_CHOICES.includes(Number(stored.clipboardSeconds))
        ? Number(stored.clipboardSeconds)
        : DEFAULTS.clipboardSeconds,
      generator,
      collapsed: Array.isArray(stored.collapsed) ? stored.collapsed : [],
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

function clampWidth(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULTS.zoom;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom / 5) * 5));
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

export function applyZoom(zoom: number): void {
  document.documentElement.style.setProperty('--zoom', String(zoom / 100));
}

export function applyPanels(settings: Settings): void {
  document.documentElement.style.setProperty('--sidebar', `${settings.sidebar}px`);
  document.documentElement.style.setProperty('--list', `${settings.list}px`);
  document.body.classList.toggle('sidebar-hidden', settings.sidebarHidden);
}
