/**
 * Bundles src/ into ONE self-contained build/password-manager.html.
 *
 * Styles, kdbxweb, the Argon2 WebAssembly (hash-wasm keeps it as base64 inside
 * its JS), the icon and the compiled TypeScript are all inlined, so the result
 * opens from a file:// URL with no network access and no sibling files.
 *
 * Beside it goes build/pages/: the same page as an installable PWA for GitHub
 * Pages — a manifest, icons and a service worker that keeps it offline.
 *
 * And build/extension/: the Chrome extension, the same page as its side
 * panel, a compact popup for the toolbar icon, a service worker and an
 * offscreen document; zipped for the
 * Chrome Web Store as build/password-manager-extension-<version>.zip.
 *
 * The version is package.json's and nowhere else: the page shows it, the
 * extension's manifest has it, the PWA's cache is named after it.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { dictionaries, MANIFEST_TEXTS, manifestText } from './tools/i18n.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const at = (...parts) => join(root, ...parts);
const watch = process.argv.includes('--watch');
const outFile = at('build', 'password-manager.html');

/**
 * package.json's version, x.y.z, as Chrome's manifest takes it, and the one the
 * page shows: the same for a build of the commit tagged v<version>, with the
 * commit added for any other — 0.8.0+1a2b3c4 — so a page built from main is not
 * taken for the release.
 */
async function readRelease() {
  const { version } = JSON.parse(await readFile(at('package.json'), 'utf8'));
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!parts || parts.slice(1).some((n) => Number(n) > 65535)) throw new Error(`package.json: the version must be x.y.z, each up to 65535, not ${version}`);
  const git = (...args) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
  // The release workflow names the tag it builds; a checkout of a tag may not list it.
  const tagged = process.env.RELEASE_TAG === `v${version}` || git('tag', '--points-at', 'HEAD').split('\n').includes(`v${version}`);
  const commit = tagged ? '' : git('rev-parse', '--short', 'HEAD');
  return { version, label: commit ? `${version}+${commit}` : version };
}

/** Set by buildOnce() before anything is bundled. */
let release;

/** `</script` inside a string literal would close the inline tag early. */
const guard = (code) => code.replace(/<\/(script|style)/gi, '<\\/$1');

/**
 * kdbxweb's universal bundle requires Node's `crypto` and `@xmldom/xmldom`, but
 * only reaches for them when `crypto.subtle` and `DOMParser` are missing — which
 * never happens in a browser. Empty stand-ins keep ~100 KB out of the page.
 */
const nodeOnlyStubs = {
  name: 'node-only-stubs',
  setup(builder) {
    builder.onResolve({ filter: /^(crypto|@xmldom\/xmldom)$/ }, (args) => ({ path: args.path, namespace: 'stub' }));
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
  },
};

/** The extension's panel: src/extension/extension.ts takes the place of src/app/platform.ts. */
const extensionPlatform = {
  name: 'extension-platform',
  setup(builder) {
    builder.onResolve({ filter: /^\.\/platform$/ }, () => ({ path: at('src/extension/extension.ts') }));
  },
};

