/**
 * The right column: one entry, to read or to edit.
 *
 * Reading shows the fields with copy buttons, secrets masked until revealed,
 * a live one-time code, tags, attachments and earlier versions. Editing works
 * on a draft: Save applies it in one step — the previous state goes to the
 * entry's history first, as in KeePass — and Cancel drops it.
 */

import { entryAvatar } from './avatar';
import {
  cachedPassword,
  computePassword,
  derivedBits,
  derivedSpec,
  entryPassword,
  hasMasterPassword,
  REQUIREMENT_DEFAULTS,
  serializeDerived,
  siteOf,
  specProblem,
  VERSION_MAX,
  type Derived,
  type DerivedSpec,
} from './derived';
import { download } from './files';
import { strength } from './generator';
import { bitsLevel, requirementControls } from './genpanel';
import { dateFormat, t, tn } from './i18n';
import {
  addAttachment,
  binaryBytes,
  customFields,
  field,
  groupPath,
  inRecycleBin,
  isProtected,
  isStandard,
  makeValue,
  STANDARD_FIELDS,
  titleOf,
  type Entry,
  type Kdbx,
  type kdbxweb,
} from './kdbx';
import { formatCode, OTP_FIELDS, otpFromFields, otpUrl, parseOtpValue, secondsLeft, totp, type OtpParams } from './otp';
import { safeHref } from './search';
import { bindLayoutBadge, h, icon, ICONS, maskInput, menuAt, setRevealed, syncMask, type MenuItem } from './ui';

type Binary = kdbxweb.KdbxBinary | kdbxweb.KdbxBinaryWithHash;

export interface DetailsHost {
  db(): Kdbx | null;
  /** A promise for a value still being computed, such as a derived password. */
  copy(value: string | Promise<string>, what: string): void;
  /** An edit was applied to the entry: mark the file dirty, refresh the list. */
  changed(entry: Entry): void;
  remove(entry: Entry): void;
  restore(entry: Entry): void;
  duplicate(entry: Entry): void;
  moveMenu(entry: Entry, anchor: HTMLElement): void;
  /** A brand-new entry was cancelled before its first save: drop it without a trace. */
  discard(entry: Entry): void;
  generator(anchor: HTMLElement, onUse: (password: string) => void): void;
  editingChanged(editing: boolean): void;
  confirmDiscard(): Promise<boolean>;
}

interface DraftField {
  name: string;
  value: string;
  protect: boolean;
}

interface Draft {
  title: string;
  username: string;
  /** The stored password; unused while `derived` is set. */
  password: string;
  /** Settings of a password derived from the master password, null for a stored one. */
  derived: DerivedSpec | null;
  url: string;
  notes: string;
  fields: DraftField[];
  tags: string;
  expires: boolean;
  expiry: string;
  binaries: [string, Binary][];
  added: { name: string; data: ArrayBuffer }[];
}

