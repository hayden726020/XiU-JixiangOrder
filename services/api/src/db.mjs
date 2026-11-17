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
  { id: 'demo-merchant-01', name: '一食堂·家常档', openAt: '08:00', closeAt: '22:00' },
  { id: 'demo-merchant-02', name: '一食堂·面档', openAt: '08:00', closeAt: '22:00' },
];

export const DEMO_DISHES = [
  { id: 'demo-dish-01', merchantId: 'demo-merchant-01', type: 'STAPLE', name: '演示鸡肉饭', priceFen: 1800, quantity: 20 },
  { id: 'demo-dish-02', merchantId: 'demo-merchant-02', type: 'STAPLE', name: '演示素面', priceFen: 1200, quantity: 15 },
  { id: 'demo-dish-03', merchantId: 'demo-merchant-01', type: 'SET', name: '演示套餐', priceFen: 2200, quantity: 8 },
];

export const SLOT_DATE_RANGE_DAYS = 7;
export const SLOT_DAY_START_HOUR = 8;
export const SLOT_DAY_END_HOUR = 22;
const SLOT_STEP_MINUTES = 30;

function pad2(value) {
  return String(value).padStart(2, '0');
}

function buildSlotTemplates() {
  const templates = [];
  for (let hour = SLOT_DAY_START_HOUR; hour < SLOT_DAY_END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_STEP_MINUTES) {
      const endTotal = hour * 60 + minute + SLOT_STEP_MINUTES;
      const start = `${pad2(hour)}:${pad2(minute)}`;
      const end = `${pad2(Math.floor(endTotal / 60))}:${pad2(endTotal % 60)}`;
      if (start === '11:30') {
        templates.push({ key: 'lunch', start, end, capacity: 20 });
      } else if (start === '12:00') {
        templates.push({ key: 'lunch-2', start, end, capacity: 20 });
      } else if (start === '12:30') {
        templates.push({ key: 'lunch-3', start, end, capacity: 20, demoFull: true });
      } else {
        templates.push({ key: `${pad2(hour)}${pad2(minute)}`, start, end, capacity: 30 });
      }
    }
  }
  return templates;
}

