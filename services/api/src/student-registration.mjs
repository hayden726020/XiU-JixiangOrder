import { conflict, validationError } from './errors.mjs';
import { readJsonBody } from './http.mjs';
import { hashPassword } from './security.mjs';
import { asRecord, newId } from './util.mjs';

const ACCOUNT_PATTERN = /^[A-Za-z0-9_]{4,32}$/;

export async function registerStudent({ db, req }) {
  const body = asRecord(await readJsonBody(req, { allowEmpty: false }));
  if (Object.keys(body).some((key) => !['account', 'password'].includes(key))) {
    throw validationError('注册只接受 account 和 password。');
  }
  if (typeof body.account !== 'string' || !ACCOUNT_PATTERN.test(body.account)) {
    throw validationError('账号应为 4 到 32 位英文字母、数字或下划线。');
  }
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128 || body.password.trim().length === 0) {
    throw validationError('密码应为 8 到 128 位，且不能全为空格。');
  }

  const account = body.account.toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE account = ? COLLATE NOCASE').get(account)) {
    throw conflict('ACCOUNT_TAKEN', '账号已被使用。');
  }
  const result = db.prepare(
    `INSERT INTO users (id, account, password_stored, display_name, role, student_id)
     VALUES (?, ?, ?, ?, 'STUDENT', ?)
     ON CONFLICT(account) DO NOTHING`,
  ).run(newId('user'), account, hashPassword(body.password), account, newId('student'));
  if (result.changes === 0) {
    throw conflict('ACCOUNT_TAKEN', '账号已被使用。');
  }
  return { status: 201, body: { data: { registered: true } } };
}
