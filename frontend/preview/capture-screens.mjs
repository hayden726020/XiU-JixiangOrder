import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const p = spawn(edge, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--user-data-dir=D:/Jixiang/workspace/team-context/frontend/preview/.edge-profile-test',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
]);

p.stderr.on('data', (d) => console.log('Edge err:', d.toString()));

async function main() {
  console.log('Waiting for Edge to start...');
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/list');
      const list = await res.json();
      console.log('Targets:', list.map(t => ({ title: t.title, type: t.type })));
      const pageTarget = list.find(t => t.type === 'page') || list[0];
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        console.log('Connecting to WS:', pageTarget.webSocketDebuggerUrl);
        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
        await new Promise((r) => (ws.onopen = r));
        let id = 1;
        function send(m, params = {}) {
          return new Promise((r, rej) => {
            const cur = id++;
            const timer = setTimeout(() => rej(new Error('Timeout ' + m)), 10000);
            const h = (e) => {
              const d = JSON.parse(e.data);
              if (d.id === cur) {
                clearTimeout(timer);
                ws.removeEventListener('message', h);
                r(d.result);
              }
            };
            ws.addEventListener('message', h);
            ws.send(JSON.stringify({ id: cur, method: m, params }));
          });
        }
        await send('Page.enable');
        const fileUrl = pathToFileURL(resolve('frontend/preview/cancel-and-profile.html')).href;
        console.log('Navigating to:', fileUrl);
        await send('Page.navigate', { url: fileUrl });
        await new Promise((r) => setTimeout(r, 1200));

        await send('Emulation.setDeviceMetricsOverride', {
          width: 1360,
          height: 1020,
          deviceScaleFactor: 1,
          mobile: false
        });

        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        writeFileSync('frontend/preview/cancel-profile-dual-preview.png', Buffer.from(screenshot.data, 'base64'));
        console.log('SUCCESS: Dual preview screenshot saved!');

        ws.close();
        p.kill();
        return;
      }
    } catch (e) {
      console.log('Retry connect...', e.message);
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  p.kill();
}

main().catch(err => {
  console.error(err);
  p.kill();
});
