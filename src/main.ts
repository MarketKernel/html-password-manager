/**
 * Wiring: the unlock gate, the group tree, the entry list and the entry
 * itself, saving, locking, and the chrome around them — language, theme,
 * zoom, panel widths, the generator and keyboard shortcuts.
 */

import { releaseIcons } from './avatar';
import { clearClipboard, copyText } from './clipboard';
import { entryPassword, parseDerived, setMasterPassword } from './derived';
import { Details } from './details';
import {
  BlobFile,
  canWriteInPlace,
  download,
  fileFromDrop,
  forgetFile,
  HandleFile,
  NewFile,
  pickFile,
  pickSaveTarget,
  recentFiles,
  rememberFile,
  type DbFile,
} from './files';
import { openGenerator } from './genpanel';
import { Sidebar, type Selection } from './groups';
import { isRightToLeft, LANGUAGES, setLanguage, t, tn, translatePage, type Language } from './i18n';
import {
  canMoveGroup,
  changeCredentials,
  cloneEntry,
  createDatabase,
  createEntry,
  createGroup,
  describeError,
  describeFormat,
  emptyRecycleBin,
  entriesBelow,
  field,
  inRecycleBin,
  isInside,
  makeValue,
  openDatabase,
  recycleBin,
  remove,
  restore,
  saveDatabase,
  titleOf,
  uuidOf,
  type Entry,
  type Group,
  type Kdbx,
} from './kdbx';
import { EntryList } from './list';
import { matches, sortEntries, SORT_KEYS, sortLabel } from './search';
import {
  applyPanels,
  applyTheme,
  applyZoom,
  clampZoom,
  CLIPBOARD_CHOICES,
  loadSettings,
  LOCK_CHOICES,
  resolveLanguage,
  saveSettings,
  ZOOM_STEP,
  type Settings,
  type Theme,
} from './settings';
import {
  ask,
  bindLayoutBadge,
  confirmAsk,
  form,
  h,
  isRevealed,
  maskInput,
  menu,
  menuAt,
  popover,
  setRevealed,
  toast,
  type MenuItem,
} from './ui';

const AUTOSAVE_DELAY = 1500;

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`No element #${id}`);
  return node as T;
};

const settings = loadSettings();

const gate = el('gate');
const app = el('app');
const gatePick = el('gate-pick');
const unlockForm = el<HTMLFormElement>('unlock');
const passwordInput = el<HTMLInputElement>('password');
const unlockButton = el<HTMLButtonElement>('unlock-button');
const gateError = el('gate-error');
const filePicker = el<HTMLInputElement>('file-picker');
const keyPicker = el<HTMLInputElement>('key-picker');
const searchInput = el<HTMLInputElement>('search');
const statusFile = el('status-file');
const statusState = el('status-state');
const statusFormat = el('status-format');

let file: DbFile | null = null;
let keyFile: { name: string; data: ArrayBuffer } | null = null;
let db: Kdbx | null = null;
let dirty = false;
/** Bumped on every change, so a save knows whether the data moved on while it was writing. */
let revision = 0;
let saving: Promise<void> | null = null;
let saveTimer = 0;
let selection: Selection = { kind: 'all' };
let activeUuid: string | null = null;
let lastActivity = Date.now();

/* ------------------------------------------------------------------ *
 * Views
 * ------------------------------------------------------------------ */

const sidebar = new Sidebar(el('groups'), {
  onSelect: (next) => void select(next),
  onNewEntry: (group) => void newEntry(group),
  onNewGroup: (parent) => void newGroup(parent),
  onRename: (group) => void renameGroup(group),
  onDelete: (group) => void deleteGroup(group),
  onRestore: (group) => {
    if (!db) return;
    restore(db, group);
    changed();
    toast(t('toast', '"{name}" restored', { name: group.name ?? '' }));
  },
  onEmptyTrash: () => void emptyTrash(),
  onMoveEntry: (uuid, target) => {
    const entry = findEntry(uuid);
    if (!db || !entry) return;
    if (target === 'trash') void removeEntry(entry);
    else if (entry.parentGroup !== target) {
      db.move(entry, target);
      changed();
      toast(t('toast', 'Moved to "{name}"', { name: target.name ?? '' }));
    }
  },
  onMoveGroup: (uuid, target) => {
    const group = db?.getGroup(uuid);
    if (!db || !group) return;
    if (target === 'trash') void deleteGroup(group);
    else if (canMoveGroup(group, target)) {
      db.move(group, target);
      changed();
    }
  },
  onCollapse: () => {
    settings.collapsed = sidebar.getCollapsed();
    settings.binOpen = sidebar.isBinOpen();
    saveSettings(settings);
  },
  canEdit: () => db !== null,
});
sidebar.setCollapsed(settings.collapsed);
sidebar.setBinOpen(settings.binOpen);

const list = new EntryList(el('entries'), el('entries-empty'), {
  onSelect: (entry) => void selectEntry(entry),
  onContextMenu: (entry, x, y) => menu(x, y, entryMenu(entry, null)),
  canEdit: () => db !== null,
});

