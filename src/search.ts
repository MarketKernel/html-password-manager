/** Filtering and sorting the entry list. */

import { t } from './i18n';
import { customFields, field, isProtected, type Entry } from './kdbx';

export type SortKey = 'title' | 'username' | 'url' | 'modified' | 'created';

export const SORT_KEYS: readonly SortKey[] = ['title', 'username', 'url', 'modified', 'created'];

export function sortLabel(key: SortKey): string {
  const labels: Record<SortKey, string> = {
    title: t('list', 'Title'),
    username: t('list', 'User name'),
    url: t('list', 'Website'),
    modified: t('list', 'Last modified'),
    created: t('list', 'Created'),
  };
  return labels[key];
}

/**
 * Every word of the query must turn up somewhere in the entry: the title, user
 * name, URL, notes, tags, or a custom field's name or value. Protected values —
 * the password above all — are never searched, as in KeePass and KeeWeb.
 */
export function matches(entry: Entry, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = searchText(entry);
  return words.every((word) => haystack.includes(word));
}

function searchText(entry: Entry): string {
  const parts = [field(entry, 'Title'), field(entry, 'UserName'), field(entry, 'URL'), field(entry, 'Notes')];
  parts.push(...entry.tags.map((tag) => `#${tag}`));
  for (const name of customFields(entry)) {
    parts.push(name);
    if (!isProtected(entry, name)) parts.push(field(entry, name));
  }
  for (const name of entry.binaries.keys()) parts.push(name);
  return parts.join('\n').toLowerCase();
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function sortEntries(entries: Entry[], key: SortKey): Entry[] {
  const time = (entry: Entry, which: 'lastModTime' | 'creationTime'): number => entry.times[which]?.getTime() ?? 0;
  const byTitle = (a: Entry, b: Entry): number => collator.compare(field(a, 'Title'), field(b, 'Title'));
  const compare: Record<SortKey, (a: Entry, b: Entry) => number> = {
    title: byTitle,
    username: (a, b) => collator.compare(field(a, 'UserName'), field(b, 'UserName')) || byTitle(a, b),
    url: (a, b) => collator.compare(hostOf(field(a, 'URL')), hostOf(field(b, 'URL'))) || byTitle(a, b),
    modified: (a, b) => time(b, 'lastModTime') - time(a, 'lastModTime') || byTitle(a, b),
    created: (a, b) => time(b, 'creationTime') - time(a, 'creationTime') || byTitle(a, b),
  };
  return entries.sort(compare[key]);
}

/** `https://www.example.com/login` → `example.com`; anything unparsable comes back as is. */
export function hostOf(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return parsed.hostname.replace(/^www\./, '') || trimmed;
  } catch {
    return trimmed;
  }
}

/** Only these schemes become clickable links; `javascript:` and friends stay text. */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    return ['http:', 'https:', 'ftp:', 'mailto:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}
