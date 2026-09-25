/**
 * Copying secrets. A copied value is wiped from the clipboard after a while
 * and on lock. Reading the clipboard back to check it would need a permission
 * prompt, so the wipe is unconditional — as in KeePass.
 */

import { t } from './i18n';

let clearTimer = 0;
let pending = false;

/** A promise for a value still being computed is handed to the clipboard at once, while the click still counts. */
export async function copyText(value: string | Promise<string>, clearAfterSeconds: number): Promise<void> {
  await (typeof value === 'string' ? write(value) : writeLater(value));
  window.clearTimeout(clearTimer);
  pending = clearAfterSeconds > 0;
  if (pending) clearTimer = window.setTimeout(() => void clearClipboard(), clearAfterSeconds * 1000);
}

/** Wipes the clipboard if a secret copied from here may still be on it. */
export async function clearClipboard(): Promise<void> {
  window.clearTimeout(clearTimer);
  if (!pending) return;
  pending = false;
  await write('').catch(() => undefined);
}

/**
 * Safari and Firefox let a page write the clipboard only right after a click,
 * which a derived password (Argon2) outlasts. A ClipboardItem accepts the
 * value as a promise, so the write starts inside the click.
 */
async function writeLater(value: Promise<string>): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = value.then((text) => new Blob([text], { type: 'text/plain' }));
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      return;
    } catch {
      /* the value failed, or the browser refused: find out which below */
    }
  }
  await write(await value);
}

async function write(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      /* not focused or not allowed — try the legacy route */
    }
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error(t('errors', 'The browser refused to copy'));
}
