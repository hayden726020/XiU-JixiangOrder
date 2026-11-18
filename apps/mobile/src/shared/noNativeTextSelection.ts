const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE_TAGS.has(target.tagName) || target.isContentEditable;
}

export function disableNativeTextSelection(): void {
  for (const type of ['contextmenu', 'selectstart', 'dragstart']) {
    document.addEventListener(
      type,
      (event) => {
        if (isEditable(event.target) || isEditable(document.activeElement)) return;
        event.preventDefault();
      },
      true,
    );
  }
}