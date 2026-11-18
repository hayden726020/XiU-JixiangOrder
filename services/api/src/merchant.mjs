import { conflict, forbidden, notFound, validationError } from './errors.mjs';
import { readSetting } from './db.mjs';
import { runIdempotent, transaction } from './orders.mjs';
import { hashPassword } from './security.mjs';
import { parseAddOns, parseFlavorGroups, parseSides } from './customization.mjs';
import {
  asRecord,
  newId,
  requestHash,
  requireEnum,
  requireInteger,
  requireOnlyFields,
  requireString,
  toShanghaiIso,
} from './util.mjs';

const DISH_TYPES = ['STAPLE', 'SNACK', 'DRINK', 'SET'];
const PHONE_PATTERN = /^1\d{10}$/;


function maskPhone(phone) {
  if (typeof phone !== 'string' || phone.length !== 11) {
    return null;
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function normalizePhone(value) {
  const raw = requireString(value, 'contactPhone', { max: 30 });
  const normalized = raw.replace(/[\s-]/g, '');
  if (!PHONE_PATTERN.test(normalized)) {
    throw validationError('contactPhone 必须是 11 位大陆手机号。');
  }
  return normalized;
}

function optionalDescription(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw validationError('description 必须是字符串。');
  }
  const trimmed = value.trim();
  if (trimmed.length > 100) {
    throw validationError('description 长度不能超过 100。');
  }
  return trimmed.length === 0 ? null : trimmed;
}

function serializeMerchant(row) {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? null,
    contactPhone: maskPhone(row.contact_phone),
    status: row.status,
    createdAt: row.created_at ? toShanghaiIso(row.created_at) : null,
  };
}

function serializeShop(row) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    name: row.name,
    location: row.location,
    description: row.description ?? null,
    version: row.version,
  };
}

function loadMerchant(db, merchantId) {
  const merchant = db.prepare('SELECT * FROM merchants WHERE id = ?').get(merchantId);
  if (!merchant) {
    throw notFound('MERCHANT_NOT_FOUND', '商家资料不存在。');
  }
  return merchant;
}

function loadShop(db, merchantId) {
  return db.prepare('SELECT * FROM shops WHERE merchant_id = ?').get(merchantId) ?? null;
}


function parseAccount(value) {
  const account = requireString(value, 'account', { min: 4, max: 30 }).trim();
  if (!/^[A-Za-z0-9._-]{4,30}$/.test(account)) {
    throw validationError('account 只能包含字母、数字、点、下划线或横线，长度 4—30。');
  }
  return account;
}

function parsePassword(value) {
  const password = requireString(value, 'password', { min: 8, max: 64 });
  if (/\s/.test(password)) {
    throw validationError('password 不能包含空白字符。');
  }
  return password;
}

function merchantAccountView(userRow, merchantRow) {
  return {
    userId: userRow.id,
    account: userRow.account,
    password: userRow.password_plain ?? null,
    active: userRow.active === 1,
    merchantId: merchantRow?.id ?? null,
    merchantName: merchantRow?.name ?? null,
    contactName: merchantRow?.contact_name ?? null,
    contactPhone: maskPhone(merchantRow?.contact_phone),
    createdAt: merchantRow?.created_at ? toShanghaiIso(merchantRow.created_at) : null,
  };
}


function profiledData(db, merchantId) {
  const merchant = loadMerchant(db, merchantId);
  const shop = loadShop(db, merchant.id);
  const registered = typeof merchant.contact_phone === 'string' && merchant.contact_phone.length > 0;
  const onboardingStep = !registered
    ? 'UNREGISTERED'
    : shop
      ? 'SHOP_CREATED'
      : 'REGISTERED';
  return {
    merchant: serializeMerchant(merchant),
    shop: shop ? serializeShop(shop) : null,
    onboardingStep,
  };
}