const dateTime = (): Intl.DateTimeFormat => dateFormat({ dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = (): Intl.DateTimeFormat => dateFormat({ dateStyle: 'medium' });
const MASK = '••••••••••';

export class Details {
  private entry: Entry | null = null;
  private editing = false;
  private isNew = false;
  private draft: Draft | null = null;
  private pristine = '';
  private historyIndex: number | null = null;
  private revealed = new Set<string>();
  private otpTimer = 0;
  private error = '';
  /** Recomputes the derived password preview after the user name or the website changed. */
  private accountChanged: (() => void) | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly placeholder: HTMLElement,
    private readonly host: DetailsHost,
  ) {}

  get current(): Entry | null {
    return this.entry;
  }

  get isEditing(): boolean {
    return this.editing;
  }

  show(entry: Entry | null): void {
    if (entry !== this.entry) {
      this.revealed.clear();
      this.historyIndex = null;
    }
    this.entry = entry;
    this.editing = false;
    this.draft = null;
    this.isNew = false;
    this.error = '';
    this.host.editingChanged(false);
    this.render();
  }

  /** Re-renders the same entry after an outside change (a move, a save). */
  refresh(): void {
    if (!this.editing) this.render();
  }

  /** Re-renders even a draft, which is kept: after the language changed. */
  redraw(): void {
    this.render();
  }

  edit(isNew = false): void {
    const db = this.host.db();
    if (!this.entry || !db || inRecycleBin(db, this.entry)) return;
    this.editing = true;
    this.isNew = isNew;
    this.historyIndex = null;
    this.draft = draftOf(this.entry);
    this.pristine = snapshot(this.draft);
    this.error = '';
    this.host.editingChanged(true);
    this.render();
    const focus = this.root.querySelector<HTMLInputElement>(isNew ? '[data-field="title"]' : '[data-field="password"]');
    focus?.focus();
    if (isNew) focus?.select();
  }

  get dirty(): boolean {
    return this.editing && this.draft !== null && (this.isNew || snapshot(this.draft) !== this.pristine);
  }

  /** Applies the draft. False when it has a problem to fix first. */
  async commit(): Promise<boolean> {
    const db = this.host.db();
    const entry = this.entry;
    const draft = this.draft;
    if (!this.editing || !db || !entry || !draft) return true;
    if (draft.derived) draft.derived.site = siteOf(draft.url);
    const problem = validate(draft);
    if (problem) {
      this.error = problem;
      this.render();
      return false;
    }
    // Saving a derived password records which master password, website and user name it came from.
    if (draft.derived && hasMasterPassword()) draft.derived.check = (await computePassword(draft.derived, draft.username)).check;
    if (snapshot(draft) !== this.pristine || this.isNew) {
      if (!this.isNew) entry.pushHistory();
      await applyDraft(db, entry, draft);
      entry.times.update();
      this.editing = false;
      this.draft = null;
      this.host.editingChanged(false);
      this.host.changed(entry);
    } else {
      this.editing = false;
      this.draft = null;
      this.host.editingChanged(false);
    }
    this.isNew = false;
    this.render();
    return true;
  }

  /** Drops the draft, asking first if it holds changes. False if the user kept editing. */
  async cancel(): Promise<boolean> {
    if (!this.editing || !this.entry) return true;
    if (this.draft && snapshot(this.draft) !== this.pristine && !(await this.host.confirmDiscard())) return false;
    const entry = this.entry;
    const wasNew = this.isNew;
    this.editing = false;
    this.draft = null;
    this.isNew = false;
    this.error = '';
    this.host.editingChanged(false);
    if (wasNew) {
      this.entry = null;
      this.host.discard(entry);
    }
    this.render();
    return true;
  }

  showHistory(index: number | null): void {
    if (!this.entry || this.editing) return;
    const count = this.entry.history.length;
    this.historyIndex = index === null || count === 0 ? null : Math.max(0, Math.min(count - 1, index));
    this.render();
  }

  /* ---------------------------------------------------------------- *
   * Rendering
   * ---------------------------------------------------------------- */

  private render(): void {
    window.clearInterval(this.otpTimer);
    const db = this.host.db();
    const entry = this.entry;
    this.placeholder.hidden = Boolean(entry && db);
    this.root.hidden = !(entry && db);
    if (!entry || !db) {
      this.root.replaceChildren();
      return;
    }
    if (this.editing && this.draft) this.root.replaceChildren(this.renderEdit(db, entry, this.draft));
    else this.root.replaceChildren(this.renderRead(db, entry));
  }

  private renderRead(db: Kdbx, entry: Entry): HTMLElement {
    const version = this.historyIndex === null ? null : (entry.history[this.historyIndex] ?? null);
    const shown = version ?? entry;
    const trashed = inRecycleBin(db, entry);
    const out = h('article', { class: 'details' });

    const actions = h('div', { class: 'details-actions' });
    if (!version) {
      if (trashed) {
        actions.append(button(t('entry', 'Restore'), () => this.host.restore(entry), 'button--small'));
      } else {
        actions.append(button(t('entry', 'Edit'), () => this.edit(), 'button--small', t('entry', 'Edit (⌘E)')));
      }
      const more = h('button', { type: 'button', class: 'icon-button', title: t('entry', 'More'), 'aria-haspopup': 'true' }, icon(ICONS.more));
      more.addEventListener('click', () => menuAt(more, this.moreItems(entry, trashed, more)));
      actions.append(more);
    }

    const path = groupPath(entry.parentGroup);
    out.append(
      h(
        'header',
        { class: 'details-head' },
        entryAvatar(db, shown, 'large'),
        h(
          'div',
          { class: 'details-heading' },
          h('h2', { class: 'details-title', text: titleOf(shown) }),
          h('div', { class: 'details-path', text: (trashed ? [t('sidebar', 'Recycle bin')] : path).join(' › ') || (db.getDefaultGroup().name ?? '') }),
        ),
        actions,
      ),
    );

    if (version && this.historyIndex !== null) out.append(this.historyBar(entry, this.historyIndex));

    const rows = h('div', { class: 'fields' });
    this.addRow(rows, shown, 'UserName', t('entry', 'User name'));
    this.passwordRow(rows, shown);
    const url = field(shown, 'URL');
    if (url) rows.append(this.urlRow(url));
    const otp = otpFromFields((name) => (shown.fields.has(name) ? field(shown, name) : undefined));
    if (otp) rows.append(this.otpRow(otp));
    for (const name of customFields(shown)) {
      if (otp && OTP_FIELDS.includes(name)) continue;
      this.addRow(rows, shown, name, name);
    }
    const notes = field(shown, 'Notes');
    if (notes) {
      rows.append(fieldRow(t('entry', 'Notes'), h('div', { class: 'field-value field-value--notes', text: notes }), [this.copyButton(notes, t('entry', 'Notes'))]));
    }
    if (shown.tags.length) {
      const chips = h('div', { class: 'field-value tags' });
      for (const tag of shown.tags) chips.append(h('span', { class: 'tag', text: tag }));
      rows.append(fieldRow(t('entry', 'Tags'), chips, []));
    }
    if (shown.times.expires && shown.times.expiryTime) {
      const expired = shown.times.expiryTime.getTime() < Date.now();
      rows.append(
        fieldRow(
          t('entry', 'Expires'),
          h('div', {
            class: `field-value${expired ? ' field-value--expired' : ''}`,
            text: expired ? t('entry', '{date} — expired', { date: dateOnly().format(shown.times.expiryTime) }) : dateOnly().format(shown.times.expiryTime),
          }),
          [],
        ),
      );
    }
    if (rows.childElementCount === 0) rows.append(h('p', { class: 'details-empty', text: t('entry', 'This entry has no fields yet.') }));
    out.append(rows);

    if (shown.binaries.size) out.append(this.attachments(shown, false));

    const meta = h('footer', { class: 'details-meta' });
    if (shown.times.creationTime) meta.append(h('span', { text: t('entry', 'Created {date}', { date: dateTime().format(shown.times.creationTime) }) }));
    if (shown.times.lastModTime) meta.append(h('span', { text: t('entry', 'Modified {date}', { date: dateTime().format(shown.times.lastModTime) }) }));
    if (!version && entry.history.length) {
      const history = h('button', { type: 'button', class: 'link-button' }, icon(ICONS.history), tn('entry', '{count} earlier version', '{count} earlier versions', entry.history.length));
      history.addEventListener('click', () => this.showHistory(entry.history.length - 1));
      meta.append(history);
    }
    out.append(meta);
    return out;
  }

  private moreItems(entry: Entry, trashed: boolean, anchor: HTMLElement): MenuItem[] {
    if (trashed) {
      return [
        { label: t('menu', 'Restore'), action: () => this.host.restore(entry) },
        { label: t('menu', 'Delete permanently'), danger: true, action: () => this.host.remove(entry) },
      ];
    }
    return [
      { label: t('menu', 'Copy user name'), hint: '⌘B', action: () => this.host.copy(field(entry, 'UserName'), t('entry', 'User name')) },
      { label: t('menu', 'Copy password'), hint: '⌘C', action: () => this.host.copy(entryPassword(entry), t('entry', 'Password')) },
      { label: t('menu', 'Copy website'), hint: '⌘U', action: () => this.host.copy(field(entry, 'URL'), t('entry', 'Website')) },
      { label: t('menu', 'Duplicate'), separated: true, action: () => this.host.duplicate(entry) },
      { label: t('menu', 'Move to group…'), action: () => this.host.moveMenu(entry, anchor) },
      { label: t('menu', 'Delete'), danger: true, separated: true, hint: '⌫', action: () => this.host.remove(entry) },
    ];
  }

  private historyBar(entry: Entry, index: number): HTMLElement {
    const version = entry.history[index];
    const when = version?.times.lastModTime ? dateTime().format(version.times.lastModTime) : t('entry', 'unknown date');
    const older = button(t('entry', '‹ Older'), () => this.showHistory(index - 1), 'button--small button--ghost');
    const newer = button(t('entry', 'Newer ›'), () => this.showHistory(index + 1), 'button--small button--ghost');
    older.disabled = index === 0;
    newer.disabled = index >= entry.history.length - 1;
    const restore = button(t('entry', 'Restore this version'), () => this.restoreVersion(entry, index), 'button--small');
    const close = h('button', { type: 'button', class: 'icon-button', title: t('entry', 'Back to the current version') }, icon(ICONS.close));
    close.addEventListener('click', () => this.showHistory(null));
    return h(
      'div',
      { class: 'history-bar' },
      h('span', { class: 'history-text', text: t('entry', 'Version of {date} · {index} of {count}', { date: when, index: index + 1, count: entry.history.length }) }),
      older,
      newer,
      restore,
      close,
    );
  }

  private restoreVersion(entry: Entry, index: number): void {
    const version = entry.history[index];
    if (!version) return;
    entry.pushHistory();
    entry.fields = new Map();
    for (const [name, value] of version.fields) entry.fields.set(name, typeof value === 'string' ? value : value.clone());
    entry.binaries = new Map(version.binaries);
    entry.tags = version.tags.slice();
    entry.icon = version.icon;
    entry.customIcon = version.customIcon;
    entry.bgColor = version.bgColor;
    entry.fgColor = version.fgColor;
    entry.times.expires = version.times.expires;
    entry.times.expiryTime = version.times.expiryTime;
    entry.times.update();
    this.historyIndex = null;
    this.host.changed(entry);
    this.render();
  }

  private addRow(rows: HTMLElement, entry: Entry, name: string, label: string): void {
    const value = field(entry, name);
    if (!value) return;
    const secret = isProtected(entry, name) || name === 'Password';
    if (!secret) {
      rows.append(fieldRow(label, h('div', { class: 'field-value', text: value }), [this.copyButton(value, label)]));
      return;
    }
    const shown = this.revealed.has(name);
    const text = h('div', { class: `field-value field-value--secret${shown ? ' field-value--shown' : ''}`, text: shown ? value : MASK });
    const reveal = h('button', { type: 'button', class: 'icon-button icon-button--small', title: shown ? t('entry', 'Hide') : t('entry', 'Show') }, icon(shown ? ICONS.eyeOff : ICONS.eye));
    reveal.addEventListener('click', () => {
      if (this.revealed.has(name)) this.revealed.delete(name);
      else this.revealed.add(name);
      this.render();
    });
    rows.append(fieldRow(label, text, [reveal, this.copyButton(value, label)]));
  }

  /** A stored password is an ordinary secret row; a derived one is computed when revealed or copied. */
  private passwordRow(rows: HTMLElement, entry: Entry): void {
    const label = t('entry', 'Password');
    let spec: DerivedSpec | null;
    try {
      spec = derivedSpec(entry);
    } catch (error) {
      rows.append(fieldRow(label, h('div', { class: 'field-value field-value--error', text: messageOf(error) }), []));
      return;
    }
    if (!spec) {
      this.addRow(rows, entry, 'Password', label);
      return;
    }
    const derived = spec;
    const user = field(entry, 'UserName');
    const shown = this.revealed.has('Password');
    const hit = cachedPassword(derived, user);
    const value = h('div', { class: `field-value field-value--secret${shown ? ' field-value--shown' : ''}`, text: shown ? (hit?.password ?? '…') : MASK });
    const note = h('div', { class: 'field-note', hidden: '' });
    const checked = (result: Derived): void => {
      // No check yet: the entry was saved without the master password at hand.
      note.hidden = !derived.check || result.check === derived.check;
      note.textContent = t('derived', 'The master password, the website or the user name has changed since this password was saved, so it is a different password now.');
    };
    if (hit) checked(hit);
    else if (shown) {
      computePassword(derived, user).then(
        (result) => {
          value.textContent = result.password;
          checked(result);
        },
        (error: unknown) => {
          value.textContent = messageOf(error);
          value.classList.add('field-value--error');
        },
      );
    }
    const about = h('div', { class: 'field-hint', text: t('derived', 'Derived · {site} · version {version}', { site: derived.site, version: derived.version }) });
    const reveal = h('button', { type: 'button', class: 'icon-button icon-button--small', title: shown ? t('entry', 'Hide') : t('entry', 'Show') }, icon(shown ? ICONS.eyeOff : ICONS.eye));
    reveal.addEventListener('click', () => {
      if (this.revealed.has('Password')) this.revealed.delete('Password');
      else this.revealed.add('Password');
      this.render();
    });
    const copy = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('entry', 'Copy {what}', { what: label.toLowerCase() }) }, icon(ICONS.copy));
    copy.addEventListener('click', () => this.host.copy(computePassword(derived, user).then((result) => result.password), label));
    rows.append(fieldRow(label, h('div', { class: 'field-stack field-stack--tight' }, value, about, note), [reveal, copy]));
  }

  private urlRow(url: string): HTMLElement {
    const href = safeHref(url);
    const value = href
      ? h('a', { class: 'field-value field-link', href, target: '_blank', rel: 'noopener noreferrer', text: url })
      : h('div', { class: 'field-value', text: url });
    const actions: HTMLElement[] = [this.copyButton(url, t('entry', 'Website'))];
    if (href) {
      const open = h('a', { class: 'icon-button icon-button--small', href, target: '_blank', rel: 'noopener noreferrer', title: t('entry', 'Open') }, icon(ICONS.open));
      actions.unshift(open);
    }
    return fieldRow(t('entry', 'Website'), value, actions);
  }

  private otpRow(otp: OtpParams): HTMLElement {
    const { value, copy } = this.otpCode(() => otp);
    return fieldRow(t('entry', 'One-time code'), value, [copy]);
  }

  /** The live code with its countdown; `params` is asked on every tick, so an editor can change it. */
  private otpCode(params: () => OtpParams | null): { value: HTMLElement; copy: HTMLButtonElement; tick: () => void } {
    const code = h('span', { class: 'otp-code', text: '··· ···' });
    const ring = h('span', { class: 'otp-ring' });
    const copy = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('entry', 'Copy') }, icon(ICONS.copy));
    let current = '';
    let turn = 0;
    const tick = (): void => {
      const otp = params();
      const mine = (turn += 1);
      copy.disabled = !otp;
      if (!otp) {
        current = '';
        code.textContent = '··· ···';
        ring.style.setProperty('--left', '0');
        ring.removeAttribute('title');
        return;
      }
      const left = secondsLeft(otp);
      ring.style.setProperty('--left', String(left / otp.period));
      ring.title = t('entry', '{seconds} s left', { seconds: left });
      ring.classList.toggle('otp-ring--late', left <= 5);
      void totp(otp).then((next) => {
        if (mine !== turn) return;
        current = next;
        code.textContent = formatCode(next);
      });
    };
    tick();
    this.otpTimer = window.setInterval(tick, 1000);
    copy.addEventListener('click', () => {
      if (current) this.host.copy(current, t('entry', 'One-time code'));
    });
    return { value: h('div', { class: 'field-value otp' }, code, ring), copy, tick };
  }

  private copyButton(value: string, label: string): HTMLElement {
    const copy = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('entry', 'Copy {what}', { what: label.toLowerCase() }) }, icon(ICONS.copy));
    copy.addEventListener('click', () => this.host.copy(value, label));
    return copy;
  }

  private attachments(entry: Entry, editable: boolean, draft?: Draft): HTMLElement {
    const list = h('div', { class: 'attachments' });
    const items: [string, Binary | ArrayBuffer][] = draft
      ? [...draft.binaries, ...draft.added.map((item) => [item.name, item.data] as [string, ArrayBuffer])]
      : [...entry.binaries];
    for (const [name, value] of items) {
      const bytes = binaryBytes(value as Binary);
      const chip = h('div', { class: 'attachment' }, icon(ICONS.clip), h('span', { class: 'attachment-name', text: name }), h('span', { class: 'attachment-size', text: formatSize(bytes.byteLength) }));
      if (editable && draft) {
        const remove = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('entry', 'Remove') }, icon(ICONS.close));
        remove.addEventListener('click', () => {
          draft.binaries = draft.binaries.filter(([other]) => other !== name);
          draft.added = draft.added.filter((item) => item.name !== name);
          this.render();
        });
        chip.append(remove);
      } else {
        const save = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('entry', 'Download') }, icon(ICONS.download));
        save.addEventListener('click', () => download(bytes, name));
        chip.append(save);
      }
      list.append(chip);
    }
    return h('section', { class: 'details-section' }, h('h3', { class: 'section-title', text: t('entry', 'Attachments') }), list);
  }

  /* ---------------------------------------------------------------- *
   * Editing
   * ---------------------------------------------------------------- */

  private renderEdit(db: Kdbx, entry: Entry, draft: Draft): HTMLElement {
    const out = h('form', { class: 'details details--edit', autocomplete: 'off' });
    out.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.commit();
    });

    const title = input(draft.title, t('entry', 'Title'), (value) => (draft.title = value), 'title');
    title.classList.add('details-title-input');
    out.append(
      h(
        'header',
        { class: 'details-head' },
        entryAvatar(db, entry, 'large'),
        h('div', { class: 'details-heading' }, title, h('div', { class: 'details-path', text: groupPath(entry.parentGroup).join(' › ') })),
        h(
          'div',
          { class: 'details-actions' },
          button(t('entry', 'Cancel'), () => void this.cancel(), 'button--small button--ghost', t('entry', 'Cancel (Esc)')),
          h('button', { type: 'submit', class: 'button button--primary button--small', title: t('entry', 'Save (⌘Enter)'), text: t('entry', 'Save') }),
        ),
      ),
    );

    const rows = h('div', { class: 'fields' });
    this.accountChanged = null;
    const username = input(draft.username, t('entry', 'User name'), (value) => {
      draft.username = value;
      this.accountChanged?.();
    }, 'username');
    rows.append(editRow(t('entry', 'User name'), username));
    rows.append(this.passwordEditor(draft));
    const website = input(draft.url, 'https://', (value) => {
      draft.url = value;
      this.accountChanged?.();
    }, 'url');
    rows.append(editRow(t('entry', 'Website'), website));
    const otp = draft.fields.find((item) => item.name === 'otp');
    if (otp) rows.append(this.otpEditor(draft, otp));

    const notes = h('textarea', { class: 'field-input field-input--notes', rows: '4', placeholder: t('entry', 'Notes'), 'data-field': 'notes', spellcheck: 'false' });
    notes.value = draft.notes;
    const grow = (): void => {
      notes.style.height = 'auto';
      notes.style.height = `${Math.min(notes.scrollHeight + 2, 480)}px`;
    };
    notes.addEventListener('input', () => {
      draft.notes = notes.value;
      grow();
    });
    requestAnimationFrame(grow);
    rows.append(editRow(t('entry', 'Notes'), notes));

    for (const item of draft.fields) if (item !== otp) rows.append(this.customEditor(draft, item));
    const add = button(t('entry', '+ Add field'), () => {
      draft.fields.push({ name: '', value: '', protect: false });
      this.render();
      const names = this.root.querySelectorAll<HTMLInputElement>('.custom-name');
      names[names.length - 1]?.focus();
    }, 'button--small button--ghost');
    const adders = h('div', { class: 'field-adders' }, add);
    // An entry already set up in another convention (KeePass's TimeOtp-*, TrayTOTP) keeps it: those fields are edited as they are.
    if (!draft.fields.some((item) => OTP_FIELDS.includes(item.name.trim()))) {
      adders.append(
        button(t('entry', '+ One-time code'), () => {
          draft.fields.push({ name: 'otp', value: '', protect: true });
          this.render();
          this.root.querySelector<HTMLInputElement>('[data-field="otp"]')?.focus();
        }, 'button--small button--ghost', t('entry', 'Add a key for two-factor codes (TOTP)')),
      );
    }
    rows.append(h('div', { class: 'field field--add' }, h('span', { class: 'field-label' }), adders));

    rows.append(editRow(t('entry', 'Tags'), input(draft.tags, t('entry', 'Comma-separated'), (value) => (draft.tags = value), 'tags')));

    const expires = h('input', { type: 'checkbox', 'aria-label': t('entry', 'Expires') });
    expires.checked = draft.expires;
    const expiry = h('input', { type: 'date', class: 'field-input field-input--date' });
    expiry.value = draft.expiry;
    expiry.disabled = !draft.expires;
    expires.addEventListener('change', () => {
      draft.expires = expires.checked;
      expiry.disabled = !expires.checked;
      if (expires.checked && !expiry.value) {
        const inYear = new Date(Date.now() + 365 * 86400000);
        expiry.value = draft.expiry = isoDate(inYear);
      }
    });
    expiry.addEventListener('input', () => (draft.expiry = expiry.value));
    rows.append(editRow(t('entry', 'Expires'), h('div', { class: 'field-inline' }, expires, expiry)));
    out.append(rows);

    const attachments = this.attachments(entry, true, draft);
    const picker = h('input', { type: 'file', multiple: '', hidden: '' });
    picker.addEventListener('change', async () => {
      for (const file of Array.from(picker.files ?? [])) {
        draft.added = draft.added.filter((item) => item.name !== file.name);
        draft.binaries = draft.binaries.filter(([name]) => name !== file.name);
        draft.added.push({ name: file.name, data: await file.arrayBuffer() });
      }
      this.render();
    });
    const attach = button(t('entry', '+ Attach file'), () => picker.click(), 'button--small button--ghost');
    attachments.append(picker, attach);
    out.append(attachments);

    if (this.error) out.append(h('p', { class: 'details-error', role: 'alert', text: this.error }));
    out.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void this.commit();
      }
    });
    return out;
  }

  /** Several controls share the row, so it is no <label>: a click on its text would press the first button. */
  private passwordEditor(draft: Draft): HTMLElement {
    const body = draft.derived ? this.derivedEditor(draft, draft.derived) : this.storedEditor(draft);
    return h('div', { class: 'field field--edit' }, h('span', { class: 'field-label', text: t('entry', 'Password') }), h('div', { class: 'field-stack' }, this.passwordMode(draft), ...body));
  }

  private passwordMode(draft: Draft): HTMLElement {
    const stored = h('button', { type: 'button', class: 'segment', 'aria-pressed': String(!draft.derived), text: t('derived', 'Stored') });
    const derived = h('button', {
      type: 'button',
      class: 'segment',
      'aria-pressed': String(Boolean(draft.derived)),
      text: t('derived', 'Derived'),
      title: t('derived', 'Computed from the master password, the site, the user name and the version: it can be recovered without the file'),
    });
    if (!draft.derived && !hasMasterPassword()) {
      derived.disabled = true;
      derived.title = t('derived', 'Needs a master password, and this database opens with a key file alone');
    }
    stored.addEventListener('click', async () => {
      if (!draft.derived) return;
      // The same password, now kept in the file.
      try {
        draft.password = (await computePassword(draft.derived, draft.username)).password;
      } catch {
        /* incomplete settings: keep whatever was stored before */
      }
      draft.derived = null;
      this.render();
    });
    derived.addEventListener('click', () => {
      if (draft.derived) return;
      draft.derived = { ...REQUIREMENT_DEFAULTS, site: siteOf(draft.url), version: 1 };
      this.render();
      // The site comes from the website: an empty one is the first thing to fill in.
      if (!draft.url.trim()) this.root.querySelector<HTMLInputElement>('[data-field="url"]')?.focus();
    });
    return h('div', { class: 'segments', role: 'group' }, stored, derived);
  }

  private derivedEditor(draft: Draft, spec: DerivedSpec): HTMLElement[] {
    const value = h('div', { class: 'field-value field-value--secret derived-preview', text: '…' });
    const note = h('div', { class: 'field-note', hidden: '' });
    const bits = h('span', { class: 'gen-bits' });
    const site = h('span', { class: 'derived-site' });
    let current = '';
    let timer = 0;
    let turn = 0;

    const paint = (): void => {
      const shown = this.revealed.has('Password');
      value.classList.toggle('field-value--shown', shown && Boolean(current));
      value.textContent = current ? (shown ? current : MASK) : '…';
    };
    const problem = (text: string): void => {
      current = '';
      value.textContent = '—';
      note.hidden = false;
      note.textContent = text;
    };
    // Argon2 runs only when the site, user name or version changed; the requirements merely reshape its output.
    const update = (delay: number): void => {
      window.clearTimeout(timer);
      const mine = (turn += 1);
      spec.site = siteOf(draft.url);
      site.textContent = spec.site ? t('derived', 'Site: {site}, from the website', { site: spec.site }) : '';
      const entropy = derivedBits(spec);
      bits.textContent = tn('generator', '{count} bit', '{count} bits', entropy);
      bits.dataset['level'] = bitsLevel(entropy);
      const wrong = specProblem(spec);
      if (wrong) return problem(wrong);
      note.hidden = true;
      const hit = cachedPassword(spec, draft.username);
      if (hit) {
        current = hit.password;
        return paint();
      }
      current = '';
      paint();
      timer = window.setTimeout(() => {
        computePassword({ ...spec }, draft.username).then(
          (result) => {
            if (mine !== turn) return;
            current = result.password;
            paint();
          },
          (error: unknown) => {
            if (mine === turn) problem(messageOf(error));
          },
        );
      }, delay);
    };
    this.accountChanged = () => update(400);

    const reveal = h('button', { type: 'button', class: 'icon-button icon-button--small' });
    const paintReveal = (): void => {
      const shown = this.revealed.has('Password');
      reveal.title = shown ? t('entry', 'Hide') : t('entry', 'Show');
      reveal.replaceChildren(icon(shown ? ICONS.eyeOff : ICONS.eye));
    };
    paintReveal();
    reveal.addEventListener('click', () => {
      if (this.revealed.has('Password')) this.revealed.delete('Password');
      else this.revealed.add('Password');
      paintReveal();
      paint();
    });
    const copy = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('entry', 'Copy {what}', { what: t('entry', 'Password').toLowerCase() }) }, icon(ICONS.copy));
    copy.addEventListener('click', () => this.host.copy(computePassword({ ...spec }, draft.username).then((result) => result.password), t('entry', 'Password')));

    const version = h('input', { type: 'number', class: 'field-input derived-version', min: '1', max: String(VERSION_MAX), step: '1', 'aria-label': t('derived', 'Version') });
    version.value = String(spec.version);
    version.addEventListener('input', () => {
      spec.version = version.value.trim() ? Number(version.value) : NaN;
      update(400);
    });
    const next = h('button', { type: 'button', class: 'button button--small button--ghost', text: '+1', title: t('derived', 'Next version: a new password for the same site and user name') });
    next.addEventListener('click', () => {
      spec.version = Number.isInteger(spec.version) && spec.version < VERSION_MAX ? spec.version + 1 : 1;
      version.value = String(spec.version);
      update(0);
    });

    update(0);
    return [
      h('div', { class: 'field-inline' }, value, reveal, copy),
      h('div', { class: 'derived-inputs' }, h('label', { class: 'derived-input' }, h('span', { class: 'derived-caption', text: t('derived', 'Version') }), h('span', { class: 'field-inline' }, version, next)), site),
      ...requirementControls(spec, () => update(0)),
      h('div', { class: 'derived-foot' }, bits, h('span', { class: 'field-hint', text: t('derived', 'Nothing but these settings is saved; the password is computed each time.') })),
      note,
    ];
  }

  private storedEditor(draft: Draft): HTMLElement[] {
    const shown = this.revealed.has('Password');
    const pass = input(draft.password, t('entry', 'Password'), (value) => {
      draft.password = value;
      paint();
    }, 'password');
    const layer = maskInput(pass);
    setRevealed(pass, shown);
    pass.classList.add('field-input--secret');
    const badge = h('span', { class: 'layout-badge' });
    const updateLayout = bindLayoutBadge(pass, badge);
    const meter = h('div', { class: 'meter' }, h('span', { class: 'meter-bar' }), h('span', { class: 'meter-label' }));
    const paint = (): void => {
      const result = strength(draft.password);
      meter.dataset['level'] = String(result.level);
      const label = meter.querySelector('.meter-label');
      if (label) label.textContent = draft.password ? `${result.label} · ${tn('generator', '{count} bit', '{count} bits', result.bits)}` : '';
    };
    paint();
    const reveal = h('button', { type: 'button', class: 'icon-button icon-button--small', title: shown ? t('entry', 'Hide') : t('entry', 'Show') }, icon(shown ? ICONS.eyeOff : ICONS.eye));
    reveal.addEventListener('click', () => {
      if (this.revealed.has('Password')) this.revealed.delete('Password');
      else this.revealed.add('Password');
      setRevealed(pass, this.revealed.has('Password'));
      reveal.replaceChildren(icon(this.revealed.has('Password') ? ICONS.eyeOff : ICONS.eye));
    });
    const dice = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('entry', 'Generate (⌘G)'), 'data-generate': '' }, icon(ICONS.dice));
    dice.addEventListener('click', () =>
      this.host.generator(dice, (value) => {
        draft.password = value;
        pass.value = value;
        syncMask(pass);
        this.revealed.add('Password');
        setRevealed(pass, true);
        reveal.replaceChildren(icon(ICONS.eyeOff));
        updateLayout();
        paint();
      }),
    );
    return [h('div', { class: 'field-inline' }, h('span', { class: 'secret-field' }, pass, layer, badge), reveal, dice), meter];
  }

  private customEditor(draft: Draft, item: DraftField): HTMLElement {
    const name = h('input', { class: 'field-input custom-name', placeholder: t('entry', 'Name'), value: item.name, spellcheck: 'false' });
    name.addEventListener('input', () => (item.name = name.value));
    const value = input(item.value, t('entry', 'Value'), (text) => (item.value = text));
    if (item.protect) value.classList.add('field-input--secret');
    const lock = h('button', { type: 'button', class: 'icon-button icon-button--small', title: item.protect ? t('entry', 'Protected — click to store as plain text') : t('entry', 'Plain text — click to protect'), 'aria-pressed': String(item.protect) }, icon(item.protect ? ICONS.lock : ICONS.unlock));
    lock.addEventListener('click', () => {
      item.protect = !item.protect;
      this.render();
    });
    const remove = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('entry', 'Remove field') }, icon(ICONS.trash));
    remove.addEventListener('click', () => {
      draft.fields = draft.fields.filter((other) => other !== item);
      this.render();
    });
    return h('div', { class: 'field field--custom' }, name, h('div', { class: 'field-inline' }, value, lock, remove));
  }

  /** The `otp` field: the setup key a site gives for two-factor codes, with the code it makes to confirm it. */
  private otpEditor(draft: Draft, item: DraftField): HTMLElement {
    const key = input(item.value, t('entry', 'Setup key or otpauth:// link'), (text) => {
      item.value = text;
      check();
      tick();
    }, 'otp');
    // The key makes codes for good, so it is masked like the password; the code it makes is not.
    const layer = maskInput(key);
    setRevealed(key, this.revealed.has('otp'));
    key.classList.add('field-input--secret');
    const reveal = h('button', { type: 'button', class: 'icon-button icon-button--small' });
    const paintReveal = (): void => {
      const shown = this.revealed.has('otp');
      reveal.title = shown ? t('entry', 'Hide') : t('entry', 'Show');
      reveal.replaceChildren(icon(shown ? ICONS.eyeOff : ICONS.eye));
    };
    paintReveal();
    reveal.addEventListener('click', () => {
      if (this.revealed.has('otp')) this.revealed.delete('otp');
      else this.revealed.add('otp');
      setRevealed(key, this.revealed.has('otp'));
      paintReveal();
    });
    const remove = h('button', { type: 'button', class: 'icon-button icon-button--small', title: t('entry', 'Remove one-time code') }, icon(ICONS.trash));
    remove.addEventListener('click', () => {
      draft.fields = draft.fields.filter((other) => other !== item);
      this.render();
    });
    const note = h('div', { class: 'field-note', hidden: '' });
    const check = (): void => {
      note.hidden = !item.value.trim() || Boolean(parseOtpValue(item.value));
      note.textContent = t('entry', 'Not a key: it has the letters A–Z and the digits 2–7, or is an otpauth://totp/ link');
    };
    check();
    const { value, copy, tick } = this.otpCode(() => parseOtpValue(item.value));
    return h(
      'div',
      { class: 'field field--edit' },
      h('span', { class: 'field-label', text: t('entry', 'One-time code') }),
      h(
        'div',
        { class: 'field-stack' },
        h('div', { class: 'field-inline' }, h('span', { class: 'secret-field' }, key, layer), reveal, remove),
        note,
        h('div', { class: 'field-inline' }, value, copy),
        h('span', { class: 'field-hint', text: t('entry', 'The key the site shows next to the QR code, for entering it by hand. Enter the code above on the site to finish.') }),
      ),
    );
  }

  /** Called by ⌘G while editing: fills the password field from the generator. */
  generate(): void {
    this.root.querySelector<HTMLButtonElement>('[data-generate]')?.click();
  }
}

