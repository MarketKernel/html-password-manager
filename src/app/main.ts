/**
 * Wiring: the unlock gate, the group tree, the entry list and the entry
 * itself, saving, locking, and the chrome around them — language, theme,
 * panel widths, the generator and keyboard shortcuts.
 */

import { releaseIcons } from './avatar';
import { clearClipboard, copyText } from './clipboard';
import { sessionMasterPassword, setMasterPassword } from '../core/derived';
import { Details } from './details';
import {
  BlobFile,
  canWriteInPlace,
  fileFromDrop,
  forgetFile,
  HandleFile,
  NewFile,
  pickFile,
  pickSaveTarget,
  recentFiles,
  rememberFile,
  shareOrDownload,
  sharesFiles,
  type DbFile,
} from './files';
import type { GeneratorKind } from '../core/generator';
import { openGenerator, type GeneratorEntry } from './genpanel';
import { Sidebar, type Selection } from './groups';
import { isRightToLeft, LANGUAGES, setLanguage, t, tn, translatePage, type Language } from '../core/i18n';
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
  isWrongKey,
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
} from '../core/kdbx';
import { forgetLegacySecrets } from '../core/legacy';
import { EntryList, type EmptyAction } from './list';
import { entriesFor } from '../core/match';
import { platform, type OpenState, type Resumed } from './platform';
import {
  forget,
  forgetAll,
  isCancelled,
  notRememberedText,
  recall,
  recallFailedText,
  RememberError,
  remembered,
  rememberedCount,
  rememberWays,
  settle,
  settledText,
  systemOf,
  unlockLabel,
  type RememberWith,
} from './remember';
import { back, bindScreens, closeDrawer, hideDetails, isDrawerOpen, isNarrow, isTouch, showDetails, toggleDrawer } from './screens';
import { matches, sortEntries, SORT_KEYS, sortLabel } from './search';
import {
  applyPanels,
  applyTheme,
  CLIPBOARD_CHOICES,
  loadSettings,
  LOCK_CHOICES,
  resolveLanguage,
  saveSettings,
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
const rememberedButton = el<HTMLButtonElement>('unlock-remembered');
const rememberRow = el('remember-row');
const rememberBox = el<HTMLInputElement>('remember');
const gateError = el('gate-error');
const filePicker = el<HTMLInputElement>('file-picker');
const keyPicker = el<HTMLInputElement>('key-picker');
const searchInput = el<HTMLInputElement>('search');
const statusFile = el('status-file');
const statusState = el('status-state');
const statusFormat = el('status-format');

el('version').textContent = __APP_VERSION__;

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
/** Taken up again from the extension's offscreen document, the file waits for a click on Save to be written again. */
let askToWrite = false;
/** "Fill" in the tab's context menu opened the panel on a locked database: it goes on once unlocked. */
let fillPending = false;
/** The ways of remembering a database this browser has here; none on file:. */
let rememberHere: RememberWith[] = [];
void rememberWays().then((ways) => (rememberHere = ways));
/** Bumped by every redraw of the gate's remembering, so a slower one that started earlier gives way. */
let rememberTurn = 0;

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
  onMoveGroupMenu: (group, anchor) => menuAt(anchor, moveGroupItems(group)),
  onCollapse: () => {
    settings.collapsed = sidebar.getCollapsed();
    settings.binOpen = sidebar.isBinOpen();
    saveSettings(settings);
  },
  canEdit: () => db !== null,
  site: () => {
    const page = platform.page();
    return page ? { site: page.site, count: siteEntries().length } : null;
  },
});
sidebar.setCollapsed(settings.collapsed);
sidebar.setBinOpen(settings.binOpen);