const details = new Details(el('details'), el('details-placeholder'), {
  db: () => db,
  copy: (value, what) => void copy(value, what),
  changed: () => changed(),
  remove: (entry) => void removeEntry(entry),
  restore: (entry) => restoreEntry(entry),
  duplicate: (entry) => duplicateEntry(entry),
  moveMenu: (entry, anchor) => menuAt(anchor, moveItems(entry)),
  discard: (entry) => {
    const container = entry.parentGroup?.entries;
    const index = container?.indexOf(entry) ?? -1;
    if (container && index >= 0) container.splice(index, 1);
    activeUuid = null;
    refresh();
  },
  generator: (anchor, onUse) => generatorAt(anchor, t('generator', 'Use'), onUse),
  editingChanged: (editing) => document.body.classList.toggle('editing', editing),
  confirmDiscard: () => confirmAsk(t('dialog', 'Discard changes?'), t('dialog', 'The edits to this entry will be lost.'), t('dialog', 'Discard')),
});

/* ------------------------------------------------------------------ *
 * Gate: choosing a file and unlocking it
 * ------------------------------------------------------------------ */

function showGate(mode: 'pick' | 'unlock'): void {
  gate.hidden = false;
  app.hidden = true;
  gatePick.hidden = mode !== 'pick';
  unlockForm.hidden = mode !== 'unlock';
  gateError.textContent = '';
  document.title = t('app', 'Password manager');
  if (mode === 'pick') void renderRecent();
  else {
    el('unlock-name').textContent = file?.name.replace(/\.kdbx$/i, '') ?? t('gate', 'Database');
    renderKeyFile();
    clearPassword();
    passwordInput.focus();
  }
}

async function renderRecent(): Promise<void> {
  const box = el('recent');
  const recent = await recentFiles();
  box.hidden = recent.length === 0;
  box.replaceChildren(h('div', { class: 'recent-title', text: t('gate', 'Recent') }));
  for (const item of recent) {
    const open = h('button', { type: 'button', class: 'recent-open', title: t('gate', 'Open {name}', { name: item.name }) }, h('span', { class: 'recent-name', text: item.name }));
    open.addEventListener('click', () => chooseFile(new HandleFile(item.handle)));
    const forget = h('button', { type: 'button', class: 'recent-forget', title: t('gate', 'Remove from the list'), text: '×' });
    forget.addEventListener('click', async () => {
      await forgetFile(item.name);
      void renderRecent();
    });
    box.append(h('div', { class: 'recent-item' }, open, forget));
  }
}

function chooseFile(next: DbFile): void {
  if (!/\.kdbx$/i.test(next.name)) {
    gateError.textContent = t('errors', '"{name}" does not look like a KeePass database (.kdbx)', { name: next.name });
    return;
  }
  file = next;
  keyFile = null;
  showGate('unlock');
}

function renderKeyFile(): void {
  const name = el('key-name');
  name.hidden = !keyFile;
  name.textContent = keyFile ? `🔑 ${keyFile.name}` : '';
  el('key-clear').hidden = !keyFile;
  el('key-file').hidden = Boolean(keyFile);
}

async function unlock(): Promise<void> {
  if (!file) return;
  gateError.textContent = '';
  unlockButton.disabled = true;
  const label = unlockButton.innerHTML;
  unlockButton.textContent = t('gate', 'Unlocking…');
  try {
    // Permissions need the click that got us here, so they come before any slow work.
    if (file instanceof HandleFile && !(await file.ensureWritable())) await file.ensureReadable();
    const data = await file.read();
    // Let "Unlocking…" paint: the key derivation can hold the thread for a second.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const opened = await openDatabase(data, passwordInput.value, keyFile?.data ?? null);
    setMasterPassword(passwordInput.value);
    clearPassword();
    void rememberFile(file);
    enter(opened);
  } catch (error) {
    gateError.textContent = describeError(error);
    unlockForm.classList.remove('shake');
    void unlockForm.offsetWidth;
    unlockForm.classList.add('shake');
    passwordInput.select();
  } finally {
    unlockButton.disabled = false;
    unlockButton.innerHTML = label;
  }
}

/** Shows the unlocked database. */
function enter(opened: Kdbx): void {
  db = opened;
  dirty = false;
  revision = 0;
  selection = { kind: 'all' };
  activeUuid = null;
  searchInput.value = '';
  lastActivity = Date.now();
  gate.hidden = true;
  app.hidden = false;
  sidebar.setDatabase(db);
  sidebar.setSelection(selection);
  details.show(null);
  refresh();
  updateStatus();
  el('entries').focus();
}

async function lock(reason: 'manual' | 'idle' = 'manual'): Promise<void> {
  if (!db) return;
  if (details.isEditing && !(await details.commit())) {
    if (reason === 'idle') return;
    if (!(await details.cancel())) return;
  }
  if (dirty) {
    if (file?.writable) {
      await save();
      if (dirty) return;
    } else if (reason === 'idle') {
      // Locking now would throw the changes away; the status bar keeps nagging instead.
      return;
    } else if (!(await confirmAsk(t('dialog', 'Lock with unsaved changes?'), t('dialog', 'The changes made since the last save will be lost.'), t('dialog', 'Lock anyway')))) {
      return;
    }
  }
  window.clearTimeout(saveTimer);
  db = null;
  setMasterPassword(null);
  dirty = false;
  activeUuid = null;
  details.show(null);
  sidebar.setDatabase(null);
  list.setEntries(null, [], false, '');
  releaseIcons();
  void clearClipboard();
  document.querySelector('.popover')?.dispatchEvent(new Event('dismiss'));
  document.querySelector('.context-menu')?.remove();
  if (file instanceof NewFile) {
    file = null;
    showGate('pick');
  } else showGate('unlock');
}