/* ------------------------------------------------------------------ *
 * Draft helpers
 * ------------------------------------------------------------------ */

function draftOf(entry: Entry): Draft {
  let derived: DerivedSpec | null = null;
  try {
    derived = derivedSpec(entry);
  } catch {
    /* unusable settings are edited as the text they are */
  }
  return {
    title: field(entry, 'Title'),
    username: field(entry, 'UserName'),
    password: derived ? '' : field(entry, 'Password'),
    derived: derived && { ...derived },
    url: field(entry, 'URL'),
    notes: field(entry, 'Notes'),
    fields: customFields(entry).map((name) => ({ name, value: field(entry, name), protect: isProtected(entry, name) })),
    tags: entry.tags.join(', '),
    expires: Boolean(entry.times.expires),
    expiry: entry.times.expiryTime ? isoDate(entry.times.expiryTime) : '',
    binaries: [...entry.binaries],
    added: [],
  };
}

/** Everything a user can change, as one comparable string. */
function snapshot(draft: Draft): string {
  return JSON.stringify({
    ...draft,
    binaries: draft.binaries.map(([name]) => name),
    added: draft.added.map((item) => [item.name, item.data.byteLength]),
  });
}

function validate(draft: Draft): string | null {
  const seen = new Set<string>();
  for (const item of draft.fields) {
    const name = item.name.trim();
    if (!name) return t('entry', 'Every custom field needs a name');
    if (isStandard(name)) return t('entry', '"{name}" is a standard field name', { name });
    if (seen.has(name)) return t('entry', 'Two fields are called "{name}"', { name });
    seen.add(name);
    if (name === 'otp' && item.value.trim() && !parseOtpValue(item.value)) return t('entry', 'The one-time code key is not valid');
  }
  if (draft.expires && !/^\d{4}-\d{2}-\d{2}$/.test(draft.expiry)) return t('entry', 'Pick an expiry date');
  return draft.derived ? specProblem(draft.derived) : null;
}

