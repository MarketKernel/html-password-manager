/**
 * Phones: one screen at a time.
 *
 * Up to 900px wide — a phone, or a tablet held upright — the entry list and
 * the entry take the window in turn, the group panel slides in over the list,
 * and menus and popovers rise from the bottom as sheets. Each of these layers
 * puts a step into the browser's history, so the system's back button — or a
 * swipe — closes the one on top, as it does in any app. On a wider window
 * nothing here does anything: no class is set and no history is written.
 *
 * Nothing runs on import: the Node tests load modules that import this one.
 */

export type Layer = 'drawer' | 'details' | 'sheet' | 'dialog';

export interface ScreensHost {
  /** Leaving the entry for the list; false keeps it open, for an edit that cannot be saved as it is. */
  leaveDetails(): Promise<boolean>;
  /** An entry is shown: a window narrowed to a phone's width opens it on its own screen. */
  hasEntry(): boolean;
}

const NARROW = '(max-width: 900px)';

const matches = (query: string): boolean => typeof matchMedia === 'function' && matchMedia(query).matches;

/** The phone layout is on. */
export const isNarrow = (): boolean => matches(NARROW);

/** No mouse to point with: a phone or a tablet, whatever its width. */
export const isTouch = (): boolean => matches('(hover: none)');

const SHEETS = '.popover--sheet, .context-menu--sheet';

/** The layers this page has put into the history, bottom first; a step's state holds its depth. */
const stack: Layer[] = [];
/** Steps back the page took itself: their popstate changes nothing. */
let silent = 0;
/** Layers opened while such a step was on its way, recorded once it has landed. */
let waiting: Layer[] = [];
let syncTimer = 0;
let host: ScreensHost | null = null;

const classes = (): DOMTokenList => document.body.classList;

function isOpen(layer: Layer): boolean {
  switch (layer) {
    case 'drawer':
      return classes().contains('drawer-open');
    case 'details':
      return classes().contains('show-details');
    case 'sheet':
      return document.querySelector(SHEETS) !== null;
    case 'dialog':
      return document.querySelector('.overlay:not([hidden])') !== null;
  }
}

function depthOf(state: unknown): number {
  const value = (state as { hpm?: unknown } | null)?.hpm;
  return typeof value === 'number' ? value : 0;
}

/**
 * Records a layer that has just opened. A layer already on top is not
 * recorded twice, and a closed one left on top is written over.
 */
export function opened(layer: Layer): void {
  if (!isNarrow()) return;
  if (silent > 0) {
    // history.go() is still travelling: a step pushed now would be the one it lands on.
    waiting.push(layer);
    return;
  }
  const top = stack.at(-1);
  if (top === layer) return;
  try {
    if (top && !isOpen(top)) {
      stack[stack.length - 1] = layer;
      history.replaceState({ hpm: stack.length }, '');
    } else {
      stack.push(layer);
      history.pushState({ hpm: stack.length }, '');
    }
  } catch {
    // No history to write to: the buttons still open and close everything.
    stack.length = 0;
  }
}

/** Something closed: the history steps back over the closed layers on top, soon. */
export function closed(): void {
  window.clearTimeout(syncTimer);
  // Later, not now: a menu item that opens another menu or a dialog reuses the step.
  syncTimer = window.setTimeout(sync, 0);
}

function sync(): void {
  if (silent > 0) return;
  let steps = 0;
  while (steps < stack.length && !isOpen(stack[stack.length - 1 - steps] as Layer)) steps += 1;
  if (steps === 0) return;
  stack.length -= steps;
  silent += 1;
  history.go(-steps);
}

function onPopState(event: PopStateEvent): void {
  if (silent > 0) {
    silent -= 1;
    if (silent === 0) {
      const replay = waiting;
      waiting = [];
      for (const layer of replay) if (isOpen(layer)) opened(layer);
      closed();
    }
    return;
  }
  const depth = depthOf(event.state);
  if (depth > stack.length) {
    // Forward, onto a step of a layer long closed: back to where the page is.
    silent += 1;
    history.go(stack.length - depth);
    return;
  }
  // The user went back: whatever was above that step closes, the top first.
  for (const layer of stack.splice(depth).reverse()) close(layer);
  closed();
}

function close(layer: Layer): void {
  switch (layer) {
    case 'sheet':
      for (const node of document.querySelectorAll(SHEETS)) node.dispatchEvent(new Event('dismiss'));
      return;
    case 'dialog':
      document.querySelector('.overlay:not([hidden])')?.dispatchEvent(new Event('dismiss'));
      return;
    case 'drawer':
      classes().remove('drawer-open');
      return;
    case 'details':
      void leave();
      return;
  }
}

/** From the entry back to the list, once its edit, if any, is saved. */
async function leave(): Promise<void> {
  if (!isOpen('details')) return;
  if (host && !(await host.leaveDetails())) {
    // The edit has a problem to fix, shown in the form: the entry stays, and so does its step.
    opened('details');
    return;
  }
  hideDetails();
}

/* ------------------------------------------------------------------ *
 * The screens
 * ------------------------------------------------------------------ */

/** Shows the entry on its own screen, over the list. */
export function showDetails(): void {
  if (!isNarrow()) return;
  classes().remove('drawer-open');
  classes().add('show-details');
  opened('details');
}

/** Back to the list, with no questions asked: the entry is gone, or was left already. */
export function hideDetails(): void {
  if (!isOpen('details')) return;
  classes().remove('show-details');
  closed();
}

/** The back button in the toolbar: the same as the system's. */
export function back(): void {
  if (stack.at(-1) === 'details' && silent === 0) history.back();
  else void leave();
}

export function isDrawerOpen(): boolean {
  return isOpen('drawer');
}

export function openDrawer(): void {
  if (!isNarrow()) return;
  classes().add('drawer-open');
  opened('drawer');
}

export function closeDrawer(): void {
  if (!isOpen('drawer')) return;
  classes().remove('drawer-open');
  closed();
}

export function toggleDrawer(): void {
  if (isOpen('drawer')) closeDrawer();
  else openDrawer();
}

export function bindScreens(next: ScreensHost): void {
  host = next;
  // Steps a previous load of the page left in the history lead nowhere now.
  if (depthOf(history.state) > 0) history.replaceState(null, '');
  window.addEventListener('popstate', onPopState);
  document.getElementById('drawer-backdrop')?.addEventListener('click', closeDrawer);
  if (typeof matchMedia !== 'function') return;
  matchMedia(NARROW).addEventListener('change', () => {
    if (isNarrow()) {
      if (host?.hasEntry()) showDetails();
      return;
    }
    // A window as wide as a computer's shows all three panes: every layer closes, with its steps.
    classes().remove('show-details', 'drawer-open');
    for (const node of document.querySelectorAll(SHEETS)) node.dispatchEvent(new Event('dismiss'));
    closed();
  });
}
