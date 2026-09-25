/** The middle column: the entries of the chosen group, tag or search. */

import { entryAvatar } from './avatar';
import { DRAG_ENTRY } from './groups';
import { t } from './i18n';
import { field, groupPath, titleOf, uuidOf, type Entry, type Kdbx } from './kdbx';
import { hostOf } from './search';
import { h } from './ui';

export interface ListHost {
  onSelect(entry: Entry): void;
  onContextMenu(entry: Entry, x: number, y: number): void;
  canEdit(): boolean;
}

export class EntryList {
  private entries: Entry[] = [];
  private db: Kdbx | null = null;
  private active: string | null = null;
  private showPath = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly empty: HTMLElement,
    private readonly host: ListHost,
  ) {
    root.addEventListener('click', this.onClick);
    root.addEventListener('contextmenu', this.onContextMenu);
    root.addEventListener('dragstart', this.onDragStart);
  }

  /** `showPath` adds the group to each row — for views that mix groups. */
  setEntries(db: Kdbx | null, entries: Entry[], showPath: boolean, emptyText: string): void {
    this.db = db;
    this.entries = entries;
    this.showPath = showPath;
    this.empty.textContent = emptyText;
    this.render();
  }

  get items(): readonly Entry[] {
    return this.entries;
  }

  setActive(uuid: string | null): void {
    this.active = uuid;
    for (const row of this.root.querySelectorAll<HTMLElement>('.entry')) {
      row.classList.toggle('entry--active', row.dataset['uuid'] === uuid);
      row.setAttribute('aria-selected', String(row.dataset['uuid'] === uuid));
    }
    this.root.querySelector('.entry--active')?.scrollIntoView({ block: 'nearest' });
  }

  /** The entry `delta` rows away from the active one, clamped to the list. */
  neighbour(delta: number): Entry | null {
    if (this.entries.length === 0) return null;
    const index = this.entries.findIndex((entry) => uuidOf(entry) === this.active);
    const next = index < 0 ? (delta > 0 ? 0 : this.entries.length - 1) : index + delta;
    return this.entries[Math.max(0, Math.min(this.entries.length - 1, next))] ?? null;
  }

  render(): void {
    const db = this.db;
    this.empty.hidden = this.entries.length > 0 || !db;
    if (!db) {
      this.root.replaceChildren();
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const entry of this.entries) {
      const uuid = uuidOf(entry);
      const user = field(entry, 'UserName');
      const host = hostOf(field(entry, 'URL'));
      const sub = [user, host].filter(Boolean).join(' · ');
      const row = h(
        'div',
        { class: 'entry', role: 'option', 'aria-selected': String(uuid === this.active) },
        entryAvatar(db, entry),
        h(
          'div',
          { class: 'entry-text' },
          h('div', { class: 'entry-title', text: titleOf(entry) }),
          // No second line at all when there is nothing for it: the title then sits centred.
          sub ? h('div', { class: 'entry-sub', text: sub }) : null,
        ),
      );
      if (this.showPath) {
        const path = groupPath(entry.parentGroup).join(' › ');
        if (path) row.append(h('span', { class: 'entry-path', text: path }));
      }
      if (entry.times.expires && entry.times.expiryTime && entry.times.expiryTime.getTime() < Date.now()) {
        row.classList.add('entry--expired');
        row.title = t('list', 'Expired');
      }
      if (uuid === this.active) row.classList.add('entry--active');
      row.dataset['uuid'] = uuid;
      row.draggable = this.host.canEdit();
      fragment.append(row);
    }
    this.root.replaceChildren(fragment);
  }

  private find(target: EventTarget | null): Entry | null {
    const row = (target as HTMLElement | null)?.closest<HTMLElement>('.entry');
    const uuid = row?.dataset['uuid'];
    return this.entries.find((entry) => uuidOf(entry) === uuid) ?? null;
  }

  private readonly onClick = (event: MouseEvent): void => {
    const entry = this.find(event.target);
    if (entry) this.host.onSelect(entry);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    const entry = this.find(event.target);
    if (!entry) return;
    event.preventDefault();
    this.host.onSelect(entry);
    this.host.onContextMenu(entry, event.clientX, event.clientY);
  };

  private readonly onDragStart = (event: DragEvent): void => {
    const entry = this.find(event.target);
    if (!entry || !event.dataTransfer) return;
    event.dataTransfer.setData(DRAG_ENTRY, uuidOf(entry));
    event.dataTransfer.effectAllowed = 'move';
  };
}
