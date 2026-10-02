/**
 * Drives the Chrome extension of build/extension/ in headless Chrome: the
 * side panel unlocks a database and hands it to the offscreen document,
 * which fills forms from the context menu with the panel closed; the panel
 * opened again takes the database up without the password; then the forms —
 * a plain one, one on a React-like page, a sign-in in three steps with a
 * one-time code, frames of the site's own and of another, fields hidden as
 * traps, an http page for an https entry, a registration filled with a
 * derived v3 password — the toolbar's popup, which unlocks through the
 * offscreen document and fills with a click — and the lock, which closes
 * the offscreen document.
 *
 * Chrome loads the extension through the DevTools protocol over a pipe
 * (Extensions.loadUnpacked, with --enable-unsafe-extension-debugging): the
 * --load-extension flag is gone from Chrome since version 137. A context
 * menu cannot be clicked from DevTools, so the test fires the worker's
 * onClicked itself — with no click, Chrome grants no activeTab, so the copy
 * of the extension under test may reach the test's own sites, *.test, as
 * host permissions; and opening the side panel without a click fails, so the
 * worker's call is recorded instead.
 *
 * Needs `npm run build` first and a local Chrome (or `CHROME=/path/to/chrome`).
 * `--shots DIR` also saves screenshots of the side panel into DIR.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checker, load, root } from '../tools/load.mjs';

const BUILT = join(root, 'build', 'extension');
const PASSWORD = 'Тестовый пароль';
const OTP_SECRET = 'JBSWY3DPEHPK3PXP';
const shotsAt = process.argv.indexOf('--shots');
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
const CHROME =
  process.env.CHROME ??
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((path) => existsSync(path));

if (!CHROME) {
  console.log('No Chrome found — set CHROME=/path/to/chrome. Skipping the extension tests.');
  process.exit(0);
}
if (!existsSync(join(BUILT, 'manifest.json'))) {
  console.error('No build/extension/ — run `npm run build` first.');
  process.exit(1);
}

const K = await load('core/kdbx', 'core/derived', 'core/otp');
const { check, done } = checker();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ *
 * The database: an entry per test site, two for the sign-in in steps
 * ------------------------------------------------------------------ */

async function testDatabase() {
  const db = await K.createDatabase('Extension', PASSWORD, null);
  // A light key derivation: the panel, the offscreen document and a panel opened again each run it.
  const params = db.header.kdfParameters;
  params.set('M', K.kdbxweb.VarDictionary.ValueType.UInt64, K.kdbxweb.Int64.from(8 * 1024 * 1024));
  params.set('I', K.kdbxweb.VarDictionary.ValueType.UInt64, K.kdbxweb.Int64.from(2));
  params.set('P', K.kdbxweb.VarDictionary.ValueType.UInt32, 1);
  const add = (title, user, password, url, extra = {}) => {
    const entry = K.createEntry(db, db.getDefaultGroup());
    entry.fields.set('Title', title);
    entry.fields.set('UserName', user);
    entry.fields.set('Password', K.kdbxweb.ProtectedValue.fromString(password));
    entry.fields.set('URL', url);
    for (const [name, value] of Object.entries(extra)) entry.fields.set(name, K.kdbxweb.ProtectedValue.fromString(value));
    return entry;
  };
  add('Login', 'alice', 'alice-pass', 'http://login.test/signin');
  add('React', 'bob', 'bob-pass', 'http://react.test');
  add('Carol', 'carol@example.com', 'carol-pass', 'http://steps.test', { otp: `otpauth://totp/Steps:carol?secret=${OTP_SECRET}&period=30&digits=6` });
  add('Dave', 'dave@example.com', 'dave-pass', 'http://steps.test');
  add('Frames', 'frank', 'frank-pass', 'http://frames.test');
  add('Trap', 'trudy', 'trudy-pass', 'http://trap.test');
  add('Shadow', '12345678', 'shadow-pass', 'http://shadow.test');
  add('Secure', 'erin', 'erin-pass', 'https://secure.test');
  // In the recycle bin: never offered, so login.test still has one entry.
  K.remove(db, add('Old login', 'mallory', 'old-pass', 'http://login.test'));
  return Buffer.from(await K.saveDatabase(db));
}

/* ------------------------------------------------------------------ *
 * The sites, all on one local server: *.test resolves to it
 * ------------------------------------------------------------------ */

const page = (body, script = '') => `<!doctype html><meta charset="utf-8"><title>test</title><style>input{display:block;margin:6px;width:220px;height:24px}</style>${body}<script>${script}</script>`;
const loginForm = (id = '') => `<form onsubmit="return false"><input id="username${id}" name="username" autocomplete="username"><input id="password${id}" name="password" type="password" autocomplete="current-password"><button>Sign in</button></form>`;
// A stand-in for React's value tracking: a change is heard only when the value differs from the one last set through the input's own setter.
const reactLike = `
  window.state = {};
  for (const input of document.querySelectorAll('input')) {
    const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    let tracked = input.value;
    Object.defineProperty(input, 'value', { configurable: true, get() { return native.get.call(this); }, set(v) { tracked = String(v); native.set.call(this, v); } });
    input.addEventListener('input', () => { const now = native.get.call(input); if (now !== tracked) { tracked = now; state[input.name] = now; } });
  }`;
