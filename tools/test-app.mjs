/**
 * Drives the built page in headless Chrome: unlocking Database.kdbx, browsing,
 * searching, editing, deleting, saving and locking; the same page on a phone's
 * screen, by touch; then the PWA of build/pages/ offline, from its service worker.
 *
 * Needs `npm run build` first and a local Chrome (or `CHROME=/path/to/chrome`).
 * The File System Access API is switched off, so the page takes the read-only
 * route and ⌘S downloads the database; the download is caught, decrypted here
 * with the same src/kdbx.ts, and checked. No dependencies beyond Node: the
 * DevTools protocol is spoken over the built-in WebSocket.
 *
 * `--shots DIR` also saves screenshots of the main screens into DIR.
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { checker, load, root } from './load.mjs';

const APP = join(root, 'build', 'password-manager.html');
const PAGES = join(root, 'build', 'pages');
const DB = join(root, 'tools', 'fixtures', 'Database.kdbx');
const PASSWORD = 'Тестовый пароль';
const shotsAt = process.argv.indexOf('--shots');
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
const CHROME =
  process.env.CHROME ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((path) => existsSync(path));

if (!CHROME) {
  console.log('No Chrome found — set CHROME=/path/to/chrome. Skipping the browser tests.');
  process.exit(0);
}
if (typeof WebSocket === 'undefined') {
  console.error('Run with `node --experimental-websocket` on Node 20.');
  process.exit(1);
}

const K = await load('kdbx', 'derived', 'legacy');
const DERIVED_SPEC = { ...K.REQUIREMENT_DEFAULTS, site: 'github.com', version: 1 };
const DERIVED = (await K.derivePassword(PASSWORD, DERIVED_SPEC, 'me@example.com')).password;
const SESSION_KEY = await K.legacy1PrimaryKey(PASSWORD, 'me@example.com');
const SESSION_KEY_2 = (await K.legacy2Key('dmytro@github.com', PASSWORD, 10, { symbols: false, upper: true, lower: true })).value;
const DERIVED_V2 = (await K.derivePassword(PASSWORD, { ...DERIVED_SPEC, version: 2 }, 'me@example.com')).password;
const { check, done } = checker();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const html = await readFile(APP);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
let pagesDown = false;
// /pages/… is build/pages/, any other path the single file.
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!path.startsWith('/pages/')) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html);
    return;
  }
  if (pagesDown) return req.socket.destroy();
  const name = path.endsWith('/') ? 'index.html' : basename(path);
  try {
    const body = await readFile(join(PAGES, name));
    res.setHeader('content-type', TYPES[extname(name)] ?? 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const profile = await mkdtemp(join(tmpdir(), 'hpm-chrome-'));
const flags = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1280,860'];
if (process.platform === 'linux') flags.push('--no-sandbox');
const chrome = spawn(CHROME, [...flags, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((resolve) => {
  let buf = '';
  chrome.stderr.on('data', (d) => {
    buf += d;
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
    if (m) resolve(m[1]);
  });
});
const debugPort = new URL(wsUrl).port;
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const waiting = new Map();
const errors = [];
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg);
    waiting.delete(msg.id);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    errors.push(msg.params.entry.text);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    waiting.set(n, (msg) => (msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${expr}\n${r.exceptionDetails.exception?.description ?? 'eval failed'}`);
  return r.result.value;
};
const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
const texts = (selector) => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].map((n) => n.textContent)`);
const visible = (selector) => evaluate(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); return !!n && n.getClientRects().length > 0; })()`);
async function until(expr, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await evaluate(expr)) return true;
    await sleep(50);
  }
  return false;
}

const MOD = process.platform === 'darwin' ? 4 : 2;
const KEYS = {
  Enter: { code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
  Escape: { code: 'Escape', windowsVirtualKeyCode: 27 },
  ArrowDown: { code: 'ArrowDown', windowsVirtualKeyCode: 40 },
  ArrowUp: { code: 'ArrowUp', windowsVirtualKeyCode: 38 },
  Delete: { code: 'Delete', windowsVirtualKeyCode: 46 },
  e: { code: 'KeyE', windowsVirtualKeyCode: 69 },
  f: { code: 'KeyF', windowsVirtualKeyCode: 70 },
  l: { code: 'KeyL', windowsVirtualKeyCode: 76 },
  n: { code: 'KeyN', windowsVirtualKeyCode: 78 },
  s: { code: 'KeyS', windowsVirtualKeyCode: 83 },
};
const press = async (key, modifiers = 0) => {
  const k = KEYS[key];
  const withText = !modifiers && k.text;
  await send('Input.dispatchKeyEvent', { type: withText ? 'keyDown' : 'rawKeyDown', key, modifiers, ...k, text: withText ? k.text : undefined });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers, ...k });
  await sleep(40);
};
const type = async (value) => {
  await send('Input.insertText', { text: value });
  await sleep(30);
};
const click = async (selector) => {
  const box = await evaluate(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n) return null; n.scrollIntoView({ block: 'nearest' }); const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  if (!box) throw new Error(`Nothing to click: ${selector}`);
  for (const t of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type: t, x: box[0], y: box[1], button: 'left', clickCount: 1 });
  }
  await sleep(60);
};
/** Picks a kind of password in the generator's list. */
const pickKind = (kind) =>
  evaluate(`(() => { const s = document.querySelector('[data-field="gen-kind"]'); s.value = ${JSON.stringify(kind)}; s.dispatchEvent(new Event('change')); })()`);
const kinds = () => evaluate(`[...document.querySelectorAll('[data-field="gen-kind"] option')].map((o) => o.textContent)`);
/** The read-mode value of the field labelled `label`, or null. */
const fieldValue = (label) =>
  evaluate(`[...document.querySelectorAll('.field')].find((f) => f.querySelector('.field-label')?.textContent === ${JSON.stringify(label)})?.querySelector('.field-value')?.textContent ?? null`);