async function closeDatabase(): Promise<void> {
  await lock();
  if (db) return;
  file = null;
  keyFile = null;
  showGate('pick');
}

async function newDatabase(): Promise<void> {
  const result = await form({
    title: t('dialog', 'New database'),
    fields: [
      { name: 'name', label: t('dialog', 'Name'), value: t('dialog', 'Passwords') },
      { name: 'password', label: t('dialog', 'Master password'), type: 'password' },
      { name: 'repeat', label: t('dialog', 'Repeat the password'), type: 'password' },
    ],
    confirm: t('dialog', 'Create'),
    validate: (values) => {
      if (!values['name']) return t('dialog', 'Give the database a name');
      if (!values['password']) return t('dialog', 'A master password is required');
      if (values['password'] !== values['repeat']) return t('dialog', 'The passwords do not match');
      return null;
    },
  });
  if (!result) return;
  const name = result.values['name'] || t('dialog', 'Passwords');
  try {
    const created = await createDatabase(name, result.values['password'] ?? '', null);
    setMasterPassword(result.values['password'] ?? '');
    file = new NewFile(`${name.replace(/[\\/:*?"<>|]/g, '_')}.kdbx`);
    keyFile = null;
    enter(created);
    changed();
    toast(t('toast', 'Created. Press ⌘S to save it to a file'));
  } catch (error) {
    toast(describeError(error), 'error');
  }
}

/* ------------------------------------------------------------------ *
 * Selection and the entry list
 * ------------------------------------------------------------------ */

async function select(next: Selection): Promise<void> {
  if (details.isEditing && !(await details.commit())) return;
  selection = next;
  if (searchInput.value) searchInput.value = '';
  sidebar.setSelection(next);
  refresh();
  const first = list.items[0] ?? null;
  if (!list.items.some((entry) => uuidOf(entry) === activeUuid)) void selectEntry(first);
}

async function selectEntry(entry: Entry | null): Promise<void> {
  if (details.isEditing && details.current !== entry && !(await details.commit())) return;
  activeUuid = entry ? uuidOf(entry) : null;
  list.setActive(activeUuid);
  if (details.current !== entry || !details.isEditing) details.show(entry);
}

function currentGroup(): Group | null {
  if (!db || selection.kind !== 'group') return null;
  return db.getGroup(selection.uuid) ?? null;
}

function visibleEntries(): { entries: Entry[]; title: string; showPath: boolean; empty: string } {
  if (!db) return { entries: [], title: '', showPath: false, empty: '' };
  const root = db.getDefaultGroup();
  const query = searchInput.value.trim();
  if (query) {
    const found = entriesBelow(db, root).filter((entry) => matches(entry, query));
    return { entries: sortEntries(found, settings.sort), title: t('list', 'Search results'), showPath: true, empty: t('list', 'Nothing found') };
  }
  switch (selection.kind) {
    case 'group': {
      const group = currentGroup() ?? root;
      const entries = entriesBelow(db, group);
      return { entries: sortEntries(entries, settings.sort), title: group.name || t('list', 'Group'), showPath: group.groups.length > 0, empty: t('list', 'No entries in this group') };
    }
    case 'tag': {
      const tag = selection.tag;
      const entries = entriesBelow(db, root).filter((entry) => entry.tags.includes(tag));
      return { entries: sortEntries(entries, settings.sort), title: `#${tag}`, showPath: true, empty: t('list', 'No entries with this tag') };
    }
    case 'trash': {
      const bin = recycleBin(db);
      return { entries: sortEntries(bin ? entriesBelow(db, bin) : [], settings.sort), title: t('sidebar', 'Recycle bin'), showPath: false, empty: t('list', 'The recycle bin is empty') };
    }
    default:
      return { entries: sortEntries(entriesBelow(db, root), settings.sort), title: t('sidebar', 'All entries'), showPath: true, empty: t('list', 'No entries yet') };
  }
}

function refresh(): void {
  const view = visibleEntries();
  list.setEntries(db, view.entries, view.showPath, view.empty);
  list.setActive(activeUuid);
  el('list-title').textContent = view.title;
  el('sort').textContent = `${sortLabel(settings.sort)} ▾`;
  if (details.current && db && !findEntry(uuidOf(details.current))) details.show(null);
  else details.refresh();
}

function findEntry(uuid: string): Entry | null {
  if (!db) return null;
  for (const entry of db.getDefaultGroup().allEntries()) if (uuidOf(entry) === uuid) return entry;
  return null;
}

/** After any change to the database: redraw, mark dirty, maybe autosave. */
function changed(): void {
  revision += 1;
  dirty = true;
  sidebar.render();
  refresh();
  updateStatus();
  scheduleAutosave();
}

/* ------------------------------------------------------------------ *
 * Entry and group actions
 * ------------------------------------------------------------------ */

async function newEntry(group?: Group): Promise<void> {
  if (!db) return;
  if (details.isEditing && !(await details.commit())) return;
  const bin = recycleBin(db);
  let target = group ?? currentGroup() ?? db.getDefaultGroup();
  if (bin && inRecycleBin(db, target)) target = db.getDefaultGroup();
  const entry = createEntry(db, target);
  if (selection.kind === 'tag') entry.tags = [selection.tag];
  const shown = currentGroup();
  const hidden = selection.kind === 'group' && (!shown || !isInside(target, shown));
  if (selection.kind === 'trash' || searchInput.value || hidden) {
    searchInput.value = '';
    selection = target === db.getDefaultGroup() ? { kind: 'all' } : { kind: 'group', uuid: uuidOf(target) };
    sidebar.setSelection(selection);
  }
  activeUuid = uuidOf(entry);
  refresh();
  details.show(entry);
  details.edit(true);
}

