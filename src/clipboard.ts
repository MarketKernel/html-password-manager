/**
 * Copying secrets. A copied value is wiped from the clipboard after a while
 * and on lock. Reading the clipboard back to check it would need a permission
 * prompt, so the wipe is unconditional — as in KeePass.
 */

let clearTimer = 0;
let pending = false;

export async function copyText(value: string, clearAfterSeconds: number): Promise<void> {
  await write(value);
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
  if (!ok) throw new Error('The browser refused to copy');
}