async function bundle(entry, { format = 'iife', plugins = [] } = {}) {
  const result = await build({
    entryPoints: [at(entry)],
    bundle: true,
    format,
    target: ['es2022'],
    platform: 'browser',
    minify: !watch,
    sourcemap: false,
    legalComments: 'none',
    charset: 'utf8',
    define: { __APP_VERSION__: JSON.stringify(release.label) },
    write: false,
    plugins: [nodeOnlyStubs, ...plugins],
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error('esbuild returned an empty result');
  return output.text;
}

const bundleApp = () => bundle('src/app/main.ts');

/** The whole point of the build: nothing may be fetched at runtime. */
function assertSelfContained(html) {
  const offenders = [
    [/<script[^>]+\ssrc=/i, '<script src=…>'],
    [/<link[^>]+href=["'](?!data:)/i, '<link href=…>'],
    [/@import\s+(url\()?["']?(?!data:)/i, '@import'],
    [/url\(\s*["']?https?:/i, 'url(http…)'],
  ];
  for (const [pattern, name] of offenders) {
    if (pattern.test(html)) throw new Error(`An external reference is left in the file: ${name}`);
  }
  if (!html.includes('http-equiv="Content-Security-Policy"')) {
    throw new Error('The Content-Security-Policy meta tag is missing');
  }
}

/** Under assets/; each goes to build/pages/ under its own name. */
const PWA_ICONS = ['icon.svg', 'pwa/icon-192.png', 'pwa/icon-512.png', 'pwa/icon-maskable-512.png', 'pwa/apple-touch-icon.png'];

/**
 * The page's CSP forbids every fetch; the installed app needs its manifest, its
 * service worker and its icons, all from its own origin. connect-src stays 'none',
 * so the page itself still reaches nothing.
 */
function allowPwa(html) {
  const pattern = /(http-equiv="Content-Security-Policy" content=")([^"]*)/;
  if (!pattern.test(html)) throw new Error('The Content-Security-Policy meta tag is missing');
  return html.replace(pattern, (_, attr, policy) => {
    const directives = new Map(policy.split(';').map((d) => d.trim().split(/\s+/)).map(([name, ...sources]) => [name, sources]));
    if (!directives.has('img-src')) throw new Error('The Content-Security-Policy has no img-src');
    directives.get('img-src').push("'self'");
    directives.set('manifest-src', ["'self'"]);
    directives.set('worker-src', ["'self'"]);
    return attr + [...directives].map(([name, sources]) => [name, ...sources].join(' ')).join('; ');
  });
}

/**
 * build/pages/: the page plus what makes it installable. Every path is
 * relative, so it works under a project site's /<repo>/ prefix.
 */
async function buildPages(html) {
  const dir = at('build', 'pages');
  const head = [
    '<link rel="manifest" href="manifest.webmanifest">',
    '<link rel="apple-touch-icon" href="apple-touch-icon.png">',
    '<meta name="theme-color" content="#fbfbfa" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#17181c" media="(prefers-color-scheme: dark)">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    // The page registers the worker itself (update.ts): this is how it knows it is the PWA.
    '<meta name="service-worker" content="sw.js">',
  ].join('\n');
  const page = allowPwa(html).replace('</head>', () => `${head}\n</head>`);
  // A deploy between two releases changes the page, not the version: the hash tells them apart.
  const cache = `${release.version}-${createHash('sha256').update(page).digest('hex').slice(0, 12)}`;

  const manifest = {
    name: 'HTML Password Manager',
    short_name: 'Passwords',
    description: 'A KeePass (.kdbx) password manager that works offline',
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    // A .kdbx opens in the app from the Finder or Explorer (Chrome and Edge on a computer), in its
    // window when one is open: a second window on the same file would overwrite the first one's saves.
    file_handlers: [{ action: './', accept: { 'application/x-keepass2': ['.kdbx'] } }],
    launch_handler: { client_mode: 'focus-existing' },
    background_color: '#fbfbfa',
    theme_color: '#6c4ee6',
    icons: [
      { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const worker = (await readFile(at('src/pwa/sw.js'), 'utf8')).replaceAll('__CACHE__', cache).replaceAll('__VERSION__', release.label);
  await Promise.all([
    writeFile(join(dir, 'index.html'), page, 'utf8'),
    writeFile(join(dir, 'sw.js'), worker, 'utf8'),
    writeFile(join(dir, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    // Without it Pages runs the files through Jekyll, which is only wasted time here.
    writeFile(join(dir, '.nojekyll'), '', 'utf8'),
    ...PWA_ICONS.map((path) => copyFile(at('assets', path), join(dir, basename(path)))),
  ]);
  console.log(`build/pages/ — PWA for GitHub Pages (cache ${cache})`);
}

/**
 * A .zip as the Chrome Web Store takes it. Every entry has the same date, so
 * the same files make the same bytes, and the same SHA256SUMS line.
 */
function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  // 1 January 1980, 00:00: the first date a .zip can hold.
  const DOS_DATE = (0 << 9) | (1 << 5) | 1;
  for (const [name, data] of files) {
    const path = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const fields = (header) => {
      header.writeUInt16LE(20, 4 + (header.length === 46 ? 2 : 0));
      const at0 = header.length === 46 ? 8 : 6;
      header.writeUInt16LE(0x0800, at0);
      header.writeUInt16LE(8, at0 + 2);
      header.writeUInt16LE(0, at0 + 4);
      header.writeUInt16LE(DOS_DATE, at0 + 6);
      header.writeUInt32LE(crc32(data), at0 + 8);
      header.writeUInt32LE(packed.length, at0 + 12);
      header.writeUInt32LE(data.length, at0 + 16);
      header.writeUInt16LE(path.length, at0 + 20);
    };
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    fields(head);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    fields(entry);
    entry.writeUInt32LE(offset, 42);
    local.push(head, path, packed);
    central.push(entry, path);
    offset += head.length + path.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

const EXTENSION_ICONS = ['icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png'];

/**
 * The same checks as for the single file, and those an extension adds: no
 * script in a page (Manifest V3 runs only its own files), and a policy that
 * keeps the extension's pages off the network.
 */
function assertExtension(files, manifest) {
  for (const [name, text] of files) {
    if (!name.endsWith('.html')) continue;
    for (const [pattern, what] of [
      [/<script(?![^>]*\ssrc="[\w-]+\.js")[^>]*>/i, 'an inline <script>'],
      [/<link[^>]+href=["'](?!data:)/i, '<link href=…>'],
      [/url\(\s*["']?https?:/i, 'url(http…)'],
      [/\s(src|href)=["']?(https?:)?\/\//i, 'an address elsewhere'],
    ]) {
      if (pattern.test(text)) throw new Error(`${name} has ${what}`);
    }
  }
  const policy = manifest.content_security_policy?.extension_pages ?? '';
  if (!/(^|;)\s*connect-src 'none'/.test(policy)) throw new Error("manifest.json: the pages' policy must have connect-src 'none'");
  if (manifest.host_permissions || manifest.content_scripts || manifest.externally_connectable) {
    throw new Error('manifest.json: no host permissions, content scripts or external connections — activeTab and optional hosts only');
  }
}

/**
 * Chrome's codes for the dictionaries in src/locales. Chrome ignores a code not
 * on its list (developer.chrome.com/docs/extensions/reference/api/i18n): pt and
 * zh are pt_BR and zh_CN there, the Brazilian text serves Portugal as well, and
 * Urdu has none, so Chrome shows the extension's name in English — the panel
 * itself still speaks Urdu.
 */
const CHROME_LOCALES = {
  ar: ['ar'], bn: ['bn'], de: ['de'], es: ['es'], fr: ['fr'], hi: ['hi'], id: ['id'], ja: ['ja'], mr: ['mr'],
  pt: ['pt_BR', 'pt_PT'], ru: ['ru'], te: ['te'], tr: ['tr'], uk: ['uk'], ur: [], zh: ['zh_CN'],
};

/**
 * What Chrome shows of the extension itself — its name, description, the
 * toolbar button's title — follows the browser's language, through chrome.i18n:
 * the manifest says __MSG_appName__ and _locales/<code>/messages.json has the
 * text. They are made from the same dictionaries as the page, context
 * "manifest"; English, the default, from the manifest itself.
 */
function localizeManifest(source, dictionaries) {
  const messagesOf = (translate) => {
    const messages = {};
    for (const { message, path, max } of MANIFEST_TEXTS) {
      const text = translate(manifestText(source, path));
      if (!text) continue;
      if (text.includes('$')) throw new Error(`manifest: "${text}" — chrome.i18n takes $ for a placeholder`);
      if (max && text.length > max) throw new Error(`manifest: "${text}" is longer than Chrome's ${max} characters`);
      messages[message] = { message: text };
    }
    return `${JSON.stringify(messages, null, 2)}\n`;
  };
  const locales = new Map([['_locales/en/messages.json', messagesOf((text) => text)]]);
  for (const [code, dictionary] of Object.entries(dictionaries)) {
    const codes = CHROME_LOCALES[code];
    if (!codes) throw new Error(`src/locales/${code}.json: CHROME_LOCALES in build.mjs has no Chrome code for it`);
    const messages = messagesOf((text) => dictionary.manifest?.[text]);
    for (const chrome of codes) locales.set(`_locales/${chrome}/messages.json`, messages);
  }

  const manifest = structuredClone(source);
  for (const { message, path } of MANIFEST_TEXTS) {
    const parent = path.slice(0, -1).reduce((value, key) => value[key], manifest);
    parent[path.at(-1)] = `__MSG_${message}__`;
  }
  manifest.default_locale = 'en';
  return { manifest, locales };
}

/** build/extension/: the side panel is the page itself, its script a file of its own, as Manifest V3 wants. */
async function buildExtension(template, styles, iconUri) {
  const dir = at('build', 'extension');
  const [manifestSource, texts, offscreenHtml, popupHtml, popupStyles, panelJs, popupJs, backgroundJs, offscreenJs] = await Promise.all([
    readFile(at('src/extension/manifest.json'), 'utf8').then(JSON.parse),
    dictionaries(),
    readFile(at('src/extension/offscreen.html'), 'utf8'),
    readFile(at('src/extension/popup.html'), 'utf8'),
    readFile(at('src/extension/popup.css'), 'utf8'),
    bundle('src/app/main.ts', { plugins: [extensionPlatform] }),
    bundle('src/extension/popup.ts'),
    bundle('src/extension/background.ts', { format: 'esm' }),
    bundle('src/extension/offscreen.ts'),
  ]);
  // Chrome's version is numbers only; the one with the commit goes where Chrome shows it.
  const { manifest, locales } = localizeManifest({ ...manifestSource, version: release.version }, texts);
  if (release.label !== release.version) manifest.version_name = release.label;
  const csp = /(http-equiv="Content-Security-Policy" content="[^"]*script-src )'unsafe-inline'/;
  if (!csp.test(template)) throw new Error("The Content-Security-Policy meta tag has no script-src 'unsafe-inline' to replace");
  const panel = template
    .replace(csp, "$1'self'")
    .replace('/*__STYLES__*/', () => styles)
    .replace('<script>/*__APP__*/</script>', '<script src="panel.js"></script>')
    .replaceAll('__ICON__', () => iconUri);
  // The popup: the page's styles, for the same buttons, fields and colours, and its own.
  const popup = popupHtml.replace('/*__STYLES__*/', () => `${styles}\n${popupStyles}`);

  const files = new Map([
    ['manifest.json', `${JSON.stringify(manifest, null, 2)}\n`],
    ['panel.html', panel],
    ['panel.js', panelJs],
    ['popup.html', popup],
    ['popup.js', popupJs],
    ['background.js', backgroundJs],
    ['offscreen.html', offscreenHtml],
    ['offscreen.js', offscreenJs],
    ...locales,
  ]);
  assertExtension(files, manifest);
  for (const name of EXTENSION_ICONS) files.set(name, await readFile(at('assets', 'extension', name)));

  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const name of files.keys()) await mkdir(dirname(join(dir, name)), { recursive: true });
  await Promise.all([...files].map(([name, data]) => writeFile(join(dir, name), data)));
  const archive = zip([...files].map(([name, data]) => [name, Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8')]));
  const zipName = `password-manager-extension-${release.version}.zip`;
  // One zip in build/, of this version: a release takes whatever matches the name.
  for (const name of await readdir(at('build'))) if (/^password-manager-extension-.*\.zip$/.test(name)) await rm(at('build', name));
  await writeFile(at('build', zipName), archive);
  const kb = (n) => (n / 1024).toFixed(1);
  console.log(`build/extension/ — Chrome extension ${release.label}, build/${zipName} ${kb(archive.length)} KB`);
}

async function buildOnce() {
  release = await readRelease();
  const [template, styles, icon, appJs] = await Promise.all([
    readFile(at('src/app/template.html'), 'utf8'),
    readFile(at('src/app/styles.css'), 'utf8'),
    readFile(at('assets/icon.svg'), 'utf8'),
    bundleApp(),
  ]);

  const svg = icon.replace(/<\?xml[\s\S]*?\?>/, '').trim();
  const iconUri = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;

  const html = template
    .replace('/*__STYLES__*/', () => styles)
    .replace('/*__APP__*/', () => guard(appJs))
    .replaceAll('__ICON__', () => iconUri);

  assertSelfContained(html);

  await mkdir(at('build'), { recursive: true });
  await writeFile(outFile, html, 'utf8');
  const kb = (n) => (n / 1024).toFixed(1);
  console.log(
    `build/password-manager.html ${release.label} — ${kb(Buffer.byteLength(html, 'utf8'))} KB ` +
      `(code ${kb(appJs.length)} KB, styles ${kb(styles.length)} KB)`,
  );
  await buildPages(html);
  await buildExtension(template, styles, iconUri);
}

await buildOnce();

if (watch) {
  const { watch: watchDir } = await import('node:fs');
  let pending = null;
  for (const dir of ['src', 'assets']) {
    watchDir(at(dir), { recursive: true }, () => {
      clearTimeout(pending);
      pending = setTimeout(() => buildOnce().catch((error) => console.error(error.message)), 120);
    });
  }
  console.log('watching src/ and assets/ …');
}
