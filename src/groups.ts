/**
 * The left panel: all entries, the group tree, tags and the recycle bin.
 * Entries and groups can be dragged onto a group to move them, or onto the
 * recycle bin to delete them.
 */

import { groupIcon } from './avatar';
import { isRightToLeft, t } from './i18n';
import { allTags, entriesBelow, inRecycleBin, recycleBin, uuidOf, type Group, type Kdbx } from './kdbx';
import { h, icon, ICONS, menu, type MenuItem } from './ui';

export type Selection =
  | { kind: 'all' }
  | { kind: 'group'; uuid: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'trash' };

export const DRAG_ENTRY = 'application/x-kdbx-entry';
export const DRAG_GROUP = 'application/x-kdbx-group';

export interface SidebarHost {
  onSelect(selection: Selection): void;
  onNewEntry(group: Group): void;
  onNewGroup(parent: Group): void;
  onRename(group: Group): void;
  onDelete(group: Group): void;
  onRestore(group: Group): void;
  onEmptyTrash(): void;
  onMoveEntry(uuid: string, target: Group | 'trash'): void;
  onMoveGroup(uuid: string, target: Group | 'trash'): void;
  onCollapse(): void;
  canEdit(): boolean;
}

export function sameSelection(a: Selection, b: Selection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'group' && b.kind === 'group') return a.uuid === b.uuid;
  if (a.kind === 'tag' && b.kind === 'tag') return a.tag === b.tag;
  return true;
}

export class Sidebar {
  private db: Kdbx | null = null;
  private selection: Selection = { kind: 'all' };
  private collapsed = new Set<string>();

  constructor(
    private readonly root: HTMLElement,
    private readonly host: SidebarHost,
  ) {
    root.addEventListener('click', this.onClick);
    root.addEventListener('dblclick', this.onDoubleClick);
    root.addEventListener('contextmenu', this.onContextMenu);
    root.addEventListener('dragstart', this.onDragStart);
    root.addEventListener('dragover', this.onDragOver);
    root.addEventListener('dragleave', this.onDragLeave);
    root.addEventListener('drop', this.onDrop);
  }

  setDatabase(db: Kdbx | null): void {
    this.db = db;
    this.render();
  }

  setSelection(selection: Selection): void {
    this.selection = selection;
    if (selection.kind === 'group') this.expandTo(selection.uuid);
    this.render();
    this.root.querySelector('.tree-item--active')?.scrollIntoView({ block: 'nearest' });
  }

  getSelection(): Selection {
    return this.selection;
  }

  setCollapsed(uuids: readonly string[]): void {
    this.collapsed = new Set(uuids);
  }

  getCollapsed(): string[] {
    return Array.from(this.collapsed);
  }

  private expandTo(uuid: string): void {
    const group = this.db?.getGroup(uuid);
    for (let node = group?.parentGroup; node; node = node.parentGroup) this.collapsed.delete(uuidOf(node));
  }

  render(): void {
    const db = this.db;
    if (!db) {
      this.root.replaceChildren();
      return;
    }
    const top = db.getDefaultGroup();
    const bin = recycleBin(db);
    const out = h('div', { class: 'tree-inner' });

    out.append(
      this.row({
        kind: 'all',
        label: t('sidebar', 'All entries'),
        count: entriesBelow(db, top).length,
        mark: icon(ICONS.list),
        active: this.selection.kind === 'all',
      }),
    );

    out.append(h('div', { class: 'sidebar-heading', text: t('sidebar', 'Groups') }));
    out.append(this.groupList([top], 0, bin));

    const tags = allTags(db);
    if (tags.size > 0) {
      out.append(h('div', { class: 'sidebar-heading', text: t('sidebar', 'Tags') }));
      for (const [tag, count] of tags) {
        out.append(
          this.row({
            kind: 'tag',
            tag,
            label: tag,
            count,
            mark: icon(ICONS.tag),
            active: this.selection.kind === 'tag' && this.selection.tag === tag,
          }),
        );
      }
    }

    if (bin) {
      out.append(h('div', { class: 'sidebar-spacer' }));
      const count = entriesBelow(db, bin).length + countGroups(bin);
      out.append(
        this.row({
          kind: 'trash',
          label: t('sidebar', 'Recycle bin'),
          count,
          mark: icon(ICONS.trash),
          active: this.selection.kind === 'trash',
          drop: true,
        }),
      );
      // Deleted groups keep their shape inside the bin, so they can be restored whole.
      if (bin.groups.length) out.append(this.groupList(bin.groups, 1, null));
    }
    this.root.replaceChildren(out);
  }