const SITES = {
  'login.test': { '/': page(loginForm()) },
  'react.test': { '/': page(loginForm(), reactLike) },
  'steps.test': {
    '/': page(`<form onsubmit="return false"><input id="identifier" type="email" name="identifier" autocomplete="username"><input type="password" name="hidden" tabindex="-1" aria-hidden="true" style="position:absolute;left:-10000px"><button>Next</button></form>`),
    '/password': page(`<form onsubmit="return false"><input type="email" name="identifier" style="display:none"><input id="password" type="password" name="password" autocomplete="current-password"><button>Next</button></form>`),
    '/code': page(`<form onsubmit="return false"><input id="code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><button>Verify</button></form>`),
  },
  'frames.test': {
    '/': (port) => page(`${loginForm()}<iframe id="own" src="http://frames.test:${port}/inner"></iframe><iframe id="foreign" src="http://evil.test:${port}/inner"></iframe>`),
    '/inner': page(loginForm()),
  },
  'evil.test': { '/inner': page(loginForm()) },
  'trap.test': {
    '/': page(`<form onsubmit="return false">
      <input id="username" name="login">
      <input id="trap-text" name="email" style="position:absolute;left:-5000px">
      <input id="password" type="password" name="password">
      <input id="trap-far" type="password" style="position:absolute;left:-9999px">
      <input id="trap-clear" type="password" style="opacity:0">
      <div style="display:none"><input id="trap-none" type="password"></div>
      <input id="trap-hidden" type="password" style="visibility:hidden">
      <input id="trap-tiny" type="password" style="width:1px;height:1px;border:0;padding:0">
    </form>`),
  },
  'secure.test': { '/': page(loginForm()) },
  // A web component's open shadow root; its user name is a customer number, digits as a one-time code's are.
  'shadow.test': {
    '/': page(
      `<login-box></login-box>`,
      `customElements.define('login-box', class extends HTMLElement {
        connectedCallback() {
          this.attachShadow({ mode: 'open' }).innerHTML = '<style>input{display:block;margin:6px;width:220px;height:24px}</style><form onsubmit="return false"><input id="username" inputmode="numeric" maxlength="8" autocomplete="username"><input id="password" type="password" autocomplete="current-password"></form>';
        }
      });`,
    ),
  },
  'new.test': {
    '/': page(`<form onsubmit="return false"><input id="email" type="email" name="email" autocomplete="username" value="newbie@example.com"><input id="new" type="password" name="new" autocomplete="new-password"><input id="repeat" type="password" name="repeat" autocomplete="new-password"><button>Sign up</button></form>`),
  },
};