async function removeEntry(entry: Entry): Promise<void> {
  if (!db) return;
  const trashed = inRecycleBin(db, entry);
  if ((trashed || !db.meta.recycleBinEnabled) && !(await confirmAsk(t('dialog', 'Delete permanently?'), t('dialog', '"{name}" will be removed from the database for good.', { name: titleOf(entry) })))) return;
  const next = list.neighbour(1) === entry ? list.neighbour(-1) : list.neighbour(1);
  const result = remove(db, entry);
  if (details.current === entry) details.show(null);
  activeUuid = next && next !== entry ? uuidOf(next) : null;
  changed();
  if (activeUuid) void selectEntry(findEntry(activeUuid));
  const name = titleOf(entry);
  toast(result === 'trashed' ? t('toast', '"{name}" moved to the recycle bin', { name }) : t('toast', '"{name}" deleted', { name }));
}

function restoreEntry(entry: Entry): void {
  if (!db) return;
  restore(db, entry);
  changed();
  toast(t('toast', '"{name}" restored', { name: titleOf(entry) }));
}

function duplicateEntry(entry: Entry): void {
  if (!db) return;
  const copy = cloneEntry(db, entry);
  activeUuid = uuidOf(copy);
  changed();
  void selectEntry(copy);
}

function groupChoices(): { group: Group; depth: number }[] {
  if (!db) return [];
  const bin = recycleBin(db);
  const out: { group: Group; depth: number }[] = [];
  const walk = (group: Group, depth: number): void => {
    if (group === bin) return;
    out.push({ group, depth });
    for (const child of group.groups) walk(child, depth + 1);
  };
  walk(db.getDefaultGroup(), 0);
  return out;
}

function moveItems(entry: Entry): MenuItem[] {
  return groupChoices().map(({ group, depth }) => ({
    label: `${'   '.repeat(depth)}${group.name || t('sidebar', '(unnamed)')}`,
    checked: entry.parentGroup === group,
    action: () => {
      if (!db || entry.parentGroup === group) return;
      db.move(entry, group);
      changed();
      toast(t('toast', 'Moved to "{name}"', { name: group.name ?? '' }));
    },
  }));
}

function entryMenu(entry: Entry, anchor: HTMLElement | null): MenuItem[] {
  if (!db) return [];
  if (inRecycleBin(db, entry)) {
    return [
      { label: t('menu', 'Restore'), action: () => restoreEntry(entry) },
      { label: t('menu', 'Delete permanently'), danger: true, action: () => void removeEntry(entry) },
    ];
  }
  return [
    { label: t('menu', 'Copy user name'), hint: '⌘B', action: () => void copy(field(entry, 'UserName'), t('entry', 'User name')) },
    { label: t('menu', 'Copy password'), hint: '⌘C', action: () => void copy(entryPassword(entry), t('entry', 'Password')) },
    { label: t('menu', 'Copy website'), hint: '⌘U', action: () => void copy(field(entry, 'URL'), t('entry', 'Website')) },
    { label: t('menu', 'Edit'), hint: '⌘E', separated: true, action: () => details.edit() },
    { label: t('menu', 'Duplicate'), action: () => duplicateEntry(entry) },
    {
      label: t('menu', 'Move to group…'),
      action: () => {
        const row = anchor ?? el('entries').querySelector<HTMLElement>('.entry--active');
        if (row) menuAt(row, moveItems(entry));
      },
    },
    { label: t('menu', 'Delete'), danger: true, separated: true, hint: '⌫', action: () => void removeEntry(entry) },
  ];
}

async function newGroup(parent?: Group): Promise<void> {
  if (!db) return;
  const target = parent ?? currentGroup() ?? db.getDefaultGroup();
  if (inRecycleBin(db, target)) return;
  const name = await ask(t('dialog', 'New group'), t('dialog', 'Name'));
  if (!name || !db) return;
  const group = createGroup(db, target, name);
  changed();
  void select({ kind: 'group', uuid: uuidOf(group) });
}

async function renameGroup(group: Group): Promise<void> {
  const name = await ask(t('dialog', 'Rename group'), t('dialog', 'Name'), group.name ?? '');
  if (!name || name === group.name) return;
  group.name = name;
  group.times.update();
  changed();
}

async function deleteGroup(group: Group): Promise<void> {
  if (!db || !group.parentGroup) return;
  const permanent = inRecycleBin(db, group) || !db.meta.recycleBinEnabled;
  const count = entriesBelow(db, group).length;
  const name = group.name ?? '';
  const message = permanent
    ? tn('dialog', '"{name}" and its {count} entry will be removed for good.', '"{name}" and its {count} entries will be removed for good.', count, { name })
    : tn('dialog', '"{name}" and its {count} entry will move to the recycle bin.', '"{name}" and its {count} entries will move to the recycle bin.', count, { name });
  if (!(await confirmAsk(permanent ? t('dialog', 'Delete group permanently?') : t('dialog', 'Delete group?'), message))) return;
  remove(db, group);
  if (selection.kind === 'group' && (selection.uuid === uuidOf(group) || !db.getGroup(selection.uuid))) {
    selection = { kind: 'all' };
    sidebar.setSelection(selection);
  }
  changed();
}

