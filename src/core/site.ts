/**
 * The site of a website: what generator 3 derives a password for, and what
 * the Chrome extension matches a tab against. Part of generator 3 (see
 * src/core/derived.ts, which re-exports both), kept apart so the extension's
 * service worker can have it without Argon2 and kdbxweb.
 */

export function normalizeSite(site: string): string {
  return site.trim().normalize('NFC').toLowerCase();
}

/** "github.com" from "https://www.github.com/login", or the text itself when it is not a URL. Part of generator 3. */
export function siteOf(url: string): string {
  const text = url.trim();
  if (!text) return '';
  try {
    const host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`).hostname;
    if (host) return normalizeSite(host.replace(/^www\./, ''));
  } catch {
    /* not a URL */
  }
  return normalizeSite(text);
}
