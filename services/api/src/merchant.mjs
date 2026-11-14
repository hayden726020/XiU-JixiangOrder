import { conflict, forbidden, notFound, validationError } from './errors.mjs';
import { runIdempotent, transaction } from './orders.mjs';
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

function profiledData(db, merchantId) {
  const merchant = loadMerchant(db, merchantId);
  const shop = loadShop(db, merchant.id);
  const registered = typeof merchant.contact_phone === 'string' && merchant.contact_phone.length > 0;
  return {
    merchant: serializeMerchant(merchant),
    shop: shop ? serializeShop(shop) : null,
    onboardingStep: !registered ? 'UNREGISTERED' : shop ? 'SHOP_CREATED' : 'REGISTERED',
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

export function createDish({ db, clock, user, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'type', 'name', 'priceFen', 'availableQuantity', 'onSale']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const type = requireEnum(input.type, 'type', DISH_TYPES);
  const name = requireString(input.name, 'name', { min: 1, max: 30 });
  const priceFen = requireInteger(input.priceFen, 'priceFen', { min: 1, max: 1_000_000 });
  const availableQuantity = requireInteger(input.availableQuantity, 'availableQuantity', { min: 0, max: 10_000 });
  if (input.onSale !== undefined && typeof input.onSale !== 'boolean') {
    throw validationError('onSale 必须是布尔值。');
  }
  const onSale = input.onSale ?? true;
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
          `INSERT INTO dishes (id, merchant_id, type, name, price_fen, available_quantity, on_sale, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        ).run(id, merchant.id, type, name, priceFen, availableQuantity, onSale ? 1 : 0);
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
            },
          },
        };
      },
    ),
  );
}