// Tags the first match so `click` can find it by a unique selector.
const clickNth = async (selector, label) => {
  const ok = await evaluate(`(() => {
    const all = [...document.querySelectorAll(${JSON.stringify(selector)})];
    document.querySelectorAll('[data-pick]').forEach((n) => n.removeAttribute('data-pick'));
    const hit = all.find((n) => n.textContent.trim() === ${JSON.stringify(label)} || n.textContent.includes(${JSON.stringify(label)}));
    if (hit) hit.setAttribute('data-pick', '');
    return !!hit;
  })()`);
  if (!ok) throw new Error(`No ${selector} with "${label}"`);
  await click('[data-pick]');
};
const shot = async (name) => {
  if (!SHOTS) return;
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
};
async function setFile(selector, path) {
  const { root: doc } = await send('DOM.getDocument', { depth: 0 });
  const { nodeId } = await send('DOM.querySelector', { nodeId: doc.nodeId, selector });
  await send('DOM.setFileInputFiles', { nodeId, files: [path] });
  await sleep(100);
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('DOM.enable');
  const { identifier: readOnlyScript } = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      delete window.showOpenFilePicker;
      delete window.showSaveFilePicker;
      localStorage.setItem('html-password-manager', JSON.stringify({ language: 'en', theme: ${JSON.stringify(process.env.THEME ?? 'light')}, autosave: false }));
      const orig = URL.createObjectURL;
      window.__downloads = [];
      URL.createObjectURL = (blob) => { window.__lastBlob = blob; return orig(blob); };
      HTMLAnchorElement.prototype.click = function () { if (this.download) window.__downloads.push(this.download); };
      window.__blobBase64 = async () => {
        const bytes = new Uint8Array(await window.__lastBlob.arrayBuffer());
        let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s);
      };
    `,
  });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  await until(`document.readyState === 'complete'`);

  // The gate
  check('gate shown', await visible('#gate-pick'), true);
  check('read-only note', await visible('#browser-note'), true);
  await shot('1-gate');

  await setFile('#file-picker', DB);
  check('unlock form', await visible('#unlock'), true);
  check('database name', await text('#unlock-name'), 'Database');
  check('password focused', await evaluate(`document.activeElement?.id`), 'password');
  // Anything a browser takes for a password field makes macOS force a Latin layout:
  // the field is plain text with transparent characters and a layer of dots over it.
  check('password field has no password hints', await evaluate(`(() => { const i = document.querySelector('#password'); const cs = getComputedStyle(i); return [i.type, cs.webkitTextSecurity, cs.color]; })()`), ['text', 'none', 'rgba(0, 0, 0, 0)']);

  // A wrong password
  await type('wrong');
  check('layout badge: latin', await text('#layout'), 'ENG');
  await press('Enter');
  await until(`document.querySelector('#gate-error').textContent !== ''`);
  check('wrong password message', await text('#gate-error'), 'Wrong password or key file');
  check('still locked', await visible('#app'), false);

  // The right one
  await evaluate(`document.querySelector('#password').value = ''`);
  await type(PASSWORD);
  check('layout badge: cyrillic', await text('#layout'), 'РУС');
  check('real value kept', await evaluate(`document.querySelector('#password').value`), PASSWORD);
  check('one dot per character', await evaluate(`document.querySelector('.unlock-field .secret-dots').textContent`), '•'.repeat([...PASSWORD].length));
  // The dots must be exactly as wide as the hidden text, or the caret would not sit after the last one.
  check('dots as wide as the text', await evaluate(`(() => {
    const input = document.querySelector('#password');
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;white-space:pre;font:' + getComputedStyle(input).font;
    probe.textContent = input.value;
    document.body.append(probe);
    const diff = Math.abs(probe.getBoundingClientRect().width - document.querySelector('.unlock-field .secret-dots').getBoundingClientRect().width);
    probe.remove();
    return diff < 1;
  })()`), true);
  // A password longer than the field scrolls; the dots scroll with it.
  await type('ж'.repeat(80));
  await sleep(100);
  check('long password scrolls with its dots', await evaluate(`(() => {
    const input = document.querySelector('#password');
    const dots = document.querySelector('.unlock-field .secret-dots');
    return input.scrollLeft > 0 && dots.style.transform === 'translateX(' + -input.scrollLeft + 'px)';
  })()`), true);
  await evaluate(`(() => { const i = document.querySelector('#password'); i.select(); })()`);
  await type(PASSWORD);
  await click('#password-reveal');
  check('reveal shows the text', await evaluate(`[getComputedStyle(document.querySelector('#password')).color !== 'rgba(0, 0, 0, 0)', document.querySelector('.unlock-field .secret-layer').hidden]`), [true, true]);
  await click('#password-reveal');
  await shot('2-unlock');
  await press('Enter');
  check('unlocked', await until(`!document.querySelector('#app').hidden`), true);
  check('database label', await text('#db-label'), 'Database');
  check('groups', await texts('.tree-item--group .tree-label'), ['Database', 'General', 'Windows', 'Network', 'Internet', 'eMail', 'Homebanking']);
  check('all entries count', await text('.tree-item--all .tree-count'), '3');
  check('entries', await texts('.entry-title'), ['Sample Entry', 'Sample Entry #2', 'Проверочный аккаунт']);
  // An entry with a title alone has no empty second line: the title sits centred, the row keeps its height.
  const rows = await evaluate(`[...document.querySelectorAll('.entry')].map((row) => {
    const r = row.getBoundingClientRect();
    const a = row.querySelector('.avatar').getBoundingClientRect();
    const t = row.querySelector('.entry-title').getBoundingClientRect();
    return { height: Math.round(r.height), subs: row.querySelectorAll('.entry-sub').length, offset: Math.round((t.top + t.height / 2) - (a.top + a.height / 2)) };
  })`);
  check('lone title: no second line', rows.map((r) => r.subs), [1, 1, 0]);
  check('lone title: centred on the avatar', Math.abs(rows[2].offset) <= 1, true);
  check('lone title: same row height', new Set(rows.map((r) => r.height)).size, 1);
  check('status format', (await text('#status-format')).endsWith('KDBX 4.0 · AES-256 · AES-KDF'), true);
  check('status read-only', (await text('#status-file')).includes('read-only'), true);

  // Reading an entry
  await clickNth('.entry', 'Sample Entry #2');
  check('details title', await text('.details-title'), 'Sample Entry #2');
  check('user name', await fieldValue('User name'), 'Michael321');
  check('password masked', await text('.field-value--secret'), '••••••••••');
  await click('.field-value--secret + .field-actions .icon-button');
  check('password revealed', await text('.field-value--secret'), '12345');
  check('link is safe', await evaluate(`document.querySelector('.field-link').getAttribute('rel')`), 'noopener noreferrer');
  await shot('3-entry');

  // Keyboard navigation
  await click('.entry');
  await press('ArrowDown');
  check('arrow down', await text('.details-title'), 'Sample Entry #2');
  await press('ArrowUp');
  check('arrow up', await text('.details-title'), 'Sample Entry');

  // A group
  await clickNth('.tree-item--group', 'General');
  check('group list', await texts('.entry-title'), ['Проверочный аккаунт']);
  check('list title', await text('#list-title'), 'General');

  // Search, from anywhere
  await press('f', MOD);
  check('search focused', await evaluate(`document.activeElement?.id`), 'search');
  await type('michael');
  check('search results', await texts('.entry-title'), ['Sample Entry #2']);
  await type('zzz');
  check('nothing found', await text('#entries-empty'), 'Nothing found');
  await press('Escape');
  check('search cleared', await evaluate(`document.querySelector('#search').value`), '');

  // Editing
  await clickNth('.tree-item--all', 'All entries');
  await clickNth('.entry', 'Sample Entry');
  await press('e', MOD);
  check('edit mode', await visible('.details--edit'), true);
  check('entry password masked', await evaluate(`(() => { const i = document.querySelector('[data-field="password"]'); const cs = getComputedStyle(i); return [i.type, cs.webkitTextSecurity, cs.color, i.nextElementSibling.textContent]; })()`), ['text', 'none', 'rgba(0, 0, 0, 0)', '•'.repeat('Password'.length)]);
  await evaluate(`(() => { const i = document.querySelector('[data-field="username"]'); i.focus(); i.select(); })()`);
  await type('new-user@example.org');
  await click('.details .button--primary[type=submit]');
  check('edit applied', await fieldValue('User name'), 'new-user@example.org');
  check('dirty', await text('#status-state'), 'Unsaved changes');
  check('history link', await evaluate(`document.querySelector('.details-meta .link-button')?.textContent`), '1 earlier version');
  await click('.details-meta .link-button');
  check('history bar', await visible('.history-bar'), true);
  check('old version shows old name', await fieldValue('User name'), 'User Name');
  await click('.history-bar .icon-button');

  // Cancelling an edit keeps the entry as it was
  await press('e', MOD);
  await evaluate(`(() => { const i = document.querySelector('[data-field="title"]'); i.focus(); i.select(); })()`);
  await type('Should not stick');
  await press('Escape');
  await until(`!!document.querySelector('.overlay:not([hidden]) .dialog')`);
  await click('.overlay .button--danger');
  check('cancelled edit', await text('.details-title'), 'Sample Entry');

  // A new entry with a generated password
  await press('n', MOD);
  check('new entry in edit mode', await visible('.details--edit'), true);
  check('title focused', await evaluate(`document.activeElement?.dataset.field`), 'title');
  await type('Bank');
  await click('[data-generate]');
  check('generator open', await visible('.gen'), true);
  check('generator: derived v3 first', await evaluate(`document.querySelector('[data-field="gen-kind"]').value`), 'v3');
  await pickKind('random');
  await shot('4-generator');
  await click('.gen .button--primary');
  const generated = await evaluate(`document.querySelector('[data-field="password"]').value`);
  check('generated length', [...generated].length, 20);
  check('strength shown', (await text('.meter-label')).startsWith('Strong'), true);
  await evaluate(`document.querySelector('[data-field="tags"]').focus()`);
  await type('finance, personal');
  await clickNth('.details button', '+ Add field');
  check('custom name focused', await evaluate(`document.activeElement?.classList.contains('custom-name')`), true);
  await click('.field--custom .icon-button:last-child');
  await clickNth('.details button', '+ One-time code');
  check('otp key focused', await evaluate(`document.activeElement?.dataset.field`), 'otp');
  check('no second otp button', (await texts('.field-adders .button')).includes('+ One-time code'), false);
  await type('key 0189');
  check('bad key noted', await visible('.details--edit .field-note'), true);
  await click('.details .button--primary[type=submit]');
  check('bad key not saved', await text('.details-error'), 'The one-time code key is not valid');
  await evaluate(`(() => { const i = document.querySelector('[data-field="otp"]'); i.focus(); i.select(); })()`);
  await type('JBSW Y3DP EHPK 3PXP');
  check('bad key note gone', await visible('.details--edit .field-note'), false);
  const otpMask = `(() => { const i = document.querySelector('[data-field="otp"]'); return [getComputedStyle(i).color === 'rgba(0, 0, 0, 0)', i.nextElementSibling.hidden ? '' : i.nextElementSibling.textContent]; })()`;
  check('otp key masked', await evaluate(otpMask), [true, '•'.repeat('JBSW Y3DP EHPK 3PXP'.length)]);
  await click('.secret-field:has([data-field="otp"]) + .icon-button');
  check('otp key revealed', await evaluate(otpMask), [false, '']);
  check('code previewed while editing', await until(`/^\\d{3} \\d{3}$/.test(document.querySelector('.details--edit .otp-code')?.textContent ?? '')`), true);
  await shot('4a-otp-editor');
  await click('.details .button--primary[type=submit]');
  check('new entry saved', await text('.details-title'), 'Bank');
  check('one-time code shown', /^\d{3} \d{3}$/.test(await text('.otp-code')), true);
  check('otp field hidden behind the code', await fieldValue('otp'), null);
  check('tags on the entry', await texts('.details .tag'), ['finance', 'personal']);
  check('tags in the sidebar', await texts('.tree-item--tag .tree-label'), ['finance', 'personal']);
  await shot('4b-entry-otp');
  check('new entry listed', (await texts('.entry-title')).includes('Bank'), true);

  // A new entry cancelled right away leaves nothing behind
  await press('n', MOD);
  await press('Escape');
  check('cancelled new entry gone', (await texts('.entry-title')).length, 4);

  // Deleting to the recycle bin
  await clickNth('.entry', 'Проверочный аккаунт');
  await press('Delete');
  check('recycle bin appears', await text('.tree-item--trash .tree-count'), '1');
  check('entry left the list', (await texts('.entry-title')).includes('Проверочный аккаунт'), false);
  await clickNth('.tree-item--trash', 'Recycle bin');
  check('bin lists it', await texts('.entry-title'), ['Проверочный аккаунт']);
  check('restore offered', await evaluate(`document.querySelector('.details-actions .button')?.textContent`), 'Restore');

  // A new group
  await click('#new-group');
  await type('Work');
  await press('Enter');
  check('group created', (await texts('.tree-item--group .tree-label')).includes('Work'), true);

  // A subgroup, and the caret that folds it
  const rightClick = async (selector) => {
    const box = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    for (const t of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type: t, x: box[0], y: box[1], button: 'right', clickCount: 1 });
    }
    await sleep(60);
  };
  await evaluate(`document.querySelectorAll('[data-pick]').forEach((n) => n.removeAttribute('data-pick')); [...document.querySelectorAll('.tree-item--group')].find((n) => n.textContent.includes('General')).setAttribute('data-pick', '')`);
  await rightClick('[data-pick]');
  await clickNth('.context-item', 'New group inside');
  await type('Accounts');
  await press('Enter');
  check('subgroup created', (await texts('.tree-item--group .tree-label')).includes('Accounts'), true);
  const generalCaret = `[...document.querySelectorAll('.tree-item--group')].find((n) => n.textContent.includes('General')).querySelector('.tree-caret')`;
  check('caret shows open', await evaluate(`${generalCaret}.textContent`), '▾');
  check('caret is large', await evaluate(`getComputedStyle(${generalCaret}).fontSize`), '22px');
  await shot('5a-subgroup');
  await evaluate(`${generalCaret}.setAttribute('data-caret', '')`);
  await click('[data-caret]');
  check('caret folds', (await texts('.tree-item--group .tree-label')).includes('Accounts'), false);
  check('caret shows closed', await evaluate(`${generalCaret}.textContent`), '▸');
  await evaluate(`${generalCaret}.setAttribute('data-caret', '')`);
  await click('[data-caret]');
  check('caret unfolds', (await texts('.tree-item--group .tree-label')).includes('Accounts'), true);

  // A deleted group waits in the recycle bin, folded until asked
  await click('#new-group');
  await type('Old');
  await press('Enter');
  await evaluate(`document.querySelectorAll('[data-pick]').forEach((n) => n.removeAttribute('data-pick')); [...document.querySelectorAll('.tree-item--group')].find((n) => n.textContent.includes('Old')).setAttribute('data-pick', '')`);
  await rightClick('[data-pick]');
  await clickNth('.context-item', 'Delete group');
  await until(`!!document.querySelector('.overlay:not([hidden]) .dialog')`);
  await click('.overlay .button--primary, .overlay .button--danger');
  await until(`![...document.querySelectorAll('.overlay:not([hidden]) .dialog')].length`);
  const binCaret = `document.querySelector('.tree-item--trash .tree-caret')`;
  check('bin: folded by default', (await texts('.tree-item--group .tree-label')).includes('Old'), false);
  check('bin: caret shows closed', await evaluate(`${binCaret}.textContent`), '▸');
  await evaluate(`${binCaret}.setAttribute('data-caret', '')`);
  await click('[data-caret]');
  check('bin: caret unfolds', (await texts('.tree-item--group .tree-label')).includes('Old'), true);
  check('bin: remembered', await evaluate(`JSON.parse(localStorage.getItem('html-password-manager')).binOpen`), true);
  await evaluate(`${binCaret}.setAttribute('data-caret', '')`);
  await click('[data-caret]');
  check('bin: caret folds', (await texts('.tree-item--group .tree-label')).includes('Old'), false);
  await shot('5-app');

  // A new entry whose password is derived from the master password, not stored
  await clickNth('.tree-item--all', 'All entries');
  await press('n', MOD);
  await type('GitHub');
  await evaluate(`document.querySelector('[data-field="username"]').focus()`);
  await type('me@example.com');
  await evaluate(`document.querySelector('[data-field="url"]').focus()`);
  await type('https://www.github.com/login');
  await click('[data-generate]');
  check('generator: no legacy kinds by default', await kinds(), ['Derived v3', 'Random']);
  check('generator: the last kind is remembered', await evaluate(`document.querySelector('[data-field="gen-kind"]').value`), 'random');
  await pickKind('v3');
  check('generator v3: the entry\'s site and user', await text('.gen-account'), 'Site: github.com, from the websiteUser name: me@example.com, from the entry');
  check('generator v3: previews the derived password', await until(`document.querySelector('.gen-preview').textContent === ${JSON.stringify(DERIVED)}`), true);
  const v3Master = () => evaluate(`[document.querySelector('[data-field="gen-v3-session"]').checked, document.querySelector('[data-field="gen-v3-master"]').disabled]`);
  check('generator v3: the database\'s master password by default', await v3Master(), [true, true]);
  await click('[data-field="gen-v3-session"]');
  check('generator v3: another master password asked for', [await v3Master(), await text('.gen .field-note'), await evaluate(`document.activeElement?.dataset.field`)], [[false, false], 'Enter the master password to derive from', 'gen-v3-master']);
  await type(PASSWORD);
  check('generator v3: the same master password typed, the same password', await until(`document.querySelector('.gen-preview').textContent === ${JSON.stringify(DERIVED)}`), true);
  await type(' 2');
  check('generator v3: another master password, another password', await until(`!['…', '—', ${JSON.stringify(DERIVED)}].includes(document.querySelector('.gen-preview').textContent)`), true);
  await click('[data-field="gen-v3-session"]');
  check('generator v3: back to the database\'s', [await v3Master(), await until(`document.querySelector('.gen-preview').textContent === ${JSON.stringify(DERIVED)}`)], [[true, true], true]);
  await click('.gen .button--primary');
  check('derived: the site is the website\'s domain', await text('.derived-site'), 'Site: github.com, from the website');
  check('derived: computed, masked', await until(`document.querySelector('.derived-preview').textContent === '••••••••••'`), true);
  await click('.derived-preview + .icon-button');
  check('derived: the password of generator 3', await text('.derived-preview'), DERIVED);
  await shot('4c-derived');
  await click('.details .button--primary[type=submit]');
  check('derived: saved', await text('.details-title'), 'GitHub');
  check('derived: marked as derived', await text('.field-hint'), 'Derived · github.com · version 1');
  check('derived: revealed in read mode', await text('.field-value--secret'), DERIVED);
  check('derived: no warning', await evaluate(`document.querySelector('.field-note').hidden`), true);
  // Another domain is another password; the next version too; switching to a stored one keeps what is shown.
  await press('e', MOD);
  await evaluate(`(() => { const i = document.querySelector('[data-field="url"]'); i.focus(); i.select(); })()`);
  await type('gitlab.com');
  check('derived: follows the website', await until(`document.querySelector('.derived-site').textContent === 'Site: gitlab.com, from the website'`), true);
  check('derived: another password for another site', await until(`!['…', '••••••••••', ${JSON.stringify(DERIVED)}].includes(document.querySelector('.derived-preview').textContent)`), true);
  await evaluate(`(() => { const i = document.querySelector('[data-field="url"]'); i.focus(); i.select(); })()`);
  await type('https://www.github.com/login');
  check('derived: back to the first site', await until(`document.querySelector('.derived-preview').textContent === ${JSON.stringify(DERIVED)}`), true);
  await clickNth('.derived-inputs button', '+1');
  check('derived: next version', await until(`document.querySelector('.derived-preview').textContent === ${JSON.stringify(DERIVED_V2)}`), true);
  await clickNth('.derived-foot button', 'Store this password');
  check('derived: turned into a stored password', await until(`document.querySelector('[data-field="password"]')?.value === ${JSON.stringify(DERIVED_V2)}`), true);
  await press('Escape');
  await until(`!!document.querySelector('.overlay:not([hidden]) .dialog')`);
  await click('.overlay .button--danger');
  check('derived: edit dropped', await text('.field-hint'), 'Derived · github.com · version 1');

  // Legacy algorithms: offered once the settings ask for them, checked against the .NET originals
  await click('#settings');
  await clickNth('.settings-row--check', 'Show legacy password algorithms');
  check('legacy: remembered', await evaluate(`JSON.parse(localStorage.getItem('html-password-manager')).showLegacy`), true);
  await press('Escape');
  const fill = async (name, value) => {
    await evaluate(`document.querySelector('[data-field=${JSON.stringify(name)}]').focus()`);
    await type(value);
  };
  await click('#generator');
  check('legacy: kinds offered, newest first', await kinds(), ['Derived v3', 'Derived v2', 'Derived v1', 'Random']);
  await pickKind('legacy2');
  check('legacy 2: nothing to use yet', await evaluate(`document.querySelector('.gen .button--primary').disabled`), true);
  await fill('gen-l2-id', '1');
  await fill('gen-l2-primary', '1');
  check('legacy 2: phrase masked', await evaluate(`document.querySelector('[data-field="gen-l2-primary"]').classList.contains('masked')`), true);
  await clickNth('.gen button', 'Compute the key');
  check('legacy 2: key of the original', await until(`document.querySelector('[data-field="gen-l2-key"]').value === '8pgYm9fZha'`), true);
  check('legacy 2: key signature', await text('.gen-group .gen-sign'), 'E8');
  await fill('gen-l2-secondary', '1');
  check('legacy 2: password of the original', [await evaluate(`[...document.querySelectorAll('.gen-sign')].at(-1).textContent`), await evaluate(`[...document.querySelectorAll('.gen-preview')].at(-1).textContent`)], ['MN', 'aEXTmKcRlO']);
  await shot('4d-legacy2');
  await pickKind('legacy1');
  await fill('gen-l1-master', 'master');
  await fill('gen-l1-id', 'github.com');
  await clickNth('.gen button', 'Compute the primary key');
  check('legacy 1: primary key of the original', await until(`document.querySelector('[data-field="gen-l1-primary"]').value === 'Lj0oFPZfaB'`, 15000), true);
  await fill('gen-l1-secondary', 'second');
  check('legacy 1: result of the original', await text('.gen-preview'), 'wXoWNyEWSG');
  await shot('4e-legacy1');
  await pickKind('legacy2');
  check('legacy: a kind keeps what was typed', await evaluate(`document.querySelector('[data-field="gen-l2-key"]').value`), '8pgYm9fZha');
  await press('Escape');
  check('legacy: the popover closes', await visible('.gen'), false);

  // From an entry: the identifier is suggested, the keys can be kept in memory until the lock
  await press('e', MOD);
  await click('[data-generate]');
  await pickKind('legacy1');
  check('legacy 1: an e-mail user name is the identifier', await evaluate(`document.querySelector('[data-field="gen-l1-id"]').value`), 'me@example.com');
  const remembered = (name) => evaluate(`document.querySelector('[data-remember=${JSON.stringify(name)}]').checked`);
  check('legacy 1: nothing kept yet', [await evaluate(`document.querySelector('[data-field="gen-l1-master"]').value`), await remembered('legacy1-master'), await remembered('legacy1-secondary')], ['', false, false]);
  await fill('gen-l1-master', 'master');
  await click('[data-remember="legacy1-master"]');
  await fill('gen-l1-secondary', 'second');
  await press('Escape');
  await click('[data-generate]');
  check('legacy 1: only the ticked key kept', [await evaluate(`document.querySelector('[data-field="gen-l1-master"]').value`), await evaluate(`document.querySelector('[data-field="gen-l1-secondary"]').value`), await remembered('legacy1-master'), await remembered('legacy1-secondary')], ['master', '', true, false]);
  check('legacy 1: the missing key has the focus', await evaluate(`document.activeElement?.dataset.field`), 'gen-l1-secondary');
  await fill('gen-l1-secondary', 'second');
  await click('[data-remember="legacy1-secondary"]');
  await press('Escape');
  await click('[data-generate]');
  check('legacy 1: both keys filled from memory', [await evaluate(`document.querySelector('[data-field="gen-l1-master"]').value`), await evaluate(`document.querySelector('[data-field="gen-l1-secondary"]').value`), await remembered('legacy1-secondary')], ['master', 'second', true]);
  check('legacy 1: the primary key computed at once', await until(`document.querySelector('[data-field="gen-l1-primary"]').value !== ''`, 15000), true);
  await evaluate(`(() => { const i = document.querySelector('[data-field="gen-l1-id"]'); i.focus(); i.select(); })()`);
  await type('github.com');
  await clickNth('.gen button', 'Compute the primary key');
  check('legacy 1: an edited identifier', await until(`document.querySelector('[data-field="gen-l1-primary"]').value === 'Lj0oFPZfaB'`, 15000), true);
  check('legacy 1: the result from remembered keys', await text('.gen-preview'), 'wXoWNyEWSG');
  await click('.gen .button--primary');
  check('legacy 1: used as a stored password', await evaluate(`document.querySelector('[data-field="password"]')?.value`), 'wXoWNyEWSG');
  // Version 3 with another master password: put in as a stored password
  await click('[data-generate]');
  await pickKind('v3');
  check('generator v3: ticked again on every opening', (await v3Master())[0], true);
  await click('[data-field="gen-v3-session"]');
  await type('другой мастер-пароль');
  check('generator v3: computed from the typed one', await until(`!['…', '—'].includes(document.querySelector('.gen-preview').textContent)`), true);
  const otherDerived = await text('.gen-preview');
  await shot('4g-v3-other-master');
  await click('.gen .button--primary');
  check('generator v3: another master password gives a stored password', await evaluate(`document.querySelector('[data-field="password"]')?.value`), otherDerived);
  // The database's master password as the master key
  await click('[data-generate]');
  await pickKind('legacy1');
  const masterState = () => evaluate(`(() => { const i = document.querySelector('[data-field="gen-l1-master"]'); return [i.value, i.disabled, document.querySelector('[data-remember="legacy1-master"]').disabled]; })()`);
  check('legacy 1: own master key by default', await masterState(), ['master', false, false]);
  await click('[data-field="gen-l1-session"]');
  check('legacy 1: session master: the field is off', await masterState(), ['', true, true]);
  check('legacy 1: session master: remembered', await evaluate(`JSON.parse(localStorage.getItem('html-password-manager')).legacyUsesMaster`), { legacy1: true, legacy2: false });
  check('legacy 1: session master: the primary key of the database password', await until(`document.querySelector('[data-field="gen-l1-primary"]').value === ${JSON.stringify(SESSION_KEY)}`, 15000), true);
  await shot('4f-legacy1-session');
  await press('Escape');
  await click('[data-generate]');
  check('legacy 1: session master: kept on the next opening', [await evaluate(`document.querySelector('[data-field="gen-l1-session"]').checked`), (await masterState())[1]], [true, true]);
  check('legacy 1: session master: computed at once', await until(`document.querySelector('[data-field="gen-l1-primary"]').value === ${JSON.stringify(SESSION_KEY)}`, 15000), true);
  await click('[data-field="gen-l1-session"]');
  check('legacy 1: own master key back', await masterState(), ['master', false, false]);
  await press('Escape');
  await evaluate(`(() => { const i = document.querySelector('[data-field="username"]'); i.focus(); i.select(); })()`);
  await type('dmytro');
  await click('[data-generate]');
  await pickKind('legacy2');
  check('legacy 2: user name @ site', await evaluate(`document.querySelector('[data-field="gen-l2-id"]').value`), 'dmytro@github.com');
  // The database's master password as the primary secret phrase
  const phraseState = () => evaluate(`(() => { const i = document.querySelector('[data-field="gen-l2-primary"]'); return [i.disabled, document.querySelector('[data-remember="legacy2-primary"]').disabled]; })()`);
  check('legacy 2: own primary phrase by default', await phraseState(), [false, false]);
  await click('[data-field="gen-l2-session"]');
  check('legacy 2: session master: the phrase is off', await phraseState(), [true, true]);
  await shot('4h-legacy2-session');
  check('legacy 2: session master: the key of the database password', await until(`document.querySelector('[data-field="gen-l2-key"]').value === ${JSON.stringify(SESSION_KEY_2)}`, 15000), true);
  check('legacy 2: session master: remembered apart from legacy 1', await evaluate(`JSON.parse(localStorage.getItem('html-password-manager')).legacyUsesMaster`), { legacy1: false, legacy2: true });
  await click('[data-field="gen-l2-session"]');
  check('legacy 2: own primary phrase back', await phraseState(), [false, false]);
  await press('Escape');
  await press('Escape');
  await until(`!!document.querySelector('.overlay:not([hidden]) .dialog')`);
  await click('.overlay .button--danger');
  check('legacy: entry edit dropped', await text('.field-hint'), 'Derived · github.com · version 1');

  // Saving downloads the database; it opens with the same password
  await press('s', MOD);
  await until(`window.__downloads.length > 0`);
  check('download name', await evaluate(`window.__downloads[0]`), 'Database.kdbx');
  check('clean after save', await text('#status-state'), 'Saved');
  const saved = Buffer.from(await evaluate(`window.__blobBase64()`), 'base64');
  const reopened = await K.openDatabase(saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength), PASSWORD, null);
  const all = [...reopened.getDefaultGroup().allEntries()];
  const sample = all.find((e) => K.field(e, 'Title') === 'Sample Entry');
  check('saved: edited user name', K.field(sample, 'UserName'), 'new-user@example.org');
  check('saved: history kept', sample.history.length, 1);
  const bank = all.find((e) => K.field(e, 'Title') === 'Bank');
  check('saved: new entry', K.field(bank, 'Password'), generated);
  check('saved: otp field', K.field(bank, 'otp'), 'otpauth://totp/Bank?secret=JBSWY3DPEHPK3PXP&period=30&digits=6&issuer=Bank');
  check('saved: otp protected', K.isProtected(bank, 'otp'), true);
  check('saved: tags', bank.tags, ['finance', 'personal']);
  check('saved: recycle bin', K.recycleBin(reopened)?.entries.map(K.titleOf), ['Проверочный аккаунт']);
  check('saved: new group', reopened.getDefaultGroup().groups.some((g) => g.name === 'Work'), true);
  check('saved: subgroup', reopened.getDefaultGroup().groups.find((g) => g.name === 'General')?.groups.map((g) => g.name), ['Accounts']);
  const github = all.find((e) => K.field(e, 'Title') === 'GitHub');
  const githubCheck = (await K.derivePassword(PASSWORD, DERIVED_SPEC, 'me@example.com')).check;
  check('saved: derived settings instead of a password', K.parseDerived(K.field(github, 'Password'), K.field(github, 'URL')), { site: 'github.com', version: 1, ...K.REQUIREMENT_DEFAULTS, check: githubCheck });

  // A new master password: the derived password is turned into a stored one first
  await clickNth('#db-name', 'Database');
  await clickNth('.context-item', 'Change master password');
  check('re-key: offers to keep derived passwords', await evaluate(`document.querySelector('.dialog input[name=convert]')?.checked`), true);
  check('re-key: counts them', (await evaluate(`document.querySelector('.dialog input[name=convert]').parentElement.textContent`)).startsWith('Turn 1 derived password into a stored one'), true);
  await shot('4d-rekey');
  await evaluate(`document.querySelector('.dialog input[name=password]').focus()`);
  await type('new master');
  await evaluate(`document.querySelector('.dialog input[name=repeat]').focus()`);
  await type('new master');
  await press('Enter');
  check('re-key: done', await until(`!document.querySelector('.overlay .dialog')`), true);
  await clickNth('.entry', 'GitHub');
  check('re-key: stored now', await evaluate(`document.querySelector('.field-hint')`), null);
  await press('s', MOD);
  await until(`document.querySelector('#status-state').textContent === 'Saved'`);
  const rekeyed = Buffer.from(await evaluate(`window.__blobBase64()`), 'base64');
  const rekeyedDb = await K.openDatabase(rekeyed.buffer.slice(rekeyed.byteOffset, rekeyed.byteOffset + rekeyed.byteLength), 'new master', null);
  const kept = [...rekeyedDb.getDefaultGroup().allEntries()].find((e) => K.field(e, 'Title') === 'GitHub');
  check('re-key: the same password, stored', K.field(kept, 'Password'), DERIVED);
  check('re-key: derived settings in the history', K.parseDerived(K.field(kept.history.at(-1), 'Password'), K.field(kept, 'URL'))?.site, 'github.com');

  // Locking wipes the view; unlocking brings it back
  await press('l', MOD);
  check('locked', await visible('#unlock'), true);
  check('entries gone from the page', await evaluate(`document.querySelectorAll('.entry').length`), 0);
  await type(PASSWORD);
  await press('Enter');
  check('unlocked again', await until(`!document.querySelector('#app').hidden`), true);

  // Switching the language redraws everything at once, and is remembered
  const pickLanguage = async (code) => {
    if (!(await visible('.settings'))) await click('#settings');
    await evaluate(`(() => { const s = document.querySelector('.settings-select'); s.value = ${JSON.stringify(code)}; s.dispatchEvent(new Event('change')); })()`);
    await sleep(60);
  };
  await clickNth('.entry', 'Sample Entry #2');
  await pickLanguage('ru');
  check('ru: lang attribute', await evaluate(`document.documentElement.lang`), 'ru');
  check('ru: settings panel redrawn', await text('.settings-title'), 'Настройки');
  check('ru: markup translated', [await text('.toolbar-label'), await evaluate(`document.querySelector('#lock').title`), await evaluate(`document.querySelector('#search').placeholder`)], ['Новая запись', 'Заблокировать (⌘L)', 'Поиск (⌘F)']);
  check('ru: sidebar', await text('.tree-item--all .tree-label'), 'Все записи');
  check('ru: list title', await text('#list-title'), 'Все записи');
  check('ru: entry fields', await fieldValue('Имя пользователя'), 'Michael321');
  check('ru: plural in the status bar', /^3 записи · /.test(await text('#status-format')), true);
  check('ru: remembered', await evaluate(`JSON.parse(localStorage.getItem('html-password-manager')).language`), 'ru');
  await pickLanguage('ar');
  check('ar: right to left', await evaluate(`document.documentElement.dir`), 'rtl');
  check('ar: sidebar on the right', await evaluate(`document.querySelector('.sidebar').getBoundingClientRect().left > document.querySelector('.workspace').getBoundingClientRect().left`), true);
  await shot('8-arabic');
  await pickLanguage('en');
  check('en again', [await evaluate(`document.documentElement.dir`), await text('.settings-title'), await text('.toolbar-label'), await text('#list-title')], ['ltr', 'Settings', 'New entry', 'All entries']);
  await press('Escape');

  if (SHOTS) {
    await evaluate(`document.documentElement.dataset.theme = 'dark'`);
    await clickNth('.entry', 'Sample Entry #2');
    await shot('6-dark');
    await evaluate(`document.documentElement.dataset.theme = 'light'`);
  }

  /* -------------------------------------------------------------- *
   * A phone: 390×844, a touch screen with no hover. One screen at a
   * time, the groups in a drawer, menus as sheets, and the history in
   * step with them, so that back closes the layer on top.
   * -------------------------------------------------------------- */
  await clickNth('.entry', 'Sample Entry #2');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await sleep(200);
  const tapAt = async (x, y) => {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(120);
  };
  const centre = (selector) => evaluate(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n) return null; const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  const tap = async (selector) => {
    const box = await centre(selector);
    if (!box) throw new Error(`Nothing to tap: ${selector}`);
    await tapAt(box[0], box[1]);
  };
  const tapNth = async (selector, label) => {
    const ok = await evaluate(`(() => {
      document.querySelectorAll('[data-pick]').forEach((n) => n.removeAttribute('data-pick'));
      const hit = [...document.querySelectorAll(${JSON.stringify(selector)})].find((n) => n.textContent.includes(${JSON.stringify(label)}));
      if (hit) hit.setAttribute('data-pick', '');
      return !!hit;
    })()`);
    if (!ok) throw new Error(`No ${selector} with "${label}"`);
    await tap('[data-pick]');
  };
  // The drawer slides in: what is tapped in it next has to have stopped moving.
  const openDrawer = async () => {
    await tap('#toggle-sidebar');
    await sleep(300);
  };
  const layers = () => evaluate(`[document.body.classList.contains('show-details'), document.body.classList.contains('drawer-open'), history.state?.hpm ?? 0]`);
  const shown = (selector) => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].filter((n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden').length`);
  const labels = () => evaluate(`[...document.querySelectorAll('.context-item')].map((n) => n.firstChild.textContent)`);

  check('phone: the entry shown stays on screen as the window narrows', await layers(), [true, false, 1]);
  await tap('#back');
  check('phone: back to the list', await until(`!document.body.classList.contains('show-details') && history.state === null`), true);
  check('phone: one pane at a time', [await shown('.list-pane'), await shown('.details-pane'), await shown('.sidebar')], [1, 0, 0]);
  check('phone: nothing wider than the screen', await evaluate(`[document.documentElement.scrollWidth <= innerWidth, ...['.toolbar', '.list-pane'].map((s) => { const n = document.querySelector(s); return n.scrollWidth <= n.clientWidth; })]`), [true, true, true]);
  check('phone: the toolbar', await Promise.all(['#toggle-sidebar', '#new-entry', '#search', '#save', '#more', '#back', '#generator', '#theme', '#settings', '#lock'].map(shown)), [1, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
  // Safari on iOS zooms into a field whose text is smaller.
  check('phone: fields large enough not to zoom', await evaluate(`parseFloat(getComputedStyle(document.querySelector('#search')).fontSize) >= 16`), true);
  await shot('7a-phone-list');

  await tapNth('.entry', 'Sample Entry #2');
  check('phone: a tap opens the entry', [await layers(), await text('.details-title'), await shown('.list-pane'), await shown('.details-pane')], [[true, false, 1], 'Sample Entry #2', 0, 1]);
  check('phone: back instead of the groups, no search', await Promise.all(['#back', '#toggle-sidebar', '#search'].map(shown)), [1, 0, 0]);
  check('phone: copy buttons without a hover', await evaluate(`getComputedStyle(document.querySelector('.field-actions')).opacity`), '1');
  await shot('7b-phone-entry');
  await evaluate(`history.back()`);
  check('phone: the system back returns to the list', await until(`!document.body.classList.contains('show-details')`), true);

  // The groups slide in over the list, and a group picked there opens as a list.
  await openDrawer();
  check('phone: the drawer', [await layers(), await shown('.sidebar'), (await shown('.tree-more')) > 0], [[false, true, 1], 1, true]);
  await shot('7c-phone-drawer');
  await tapNth('.tree-item--group', 'General');
  check('phone: a group picked closes the drawer', await until(`!document.body.classList.contains('drawer-open') && history.state === null`), true);
  check('phone: the group, as a list', [await text('#list-title'), await layers()], ['General', [false, false, 0]]);

  // No right click and no drag: the ⋯ of a group opens its menu, which moves it too.
  // (Unlocked again from the file it was opened from, the database is the sample one.)
  await openDrawer();
  await evaluate(`document.querySelectorAll('[data-pick]').forEach((n) => n.removeAttribute('data-pick')); [...document.querySelectorAll('.tree-item--group')].find((n) => n.textContent.includes('Homebanking')).querySelector('.tree-more').setAttribute('data-pick', '')`);
  await tap('[data-pick]');
  check('phone: the group menu, as a sheet', [await labels(), await layers()], [['New entry here', 'New group inside', 'Rename', 'Move to group…', 'Delete group', 'Cancel'], [false, true, 2]]);
  check('phone: the ⋯ does not pick the group', await text('#list-title'), 'General');
  check('phone: a sheet along the bottom', await evaluate(`(() => { const r = document.querySelector('.context-menu--sheet').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.bottom)]; })()`), [0, 390, 844]);
  await tapNth('.context-item', 'Move to group');
  check('phone: where a group can go', await labels(), ['Database', '   General', '   Windows', '   Network', '   Internet', '   eMail', 'Cancel']);
  await tapNth('.context-item', 'Internet');
  const tree = await evaluate(`[...document.querySelectorAll('.tree-item--group')].map((n) => n.querySelector('.tree-label').textContent + ' ' + n.style.paddingInlineStart)`);
  check('phone: the group moved', tree.slice(-3), ['Internet 20px', 'Homebanking 34px', 'eMail 20px']);
  check('phone: the sheet gone, the drawer still open', await until(`history.state?.hpm === 1 && !document.querySelector('.context-menu')`), true);
  await evaluate(`history.back()`);
  check('phone: back closes the drawer', await until(`!document.body.classList.contains('drawer-open') && history.state === null`), true);

  // What the toolbar has no room for is in its ⋯ menu.
  await tap('#more');
  const theme = { light: 'Light', dark: 'Dark', system: 'System' }[process.env.THEME ?? 'light'];
  check('phone: the ⋯ menu', await labels(), ['Password generator', `Theme: ${theme}`, 'Settings', 'Lock', 'Cancel']);
  await shot('7d-phone-menu');
  await evaluate(`history.back()`);
  check('phone: back closes a sheet first', await until(`!document.querySelector('.context-menu') && history.state === null`), true);
  await tap('#more');
  await tapNth('.context-item', 'Password generator');
  check('phone: the generator, as a sheet', [await shown('.popover--sheet .gen'), await layers()], [1, [false, false, 1]]);
  await shot('7e-phone-generator');
  await tap('.sheet-head .icon-button');
  check('phone: the sheet closes', await until(`!document.querySelector('.popover') && history.state === null`), true);
  // A tap on a sheet's backdrop closes it and goes no further, to the entry under it.
  await tap('#sort');
  const under = await centre('.entry');
  await tapAt(under[0], under[1]);
  check('phone: the backdrop keeps the tap', [await evaluate(`!!document.querySelector('.context-menu')`), await layers()], [false, [false, false, 0]]);

  // Back from an edit keeps it; a new entry left empty is dropped.
  await openDrawer();
  await tapNth('.tree-item--all', 'All entries');
  await until(`history.state === null`);
  await tapNth('.entry', 'Sample Entry #2');
  await tapNth('.details-actions .button', 'Edit');
  await evaluate(`(() => { const i = document.querySelector('[data-field="username"]'); i.focus(); i.select(); })()`);
  await type('phone-user');
  await evaluate(`document.activeElement.blur()`);
  await evaluate(`history.back()`);
  check('phone: back from an edit', await until(`!document.body.classList.contains('show-details') && history.state === null`), true);
  await tapNth('.entry', 'Sample Entry #2');
  check('phone: the edit kept', [await fieldValue('User name'), await text('#status-state')], ['phone-user', 'Unsaved changes']);
  await tap('#back');
  await until(`!document.body.classList.contains('show-details')`);
  const count = (await texts('.entry-title')).length;
  await tap('#new-entry');
  check('phone: a new entry on its own screen', [await layers(), await visible('.details--edit')], [[true, false, 1], true]);
  await evaluate(`document.activeElement.blur()`);
  await evaluate(`history.back()`);
  check('phone: a new entry left empty is dropped', [await until(`!document.body.classList.contains('show-details')`), (await texts('.entry-title')).length], [true, count]);

  // Save hands the database to the share sheet where the system takes files that way (iOS).
  await evaluate(`navigator.canShare = () => true; navigator.share = async (data) => { window.__shared = data.files; }`);
  await tap('#save');
  check('phone: saved through the share sheet', await until(`document.querySelector('#status-state').textContent === 'Saved'`, 15000), true);
  check('phone: the file shared', [await evaluate(`window.__shared.map((f) => f.name)`), await text('.toast'), (await text('#status-file')).endsWith('read-only, saving shares a copy')], [['Database.kdbx'], 'Database.kdbx shared', true]);
  const sharedBytes = Buffer.from(await evaluate(`(async () => { const bytes = new Uint8Array(await window.__shared[0].arrayBuffer()); let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); })()`), 'base64');
  const sharedDb = await K.openDatabase(sharedBytes.buffer.slice(sharedBytes.byteOffset, sharedBytes.byteOffset + sharedBytes.byteLength), PASSWORD, null);
  check('phone: the shared file has the edit', K.field([...sharedDb.getDefaultGroup().allEntries()].find((e) => K.field(e, 'Title') === 'Sample Entry #2'), 'UserName'), 'phone-user');

  // Locking from the ⋯ menu; the dots of the master password still cover its text at a phone's size.
  await tapNth('.entry', 'Sample Entry #2');
  await tap('#more');
  await tapNth('.context-item', 'Lock');
  check('phone: locked, every layer closed', [await until(`!document.querySelector('#unlock').hidden`), await layers()], [true, [false, false, 0]]);
  await type(PASSWORD);
  check('phone: dots as wide as the text', await evaluate(`(() => {
    const input = document.querySelector('#password');
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;white-space:pre;font:' + getComputedStyle(input).font;
    probe.textContent = input.value;
    document.body.append(probe);
    const diff = Math.abs(probe.getBoundingClientRect().width - document.querySelector('.unlock-field .secret-dots').getBoundingClientRect().width);
    probe.remove();
    return diff < 1;
  })()`), true);
  await tap('#unlock-button');
  check('phone: unlocked', await until(`!document.querySelector('#app').hidden`), true);
  await tapNth('.entry', 'Sample Entry #2');

  // A computer's window again: three panes, and nothing of the phone left over.
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await send('Emulation.clearDeviceMetricsOverride');
  await sleep(200);
  check('phone → computer: three panes', [await shown('.sidebar'), await shown('.list-pane'), await shown('.details-pane')], [1, 1, 1]);
  check('phone → computer: no phone classes, no steps left', await until(`document.body.className === '' && history.state === null`), true);
  check('phone → computer: the toolbar', await Promise.all(['#toggle-sidebar', '#generator', '#settings', '#lock', '#more', '#back', '.tree-more'].map(shown)), [1, 1, 1, 1, 0, 0, 0]);

  /* -------------------------------------------------------------- *
   * Writing in place. The native pickers cannot be driven headless, so
   * they hand out real FileSystemFileHandles from the origin-private file
   * system instead — the page's own write path runs unchanged.
   * -------------------------------------------------------------- */
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: readOnlyScript });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      localStorage.setItem('html-password-manager', JSON.stringify({ language: 'en', theme: 'light', autosave: true }));
      const opfs = () => navigator.storage.getDirectory();
      window.showOpenFilePicker = async () => [await (await opfs()).getFileHandle('Database.kdbx')];
      window.showSaveFilePicker = async ({ suggestedName }) => (await opfs()).getFileHandle(suggestedName, { create: true });
      window.__opfsRead = async (name) => {
        const bytes = new Uint8Array(await (await (await (await opfs()).getFileHandle(name)).getFile()).arrayBuffer());
        let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s);
      };
    `,
  });
  const dbBase64 = (await readFile(DB)).toString('base64');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  await until(`document.readyState === 'complete'`);
  await evaluate(`(async () => {
    const handle = await (await navigator.storage.getDirectory()).getFileHandle('Database.kdbx', { create: true });
    const stream = await handle.createWritable();
    await stream.write(Uint8Array.from(atob(${JSON.stringify(dbBase64)}), (c) => c.charCodeAt(0)));
    await stream.close();
  })()`);
  check('fsa: no read-only note', await visible('#browser-note'), false);
  await click('#open-file');
  check('fsa: unlock form', await until(`!document.querySelector('#unlock').hidden`), true);
  await type(PASSWORD);
  await press('Enter');
  check('fsa: unlocked', await until(`!document.querySelector('#app').hidden`), true);
  check('fsa: writable', await text('#status-file'), 'Database.kdbx');

  await clickNth('.entry', 'Sample Entry #2');
  await press('e', MOD);
  await evaluate(`(() => { const i = document.querySelector('[data-field="url"]'); i.focus(); i.select(); })()`);
  await type('https://example.org/written-in-place');
  await click('.details .button--primary[type=submit]');
  check('fsa: dirty at first', await text('#status-state'), 'Unsaved changes');
  check('fsa: autosaved', await until(`document.querySelector('#status-state').textContent === 'Saved'`, 6000), true);
  const inPlace = Buffer.from(await evaluate(`window.__opfsRead('Database.kdbx')`), 'base64');
  const inPlaceDb = await K.openDatabase(inPlace.buffer.slice(inPlace.byteOffset, inPlace.byteOffset + inPlace.byteLength), PASSWORD, null);
  const written = [...inPlaceDb.getDefaultGroup().allEntries()].find((e) => K.field(e, 'Title') === 'Sample Entry #2');
  check('fsa: written into the file', K.field(written, 'URL'), 'https://example.org/written-in-place');

  // After a reload the file is offered again, and the change is there
  await send('Page.reload');
  await until(`document.readyState === 'complete' && !document.querySelector('#recent').hidden`);
  check('fsa: recent file listed', await texts('.recent-name'), ['Database.kdbx']);
  await click('.recent-open');
  await type(PASSWORD);
  await press('Enter');
  check('fsa: reopened', await until(`!document.querySelector('#app').hidden`), true);
  await clickNth('.entry', 'Sample Entry #2');
  check('fsa: change survived', await text('.field-link'), 'https://example.org/written-in-place');

  // A brand-new database, saved through the save picker
  await clickNth('#db-name', 'Database');
  await clickNth('.context-item', 'Close database');
  check('fsa: back to the file choice', await visible('#gate-pick'), true);
  await click('#new-db');
  await evaluate(`(() => { const i = document.querySelector('.dialog input[name=name]'); i.focus(); i.select(); })()`);
  await type('Personal');
  check('dialog password masked', await evaluate(`(() => { const i = document.querySelector('.dialog input[name=password]'); const cs = getComputedStyle(i); return [i.type, cs.webkitTextSecurity, cs.color]; })()`), ['text', 'none', 'rgba(0, 0, 0, 0)']);
  await evaluate(`document.querySelector('.dialog input[name=password]').focus()`);
  await type(' новый пароль ');
  check('dialog layout badge', await text('.dialog .layout-badge'), 'РУС');
  await evaluate(`document.querySelector('.dialog input[name=repeat]').focus()`);
  await type(' новый пароль ');
  await press('Enter');
  check('new db: open', await until(`!document.querySelector('#app').hidden`), true);
  check('new db: groups', await texts('.tree-item--group .tree-label'), ['Personal', 'General', 'Email', 'Internet', 'Banking']);
  check('new db: not saved yet', (await text('#status-file')).includes('not saved yet'), true);
  const t0 = Date.now();
  await press('s', MOD);
  check('new db: saved', await until(`document.querySelector('#status-state').textContent === 'Saved'`, 15000), true);
  const argonMs = Date.now() - t0;
  check('new db: file name', await text('#status-file'), 'Personal.kdbx');
  const fresh = Buffer.from(await evaluate(`window.__opfsRead('Personal.kdbx')`), 'base64');
  const freshDb = await K.openDatabase(fresh.buffer.slice(fresh.byteOffset, fresh.byteOffset + fresh.byteLength), ' новый пароль ', null);
  check('new db: spaces kept, decrypts with Argon2id', K.describeFormat(freshDb), 'KDBX 4.0 · AES-256 · Argon2id');
  console.log(`  Argon2id save in the browser: ${argonMs} ms`);

  // The PWA: its CSP lets in the manifest and the service worker, which keeps it offline
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/pages/` });
  check('pwa: service worker in control', await until(`navigator.serviceWorker.controller !== null`), true);
  check('pwa: gate shown', await visible('#gate-pick'), true);
  check('pwa: manifest parsed', (await send('Page.getAppManifest')).errors, []);
  check('pwa: installable', (await send('Page.getInstallabilityErrors')).installabilityErrors, []);
  pagesDown = true;
  await send('Page.reload');
  check('pwa: offline', await until(`document.readyState === 'complete' && !!document.querySelector('#gate-pick')?.getClientRects().length`), true);
  await click('#open-file');
  await type(PASSWORD);
  await press('Enter');
  check('pwa: offline unlock', await until(`!document.querySelector('#app').hidden`), true);
  pagesDown = false;

  check('no page errors', errors, []);
} finally {
  ws.close();
  chrome.kill();
  server.close();
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
}

done('browser');
