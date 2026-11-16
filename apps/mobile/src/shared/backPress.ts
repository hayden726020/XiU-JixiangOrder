import { flushSync } from 'react-dom';

const BACK_PRESS_DURATION_MS = 280;
const pendingButtons = new WeakSet<HTMLButtonElement>();

export function navigateToHash(route: string): void {
  window.location.hash = route;
  window.dispatchEvent(new Event('app:navigate'));
}

function navigateWithTransition(action: () => void): void {
  const transitionDocument = document as Document & {
    startViewTransition?: (update: () => void) => unknown;
  };
  if (!transitionDocument.startViewTransition) {
    action();
    return;
  }
  try {
    transitionDocument.startViewTransition(() => flushSync(action));
  } catch {
    action();
  }
}

export function runAfterBackPress(button: HTMLButtonElement, action: () => void): void {
  if (pendingButtons.has(button)) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    action();
    return;
  }

  pendingButtons.add(button);
  document.body.classList.add('back-navigation-waiting');
  button.classList.add('back-navigation-pending');
  const blockCompetingInput = (event: MouseEvent) => {
    if (!(event.target instanceof Element) || event.target.closest('.back-navigation-pending')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  document.addEventListener('click', blockCompetingInput, true);
  let timer = 0;
  const cancel = () => {
    window.clearTimeout(timer);
    button.classList.remove('back-navigation-pending');
    pendingButtons.delete(button);
    document.removeEventListener('click', blockCompetingInput, true);
    document.body.classList.remove('back-navigation-waiting');
    window.removeEventListener('hashchange', cancel);
  };
  window.addEventListener('hashchange', cancel);
  timer = window.setTimeout(() => {
    cancel();
    navigateWithTransition(action);
  }, BACK_PRESS_DURATION_MS);
}
