/**
 * Copying secrets. A copied value is wiped from the clipboard after a while
 * and on lock. Reading the clipboard back to check it would need a permission
 * prompt, so the wipe is unconditional — as in KeePass.
 */

import { t } from '../core/i18n';

let clearTimer = 0;
/** A secret copied from here may still be on the clipboard: set by a copy, cleared by a wipe that worked. */
let pending = false;
let wiping: Promise<void> | null = null;
/** Counts copies: a wipe that ends after the next copy has not wiped that one. */
let copies = 0;

export async function copyText(value: string, clearAfterSeconds: number): Promise<void> {
  await write(value);
  copies++;
  window.clearTimeout(clearTimer);
  clearTimer = 0;
  pending = clearAfterSeconds > 0;
  if (pending) clearTimer = window.setTimeout(() => void clearClipboard(), clearAfterSeconds * 1000);
}

/**
 * Wipes the clipboard if a secret copied from here may still be on it. A second
 * call waits for the wipe the first one started: the page about to reload for an
 * update must not go before it is done. A window out of focus may not write the
 * clipboard at all; the secret then counts as still there, and the wipe is tried
 * again when the window gets the focus back.
 */
export function clearClipboard(): Promise<void> {
  window.clearTimeout(clearTimer);
  clearTimer = 0;
  if (pending && !wiping) {
    const wiped = copies;
    wiping = write('')
      .then(
        () => {
          if (copies === wiped) pending = false;
        },
        () => undefined,
      )
      .finally(() => (wiping = null));
  }
  return wiping ?? Promise.resolve();
}

export const secretOnClipboard = (): boolean => pending;

if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    // Only a wipe that was due and failed: one still waiting for its timer keeps waiting.
    if (pending && !clearTimer) void clearClipboard();
  });
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