async function emptyTrash(): Promise<void> {
  if (!db || !recycleBin(db)) return;
  if (!(await confirmAsk(t('dialog', 'Empty the recycle bin?'), t('dialog', 'Everything in it will be removed from the database for good.'), t('dialog', 'Empty')))) return;
  emptyRecycleBin(db);
  changed();
}

async function copy(value: string | Promise<string>, what: string): Promise<void> {
  if (value === '') {
    toast(t('toast', '{what}: empty', { what }));
    return;
  }
  try {
    await copyText(value, settings.clipboardSeconds);
    toast(
      settings.clipboardSeconds
        ? t('toast', '{what} copied · cleared in {seconds} s', { what, seconds: settings.clipboardSeconds })
        : t('toast', '{what} copied', { what }),
    );
  } catch (error) {
    toast(describeError(error), 'error');
  }
}

/* ------------------------------------------------------------------ *
 * Saving
 * ------------------------------------------------------------------ */

function scheduleAutosave(): void {
  window.clearTimeout(saveTimer);
  if (!settings.autosave || !file?.writable) return;
  saveTimer = window.setTimeout(() => void save(), AUTOSAVE_DELAY);
}

async function save(): Promise<void> {
  if (!db || !file) return;
  if (details.isEditing && !(await details.commit())) return;
  if (saving) {
    await saving;
    if (!dirty) return;
  }
  window.clearTimeout(saveTimer);
  const database = db;
  const target = file;
  const started = revision;

  if (!target.writable) {
    // Chromium can write a new file; elsewhere the only way out is a download.
    const picked = canWriteInPlace ? await pickSaveTarget(target.name) : null;
    if (picked) {
      file = picked;
      void rememberFile(picked);
      return save();
    }
    if (canWriteInPlace) return;
    const data = await saveDatabase(database);
    download(data, target.name);
    if (revision === started) dirty = false;
    updateStatus();
    toast(t('toast', '{name} downloaded', { name: target.name }));
    return;
  }

  statusState.textContent = t('status', 'Saving…');
  saving = (async () => {
    try {
      const data = await saveDatabase(database);
      await target.write(data);
      if (revision === started && db === database) dirty = false;
    } catch (error) {
      toast(t('toast', 'Not saved: {reason}', { reason: describeError(error) }), 'error');
    } finally {
      saving = null;
      updateStatus();
    }
  })();
  await saving;
}

async function saveCopy(): Promise<void> {
  if (!db || !file) return;
  if (details.isEditing && !(await details.commit())) return;
  const data = await saveDatabase(db);
  const name = `${t('entry', '{title} (copy)', { title: file.name.replace(/\.kdbx$/i, '') })}.kdbx`;
  const picked = canWriteInPlace ? await pickSaveTarget(name) : null;
  if (picked) {
    await picked.write(data);
    toast(t('toast', 'Saved a copy as {name}', { name: picked.name }));
  } else if (!canWriteInPlace) {
    download(data, name);
  }
}

function updateStatus(): void {
  if (!db || !file) return;
  statusFile.textContent = file.writable
    ? file.name
    : `${file.name} · ${file instanceof NewFile ? t('status', 'not saved yet') : t('status', 'read-only, saving downloads a copy')}`;
  statusState.textContent = dirty ? t('status', 'Unsaved changes') : t('status', 'Saved');
  statusState.classList.toggle('status-state--dirty', dirty);
  const count = entriesBelow(db, db.getDefaultGroup()).length;
  statusFormat.textContent = `${tn('status', '{count} entry', '{count} entries', count)} · ${describeFormat(db)}`;
  el('db-label').textContent = db.meta.name || db.getDefaultGroup().name || file.name;
  document.title = `${dirty ? '• ' : ''}${db.meta.name || file.name} — ${t('app', 'Password manager')}`;
  el('save').classList.toggle('icon-button--dirty', dirty);
}

/* ------------------------------------------------------------------ *
 * Database menu and settings
 * ------------------------------------------------------------------ */

async function renameDatabase(): Promise<void> {
  if (!db) return;
  const name = await ask(t('dialog', 'Rename database'), t('dialog', 'Name'), db.meta.name || db.getDefaultGroup().name || '');
  if (!name || !db) return;
  db.meta.name = name;
  changed();
}

/** Entries whose password is derived from the master password, the recycle bin included. */
function derivedEntries(database: Kdbx): Entry[] {
  const out: Entry[] = [];
  const walk = (group: Group): void => {
    for (const entry of group.entries) {
      try {
        if (parseDerived(field(entry, 'Password'))) out.push(entry);
      } catch {
        /* settings this version cannot use are left alone */
      }
    }
    for (const child of group.groups) walk(child);
  };
  walk(database.getDefaultGroup());
  return out;
}

