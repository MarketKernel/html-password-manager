/**
 * Which entries fit a tab (src/core/match.ts), as the Chrome extension fills
 * them: the exact site only, "www." aside, IDN in punycode, and never an
 * https entry into an http page.
 */
import { checker, load } from '../tools/load.mjs';

const M = await load('core/match');
const { check, done } = checker();
const fitsTab = (entryUrl, tabUrl) => M.fits(M.targetOf(entryUrl), M.pageOf(tabUrl));

// The site of a tab's address
check(
  'page of an address',
  ['https://www.GitHub.com/login?next=/', 'http://login.example.com:8080/a', 'https://github.com./', 'https://xn--e1afmkfd.xn--p1ai/', 'http://192.168.1.1/'].map(M.pageOf),
  [
    { site: 'github.com', secure: true },
    { site: 'login.example.com', secure: false },
    { site: 'github.com', secure: true },
    { site: 'xn--e1afmkfd.xn--p1ai', secure: true },
    { site: '192.168.1.1', secure: false },
  ],
);
check('no page to fill', ['chrome://settings', 'file:///tmp/a.html', 'about:blank', 'chrome-extension://abc/panel.html', 'data:text/html,x', '', 'not a url'].map(M.pageOf), [null, null, null, null, null, null, null]);

// What an entry's website names
check(
  'target of a website',
  ['https://github.com/login', 'http://router.local', 'github.com', 'www.github.com/x', 'https://пример.рф'].map(M.targetOf),
  [
    { site: 'github.com', secure: true },
    { site: 'router.local', secure: false },
    { site: 'github.com', secure: true },
    { site: 'github.com', secure: true },
    { site: 'xn--e1afmkfd.xn--p1ai', secure: true },
  ],
);
check('no web site', ['', '   ', 'ftp://files.example.com', 'cmd://putty.exe', 'My bank', 'android://com.example.app'].map(M.targetOf), [null, null, null, null, null, null]);

// The exact site
check('the same site', fitsTab('https://github.com/login', 'https://github.com/session'), true);
check('path, query and port aside', fitsTab('https://github.com:443/a?b=c', 'https://github.com:8443/x/y#z'), true);
check('www. aside, either way', [fitsTab('https://www.github.com', 'https://github.com/'), fitsTab('https://github.com', 'https://www.github.com/')], [true, true]);
check('case aside', fitsTab('HTTPS://GitHub.COM', 'https://github.com/'), true);
check('IDN as typed and in punycode', [fitsTab('https://пример.рф/вход', 'https://xn--e1afmkfd.xn--p1ai/'), fitsTab('https://xn--e1afmkfd.xn--p1ai', 'https://пример.рф/')], [true, true]);
check('a subdomain is another site', [fitsTab('https://google.com', 'https://accounts.google.com/'), fitsTab('https://mail.site.com', 'https://site.com/')], [false, false]);
check('a look-alike is another site', [fitsTab('https://github.com', 'https://g1thub.com/'), fitsTab('https://github.com', 'https://github.com.evil.example/')], [false, false]);

// http and https
check('https entry, http page: no', fitsTab('https://example.com', 'http://example.com/'), false);
check('no scheme is https: not on an http page', fitsTab('example.com', 'http://example.com/'), false);
check('no scheme, https page', fitsTab('example.com', 'https://example.com/'), true);
check('http entry, http page', fitsTab('http://router.local', 'http://router.local/admin'), true);
check('http entry, https page', fitsTab('http://example.com', 'https://example.com/'), true);
check('nothing fits no page', [M.fits(M.targetOf('https://a.com'), null), M.fits(null, M.pageOf('https://a.com'))], [false, false]);

// The entries of a tab, in their order
const entries = [
  { title: 'b', url: 'https://github.com/b' },
  { title: 'gitlab', url: 'https://gitlab.com' },
  { title: 'a', url: 'www.github.com' },
  { title: 'plain', url: 'http://github.com' },
  { title: 'none', url: '' },
];
check('entries for a page', M.entriesFor(entries, (e) => e.url, M.pageOf('https://github.com/login')).map((e) => e.title), ['b', 'a', 'plain']);
check('entries for an http page', M.entriesFor(entries, (e) => e.url, M.pageOf('http://github.com/login')).map((e) => e.title), ['plain']);
check('entries for no page', M.entriesFor(entries, (e) => e.url, null), []);

done('match');
