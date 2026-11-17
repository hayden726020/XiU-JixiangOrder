import { conflict, forbidden, notFound, validationError } from './errors.mjs';
import { DEMO_MERCHANTS, SLOT_DATE_RANGE_DAYS, ensureDateSlots, readSetting } from './db.mjs';
import {
  parseAddOns,
  parseFlavorGroups,
  parseSides,
  resolveDishImageUrl,
  serializeDish,
} from './dish-customization.mjs';
import { runIdempotent, transaction } from './tx.mjs';
import {
  addDays,
  asRecord,
  newId,
  requestHash,
  requireEnum,
  requireInteger,
  requireOnlyFields,
  requireString,
  shanghaiDate,
  toShanghaiIso,
} from './util.mjs';

const DISH_TYPES = ['STAPLE', 'SNACK', 'DRINK', 'SET'];
const PHONE_PATTERN = /^1\d{10}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const CLOSE_TIME_PATTERN = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEMO_MERCHANT_IDS = new Set(DEMO_MERCHANTS.map((m) => m.id));

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

function validateBusinessHours(openAt, closeAt) {
  if (typeof openAt !== 'string' || !TIME_PATTERN.test(openAt)) {
    throw validationError('openAt 必须是 HH:MM 格式（00:00—23:59）。');
  }
  if (typeof closeAt !== 'string' || !CLOSE_TIME_PATTERN.test(closeAt)) {
    throw validationError('closeAt 必须是 HH:MM 格式（00:00—24:00）。');
  }
  if (openAt >= closeAt) {
    throw validationError('closeAt 必须晚于 openAt。');
  }
  return { openAt, closeAt };
}

function serializeMerchant(row) {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? null,
    contactPhone: maskPhone(row.contact_phone),
    openAt: row.open_at ?? '08:00',
    closeAt: row.close_at ?? '22:00',
    active: row.status === 'ACTIVE',
    status: row.status,
    createdAt: row.created_at ? toShanghaiIso(row.created_at) : null,
  };
}