async function changeMasterPassword(): Promise<void> {
  if (!db) return;
  if (details.isEditing && !(await details.commit())) return;
  const derived = derivedEntries(db);
  const result = await form({
    title: t('dialog', 'Change master password'),
    message: t('dialog', 'The file is re-encrypted with the new key the next time it is saved.'),
    fields: [
      { name: 'password', label: t('dialog', 'New master password'), type: 'password' },
      { name: 'repeat', label: t('dialog', 'Repeat it'), type: 'password' },
      { name: 'key', label: t('dialog', 'Key file (optional)'), type: 'file' },
      ...(derived.length
        ? [
            {
              name: 'convert',
              type: 'checkbox' as const,
              value: 'true',
              label: tn('dialog', 'Turn {count} derived password into a stored one', 'Turn {count} derived passwords into stored ones', derived.length),
              hint: t('dialog', 'Derived passwords are computed from the master password: with a new one each of them becomes a different password. Stored, they stay as they are, but can no longer be recovered without the file.'),
            },
          ]
        : []),
    ],
    confirm: t('dialog', 'Change'),
    validate: (values, files) => {
      if (!values['password'] && !files['key']) return t('dialog', 'Set a password, a key file, or both');
      if (values['password'] !== values['repeat']) return t('dialog', 'The passwords do not match');
      return null;
    },
  });
  if (!result || !db) return;
  const database = db;
  if (result.values['convert'] === 'true') {
    try {
      // With the old master password, before it is replaced: every password stays what it was.
      // One at a time: each is an Argon2 run over 64 MiB.
      const passwords: string[] = [];
      for (const entry of derived) passwords.push(await entryPassword(entry));
      derived.forEach((entry, i) => {
        entry.pushHistory();
        entry.fields.set('Password', makeValue(passwords[i] ?? '', true));
        entry.times.update();
      });
    } catch (error) {
      toast(describeError(error), 'error');
      return;
    }
  }
  const key = result.files['key'];
  const keyData = key ? await key.arrayBuffer() : null;
  await changeCredentials(database, result.values['password'] ?? '', keyData);
  setMasterPassword(result.values['password'] ?? '');
  keyFile = key && keyData ? { name: key.name, data: keyData } : null;
  changed();
  details.refresh();
  toast(t('toast', 'Master key changed'));
}

function databaseMenu(anchor: HTMLElement): void {
  menuAt(anchor, [
    { label: t('menu', 'Save'), hint: '⌘S', action: () => void save() },
    { label: t('menu', 'Save a copy…'), action: () => void saveCopy() },
    { label: t('menu', 'Rename database…'), separated: true, action: () => void renameDatabase() },
    { label: t('menu', 'Change master password…'), action: () => void changeMasterPassword() },
    { label: t('menu', 'Lock'), hint: '⌘L', separated: true, action: () => void lock() },
    { label: t('menu', 'Close database'), action: () => void closeDatabase() },
  ]);
}

function selectBox<T extends string | number>(value: T, choices: [T, string][], onChange: (value: T) => void): HTMLSelectElement {
  const node = h('select', { class: 'settings-select' });
  for (const [choice, label] of choices) {
    const option = h('option', { value: String(choice), text: label });
    option.selected = choice === value;
    node.append(option);
  }
  node.addEventListener('change', () => {
    const picked = choices.find(([choice]) => String(choice) === node.value);
    if (picked) onChange(picked[0]);
  });
  return node;
}

function openSettings(anchor: HTMLElement): void {
  const autosave = h('input', { type: 'checkbox' });
  autosave.checked = settings.autosave;
  autosave.addEventListener('change', () => {
    settings.autosave = autosave.checked;
    saveSettings(settings);
    if (settings.autosave && dirty) scheduleAutosave();
  });
  const row = (label: string, control: HTMLElement): HTMLElement => h('label', { class: 'settings-row' }, h('span', { text: label }), control);
  const languages: [Settings['language'], string][] = [['auto', t('settings', 'System')], ...(Object.entries(LANGUAGES) as [Language, string][])];
  const themes: Theme[] = ['system', 'light', 'dark'];
  const panel = h(
    'div',
    { class: 'settings' },
    h('h3', { class: 'settings-title', text: t('settings', 'Settings') }),
    row(
      t('settings', 'Language'),
      selectBox(settings.language, languages, (choice) => {
        setLanguageChoice(choice);
        openSettings(anchor);
      }),
    ),
    row(
      t('settings', 'Theme'),
      selectBox<Theme>(settings.theme, themes.map((theme) => [theme, themeLabel(theme)]), (theme) => setTheme(theme)),
    ),
    row(
      t('settings', 'Lock when idle'),
      selectBox(settings.lockMinutes, LOCK_CHOICES.map((m) => [m, m === 0 ? t('settings', 'Never') : m === 60 ? t('settings', 'After 1 hour') : t('settings', 'After {count} min', { count: m })] as [number, string]), (minutes) => {
        settings.lockMinutes = minutes;
        saveSettings(settings);
      }),
    ),
    row(
      t('settings', 'Clear clipboard'),
      selectBox(settings.clipboardSeconds, CLIPBOARD_CHOICES.map((s) => [s, s === 0 ? t('settings', 'Never') : t('settings', 'After {count} s', { count: s })] as [number, string]), (seconds) => {
        settings.clipboardSeconds = seconds;
        saveSettings(settings);
      }),
    ),
    h('label', { class: 'settings-row settings-row--check' }, autosave, h('span', { text: t('settings', 'Save automatically after each change') })),
    h('p', {
      class: 'settings-note',
      text: canWriteInPlace
        ? t('settings', 'Autosave works when the file was opened with write access.')
        : t('settings', 'This browser cannot write files in place, so saving downloads a copy.'),
    }),
  );
  popover(anchor, panel);
}

