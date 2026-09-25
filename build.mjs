/**
 * Bundles src/ into ONE self-contained build/password-manager.html.
 *
 * Styles, kdbxweb, the Argon2 WebAssembly (hash-wasm keeps it as base64 inside
 * its JS), the icon and the compiled TypeScript are all inlined, so the result
 * opens from a file:// URL with no network access and no sibling files.
 */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