export function listMerchants({ db, clock }) {
  const dining = readSetting(db, 'dining_config');
  const canteenId = dining?.value?.canteenId ?? null;
  const nowHm = toShanghaiIso(clock()).slice(11, 16);
  const rows = db
    .prepare('SELECT id, name, open_at, close_at, status FROM merchants ORDER BY rowid')
    .all();
  return {
    status: 200,
    body: {
      data: {
        merchants: rows.map((row, index) => ({
          merchantId: row.id,
          name: row.name,
          canteenId,
          orderable: row.status === 'ACTIVE' && nowHm >= row.open_at && nowHm < row.close_at,
          sortOrder: index + 1,
        })),
      },
    },
  };
}

export function getMerchantProfile({ db, user }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  if (!user.merchant_id) {
    return {
      status: 200,
      body: { data: { merchant: null, shop: null, onboardingStep: 'UNREGISTERED' } },
    };
  }
  return { status: 200, body: { data: profiledData(db, user.merchant_id) } };
}

export function registerMerchant({ db, clock, user, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'merchantName', 'contactName', 'contactPhone']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const merchantName = requireString(input.merchantName, 'merchantName', { min: 2, max: 30 });
  const contactName = requireString(input.contactName, 'contactName', { min: 2, max: 20 });
  const contactPhone = normalizePhone(input.contactPhone);
  const hash = requestHash(input);
  const now = clock();

  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: 'merchant-registration', requestId, hash, now },
      () => {
        const account = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
        let merchant = null;
        if (account.merchant_id) {
          merchant = loadMerchant(db, account.merchant_id);
          if (typeof merchant.contact_phone === 'string' && merchant.contact_phone.length > 0) {
            throw conflict('MERCHANT_ALREADY_REGISTERED', '该账号已完成商家注册，不能重复注册。');
          }
        }
        const taken = db
          .prepare('SELECT id FROM merchants WHERE contact_phone = ? AND id <> ?')
          .get(contactPhone, merchant?.id ?? '');
        if (taken) {
          throw conflict('CONTACT_PHONE_TAKEN', '该联系电话已被其他商家使用。');
        }
        if (!merchant) {
          const id = newId('m');
          db.prepare(
            `INSERT INTO merchants (id, name, open_at, close_at, contact_name, contact_phone, status, created_at)
             VALUES (?, ?, '08:00', '20:00', ?, ?, 'ACTIVE', ?)`,
          ).run(id, merchantName, contactName, contactPhone, now);
          db.prepare('UPDATE users SET merchant_id = ? WHERE id = ?').run(id, user.id);
          merchant = loadMerchant(db, id);
        } else {
          db.prepare(
            'UPDATE merchants SET name = ?, contact_name = ?, contact_phone = ?, status = ?, created_at = COALESCE(created_at, ?) WHERE id = ?',
          ).run(merchantName, contactName, contactPhone, 'ACTIVE', now, merchant.id);
          merchant = loadMerchant(db, merchant.id);
        }
        return {
          status: 201,
          body: { data: profiledData(db, merchant.id) },
        };
      },
    ),
  );
}