function themeLabel(theme: Theme): string {
  return { system: t('settings', 'System'), light: t('settings', 'Light'), dark: t('settings', 'Dark') }[theme];
}

/** Shows the interface in another language: the markup is translated again and every view redrawn. */
function setLanguageChoice(choice: Settings['language']): void {
  settings.language = choice;
  saveSettings(settings);
  applyLanguage();
  sidebar.render();
  refresh();
  details.redraw();
  updateStatus();
}

function applyLanguage(): void {
  setLanguage(resolveLanguage(settings.language));
  translatePage();
  const note = el('browser-note');
  note.hidden = canWriteInPlace;
  note.textContent = canWriteInPlace
    ? ''
    : t('gate', 'This browser opens the file read-only: Save downloads an updated copy of the database. Chrome, Edge and Arc save changes straight back into the file.');
}

function setTheme(theme: Theme): void {
  settings.theme = theme;
  applyTheme(theme);
  saveSettings(settings);
}

function generatorAt(anchor: HTMLElement, useLabel: string, onUse: (password: string) => void): void {
  openGenerator({
    anchor,
    options: settings.generator,
    onOptions: (options) => {
      settings.generator = options;
      saveSettings(settings);
    },
    useLabel,
    onUse,
  });
}

function setZoom(zoom: number): void {
  settings.zoom = clampZoom(zoom);
  applyZoom(settings.zoom);
  el('zoom-reset').textContent = `${settings.zoom}%`;
  saveSettings(settings);
}

function sortMenu(anchor: HTMLElement): void {
  menuAt(
    anchor,
    SORT_KEYS.map((key) => ({
      label: sortLabel(key),
      checked: settings.sort === key,
      action: () => {
        settings.sort = key;
        saveSettings(settings);
        refresh();
      },
    })),
  );
}

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

el('open-file').addEventListener('click', async () => {
  gateError.textContent = '';
  if (!canWriteInPlace) {
    filePicker.click();
    return;
  }
  try {
    const picked = await pickFile();
    if (picked) chooseFile(picked);
  } catch (error) {
    gateError.textContent = describeError(error);
  }
});
filePicker.addEventListener('change', () => {
  const picked = filePicker.files?.[0];
  filePicker.value = '';
  if (picked) chooseFile(new BlobFile(picked));
});
el('new-db').addEventListener('click', () => void newDatabase());
el('unlock-change').addEventListener('click', () => {
  file = null;
  keyFile = null;
  showGate('pick');
});
unlockForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void unlock();
});
passwordInput.after(maskInput(passwordInput));
const updateLayout = bindLayoutBadge(passwordInput, el('layout'));

/** Empties the unlock field and hides it again; setting `value` fires no input event. */
function clearPassword(): void {
  passwordInput.value = '';
  setRevealed(passwordInput, false);
  el('password-reveal').title = t('password', 'Show password');
  updateLayout();
}
el('password-reveal').addEventListener('click', () => {
  setRevealed(passwordInput, !isRevealed(passwordInput));
  el('password-reveal').title = isRevealed(passwordInput) ? t('password', 'Hide password') : t('password', 'Show password');
  passwordInput.focus();
});
for (const type of ['keydown', 'keyup'] as const) {
  passwordInput.addEventListener(type, (event) => {
    el('caps').hidden = !event.getModifierState?.('CapsLock');
  });
}
el('key-file').addEventListener('click', () => keyPicker.click());
keyPicker.addEventListener('change', async () => {
  const picked = keyPicker.files?.[0];
  keyPicker.value = '';
  if (!picked) return;
  keyFile = { name: picked.name, data: await picked.arrayBuffer() };
  renderKeyFile();
  passwordInput.focus();
});
el('key-clear').addEventListener('click', () => {
  keyFile = null;
  renderKeyFile();
});

gate.addEventListener('dragover', (event) => {
  event.preventDefault();
  gate.classList.add('gate--drop');
});
gate.addEventListener('dragleave', (event) => {
  if (event.target === gate) gate.classList.remove('gate--drop');
});
gate.addEventListener('drop', async (event) => {
  event.preventDefault();
  gate.classList.remove('gate--drop');
  if (!event.dataTransfer) return;
  try {
    const dropped = await fileFromDrop(event.dataTransfer);
    if (dropped) chooseFile(dropped);
  } catch (error) {
    gateError.textContent = describeError(error);
  }
});

el('db-name').addEventListener('click', (event) => databaseMenu(event.currentTarget as HTMLElement));
el('new-group').addEventListener('click', () => void newGroup());
el('new-entry').addEventListener('click', () => void newEntry());
el('save').addEventListener('click', () => void save());
el('lock').addEventListener('click', () => void lock());
el('generator').addEventListener('click', (event) =>
  generatorAt(event.currentTarget as HTMLElement, t('generator', 'Copy'), (password) => void copy(password, t('entry', 'Password'))),
);
el('settings').addEventListener('click', (event) => openSettings(event.currentTarget as HTMLElement));
el('sort').addEventListener('click', (event) => sortMenu(event.currentTarget as HTMLElement));
el('theme').addEventListener('click', () => {
  const order: Theme[] = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(settings.theme) + 1) % order.length] ?? 'system';
  setTheme(next);
  toast(t('toast', 'Theme: {theme}', { theme: themeLabel(next) }));
});
el('zoom-in').addEventListener('click', () => setZoom(settings.zoom + ZOOM_STEP));
el('zoom-out').addEventListener('click', () => setZoom(settings.zoom - ZOOM_STEP));
el('zoom-reset').addEventListener('click', () => setZoom(100));
el('toggle-sidebar').addEventListener('click', toggleSidebar);

