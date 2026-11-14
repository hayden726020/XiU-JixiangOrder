import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './security.mjs';
import { addDays, shanghaiDate, toShanghaiIso } from './util.mjs';

export const DEMO_USERS = [
  {
    id: 'demo-user-student-01',
    account: 'demo-student',
    displayName: '演示学生',
    role: 'STUDENT',
    studentId: 'demo-student-01',
  },
  {
    id: 'demo-user-merchant-01',
    account: 'demo-merchant',
    displayName: '演示档口',
    role: 'MERCHANT',
    merchantId: 'demo-merchant-01',
  },
  {
    id: 'demo-user-admin-01',
    account: 'demo-admin',
    displayName: '演示管理员',
    role: 'ADMIN',
  },
];

export const DEMO_MERCHANTS = [
  { id: 'demo-merchant-01', name: '一食堂·家常档', openAt: '08:00', closeAt: '20:00' },
  { id: 'demo-merchant-02', name: '一食堂·面档', openAt: '08:00', closeAt: '20:00' },
];

export const DEMO_DISHES = [
  { id: 'demo-dish-01', merchantId: 'demo-merchant-01', type: 'STAPLE', name: '演示鸡肉饭', priceFen: 1800, quantity: 20 },
  { id: 'demo-dish-02', merchantId: 'demo-merchant-02', type: 'STAPLE', name: '演示素面', priceFen: 1200, quantity: 15 },
  { id: 'demo-dish-03', merchantId: 'demo-merchant-01', type: 'SET', name: '演示套餐', priceFen: 2200, quantity: 8 },
];

// 契约 2026-11-13 冻结：午餐固定 3 个时段，12:30—13:00 样例为已满。
const SLOT_TEMPLATES = [
  { key: 'lunch', start: '11:30', end: '12:00', capacity: 20 },
  { key: 'lunch-2', start: '12:00', end: '12:30', capacity: 20 },
  { key: 'lunch-3', start: '12:30', end: '13:00', capacity: 20, demoFull: true },
];

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  account TEXT NOT NULL UNIQUE,
  password_stored TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('STUDENT', 'MERCHANT', 'ADMIN')),
  student_id TEXT,
  merchant_id TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  open_at TEXT NOT NULL,
  close_at TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL UNIQUE REFERENCES merchants(id),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dishes (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  type TEXT NOT NULL DEFAULT 'STAPLE' CHECK (type IN ('STAPLE', 'SNACK', 'DRINK', 'SET')),
  name TEXT NOT NULL,
  price_fen INTEGER NOT NULL CHECK (price_fen >= 0),
  available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
  on_sale INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  enabled INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  slot_id TEXT NOT NULL REFERENCES slots(id),
  dining_mode TEXT NOT NULL CHECK (dining_mode IN ('DINE_IN', 'TAKEAWAY')),
  dining_mode_reason TEXT,
  total_fen INTEGER NOT NULL,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  version INTEGER NOT NULL,
  pickup_code TEXT,
  picked_up_at INTEGER,
  cancellation_reason TEXT,
  cancel_status TEXT NOT NULL DEFAULT 'NONE',
  cancel_reason TEXT,
  cancel_decision_reason TEXT,
  delay_reason TEXT,
  delay_expected_ready_at TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id TEXT NOT NULL REFERENCES orders(id),
  dish_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_fen INTEGER NOT NULL,
  merchant_id TEXT NOT NULL,
  PRIMARY KEY (order_id, dish_id)
);

CREATE TABLE IF NOT EXISTS request_log (
  actor_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (actor_id, operation, request_id)
);