async function applyDraft(db: Kdbx, entry: Entry, draft: Draft): Promise<void> {
  const protection = db.meta.memoryProtection;
  const standard: Record<(typeof STANDARD_FIELDS)[number], [string, boolean]> = {
    Title: [draft.title.trim(), Boolean(protection.title)],
    UserName: [draft.username, Boolean(protection.userName)],
    Password: [draft.derived ? serializeDerived(draft.derived) : draft.password, true],
    URL: [draft.url.trim(), Boolean(protection.url)],
    Notes: [draft.notes, Boolean(protection.notes)],
  };
  const fields = new Map<string, kdbxweb.KdbxEntryField>();
  for (const name of STANDARD_FIELDS) {
    const [value, protect] = standard[name];
    fields.set(name, makeValue(value, protect));
  }
  for (const item of draft.fields) {
    const name = item.name.trim();
    if (name !== 'otp') fields.set(name, makeValue(item.value, item.protect));
    else if (item.value.trim()) fields.set(name, makeValue(otpUrl(item.value, draft.title, draft.username), item.protect));
  }
  entry.fields = fields;

  entry.tags = [...new Set(draft.tags.split(/[,;]/).map((tag) => tag.trim()).filter(Boolean))];
  entry.times.expires = draft.expires;
  if (draft.expires) entry.times.expiryTime = new Date(`${draft.expiry}T00:00:00`);

  entry.binaries = new Map(draft.binaries);
  for (const item of draft.added) await addAttachment(db, entry, item.name, item.data);
}

/* ------------------------------------------------------------------ *
 * Small builders
 * ------------------------------------------------------------------ */

function fieldRow(label: string, value: HTMLElement, actions: HTMLElement[]): HTMLElement {
  return h('div', { class: 'field' }, h('span', { class: 'field-label', text: label }), value, h('span', { class: 'field-actions' }, ...actions));
}

function editRow(label: string, control: HTMLElement): HTMLElement {
  return h('label', { class: 'field field--edit' }, h('span', { class: 'field-label', text: label }), control);
}

function input(value: string, placeholder: string, onInput: (value: string) => void, name?: string): HTMLInputElement {
  const node = h('input', { class: 'field-input', placeholder, spellcheck: 'false', autocomplete: 'off', 'data-field': name });
  node.value = value;
  node.addEventListener('input', () => onInput(node.value));
  return node;
}

function button(text: string, action: () => void, extra = '', title?: string): HTMLButtonElement {
  const node = h('button', { type: 'button', class: `button ${extra}`.trim(), text, title });
  node.addEventListener('click', action);
  return node;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