function toggleSidebar(): void {
  settings.sidebarHidden = !settings.sidebarHidden;
  applyPanels(settings);
  saveSettings(settings);
}

searchInput.addEventListener('input', () => {
  refresh();
  const first = list.items[0];
  if (first && !list.items.some((entry) => uuidOf(entry) === activeUuid)) void selectEntry(first);
});
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'Enter') {
    event.preventDefault();
    el('entries').focus();
    if (!activeUuid && list.items[0]) void selectEntry(list.items[0]);
  } else if (event.key === 'Escape' && searchInput.value) {
    event.preventDefault();
    event.stopPropagation();
    searchInput.value = '';
    refresh();
  }
});

function resizer(id: string, key: 'sidebar' | 'list', min: number, max: number, origin: () => number): void {
  const handle = el(id);
  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const move = (moved: PointerEvent): void => {
      const width = isRightToLeft() ? origin() - moved.clientX : moved.clientX - origin();
      settings[key] = Math.round(Math.min(max, Math.max(min, width)));
      applyPanels(settings);
    };
    const up = (): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      saveSettings(settings);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
  handle.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const wider = (event.key === 'ArrowRight') !== isRightToLeft();
    settings[key] = Math.min(max, Math.max(min, settings[key] + (wider ? 16 : -16)));
    applyPanels(settings);
    saveSettings(settings);
  });
}
/** Where a panel starts: its left edge, or its right one in a right-to-left layout. */
const edge = (node: HTMLElement): number => {
  const box = node.getBoundingClientRect();
  return isRightToLeft() ? box.right : box.left;
};
resizer('sidebar-resizer', 'sidebar', 160, 480, () => edge(document.body));
resizer('list-resizer', 'list', 220, 640, () => edge(el('entries')));

/** True when the keystroke belongs to a text field, not to the app. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

document.addEventListener('keydown', (event) => {
  lastActivity = Date.now();
  if (!db || !gate.hidden || document.querySelector('.overlay:not([hidden])')) return;
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();
  const inField = typing(event.target);
  const entry = details.current;

  if (mod && !event.altKey) {
    switch (key) {
      case 's':
        event.preventDefault();
        void save();
        return;
      case 'l':
        event.preventDefault();
        void lock();
        return;
      case 'f':
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      case 'n':
        event.preventDefault();
        void newEntry();
        return;
      case 'e':
        event.preventDefault();
        if (details.isEditing) void details.commit();
        else details.edit();
        return;
      case 'g':
        event.preventDefault();
        if (details.isEditing) details.generate();
        else el('generator').click();
        return;
      case '\\':
        event.preventDefault();
        toggleSidebar();
        return;
      case '=':
      case '+':
        event.preventDefault();
        setZoom(settings.zoom + ZOOM_STEP);
        return;
      case '-':
        event.preventDefault();
        setZoom(settings.zoom - ZOOM_STEP);
        return;
      case '0':
        event.preventDefault();
        setZoom(100);
        return;
    }
    // ⌘C/⌘B/⌘U copy from the selected entry — unless there is text to copy instead.
    const selected = window.getSelection()?.toString();
    if (!inField && !selected && entry && !details.isEditing && ['c', 'b', 'u'].includes(key)) {
      event.preventDefault();
      if (key === 'c') void copy(entryPassword(entry), t('entry', 'Password'));
      if (key === 'b') void copy(field(entry, 'UserName'), t('entry', 'User name'));
      if (key === 'u') void copy(field(entry, 'URL'), t('entry', 'Website'));
    }
    return;
  }

  if (event.key === 'Escape') {
    if (details.isEditing) {
      event.preventDefault();
      void details.cancel();
    } else if (inField) (event.target as HTMLElement).blur();
    return;
  }
  if (inField || details.isEditing) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const next = list.neighbour(event.key === 'ArrowDown' ? 1 : -1);
    if (next) void selectEntry(next);
  } else if ((event.key === 'Delete' || event.key === 'Backspace') && entry) {
    event.preventDefault();
    void removeEntry(entry);
  } else if (event.key === 'Enter' && entry) {
    event.preventDefault();
    details.edit();
  }
});

/* ------------------------------------------------------------------ *
 * Idle lock and leaving the page
 * ------------------------------------------------------------------ */

for (const type of ['pointerdown', 'wheel', 'mousemove'] as const) {
  document.addEventListener(type, () => (lastActivity = Date.now()), { passive: true });
}
window.setInterval(() => {
  if (!db || settings.lockMinutes === 0) return;
  if (Date.now() - lastActivity > settings.lockMinutes * 60000) void lock('idle');
}, 10000);

window.addEventListener('beforeunload', (event) => {
  if (db && (dirty || details.dirty)) {
    event.preventDefault();
    event.returnValue = '';
  }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (settings.theme === 'system') applyTheme('system');
});

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

applyLanguage();
applyTheme(settings.theme);
applyZoom(settings.zoom);
applyPanels(settings);
el('zoom-reset').textContent = `${settings.zoom}%`;
showGate('pick');
