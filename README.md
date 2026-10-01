# html-password-manager

<!-- languages -->
<h3 align="center">
<b>🇬🇧 English</b> ·
<a href="docs/readme/README.zh.md">🇨🇳 中文</a> ·
<a href="docs/readme/README.hi.md">🇮🇳 हिन्दी</a> ·
<a href="docs/readme/README.es.md">🇪🇸 Español</a> ·
<a href="docs/readme/README.fr.md">🇫🇷 Français</a> ·
<a href="docs/readme/README.ar.md">🇸🇦 العربية</a> ·
<a href="docs/readme/README.bn.md">🇧🇩 বাংলা</a> ·
<a href="docs/readme/README.pt.md">🇧🇷 Português</a> ·
<a href="docs/readme/README.ru.md">🇷🇺 Русский</a> ·
<a href="docs/readme/README.ur.md">🇵🇰 اردو</a> ·
<a href="docs/readme/README.id.md">🇮🇩 Bahasa Indonesia</a> ·
<a href="docs/readme/README.de.md">🇩🇪 Deutsch</a> ·
<a href="docs/readme/README.ja.md">🇯🇵 日本語</a> ·
<a href="docs/readme/README.mr.md">🇮🇳 मराठी</a> ·
<a href="docs/readme/README.te.md">🇮🇳 తెలుగు</a> ·
<a href="docs/readme/README.tr.md">🇹🇷 Türkçe</a> ·
<a href="docs/readme/README.uk.md">🇺🇦 Українська</a>
</h3>
<!-- /languages -->

**Deterministic Password** computes passwords instead of only storing them. A site's password
is derived from your master password, the site, your user name and a version number, with
Argon2id and HMAC-SHA-256. If the database file is lost, the same inputs give the same
passwords again, on any computer — losing the file is no longer scary. To change a site's
password, raise the version. How it works: "[Derived passwords](#derived-passwords)".

It is also a full KeePass password manager: it opens, edits and saves ordinary `.kdbx` files
(KDBX 4, AES-256, Argon2id), so the same database keeps working in KeePassXC, KeePass or
KeeWeb. A derived password is stored in the entry like any other, and other KeePass apps
show it the same way.

