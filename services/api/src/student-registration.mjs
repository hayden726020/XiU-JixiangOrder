import { conflict, validationError } from './errors.mjs';
import { readJsonBody } from './http.mjs';
import { transaction } from './tx.mjs';
import { hashPassword } from './security.mjs';
import { asRecord, newId, requireOnlyFields } from './util.mjs';

const ACCOUNT_PATTERN = /^[A-Za-z0-9_]{4,32}$/;

function validateCredentials(body) {
  if (typeof body.account !== 'string' || !ACCOUNT_PATTERN.test(body.account)) {
    throw validationError('账号应为 4 到 32 位英文字母、数字或下划线。');
  }
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128 || body.password.trim().length === 0) {
    throw validationError('密码应为 8 到 128 位，且不能全为空格。');
  }
  return { account: body.account.toLowerCase(), password: body.password };
}

export async function registerStudent({ db, req }) {
  const body = asRecord(await readJsonBody(req, { allowEmpty: false }));
  if (Object.keys(body).some((key) => !['account', 'password'].includes(key))) {
    throw validationError('注册只接受 account 和 password。');
  }
  const { account, password } = validateCredentials(body);

  if (db.prepare('SELECT 1 FROM users WHERE account = ? COLLATE NOCASE').get(account)) {
    throw conflict('ACCOUNT_TAKEN', '账号已被使用。');
  }
  const result = db.prepare(
    `INSERT INTO users (id, account, password_stored, display_name, role, student_id)
     VALUES (?, ?, ?, ?, 'STUDENT', ?)
     ON CONFLICT(account) DO NOTHING`,
  ).run(newId('user'), account, hashPassword(password), account, newId('student'));
  if (result.changes === 0) {
    throw conflict('ACCOUNT_TAKEN', '账号已被使用。');
  }
  return { status: 201, body: { data: { registered: true } } };
}

export async function registerMerchantAccount({ db, clock, req }) {
  const body = asRecord(await readJsonBody(req, { allowEmpty: false }));
  requireOnlyFields(body, ['account', 'password', 'displayName']);
  const { account, password } = validateCredentials(body);
  let displayName = account;
  if (body.displayName !== undefined) {
    if (typeof body.displayName !== 'string') {
      throw validationError('displayName 必须是字符串。');
    }
    const trimmed = body.displayName.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      throw validationError('displayName 长度应在 2 到 30 之间。');
    }
    displayName = trimmed;
  }

  const now = clock();
  return transaction(db, () => {
    if (db.prepare('SELECT 1 FROM users WHERE account = ? COLLATE NOCASE').get(account)) {
      throw conflict('ACCOUNT_TAKEN', '账号已被使用。');
    }
    const userId = newId('user');
    const merchantId = newId('m');
    const result = db.prepare(
      `INSERT INTO users (id, account, password_stored, display_name, role, merchant_id)
       VALUES (?, ?, ?, ?, 'MERCHANT', ?)
       ON CONFLICT(account) DO NOTHING`,
    ).run(userId, account, hashPassword(password), displayName, merchantId);
    if (result.changes === 0) {
      throw conflict('ACCOUNT_TAKEN', '账号已被使用。');
    }
    db.prepare(
      `INSERT INTO merchants (id, owner_user_id, name, open_at, close_at, contact_name, contact_phone, status, created_at)
       VALUES (?, ?, ?, '08:00', '22:00', NULL, NULL, 'ACTIVE', ?)`,
    ).run(merchantId, userId, displayName, now);
    return { status: 201, body: { data: { registered: true, role: 'MERCHANT' } } };
  });
}
