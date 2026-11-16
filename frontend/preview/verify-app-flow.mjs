import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

// 启动 vite preview
const server = spawn('npx', ['vite', 'preview', '--port', '4173'], {
  cwd: 'D:/Jixiang/workspace/team-context/frontend',
  shell: true
});

server.stdout.on('data', d => console.log('Vite:', d.toString()));
server.stderr.on('data', d => console.log('Vite Err:', d.toString()));

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let edgeProcess = null;

setTimeout(async () => {
  try {
    edgeProcess = spawn(edge, [
      '--headless=new',
      '--remote-debugging-port=9224',
      '--user-data-dir=D:/Jixiang/workspace/team-context/frontend/preview/.edge-profile-test2',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1200));

    const res = await fetch('http://127.0.0.1:9224/json/list');
    const list = await res.json();
    const pageTarget = list.find(t => t.type === 'page') || list[0];
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 412,
      height: 870,
      deviceScaleFactor: 2,
      mobile: true
    });

    // 1. 进入学生端首页
    console.log('Navigating to http://127.0.0.1:4173/#/student ...');
    await send('Page.navigate', { url: 'http://127.0.0.1:4173/#/student' });
    await new Promise(r => setTimeout(r, 1500));

    // 2. 点击底部“我的”Tab
    console.log('Clicking "我的" Tab...');
    await send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('.student-home__nav button')].find(b => b.innerText.includes('我的'))?.click()`
    });
    await new Promise(r => setTimeout(r, 800));

    // 截图保存真实 Profile 页面
    const shotProfile = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('frontend/preview/real-app-profile.png', Buffer.from(shotProfile.data, 'base64'));
    console.log('SUCCESS: Real app Profile page saved to real-app-profile.png');

    // 3. 在“我的”页面点击“我的订单”
    console.log('Clicking "我的订单"...');
    await send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('.profile-menu-item')].find(b => b.innerText.includes('我的订单'))?.click()`
    });
    await new Promise(r => setTimeout(r, 800));

    // 4. 在订单列表里找到并点击带有“风味小炒”或“黑椒鸡腿饭”的取消状态订单
    console.log('Clicking pending cancel order in list...');
    await send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('button')].find(b => b.innerText.includes('demo-order-cancel-001') || b.innerText.includes('风味小炒') || b.innerText.includes('黑椒鸡腿饭') || b.innerText.includes('制作中'))?.click()`
    });
    await new Promise(r => setTimeout(r, 1000));

    // 截图保存真实 OrderDetail 页面
    const shotOrder = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('frontend/preview/real-app-order-cancel.png', Buffer.from(shotOrder.data, 'base64'));
    console.log('SUCCESS: Real app Order Detail (Cancel Pending) saved to real-app-order-cancel.png');

    ws.close();
    edgeProcess.kill();
    server.kill();
    process.exit(0);
  } catch (err) {
    console.error('Verify error:', err);
    if (edgeProcess) edgeProcess.kill();
    server.kill();
    process.exit(1);
  }
}, 2000);
