import { flushSync } from 'react-dom';

export type NavDirection = 'back' | 'forward';

export const BACK_PRESS_HOLD_MS = 0;
export const IOS_TRANSITION_MS = 340;
export const IOS_FALLBACK_MS = 280;
export const SURFACE_TRANSITION_MS = 220;

const pendingButtons = new WeakSet<object>();
let cleanupTimer = 0;
let surfaceFallbackTimer = 0;
let moduleBackHandler: (() => boolean) | null = null;

interface ViewTransitionLike {
  finished?: Promise<unknown>;
}

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionLike | undefined;
};

declare global {
  interface Window {
    __xiuHandleBackPress?: () => boolean;
  }
}

export function navigateToHash(route: string): void {
  window.location.hash = route;
  window.dispatchEvent(new Event('app:navigate'));
}

export function registerModuleBackHandler(handler: (() => boolean) | null): () => void {
  moduleBackHandler = handler;
  return () => {
    if (moduleBackHandler === handler) {
      moduleBackHandler = null;
    }
  };
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
  const transitionDocument = document as TransitionDocument;
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

export function runDirectionTransition(
  action: () => void,
  direction: NavDirection = 'forward',
): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    action();
    return;
  }
  commitWithTransition(action, direction);
}

/**
 * 零停顿执行按钮触发的 iOS Push/Pop 页面切换：
 * - 支持 `document.startViewTransition` 原生快照过渡（340ms cubic-bezier(0.32, 0.72, 0, 1)）
 * - 不支持时自动走 `data-nav-fallback` 280ms 淡入兜底
 * - `prefers-reduced-motion: reduce` 时跳过动画直接提交状态
 */
export function runAfterPressTransition(
  button: HTMLElement | null | undefined,
  action: () => void,
  direction: NavDirection = 'forward',
): void {
  if (!button) {
    runDirectionTransition(action, direction);
    return;
  }
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

/**
 * 返回按钮专用快捷入口：固定以 `'back'` 方向执行 iOS Pop 退场动画。
 */
export function runAfterBackPress(
  button: HTMLElement | null | undefined,
  action: () => void,
): void {
  runAfterPressTransition(button, action, 'back');
}

export function handleAppBackPress(): boolean {
  try {
    if (moduleBackHandler && moduleBackHandler()) {
      return true;
    }
  } catch {
    // 忽略子模块返回处理异常，继续按顶层路由回退。
  }
  const rawHash = typeof window !== 'undefined' ? (window.location?.hash ?? '') : '';
  const route = rawHash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  if (route !== '/') {
    runDirectionTransition(() => navigateToHash('/'), 'back');
    return true;
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.__xiuHandleBackPress = handleAppBackPress;
}

/**
 * 开启轻量级视图内切换表面标记（对应 `html[data-student-surface]`，220ms ease-out）。
 * 返回卸载函数，适合在顶层视图组件的 `useEffect` 中调用。
 */
export function enableSurfaceMode(): () => void {
  document.documentElement.dataset.studentSurface = '';
  return () => {
    delete document.documentElement.dataset.studentSurface;
  };
}

/**
 * 轻量级视图内页面切换：
 * - 若外层已经通过 `runAfterPressTransition` 设置了 `data-nav-direction`，直接同步提交以避免嵌套 `startViewTransition`
 * - 否则使用 `startViewTransition` 并打上 `data-student-page-animating`，或走 `data-student-nav-fallback`（220ms）
 */
export function runSurfaceTransition(action: () => void, skip = false): void {
  const root = document.documentElement;
  if (
    skip
    || root.dataset.navDirection
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    action();
    return;
  }

  const transitionDocument = document as TransitionDocument;
  if (transitionDocument.startViewTransition) {
    const transitionId = String(performance.now());
    root.dataset.studentPageAnimating = transitionId;
    try {
      const transition = transitionDocument.startViewTransition(() => flushSync(action));
      const clearMarker = () => {
        if (root.dataset.studentPageAnimating === transitionId) {
          delete root.dataset.studentPageAnimating;
        }
      };
      if (transition && typeof transition === 'object' && transition.finished) {
        void transition.finished.then(clearMarker, clearMarker);
      } else {
        window.setTimeout(clearMarker, SURFACE_TRANSITION_MS);
      }
    } catch {
      delete root.dataset.studentPageAnimating;
      action();
    }
    return;
  }

  action();
  if (surfaceFallbackTimer !== 0) {
    window.clearTimeout(surfaceFallbackTimer);
  }
  root.dataset.studentNavFallback = '';
  surfaceFallbackTimer = window.setTimeout(() => {
    surfaceFallbackTimer = 0;
    delete root.dataset.studentNavFallback;
  }, SURFACE_TRANSITION_MS);
}
