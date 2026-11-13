import {
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { forbidden, sessionExpired, unauthenticated } from './errors.mjs';
import { sha256Hex } from './util.mjs';

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function hashPassword(password, salt = randomBytes(SALT_BYTES).toString('hex')) {
  const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') {
    return false;
  }
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) {
    return false;
  }
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (expectedBuffer.length !== candidate.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, candidate);
}

export function createToken() {
  return randomBytes(32).toString('base64url');
}

export function tokenHash(token) {
  return sha256Hex(token);
}

export function createSession(db, userId, clock) {
  const token = createToken();
  const now = clock();
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    tokenHash(token),
    userId,
    now,
    expiresAt,
  );
  return { token, expiresAt };
}

export function findUserByAccount(db, account) {
  return db.prepare('SELECT * FROM users WHERE account = ? AND active = 1').get(account) ?? null;
}

export function findUserById(db, userId) {
  return db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(userId) ?? null;
}

export function resolveToken(db, token, clock) {
  const row = db
    .prepare(
      `SELECT u.*, s.expires_at AS session_expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(tokenHash(token));
  if (!row) {
    return { user: null, expired: false };
  }
  if (row.session_expires_at <= clock()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
    return { user: null, expired: true };
  }
  return { user: row, expired: false };
}

export function authenticate(db, req, clock) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    throw unauthenticated();
  }
  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0) {
    throw unauthenticated();
  }
  const { user, expired } = resolveToken(db, token, clock);
  if (expired) {
    throw sessionExpired();
  }
  if (!user) {
    throw unauthenticated();
  }
  return user;
}

export function requireRole(user, roles) {
  if (!roles.includes(user.role)) {
    throw forbidden();
  }
}

export function toUserView(user) {
  return {
    id: user.id,
    displayName: user.display_name,
    role: user.role,
    ...(user.student_id ? { studentId: user.student_id } : {}),
    ...(user.merchant_id ? { merchantId: user.merchant_id } : {}),
  };
}

export function generatePickupCode() {
  return String(randomInt(100000, 1000000));
}