  private groupList(groups: readonly Group[], depth: number, bin: Group | null): HTMLElement {
    const list = h('ul', { class: 'tree-list' });
    for (const group of groups) {
      if (group === bin) continue;
      const uuid = uuidOf(group);
      const children = group.groups.filter((child) => child !== bin);
      const open = depth === 0 || !this.collapsed.has(uuid);
      const item = h('li', { class: 'tree-node' });
      const caret = h('span', { class: 'tree-caret', 'data-toggle': uuid, text: children.length ? (open ? '▾' : isRightToLeft() ? '◂' : '▸') : '' });
      const row = this.row({
        kind: 'group',
        uuid,
        label: group.name || t('sidebar', '(unnamed)'),
        count: this.db ? entriesBelow(this.db, group).length : 0,
        mark: groupIcon(this.db as Kdbx, group),
        active: this.selection.kind === 'group' && this.selection.uuid === uuid,
        depth,
        caret: depth === 0 ? null : caret,
        drop: true,
        drag: depth > 0,
      });
      item.append(row);
      if (children.length && open) item.append(this.groupList(children, depth + 1, bin));
      list.append(item);
    }
    return list;
  }

  private row(options: {
    kind: Selection['kind'];
    label: string;
    count: number;
    mark: Element;
    active: boolean;
    uuid?: string;
    tag?: string;
    depth?: number;
    caret?: HTMLElement | null;
    drop?: boolean;
    drag?: boolean;
  }): HTMLElement {
    const row = h('div', { class: `tree-item tree-item--${options.kind}`, title: options.label });
    if (options.active) row.classList.add('tree-item--active');
    row.dataset['kind'] = options.kind;
    if (options.uuid) row.dataset['uuid'] = options.uuid;
    if (options.tag) row.dataset['tag'] = options.tag;
    if (options.drop) row.dataset['drop'] = '';
    if (options.drag && this.host.canEdit()) row.draggable = true;
    row.style.paddingInlineStart = `${6 + (options.depth ?? 0) * 14}px`;
    options.mark.classList.add('tree-icon');
    row.append(
      options.caret ?? h('span', { class: 'tree-caret' }),
      options.mark,
      h('span', { class: 'tree-label', text: options.label }),
      h('span', { class: 'tree-count', text: options.count ? String(options.count) : '' }),
    );
    return row;
  }

  private selectionOf(row: HTMLElement): Selection | null {
    switch (row.dataset['kind']) {
      case 'all':
        return { kind: 'all' };
      case 'trash':
        return { kind: 'trash' };
      case 'tag':
        return { kind: 'tag', tag: row.dataset['tag'] ?? '' };
      case 'group':
        return { kind: 'group', uuid: row.dataset['uuid'] ?? '' };
      default:
        return null;
    }
  }

