import { conflict, validationError } from './errors.mjs';

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // 回滚失败时保留原始错误。
    }
    throw error;
  }
}

export function runIdempotent(db, { actorId, operation, requestId, hash, now }, execute) {
  if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > 120) {
    throw validationError('requestId 必填，长度不超过 120。');
  }
  const existing = db
    .prepare(
      `SELECT request_hash, status_code, response_json FROM request_log
       WHERE actor_id = ? AND operation = ? AND request_id = ?`,
    )
    .get(actorId, operation, requestId);
  if (existing) {
    if (existing.request_hash !== hash) {
      throw conflict('REQUEST_CONFLICT', '同一 requestId 已用于不同内容的请求，请为新操作生成新的 requestId。');
    }
    return { status: existing.status_code, body: JSON.parse(existing.response_json) };
  }
  const result = execute();
  db.prepare(
    `INSERT INTO request_log (actor_id, operation, request_id, request_hash, status_code, response_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(actorId, operation, requestId, hash, result.status, JSON.stringify(result.body), now);
  return result;
}
