import { conflict, forbidden, notFound, validationError } from './errors.mjs';
import { readSetting } from './db.mjs';
import { runIdempotent, transaction } from './orders.mjs';
import { hashPassword } from './security.mjs';
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
const QUALIFICATION_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_QUALIFICATION_BASE64 = 2_800_000;

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

function serializeQualification(row) {
  if (!row) return null;
  return {
    merchantId: row.merchant_id,
    status: row.status,
    businessLicense: {
      fileName: row.business_license_name,
      mimeType: row.business_license_mime,
    },
    foodPermit: {
      fileName: row.food_permit_name,
      mimeType: row.food_permit_mime,
    },
    submittedAt: toShanghaiIso(row.submitted_at),
    reviewedAt: row.reviewed_at ? toShanghaiIso(row.reviewed_at) : null,
    reviewReason: row.review_reason ?? null,
    version: row.version,
  };
}

function loadQualification(db, merchantId) {
  return db.prepare('SELECT * FROM merchant_qualifications WHERE merchant_id = ?').get(merchantId) ?? null;
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

function parseQualificationFile(value, label) {
  const file = asRecord(value);
  requireOnlyFields(file, ['fileName', 'mimeType', 'base64']);
  const fileName = requireString(file.fileName, `${label}.fileName`, { min: 1, max: 120 });
  if (!/\.(jpe?g|png|webp|pdf)$/i.test(fileName)) {
    throw validationError(`${label} 仅支持 JPG、PNG、WebP 或 PDF。`);
  }
  const mimeType = requireEnum(file.mimeType, `${label}.mimeType`, QUALIFICATION_MIME_TYPES);
  const base64 = requireString(file.base64, `${label}.base64`, { max: MAX_QUALIFICATION_BASE64 });
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) {
    throw validationError(`${label} 文件内容格式不正确。`);
  }
  return { fileName, mimeType, base64 };
}