const list = new EntryList(el('entries'), el('entries-empty'), {
  onSelect: (entry, open) => void openEntry(entry, open),
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
  generator: (anchor, onUse, entry) => generatorAt(anchor, t('generator', 'Use'), onUse, entry),
  editingChanged: (editing) => document.body.classList.toggle('editing', editing),
  confirmDiscard: () => confirmAsk(t('dialog', 'Discard changes?'), t('dialog', 'The edits to this entry will be lost.'), t('dialog', 'Discard')),
  fill: platform.fill ? (entry) => void platform.fill?.(entry) : undefined,
});

bindScreens({
  // Back from an entry keeps an edit, as picking another entry does; a new entry left empty is dropped.
  leaveDetails: () => (details.untouched ? details.cancel() : details.commit()),
  hasEntry: () => db !== null && details.current !== null,
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
  document.title = t('app', 'Deterministic Password');
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
  void renderRemember();
}

/**
 * The checkbox "Remember on this device", ticked when the database is remembered, and the
 * button that opens it so. Neither is there for a database with a key file, nor where this
 * page cannot remember one (file:); the checkbox is there only when the settings' way is.
 */
async function renderRemember(): Promise<void> {
  const turn = ++rememberTurn;
  const name = file?.name ?? '';
  // Asked again each time: a security key plugged in, or a passkey provider switched on, changes the answer.
  const [ways, way] = await Promise.all([rememberWays(), name ? remembered(name) : null]);
  if (turn !== rememberTurn) return;
  rememberHere = ways;
  const offered = Boolean(name) && !keyFile && (way !== null || rememberHere.includes(settings.rememberWith));
  rememberRow.hidden = !offered;
  rememberBox.checked = offered && way !== null;
  rememberedButton.hidden = !offered || way === null;
  if (way) rememberedButton.textContent = unlockLabel(way);
  // One button leads: the remembered way when there is one.
  unlockButton.classList.toggle('button--primary', rememberedButton.hidden);
}

/**
 * Opens the chosen file with a password: the one typed, or the remembered one. The password is
 * asked for only after the file's permission, which needs the click that got us here — a
 * passkey's prompt would outlast it. Throws what went wrong.
 */
async function openWith(button: HTMLButtonElement, password: () => Promise<string>): Promise<void> {
  if (!file) return;
  const opening = file;
  gateError.textContent = '';
  button.disabled = true;
  const label = button.innerHTML;
  button.textContent = t('gate', 'Unlocking…');
  try {
    if (opening instanceof HandleFile && !(await opening.ensureWritable())) await opening.ensureReadable();
    const secret = await password();
    const data = await opening.read();
    // Let "Unlocking…" paint: the key derivation can hold the thread for a second.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const opened = await openDatabase(data, secret, keyFile?.data ?? null);
    setMasterPassword(secret);
    platform.opened({ name: opening.name, data, password: secret, keyFile });
    clearPassword();
    void rememberFile(opening);
    enter(opened);
  } finally {
    button.disabled = false;
    button.innerHTML = label;
  }
}

async function unlock(): Promise<void> {
  if (!file) return;
  const name = file.name;
  const typed = passwordInput.value;
  const wanted = !rememberRow.hidden && rememberBox.checked;
  try {
    await openWith(unlockButton, async () => typed);
  } catch (error) {
    gateError.textContent = describeError(error);
    unlockForm.classList.remove('shake');
    void unlockForm.offsetWidth;
    unlockForm.classList.add('shake');
    passwordInput.select();
    return;
  }
  if (rememberRow.hidden) return;
  try {
    const outcome = await settle(name, wanted, settings.rememberWith, typed);
    if (outcome) toast(settledText(outcome));
  } catch (error) {
    toast(notRememberedText(error), 'error');
  }
}

/** The button of a remembered database: its prompt, then the file opens. */
async function unlockRemembered(): Promise<void> {
  if (!file) return;
  const name = file.name;
  try {
    await openWith(rememberedButton, () => recall(name));
  } catch (error) {
    // The prompt closed: nothing to say, the button stays.
    if (isCancelled(error)) return;
    if (isWrongKey(error) || error instanceof RememberError) {
      await forget(name);
      gateError.textContent = recallFailedText(isWrongKey(error));
      await renderRemember();
      passwordInput.focus();
      return;
    }
    gateError.textContent = describeError(error);
  }
}

/** Opens the database the extension still has open, with the key it kept: no password to type. */
async function resume(resumed: Resumed): Promise<void> {
  file = resumed.file;
  keyFile = resumed.keyFile;
  showGate('unlock');
  unlockButton.disabled = true;
  const label = unlockButton.innerHTML;
  unlockButton.textContent = t('gate', 'Unlocking…');
  try {
    const opened = await openDatabase(resumed.data, resumed.password, resumed.keyFile?.data ?? null);
    setMasterPassword(resumed.password);
    askToWrite = file instanceof HandleFile && !file.writable;
    enter(opened);
  } catch (error) {
    gateError.textContent = describeError(error);
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
  // Beside a site with entries, the extension's panel opens on them.
  selection = siteEntries().length ? { kind: 'site' } : { kind: 'all' };
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
  if (fillPending) void finishFill();
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
  forgetLegacySecrets();
  askToWrite = false;
  dirty = false;
  activeUuid = null;
  details.show(null);
  hideDetails();
  closeDrawer();
  sidebar.setDatabase(null);
  list.setEntries(null, [], false, '');
  releaseIcons();
  void clearClipboard();
  document.querySelector('.popover')?.dispatchEvent(new Event('dismiss'));
  document.querySelector('.context-menu')?.dispatchEvent(new Event('dismiss'));
  if (file instanceof NewFile) {
    file = null;
    showGate('pick');
  } else showGate('unlock');
  platform.locked();
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
  closeDrawer();
  // On a phone the first entry would take the whole screen: a group opens as a list.
  const first = isNarrow() ? null : (list.items[0] ?? null);
  if (!list.items.some((entry) => uuidOf(entry) === activeUuid)) void selectEntry(first);
}

/** A tap or a click on a row; on a phone an opened entry takes the screen. */
async function openEntry(entry: Entry, open: boolean): Promise<void> {
  await selectEntry(entry);
  if (open && details.current === entry) showDetails();
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

/** The entries for the page in the tab beside the extension's panel; none elsewhere. */
function siteEntries(): Entry[] {
  return db ? entriesFor(entriesBelow(db, db.getDefaultGroup()), (entry) => field(entry, 'URL'), platform.page()) : [];
}

function visibleEntries(): { entries: Entry[]; title: string; showPath: boolean; empty: string; action?: EmptyAction } {
  if (!db) return { entries: [], title: '', showPath: false, empty: '' };
  const root = db.getDefaultGroup();
  const query = searchInput.value.trim();
  if (query) {
    const found = entriesBelow(db, root).filter((entry) => matches(entry, query));
    return { entries: sortEntries(found, settings.sort), title: t('list', 'Search results'), showPath: true, empty: t('list', 'Nothing found') };
  }
  switch (selection.kind) {
    case 'site': {
      const page = platform.page();
      const site = page?.site ?? '';
      return {
        entries: sortEntries(siteEntries(), settings.sort),
        title: site || t('sidebar', 'For this site'),
        showPath: true,
        empty: page ? t('list', 'No entries for {site}', { site }) : t('list', 'The tab shows no website'),
        action: page ? { label: t('list', 'New password for {site}', { site }), run: (anchor) => void passwordForPage(anchor) } : undefined,
      };
    }
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
  list.setEntries(db, view.entries, view.showPath, view.empty, view.action);
  list.setActive(activeUuid);
  el('list-title').textContent = view.title;
  el('sort').textContent = `${sortLabel(settings.sort)} ▾`;
  if (details.current && db && !findEntry(uuidOf(details.current))) details.show(null);
  else details.refresh();
  if (!details.current) hideDetails();
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
  showDetails();
}

async function removeEntry(entry: Entry): Promise<void> {
  if (!db) return;
  const trashed = inRecycleBin(db, entry);
  if ((trashed || !db.meta.recycleBinEnabled) && !(await confirmAsk(t('dialog', 'Delete permanently?'), t('dialog', '"{name}" will be removed from the database for good.', { name: titleOf(entry) })))) return;
  // On a phone the list comes back instead of the next entry.
  const next = isNarrow() ? null : list.neighbour(1) === entry ? list.neighbour(-1) : list.neighbour(1);
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

/** Where a group can go: anywhere but into itself; its parent is ticked. */
function moveGroupItems(group: Group): MenuItem[] {
  return groupChoices()
    .filter(({ group: target }) => target === group.parentGroup || canMoveGroup(group, target))
    .map(({ group: target, depth }) => ({
      label: `${'   '.repeat(depth)}${target.name || t('sidebar', '(unnamed)')}`,
      checked: group.parentGroup === target,
      action: () => {
        if (!db || !canMoveGroup(group, target)) return;
        db.move(group, target);
        changed();
        toast(t('toast', 'Moved to "{name}"', { name: target.name ?? '' }));
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
  const fill = platform.fill;
  return [
    ...(fill ? [{ label: t('extension', 'Fill'), action: () => void fill(entry) }] : []),
    { label: t('menu', 'Copy user name'), hint: '⌘B', separated: Boolean(fill), action: () => void copy(field(entry, 'UserName'), t('entry', 'User name')) },
    { label: t('menu', 'Copy password'), hint: '⌘C', action: () => void copy(field(entry, 'Password'), t('entry', 'Password')) },
    { label: t('menu', 'Copy website'), hint: '⌘U', action: () => void copy(field(entry, 'URL'), t('entry', 'Website')) },
    { label: t('menu', 'Edit'), hint: '⌘E', separated: true, action: () => editEntry() },
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

async function copy(value: string, what: string): Promise<void> {
  if (value === '') {
    toast(t('toast', '{what}: empty', { what }));
    return;
  }
  try {
    await copyText(value, settings.clipboardSeconds);
    platform.copied(settings.clipboardSeconds);
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
    // Taken up again by the extension's panel, the file needs a click to be written: this is it.
    if (askToWrite && target instanceof HandleFile) {
      askToWrite = false;
      if (await target.ensureWritable()) {
        updateStatus();
        return save();
      }
    }
    // Chromium can write a new file; elsewhere the only way out is a download.
    const picked = canWriteInPlace ? await pickSaveTarget(target.name) : null;
    if (picked) {
      file = picked;
      void rememberFile(picked);
      return save();
    }
    if (canWriteInPlace) return;
    const data = await saveDatabase(database);
    const how = await shareOrDownload(data, target.name);
    if (how === 'cancelled') return;
    handOver(target.name, data);
    if (revision === started) dirty = false;
    updateStatus();
    toast(how === 'shared' ? t('toast', '{name} shared', { name: target.name }) : t('toast', '{name} downloaded', { name: target.name }));
    return;
  }

  statusState.textContent = t('status', 'Saving…');
  saving = (async () => {
    try {
      const data = await saveDatabase(database);
      await target.write(data);
      if (db === database) handOver(target.name, data);
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

/** Saved: the extension's offscreen document opens this file now, with the key it has now. */
function handOver(name: string, data: ArrayBuffer): void {
  const state: OpenState = { name, data, password: sessionMasterPassword() ?? '', keyFile };
  platform.opened(state);
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
    await shareOrDownload(data, name);
  }
}

function updateStatus(): void {
  if (!db || !file) return;
  statusFile.textContent = file.writable
    ? file.name
    : `${file.name} · ${file instanceof NewFile ? t('status', 'not saved yet') : askToWrite ? t('status', 'saving asks for write access') : sharesFiles() ? t('status', 'read-only, saving shares a copy') : t('status', 'read-only, saving downloads a copy')}`;
  statusState.textContent = dirty ? t('status', 'Unsaved changes') : t('status', 'Saved');
  statusState.classList.toggle('status-state--dirty', dirty);
  const count = entriesBelow(db, db.getDefaultGroup()).length;
  statusFormat.textContent = `${tn('status', '{count} entry', '{count} entries', count)} · ${describeFormat(db)}`;
  el('db-label').textContent = db.meta.name || db.getDefaultGroup().name || file.name;
  document.title = `${dirty ? '• ' : ''}${db.meta.name || file.name} — ${t('app', 'Deterministic Password')}`;
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

async function changeMasterPassword(): Promise<void> {
  if (!db) return;
  if (details.isEditing && !(await details.commit())) return;
  const result = await form({
    title: t('dialog', 'Change master password'),
    message: t('dialog', 'The file is re-encrypted with the new key the next time it is saved.'),
    fields: [
      { name: 'password', label: t('dialog', 'New master password'), type: 'password' },
      { name: 'repeat', label: t('dialog', 'Repeat it'), type: 'password' },
      { name: 'key', label: t('dialog', 'Key file (optional)'), type: 'file' },
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
  const legacy = h('input', { type: 'checkbox' });
  legacy.checked = settings.showLegacy;
  legacy.addEventListener('change', () => {
    settings.showLegacy = legacy.checked;
    saveSettings(settings);
    if (!legacy.checked) forgetLegacySecrets();
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
        platform.settings(settings);
      }),
    ),
    row(
      t('settings', 'Clear clipboard'),
      selectBox(settings.clipboardSeconds, CLIPBOARD_CHOICES.map((s) => [s, s === 0 ? t('settings', 'Never') : t('settings', 'After {count} s', { count: s })] as [number, string]), (seconds) => {
        settings.clipboardSeconds = seconds;
        saveSettings(settings);
        platform.settings(settings);
      }),
    ),
    ...rememberSettings(anchor, row),
    h('label', { class: 'settings-row settings-row--check' }, autosave, h('span', { text: t('settings', 'Save automatically after each change') })),
    h('p', {
      class: 'settings-note',
      text: canWriteInPlace
        ? t('settings', 'Autosave works when the file was opened with write access.')
        : sharesFiles()
          ? t('settings', 'This browser cannot write files in place, so saving shares a copy.')
          : t('settings', 'This browser cannot write files in place, so saving downloads a copy.'),
    }),
    h('label', { class: 'settings-row settings-row--check' }, legacy, h('span', { text: t('settings', 'Show legacy password algorithms') })),
    h('p', { class: 'settings-note', text: t('settings', 'The generator then also offers derived v2 and v1, the calculators of two older programs, to recover passwords made with them.') }),
    h('p', { class: 'settings-note settings-version', text: t('settings', 'Version {version}', { version: __APP_VERSION__ }) }),
  );
  popover(anchor, panel);
}

/** How a remembered database is unlocked, where this page can remember one at all. */
function rememberSettings(anchor: HTMLElement, row: (label: string, control: HTMLElement) => HTMLElement): HTMLElement[] {
  if (!rememberHere.length) return [];
  const current = settings.rememberWith;
  // A way chosen elsewhere that this browser lacks stays shown, with a note, rather than silently changed.
  const ways = rememberHere.includes(current) ? rememberHere : [current, ...rememberHere];
  const choice = selectBox(current, ways.map((way) => [way, rememberLabel(way)] as [RememberWith, string]), (way) => {
    settings.rememberWith = way;
    saveSettings(settings);
    openSettings(anchor);
  });
  choice.dataset['setting'] = 'remember';
  const note = h('p', { class: 'settings-note', 'data-setting': 'remember-note', text: rememberHere.includes(current) ? rememberNote(current) : t('settings', 'Not available in this browser: choose another way.') });
  const remembered = h('p', { class: 'settings-note', 'data-setting': 'remembered' });
  remembered.hidden = true;
  void rememberedCount().then((count) => {
    if (!count) return;
    const forget = h('button', { type: 'button', class: 'link-button', text: t('settings', 'Forget all') });
    forget.addEventListener('click', async () => {
      await forgetAll();
      toast(t('toast', 'Remembered passwords forgotten'));
      openSettings(anchor);
    });
    remembered.replaceChildren(tn('settings', 'Remembered on this device: {count} database.', 'Remembered on this device: {count} databases.', count), ' ', forget);
    remembered.hidden = false;
  });
  // The ways' names are long: the label goes above its list, which takes the whole width.
  const line = row(t('settings', 'Unlock remembered databases with'), choice);
  line.classList.add('settings-row--stacked');
  return [line, note, remembered];
}

function rememberLabel(way: RememberWith): string {
  switch (way) {
    case 'system': {
      const system = systemOf();
      return system === 'mac' ? t('settings', 'Touch ID or the Mac password') : system === 'windows' ? t('settings', 'Windows Hello') : t('settings', 'The screen lock of this device');
    }
    case 'systemClick':
      return t('settings', 'The system prompt, without a password');
    case 'keychain':
      return t('settings', 'Apple Passwords (iCloud Keychain)');
    case 'passkey':
      return t('settings', 'A passkey, with its PIN');
    case 'passkeyClick':
      return t('settings', 'A passkey, without its PIN');
    case 'device':
      return t('settings', 'No prompt, only a click');
  }
}

function rememberNote(way: RememberWith): string {
  switch (way) {
    case 'system':
      return t('settings', 'Each unlock is confirmed by the system: a fingerprint, a face, a PIN or the password of the computer.');
    case 'systemClick':
      return t('settings', 'Each unlock asks the system only to continue: anyone at this computer while it is unlocked can open the database.');
    case 'keychain':
      return t('settings', 'Chrome asks where to keep the passkey: choose iCloud Keychain. Each unlock is confirmed by Touch ID, or by the Mac password where there is no Touch ID.');
    case 'passkey':
      return t('settings', 'Chrome asks where to keep the passkey: Google Password Manager, a phone or a security key. Each unlock asks for its PIN.');
    case 'passkeyClick':
      return t('settings', 'Chrome asks where to keep the passkey. Each unlock asks only to continue: anyone at this computer while it is unlocked can open the database.');
    case 'device':
      return t('settings', 'Anyone who can use this browser on this computer opens the database. Choose it only for a computer that is yours alone.');
  }
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
  platform.languageChanged();
}

function applyLanguage(): void {
  setLanguage(resolveLanguage(settings.language));
  translatePage();
  // No keyboard for the shortcut on a touch screen.
  if (isTouch()) searchInput.placeholder = searchInput.placeholder.replace(/\s*\(⌘[^)]*\)/, '');
  const note = el('browser-note');
  note.hidden = canWriteInPlace;
  note.textContent = canWriteInPlace
    ? ''
    : sharesFiles()
      ? t('gate', 'On this device the file opens read-only: Save hands an updated copy to the share sheet, where "Save to Files" can put it over the original.')
      : isTouch()
        ? t('gate', 'On this device the file opens read-only: Save downloads an updated copy of the database.')
        : t('gate', 'This browser opens the file read-only: Save downloads an updated copy of the database. Chrome, Edge and Arc save changes straight back into the file.');
}

function setTheme(theme: Theme): void {
  settings.theme = theme;
  applyTheme(theme);
  saveSettings(settings);
}

function generatorAt(anchor: HTMLElement, useLabel: string, onUse: (password: string) => void, entry?: GeneratorEntry, kind?: GeneratorKind): void {
  openGenerator({
    anchor,
    options: settings.generator,
    onOptions: (options) => {
      settings.generator = options;
      saveSettings(settings);
    },
    kind: kind ?? settings.generatorKind,
    onKind: (kind) => {
      settings.generatorKind = kind;
      saveSettings(settings);
    },
    legacy: settings.showLegacy,
    usesMaster: { ...settings.legacyUsesMaster },
    onUsesMaster: (kind, uses) => {
      settings.legacyUsesMaster = { ...settings.legacyUsesMaster, [kind]: uses };
      saveSettings(settings);
    },
    useLabel,
    onUse,
    entry,
  });
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
 * The tab beside the extension's panel
 * ------------------------------------------------------------------ */

/** Another page in the tab: the list follows it, from all entries to the site's and back, unless an entry is being edited. */
function pageChanged(): void {
  if (!db) return;
  sidebar.render();
  const page = platform.page();
  if (details.isEditing || searchInput.value) refresh();
  else if (selection.kind === 'site' && !page) void select({ kind: 'all' });
  else if (selection.kind === 'site' || (selection.kind === 'all' && siteEntries().length)) void select({ kind: 'site' });
}

/**
 * "Fill" in the tab's context menu could not fill by itself: locked, no entry
 * for the site, or several. Once unlocked, one entry is filled; none, and a
 * password is made for the page; several, and the list shows them to pick.
 */
async function finishFill(): Promise<void> {
  fillPending = false;
  const page = platform.page();
  if (!db || !page || !platform.fill) return;
  const found = siteEntries();
  if (!details.isEditing) await select({ kind: 'site' });
  const only = found.length === 1 ? found[0] : undefined;
  if (only) {
    await selectEntry(only);
    await platform.fill(only);
  } else if (found.length === 0) await passwordForPage(el('new-entry'));
}

/**
 * Derived v3 for the page: the site is the tab's, the user name what the page
 * has typed. Its button fills the password in and keeps it as a new entry —
 * an ordinary one, as the generator's "Use" makes.
 */
async function passwordForPage(anchor: HTMLElement): Promise<void> {
  const page = platform.page();
  if (!db || !page || !platform.fill) return;
  let user = await platform.typedUser();
  let url = page.origin;
  const entry: GeneratorEntry = {
    url: () => url,
    user: () => user,
    setUrl: (next) => (url = next),
    setUser: (next) => (user = next),
    site: page.site,
  };
  generatorAt(anchor, t('extension', 'Fill'), (password) => void keepForPage(page.site, user, url, password), entry, 'v3');
}

async function keepForPage(site: string, user: string, url: string, password: string): Promise<void> {
  if (!db || (details.isEditing && !(await details.commit()))) return;
  const protection = db.meta.memoryProtection;
  const entry = createEntry(db, db.getDefaultGroup());
  entry.fields.set('Title', makeValue(site, Boolean(protection.title)));
  entry.fields.set('UserName', makeValue(user.trim(), Boolean(protection.userName)));
  entry.fields.set('Password', makeValue(password, true));
  entry.fields.set('URL', makeValue(url.trim(), Boolean(protection.url)));
  activeUuid = uuidOf(entry);
  changed();
  await select(platform.page()?.site === site ? { kind: 'site' } : { kind: 'all' });
  await selectEntry(entry);
  await platform.fill?.(entry, true);
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
rememberedButton.addEventListener('click', () => void unlockRemembered());
unlockForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void unlock();
});
passwordInput.after(maskInput(passwordInput));
// Safari on iOS greys out a file whose extension it does not know when the picker names one;
// chooseFile() checks the name itself.
if (isTouch()) filePicker.removeAttribute('accept');
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
el('generator').addEventListener('click', (event) => toolbarGenerator(event.currentTarget as HTMLElement));
el('settings').addEventListener('click', (event) => openSettings(event.currentTarget as HTMLElement));
el('sort').addEventListener('click', (event) => sortMenu(event.currentTarget as HTMLElement));
// A phone's toolbar has room for these only as a menu.
el('more').addEventListener('click', (event) => {
  const anchor = event.currentTarget as HTMLElement;
  menuAt(anchor, [
    { label: t('menu', 'Password generator'), hint: '⌘G', action: () => toolbarGenerator(anchor) },
    { label: t('menu', 'Settings'), action: () => openSettings(anchor) },
    { label: t('menu', 'Lock'), hint: '⌘L', separated: true, action: () => void lock() },
  ]);
});

/** The generator on its own: the password it makes is copied. */
function toolbarGenerator(anchor: HTMLElement): void {
  generatorAt(anchor, t('generator', 'Copy'), (password) => void copy(password, t('entry', 'Password')));
}

el('toggle-sidebar').addEventListener('click', toggleSidebar);
el('back').addEventListener('click', back);

function toggleSidebar(): void {
  // On a phone the panel slides over the list, and that is not a preference to remember.
  if (isNarrow()) {
    toggleDrawer();
    return;
  }
  settings.sidebarHidden = !settings.sidebarHidden;
  applyPanels(settings);
  saveSettings(settings);
}

searchInput.addEventListener('input', () => {
  refresh();
  const first = list.items[0];
  if (first && !list.items.some((entry) => uuidOf(entry) === activeUuid)) void selectEntry(isNarrow() ? null : first);
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
  const pane = handle.previousElementSibling as HTMLElement;
  /* The styles keep the entry pane from getting too narrow and may give the panel, the
     element before its resizer, less than asked for: what is kept is the width it has,
     so a drag past that limit is not stored. */
  const resize = (width: number): void => {
    settings[key] = Math.round(Math.min(max, Math.max(min, width)));
    applyPanels(settings);
    settings[key] = Math.round(pane.getBoundingClientRect().width);
    applyPanels(settings);
  };
  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const move = (moved: PointerEvent): void => {
      resize(isRightToLeft() ? origin() - moved.clientX : moved.clientX - origin());
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
    resize(pane.getBoundingClientRect().width + (wider ? 16 : -16));
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
  active();
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
        else editEntry();
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
    }
    // ⌘C/⌘B/⌘U copy from the selected entry — unless there is text to copy instead.
    const selected = window.getSelection()?.toString();
    if (!inField && !selected && entry && !details.isEditing && ['c', 'b', 'u'].includes(key)) {
      event.preventDefault();
      if (key === 'c') void copy(field(entry, 'Password'), t('entry', 'Password'));
      if (key === 'b') void copy(field(entry, 'UserName'), t('entry', 'User name'));
      if (key === 'u') void copy(field(entry, 'URL'), t('entry', 'Website'));
    }
    return;
  }

  if (event.key === 'Escape') {
    if (isDrawerOpen()) {
      event.preventDefault();
      closeDrawer();
    } else if (details.isEditing) {
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
    editEntry();
  }
});

/** Edits the selected entry, which on a phone has to come on screen for that. */
function editEntry(): void {
  details.edit();
  if (details.isEditing) showDetails();
}

/* ------------------------------------------------------------------ *
 * Idle lock and leaving the page
 * ------------------------------------------------------------------ */

function active(): void {
  lastActivity = Date.now();
  platform.activity();
}
for (const type of ['pointerdown', 'wheel', 'mousemove'] as const) {
  document.addEventListener(type, active, { passive: true });
}
window.setInterval(() => {
  // In the extension the offscreen document keeps the time, a fill from the menu being activity too.
  if (!db || settings.lockMinutes === 0 || platform.idleElsewhere()) return;
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
applyPanels(settings);
platform.settings(settings);
platform.start({
  lock: async (reason) => {
    await lock(reason);
    return db === null;
  },
  pageChanged,
  fillAsked: () => {
    fillPending = true;
    if (db) void finishFill();
  },
  unlocked: () => {
    if (!db) void platform.resume().then((resumed) => (resumed && !db ? resume(resumed) : undefined));
  },
});
void platform.resume().then(
  (resumed) => (resumed ? resume(resumed) : showGate('pick')),
  () => showGate('pick'),
);