export function createShop({ db, clock, user, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'shopName', 'location', 'description']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const shopName = requireString(input.shopName, 'shopName', { min: 2, max: 30 });
  const location = requireString(input.location, 'location', { min: 2, max: 50 });
  const description = optionalDescription(input.description);
  const hash = requestHash(input);
  const now = clock();

  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: 'merchant-shop-create', requestId, hash, now },
      () => {
        if (!user.merchant_id) {
          throw conflict('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
        }
        const merchant = loadMerchant(db, user.merchant_id);
        if (loadShop(db, merchant.id)) {
          throw conflict('SHOP_ALREADY_EXISTS', '该商家已创建店铺，首版只支持一个店铺。');
        }

        const id = newId('s');
        db.prepare(
          `INSERT INTO shops (id, merchant_id, name, location, description, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(id, merchant.id, shopName, location, description, now, now);
        return {
          status: 201,
          body: { data: profiledData(db, merchant.id) },
        };
      },
    ),
  );
}






export function getMerchantAccount({ db, user }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const merchant = user.merchant_id
    ? db.prepare('SELECT * FROM merchants WHERE id = ?').get(user.merchant_id)
    : null;
  return { status: 200, body: { data: merchantAccountView(row, merchant) } };
}

export function createMerchantAccount({ db, clock, user, body }) {
  if (user.role !== 'ADMIN') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'account', 'password', 'merchantName', 'contactName', 'contactPhone']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const account = parseAccount(input.account);
  const password = parsePassword(input.password);
  const merchantName = requireString(input.merchantName, 'merchantName', { min: 2, max: 30 });
  const contactName = requireString(input.contactName, 'contactName', { min: 2, max: 20 });
  const contactPhone = normalizePhone(input.contactPhone);
  const hash = requestHash(input);
  const now = clock();
  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: 'create-merchant-account', requestId, hash, now },
      () => {
        if (db.prepare('SELECT id FROM users WHERE account = ?').get(account)) {
          throw conflict('ACCOUNT_TAKEN', '该账号已被使用。');
        }
        if (db.prepare('SELECT id FROM merchants WHERE contact_phone = ?').get(contactPhone)) {
          throw conflict('CONTACT_PHONE_TAKEN', '该联系电话已被其他商家使用。');
        }
        const merchantId = newId('m');
        const userId = newId('u');
        db.prepare(
          `INSERT INTO merchants (id, name, open_at, close_at, contact_name, contact_phone, status, created_at)
           VALUES (?, ?, '08:00', '20:00', ?, ?, 'ACTIVE', ?)`,
        ).run(merchantId, merchantName, contactName, contactPhone, now);
        db.prepare(
          `INSERT INTO users
             (id, account, password_stored, password_plain, display_name, role, merchant_id, active)
           VALUES (?, ?, ?, ?, ?, 'MERCHANT', ?, 1)`,
        ).run(userId, account, hashPassword(password), password, merchantName, merchantId);
        return {
          status: 201,
          body: {
            data: merchantAccountView(
              db.prepare('SELECT * FROM users WHERE id = ?').get(userId),
              db.prepare('SELECT * FROM merchants WHERE id = ?').get(merchantId),
            ),
          },
        };
      },
    ),
  );
}

export function listMerchantAccounts({ db }) {
  const rows = db
    .prepare(
      `SELECT u.id AS user_id, u.account, u.password_plain, u.active, u.merchant_id,
              m.name AS merchant_name, m.contact_name, m.contact_phone, m.created_at
       FROM users u
       LEFT JOIN merchants m ON m.id = u.merchant_id
       WHERE u.role = 'MERCHANT'
       ORDER BY u.rowid`,
    )
    .all();
  return {
    status: 200,
    body: {
      data: {
        accounts: rows.map((row) => ({
          userId: row.user_id,
          account: row.account,
          password: row.password_plain ?? null,
          active: row.active === 1,
          merchantId: row.merchant_id ?? null,
          merchantName: row.merchant_name ?? null,
          contactName: row.contact_name ?? null,
          contactPhone: maskPhone(row.contact_phone),
          createdAt: row.created_at ? toShanghaiIso(row.created_at) : null,
        })),
      },
    },
  };
}

export function updateMerchantAccount({ db, clock, user, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  if (!user.merchant_id) {
    throw conflict('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'account', 'password', 'contactName', 'contactPhone']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const account = input.account === undefined ? null : parseAccount(input.account);
  const password = input.password === undefined ? null : parsePassword(input.password);
  const contactName = input.contactName === undefined
    ? null
    : requireString(input.contactName, 'contactName', { min: 2, max: 20 });
  const contactPhone = input.contactPhone === undefined ? null : normalizePhone(input.contactPhone);
  if (account === null && password === null && contactName === null && contactPhone === null) {
    throw validationError('至少修改一项账号信息。');
  }
  const hash = requestHash(input);
  const now = clock();
  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: 'update-merchant-account', requestId, hash, now },
      () => {
        if (account) {
          const taken = db
            .prepare('SELECT id FROM users WHERE account = ? AND id <> ?')
            .get(account, user.id);
          if (taken) {
            throw conflict('ACCOUNT_TAKEN', '该账号已被使用。');
          }
        }
        if (contactPhone) {
          const taken = db
            .prepare('SELECT id FROM merchants WHERE contact_phone = ? AND id <> ?')
            .get(contactPhone, user.merchant_id);
          if (taken) {
            throw conflict('CONTACT_PHONE_TAKEN', '该联系电话已被其他商家使用。');
          }
        }
        db.prepare(
          `UPDATE users SET
             account = COALESCE(?, account),
             password_stored = COALESCE(?, password_stored),
             password_plain = COALESCE(?, password_plain)
           WHERE id = ?`,
        ).run(account, password ? hashPassword(password) : null, password, user.id);
        db.prepare(
          `UPDATE merchants SET
             contact_name = COALESCE(?, contact_name),
             contact_phone = COALESCE(?, contact_phone)
           WHERE id = ?`,
        ).run(contactName, contactPhone, user.merchant_id);
        return {
          status: 200,
          body: {
            data: merchantAccountView(
              db.prepare('SELECT * FROM users WHERE id = ?').get(user.id),
              db.prepare('SELECT * FROM merchants WHERE id = ?').get(user.merchant_id),
            ),
          },
        };
      },
    ),
  );
}

export function createDish({ db, clock, user, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'type', 'name', 'priceFen', 'availableQuantity', 'onSale', 'flavorGroups', 'sides', 'addOns']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const type = requireEnum(input.type, 'type', DISH_TYPES);
  const name = requireString(input.name, 'name', { min: 1, max: 30 });
  const priceFen = requireInteger(input.priceFen, 'priceFen', { min: 1, max: 1_000_000 });
  const availableQuantity = requireInteger(input.availableQuantity, 'availableQuantity', { min: 0, max: 10_000 });
  if (input.onSale !== undefined && typeof input.onSale !== 'boolean') {
    throw validationError('onSale 必须是布尔值。');
  }
  const onSale = input.onSale ?? true;
  const flavorGroups = input.flavorGroups !== undefined ? parseFlavorGroups(input.flavorGroups) : [];
  const sides = input.sides !== undefined ? parseSides(input.sides) : [];
  const addOns = input.addOns !== undefined ? parseAddOns(input.addOns) : [];
  const hash = requestHash(input);
  const now = clock();

  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: 'merchant-dish-create', requestId, hash, now },
      () => {
        if (!user.merchant_id) {
          throw conflict('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
        }
        const merchant = loadMerchant(db, user.merchant_id);
        const duplicate = db
          .prepare('SELECT id FROM dishes WHERE merchant_id = ? AND name = ?')
          .get(merchant.id, name);
        if (duplicate) {
          throw conflict('DISH_NAME_DUPLICATE', '同店菜品名称不能重复。');
        }
        const id = newId('dish');
        db.prepare(
          `INSERT INTO dishes (id, merchant_id, type, name, price_fen, available_quantity, on_sale, version,
             flavor_groups_json, sides_json, add_ons_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        ).run(
          id,
          merchant.id,
          type,
          name,
          priceFen,
          availableQuantity,
          onSale ? 1 : 0,
          JSON.stringify(flavorGroups),
          JSON.stringify(sides),
          JSON.stringify(addOns),
        );
        return {
          status: 201,
          body: {
            data: {
              id,
              merchantId: merchant.id,
              type,
              name,
              priceFen,
              availableQuantity,
              onSale,
              version: 1,
              flavorGroups,
              sides,
              addOns,
            },
          },
        };
      },
    ),
  );
}