Everything works offline: no account, no cloud, no network requests. The whole app is one
standalone HTML file; the database is decrypted in the page's memory and saved straight back
to disk, and the master password never leaves the page. The same page is also a
[Chrome extension](#chrome-extension) that fills logins into the tab beside it —
**[install it from the Chrome Web Store](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**.

**[Online version](https://marketkernel.github.io/html-password-manager/)** — the same page
as a PWA (Progressive Web App): it can be installed into the system and then runs as a
separate app, with its own window and icon, and works offline. On a computer, in Chrome,
Edge and Arc, use the install button in the address bar; on Android, Chrome's ⋮ menu →
Install app; on iOS, Share → Add to Home Screen, in Safari or in Chrome. The database stays
on your disk there too — see "[GitHub Pages](#github-pages)".

![html-password-manager: groups, entries and an entry being edited](docs/password-manager.jpg)

## How to use

1. Build `build/password-manager.html` (see "[Build](#build)") and open it in a browser —
   straight from disk is fine.
2. "Open file" → pick a `.kdbx` database, or drag it into the window.
3. Enter the master password (and pick the key file, if the database has one) → Unlock.

In Chrome, Edge and Arc the file is opened through the File System Access API: changes are
written back into the same file, a moment after each edit if autosave is on, and the file
is offered again on the next visit — only its handle is remembered, never its contents or
the password. In Safari and Firefox the file opens read-only, and Save downloads an updated
copy of the database — and so it does on phones: Chrome on Android has no File System
Access, and every browser on iOS, Chrome included, runs on Safari's engine. On iOS, Save
hands the copy to the share sheet instead — see "[On a phone](#on-a-phone)".

"New database" creates an empty KDBX 4 database encrypted with AES-256 and Argon2id
(64 MiB, 10 passes — KeePassXC's defaults, about half a second in a browser).

### On a phone

Up to 900 pixels wide — a phone, or a tablet held upright — the page shows one thing at a
time. The entry list fills the screen; a tap opens an entry on a screen of its own, and ‹ in the
toolbar, the system's back button or a swipe back return to the list. An edit is kept on the
way back, as picking another entry keeps it on a computer; a new entry left empty is dropped.
☰ slides the groups, tags and recycle bin in over the list. Menus, the generator and the
settings rise from the bottom of the screen; back closes them first, and cancels a dialog.
The generator, the settings and the lock are in the toolbar's ⋯ menu.

A touch screen has no right click and no drag: the ⋯ beside a group opens the menu a right
click opens on a computer, and its "Move to group…" does what a drag does. An entry's menu is
its ⋯ on the entry's screen.

The file opens read-only. On iOS, Save hands the updated database to the share sheet, where
"Save to Files" can put it in place of the original; closing the sheet leaves the changes
unsaved. Chrome on Android shares only pictures, sound, video and text, so there Save
downloads the copy.

Wider, and on a tablet, the three panes stay as they are on a computer; a touch screen of any
size gets larger buttons and the ⋯ beside the groups.

## Chrome extension

**[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**

`npm run build` also writes `build/extension/`: the same app as a Chrome extension, and
`build/password-manager-extension-<version>.zip` of it for the Chrome Web Store. To try a
build of your own: `chrome://extensions` → Developer mode → Load unpacked → `build/extension`.

The toolbar icon opens a compact popup: the entries for the tab's site, a click on one to
fill it in, buttons to copy its user name, password or one-time code, and a search through the
whole database. **Full mode** at its bottom opens the app in Chrome's side panel, beside the
page — in the phone layout, since a panel is narrow — where it stays across tabs. Everything
works there as in the file; what the extension adds is filling logins in:

- **The popup** unlocks with the master password alone the file the panel opened last: the
  panel chooses files and key files, and makes every change. On a site with no entry, its
  **New password** opens the panel on the generator, as Fill in the menu does.
- **Fill** in a page's context menu (a right click on the page or in a field) fills the user
  name and the password of the entry for the tab's site — or its one-time code, on the step
  of a sign-in that asks for one. With one entry for the site it fills at once, the panel
  open or not; with several, with none, or with the database locked, it opens the panel to
  pick one, to make a password, or to unlock — and goes on from there. A sign-in in two steps
  (Google, Microsoft) takes the user name on the first and the password on the second: the
  entry picked for the tab is remembered. An entry's **Fill** button in the panel fills that
  entry into the tab.
- **The database stays open** when the panel closes, until it locks: after the idle time of
  the settings, when the computer's screen locks, from the panel, from the popup, or from
  **Lock** in the toolbar icon's menu. Opened again, the panel takes it up without the
  password, and the popup shows it at once.
- **For this site**, at the top of the group panel, lists the entries of the tab's site, and
  the list opens on it; it follows the tab.
- **A new password for a page.** On a site with no entry, Fill opens the Derived v3 generator
  with the tab's site and the user name typed on the page. Its Fill button fills the password
  in — both fields of a registration form — and keeps it as an ordinary entry.

An entry fits a tab when its website names the tab's site exactly: both addresses go through
`siteOf()` of generator 3 — no scheme, port, path or `www.`, IDN in punycode. `google.com`
does not fit `accounts.google.com`, nor `mail.site.com` `site.com`. An entry with `https://`,
or with no scheme, is never filled into an `http://` page: a site used over http needs
`http://` in its website. Entries in the recycle bin are not offered, and an entry picked by
hand for another site is filled only after a warning that names both.

**How it is made.** The panel is the page itself: `panel.html`, its script in `panel.js`, as
Manifest V3 wants. On every unlock and save it hands the file and its key — the password in
a `ProtectedValue`, the key file — to an offscreen document, which keeps them, and a
read-only copy of the database decrypted from them, in memory until the lock; locking closes
it, and the key goes with it. Nothing is written anywhere. The service worker has the menus.
A click on Fill can open the panel only before anything is awaited, so the worker has to know
at once whether it can fill: it keeps the websites of the entries — no names, no passwords —
as the offscreen document sends them, and the offscreen document keeps it running. The
popup (`popup.html`, `popup.js`) decrypts nothing: it asks the offscreen document for the
titles and user names that fit the tab, then for the one entry clicked; locked, it reads the
recent file and hands it, with the password, to that document to open.

**What reaches a page.**

- Only what a click asks for, and only one entry's values. No content script runs anywhere:
  at a click, `chrome.scripting.executeScript` first asks every frame of the tab where it is
  and which login fields it has, sending no values; then only the frames of the entry's site
  get them, and the function checks its own address again before it types. A frame of
  another site on the same page gets nothing.
- Only fields a person can see are filled: shown, enabled, writable, of some size, inside
  the window. A field hidden as a trap stays empty.
- The values are set from the extension's isolated world, past any setter a page puts on its
  inputs, and `input` and `change` events tell React, Vue or Angular.
- The master password, other entries and the list of sites never go to a page.

**Permissions.** `activeTab` rather than every site: a click on the icon or on Fill gives the
extension that one tab. So the panel opens from the popup or the menu, never by Chrome's own
setting (`openPanelOnActionClick`): a panel opened that way gets no tab at all. Fill in the panel on a tab it was not given asks once for the entry's
site (`optional_host_permissions`). `contextMenus`, `scripting` and `sidePanel` for the above,
`offscreen` for the document, `idle` for the screen lock, `clipboardWrite` to wipe a copied
secret with the panel closed. There is no `externally_connectable`: the extension's parts talk
over `chrome.runtime`, and each takes messages only from the extension's own pages. Its pages
have `connect-src 'none'`, as the file does; the build checks that, and that no page has an
inline script or an outside address.

One difference from the file: opened again, the panel writes the database in place only if
Chrome still allows it; otherwise the status bar says so, and the first Save asks.

## Security

- **Nothing leaves the page.** A Content-Security-Policy in the file forbids every network
  request, form submission and outside resource; the build fails if the policy goes missing
  or an external reference creeps in. The PWA's copy lets in three things more, all from its
  own origin: the manifest, the service worker and the icons — `connect-src` stays `'none'`.
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
  `TOTP Seed`. SHA-1, SHA-256, SHA-512; the code refreshes with a countdown. **+ One-time code**
  in the editor takes the setup key a site shows next to its QR code (or an `otpauth://` link)
  and shows the code at once, to confirm it on the site; a bare key is saved as an `otpauth://`
  link, the form KeePassXC reads.
- **Editing** works on a draft: Save stores the previous state in the entry's history first,
  as KeePass does; Cancel drops the draft. Earlier versions can be browsed and restored.
- **Recycle bin**: deleting moves to the bin; from there — restore or delete for good.
- **Search** across title, user name, website, notes, tags, custom fields and attachment
  names; every word of the query must match.
- **Password generator** (the dice, `⌘G`) makes a password of the kind picked in its list,
  newest derivation first; the last choice is remembered:
  - **Derived v3** — computed from the master password, the user name, the site and a
    version, so it can be computed again without the file — see
    "[Derived passwords](#derived-passwords)";
  - **Derived v2** and **Derived v1** — the calculators of two older programs (legacy 2 and
    legacy 1), listed when Settings → "Show legacy password algorithms" is on — see
    "[Legacy algorithms](#legacy-algorithms)";
  - **Random** — length, character sets, look-alike characters, entropy estimate.

  Strength meter for typed passwords.
- **Database**: rename, change the master password and key file, save a copy.
- **Languages**: English, 中文, हिन्दी, Español, Français, العربية, বাংলা, Português, Русский,
  اردو, Bahasa Indonesia, Deutsch, 日本語, मराठी, తెలుగు, Türkçe — the sixteen most spoken —
  and Українська. Chosen in Settings, or taken from the browser; Arabic and Urdu lay the
  window out right to left.
- **Theme**: system, light, dark, in Settings. Language, theme, panel widths, sorting,
  generator options and collapsed groups are remembered.

## Derived passwords

**Derived v3** in the generator computes a password from

- the master password of the database (the key file, if any, is left out), or another one
  typed there,
- the user name,
- the site — the domain the account is on (`https://www.github.com/login` → `github.com`),
- the version — 1, 2, … up to 2³² − 1; "+1" gives the same account a new password.

Those four make 32 bytes of entropy. The requirements — length, character sets, look-alikes —
only shape those bytes into characters: changing them does not change the entropy. **Use**
puts the result into the entry as an ordinary stored password. Nothing of how it was made is
kept: the entry is like any other, and other KeePass apps show the same password. Should the
file be lost, the same master password, user name, site, version and requirements give the
same password on any machine. The defaults are 20 characters, all four character sets, no
look-alikes; a password made with others needs them remembered as well.

The generator asks for the user name first — from an entry, the entry's own: what is typed
there shows in the form too — then the site; both are required, and the password they give is
at the bottom, over **Use**.

- A user name that is an e-mail address names its site: `test@site.com` fills in `site.com`,
  and the entry's website is left as it is — it may well be `mail.site.com`. The same address
  signs in to many sites, though, and the generator says so under the field: for GitHub with
  `test@gmail.com`, type `github.com` over the `gmail.com` it put there.
- Any other user name needs the site typed, and from an entry what is typed becomes its
  website too. The website the entry already has is filled in to begin with.

Of what is typed as the site, the scheme, path, port and a leading `www.` do not matter; a
subdomain does — `login.github.com` and `github.com` are two sites. A site that is not a URL
("My bank") is used as it is. From the toolbar the generator works the same way, with fields
of its own, and copies the result.

"Use the database's master password" is ticked each time the generator opens. Untick it to
derive from another master password, typed there and kept nowhere — to recover a password
made in another database, or before the master password was changed. Changing it leaves the
passwords in the file as they are; only what the generator computes from then on differs.

### The algorithm: generator 3

Everything below is frozen: changing any constant would make every password made with it
impossible to compute again. A future generator would come as a new kind in the list and leave
this one as it is. The code is `src/core/derived.ts`; `npm test` checks it against fixed vectors
and against an independent implementation written from this description with Node's own
`crypto`. The primitives are standard — SHA-256, HMAC-SHA-256, Argon2id — so the algorithm
can be rebuilt in any language.

It runs in two stages: the secrets become 32 bytes of entropy, then the requirements carve
characters out of those bytes.

**Stage 1 — entropy.**

1. *Normalize the inputs.* All strings are UTF-8.
   - `site` — the host of what was typed as the site: the text parsed as a WHATWG URL
     (`https://` is put in front when the text has no `scheme://`): lower case, IDN in
     punycode, no port, no user name or password, a leading `www.` dropped; text that does
     not parse as a URL is used as it is. Then trimmed, NFC-normalized, lower-cased.
   - `user` — the user name, trimmed and NFC-normalized; case is kept.
   - `master` — the master password, NFC-normalized, nothing trimmed. An "é" typed as one
     character or as "e" plus a combining accent gives the same password.
2. *Salt.*
   ```
   salt = SHA-256( "html-password-manager/derived/v3" ‖ 0x00
                   ‖ u32be(byte length of site) ‖ site
                   ‖ u32be(byte length of user) ‖ user
                   ‖ u32be(version) )
   ```
   The length prefixes keep `ab` + `c` and `a` + `bc` apart; the label keeps these bytes
   apart from any other use of the same inputs. `u32be` is a 4-byte big-endian integer.
3. *Stretch.*
   ```
   entropy = Argon2id(password = master, salt, memory = 64 MiB, passes = 3,
                      lanes = 1, version 0x13, output = 32 bytes)
   ```
   Argon2id makes every guess of the master password cost 64 MiB of memory, which is what
   slows down GPUs and ASICs. Since the site, user name and version are in the salt, every
   account has its own: no table can be computed in advance, and each account has to be
   attacked on its own.

**Stage 2 — shaping.** The requirements are used only here, so they change how the
password looks, not the entropy behind it.

4. *A stream of random bytes*, as long as needed — 32 bytes are not enough for a long
   password and its shuffle:
   ```
   block(i) = HMAC-SHA-256(key = entropy, "hpm-v3-stream" ‖ u32be(i)),  i = 0, 1, 2, …
   ```
5. *An unbiased number below n.* Take the next 4 bytes of the stream as a big-endian u32
   `x`. If `x ≥ 2³² − (2³² mod n)`, drop it and take the next; otherwise the result is
   `x mod n`. (A bare `x mod n` would favour the start of the alphabet.)
6. *Characters.* The sets, in this order, each only if chosen:
   ```
   A–Z      ABCDEFGHIJKLMNOPQRSTUVWXYZ
   a–z      abcdefghijklmnopqrstuvwxyz
   0–9      0123456789
   symbols  !#$%&*+-=?@^_~.,:;()[]{}<>/|
   ```
   Without look-alikes, `O 0 o I l 1 |` are removed from them. Then:
   ```
   chars = []
   for each chosen set:            chars.push(set[draw(|set|)])      # every set is present
   while |chars| < length:         chars.push(all[draw(|all|)])      # all = the sets joined
   for i = length − 1 down to 1:   j = draw(i + 1); swap chars[i], chars[j]   # Fisher–Yates
   password = chars joined
   ```
   Length is 4 to 128. Taking one character from every set first is what makes "has a
   digit" and "has a symbol" guaranteed; the shuffle hides where those characters went.

**Test vector.** Master password `Тестовый пароль`, site `https://www.github.com/login`
(`github.com`), user name `me@example.com`, version 1, the default requirements
(20 characters, all four sets, no look-alikes):

```
password  A6qVXXF]7<%a)aa<x7*U
```

The same entropy with 12 characters and no symbols gives `yaM6VJaJFYUQ`; version 2 with the
defaults gives `3q_bwppbE8P2+ufKr:P6`.

### How strong it is

- A derived password has at most 256 bits of entropy (the 32 bytes); 20 characters from all
  four sets without look-alikes is about 128 bits. In practice the ceiling is the master
  password.
- **The weak point of any derived-password scheme:** a password leaked by one site lets an
  attacker guess the master password offline, since the site and user name are known. Each
  guess costs one Argon2id run over 64 MiB — around 0.15–0.4 s in a browser, less on
  dedicated hardware. A short or common master password will be found; a long passphrase
  will not. Random passwords do not have this weakness, which is why the generator has both.
- As long as the master password holds, a leaked password reveals nothing about the other
  sites or versions: they come from other salts, so from other Argon2 runs.

The master password is kept XOR-masked in memory while the database is open, along with the
entropy computed so far; locking drops them both.

## Legacy algorithms

Two older Windows programs computed passwords from secret phrases; **Derived v1** (legacy 1)
and **Derived v2** (legacy 2) in the generator repeat them exactly, so the passwords made with them can be
recovered. They are calculators: nothing typed into them is saved, the phrases are gone when
the generator closes, and **Use** puts the result into the entry as an ordinary stored
password. Settings → "Show legacy password algorithms" makes them appear.

Opened from an entry, both suggest the identifier: a user name that already names its site
(`mail@site.com`) as it is, otherwise the user name, `@` and the site without `www.`
(`dmytro@github.com`); it can be changed. Each phrase — the master key and the secondary key,
the primary and the secondary secret phrase — has its own "Remember until the database locks"
box: a ticked one is kept in the page's memory, XOR-masked, and filled in next time; with the
first phrase kept, the key is computed at once. Both can also take the database's own master
password — the one it was unlocked with — as their first phrase, legacy 1's master key or
legacy 2's primary secret phrase ("Use the database's master password", remembered in the
settings for each of them): that field and its box are then off. Nothing of it is
written to disk; locking,
closing the database or turning the legacy algorithms off forgets them all. The code is
`src/core/legacy.ts`; `npm test` checks it against vectors computed by the original .NET programs.

**Legacy 1** — master key, identifier, primary key, secondary key, result:

```
short(bytes) = Base64(bytes) without "=", "/", "+", first 10 characters
primary key  = short(SHA-1 applied 1 000 000 times to UTF-8(master key ‖ identifier))
result       = short(SHA-1(UTF-8(primary key ‖ secondary key)))
```

The primary key is bound to the identifier and can be kept apart (on paper), so the master key
need not be typed anywhere: it can be entered directly. The secondary key keeps a stolen note
useless on its own.

**Legacy 2** (Password.Generator 1.0) — primary protection: identifier, primary secret phrase,
key length, character sets; secondary protection: the key, secondary secret phrase, password
version, password length, character sets:

```
digest(a, b, v, n) = SHA-1 applied n times to UTF-8(a) ‖ UTF-8(b) ‖ (v > 0 ? u32le(v) : nothing)
key                = select(digest(identifier, primary phrase, 1, 100 000), key length + 2)
password           = select(digest(key, secondary phrase, version, 1), password length + 2)
```

`select` reads the digest as five little-endian u32, sets the top bit of each, writes it in
base N of the alphabet — `!#$%&'()+,-.` (if chosen), digits (always), A–Z, a–z (if chosen) —
least significant digit first, keeps 5 characters of each and cuts to the length (1–18). The
first two characters are a signature to compare by eye with the one the program showed; the
rest is the key or the password. The key's version is always 1: the program has no field for
it. Identifier `1`, phrase `1`, length 10, digits and letters give the key `E8 8pgYm9fZha`.

Both are far weaker than version 3: a guess at the phrases costs an attacker a few SHA-1 runs
instead of an Argon2id run over 64 MiB, and a Legacy 1 result is 10 characters, about 60 bits.
Use them to recover old passwords, not for new ones.

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

## Translations

The English text stays in the code: `t('menu', 'Delete')`, `tn('status', '{count} entry',
'{count} entries', n)`, and `data-i18n="context"` / `data-i18n-attr="context"` in the
template. The first argument is the context — the part of the interface a string belongs
to, so the same English word can be translated differently in two places. A dictionary,
`src/locales/<code>.json`, maps context → English text → translation:

```json
{
  "menu": { "Delete": "Удалить" },
  "status": { "{count} entries": { "one": "{count} запись", "few": "{count} записи", "many": "{count} записей", "other": "{count} записи" } }
}
```

A string the dictionary lacks is shown in English. A text with a number has one form per
plural category of the language (`Intl.PluralRules`), keyed by the English plural form.
`npm run i18n` lists, per language, the strings not translated yet and the ones no longer
used; `npm test` checks that every translation keeps the English placeholders and has all
plural forms.

What Chrome shows of the extension itself — its name and description, the toolbar button's
title — follows the browser's language rather than the panel's, through `chrome.i18n`. Those
texts are the English ones in `src/extension/manifest.json`, translated in the same
dictionaries under the context `manifest`; the build writes them to
`_locales/<code>/messages.json` and puts `__MSG_appName__` and the like into the manifest.
Chrome has codes of its own and ignores the rest: `pt` becomes `pt_BR` and `pt_PT`, `zh`
becomes `zh_CN`, and Urdu has none, so there Chrome names the extension in English. The build
stops at a name over 75 characters or a description over 132.

This README is translated as well: `docs/readme/README.<code>.md`, one per language, with the
list of languages at the top of each. A change here belongs in the translations too.

## Build

```sh
./build.sh         # installs the dependencies if needed, then builds build/password-manager.html
npm install
npm run build      # -> build/password-manager.html
npm run watch      # rebuild on changes in src/
npm run typecheck  # tsc --noEmit
npm test           # opening, editing and saving .kdbx files, the generator, TOTP, derived passwords, matching tabs, the dictionaries
npm run test:browser  # the built page and the extension in headless Chrome
npm run i18n       # strings each dictionary lacks or no longer needs
npm run check      # typecheck, test, build and test:browser in a row
npm run shots -- shots/after  # build, then screenshots of the main screens into shots/after
```

`build.mjs` bundles `src/app/main.ts` with esbuild into an IIFE and substitutes it, along with
the styles and the icon (a data URI), into `src/app/template.html`. kdbxweb's fallbacks for
Node (`crypto`, `@xmldom/xmldom`) are replaced with empty stubs — a browser has `crypto.subtle`
and `DOMParser`. The result is `build/password-manager.html`, around 500 KB, a quarter of it the dictionaries.

The same run writes `build/pages/`: that page as an installable PWA — `index.html` with a
manifest link and a service worker registration, `manifest.webmanifest`, the icons and
`sw.js`, which caches the page so it opens offline. `build/password-manager.html` itself
stays a single file with no external references.

And `build/extension/`: `panel.html` is the template with its script in `panel.js` — the same
`src/app/main.ts`, with `src/extension/extension.ts` in the place of `src/app/platform.ts`, whose hooks do nothing
in the file — beside `popup.html` (with the page's styles and `popup.css`) and `popup.js`,
`background.js`, `offscreen.html` and `offscreen.js`, the icons and
`manifest.json`, whose version is `package.json`'s. `build/password-manager-extension-<version>.zip`
holds the same files, with fixed dates: the same sources give the same bytes.

`tests/extension.mjs` loads that extension into headless Chrome through the DevTools
protocol (`Extensions.loadUnpacked` over a pipe; `--load-extension` is gone from Chrome
since version 137) and fills test sites on a local server: a plain form, a React-like one, a
sign-in in three steps with a one-time code, frames of the site's own and of another site,
fields hidden as traps, an http page for an https entry, a registration filled with a Derived
v3 password — with the panel closed, and after the lock; and the popup, which unlocks, fills,
searches, copies and locks. A context menu cannot be clicked from
DevTools, so the test fires the worker's `onClicked` itself; with no real click Chrome grants no
`activeTab`, so the copy under test may reach the test sites, `*.test`, as host permissions.
The toolbar icon can be clicked from DevTools (`Extensions.triggerAction`): a Chrome of its own,
with the extension as built, checks that the click gives the popup the tab. Headless Chrome 153
crashes on that click, whatever the extension, and the check is then skipped; Chrome for Testing
runs it (`CHROME=/path/to/chrome-for-testing npm run test:browser`).

`tests/fixtures/Database.kdbx` is a sample database for the tests; its password is `Тестовый пароль`.

## Versions and releases

The version is written in one place, `package.json`. The build puts it into the page (the
line under the gate, the bottom of the settings), into the extension's `manifest.json` and
into the PWA's cache name. A build of the commit tagged `v<version>` shows it as it is; any
other adds its commit, `0.8.0+1a2b3c4`, so a page from `main` on GitHub Pages is not taken
for the release. Chrome's `version` holds numbers only, so there the commit goes into
`version_name`.

```sh
npm version minor           # 0.7.2 -> 0.8.0: package.json, package-lock.json, a commit and the tag v0.8.0
git push --follow-tags      # the tag starts .github/workflows/release.yml
```

The release workflow stops if the tag and `package.json` disagree, then attaches
`password-manager-<tag>.html`, `password-manager-extension-<tag>.zip` and `SHA256SUMS.txt`.

## GitHub Pages

`.github/workflows/pages.yml` builds and tests every push to `main` and deploys
`build/pages/` to GitHub Pages (Settings → Pages → Source: GitHub Actions), at
<https://marketkernel.github.io/html-password-manager/>. Files open the same way as in the
single file; the recent files, settings and remembered handles belong to that address, apart
from those of a copy opened from disk.

Each deploy changes the cache name in `sw.js`, so the browser picks up the new version by
itself; an open window switches to it on its next reload. That is also the trade-off: an
installed PWA runs whatever the last deploy put there, while a downloaded file stays the
version it is. For a version fixed on disk, take `password-manager-<tag>.html` from a
release and compare it with `SHA256SUMS.txt`.

`npm run test:browser` opens `build/pages/` as well: the service worker takes the page over,
Chrome finds the manifest installable, and with the server gone the page still loads and
unlocks the sample database.

## Layout

```
src/core/             no DOM: the tests run it in Node
  kdbx.ts             kdbxweb + Argon2: open, save, create; fields, groups, recycle bin
  generator.ts        password generator and strength estimate
  derived.ts          derived passwords: generator 3, the site of an e-mail address, the session's master password
  site.ts             siteOf(): the site of a website, for generator 3 and for matching tabs
  legacy.ts           the legacy algorithms: legacy 1 and legacy 2
  otp.ts              TOTP (RFC 6238) and the ways secrets are stored
  match.ts            which entries fit a tab
  i18n.ts             t()/tn(), the language list, translating the page's markup
src/app/              the page: the single file, the PWA and the extension's side panel
  template.html       markup with the __STYLES__/__APP__/__ICON__ placeholders, the CSP; the extension's panel.html too
  styles.css          palette, light and dark themes, three panes; a phone's one screen at a time
  main.ts             the gate, unlocking, saving, locking, toolbar, shortcuts, settings
  files.ts            File System Access API, drag-and-drop, file input; recent files
  groups.ts           the group tree, tags and recycle bin in the left panel
  list.ts             the entry list
  details.ts          one entry: reading, editing on a draft, history, attachments, TOTP
  search.ts           search, sorting, safe links
  genpanel.ts         the generator popover: random, version 3, legacy 1 and 2
  clipboard.ts        copying with a timed wipe
  avatar.ts           entry icons: custom icons from the database or a coloured letter
  settings.ts         localStorage: language, theme, panels, lock and clipboard timers
  ui.ts               dialogs, context menu, popovers, toasts, icons; sheets on a phone
  screens.ts          the phone layout: the list or the entry, the group drawer, the back button
  platform.ts         what the page does beyond itself: nothing, in the file and the PWA
src/extension/        the Chrome extension
  manifest.json       its manifest; the build adds the version
  extension.ts        platform.ts of the side panel: the offscreen document, the tab, Fill
  popup.ts            the toolbar icon's popup (popup.html, popup.css): the site's entries, Full mode
  background.ts       the service worker: the menus, the screen lock, filling a tab
  offscreen.ts        the offscreen document (offscreen.html): the open database until the lock
  fill.ts             the function put into a page: finds the login fields and fills them
  messages.ts         how the extension's parts talk
src/pwa/sw.js         the service worker of the Pages build
src/locales/          one dictionary per language
assets/               the icon; pwa/, its PNG sizes for the PWA; extension/, the extension's icon
tests/                .kdbx round trips, generator and TOTP, derived passwords, legacy algorithms, matching tabs,
                      dictionaries, the page and the extension in headless Chrome; fixtures/, the sample database
tools/                load.mjs compiles src/ modules for the tests; i18n.mjs compares the dictionaries with the code
docs/                 the screenshot above; readme/, this README in the other languages; working notes (not under git)
build/                the build output; build/pages/ is the PWA for GitHub Pages, build/extension/ the extension
```

## Limitations

- KDBX 3.1 and 4.x are supported; Twofish-encrypted and KeePass 1 (`.kdb`) files are not.
- No sync, auto-type or merging of changed copies.
- The extension is for Chrome only, and has no suggestions in the fields, no saving a password
  when a form is sent, no keyboard shortcut, and one website per entry.
- Only Chromium-based browsers can write the file in place.

## License

MIT — see [LICENSE](LICENSE). kdbxweb and hash-wasm are MIT-licensed as well.