  private readonly onClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const toggle = target?.closest<HTMLElement>('[data-toggle]');
    if (toggle && toggle.textContent) {
      const uuid = toggle.dataset['toggle'] ?? '';
      if (this.collapsed.has(uuid)) this.collapsed.delete(uuid);
      else this.collapsed.add(uuid);
      this.host.onCollapse();
      this.render();
      return;
    }
    const row = target?.closest<HTMLElement>('.tree-item');
    const selection = row ? this.selectionOf(row) : null;
    if (selection) this.host.onSelect(selection);
  };

  private readonly onDoubleClick = (event: MouseEvent): void => {
    const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('.tree-item--group');
    const uuid = row?.dataset['uuid'];
    if (!uuid || row?.querySelector('.tree-caret')?.textContent === '') return;
    if (this.collapsed.has(uuid)) this.collapsed.delete(uuid);
    else this.collapsed.add(uuid);
    this.host.onCollapse();
    this.render();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    const db = this.db;
    if (!db || !this.host.canEdit()) return;
    const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('.tree-item');
    event.preventDefault();
    if (row?.dataset['kind'] === 'trash') {
      menu(event.clientX, event.clientY, [{ label: t('menu', 'Empty recycle bin'), danger: true, action: () => this.host.onEmptyTrash() }]);
      return;
    }
    const group = row?.dataset['uuid'] ? db.getGroup(row.dataset['uuid']) : db.getDefaultGroup();
    if (!group) return;
    if (inRecycleBin(db, group)) {
      menu(event.clientX, event.clientY, [
        { label: t('menu', 'Restore group'), action: () => this.host.onRestore(group) },
        { label: t('menu', 'Delete permanently'), danger: true, action: () => this.host.onDelete(group) },
      ]);
      return;
    }
    const items: MenuItem[] = [
      { label: t('menu', 'New entry here'), action: () => this.host.onNewEntry(group) },
      { label: t('menu', 'New group inside'), action: () => this.host.onNewGroup(group) },
      { label: t('menu', 'Rename'), action: () => this.host.onRename(group), separated: true },
    ];
    if (group.parentGroup) items.push({ label: t('menu', 'Delete group'), danger: true, action: () => this.host.onDelete(group) });
    menu(event.clientX, event.clientY, items);
  };

  private readonly onDragStart = (event: DragEvent): void => {
    const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('.tree-item--group');
    const uuid = row?.dataset['uuid'];
    if (!uuid || !event.dataTransfer) return;
    event.dataTransfer.setData(DRAG_GROUP, uuid);
    event.dataTransfer.effectAllowed = 'move';
  };

  private dropRow(event: DragEvent): HTMLElement | null {
    const types = event.dataTransfer?.types ?? [];
    if (!types.includes(DRAG_ENTRY) && !types.includes(DRAG_GROUP)) return null;
    return (event.target as HTMLElement | null)?.closest<HTMLElement>('.tree-item[data-drop]') ?? null;
  }

  private readonly onDragOver = (event: DragEvent): void => {
    const row = this.dropRow(event);
    if (!row || !this.host.canEdit()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    for (const other of this.root.querySelectorAll('.tree-item--drop')) if (other !== row) other.classList.remove('tree-item--drop');
    row.classList.add('tree-item--drop');
  };

  private readonly onDragLeave = (event: DragEvent): void => {
    const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('.tree-item');
    if (row && !row.contains(event.relatedTarget as Node | null)) row.classList.remove('tree-item--drop');
  };

  private readonly onDrop = (event: DragEvent): void => {
    const row = this.dropRow(event);
    row?.classList.remove('tree-item--drop');
    if (!row || !this.db || !event.dataTransfer) return;
    event.preventDefault();
    const target = row.dataset['kind'] === 'trash' ? 'trash' : this.db.getGroup(row.dataset['uuid'] ?? '');
    if (!target) return;
    const entry = event.dataTransfer.getData(DRAG_ENTRY);
    const group = event.dataTransfer.getData(DRAG_GROUP);
    if (entry) this.host.onMoveEntry(entry, target);
    else if (group) this.host.onMoveGroup(group, target);
  };
}

function countGroups(group: Group): number {
  let total = 0;
  for (const child of group.groups) total += 1 + countGroups(child);
  return total;
}