function profiledData(db, merchantId) {
  const merchant = loadMerchant(db, merchantId);
  const shop = loadShop(db, merchant.id);
  const qualification = loadQualification(db, merchant.id);
  const registered = typeof merchant.contact_phone === 'string' && merchant.contact_phone.length > 0;
  const onboardingStep = !registered
    ? 'UNREGISTERED'
    : shop
      ? 'SHOP_CREATED'
      : !qualification
        ? 'REGISTERED'
        : qualification.status === 'PENDING'
          ? 'QUALIFICATION_PENDING'
          : qualification.status === 'REJECTED'
            ? 'QUALIFICATION_REJECTED'
            : 'QUALIFICATION_APPROVED';
  return {
    merchant: serializeMerchant(merchant),
    shop: shop ? serializeShop(shop) : null,
    qualification: serializeQualification(qualification),
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
        const qualification = loadQualification(db, merchant.id);
        if (!qualification) {
          throw conflict('QUALIFICATION_REQUIRED', '请先上传营业执照与食品经营许可证。');
        }
        if (qualification.status === 'PENDING') {
          throw conflict('QUALIFICATION_PENDING', '资质正在审核，预计一个工作日内完成。');
        }
        if (qualification.status === 'REJECTED') {
          throw conflict('QUALIFICATION_REJECTED', '资质审核未通过，请修改后重新上传。');
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

export function getMerchantQualification({ db, user }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  if (!user.merchant_id) {
    throw notFound('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
  }
  const qualification = loadQualification(db, user.merchant_id);
  if (!qualification) {
    throw notFound('QUALIFICATION_NOT_FOUND', '该商家尚未提交资质。');
  }
  return { status: 200, body: { data: serializeQualification(qualification) } };
}

export function uploadMerchantQualification({ db, clock, user, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'businessLicense', 'foodPermit']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const businessLicense = parseQualificationFile(input.businessLicense, 'businessLicense');
  const foodPermit = parseQualificationFile(input.foodPermit, 'foodPermit');
  const hash = requestHash(input);
  const now = clock();
  if (!user.merchant_id) {
    throw conflict('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
  }
  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: 'qualification-upload', requestId, hash, now },
      () => {
        const existing = loadQualification(db, user.merchant_id);
        if (existing) {
          db.prepare(
            `UPDATE merchant_qualifications SET
               business_license_name = ?, business_license_mime = ?, business_license_data = ?,
               food_permit_name = ?, food_permit_mime = ?, food_permit_data = ?,
               status = 'PENDING', review_reason = NULL, reviewed_at = NULL, reviewed_by = NULL,
               submitted_at = ?, version = version + 1
             WHERE merchant_id = ?`,
          ).run(
            businessLicense.fileName,
            businessLicense.mimeType,
            businessLicense.base64,
            foodPermit.fileName,
            foodPermit.mimeType,
            foodPermit.base64,
            now,
            user.merchant_id,
          );
        } else {
          db.prepare(
            `INSERT INTO merchant_qualifications
               (merchant_id, business_license_name, business_license_mime, business_license_data,
                food_permit_name, food_permit_mime, food_permit_data, status, submitted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, 1)`,
          ).run(
            user.merchant_id,
            businessLicense.fileName,
            businessLicense.mimeType,
            businessLicense.base64,
            foodPermit.fileName,
            foodPermit.mimeType,
            foodPermit.base64,
            now,
          );
        }
        return {
          status: 201,
          body: { data: serializeQualification(loadQualification(db, user.merchant_id)) },
        };
      },
    ),
  );
}

export function listMerchantQualifications({ db, query }) {
  const status = query.get('status');
  if (status && !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    throw validationError('status 取值无效。');
  }
  const where = status ? 'WHERE q.status = ?' : '';
  const params = status ? [status] : [];
  const rows = db
    .prepare(
      `SELECT q.*, m.name AS merchant_name, m.contact_name, m.contact_phone
       FROM merchant_qualifications q
       JOIN merchants m ON m.id = q.merchant_id
       ${where}
       ORDER BY q.submitted_at DESC, q.merchant_id`,
    )
    .all(...params);
  return {
    status: 200,
    body: {
      data: {
        qualifications: rows.map((row) => ({
          ...serializeQualification(row),
          merchantName: row.merchant_name,
          contactName: row.contact_name ?? null,
          contactPhone: maskPhone(row.contact_phone),
        })),
      },
    },
  };
}

export function reviewMerchantQualification({ db, clock, user, params, body }) {
  if (user.role !== 'ADMIN') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'expectedVersion', 'decision', 'reason']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const expectedVersion = requireInteger(input.expectedVersion, 'expectedVersion', { min: 1, max: 1_000_000 });
  const decision = requireEnum(input.decision, 'decision', ['APPROVE', 'REJECT']);
  const reason = decision === 'REJECT'
    ? requireString(input.reason, 'reason', { min: 2, max: 200 })
    : null;
  const hash = requestHash(input);
  const now = clock();
  const row = loadQualification(db, params.merchantId);
  if (!row) {
    throw notFound('QUALIFICATION_NOT_FOUND', '该商家尚未提交资质。');
  }
  return transaction(db, () =>
    runIdempotent(
      db,
      {
        actorId: user.id,
        operation: `review-qualification:${params.merchantId}`,
        requestId,
        hash,
        now,
      },
      () => {
        if (row.version !== expectedVersion) {
          throw conflict('QUALIFICATION_VERSION_CONFLICT', '资质已发生变化，请刷新后重试。');
        }
        const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        db.prepare(
          `UPDATE merchant_qualifications
           SET status = ?, review_reason = ?, reviewed_at = ?, reviewed_by = ?, version = version + 1
           WHERE merchant_id = ? AND version = ?`,
        ).run(status, reason, now, user.id, params.merchantId, expectedVersion);
        return {
          status: 200,
          body: { data: serializeQualification(loadQualification(db, params.merchantId)) },
        };
      },
    ),
  );
}

export function getMerchantQualificationFile({ db, user, params }) {
  if (user.role !== 'ADMIN' && user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const merchantId = user.role === 'ADMIN' ? params.merchantId : user.merchant_id;
  if (!merchantId) {
    throw notFound('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
  }
  const row = loadQualification(db, merchantId);
  if (!row) {
    throw notFound('QUALIFICATION_NOT_FOUND', '该商家尚未提交资质。');
  }
  const file = params.kind === 'business-license'
    ? {
      fileName: row.business_license_name,
      mimeType: row.business_license_mime,
      base64: row.business_license_data,
    }
    : {
      fileName: row.food_permit_name,
      mimeType: row.food_permit_mime,
      base64: row.food_permit_data,
    };
  return { status: 200, body: { data: file } };
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