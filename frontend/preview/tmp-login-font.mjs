import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const cwd = process.cwd();
const DEBUG_PORT = 9341;
const PROFILE = `${cwd}/preview/.edge-login-font`;
let edge = null;
let ws;
let msgId = 1;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, label, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      // retry
    }
    await sleep(300);
  }
  throw new Error(`timeout: ${label}`);
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    const timer = setTimeout(() => reject(new Error(`CDP timeout ${method}`)), 15000);
    const onMessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id === id) {
        clearTimeout(timer);
        ws.removeEventListener('message', onMessage);
        if (payload.error) reject(new Error(`${method}: ${payload.error.message}`));
        else resolve(payload.result);
      }
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

try {
  edge = spawn(
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const target = await waitFor(async () => {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const list = await res.json();
    return list.find((item) => item.type === 'page') ?? null;
  }, 'edge cdp');

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('ws error'));
  });

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/student' });
  await waitFor(async () => evaluate('!!document.querySelector(".student-login-card")'), 'login card');
  await sleep(500);

  const info = await evaluate(`(() => {
    return {
      fzShutiAvailable: document.fonts.check('20px "FZShuti"'),
      xingkaiAvailable: document.fonts.check('20px "STXingkai"'),
      brandText: document.querySelector('.student-login-brand__name').textContent.trim(),
      titleText: document.querySelector('.student-login-brand__title').textContent.trim(),
      brandFont: getComputedStyle(document.querySelector('.student-login-brand__name')).fontFamily,
      titleFont: getComputedStyle(document.querySelector('.student-login-brand__title')).fontFamily,
      scrollHeight: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  })()`);

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${cwd}/preview/login-font-check.png`, Buffer.from(data, 'base64'));
  console.log('RESULT ' + JSON.stringify(info, null, 2));
} catch (error) {
  console.log('FAILED ' + (error?.message ?? String(error)));
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {
    // ignore
  }
  edge?.kill();
  await sleep(700);
  try {
    rmSync(PROFILE, { recursive: true, force: true });
  } catch {
    // ignore locked profile
  }
  process.exit();
}