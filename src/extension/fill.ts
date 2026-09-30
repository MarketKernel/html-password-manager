/**
 * The one function the Chrome extension puts into a web page, with
 * chrome.scripting.executeScript. Only its text goes there, so it refers to
 * nothing outside itself: every helper lives inside it.
 *
 * Called with null, it looks and fills nothing: where the frame is, what
 * login fields it has, what is typed as the user name. The service worker
 * asks every frame so first, and hands the values only to frames of the
 * entry's site — the function still checks its own address before it types.
 *
 * It runs in the extension's isolated world, where assigning `value` goes
 * past the setters a page puts on its inputs; the events then tell React,
 * Vue or Angular of the change.
 */

export interface FillRequest {
  /** The site the values are for, as siteOf() has it; a frame elsewhere fills nothing. */
  site: string;
  /** The entry asks for https: a frame served over http fills nothing. */
  secure: boolean;
  username: string;
  password: string;
  /** The current one-time code, or ''. */
  otp: string;
  /** The password was just made for this page: it goes into a registration's fields, not a sign-in's. */
  fresh: boolean;
}

export interface FrameReport {
  /** The frame's origin — inherited by about:blank — or 'null'. */
  origin: string;
  /** The fields it has for a login. */
  username: boolean;
  password: boolean;
  otp: boolean;
  /** What is typed in its user name field already. */
  typed: string;
  /** What was filled; nothing when the frame was only asked. */
  filled: ('username' | 'password' | 'otp')[];
  /** Why nothing was filled though asked. */
  refused?: 'site' | 'insecure';
}

export function loginForm(request: FillRequest | null): FrameReport {
  // about:blank has no origin of its own in its address: it is its parent's.
  const origin = location.origin !== 'null' ? location.origin : self.origin;
  const report: FrameReport = { origin, username: false, password: false, otp: false, typed: '', filled: [] };

  let here: URL | null = null;
  try {
    here = new URL(origin);
  } catch {
    /* an opaque origin: a sandboxed frame */
  }
  if (request) {
    const site = here ? here.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '') : '';
    if (!here || site !== request.site || (here.protocol !== 'https:' && here.protocol !== 'http:')) {
      report.refused = 'site';
      return report;
    }
    if (request.secure && here.protocol !== 'https:') {
      report.refused = 'insecure';
      return report;
    }
  }

  /* Every input, open shadow roots included, in the order they show. */
  const inputs: HTMLInputElement[] = [];
  const walk = (parent: Element | ShadowRoot | Document): void => {
    for (const child of Array.from(parent.children)) {
      if (child instanceof HTMLInputElement) inputs.push(child);
      if (child.shadowRoot) walk(child.shadowRoot);
      walk(child);
    }
  };
  walk(document);

  /* Only what a person can see and type into: a field hidden as a trap stays empty. */
  const visible = (input: HTMLInputElement): boolean => {
    if (input.disabled || input.readOnly) return false;
    const box = input.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) return false;
    if (box.bottom <= 0 || box.right <= 0 || box.top >= innerHeight || box.left >= innerWidth) return false;
    return input.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true } as CheckVisibilityOptions);
  };
  const tokens = (input: HTMLInputElement): string[] => (input.getAttribute('autocomplete') ?? '').toLowerCase().split(/\s+/);
  const hints = (input: HTMLInputElement): string => `${input.name} ${input.id} ${input.getAttribute('aria-label') ?? ''} ${input.placeholder}`.toLowerCase();
  const shown = inputs.filter(visible);

  /** The field for a one-time code: it says so, or it takes 6 to 8 digits. */
  const isOtp = (input: HTMLInputElement): boolean => {
    if (tokens(input).includes('one-time-code')) return true;
    // A bank's customer number is digits too, but its field says what it is.
    if (tokens(input).some((token) => ['username', 'email', 'current-password', 'new-password'].includes(token))) return false;
    if (!['text', 'tel', 'number', 'password'].includes(input.type)) return false;
    const sized = input.maxLength >= 6 && input.maxLength <= 8;
    const digits = input.inputMode === 'numeric' || input.type === 'number' || input.type === 'tel' || /\\d|\[0-9\]/.test(input.pattern);
    const named = /otp|2fa|mfa|one.?time|verification|auth.?code|security.?code|(^|[\s_-])code($|[\s_-])/.test(hints(input));
    return (sized && digits) || (named && (sized || digits));
  };
  const isPassword = (input: HTMLInputElement): boolean =>
    !isOtp(input) && (input.type === 'password' || tokens(input).some((token) => token === 'current-password' || token === 'new-password'));
  const isLogin = (input: HTMLInputElement): boolean => {
    if (!['text', 'email', 'tel'].includes(input.type) || isOtp(input) || isPassword(input)) return false;
    return !/search|query|captcha/.test(hints(input)) && !tokens(input).some((token) => token === 'search');
  };
  /** A lone login field says it is one: by its autocomplete, its type or its name. */
  const namesLogin = (input: HTMLInputElement): boolean =>
    tokens(input).includes('username') || input.type === 'email' || /user|login|e-?mail|account|ident|phone/.test(hints(input));

  const group = (input: HTMLInputElement): Node => input.form ?? input.getRootNode();
  let focused: Element | null = document.activeElement;
  while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
  const focusedInput = focused instanceof HTMLInputElement ? focused : null;

  const passwords = shown.filter(isPassword);
  // The form the user is in, or else the first with a password field.
  const home = passwords.find((input) => focusedInput && group(input) === group(focusedInput)) ?? passwords[0];
  const own = home ? passwords.filter((input) => group(input) === group(home)) : [];

  let login: HTMLInputElement | undefined;
  if (home) {
    const before = shown.slice(0, shown.indexOf(home)).filter((input) => group(input) === group(home) && isLogin(input));
    login = shown.find((input) => group(input) === group(home) && isLogin(input) && tokens(input).includes('username')) ?? before.at(-1);
  } else {
    // The first step of a sign-in in two: the user name alone.
    login = (focusedInput && isLogin(focusedInput) && visible(focusedInput) ? focusedInput : undefined) ?? shown.find((input) => isLogin(input) && namesLogin(input));
  }
  const code = shown.find((input) => isOtp(input) && input !== login);

  report.username = Boolean(login);
  report.password = own.length > 0;
  report.otp = Boolean(code);
  report.typed = login?.value.trim() ?? '';
  if (!request) return report;

  const setValue = (input: HTMLInputElement, value: string): void => {
    input.focus();
    input.value = value;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // A sign-in's field says current-password; a registration's or a change's, new-password, often twice.
  const current = own.filter((input) => tokens(input).includes('current-password'));
  const fresh = own.filter((input) => tokens(input).includes('new-password'));
  let targets: HTMLInputElement[];
  if (current.length && !(request.fresh && fresh.length)) targets = current.slice(0, 1);
  else if (fresh.length) targets = own.filter((input) => !tokens(input).includes('current-password') && own.indexOf(input) >= own.indexOf(fresh[0] as HTMLInputElement));
  else targets = own.length === 2 ? own : own.slice(0, 1);

  if (login && request.username) {
    setValue(login, request.username);
    report.filled.push('username');
  }
  if (request.password && targets.length) {
    for (const input of targets) setValue(input, request.password);
    report.filled.push('password');
  }
  if (code && request.otp) {
    setValue(code, request.otp);
    report.filled.push('otp');
  }
  return report;
}