CREATE TABLE IF NOT EXISTS locations (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  presence TEXT NOT NULL CHECK (presence IN ('INSIDE', 'OUTSIDE', 'UNKNOWN')),
  observed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_student ON orders(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_slot ON orders(slot_id, status);
`;

export function createDatabase(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  const orderColumns = db.prepare('PRAGMA table_info(orders)').all();
  if (!orderColumns.some((column) => column.name === 'dining_mode_reason')) {
    db.exec('ALTER TABLE orders ADD COLUMN dining_mode_reason TEXT;');
  }
  if (!orderColumns.some((column) => column.name === 'cancel_decision_reason')) {
    db.exec('ALTER TABLE orders ADD COLUMN cancel_decision_reason TEXT;');
  }
  const merchantColumns = db.prepare('PRAGMA table_info(merchants)').all();
  if (!merchantColumns.some((column) => column.name === 'contact_name')) {
    db.exec('ALTER TABLE merchants ADD COLUMN contact_name TEXT;');
  }
  if (!merchantColumns.some((column) => column.name === 'contact_phone')) {
    db.exec('ALTER TABLE merchants ADD COLUMN contact_phone TEXT;');
  }
  if (!merchantColumns.some((column) => column.name === 'status')) {
    db.exec("ALTER TABLE merchants ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';");
  }
  if (!merchantColumns.some((column) => column.name === 'created_at')) {
    db.exec('ALTER TABLE merchants ADD COLUMN created_at INTEGER;');
  }
  const dishColumns = db.prepare('PRAGMA table_info(dishes)').all();
  if (!dishColumns.some((column) => column.name === 'type')) {
    db.exec("ALTER TABLE dishes ADD COLUMN type TEXT NOT NULL DEFAULT 'STAPLE';");
  }
  return db;
}

export function buildDemoSlots(now) {
  const today = shanghaiDate(now);
  const dates = [today, addDays(today, 1)];
  const slots = [];
  for (const date of dates) {
    for (const template of SLOT_TEMPLATES) {
      const id = template.key === 'lunch' ? `slot-${date}-lunch` : `slot-${date}-${template.key}`;
      slots.push({
        id,
        date,
        startAt: Date.parse(`${date}T${template.start}:00+08:00`),
        endAt: Date.parse(`${date}T${template.end}:00+08:00`),
        capacity: template.capacity,
        bookedCount: template.demoFull ? template.capacity : 0,
      });
    }
  }
  return slots;
}

export function seedDemoData(db, { now, passwords }) {
  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users
     (id, account, password_stored, display_name, role, student_id, merchant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const user of DEMO_USERS) {
    const password = passwords?.[user.account];
    if (typeof password !== 'string' || password.length < 8) {
      throw new Error(`缺少演示账号 ${user.account} 的密码（至少 8 位）。`);
    }
    insertUser.run(
      user.id,
      user.account,
      hashPassword(password),
      user.displayName,
      user.role,
      user.studentId ?? null,
      user.merchantId ?? null,
    );
  }

  const insertMerchant = db.prepare(
    'INSERT OR IGNORE INTO merchants (id, name, open_at, close_at) VALUES (?, ?, ?, ?)',
  );
  for (const merchant of DEMO_MERCHANTS) {
    insertMerchant.run(merchant.id, merchant.name, merchant.openAt, merchant.closeAt);
  }

  const insertDish = db.prepare(
    `INSERT OR IGNORE INTO dishes
     (id, merchant_id, type, name, price_fen, available_quantity, on_sale, version)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
  );
  for (const dish of DEMO_DISHES) {
    insertDish.run(dish.id, dish.merchantId, dish.type, dish.name, dish.priceFen, dish.quantity);
  }

  const insertSlot = db.prepare(
    `INSERT OR IGNORE INTO slots (id, date, start_at, end_at, capacity, booked_count, enabled, version)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
  );
  for (const slot of buildDemoSlots(now)) {
    insertSlot.run(slot.id, slot.date, slot.startAt, slot.endAt, slot.capacity, slot.bookedCount);
  }

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value_json, version, updated_at) VALUES (?, ?, 1, ?)',
  );
  insertSetting.run(
    'dining_config',
    JSON.stringify({
      canteenId: 'demo-canteen-01',
      name: '演示食堂',
      center: { latitude: 30, longitude: 120 },
      radiusMeters: 150,
      accuracyToleranceMeters: 60,
      updatedAt: toShanghaiIso(now),
      demo: true,
    }),
    now,
  );
  insertSetting.run(
    'crowd_thresholds',
    JSON.stringify({ crowdedAt: 10, demo: true }),
    now,
  );
}

export function readSetting(db, key) {
  const row = db.prepare('SELECT value_json, version, updated_at FROM settings WHERE key = ?').get(key);
  if (!row) {
    return null;
  }
  return {
    value: JSON.parse(row.value_json),
    version: row.version,
    updatedAt: row.updated_at,
  };
}

export function writeSetting(db, key, value, expectedVersion, now) {
  const current = db.prepare('SELECT version FROM settings WHERE key = ?').get(key);
  if (!current) {
    db.prepare('INSERT INTO settings (key, value_json, version, updated_at) VALUES (?, ?, 1, ?)').run(
      key,
      JSON.stringify(value),
      now,
    );
    return 1;
  }
  if (current.version !== expectedVersion) {
    return null;
  }
  db.prepare('UPDATE settings SET value_json = ?, version = version + 1, updated_at = ? WHERE key = ? AND version = ?').run(
    JSON.stringify(value),
    now,
    key,
    expectedVersion,
  );
  return expectedVersion + 1;
}