const SLOT_TEMPLATES = buildSlotTemplates();

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
  owner_user_id TEXT REFERENCES users(id),
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
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  owner_user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  open_at TEXT NOT NULL DEFAULT '08:00',
  close_at TEXT NOT NULL DEFAULT '22:00',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dishes (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  shop_id TEXT,
  type TEXT NOT NULL DEFAULT 'STAPLE' CHECK (type IN ('STAPLE', 'SNACK', 'DRINK', 'SET')),
  name TEXT NOT NULL,
  price_fen INTEGER NOT NULL CHECK (price_fen >= 0),
  available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
  on_sale INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  flavor_groups_json TEXT NOT NULL DEFAULT '[]',
  sides_json TEXT NOT NULL DEFAULT '[]',
  add_ons_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS daily_menu_days (
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  date TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (merchant_id, date)
);

CREATE TABLE IF NOT EXISTS daily_menu_items (
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  date TEXT NOT NULL,
  dish_id TEXT NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
  PRIMARY KEY (merchant_id, date, dish_id)
);

CREATE TABLE IF NOT EXISTS uploaded_images (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  owner_user_id TEXT,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  data_blob BLOB NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_entries (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  owner_user_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'withdraw')),
  order_id TEXT UNIQUE,
  label TEXT NOT NULL,
  amount_fen INTEGER NOT NULL CHECK (amount_fen > 0),
  created_at INTEGER NOT NULL
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
  shop_id TEXT,
  merchant_name TEXT,
  slot_id TEXT NOT NULL REFERENCES slots(id),
  dining_mode TEXT NOT NULL CHECK (dining_mode IN ('DINE_IN', 'TAKEAWAY')),
  dining_mode_reason TEXT,
  remark TEXT,
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
  item_index INTEGER NOT NULL DEFAULT 0,
  dish_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_fen INTEGER NOT NULL,
  merchant_id TEXT NOT NULL,
  customization_json TEXT,
  PRIMARY KEY (order_id, item_index)
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
CREATE INDEX IF NOT EXISTS idx_users_account_nocase ON users(account COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_dishes_merchant ON dishes(merchant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_merchant ON wallet_entries(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_owner ON wallet_entries(owner_user_id, created_at DESC);
`;

function migrateShopsTable(db) {
  const shopColumns = db.prepare('PRAGMA table_info(shops)').all();
  const tableRow = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'shops'").get();
  const hasUniqueMerchant = typeof tableRow?.sql === 'string' && /merchant_id[^,]*UNIQUE/i.test(tableRow.sql);
  const needsColumns =
    !shopColumns.some((column) => column.name === 'owner_user_id') ||
    !shopColumns.some((column) => column.name === 'open_at') ||
    !shopColumns.some((column) => column.name === 'close_at') ||
    !shopColumns.some((column) => column.name === 'status');
  if (!hasUniqueMerchant && !needsColumns) {
    return;
  }
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec(`
      CREATE TABLE shops_new (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL REFERENCES merchants(id),
        owner_user_id TEXT REFERENCES users(id),
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT,
        open_at TEXT NOT NULL DEFAULT '08:00',
        close_at TEXT NOT NULL DEFAULT '22:00',
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
        version INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO shops_new (id, merchant_id, owner_user_id, name, location, description, open_at, close_at, status, version, created_at, updated_at)
      SELECT
        s.id,
        s.merchant_id,
        m.owner_user_id,
        s.name,
        s.location,
        s.description,
        COALESCE(m.open_at, '08:00'),
        COALESCE(m.close_at, '22:00'),
        COALESCE(m.status, 'ACTIVE'),
        s.version,
        s.created_at,
        s.updated_at
      FROM shops s
      LEFT JOIN merchants m ON m.id = s.merchant_id;
      DROP TABLE shops;
      ALTER TABLE shops_new RENAME TO shops;
    `);
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore rollback error
    }
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}

function migrateOrderItemsTable(db) {
  const columns = db.prepare('PRAGMA table_info(order_items)').all();
  if (columns.some((column) => column.name === 'item_index') && columns.some((column) => column.name === 'customization_json')) {
    return;
  }
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.exec(`
      CREATE TABLE order_items_new (
        order_id TEXT NOT NULL REFERENCES orders(id),
        item_index INTEGER NOT NULL DEFAULT 0,
        dish_id TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price_fen INTEGER NOT NULL,
        merchant_id TEXT NOT NULL,
        customization_json TEXT,
        PRIMARY KEY (order_id, item_index)
      );
      INSERT INTO order_items_new (order_id, item_index, dish_id, name, quantity, unit_price_fen, merchant_id, customization_json)
      SELECT
        order_id,
        ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY rowid) - 1,
        dish_id,
        name,
        quantity,
        unit_price_fen,
        merchant_id,
        NULL
      FROM order_items;
      DROP TABLE order_items;
      ALTER TABLE order_items_new RENAME TO order_items;
    `);
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore rollback error
    }
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}

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
  if (!orderColumns.some((column) => column.name === 'merchant_name')) {
    db.exec('ALTER TABLE orders ADD COLUMN merchant_name TEXT;');
  }
  if (!orderColumns.some((column) => column.name === 'remark')) {
    db.exec('ALTER TABLE orders ADD COLUMN remark TEXT;');
  }
  if (!orderColumns.some((column) => column.name === 'shop_id')) {
    db.exec('ALTER TABLE orders ADD COLUMN shop_id TEXT;');
  }
  const merchantColumns = db.prepare('PRAGMA table_info(merchants)').all();
  if (!merchantColumns.some((column) => column.name === 'owner_user_id')) {
    db.exec('ALTER TABLE merchants ADD COLUMN owner_user_id TEXT;');
  }
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
  db.exec(`
    UPDATE merchants
    SET owner_user_id = (SELECT u.id FROM users u WHERE u.merchant_id = merchants.id LIMIT 1)
    WHERE owner_user_id IS NULL;
  `);
  migrateShopsTable(db);
  db.exec('CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_user_id, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_shops_merchant ON shops(merchant_id);');
  migrateOrderItemsTable(db);

  const dishColumns = db.prepare('PRAGMA table_info(dishes)').all();
  if (!dishColumns.some((column) => column.name === 'type')) {
    db.exec("ALTER TABLE dishes ADD COLUMN type TEXT NOT NULL DEFAULT 'STAPLE';");
  }
  if (!dishColumns.some((column) => column.name === 'shop_id')) {
    db.exec('ALTER TABLE dishes ADD COLUMN shop_id TEXT;');
  }
  if (!dishColumns.some((column) => column.name === 'image_url')) {
    db.exec('ALTER TABLE dishes ADD COLUMN image_url TEXT;');
  }
  if (!dishColumns.some((column) => column.name === 'flavor_groups_json')) {
    db.exec("ALTER TABLE dishes ADD COLUMN flavor_groups_json TEXT NOT NULL DEFAULT '[]';");
  }
  if (!dishColumns.some((column) => column.name === 'sides_json')) {
    db.exec("ALTER TABLE dishes ADD COLUMN sides_json TEXT NOT NULL DEFAULT '[]';");
  }
  if (!dishColumns.some((column) => column.name === 'add_ons_json')) {
    db.exec("ALTER TABLE dishes ADD COLUMN add_ons_json TEXT NOT NULL DEFAULT '[]';");
  }
  return db;
}

export function buildSlotsForDate(date) {
  return SLOT_TEMPLATES.map((template) => {
    const id = template.key === 'lunch' ? `slot-${date}-lunch` : `slot-${date}-${template.key}`;
    return {
      id,
      date,
      startAt: Date.parse(`${date}T${template.start}:00+08:00`),
      endAt: Date.parse(`${date}T${template.end}:00+08:00`),
      capacity: template.capacity,
      bookedCount: template.demoFull ? template.capacity : 0,
    };
  });
}

export function ensureDateSlots(db, date) {
  const insertSlot = db.prepare(
    `INSERT OR IGNORE INTO slots (id, date, start_at, end_at, capacity, booked_count, enabled, version)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
  );
  for (const slot of buildSlotsForDate(date)) {
    insertSlot.run(slot.id, slot.date, slot.startAt, slot.endAt, slot.capacity, slot.bookedCount);
  }
}

export function buildDemoSlots(now) {
  const today = shanghaiDate(now);
  const dates = Array.from({ length: SLOT_DATE_RANGE_DAYS }, (_, index) => addDays(today, index));
  const slots = [];
  for (const date of dates) {
    slots.push(...buildSlotsForDate(date));
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
  const updateDemoHours = db.prepare(
    "UPDATE merchants SET close_at = ? WHERE id = ? AND close_at = '20:00'",
  );
  for (const merchant of DEMO_MERCHANTS) {
    insertMerchant.run(merchant.id, merchant.name, merchant.openAt, merchant.closeAt);
    updateDemoHours.run(merchant.closeAt, merchant.id);
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