function serializeShop(row) {
  const status = row.status ?? 'ACTIVE';
  return {
    id: row.id,
    merchantId: row.merchant_id,
    name: row.name,
    location: row.location,
    description: row.description ?? null,
    openAt: row.open_at ?? '08:00',
    closeAt: row.close_at ?? '22:00',
    active: status === 'ACTIVE',
    status,
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

function isMerchantRegistered(merchant) {
  return Boolean(merchant) && typeof merchant.contact_phone === 'string' && merchant.contact_phone.length > 0;
}

export function getOwnedMerchantIds(db, user) {
  const rows = db
    .prepare('SELECT id FROM merchants WHERE id = ? OR owner_user_id = ? ORDER BY rowid ASC')
    .all(user.merchant_id ?? '', user.id);
  const ids = new Set(rows.map((row) => row.id));
  if (user.merchant_id) {
    ids.add(user.merchant_id);
  }
  return [...ids];
}

export function getOwnedShops(db, user) {
  return db
    .prepare(
      `SELECT * FROM shops
       WHERE owner_user_id = ?
          OR merchant_id = ?
          OR merchant_id IN (SELECT id FROM merchants WHERE owner_user_id = ?)
       ORDER BY created_at ASC, rowid ASC`,
    )
    .all(user.id, user.merchant_id ?? '', user.id);
}

export function resolveOwnedShop(db, user, shopId = null) {
  const ownedShops = getOwnedShops(db, user);
  if (shopId !== null && shopId !== undefined) {
    const found = ownedShops.find((shop) => shop.id === shopId);
    if (!found) {
      throw notFound('SHOP_NOT_FOUND', '店铺不存在或不属于当前商家。');
    }
    return found;
  }
  const byActiveMerchant = ownedShops.find((shop) => shop.merchant_id === user.merchant_id);
  const resolved = byActiveMerchant ?? ownedShops[0] ?? null;
  if (!resolved) {
    throw notFound('SHOP_NOT_FOUND', '尚未创建店铺。');
  }
  return resolved;
}

function profiledData(db, merchantId, user = null, preferredShopId = null) {
  const merchant = loadMerchant(db, merchantId);
  const shops = user
    ? getOwnedShops(db, { ...user, merchant_id: user.merchant_id ?? merchantId })
    : db.prepare('SELECT * FROM shops WHERE merchant_id = ? ORDER BY created_at ASC, rowid ASC').all(merchant.id);
  const activeShop =
    (preferredShopId ? shops.find((s) => s.id === preferredShopId) : null) ??
    shops.find((s) => s.merchant_id === merchant.id) ??
    shops[0] ??
    null;
  const registered = isMerchantRegistered(merchant);
  return {
    merchant: serializeMerchant(merchant),
    shop: activeShop ? serializeShop(activeShop) : null,
    shops: shops.map(serializeShop),
    activeShopId: activeShop?.id ?? null,
    activeMerchantId: merchant.id,
    onboardingStep: !registered ? 'UNREGISTERED' : shops.length > 0 ? 'SHOP_CREATED' : 'REGISTERED',
  };
}

export function listMerchants({ db, clock }) {
  const dining = readSetting(db, 'dining_config');
  const canteenId = dining?.value?.canteenId ?? null;
  const nowHm = toShanghaiIso(clock()).slice(11, 16);

  const merchantRows = db
    .prepare('SELECT id, name, open_at, close_at, status FROM merchants ORDER BY rowid')
    .all();
  const shopRows = db
    .prepare('SELECT * FROM shops ORDER BY created_at ASC, rowid ASC')
    .all();
  const shopByMerchant = new Map();
  for (const shop of shopRows) {
    if (!shopByMerchant.has(shop.merchant_id)) {
      shopByMerchant.set(shop.merchant_id, shop);
    }
  }

  const entries = [];
  const seenMerchantIds = new Set();

  for (const row of merchantRows) {
    if (!DEMO_MERCHANT_IDS.has(row.id)) {
      continue;
    }
    const shop = shopByMerchant.get(row.id) ?? null;
    const openAt = shop?.open_at ?? row.open_at ?? '08:00';
    const closeAt = shop?.close_at ?? row.close_at ?? '22:00';
    const active = (shop?.status ?? row.status) === 'ACTIVE';
    entries.push({
      merchantId: row.id,
      shopId: shop?.id ?? null,
      name: shop?.name ?? row.name,
      location: shop?.location ?? null,
      description: shop?.description ?? null,
      canteenId,
      openAt,
      closeAt,
      active,
      orderable: active && nowHm >= openAt && nowHm < closeAt,
    });
    seenMerchantIds.add(row.id);
  }

  for (const shop of shopRows) {
    if (seenMerchantIds.has(shop.merchant_id)) {
      continue;
    }
    const openAt = shop.open_at ?? '08:00';
    const closeAt = shop.close_at ?? '22:00';
    const active = (shop.status ?? 'ACTIVE') === 'ACTIVE';
    entries.push({
      merchantId: shop.merchant_id,
      shopId: shop.id,
      name: shop.name,
      location: shop.location,
      description: shop.description ?? null,
      canteenId,
      openAt,
      closeAt,
      active,
      orderable: active && nowHm >= openAt && nowHm < closeAt,
    });
  }

  return {
    status: 200,
    body: {
      data: {
        merchants: entries.map((item, index) => ({
          ...item,
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
      body: {
        data: {
          merchant: null,
          shop: null,
          shops: [],
          activeShopId: null,
          activeMerchantId: null,
          onboardingStep: 'UNREGISTERED',
        },
      },
    };
  }
  return { status: 200, body: { data: profiledData(db, user.merchant_id, user) } };
}

export function registerMerchant({ db, clock, user, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'merchantName', 'contactName', 'contactPhone', 'openAt', 'closeAt']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const merchantName = requireString(input.merchantName, 'merchantName', { min: 2, max: 30 });
  const contactName = requireString(input.contactName, 'contactName', { min: 2, max: 20 });
  const contactPhone = normalizePhone(input.contactPhone);
  const hours =
    input.openAt !== undefined || input.closeAt !== undefined
      ? validateBusinessHours(input.openAt ?? '08:00', input.closeAt ?? '22:00')
      : { openAt: '08:00', closeAt: '22:00' };
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
          if (isMerchantRegistered(merchant)) {
            throw conflict('MERCHANT_ALREADY_REGISTERED', '该账号已完成商家注册，不能重复注册。');
          }
        }
        const taken = db
          .prepare(
            `SELECT id FROM merchants
             WHERE contact_phone = ?
               AND id <> ?
               AND COALESCE(owner_user_id, '') <> ?`,
          )
          .get(contactPhone, merchant?.id ?? '', user.id);
        if (taken) {
          throw conflict('CONTACT_PHONE_TAKEN', '该联系电话已被其他商家使用。');
        }
        if (!merchant) {
          const id = newId('m');
          db.prepare(
            `INSERT INTO merchants (id, owner_user_id, name, open_at, close_at, contact_name, contact_phone, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
          ).run(id, user.id, merchantName, hours.openAt, hours.closeAt, contactName, contactPhone, now);
          db.prepare('UPDATE users SET merchant_id = ? WHERE id = ?').run(id, user.id);
          merchant = loadMerchant(db, id);
        } else {
          db.prepare(
            `UPDATE merchants
             SET owner_user_id = COALESCE(owner_user_id, ?),
                 name = ?,
                 open_at = ?,
                 close_at = ?,
                 contact_name = ?,
                 contact_phone = ?,
                 status = 'ACTIVE',
                 created_at = COALESCE(created_at, ?)
             WHERE id = ?`,
          ).run(user.id, merchantName, hours.openAt, hours.closeAt, contactName, contactPhone, now, merchant.id);
          merchant = loadMerchant(db, merchant.id);
        }
        return {
          status: 201,
          body: { data: profiledData(db, merchant.id, { ...account, merchant_id: merchant.id }) },
        };
      },
    ),
  );
}

export function updateMerchantProfile({ db, clock, user, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'merchantName', 'contactName', 'contactPhone']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  if (
    input.merchantName === undefined &&
    input.contactName === undefined &&
    input.contactPhone === undefined
  ) {
    throw validationError('至少需要提供一个可修改的资料字段。');
  }
  const merchantName =
    input.merchantName !== undefined
      ? requireString(input.merchantName, 'merchantName', { min: 2, max: 30 })
      : undefined;
  const contactName =
    input.contactName !== undefined
      ? requireString(input.contactName, 'contactName', { min: 2, max: 20 })
      : undefined;
  const contactPhone =
    input.contactPhone !== undefined ? normalizePhone(input.contactPhone) : undefined;

  const hash = requestHash(input);
  const now = clock();

  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: 'merchant-profile-update', requestId, hash, now },
      () => {
        if (!user.merchant_id) {
          throw conflict('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
        }
        const merchant = loadMerchant(db, user.merchant_id);
        if (!isMerchantRegistered(merchant) && !DEMO_MERCHANT_IDS.has(merchant.id)) {
          throw conflict('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
        }
        if (contactPhone !== undefined) {
          const taken = db
            .prepare(
              `SELECT id FROM merchants
               WHERE contact_phone = ?
                 AND id <> ?
                 AND COALESCE(owner_user_id, '') <> ?`,
            )
            .get(contactPhone, merchant.id, user.id);
          if (taken) {
            throw conflict('CONTACT_PHONE_TAKEN', '该联系电话已被其他商家使用。');
          }
        }
        const nextName = merchantName ?? merchant.name;
        const nextContactName = contactName ?? merchant.contact_name;
        const nextContactPhone = contactPhone ?? merchant.contact_phone;
        db.prepare(
          'UPDATE merchants SET name = ?, contact_name = ?, contact_phone = ? WHERE id = ?',
        ).run(nextName, nextContactName, nextContactPhone, merchant.id);
        if (contactName !== undefined || contactPhone !== undefined) {
          db.prepare(
            'UPDATE merchants SET contact_name = ?, contact_phone = ? WHERE owner_user_id = ?',
          ).run(nextContactName, nextContactPhone, user.id);
        }
        return {
          status: 200,
          body: { data: profiledData(db, merchant.id, user) },
        };
      },
    ),
  );
}

export function listMerchantShops({ db, user }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const shops = getOwnedShops(db, user);
  const activeShop =
    shops.find((shop) => shop.merchant_id === user.merchant_id) ?? shops[0] ?? null;
  return {
    status: 200,
    body: {
      data: {
        shops: shops.map(serializeShop),
        activeShopId: activeShop?.id ?? null,
        activeMerchantId: user.merchant_id ?? null,
      },
    },
  };
}

export function createShop({ db, clock, user, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'shopName', 'name', 'location', 'description', 'openAt', 'closeAt', 'active']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const rawName = input.shopName !== undefined ? input.shopName : input.name;
  const shopName = requireString(rawName, 'shopName', { min: 2, max: 30 });
  const location = requireString(input.location, 'location', { min: 2, max: 50 });
  const description = optionalDescription(input.description);
  const hours =
    input.openAt !== undefined || input.closeAt !== undefined
      ? validateBusinessHours(input.openAt ?? '08:00', input.closeAt ?? '22:00')
      : { openAt: '08:00', closeAt: '22:00' };
  if (input.active !== undefined && typeof input.active !== 'boolean') {
    throw validationError('active 必须是布尔值。');
  }
  const status = input.active === false ? 'DISABLED' : 'ACTIVE';
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
        const primaryMerchant = loadMerchant(db, user.merchant_id);
        if (!isMerchantRegistered(primaryMerchant) && !DEMO_MERCHANT_IDS.has(primaryMerchant.id)) {
          throw conflict('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
        }
        const existingShops = getOwnedShops(db, user);
        if (existingShops.some((shop) => shop.name === shopName)) {
          throw conflict('SHOP_NAME_DUPLICATE', '同一账号下已存在同名店铺，请换一个店铺名称。');
        }

        let shopMerchantId = primaryMerchant.id;
        const primaryHasShop = existingShops.some((shop) => shop.merchant_id === primaryMerchant.id);
        if (primaryHasShop) {
          shopMerchantId = newId('m');
          db.prepare(
            `INSERT INTO merchants (id, owner_user_id, name, open_at, close_at, contact_name, contact_phone, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            shopMerchantId,
            user.id,
            shopName,
            hours.openAt,
            hours.closeAt,
            primaryMerchant.contact_name,
            primaryMerchant.contact_phone,
            status,
            now,
          );
        } else {
          db.prepare(
            'UPDATE merchants SET owner_user_id = COALESCE(owner_user_id, ?), open_at = ?, close_at = ?, status = ? WHERE id = ?',
          ).run(user.id, hours.openAt, hours.closeAt, status, primaryMerchant.id);
        }

        const id = newId('s');
        db.prepare(
          `INSERT INTO shops (id, merchant_id, owner_user_id, name, location, description, open_at, close_at, status, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(
          id,
          shopMerchantId,
          user.id,
          shopName,
          location,
          description,
          hours.openAt,
          hours.closeAt,
          status,
          now,
          now,
        );
        return {
          status: 201,
          body: { data: profiledData(db, user.merchant_id, user, id) },
        };
      },
    ),
  );
}

export function updateShop({ db, clock, user, params = {}, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, [
    'requestId',
    'expectedVersion',
    'shopName',
    'name',
    'location',
    'description',
    'openAt',
    'closeAt',
    'active',
  ]);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  if (
    input.shopName === undefined &&
    input.name === undefined &&
    input.location === undefined &&
    input.description === undefined &&
    input.openAt === undefined &&
    input.closeAt === undefined &&
    input.active === undefined
  ) {
    throw validationError('至少需要提供一个可修改的店铺字段。');
  }
  const rawName = input.shopName !== undefined ? input.shopName : input.name;
  const shopName = rawName !== undefined ? requireString(rawName, 'shopName', { min: 2, max: 30 }) : undefined;
  const location =
    input.location !== undefined ? requireString(input.location, 'location', { min: 2, max: 50 }) : undefined;
  const hasDescription = input.description !== undefined;
  const description = hasDescription ? optionalDescription(input.description) : undefined;
  if (input.active !== undefined && typeof input.active !== 'boolean') {
    throw validationError('active 必须是布尔值。');
  }
  if (input.expectedVersion !== undefined) {
    requireInteger(input.expectedVersion, 'expectedVersion', { min: 1, max: 1_000_000 });
  }

  const targetShop = resolveOwnedShop(db, user, params.shopId ?? null);
  const nextHours = validateBusinessHours(
    input.openAt ?? targetShop.open_at ?? '08:00',
    input.closeAt ?? targetShop.close_at ?? '22:00',
  );
  const hash = requestHash(input);
  const now = clock();

  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: `merchant-shop-update:${targetShop.id}`, requestId, hash, now },
      () => {
        const current = resolveOwnedShop(db, user, targetShop.id);
        if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
          throw conflict('SHOP_VERSION_CONFLICT', '店铺资料已发生变化，请刷新后再试。');
        }
        const nextName = shopName ?? current.name;
        const ownedShops = getOwnedShops(db, user);
        if (ownedShops.some((s) => s.id !== current.id && s.name === nextName)) {
          throw conflict('SHOP_NAME_DUPLICATE', '同一账号下已存在同名店铺，请换一个店铺名称。');
        }
        const nextLocation = location ?? current.location;
        const nextDescription = hasDescription ? description : current.description;
        const nextStatus =
          input.active === undefined ? current.status ?? 'ACTIVE' : input.active ? 'ACTIVE' : 'DISABLED';

        const updated = db
          .prepare(
            `UPDATE shops
             SET name = ?, location = ?, description = ?, open_at = ?, close_at = ?, status = ?, version = version + 1, updated_at = ?
             WHERE id = ? AND version = ?`,
          )
          .run(
            nextName,
            nextLocation,
            nextDescription,
            nextHours.openAt,
            nextHours.closeAt,
            nextStatus,
            now,
            current.id,
            current.version,
          );
        if (updated.changes !== 1) {
          throw conflict('SHOP_VERSION_CONFLICT', '店铺资料已发生变化，请刷新后再试。');
        }
        db.prepare('UPDATE merchants SET open_at = ?, close_at = ?, status = ? WHERE id = ?').run(
          nextHours.openAt,
          nextHours.closeAt,
          nextStatus,
          current.merchant_id,
        );
        if (current.merchant_id !== user.merchant_id) {
          db.prepare('UPDATE merchants SET name = ? WHERE id = ?').run(nextName, current.merchant_id);
        }
        return {
          status: 200,
          body: { data: profiledData(db, user.merchant_id, user, current.id) },
        };
      },
    ),
  );
}

export function updateShopBusinessHours({ db, clock, user, params = {}, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'expectedVersion', 'openAt', 'closeAt', 'active']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  if (input.openAt === undefined && input.closeAt === undefined && input.active === undefined) {
    throw validationError('至少需要提供 openAt、closeAt 或 active 之一。');
  }
  if (input.active !== undefined && typeof input.active !== 'boolean') {
    throw validationError('active 必须是布尔值。');
  }
  if (input.expectedVersion !== undefined) {
    requireInteger(input.expectedVersion, 'expectedVersion', { min: 1, max: 1_000_000 });
  }

  let shop = null;
  let merchant = null;
  if (params.shopId) {
    shop = resolveOwnedShop(db, user, params.shopId);
    merchant = loadMerchant(db, shop.merchant_id);
  } else {
    const ownedShops = getOwnedShops(db, user);
    shop = ownedShops.find((s) => s.merchant_id === user.merchant_id) ?? ownedShops[0] ?? null;
    if (shop) {
      merchant = loadMerchant(db, shop.merchant_id);
    } else if (user.merchant_id) {
      merchant = loadMerchant(db, user.merchant_id);
    } else {
      throw notFound('SHOP_NOT_FOUND', '尚未创建店铺或商家资料。');
    }
  }

  const nextHours = validateBusinessHours(
    input.openAt ?? shop?.open_at ?? merchant.open_at ?? '08:00',
    input.closeAt ?? shop?.close_at ?? merchant.close_at ?? '22:00',
  );
  const hash = requestHash(input);
  const now = clock();
  const opTarget = shop ? shop.id : merchant.id;

  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: `merchant-business-hours:${opTarget}`, requestId, hash, now },
      () => {
        const currentShop = shop ? resolveOwnedShop(db, user, shop.id) : null;
        const currentMerchant = loadMerchant(db, currentShop ? currentShop.merchant_id : merchant.id);
        if (input.expectedVersion !== undefined && currentShop && currentShop.version !== input.expectedVersion) {
          throw conflict('SHOP_VERSION_CONFLICT', '店铺配置已发生变化，请刷新后再试。');
        }
        const nextStatus =
          input.active === undefined
            ? (currentShop?.status ?? currentMerchant.status ?? 'ACTIVE')
            : input.active
              ? 'ACTIVE'
              : 'DISABLED';

        let nextVersion = currentShop?.version ?? 1;
        if (currentShop) {
          const updated = db
            .prepare(
              `UPDATE shops
               SET open_at = ?, close_at = ?, status = ?, version = version + 1, updated_at = ?
               WHERE id = ? AND version = ?`,
            )
            .run(nextHours.openAt, nextHours.closeAt, nextStatus, now, currentShop.id, currentShop.version);
          if (updated.changes !== 1) {
            throw conflict('SHOP_VERSION_CONFLICT', '店铺配置已发生变化，请刷新后再试。');
          }
          nextVersion = currentShop.version + 1;
        }
        db.prepare('UPDATE merchants SET open_at = ?, close_at = ?, status = ? WHERE id = ?').run(
          nextHours.openAt,
          nextHours.closeAt,
          nextStatus,
          currentMerchant.id,
        );
        return {
          status: 200,
          body: {
            data: {
              merchantId: currentMerchant.id,
              shopId: currentShop?.id ?? null,
              openAt: nextHours.openAt,
              closeAt: nextHours.closeAt,
              active: nextStatus === 'ACTIVE',
              status: nextStatus,
              version: nextVersion,
            },
          },
        };
      },
    ),
  );
}

export function selectActiveShop({ db, user, params }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const shop = resolveOwnedShop(db, user, params.shopId);
  db.prepare('UPDATE users SET merchant_id = ? WHERE id = ?').run(shop.merchant_id, user.id);
  return {
    status: 200,
    body: { data: profiledData(db, shop.merchant_id, { ...user, merchant_id: shop.merchant_id }, shop.id) },
  };
}

export function createDish({ db, clock, user, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, [
    'requestId',
    'shopId',
    'type',
    'name',
    'priceFen',
    'availableQuantity',
    'onSale',
    'imageUrl',
    'flavorGroups',
    'sides',
    'addOns',
  ]);
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
  let requestedShopId = null;
  if (input.shopId !== undefined && input.shopId !== null) {
    requestedShopId = requireString(input.shopId, 'shopId', { max: 120 });
  }
  const hash = requestHash(input);
  const now = clock();

  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: 'merchant-dish-create', requestId, hash, now },
      () => {
        let targetMerchantId = user.merchant_id;
        let targetShopId = null;
        if (requestedShopId) {
          const shop = resolveOwnedShop(db, user, requestedShopId);
          targetMerchantId = shop.merchant_id;
          targetShopId = shop.id;
        } else if (targetMerchantId) {
          const defaultShop = db
            .prepare('SELECT id FROM shops WHERE merchant_id = ? ORDER BY created_at ASC, rowid ASC LIMIT 1')
            .get(targetMerchantId);
          targetShopId = defaultShop?.id ?? null;
        }
        if (!targetMerchantId) {
          throw conflict('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
        }
        const merchant = loadMerchant(db, targetMerchantId);
        if (!isMerchantRegistered(merchant) && !DEMO_MERCHANT_IDS.has(merchant.id)) {
          throw conflict('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
        }
        const duplicate = db
          .prepare('SELECT id FROM dishes WHERE merchant_id = ? AND name = ?')
          .get(merchant.id, name);
        if (duplicate) {
          throw conflict('DISH_NAME_DUPLICATE', '同店菜品名称不能重复。');
        }
        const imageUrl =
          input.imageUrl !== undefined
            ? resolveDishImageUrl(input.imageUrl, {
                db,
                merchantId: merchant.id,
                ownerUserId: user.id,
                now,
              })
            : null;
        const id = newId('dish');
        db.prepare(
          `INSERT INTO dishes (
             id, merchant_id, shop_id, type, name, price_fen, available_quantity, on_sale, version,
             image_url, flavor_groups_json, sides_json, add_ons_json
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        ).run(
          id,
          merchant.id,
          targetShopId,
          type,
          name,
          priceFen,
          availableQuantity,
          onSale ? 1 : 0,
          imageUrl,
          JSON.stringify(flavorGroups),
          JSON.stringify(sides),
          JSON.stringify(addOns),
        );

        const today = shanghaiDate(now);
        const activeDailyDays = db
          .prepare('SELECT date FROM daily_menu_days WHERE merchant_id = ? AND date >= ?')
          .all(merchant.id, today);
        if (activeDailyDays.length > 0) {
          const insertDaily = db.prepare(
            `INSERT OR IGNORE INTO daily_menu_items (merchant_id, date, dish_id, available_quantity)
             VALUES (?, ?, ?, ?)`,
          );
          for (const day of activeDailyDays) {
            insertDaily.run(merchant.id, day.date, id, availableQuantity);
          }
        }

        const created = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);
        return {
          status: 201,
          body: { data: serializeDish(created) },
        };
      },
    ),
  );
}

export function listMerchantDishes({ db, user, query }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const shopIdParam = query?.get('shopId');
  let merchantIds;
  if (shopIdParam) {
    const shop = resolveOwnedShop(db, user, shopIdParam);
    merchantIds = [shop.merchant_id];
  } else {
    merchantIds = getOwnedMerchantIds(db, user);
  }
  if (merchantIds.length === 0) {
    return { status: 200, body: { data: { dishes: [] } } };
  }
  const placeholders = merchantIds.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT * FROM dishes WHERE merchant_id IN (${placeholders}) ORDER BY merchant_id, rowid`)
    .all(...merchantIds);
  return {
    status: 200,
    body: { data: { dishes: rows.map(serializeDish) } },
  };
}

export function setDailyMenu({ db, clock, user, params, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const date = params.date;
  const now = clock();
  const today = shanghaiDate(now);
  const allowedDates = Array.from({ length: SLOT_DATE_RANGE_DAYS }, (_, index) => addDays(today, index));
  if (typeof date !== 'string' || !DATE_PATTERN.test(date) || !allowedDates.includes(date)) {
    throw validationError('只能配置未来 7 天内的每日菜单。');
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'shopId', 'dishes']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  if (!Array.isArray(input.dishes) || input.dishes.length > 200) {
    throw validationError('dishes 必须是最多 200 项的数组。');
  }

  let requestedShopId = null;
  if (input.shopId !== undefined && input.shopId !== null) {
    requestedShopId = requireString(input.shopId, 'shopId', { max: 120 });
  }

  const selections = [];
  const seenDishIds = new Set();
  for (const rawItem of input.dishes) {
    const item = asRecord(rawItem);
    requireOnlyFields(item, ['dishId', 'availableQuantity']);
    const dishId = requireString(item.dishId, 'dishes[].dishId', { max: 120 });
    if (seenDishIds.has(dishId)) {
      throw validationError('同一道菜不能重复上架到同一天菜单。');
    }
    seenDishIds.add(dishId);
    const availableQuantity = requireInteger(item.availableQuantity, 'dishes[].availableQuantity', {
      min: 0,
      max: 10_000,
    });
    selections.push({ dishId, availableQuantity });
  }

  const hash = requestHash(input);

  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: `merchant-daily-menu:${date}:${requestedShopId ?? 'default'}`, requestId, hash, now },
      () => {
        let targetMerchantId = user.merchant_id;
        let targetShopId = null;
        if (requestedShopId) {
          const shop = resolveOwnedShop(db, user, requestedShopId);
          targetMerchantId = shop.merchant_id;
          targetShopId = shop.id;
        } else if (targetMerchantId) {
          const defaultShop = db
            .prepare('SELECT id FROM shops WHERE merchant_id = ? ORDER BY created_at ASC, rowid ASC LIMIT 1')
            .get(targetMerchantId);
          targetShopId = defaultShop?.id ?? null;
        }
        if (!targetMerchantId) {
          throw conflict('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
        }

        const ownedMerchantIds = getOwnedMerchantIds(db, user);
        const checkDishStmt = db.prepare('SELECT * FROM dishes WHERE id = ?');
        const resolvedDishes = [];
        for (const selection of selections) {
          const dish = checkDishStmt.get(selection.dishId);
          if (!dish || dish.merchant_id !== targetMerchantId || !ownedMerchantIds.includes(dish.merchant_id)) {
            throw notFound('DISH_NOT_FOUND', `菜品 ${selection.dishId} 不存在或不属于当前店铺。`);
          }
          resolvedDishes.push({ dish, availableQuantity: selection.availableQuantity });
        }

        db.prepare(
          `INSERT INTO daily_menu_days (merchant_id, date, version, updated_at)
           VALUES (?, ?, 1, ?)
           ON CONFLICT(merchant_id, date) DO UPDATE SET
             version = daily_menu_days.version + 1,
             updated_at = excluded.updated_at`,
        ).run(targetMerchantId, date, now);

        db.prepare('DELETE FROM daily_menu_items WHERE merchant_id = ? AND date = ?').run(targetMerchantId, date);
        const insertItem = db.prepare(
          `INSERT INTO daily_menu_items (merchant_id, date, dish_id, available_quantity)
           VALUES (?, ?, ?, ?)`,
        );
        for (const item of resolvedDishes) {
          insertItem.run(targetMerchantId, date, item.dish.id, item.availableQuantity);
        }

        ensureDateSlots(db, date);
        const slots = db
          .prepare('SELECT * FROM slots WHERE date = ? ORDER BY start_at')
          .all(date)
          .map((slot) => ({
            id: slot.id,
            date: slot.date,
            startAt: toShanghaiIso(slot.start_at),
            endAt: toShanghaiIso(slot.end_at),
            capacity: slot.capacity,
            booked: slot.booked_count,
            remainingCapacity: Math.max(0, slot.capacity - slot.booked_count),
            enabled: slot.enabled === 1,
            version: slot.version,
          }));

        const dishes = resolvedDishes.map(({ dish, availableQuantity }) =>
          serializeDish({ ...dish, available_quantity: availableQuantity }),
        );

        return {
          status: 200,
          body: {
            data: {
              date,
              merchantId: targetMerchantId,
              shopId: targetShopId,
              dishes,
              slots,
            },
          },
        };
      },
    ),
  );
}
