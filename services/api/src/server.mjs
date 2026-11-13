import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { DEMO_USERS, createDatabase, seedDemoData } from './db.mjs';
import { createApp } from './app.mjs';

const runtimeDir = process.env.RUNTIME_DIR ?? path.join(import.meta.dirname, '..', '.runtime');
const accountFile = path.join(runtimeDir, 'demo-accounts.json');
const dbPath = process.env.DB_PATH ?? path.join(runtimeDir, 'orders.sqlite');
const host = process.env.HOST ?? '0.0.0.0';
const port = Number.parseInt(process.env.PORT ?? '8787', 10);

function readStoredAccounts() {
  if (!existsSync(accountFile)) {
    return {};
  }
  try {
    const parsed = JSON.parse(readFileSync(accountFile, 'utf8'));
    return parsed && typeof parsed === 'object' && parsed.accounts ? parsed.accounts : parsed;
  } catch {
    return {};
  }
}

function resolveDemoPasswords() {
  const stored = readStoredAccounts();
  const fromEnv = {
    'demo-student': process.env.DEMO_STUDENT_PASSWORD,
    'demo-merchant': process.env.DEMO_MERCHANT_PASSWORD,
    'demo-admin': process.env.DEMO_ADMIN_PASSWORD,
  };
  const accounts = {};
  let generated = false;
  for (const user of DEMO_USERS) {
    const envPassword = fromEnv[user.account];
    if (typeof envPassword === 'string' && envPassword.length >= 8) {
      accounts[user.account] = envPassword;
      continue;
    }
    if (typeof stored[user.account] === 'string' && stored[user.account].length >= 8) {
      accounts[user.account] = stored[user.account];
      continue;
    }
    accounts[user.account] = randomBytes(9).toString('base64url');
    generated = true;
  }
  if (generated) {
    writeFileSync(
      accountFile,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), accounts }, null, 2)}\n`,
      { mode: 0o600 },
    );
  }
  return accounts;
}

function localAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

mkdirSync(runtimeDir, { recursive: true });
if (dbPath !== ':memory:') {
  mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = createDatabase(dbPath);
const clock = () => Date.now();
const passwords = resolveDemoPasswords();
seedDemoData(db, { now: clock(), passwords });

const logger = (entry) => {
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      method: entry.method,
      path: entry.pathname,
      status: entry.status,
      durationMs: entry.durationMs,
    }),
  );
};

const { handler } = createApp({ db, clock, logger });
const server = http.createServer(handler);

server.on('error', (error) => {
  console.error(`启动失败：${error.message}`);
  db.close();
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log('吉祥点餐演示 API 已启动');
  console.log(`  本机:   http://127.0.0.1:${port}/api/v1/health`);
  for (const address of localAddresses()) {
    console.log(`  局域网: http://${address}:${port}/api/v1`);
  }
  console.log(`  数据库: ${dbPath === ':memory:' ? '内存（重启清空）' : dbPath}`);
  console.log(`  演示账号: ${accountFile}（线下交付，不写入 Git 或 team-context）`);
  console.log('  演示账号密码不会在日志中输出。');
});

function shutdown(signal) {
  console.log(`收到 ${signal}，正在关闭服务…`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));