import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

class FakeClassList {
  #set = new Set();
  add(...tokens) {
    for (const token of tokens) this.#set.add(token);
  }
  remove(...tokens) {
    for (const token of tokens) this.#set.delete(token);
  }
  contains(token) {
    return this.#set.has(token);
  }
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      const set = listeners.get(event.type);
      if (!set) return true;
      for (const listener of [...set]) {
        listener(event);
      }
      return !event.defaultPrevented;
    },
  };
}

function createFakeEnvironment({ reduceMotion = false, withViewTransition = true } = {}) {
  const windowTarget = createEventTarget();
  const documentTarget = createEventTarget();
  const documentElement = { dataset: {} };
  let finishTransition = null;
  let viewTransitionCalls = 0;

  const fakeWindow = {
    location: { hash: '#/student' },
    matchMedia: () => ({ matches: reduceMotion }),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener: windowTarget.addEventListener,
    removeEventListener: windowTarget.removeEventListener,
    dispatchEvent: windowTarget.dispatchEvent,
  };
  const fakeDocument = {
    body: { classList: new FakeClassList() },
    documentElement,
    addEventListener: documentTarget.addEventListener,
    removeEventListener: documentTarget.removeEventListener,
    dispatchEvent: documentTarget.dispatchEvent,
    ...(withViewTransition
      ? {
          startViewTransition(callback) {
            viewTransitionCalls += 1;
            callback();
            return {
              finished: new Promise((resolve) => {
                finishTransition = resolve;
              }),
            };
          },
        }
      : {}),
  };
  class FakeElement {}
  function makeButton({ closestMatch = false } = {}) {
    return {
      classList: new FakeClassList(),
      closest: (selector) => (closestMatch && selector === '.back-navigation-pending' ? {} : null),
    };
  }
  return {
    fakeWindow,
    fakeDocument,
    FakeElement,
    makeButton,
    getViewTransitionCalls: () => viewTransitionCalls,
    resolveViewTransition: () => finishTransition?.(),
  };
}

describe('backPress instant iOS navigation transition', () => {
  let originalWindow;
  let originalDocument;
  let originalElement;

  beforeEach(() => {
    originalWindow = globalThis.window;
    originalDocument = globalThis.document;
    originalElement = globalThis.Element;
  });

  afterEach(() => {
    mock.timers.reset();
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.Element = originalElement;
  });

  it('commits back pop immediately with zero post-click delay inside startViewTransition', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const env = createFakeEnvironment({ withViewTransition: true });
    globalThis.window = env.fakeWindow;
    globalThis.document = env.fakeDocument;
    globalThis.Element = env.FakeElement;

    const mod = await import(`../src/shared/backPress.ts?case=instant-back-${Date.now()}`);
    assert.equal(mod.BACK_PRESS_HOLD_MS, 0, 'should not add post-click JS stall');

    const button = env.makeButton();
    let navigated = 0;

    mod.runAfterBackPress(button, () => {
      navigated += 1;
    });

    assert.equal(navigated, 1);
    assert.equal(env.getViewTransitionCalls(), 1);
    assert.equal(env.fakeDocument.documentElement.dataset.navDirection, 'back');
    assert.equal(button.classList.contains('back-navigation-pending'), false);
    assert.equal(env.fakeDocument.body.classList.contains('back-navigation-waiting'), false);

    env.resolveViewTransition();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(env.fakeDocument.documentElement.dataset.navDirection, undefined);
  });

  it('supports forward push direction immediately via runAfterPressTransition', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const env = createFakeEnvironment({ withViewTransition: true });
    globalThis.window = env.fakeWindow;
    globalThis.document = env.fakeDocument;
    globalThis.Element = env.FakeElement;

    const mod = await import(`../src/shared/backPress.ts?case=instant-forward-${Date.now()}`);
    const button = env.makeButton();
    let navigated = 0;

    mod.runAfterPressTransition(button, () => {
      navigated += 1;
    }, 'forward');

    assert.equal(navigated, 1);
    assert.equal(env.fakeDocument.documentElement.dataset.navDirection, 'forward');

    env.resolveViewTransition();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(env.fakeDocument.documentElement.dataset.navDirection, undefined);
  });

  it('falls back smoothly with CSS direction attribute when startViewTransition is unavailable', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const env = createFakeEnvironment({ withViewTransition: false });
    globalThis.window = env.fakeWindow;
    globalThis.document = env.fakeDocument;
    globalThis.Element = env.FakeElement;

    const mod = await import(`../src/shared/backPress.ts?case=fallback-${Date.now()}`);
    const button = env.makeButton();
    let navigated = 0;

    mod.runAfterBackPress(button, () => {
      navigated += 1;
    });

    assert.equal(navigated, 1);
    assert.equal(env.fakeDocument.documentElement.dataset.navFallback, 'back');

    mock.timers.tick(mod.IOS_FALLBACK_MS);
    assert.equal(env.fakeDocument.documentElement.dataset.navFallback, undefined);
    assert.equal(env.fakeDocument.documentElement.dataset.navDirection, undefined);
  });

  it('navigates immediately without View Transition when prefers-reduced-motion is enabled', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const env = createFakeEnvironment({ reduceMotion: true });
    globalThis.window = env.fakeWindow;
    globalThis.document = env.fakeDocument;
    globalThis.Element = env.FakeElement;

    const mod = await import(`../src/shared/backPress.ts?case=reduced-${Date.now()}`);
    const button = env.makeButton();
    let navigated = 0;

    mod.runAfterBackPress(button, () => {
      navigated += 1;
    });

    assert.equal(navigated, 1);
    assert.equal(env.getViewTransitionCalls(), 0);
  });

  it('handles Android back gesture via module handler, then falls back to #/, and returns false at root', async () => {
    const env = createFakeEnvironment({ reduceMotion: true });
    globalThis.window = env.fakeWindow;
    globalThis.document = env.fakeDocument;
    globalThis.Element = env.FakeElement;

    const mod = await import(`../src/shared/backPress.ts?case=android-back-${Date.now()}`);
    assert.equal(typeof globalThis.window.__xiuHandleBackPress, 'function');

    let step = 1;
    const unregister = mod.registerModuleBackHandler(() => {
      if (step > 0) {
        step -= 1;
        return true;
      }
      return false;
    });

    assert.equal(mod.handleAppBackPress(), true);
    assert.equal(step, 0);
    assert.equal(env.fakeWindow.location.hash, '#/student');

    assert.equal(mod.handleAppBackPress(), true);
    assert.equal(env.fakeWindow.location.hash, '/');

    unregister();
    assert.equal(mod.handleAppBackPress(), false);
  });
});