const server = createServer((req, res) => {
  const host = (req.headers.host ?? '').replace(/:\d+$/, '');
  const path = new URL(req.url, 'http://x').pathname;
  const body = SITES[host]?.[path];
  if (!body) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(typeof body === 'function' ? body(port) : body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const site = (host, path = '/') => `http://${host}:${port}${path}`;

/* ------------------------------------------------------------------ *
 * The extension under test: the build, allowed onto *.test, with a
 * page of its own for what only an extension page can do
 * ------------------------------------------------------------------ */

const work = await mkdtemp(join(tmpdir(), 'hpm-extension-'));
const extensionDir = join(work, 'extension');
await cp(BUILT, extensionDir, { recursive: true });
const manifest = JSON.parse(await readFile(join(extensionDir, 'manifest.json'), 'utf8'));
check('manifest: the version of package.json', manifest.version, JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version);
manifest.host_permissions = ['http://*.test/*'];
await writeFile(join(extensionDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
await writeFile(join(extensionDir, 'test.html'), '<!doctype html><meta charset="utf-8"><title>test</title>');

/* ------------------------------------------------------------------ *
 * Chrome, spoken to over a pipe
 * ------------------------------------------------------------------ */

const flags = [
  '--headless=new',
  '--remote-debugging-pipe',
  '--enable-unsafe-extension-debugging',
  `--user-data-dir=${join(work, 'profile')}`,
  '--no-first-run',
  '--window-size=1280,860',
  `--host-resolver-rules=MAP *.test 127.0.0.1`,
  '--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable',
];
if (process.platform === 'linux') flags.push('--no-sandbox');
const chrome = spawn(CHROME, [...flags, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
chrome.stderr.on('data', () => undefined);
const [, , , toChrome, fromChrome] = chrome.stdio;
let lastId = 0;
const waiting = new Map();
const errors = [];
const listeners = [];
let buffer = '';
fromChrome.on('data', (chunk) => {
  buffer += chunk;
  for (let end = buffer.indexOf('\0'); end >= 0; end = buffer.indexOf('\0')) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id && waiting.has(message.id)) {
      waiting.get(message.id)(message);
      waiting.delete(message.id);
      continue;
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(`${sessionNames.get(message.sessionId) ?? '?'}: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(`${sessionNames.get(message.sessionId) ?? '?'}: ${message.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    for (const listener of listeners) listener(message);
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++lastId;
    waiting.set(id, (message) => (message.error ? reject(new Error(`${method}: ${JSON.stringify(message.error)}`)) : resolve(message.result)));
    toChrome.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
  });
const sessionNames = new Map();
async function attach(targetId, name) {
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  sessionNames.set(sessionId, name);
  await send('Runtime.enable', {}, sessionId);
  return sessionId;
}
/** Runs `expression` in the session; `gesture` makes it count as the user's doing, as a click would. */
async function evaluate(sessionId, expression, gesture = false) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: gesture }, sessionId);
  if (result.exceptionDetails) throw new Error(`${expression}\n${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
  return result.result.value;
}
async function until(sessionId, expression, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await evaluate(sessionId, expression)) return true;
    } catch {
      /* the page is still loading */
    }
    await sleep(60);
  }
  return false;
}
const targets = async () => (await send('Target.getTargets')).targetInfos;
async function waitForTarget(match, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const found = (await targets()).find(match);
    if (found) return found;
    await sleep(100);
  }
  return null;
}

/**
 * The toolbar icon, clicked through Extensions.triggerAction, in a Chrome of its own with the
 * extension as built — no host permissions: the click must give the popup the tab. Headless
 * Chrome 153 crashes on triggerAction whatever the extension, so a crash skips this part.
 */
async function iconGivesTheTab() {
  const own = spawn(CHROME, [...flags.filter((flag) => !flag.startsWith('--user-data-dir')), `--user-data-dir=${join(work, 'icon-profile')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  own.stderr.on('data', () => undefined);
  const [, , , input, output] = own.stdio;
  const pending = new Map();
  let next = 0;
  let rest = '';
  let crashed = false;
  own.on('exit', (code, signal) => {
    crashed = signal !== null && signal !== 'SIGTERM';
    for (const done of pending.values()) done({ error: { message: `Chrome exited (${signal ?? code})` } });
  });
  output.on('data', (chunk) => {
    rest += chunk;
    for (let end = rest.indexOf('\0'); end >= 0; end = rest.indexOf('\0')) {
      const message = JSON.parse(rest.slice(0, end));
      rest = rest.slice(end + 1);
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  const call = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      pending.set(id, (message) => (message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result)));
      input.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
    });
  const run = async (sessionId, expression) => (await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
  try {
    const { id } = await call('Extensions.loadUnpacked', { path: BUILT });
    // The click goes to the worker's onClicked: it has to be listening first.
    for (let i = 0; i < 100 && !(await call('Target.getTargets')).targetInfos.some((t) => t.type === 'service_worker' && t.url === `chrome-extension://${id}/background.js`); i += 1) await sleep(50);
    await sleep(300);
    const pageTarget = (await call('Target.getTargets')).targetInfos.find((t) => t.type === 'page');
    const page = (await call('Target.attachToTarget', { targetId: pageTarget.targetId, flatten: true })).sessionId;
    await call('Page.navigate', { url: site('login.test') }, page);
    for (let i = 0; i < 100 && (await run(page, 'document.readyState')) !== 'complete'; i += 1) await sleep(50);
    const tabTarget = (await call('Target.getTargets', { filter: [{ type: 'tab' }] })).targetInfos.find((t) => t.type === 'tab');
    await call('Extensions.triggerAction', { id, targetId: tabTarget.targetId });
    let popupTarget = null;
    for (let i = 0; i < 80 && !popupTarget; i += 1) {
      await sleep(100);
      popupTarget = (await call('Target.getTargets')).targetInfos.find((t) => t.url === `chrome-extension://${id}/popup.html`);
    }
    if (!popupTarget) return { opened: false };
    const popupSession = (await call('Target.attachToTarget', { targetId: popupTarget.targetId, flatten: true })).sessionId;
    await sleep(300);
    return {
      opened: true,
      sees: await run(popupSession, `chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab?.url ?? null)`),
      reaches: await run(popupSession, `chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => location.hostname })).then((r) => r[0].result, (e) => e.message)`),
    };
  } catch (error) {
    if (crashed) return null;
    throw error;
  } finally {
    own.kill();
  }
}

let extensionId;
try {
  ({ id: extensionId } = await send('Extensions.loadUnpacked', { path: extensionDir }).catch((error) => {
    if (!/-32601|not found/i.test(error.message)) throw error;
    console.log(`This Chrome cannot load an extension from DevTools (${error.message}). Skipping the extension tests.`);
    return { id: null };
  }));
  if (!extensionId) {
    chrome.kill();
    server.close();
    await rm(work, { recursive: true, force: true });
    process.exit(0);
  }
  const origin = `chrome-extension://${extensionId}`;
  const workerTarget = await waitForTarget((t) => t.type === 'service_worker' && t.url === `${origin}/background.js`);
  let worker = await attach(workerTarget.targetId, 'worker');
  // The manifest's texts come from _locales/; this Chrome speaks English.
  check('manifest: name from _locales', await evaluate(worker, `chrome.i18n.getMessage('appName')`), 'Deterministic Password');
  check('manifest: toolbar title from _locales', await evaluate(worker, `chrome.action.getTitle({})`), 'Deterministic Password');

  // Window A holds the sites and, later, the side panel; window B the extension's own test page.
  const firstTab = (await targets()).find((t) => t.type === 'page');
  const { targetId: helperTarget } = await send('Target.createTarget', { url: `${origin}/test.html`, newWindow: true });
  const helper = await attach(helperTarget, 'helper');
  await until(helper, `document.readyState === 'complete'`);
  const dbBase64 = (await testDatabase()).toString('base64');
  // The panel's settings, and the database in the extension's origin-private file system, where a picker would have found it.
  await evaluate(helper, `(async () => {
    localStorage.setItem('html-password-manager', JSON.stringify({ language: 'en', theme: 'light', autosave: true, clipboardSeconds: 10 }));
    const handle = await (await navigator.storage.getDirectory()).getFileHandle('Extension.kdbx', { create: true });
    const stream = await handle.createWritable();
    await stream.write(Uint8Array.from(atob(${JSON.stringify(dbBase64)}), (c) => c.charCodeAt(0)));
    await stream.close();
  })()`);

  /** A site in window A's one tab, made the active one. */
  const siteTab = await attach(firstTab.targetId, 'site');
  await send('Page.enable', {}, siteTab);
  await send('Page.navigate', { url: site('login.test') }, siteTab);
  await until(siteTab, `document.readyState === 'complete' && location.host.startsWith('login.test')`);
  const tabId = await evaluate(worker, `chrome.tabs.query({}).then((tabs) => tabs.find((t) => t.url?.includes('login.test')).id)`);
  const windowA = await evaluate(worker, `chrome.tabs.get(${tabId}).then((t) => t.windowId)`);
  async function visit(url) {
    await send('Page.navigate', { url }, siteTab);
    await until(siteTab, `document.readyState === 'complete' && location.href === ${JSON.stringify(url)}`);
    await evaluate(worker, `chrome.tabs.update(${tabId}, { active: true }).then(() => true)`);
    await sleep(150);
  }
  const value = (selector, frame = '') => evaluate(siteTab, `(${frame ? `document.querySelector(${JSON.stringify(frame)}).contentDocument` : 'document'}).querySelector(${JSON.stringify(selector)}).value`);

  // The worker's calls to open the panel, which with no click behind them Chrome refuses.
  const recordPanel = () => evaluate(worker, `(() => { self.__panelOpened = []; chrome.sidePanel.open = (options) => { self.__panelOpened.push(options); return Promise.resolve(); }; return true; })()`);
  await recordPanel();
  let openedBefore = 0;
  const panelOpened = async () => openedBefore + (await evaluate(worker, `self.__panelOpened.length`));
  /** "Fill" in the page's context menu, as Chrome would report the click. */
  const menuFill = () => evaluate(worker, `chrome.tabs.get(${tabId}).then((tab) => { chrome.contextMenus.onClicked.dispatch({ menuItemId: 'fill', pageUrl: tab.url, editable: true }, tab); return true; })`);
  const offscreenOpen = () => evaluate(worker, `chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).then((c) => c.length === 1)`);

  /* The side panel: opened by a "click" in the extension's own page */
  let panel = null;
  let panelTarget = null;
  async function openPanel() {
    await evaluate(helper, `chrome.sidePanel.open({ windowId: ${windowA} }).then(() => true)`, true);
    panelTarget = await waitForTarget((t) => t.type === 'page' && t.url === `${origin}/panel.html`);
    panel = await attach(panelTarget.targetId, 'panel');
    await until(panel, `document.readyState === 'complete'`);
    await send('Page.enable', {}, panel);
    await send('DOM.enable', {}, panel);
    await send('Emulation.setFocusEmulationEnabled', { enabled: true }, panel);
    // The picker hands out the file from the origin-private file system.
    await evaluate(panel, `window.showOpenFilePicker = async () => [await (await navigator.storage.getDirectory()).getFileHandle('Extension.kdbx')]; true`);
  }
  async function closePanel() {
    await send('Target.closeTarget', { targetId: panelTarget.targetId });
    await sleep(300);
    panel = null;
  }
  const inPanel = (expression) => evaluate(panel, expression);
  const text = (selector) => inPanel(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
  const texts = (selector) => inPanel(`[...document.querySelectorAll(${JSON.stringify(selector)})].map((n) => n.textContent)`);
  const click = async (selector) => {
    const box = await inPanel(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n) return null; n.scrollIntoView({ block: 'nearest' }); const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    if (!box) throw new Error(`Nothing to click in the panel: ${selector}`);
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: box[0], y: box[1], button: 'left', clickCount: 1 }, panel);
    await sleep(80);
  };
  const clickText = async (selector, label) => {
    const found = await inPanel(`(() => {
      document.querySelectorAll('[data-pick]').forEach((n) => n.removeAttribute('data-pick'));
      const hit = [...document.querySelectorAll(${JSON.stringify(selector)})].find((n) => n.textContent.includes(${JSON.stringify(label)}));
      if (hit) hit.setAttribute('data-pick', '');
      return !!hit;
    })()`);
    if (!found) throw new Error(`No ${selector} with "${label}" in the panel`);
    await click('[data-pick]');
  };
  const type = async (value) => {
    await send('Input.insertText', { text: value }, panel);
    await sleep(40);
  };
  const press = async (key, code, keyCode) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, text: key === 'Enter' ? '\r' : undefined }, panel);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode }, panel);
    await sleep(40);
  };
  const toastText = () => inPanel(`document.querySelector('.toast.toast--shown')?.textContent ?? null`);
  const shot = async (name) => {
    if (!SHOTS) return;
    const { data } = await send('Page.captureScreenshot', { format: 'png' }, panel);
    await writeFile(join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
  };

  /* -------------------------------------------------------------- *
   * Unlocking in the panel hands the database to the offscreen document
   * -------------------------------------------------------------- */
  await visit(site('login.test'));
  check('menu: fill offered on web pages only', await evaluate(worker, `new Promise((resolve) => chrome.contextMenus.update('fill', {}, () => resolve(!chrome.runtime.lastError)))`), true);
  await menuFill();
  check('locked: the menu opens the panel', await panelOpened(), 1);
  check('locked: no offscreen document', await offscreenOpen(), false);

  await openPanel();
  check('panel: the gate', await until(panel, `!!document.querySelector('#gate-pick')?.getClientRects().length`), true);
  await shot('x1-gate');
  check('panel: its script runs under the extension\'s policy', await inPanel(`typeof chrome.runtime.id`), 'string');
  await click('#open-file');
  check('panel: the file picked', await until(panel, `!document.querySelector('#unlock').hidden`), true);
  await type(PASSWORD);
  await press('Enter', 'Enter', 13);
  check('panel: unlocked (Argon2 under the extension\'s policy)', await until(panel, `!document.querySelector('#app').hidden`), true);
  check('panel: writable in place', await text('#status-file'), 'Extension.kdbx');
  check('panel: the offscreen document holds the database', await until(worker, `chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).then((c) => c.length === 1)`), true);
  // The menu clicked while locked: once unlocked, the one entry of login.test is filled at once.
  check('after unlocking: the fill asked for goes on', [await until(siteTab, `document.querySelector('#password').value === 'alice-pass'`), await value('#username')], [true, 'alice']);
  check('panel: for this site', [await text('.tree-item--site .tree-label'), await text('.tree-item--site .tree-count'), await text('#list-title'), await texts('.entry-title')], ['For this site', '1', 'login.test', ['Login']]);
  await shot('x2-site');
  // A database can be remembered in the panel: its origin is the extension's, not file:.
  // The panel is narrow: the phone's layout, where the settings are in the ⋯ menu.
  await click('#more');
  await clickText('.context-item', 'Settings');
  check('panel: remembering offered in the settings', await inPanel(`[...document.querySelectorAll('[data-setting="remember"] option')].map((o) => o.value).includes('device')`), true);
  await inPanel(`document.querySelector('.popover')?.dispatchEvent(new Event('dismiss'))`);
  const offscreenTarget = await waitForTarget((t) => t.url === `${origin}/offscreen.html`);
  await attach(offscreenTarget.targetId, 'offscreen');

  /* The Fill button in the entry */
  await evaluate(siteTab, `document.querySelectorAll('input').forEach((i) => (i.value = '')); true`);
  await clickText('.entry', 'Login');
  await clickText('.details-actions .button', 'Fill');
  check('panel: Fill fills the tab', [await until(siteTab, `document.querySelector('#password').value !== ''`), await value('#username'), await value('#password')], [true, 'alice', 'alice-pass']);
  check('panel: Fill says where', await toastText(), 'Filled into login.test');
  await shot('x3-filled');

  /* The list follows the tab */
  await visit(site('react.test'));
  check('panel: the list follows the tab', await until(panel, `document.querySelector('#list-title').textContent === 'react.test'`), true);
  await visit(site('example.test'));
  check('panel: a site with no entries', [await until(panel, `document.querySelector('#list-title').textContent === 'example.test'`), await text('#entries-empty .entries-empty-action')], [true, 'New password for example.test']);
  await shot('x4-no-entries');

  /* -------------------------------------------------------------- *
   * The panel closed: the menu still fills, from the offscreen document
   * -------------------------------------------------------------- */
  await closePanel();
  check('panel closed: the offscreen document stays', await offscreenOpen(), true);
  await visit(site('react.test'));
  const opened = await panelOpened();
  await menuFill();
  check('menu: fills a React form', await until(siteTab, `state.password === 'bob-pass'`), true);
  check('menu: the framework heard both', await evaluate(siteTab, `JSON.stringify(state)`), JSON.stringify({ username: 'bob', password: 'bob-pass' }));
  check('menu: one entry, no panel', await panelOpened(), opened);

  /* Frames: the site's own frame is filled, another site's is not */
  await visit(site('frames.test'));
  await until(siteTab, `[...document.querySelectorAll('iframe')].every((f) => { try { return f.contentDocument?.readyState === 'complete'; } catch { return true; } })`);
  await sleep(300);
  await menuFill();
  check('frames: the page filled', await until(siteTab, `document.querySelector('#password').value === 'frank-pass'`), true);
  check('frames: its own frame filled', [await value('#username', '#own'), await value('#password', '#own')], ['frank', 'frank-pass']);
  // The other site's frame cannot be read from the page; the extension's worker asks it.
  const foreign = await evaluate(worker, `chrome.scripting.executeScript({ target: { tabId: ${tabId}, allFrames: true }, func: () => location.host.startsWith('evil.test') ? [document.querySelector('#username').value, document.querySelector('#password').value] : null }).then((r) => r.map((x) => x.result).find(Boolean))`);
  check('frames: another site\'s frame left empty', foreign, ['', '']);

  /* Traps: only what shows is filled */
  await visit(site('trap.test'));
  await menuFill();
  check('traps: the visible fields filled', [await until(siteTab, `document.querySelector('#password').value === 'trudy-pass'`), await value('#username')], [true, 'trudy']);
  check('traps: the hidden ones empty', await evaluate(siteTab, `['trap-text', 'trap-far', 'trap-clear', 'trap-none', 'trap-hidden', 'trap-tiny'].map((id) => document.getElementById(id).value)`), ['', '', '', '', '', '']);

  /* The worker stopped by Chrome while the database is open: started again, it takes the index back */
  const openedSoFar = await panelOpened();
  await send('Target.closeTarget', { targetId: workerTarget.targetId });
  await sleep(300);
  await evaluate(helper, `chrome.runtime.sendMessage({ to: 'background', type: 'hello', windowId: -1 }).then(() => true)`);
  const restarted = await waitForTarget((t) => t.type === 'service_worker' && t.url === `${origin}/background.js`);
  worker = await attach(restarted.targetId, 'worker');
  check('worker restarted: a fresh one', await evaluate(worker, `typeof self.__panelOpened`), 'undefined');
  openedBefore = openedSoFar;
  await recordPanel();
  await sleep(300);
  await visit(site('login.test'));
  await evaluate(siteTab, `document.querySelectorAll('input').forEach((i) => (i.value = '')); true`);
  await menuFill();
  check('worker restarted: the index is back, the menu fills', [await until(siteTab, `document.querySelector('#password').value === 'alice-pass'`), await panelOpened()], [true, openedSoFar]);

  /* A form in a shadow root */
  await visit(site('shadow.test'));
  await menuFill();
  const shadowValue = (id) => evaluate(siteTab, `document.querySelector('login-box').shadowRoot.getElementById(${JSON.stringify(id)}).value`);
  check('shadow DOM: filled', [await until(siteTab, `document.querySelector('login-box').shadowRoot.getElementById('password').value !== ''`), await shadowValue('username'), await shadowValue('password')], [true, '12345678', 'shadow-pass']);

  /* An https entry on an http page */
  await visit(site('secure.test'));
  const before = await panelOpened();
  await menuFill();
  await sleep(400);
  check('http: an https entry is not filled', [await value('#username'), await value('#password')], ['', '']);
  check('http: nothing fits, so the panel', await panelOpened(), before + 1);

  /* An entry picked in the panel for another site, or for https */
  await openPanel();
  await until(panel, `!document.querySelector('#app').hidden`);
  // The menu clicked on this page a moment ago found nothing that fits: the panel offers a new password for it.
  check('http: the panel then offers a password for the page', await until(panel, `document.querySelector('[data-field="gen-v3-site"]')?.value === 'secure.test'`), true);
  await press('Escape', 'Escape', 27);
  const search = async (query) => {
    // The panel is as narrow as a phone: an entry takes the screen, and back is the way to the list.
    if (await inPanel(`document.body.classList.contains('show-details')`)) {
      await click('#back');
      await until(panel, `!document.body.classList.contains('show-details')`);
    }
    await inPanel(`(() => { const i = document.querySelector('#search'); i.value = ${JSON.stringify(query)}; i.dispatchEvent(new Event('input')); })()`);
    await clickText('.entry', query);
  };
  await search('Secure');
  await clickText('.details-actions .button', 'Fill');
  check('panel: an https entry refused on an http page', [await toastText(), await value('#password')], ['Not filled: the page is not secure (http), and the entry is for https', '']);
  await search('Login');
  await clickText('.details-actions .button', 'Fill');
  check('panel: another site asks first, with both', [await until(panel, `!!document.querySelector('.overlay:not([hidden]) .dialog')`), await text('.dialog h2'), await text('.dialog .dialog-text')], [true, 'Fill into another site?', '"Login" is for login.test, but the tab shows secure.test. Fill it in only if you trust secure.test.']);
  await click('.overlay [data-cancel]');
  check('panel: not filled when cancelled', await value('#password'), '');
  await clickText('.details-actions .button', 'Fill');
  await until(panel, `!!document.querySelector('.overlay:not([hidden]) .dialog')`);
  await click('.overlay .button--danger');
  check('panel: filled when confirmed', await until(siteTab, `document.querySelector('#password').value === 'alice-pass'`), true);
  await evaluate(siteTab, `document.querySelectorAll('input').forEach((i) => (i.value = '')); true`);
  await closePanel();

  /* -------------------------------------------------------------- *
   * A sign-in in three steps: the entry picked in the panel goes on
   * -------------------------------------------------------------- */
  await visit(site('steps.test'));
  const beforeSteps = await panelOpened();
  await menuFill();
  check('steps: two entries, the panel to pick', await panelOpened(), beforeSteps + 1);
  check('steps: nothing filled yet', await value('#identifier'), '');
  await openPanel();
  check('panel again: no password asked', await until(panel, `!document.querySelector('#app').hidden`), true);
  check('panel again: the entries of the site', await until(panel, `JSON.stringify([...document.querySelectorAll('.entry-title')].map((n) => n.textContent)) === '["Carol","Dave"]'`), true);
  check('panel again: still writable in place', await text('#status-file'), 'Extension.kdbx');
  await clickText('.entry', 'Carol');
  await clickText('.details-actions .button', 'Fill');
  check('steps 1: the user name alone', [await until(siteTab, `document.querySelector('#identifier').value !== ''`), await value('#identifier'), await evaluate(siteTab, `document.querySelector('[name=hidden]').value`)], [true, 'carol@example.com', '']);
  await closePanel();
  await visit(site('steps.test', '/password'));
  await menuFill();
  check('steps 2: the entry picked before, its password', [await until(siteTab, `document.querySelector('#password').value !== ''`), await value('#password')], [true, 'carol-pass']);
  await visit(site('steps.test', '/code'));
  await menuFill();
  await until(siteTab, `document.querySelector('#code').value !== ''`);
  const code = await value('#code');
  const params = K.parseOtpValue(OTP_SECRET);
  const expected = [await K.totp(params, Date.now() - 30000), await K.totp(params), await K.totp(params, Date.now() + 30000)];
  check('steps 3: the one-time code', expected.includes(code), true);

  /* -------------------------------------------------------------- *
   * No entry for the site: derived v3 for the page, kept as an entry
   * -------------------------------------------------------------- */
  await visit(site('new.test'));
  await menuFill();
  await openPanel();
  check('new: the generator opens on the page\'s site', await until(panel, `document.querySelector('[data-field="gen-v3-site"]')?.value === 'new.test'`), true);
  check('new: the user name typed on the page', await inPanel(`document.querySelector('[data-field="gen-v3-user"]').value`), 'newbie@example.com');
  const derived = await K.derivePassword(PASSWORD, { ...K.REQUIREMENT_DEFAULTS, site: 'new.test', version: 1 }, 'newbie@example.com');
  check('new: derived from the database\'s master password', await until(panel, `document.querySelector('.gen-preview').textContent === ${JSON.stringify(derived)}`, 15000), true);
  await shot('x5-derived');
  await clickText('.gen .button--primary', 'Fill');
  check('new: both password fields filled', [await until(siteTab, `document.querySelector('#new').value !== ''`), await value('#new'), await value('#repeat')], [true, derived, derived]);
  check('new: kept as an entry', [await until(panel, `document.querySelector('.details-title')?.textContent === 'new.test'`), await texts('.entry-title')], [true, ['new.test']]);
  check('new: saved', await until(panel, `document.querySelector('#status-state').textContent === 'Saved'`, 10000), true);
  const saved = Buffer.from(await inPanel(`(async () => { const bytes = new Uint8Array(await (await (await (await navigator.storage.getDirectory()).getFileHandle('Extension.kdbx')).getFile()).arrayBuffer()); let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); })()`), 'base64');
  const reopened = await K.openDatabase(saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength), PASSWORD, null);
  const made = [...reopened.getDefaultGroup().allEntries()].find((entry) => K.field(entry, 'Title') === 'new.test');
  check('new: the entry in the file', [K.field(made, 'UserName'), K.field(made, 'Password'), K.field(made, 'URL')], ['newbie@example.com', derived, `http://new.test:${port}`]);
  // Saved, so the offscreen document has it too: the menu fills it now.
  await evaluate(siteTab, `document.querySelectorAll('input').forEach((i) => (i.value = '')); true`);
  await closePanel();
  await menuFill();
  check('new: the menu fills the new entry', await until(siteTab, `document.querySelector('#new').value === ${JSON.stringify(derived)}`), true);

  /* -------------------------------------------------------------- *
   * The clipboard is wiped by the offscreen document, the panel gone
   * -------------------------------------------------------------- */
  await send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin }).catch(() => undefined);
  await openPanel();
  await until(panel, `!document.querySelector('#app').hidden`);
  await clickText('.entry', 'new.test');
  await click('.field-value--secret + .field-actions .icon-button:last-child');
  const clipboard = () => evaluate(helper, `navigator.clipboard.readText()`, true);
  check('clipboard: the password copied', await clipboard(), derived);
  await closePanel();
  await sleep(10500);
  check('clipboard: wiped with the panel closed', await clipboard(), '');

  /* -------------------------------------------------------------- *
   * Locking closes the offscreen document; the menu then opens the panel
   * -------------------------------------------------------------- */
  await openPanel();
  await until(panel, `!document.querySelector('#app').hidden`);
  await evaluate(worker, `chrome.contextMenus.onClicked.dispatch({ menuItemId: 'lock' }); true`);
  check('lock from the toolbar menu: the panel locks', await until(panel, `!document.querySelector('#unlock').hidden`), true);
  check('lock: the offscreen document closed', await until(worker, `chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).then((c) => c.length === 0)`), true);
  await visit(site('login.test'));
  const beforeLocked = await panelOpened();
  await menuFill();
  await sleep(300);
  check('locked: the menu opens the panel, fills nothing', [await panelOpened(), await value('#password')], [beforeLocked + 1, '']);

  /* The screen locking locks too */
  await type(PASSWORD);
  await press('Enter', 'Enter', 13);
  check('unlocked again', await until(panel, `!document.querySelector('#app').hidden`), true);
  check('unlocked again: the offscreen document', await until(worker, `chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).then((c) => c.length === 1)`), true);
  await evaluate(worker, `chrome.idle.onStateChanged.dispatch('locked'); true`);
  check('screen locked: the database locks', [await until(panel, `!document.querySelector('#unlock').hidden`), await until(worker, `chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).then((c) => c.length === 0)`)], [true, true]);

  /* -------------------------------------------------------------- *
   * The toolbar's popup: the site's entries, filled with a click
   * -------------------------------------------------------------- */
  // Opened as a page of its own, in a window of its own: it is told the site's tab is the one beside it.
  let popup = null;
  let popupTarget = null;
  async function openPopup() {
    ({ targetId: popupTarget } = await send('Target.createTarget', { url: 'about:blank', newWindow: true }));
    popup = await attach(popupTarget, 'popup');
    await send('Page.enable', {}, popup);
    await send('Emulation.setFocusEmulationEnabled', { enabled: true }, popup);
    await send(
      'Page.addScriptToEvaluateOnNewDocument',
      {
        source: `
          chrome.tabs.query = () => chrome.tabs.get(${tabId}).then((tab) => [tab]);
          chrome.windows.getCurrent = () => Promise.resolve({ id: ${windowA} });
          chrome.sidePanel.open = (options) => { (window.__panel ??= []).push(options); return Promise.resolve(); };
          window.close = () => { window.__closed = true; };`,
      },
      popup,
    );
    await send('Page.navigate', { url: `${origin}/popup.html` }, popup);
    await until(popup, `document.readyState === 'complete' && document.querySelector('.popup-body')?.children.length > 0`);
  }
  async function closePopup() {
    await send('Target.closeTarget', { targetId: popupTarget });
    await sleep(200);
  }
  const inPopup = (expression) => evaluate(popup, expression);
  const popupTexts = (selector) => inPopup(`[...document.querySelectorAll(${JSON.stringify(selector)})].map((n) => n.textContent)`);
  const clickPopup = async (selector) => {
    const box = await inPopup(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n) return null; const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    if (!box) throw new Error(`Nothing to click in the popup: ${selector}`);
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: box[0], y: box[1], button: 'left', clickCount: 1 }, popup);
    await sleep(80);
  };
  const searchPopup = (query) => inPopup(`(() => { const i = document.querySelector('.popup-search-input'); i.value = ${JSON.stringify(query)}; i.dispatchEvent(new Event('input')); return true; })()`);

  await evaluate(siteTab, `document.querySelectorAll('input').forEach((i) => (i.value = '')); true`);
  await openPopup();
  check('popup locked: the last file, to unlock with the password', [await inPopup(`document.querySelector('.popup-file')?.textContent`), await inPopup(`document.querySelector('.popup-search').hidden`)], ['Extension', true]);
  if (SHOTS) await writeFile(join(SHOTS, 'x6-popup-locked.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' }, popup)).data, 'base64'));
  await inPopup(`document.querySelector('.unlock-input').focus()`);
  await send('Input.insertText', { text: 'wrong' }, popup);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }, popup);
  check('popup: a wrong password said so', await until(popup, `document.querySelector('.gate-error')?.textContent === 'Wrong password or key file'`), true);
  await inPopup(`(() => { const i = document.querySelector('.unlock-input'); i.value = ''; i.focus(); return true; })()`);
  await send('Input.insertText', { text: PASSWORD }, popup);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }, popup);
  check('popup: unlocked, the entries of the site', await until(popup, `JSON.stringify([...document.querySelectorAll('.popup-entry-title')].map((n) => n.textContent)) === '["Login"]'`), true);
  check('popup: the site and the user name', [await inPopup(`document.querySelector('.popup-site').textContent`), await popupTexts('.popup-entry-sub')], ['login.test', ['alice']]);
  check('popup: the offscreen document decrypted it', await offscreenOpen(), true);
  check('popup: the panel at its gate takes the database up', await until(panel, `!document.querySelector('#app').hidden`), true);
  if (SHOTS) await writeFile(join(SHOTS, 'x7-popup.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' }, popup)).data, 'base64'));
  await clickPopup('.popup-entry-main');
  check('popup: a click fills the tab and closes it', [await until(siteTab, `document.querySelector('#password').value === 'alice-pass'`), await value('#username'), await inPopup(`window.__closed === true`)], [true, 'alice', true]);

  /* A search looks through all the entries; another site's says whose it is */
  await searchPopup('Carol');
  check('popup: search finds another site\'s entry', await until(popup, `JSON.stringify([...document.querySelectorAll('.popup-entry-title')].map((n) => n.textContent)) === '["Carol"]'`), true);
  check('popup: with its site, and a one-time code', [await popupTexts('.popup-entry-sub'), await inPopup(`document.querySelectorAll('.popup-entry .icon-button').length`)], [['carol@example.com · steps.test'], 3]);
  await clickPopup('.popup-entry [aria-label="Copy password"]');
  check('popup: the password copied', await evaluate(helper, `navigator.clipboard.readText()`, true), 'carol-pass');
  await clickPopup('.popup-entry-main');
  check('popup: another site asks first', await until(popup, `document.querySelector('.overlay:not([hidden]) .dialog h2')?.textContent === 'Fill into another site?'`), true);
  await clickPopup('.overlay [data-cancel]');
  check('popup: not filled when cancelled', await value('#username'), 'alice');
  await closePopup();

  /* No entry for the site: the panel makes a password for it */
  await visit(site('example.test'));
  await openPopup();
  check('popup: no entries for the site', [await until(popup, `!!document.querySelector('.popup-empty .button')`), await popupTexts('.popup-empty p'), await popupTexts('.popup-empty .button')], [true, ['No entries for example.test'], ['New password for example.test']]);
  await clickPopup('.popup-empty .button');
  check('popup: it opens the panel', await until(popup, `window.__closed === true`), true);
  check('popup: in its own window', await inPopup(`JSON.stringify(window.__panel)`), JSON.stringify([{ windowId: windowA }]));
  check('popup: the panel makes the password for the page', await until(panel, `document.querySelector('[data-field="gen-v3-site"]')?.value === 'example.test'`), true);
  await press('Escape', 'Escape', 27);
  await closePopup();

  /* Full mode, and Lock */
  await openPopup();
  await clickPopup('.popup-full');
  check('popup: full mode opens the panel', [await until(popup, `window.__closed === true`), await inPopup(`JSON.stringify(window.__panel)`)], [true, JSON.stringify([{ windowId: windowA }])]);
  await inPopup(`window.__closed = false`);
  await clickPopup('.popup-head .icon-button');
  check('popup: Lock locks everywhere', [await until(popup, `!!document.querySelector('.popup-unlock')`), await until(panel, `!document.querySelector('#unlock').hidden`), await offscreenOpen()], [true, true, false]);
  await closePopup();

  /* -------------------------------------------------------------- *
   * Remembered on this device: a passkey of the extension's own (its id
   * the relying party), then a click — in the panel and in the popup
   * -------------------------------------------------------------- */
  const records = (sessionId) =>
    evaluate(sessionId, `new Promise((resolve, reject) => {
      const open = indexedDB.open('html-password-manager-remember', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('remembered', { keyPath: 'name' });
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const all = open.result.transaction('remembered').objectStore('remembered').getAll();
        all.onsuccess = () => {
          open.result.close();
          resolve(all.result.map((r) => ({ name: r.name, with: r.with, plain: new TextDecoder().decode(r.sealed.data).includes(${JSON.stringify(PASSWORD)}) })));
        };
      };
    })`);
  const recordsSoon = async (sessionId) => {
    for (let i = 0; i < 80; i += 1) {
      const found = await records(sessionId);
      if (found.length) return found;
      await sleep(100);
    }
    return [];
  };
  const lockAll = async () => {
    await evaluate(worker, `chrome.contextMenus.onClicked.dispatch({ menuItemId: 'lock' }); true`);
    return until(panel, `!document.querySelector('#unlock').hidden`);
  };
  const unlockTyped = async (tick) => {
    await until(panel, `!document.querySelector('#remember-row').hidden`);
    if ((await inPanel(`document.querySelector('#remember').checked`)) !== tick) await click('#remember');
    await inPanel(`document.querySelector('#password').focus()`);
    await type(PASSWORD);
    await press('Enter', 'Enter', 13);
    return until(panel, `!document.querySelector('#app').hidden`);
  };
  const pickWay = async (way) => {
    await click('#more');
    await clickText('.context-item', 'Settings');
    await inPanel(`(() => { const s = document.querySelector('[data-setting="remember"]'); s.value = ${JSON.stringify(way)}; s.dispatchEvent(new Event('change')); })()`);
    await inPanel(`document.querySelector('.popover')?.dispatchEvent(new Event('dismiss'))`);
  };

  await send('WebAuthn.enable', {}, panel);
  const { authenticatorId } = await send(
    'WebAuthn.addVirtualAuthenticator',
    { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true } },
    panel,
  );
  // The panel was left at its gate, before the authenticator: once more, so that the gate sees it.
  check('remember, panel: unlocked', await unlockTyped(false), true);
  await lockAll();
  check('remember, panel: ticked, unlocked', await unlockTyped(true), true);
  const [madeRecord] = await recordsSoon(panel);
  const { credentials } = await send('WebAuthn.getCredentials', { authenticatorId }, panel);
  check('remember, panel: a passkey for the extension itself, the password sealed', [madeRecord, credentials.map((c) => c.rpId)], [{ name: 'Extension.kdbx', with: 'system', plain: false }, [origin]]);
  await lockAll();
  check('remember, panel: the button', await until(panel, `!document.querySelector('#unlock-remembered').hidden`), true);
  await click('#unlock-remembered');
  check('remember, panel: the prompt, then the database, handed to the offscreen document', [await until(panel, `!document.querySelector('#app').hidden`), await until(worker, `chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).then((c) => c.length === 1)`)], [true, true]);

  // In the popup: remembered with no prompt (the popup is a page of its own, with no authenticator of the panel's)
  await lockAll();
  check('remember, panel: unticked — forgotten', [await unlockTyped(false), (await sleep(300), await records(panel))], [true, []]);
  await pickWay('device');
  await lockAll();
  await unlockTyped(true);
  check('remember, panel: kept with no prompt', (await recordsSoon(panel)).map((r) => r.with), ['device']);
  await lockAll();
  await openPopup();
  check(
    'remember, popup: its button, the checkbox ticked',
    [await until(popup, `!document.querySelector('.unlock-remembered').hidden`), await inPopup(`document.querySelector('.unlock-remembered').textContent`), await inPopup(`document.querySelector('.popup-remember input').checked`)],
    [true, 'Unlock without the password', true],
  );
  await clickPopup('.unlock-remembered');
  check('remember, popup: a click opens it, in the offscreen document', [await until(popup, `!document.querySelector('.popup-unlock')`), await offscreenOpen()], [true, true]);
  await closePopup();
  await lockAll();

  check('no errors in the extension', errors, []);

  /* The toolbar icon gives the panel the tab */
  const icon = await iconGivesTheTab();
  if (!icon) console.log('  This Chrome crashes on a toolbar click from DevTools when headless: the icon was not checked.');
  else check('icon: opens the popup, which sees the tab and reaches into it', [icon.opened, icon.sees, icon.reaches], [true, site('login.test'), 'login.test']);
} catch (error) {
  console.error(error);
  check('ran to the end', false, true);
} finally {
  chrome.kill();
  server.close();
  await rm(work, { recursive: true, force: true }).catch(() => undefined);
}

done('extension');
