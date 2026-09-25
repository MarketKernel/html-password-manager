# html-password-manager

A password manager for KeePass databases (`.kdbx`) — in the spirit of KeeWeb, but entirely
contained in one standalone HTML file. No network is used: the database is decrypted inside
the page and saved straight back to disk.

```
┌──────────────────────────────────────────────────────────┐
│ Toolbar: new entry · search · save · generator · lock    │
├────────────┬──────────────────┬──────────────────────────┤
│ Groups,    │ Entries          │ Entry                    │
│ tags,      │                  │ (read / edit)            │
│ recycle bin│                  │                          │
└────────────┴──────────────────┴──────────────────────────┘
```

## How to use

1. Build `build/password-manager.html` (see "[Build](#build)") and open it in a browser —
   straight from disk is fine.
2. "Open file" → pick a `.kdbx` database, or drag it into the window.
3. Enter the master password (and pick the key file, if the database has one) → Unlock.

In Chrome, Edge and Arc the file is opened through the File System Access API: changes are
written back into the same file, a moment after each edit if autosave is on, and the file
is offered again on the next visit — only its handle is remembered, never its contents or
the password. In Safari and Firefox the file opens read-only, and Save downloads an updated
copy of the database.

"New database" creates an empty KDBX 4 database encrypted with AES-256 and Argon2id
(64 MiB, 10 passes — KeePassXC's defaults, about half a second in a browser).

## Security

- **Nothing leaves the page.** A Content-Security-Policy in the file forbids every network
  request, form submission and outside resource; the build fails if the policy or an
  external reference goes missing.
- The format code is [kdbxweb](https://github.com/keeweb/kdbxweb), the library KeeWeb is
  built on; Argon2 is [hash-wasm](https://github.com/Daninet/hash-wasm)'s WebAssembly, which
  is embedded in the file too.
- Protected fields are kept XOR-masked in memory (kdbxweb's `ProtectedValue`) and are
  masked on screen until revealed. Search never looks into protected fields.
- **Passwords in any language.** When a browser takes a field for a password, macOS switches
  on Secure Input and forces a Latin keyboard layout, so a Cyrillic master password cannot
  be typed. Chrome takes for a password not only `type=password` but, by heuristics, any
  field styled with `-webkit-text-security` or holding a value of dots — and keeps doing so
  once it has. Secret fields here give no such hint: they are plain text inputs with
  transparent text, and a layer of dots is drawn over them (in a monospace font, so the
  caret stays in place). A badge shows whether the hidden text is being typed in Cyrillic
  (РУС) or Latin (ENG). The trade-off: Secure Input, which also hides keystrokes from other
  apps, is never engaged.
- A copied secret is wiped from the clipboard after 30 seconds and on lock.
- The database locks after 15 idle minutes, and on `⌘L`. Locking drops the decrypted
  database from memory; a lock with unsaved changes that cannot be written waits instead of
  throwing the changes away.
- Links in entries open only for `http`, `https`, `ftp` and `mailto`, with `noopener`.
- Passwords are generated with `crypto.getRandomValues` and rejection sampling: every
  character is equally likely.

## Features

- **Groups**: a collapsible tree, creating, renaming, deleting through the context menu,
  moving by drag and drop (entries and groups), resizable and hideable panel (`⌘\`).
- **Entries**: title, user name, password, website, notes, custom fields (plain or
  protected), tags, expiry date, attachments. Sorting by title, user name, website, dates.
- **One-time codes** (TOTP): from an `otp` field (`otpauth://` URL or a bare secret, as
  KeePassXC and KeeWeb store it), from KeePass's `TimeOtp-*` fields, or from TrayTOTP's
  `TOTP Seed`. SHA-1, SHA-256, SHA-512; the code refreshes with a countdown.
- **Editing** works on a draft: Save stores the previous state in the entry's history first,
  as KeePass does; Cancel drops the draft. Earlier versions can be browsed and restored.
- **Recycle bin**: deleting moves to the bin; from there — restore or delete for good.
- **Search** across title, user name, website, notes, tags, custom fields and attachment
  names; every word of the query must match.
- **Password generator**: length, character sets, look-alike characters, entropy estimate.
  Strength meter for typed passwords.
- **Database**: rename, change the master password and key file, save a copy.
- **Theme**: system, light, dark. **Zoom**: 50–200 %. Theme, zoom, panel widths, sorting,
  generator options and collapsed groups are remembered.

## Keyboard shortcuts

| Action | Keys |
| --- | --- |
| Save | `⌘S` |
| Lock | `⌘L` |
| Search | `⌘F` |
| New entry | `⌘N` |
| Edit · save the edit | `⌘E` or `Enter` · `⌘Enter` |
| Cancel the edit | `Esc` |
| Password generator | `⌘G` |
| Copy password · user name · website | `⌘C` · `⌘B` · `⌘U` |
| Previous · next entry | `↑` · `↓` |
| Delete the entry | `⌫` |
| Group panel | `⌘\` |
| Zoom | `⌘+` · `⌘−` · `⌘0` |

## Build

```sh
./build.sh         # installs the dependencies if needed, then builds build/password-manager.html
npm install
npm run build      # -> build/password-manager.html
npm run watch      # rebuild on changes in src/
npm run typecheck  # tsc --noEmit
npm test           # 94 checks: opening, editing and saving .kdbx files, the generator, TOTP
npm run test:browser  # 103 checks of the built page in headless Chrome
```

`build.mjs` bundles `src/main.ts` with esbuild into an IIFE and substitutes it, along with
the styles and the icon (a data URI), into `src/template.html`. kdbxweb's fallbacks for
Node (`crypto`, `@xmldom/xmldom`) are replaced with empty stubs — a browser has `crypto.subtle`
and `DOMParser`. The result is `build/password-manager.html`, around 270 KB.

`tools/fixtures/Database.kdbx` is a sample database for the tests; its password is `Тестовый пароль`.

## Layout

```
src/template.html   markup with the __STYLES__/__APP__/__ICON__ placeholders, the CSP
src/styles.css      palette, light and dark themes, three panes
src/main.ts         the gate, unlocking, saving, locking, toolbar, shortcuts, settings
src/kdbx.ts         kdbxweb + Argon2: open, save, create; fields, groups, recycle bin
src/files.ts        File System Access API, drag-and-drop, file input; recent files
src/groups.ts       the group tree, tags and recycle bin in the left panel
src/list.ts         the entry list
src/details.ts      one entry: reading, editing on a draft, history, attachments, TOTP
src/search.ts       search, sorting, safe links
src/generator.ts    password generator and strength estimate
src/genpanel.ts     the generator popover
src/otp.ts          TOTP (RFC 6238) and the ways secrets are stored
src/clipboard.ts    copying with a timed wipe
src/avatar.ts       entry icons: custom icons from the database or a coloured letter
src/settings.ts     localStorage: theme, zoom, panels, lock and clipboard timers
src/ui.ts           dialogs, context menu, popovers, toasts, icons
tools/              tests: .kdbx round trips, generator and TOTP, the page in headless Chrome
vendor/icon.svg     the icon
docs/               working notes (not under git)
build/              the build output
```

## Limitations

- KDBX 3.1 and 4.x are supported; Twofish-encrypted and KeePass 1 (`.kdb`) files are not.
- No sync, browser extension, auto-type or merging of changed copies.
- Only Chromium-based browsers can write the file in place.

## License

MIT — see [LICENSE](LICENSE). kdbxweb and hash-wasm are MIT-licensed as well.
