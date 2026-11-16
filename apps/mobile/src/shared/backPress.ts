import { flushSync } from 'react-dom';

export type NavDirection = 'back' | 'forward';

export const BACK_PRESS_HOLD_MS = 0;
export const IOS_TRANSITION_MS = 340;
export const IOS_FALLBACK_MS = 280;

const pendingButtons = new WeakSet<HTMLButtonElement>();
let cleanupTimer = 0;

export function navigateToHash(route: string): void {
  window.location.hash = route;
  window.dispatchEvent(new Event('app:navigate'));
}

function clearTransitionMarkers(): void {
  if (cleanupTimer !== 0) {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = 0;
  }
  delete document.documentElement.dataset.navDirection;
  delete document.documentElement.dataset.navFallback;
}

function runFallbackTransition(action: () => void, direction: NavDirection): void {
  clearTransitionMarkers();
  document.documentElement.dataset.navDirection = direction;
  try {
    flushSync(action);
  } finally {
    document.documentElement.dataset.navFallback = direction;
    cleanupTimer = window.setTimeout(() => {
      cleanupTimer = 0;
      clearTransitionMarkers();
    }, IOS_FALLBACK_MS);
  }
}

function commitWithTransition(action: () => void, direction: NavDirection): void {
  const transitionDocument = document as Document & {
    startViewTransition?: (update: () => void) => { finished?: Promise<unknown> } | undefined;
  };
  if (!transitionDocument.startViewTransition) {
    runFallbackTransition(action, direction);
    return;
  }

  clearTransitionMarkers();
  document.documentElement.dataset.navDirection = direction;
  let committed = false;
  try {
    const transition = transitionDocument.startViewTransition(() => {
      committed = true;
      flushSync(action);
    });
    if (transition && typeof transition === 'object' && transition.finished) {
      void transition.finished.finally(() => {
        if (document.documentElement.dataset.navDirection === direction) {
          delete document.documentElement.dataset.navDirection;
        }
      });
    } else {
      cleanupTimer = window.setTimeout(() => {
        cleanupTimer = 0;
        clearTransitionMarkers();
      }, IOS_TRANSITION_MS);
    }
  } catch {
    if (!committed) {
      runFallbackTransition(action, direction);
    } else {
      clearTransitionMarkers();
    }
  }
}

export function runAfterPressTransition(
  button: HTMLButtonElement,
  action: () => void,
  direction: NavDirection = 'forward',
): void {
  if (pendingButtons.has(button)) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    action();
    return;
  }

  pendingButtons.add(button);
  try {
    commitWithTransition(action, direction);
  } finally {
    pendingButtons.delete(button);
  }
}

export function runAfterBackPress(button: HTMLButtonElement, action: () => void): void {
  runAfterPressTransition(button, action, 'back');
}
