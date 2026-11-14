import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDir, '../..');
const viteEntry = pathToFileURL(join(mobileRoot, 'node_modules/vite/dist/node/index.js')).href;
const { createServer } = await import(viteEntry);

const server = await createServer({
  configFile: false,
  root: mobileRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ''}`);
  }
}

try {
  const { createStayRuntime, STAY_THRESHOLD_MS } = await server.ssrLoadModule(
    '/src/modules/student/state/stayRuntime.ts',
  );

  check('阈值为 10 分钟', STAY_THRESHOLD_MS === 600_000);

  const clock = { now: 0, timers: [] };
  let triggered = 0;
  let visible = true;
  const runtime = createStayRuntime({
    mode: 'real',
    now: () => clock.now,
    setTimeoutFn: (fn, ms) => {
      const handle = { due: clock.now + ms, fn };
      clock.timers.push(handle);
      return handle;
    },
    clearTimeoutFn: (handle) => {
      const index = clock.timers.indexOf(handle);
      if (index >= 0) {
        clock.timers.splice(index, 1);
      }
    },
    onThreshold: () => {
      triggered += 1;
    },
    isVisible: () => visible,
  });

  function advance(ms) {
    const target = clock.now + ms;
    for (;;) {
      const due = clock.timers
        .filter((item) => item.due <= target)
        .sort((a, b) => a.due - b.due)[0];
      if (!due) {
        break;
      }
      clock.now = due.due;
      const index = clock.timers.indexOf(due);
      if (index >= 0) {
        clock.timers.splice(index, 1);
      }
      due.fn();
    }
    clock.now = target;
  }

  runtime.start();
  check('启动进入 running', runtime.getState().phase === 'running');
  check('启动只有一个定时器', clock.timers.length === 1);
  advance(599_999);
  check('599999ms 不触发', triggered === 0);
  advance(1);
  check('600000ms 恰好触发一次', triggered === 1);
  check('触发后状态 triggered', runtime.getState().phase === 'triggered');
  check('触发后不再排程', clock.timers.length === 0);

  runtime.reset();
  advance(600_000);
  check('reset 后可再次触发', triggered === 2);

  const pausedClock = { now: 0, timers: [] };
  let pausedVisible = true;
  let pausedTriggered = 0;
  const pausedRuntime = createStayRuntime({
    mode: 'real',
    now: () => pausedClock.now,
    setTimeoutFn: (fn, ms) => {
      const handle = { due: pausedClock.now + ms, fn };
      pausedClock.timers.push(handle);
      return handle;
    },
    clearTimeoutFn: (handle) => {
      const index = pausedClock.timers.indexOf(handle);
      if (index >= 0) {
        pausedClock.timers.splice(index, 1);
      }
    },
    onThreshold: () => {
      pausedTriggered += 1;
    },
    isVisible: () => pausedVisible,
  });

  pausedRuntime.start();
  pausedClock.now = 180_000;
  pausedRuntime.pause();
  check('暂停后 accumulated 约 180000ms', Math.abs(pausedRuntime.getState().accumulatedMs - 180_000) < 2);
  pausedClock.now += 600_000;
  check('隐藏期间不触发', pausedTriggered === 0);
  check('隐藏期间无定时器', pausedClock.timers.length === 0);
  pausedRuntime.resume();
  check('恢复后回到 running', pausedRuntime.getState().phase === 'running');
  check('恢复后只有一个定时器', pausedClock.timers.length === 1);
  pausedClock.now += 420_000;
  const timer = pausedClock.timers[0];
  if (timer) {
    pausedClock.now = timer.due;
    pausedClock.timers.splice(0, 1);
    timer.fn();
  }
  check('恢复后补足剩余时长触发一次', pausedTriggered === 1);

  const hiddenClock = { now: 0, timers: [] };
  let hiddenTriggered = 0;
  const hiddenRuntime = createStayRuntime({
    mode: 'real',
    now: () => hiddenClock.now,
    setTimeoutFn: (fn, ms) => {
      const handle = { due: hiddenClock.now + ms, fn };
      hiddenClock.timers.push(handle);
      return handle;
    },
    clearTimeoutFn: (handle) => {
      const index = hiddenClock.timers.indexOf(handle);
      if (index >= 0) {
        hiddenClock.timers.splice(index, 1);
      }
    },
    onThreshold: () => {
      hiddenTriggered += 1;
    },
    isVisible: () => false,
  });
  hiddenRuntime.start();
  hiddenClock.now = 600_000;
  const hiddenTimer = hiddenClock.timers[0];
  if (hiddenTimer) {
    hiddenClock.timers.splice(0, 1);
    hiddenTimer.fn();
  }
  check('到点时不可见转暂停', hiddenRuntime.getState().phase === 'paused');
  check('不可见到点不触发', hiddenTriggered === 0);

  const sampleRuntime = createStayRuntime({ mode: 'sample' });
  sampleRuntime.start();
  check('样例模式 disabled', sampleRuntime.getState().phase === 'disabled');
  sampleRuntime.reset();
  check('样例 reset 仍 disabled', sampleRuntime.getState().phase === 'disabled');

  const disposeClock = { now: 0, timers: [] };
  const disposeRuntime = createStayRuntime({
    mode: 'real',
    now: () => disposeClock.now,
    setTimeoutFn: (fn, ms) => {
      const handle = { due: disposeClock.now + ms, fn };
      disposeClock.timers.push(handle);
      return handle;
    },
    clearTimeoutFn: (handle) => {
      const index = disposeClock.timers.indexOf(handle);
      if (index >= 0) {
        disposeClock.timers.splice(index, 1);
      }
    },
    onThreshold: () => {},
  });
  disposeRuntime.start();
  disposeRuntime.dispose();
  check('dispose 清空定时器', disposeClock.timers.length === 0);
  disposeRuntime.start();
  check('dispose 后不再排程', disposeClock.timers.length === 0);
} finally {
  await server.close();
}

console.log(
  failures === 0
    ? 'ALL S17 STAY TIMER CHECKS PASSED'
    : `${failures} S17 STAY TIMER CHECK(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);