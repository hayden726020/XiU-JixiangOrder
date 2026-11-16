const BACK_PRESS_DURATION_MS = 150;
const pendingButtons = new WeakSet<HTMLButtonElement>();

export function runAfterBackPress(button: HTMLButtonElement, action: () => void): void {
  if (pendingButtons.has(button)) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    action();
    return;
  }

  pendingButtons.add(button);
  button.classList.add('back-navigation-pending');
  window.setTimeout(() => {
    button.classList.remove('back-navigation-pending');
    pendingButtons.delete(button);
    action();
  }, BACK_PRESS_DURATION_MS);
}
