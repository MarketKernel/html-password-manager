/**
 * Which entries a browser tab is for — the Chrome extension's side of the
 * website field.
 *
 * An entry fits a page when its website names exactly the page's site, both
 * reduced by siteOf() of generator 3: no scheme, port, path or leading
 * "www.", IDN in punycode. A subdomain is another site: google.com does not
 * fit accounts.google.com, mail.site.com does not fit site.com. And the page
 * must be as safe as the entry: an https:// entry — or one with no scheme,
 * taken for https — is never filled into an http:// page.
 *
 * No DOM here: the Node tests check it, and the service worker runs it.
 */

import { siteOf } from './site';

/** A page a login can be filled into: an http or https one. */
export interface Page {
  site: string;
  /** Served over https. */
  secure: boolean;
}

/** An entry's website, as much of it as matching needs. */
export interface Target {
  site: string;
  /** Asks for https: an http page does not get it. */
  secure: boolean;
}

/** The page at `url`, or null for one that takes no login (chrome://, file:, about:blank …). */
export function pageOf(url: string): Page | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  // A host written with its final dot, "github.com.", is the same host.
  const site = siteOf(parsed.hostname.replace(/\.$/, ''));
  return site ? { site, secure: parsed.protocol === 'https:' } : null;
}

/** What an entry's website field points at, or null when it names no web site (empty, ftp://, cmd:// …). */
export function targetOf(url: string): Target | null {
  const text = url.trim();
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(text)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') return null;
  const site = siteOf(text);
  // Text that is no address at all — "My bank" — can never equal a host name: it has a space.
  return site && !/\s/.test(site) ? { site, secure: scheme !== 'http' } : null;
}

export function fits(target: Target | null, page: Page | null): boolean {
  return Boolean(target && page && target.site === page.site && (page.secure || !target.secure));
}

/** The items whose website fits the page, in their order. */
export function entriesFor<T>(items: readonly T[], urlOf: (item: T) => string, page: Page | null): T[] {
  if (!page) return [];
  return items.filter((item) => fits(targetOf(urlOf(item)), page));
}
