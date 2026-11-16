import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const p = spawn(edge, ['--headless=new', '--remote-debugging-port=9222', 'about:blank']);

setTimeout(async () => {
  try {
    const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
    const ws = new WebSocket(list[0].webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 1;
    function send(m, params = {}) {
      return new Promise((r) => {
        const cur = id++;
        const h = (e) => {
          const d = JSON.parse(e.data);
          if (d.id === cur) {
            ws.removeEventListener('message', h);
            r(d.result);
          }
        };
        ws.addEventListener('message', h);
        ws.send(JSON.stringify({ id: cur, method: m, params }));
      });
    }
    await send('Page.enable');
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/#/student' });
    await new Promise((r) => setTimeout(r, 1200));

    // Click demo-merchant-01
    await send('Runtime.evaluate', {
      expression: `document.querySelector('[data-merchant-id="demo-merchant-01"] button')?.click()`,
    });
    await new Promise((r) => setTimeout(r, 800));

    // Click add dish
    await send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('button')].find(b => b.innerText === '+' || b.getAttribute('aria-label')?.includes('增加'))?.click()`,
    });
    await new Promise((r) => setTimeout(r, 500));

    // Click next to slot
    await send('Runtime.evaluate', {
      expression: `document.querySelector('button.student-primary')?.click()`,
    });
    await new Promise((r) => setTimeout(r, 1200));

    const html = await send('Runtime.evaluate', {
      expression: `document.body.innerText`,
    });
    console.log('=== BODY TEXT ===');
    console.log(html.result?.value);

    const slotButtons = await send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('.booking-slot')].map(b => b.innerText)`,
    });
    console.log('=== SLOT BUTTONS ===');
    console.log(slotButtons.result?.value);

    const notice = await send('Runtime.evaluate', {
      expression: `document.querySelector('.booking-notice')?.innerText`,
    });
    console.log('=== NOTICE ===');
    console.log(notice.result?.value);

    const screenshot = await send('Page.captureScreenshot');
    writeFileSync('frontend/preview/real-app-slot.png', Buffer.from(screenshot.data, 'base64'));

    ws.close();
    p.kill();
  } catch (err) {
    console.error(err);
    p.kill();
  }
}, 1500);
