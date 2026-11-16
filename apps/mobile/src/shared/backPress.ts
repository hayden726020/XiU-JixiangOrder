const BACK_PRESS_DURATION_MS = 280;
const pendingButtons = new WeakSet<HTMLButtonElement>();

function navigateWithTransition(action: () => void): void {
  const transitionDocument = document as Document & {
    startViewTransition?: (update: () => void) => unknown;
  };
  if (!transitionDocument.startViewTransition) {
    action();
    return;
  }
  try {
    transitionDocument.startViewTransition(action);
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
  window.setTimeout(() => {
    button.classList.remove('back-navigation-pending');
    pendingButtons.delete(button);
    document.body.classList.remove('back-navigation-waiting');
    navigateWithTransition(action);
  }, BACK_PRESS_DURATION_MS);
}
