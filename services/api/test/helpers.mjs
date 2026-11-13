import http from 'node:http';
import { createApp } from '../src/app.mjs';
import { createDatabase, seedDemoData } from '../src/db.mjs';
import { hashPassword } from '../src/security.mjs';

export const PASSWORDS = {
  'demo-student': 'student-pass-123',
  'demo-merchant': 'merchant-pass-123',
  'demo-admin': 'admin-pass-123',
};

export const ACCOUNTS = {
  student: { account: 'demo-student', password: PASSWORDS['demo-student'] },
  merchant: { account: 'demo-merchant', password: PASSWORDS['demo-merchant'] },
  admin: { account: 'demo-admin', password: PASSWORDS['demo-admin'] },
};

export async function startTestServer({ now = Date.parse('2026-11-13T10:00:00+08:00') } = {}) {
  const db = createDatabase(':memory:');
  let currentNow = now;
  const clock = () => currentNow;

  seedDemoData(db, { now, passwords: PASSWORDS });
  const { handler } = createApp({ db, clock });
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/api/v1`;

  async function api(method, path, { token, body, headers = {} } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let payload = null;
    if (text.length > 0) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    return { status: response.status, body: payload };
  }

  async function login(role = 'student') {
    const credentials = ACCOUNTS[role];
    const response = await api('POST', '/auth/demo-login', { body: credentials });
    if (response.status !== 200) {
      throw new Error(`登录失败：${JSON.stringify(response.body)}`);
    }
    return response.body.data.token;
  }

  function addUser({ id, account, password, role, displayName, studentId = null, merchantId = null }) {
    db.prepare(
      `INSERT INTO users (id, account, password_stored, display_name, role, student_id, merchant_id, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    ).run(id, account, hashPassword(password), displayName, role, studentId, merchantId);
  }

  return {
    db,
    base,
    api,
    login,
    addUser,
    setNow(value) {
      currentNow = value;
    },
    advance(ms) {
      currentNow += ms;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}

export const SLOT_TODAY = 'slot-2026-11-13-lunch';
export const SLOT_TOMORROW = 'slot-2026-11-14-lunch';
export const DISH = 'demo-dish-01';

export function orderBody(requestId, overrides = {}) {
  return {
    requestId,
    items: [{ dishId: DISH, quantity: 1 }],
    slotId: SLOT_TODAY,
    diningMode: 'DINE_IN',
    ...overrides,
  };
}