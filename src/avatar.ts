/**
 * The small square beside an entry or a group: the database's own custom icon
 * when it has one, otherwise the first letter of the title on a colour taken
 * from the title (or from the entry's KeePass background colour).
 */

import { customIcon, field, type Entry, type Group, type Kdbx } from './kdbx';
import { h, icon, ICONS } from './ui';

const urls = new Map<string, string>();

/** Custom icons become blob: URLs; lock drops them with the database. */
export function releaseIcons(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}

function iconUrl(db: Kdbx, object: Entry | Group): string | null {
  const id = object.customIcon?.id;
  if (!id) return null;
  const cached = urls.get(id);
  if (cached) return cached;
  const data = customIcon(db, object);
  if (!data) return null;
  const url = URL.createObjectURL(new Blob([data], { type: sniff(new Uint8Array(data)) }));
  urls.set(id, url);
  return url;
}

function sniff(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  if (bytes[0] === 0x3c) return 'image/svg+xml';
  return 'image/x-icon';
}

/** A stable hue per title (FNV-1a), so an entry keeps its colour between sessions. */
function hue(text: string): number {
  let hash = 0x811c9dc5;
  for (const char of text) hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  return hash % 360;
}

export function entryAvatar(db: Kdbx, entry: Entry, size: 'small' | 'large' = 'small'): HTMLElement {
  const box = h('span', { class: `avatar avatar--${size}`, 'aria-hidden': 'true' });
  const url = iconUrl(db, entry);
  if (url) {
    box.classList.add('avatar--image');
    box.append(h('img', { src: url, alt: '' }));
    return box;
  }
  const title = field(entry, 'Title').trim();
  const letter = Array.from(title)[0]?.toUpperCase() ?? '';
  if (letter) box.textContent = letter;
  else box.append(icon(ICONS.key));
  if (entry.bgColor && /^#[0-9a-f]{6}$/i.test(entry.bgColor)) box.style.setProperty('--avatar', entry.bgColor);
  else box.style.setProperty('--avatar-hue', String(hue(title || entry.uuid.id)));
  return box;
}

export function groupIcon(db: Kdbx, group: Group, paths = ICONS.folder): HTMLElement {
  const url = iconUrl(db, group);
  if (url) return h('img', { class: 'tree-icon tree-icon--image', src: url, alt: '' });
  const svg = icon(paths);
  svg.classList.add('tree-icon');
  return svg as unknown as HTMLElement;
}
