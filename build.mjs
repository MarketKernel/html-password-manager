/**
 * Bundles src/ into ONE self-contained build/password-manager.html.
 *
 * Styles, kdbxweb, the Argon2 WebAssembly (hash-wasm keeps it as base64 inside
 * its JS), the icon and the compiled TypeScript are all inlined, so the result
 * opens from a file:// URL with no network access and no sibling files.
 *
 * Beside it goes build/pages/: the same page as an installable PWA for GitHub
 * Pages — a manifest, icons and a service worker that keeps it offline.
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const at = (...parts) => join(root, ...parts);
const watch = process.argv.includes('--watch');
const outFile = at('build', 'password-manager.html');

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

async function bundleApp() {
  const result = await build({
    entryPoints: [at('src/main.ts')],
    bundle: true,
    format: 'iife',
    target: ['es2022'],
    platform: 'browser',
    minify: !watch,
    sourcemap: false,
    legalComments: 'none',
    charset: 'utf8',
    write: false,
    plugins: [nodeOnlyStubs],
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error('esbuild returned an empty result');
  return output.text;
}

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

const PWA_ICONS = ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

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
    "<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js'));</script>",
  ].join('\n');
  const page = allowPwa(html).replace('</head>', () => `${head}\n</head>`);
  const version = createHash('sha256').update(page).digest('hex').slice(0, 12);

  const manifest = {
    name: 'HTML Password Manager',
    short_name: 'Passwords',
    description: 'A KeePass (.kdbx) password manager that works offline',
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
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
  const worker = (await readFile(at('src/sw.js'), 'utf8')).replaceAll('__VERSION__', version);
  await Promise.all([
    writeFile(join(dir, 'index.html'), page, 'utf8'),
    writeFile(join(dir, 'sw.js'), worker, 'utf8'),
    writeFile(join(dir, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    // Without it Pages runs the files through Jekyll, which is only wasted time here.
    writeFile(join(dir, '.nojekyll'), '', 'utf8'),
    ...PWA_ICONS.map((name) => copyFile(at('vendor', name), join(dir, name))),
  ]);
  console.log(`build/pages/ — PWA for GitHub Pages (cache ${version})`);
}

async function buildOnce() {
  const [template, styles, icon, appJs] = await Promise.all([
    readFile(at('src/template.html'), 'utf8'),
    readFile(at('src/styles.css'), 'utf8'),
    readFile(at('vendor/icon.svg'), 'utf8'),
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
    `build/password-manager.html — ${kb(Buffer.byteLength(html, 'utf8'))} KB ` +
      `(code ${kb(appJs.length)} KB, styles ${kb(styles.length)} KB)`,
  );
  await buildPages(html);
}

await buildOnce();

if (watch) {
  const { watch: watchDir } = await import('node:fs');
  let pending = null;
  for (const dir of ['src', 'vendor']) {
    watchDir(at(dir), { recursive: true }, () => {
      clearTimeout(pending);
      pending = setTimeout(() => buildOnce().catch((error) => console.error(error.message)), 120);
    });
  }
  console.log('watching src/ and vendor/ …');
}
