import {
  conflict,
  forbidden,
  notFound,
  validationError,
} from './errors.mjs';
import { generatePickupCode } from './security.mjs';
import {
  asRecord,
  newId,
  nowIso,
  requestHash,
  requireEnum,
  requireInteger,
  requireString,
  toShanghaiIso,
  shanghaiDate,
  addDays,
} from './util.mjs';

const ORDER_STATUSES = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'CANCELLED', 'COMPLETED'];
const ACTIVE_STATUSES = ['NEW', 'ACCEPTED', 'PREPARING', 'READY'];
const DELAYABLE_STATUSES = ['ACCEPTED', 'PREPARING', 'READY'];
const UNSTARTED_STATUSES = ['NEW', 'ACCEPTED'];
const DINING_MODES = ['DINE_IN', 'TAKEAWAY'];

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

function loadOrder(db, orderId) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) ?? null;
}

function loadItems(db, orderId) {
  return db
    .prepare('SELECT dish_id, name, quantity, unit_price_fen, merchant_id FROM order_items WHERE order_id = ? ORDER BY rowid')
    .all(orderId);
}

export function serializeOrder(db, row, user) {
  const items = loadItems(db, row.id).map((item) => ({
    dishId: item.dish_id,
    name: item.name,
    quantity: item.quantity,
    unitPriceFen: item.unit_price_fen,
  }));
  const canSeePickupCode =
    user.role === 'STUDENT' &&
    row.student_id === user.id &&
    row.status === 'READY' &&
    row.picked_up_at === null;
  return {
    id: row.id,
    items,
    slotId: row.slot_id,
    slotStart: toShanghaiIso(db.prepare('SELECT start_at FROM slots WHERE id = ?').get(row.slot_id).start_at),
    slotEnd: toShanghaiIso(db.prepare('SELECT end_at FROM slots WHERE id = ?').get(row.slot_id).end_at),
    diningMode: row.dining_mode,
    totalFen: row.total_fen,
    status: row.status,
    paymentStatus: row.payment_status,
    cancelRequest: {
      status: row.cancel_status,
      reason: row.cancel_status === 'NONE' ? null : row.cancel_reason,
      decisionReason: row.cancel_decision_reason ?? null,
    },
    cancellationReason: row.cancellation_reason,
    version: row.version,
    createdAt: toShanghaiIso(row.created_at),
    updatedAt: toShanghaiIso(row.updated_at),
    pickedUpAt: row.picked_up_at === null ? null : toShanghaiIso(row.picked_up_at),
    delay:
      row.delay_reason === null
        ? null
        : { reason: row.delay_reason, expectedReadyAt: row.delay_expected_ready_at },
    diningModeReason: row.dining_mode_reason ?? null,
    pickupCode: canSeePickupCode ? row.pickup_code : null,
  };
}

function loadVisibleOrder(db, user, orderId) {
  const row = loadOrder(db, orderId);
  if (!row) {
    throw notFound('ORDER_NOT_FOUND', '订单不存在或对当前身份不可见。');
  }
  if (user.role === 'STUDENT' && row.student_id !== user.id) {
    throw notFound('ORDER_NOT_FOUND', '订单不存在或对当前身份不可见。');
  }
  if (user.role === 'MERCHANT' && row.merchant_id !== user.merchant_id) {
    throw notFound('ORDER_NOT_FOUND', '订单不存在或对当前身份不可见。');
  }
  if (user.role !== 'ADMIN' && user.role !== 'STUDENT' && user.role !== 'MERCHANT') {
    throw forbidden();
  }
  return row;
}

function assertVersion(row, expectedVersion, options = {}) {
  requireInteger(expectedVersion, 'expectedVersion', { min: 1, max: 1_000_000 });
  if (row.version !== expectedVersion) {
    throw conflict(
      options.code ?? 'ORDER_VERSION_CONFLICT',
      options.message ?? '订单已发生变化，请刷新后再操作。',
    );
  }
}

function restoreAfterCancellation(db, row, slot, now) {
  if (!UNSTARTED_STATUSES.includes(row.status)) {
    return;
  }
  const restoreDish = db.prepare(
    'UPDATE dishes SET available_quantity = available_quantity + ?, version = version + 1 WHERE id = ?',
  );
  for (const item of loadItems(db, row.id)) {
    restoreDish.run(item.quantity, item.dish_id);
  }
  if (now < slot.start_at) {
    db.prepare('UPDATE slots SET booked_count = MAX(booked_count - 1, 0), version = version + 1 WHERE id = ?').run(
      row.slot_id,
    );
  }
}

function cancelOrder(db, row, { reason, now }) {
  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(row.slot_id);
  restoreAfterCancellation(db, row, slot, now);
  db.prepare(
    `UPDATE orders
     SET status = 'CANCELLED',
         payment_status = 'SIMULATED_REFUNDED',
         cancellation_reason = ?,
         cancel_status = CASE WHEN cancel_status = 'PENDING' THEN 'APPROVED' ELSE cancel_status END,
         cancel_decision_reason = CASE WHEN cancel_status = 'PENDING' THEN ? ELSE cancel_decision_reason END,
         version = version + 1,
         updated_at = ?
     WHERE id = ? AND version = ?`,
  ).run(reason ?? null, reason ?? null, now, row.id, row.version);
  return loadOrder(db, row.id);
}

function pageParams(query) {
  const page = Math.max(1, Number.parseInt(query.get('page') ?? '1', 10) || 1);
  const pageSizeRaw = Number.parseInt(query.get('pageSize') ?? '20', 10) || 20;
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function createOrder({ db, clock, user, body }) {
  const input = asRecord(body);
  const now = clock();
  const today = shanghaiDate(now);
  const tomorrow = addDays(today, 1);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const slotId = requireString(input.slotId, 'slotId', { max: 120 });
  const diningMode = requireEnum(input.diningMode, 'diningMode', DINING_MODES);
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 20) {
    throw validationError('items 必须包含 1 到 20 个菜品。');
  }

  const quantities = new Map();
  for (const rawItem of input.items) {
    const item = asRecord(rawItem);
    for (const key of Object.keys(item)) {
      if (key !== 'dishId' && key !== 'quantity') {
        throw validationError('items 只允许 dishId 与 quantity。');
      }
    }
    const dishId = requireString(item.dishId, 'items[].dishId', { max: 120 });
    const quantity = requireInteger(item.quantity, 'items[].quantity', { min: 1, max: 99 });
    quantities.set(dishId, (quantities.get(dishId) ?? 0) + quantity);
  }

  const hash = requestHash(input);
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: 'create-order', requestId, hash, now }, () => {
      const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
      if (!slot) {
        throw notFound('SLOT_NOT_FOUND', '所选时段不存在。');
      }
      if (!slot.enabled || slot.end_at <= now || (slot.date !== today && slot.date !== tomorrow)) {
        throw conflict('SLOT_CLOSED', '该时段已关闭或已过，请选择其他时段。');
      }

      const dishes = [];
      for (const [dishId, quantity] of quantities) {
        if (quantity > 99) {
          throw validationError('单个菜品数量不能超过 99。');
        }
        const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(dishId);
        if (!dish) {
          throw notFound('DISH_NOT_FOUND', '所选菜品不存在。');
        }
        if (!dish.on_sale) {
          throw conflict('OUT_OF_STOCK', '所选菜品已停售。');
        }
        dishes.push({ dish, quantity });
      }

      const merchantIds = new Set(dishes.map(({ dish }) => dish.merchant_id));
      if (merchantIds.size !== 1) {
        throw validationError('同一订单只能包含同一档口的菜品。');
      }
      const merchantId = dishes[0].dish.merchant_id;

      const updateDish = db.prepare(
        `UPDATE dishes SET available_quantity = available_quantity - ?, version = version + 1
         WHERE id = ? AND available_quantity >= ?`,
      );
      for (const { dish, quantity } of dishes) {
        const changed = updateDish.run(quantity, dish.id, quantity);
        if (changed.changes !== 1) {
          throw conflict('OUT_OF_STOCK', '所选菜品数量不足，请调整数量。');
        }
      }

      const slotChanged = db
        .prepare(
          `UPDATE slots SET booked_count = booked_count + 1, version = version + 1
           WHERE id = ? AND enabled = 1 AND booked_count < capacity`,
        )
        .run(slot.id);
      if (slotChanged.changes !== 1) {
        throw conflict('SLOT_FULL', '该时段名额已满，请选择其他时段。');
      }

      const totalFen = dishes.reduce((sum, { dish, quantity }) => sum + dish.price_fen * quantity, 0);
      const orderId = newId('ord');
      db.prepare(
        `INSERT INTO orders
         (id, student_id, merchant_id, slot_id, dining_mode, total_fen, status, payment_status, version,
          pickup_code, picked_up_at, cancellation_reason, cancel_status, cancel_reason,
          delay_reason, delay_expected_ready_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'NEW', 'SIMULATED_PAID', 1, NULL, NULL, NULL, 'NONE', NULL, NULL, NULL, ?, ?)`,
      ).run(orderId, user.id, merchantId, slot.id, diningMode, totalFen, now, now);

      const insertItem = db.prepare(
        `INSERT INTO order_items (order_id, dish_id, name, quantity, unit_price_fen, merchant_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const { dish, quantity } of dishes) {
        insertItem.run(orderId, dish.id, dish.name, quantity, dish.price_fen, dish.merchant_id);
      }

      const row = loadOrder(db, orderId);
      return { status: 201, body: { data: serializeOrder(db, row, user) } };
    }),
  );
}

export function listStudentOrders({ db, user, query }) {
  const status = parseStatus(query.get('status'));
  const rows = status
    ? db
        .prepare('SELECT * FROM orders WHERE student_id = ? AND status = ? ORDER BY created_at DESC, id DESC')
        .all(user.id, status)
    : db.prepare('SELECT * FROM orders WHERE student_id = ? ORDER BY created_at DESC, id DESC').all(user.id);
  return { status: 200, body: { data: { orders: rows.map((row) => serializeOrder(db, row, user)) } } };
}

export function getOrder({ db, user, params }) {
  const row = loadVisibleOrder(db, user, params.id);
  return { status: 200, body: { data: serializeOrder(db, row, user) } };
}

export function studentCancelOrder({ db, clock, user, params, body }) {
  const input = asRecord(body);
  const now = clock();
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const expectedVersion = input.expectedVersion;
  const reason = input.reason === undefined ? null : requireString(input.reason, 'reason', { min: 1, max: 200 });
  const hash = requestHash(input);

  const row = loadVisibleOrder(db, user, params.id);
  if (user.role !== 'STUDENT' || row.student_id !== user.id) {
    throw forbidden();
  }
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `cancel-order:${row.id}`, requestId, hash, now }, () => {
      const current = loadOrder(db, row.id);
      if (current.status === 'CANCELLED') {
        throw conflict('ALREADY_CANCELLED', '订单已取消，不会重复返还库存或名额。');
      }
      if (!ACTIVE_STATUSES.includes(current.status)) {
        throw conflict('INVALID_ORDER_STATE', '当前订单状态不能取消。');
      }
      assertVersion(current, expectedVersion);
      if (current.status !== 'NEW') {
        if (current.cancel_status === 'PENDING') {
          throw conflict('INVALID_ORDER_STATE', '取消申请正在处理中。');
        }
        db.prepare(
          `UPDATE orders SET cancel_status = 'PENDING', cancel_reason = ?, version = version + 1, updated_at = ?
           WHERE id = ? AND version = ?`,
        ).run(reason, now, current.id, current.version);
        return { status: 200, body: { data: serializeOrder(db, loadOrder(db, current.id), user) } };
      }
      const updated = cancelOrder(db, current, { reason, now });
      return { status: 200, body: { data: serializeOrder(db, updated, user) } };
    }),
  );
}

export function listMerchantOrders({ db, user, query }) {
  const status = parseStatus(query.get('status'));
  const { page, pageSize, offset } = pageParams(query);
  const where = status ? 'AND status = ?' : '';
  const params = status ? [user.merchant_id, status] : [user.merchant_id];
  const rows = db
    .prepare(`SELECT * FROM orders WHERE merchant_id = ? ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM orders WHERE merchant_id = ? ${where}`)
    .get(...params).count;
  return { status: 200, body: { data: { orders: rows.map((row) => serializeOrder(db, row, user)), page, pageSize, total } } };
}

export function advanceOrder({ db, clock, user, params, body }) {
  const input = asRecord(body);
  const now = clock();
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const action = requireEnum(input.action, 'action', ['ACCEPT', 'START_PREPARING', 'MARK_READY']);
  const hash = requestHash(input);
  const row = loadVisibleOrder(db, user, params.id);
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `advance-order:${row.id}`, requestId, hash, now }, () => {
      const current = loadOrder(db, row.id);
      assertVersion(current, input.expectedVersion);
      const transition = {
        ACCEPT: { from: 'NEW', to: 'ACCEPTED' },
        START_PREPARING: { from: 'ACCEPTED', to: 'PREPARING' },
        MARK_READY: { from: 'PREPARING', to: 'READY' },
      }[action];
      if (current.status !== transition.from) {
        throw conflict('INVALID_ORDER_STATE', '订单状态不能跳步或当前状态不允许该操作。');
      }
      const pickupCode = transition.to === 'READY' ? generatePickupCode() : current.pickup_code;
      db.prepare(
        `UPDATE orders SET status = ?, pickup_code = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`,
      ).run(transition.to, pickupCode, now, current.id, current.version);
      return { status: 200, body: { data: serializeOrder(db, loadOrder(db, current.id), user) } };
    }),
  );
}

export function verifyOrder({ db, clock, user, params, body }) {
  const input = asRecord(body);
  const now = clock();
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const pickupCode = requireString(input.pickupCode, 'pickupCode', { min: 1, max: 40 });
  const hash = requestHash(input);
  const row = loadVisibleOrder(db, user, params.id);
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `verify-order:${row.id}`, requestId, hash, now }, () => {
      const current = loadOrder(db, row.id);
      if (current.status === 'COMPLETED' || current.picked_up_at !== null) {
        throw conflict('PICKUP_CODE_USED', '该订单已取餐，请勿重复确认。');
      }
      if (current.status !== 'READY') {
        throw conflict('INVALID_ORDER_STATE', '订单尚未准备好，不能核销。');
      }
      assertVersion(current, input.expectedVersion);
      if (current.pickup_code !== pickupCode) {
        throw conflict('PICKUP_CODE_INVALID', '取餐码不正确。');
      }
      const rejectPending =
        current.cancel_status === 'PENDING'
          ? db.prepare(
              `UPDATE orders SET cancel_status = 'REJECTED', cancel_decision_reason = '订单已取餐'
               WHERE id = ?`,
            )
          : null;
      db.prepare(
        `UPDATE orders
         SET status = 'COMPLETED', pickup_code = NULL, picked_up_at = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`,
      ).run(now, now, current.id, current.version);
      rejectPending?.run(current.id);
      return { status: 200, body: { data: serializeOrder(db, loadOrder(db, current.id), user) } };
    }),
  );
}

export function decideCancellation({ db, clock, user, params, body }) {
  const input = asRecord(body);
  const now = clock();
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const decision = requireEnum(input.decision, 'decision', ['APPROVE', 'REJECT']);
  const reason = requireString(input.reason, 'reason', { min: 1, max: 200 });
  const hash = requestHash(input);
  const row = loadVisibleOrder(db, user, params.id);
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `cancel-decision:${row.id}`, requestId, hash, now }, () => {
      const current = loadOrder(db, row.id);
      assertVersion(current, input.expectedVersion);
      if (current.cancel_status !== 'PENDING') {
        throw conflict('INVALID_ORDER_STATE', '没有待处理的取消申请。');
      }
      if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
        throw conflict('INVALID_ORDER_STATE', '终态订单不能处理取消申请。');
      }
      if (decision === 'REJECT') {
        db.prepare(
          `UPDATE orders SET cancel_status = 'REJECTED', cancel_decision_reason = ?, version = version + 1, updated_at = ?
           WHERE id = ? AND version = ?`,
        ).run(reason, now, current.id, current.version);
        return { status: 200, body: { data: serializeOrder(db, loadOrder(db, current.id), user) } };
      }
      const updated = cancelOrder(db, current, { reason, now });
      return { status: 200, body: { data: serializeOrder(db, updated, user) } };
    }),
  );
}

export function merchantCancelOrder({ db, clock, user, params, body }) {
  const input = asRecord(body);
  const now = clock();
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const reason = requireString(input.reason, 'reason', { min: 1, max: 200 });
  const hash = requestHash(input);
  const row = loadVisibleOrder(db, user, params.id);
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `merchant-cancel:${row.id}`, requestId, hash, now }, () => {
      const current = loadOrder(db, row.id);
      if (current.status === 'CANCELLED') {
        throw conflict('ALREADY_CANCELLED', '订单已取消，不会重复返还库存或名额。');
      }
      if (!ACTIVE_STATUSES.includes(current.status)) {
        throw conflict('INVALID_ORDER_STATE', '当前订单状态不能取消。');
      }
      assertVersion(current, input.expectedVersion);
      const updated = cancelOrder(db, current, { reason, now });
      return { status: 200, body: { data: serializeOrder(db, updated, user) } };
    }),
  );
}

export function setDelay({ db, clock, user, params, body }) {
  const input = asRecord(body);
  const now = clock();
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const reason = requireString(input.reason, 'reason', { min: 1, max: 200 });
  const expectedReadyAt = requireString(input.expectedReadyAt, 'expectedReadyAt', { max: 40 });
  if (Number.isNaN(Date.parse(expectedReadyAt))) {
    throw validationError('expectedReadyAt 必须是带时区的时间。');
  }
  const hash = requestHash(input);
  const row = loadVisibleOrder(db, user, params.id);
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `delay-order:${row.id}`, requestId, hash, now }, () => {
      const current = loadOrder(db, row.id);
      assertVersion(current, input.expectedVersion);
      if (!DELAYABLE_STATUSES.includes(current.status)) {
        throw conflict('INVALID_ORDER_STATE', '只有已接单、制作中或可取餐的订单可以设置延迟。');
      }
      db.prepare(
        `UPDATE orders SET delay_reason = ?, delay_expected_ready_at = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`,
      ).run(reason, expectedReadyAt, now, current.id, current.version);
      return { status: 200, body: { data: serializeOrder(db, loadOrder(db, current.id), user) } };
    }),
  );
}

export function changeDiningMode({ db, clock, user, params, body }) {
  const input = asRecord(body);
  const now = clock();
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const diningMode = requireEnum(input.diningMode, 'diningMode', DINING_MODES);
  const reason = requireString(input.reason, 'reason', { min: 1, max: 200 });
  const hash = requestHash(input);
  const row = loadVisibleOrder(db, user, params.id);
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `dining-mode:${row.id}`, requestId, hash, now }, () => {
      const current = loadOrder(db, row.id);
      assertVersion(current, input.expectedVersion);
      if (!ACTIVE_STATUSES.includes(current.status)) {
        throw conflict('INVALID_ORDER_STATE', '终态订单不能修改用餐方式。');
      }
      db.prepare(
        `UPDATE orders SET dining_mode = ?, dining_mode_reason = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`,
      ).run(diningMode, reason, now, current.id, current.version);
      return { status: 200, body: { data: serializeOrder(db, loadOrder(db, current.id), user) } };
    }),
  );
}

export function updateMerchantDish({ db, clock, user, params, body }) {
  const input = asRecord(body);
  const now = clock();
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const priceFen = requireInteger(input.priceFen, 'priceFen', { min: 0, max: 1_000_000 });
  const availableQuantity = requireInteger(input.availableQuantity, 'availableQuantity', { min: 0, max: 10_000 });
  if (typeof input.onSale !== 'boolean') {
    throw validationError('onSale 必须是布尔值。');
  }
  const hash = requestHash(input);
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(params.dishId);
  if (!dish || dish.merchant_id !== user.merchant_id) {
    throw notFound('DISH_NOT_FOUND', '菜品不存在或不属于本档口。');
  }
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `update-dish:${dish.id}`, requestId, hash, now }, () => {
      assertVersion({ version: dish.version }, input.expectedVersion, {
        code: 'MENU_VERSION_CONFLICT',
        message: '菜品已发生变化，请刷新菜单后重试。',
      });
      db.prepare(
        `UPDATE dishes SET price_fen = ?, available_quantity = ?, on_sale = ?, version = version + 1
         WHERE id = ? AND version = ?`,
      ).run(priceFen, availableQuantity, input.onSale ? 1 : 0, dish.id, dish.version);
      return {
        status: 200,
        body: {
          data: {
            id: dish.id,
            merchantId: dish.merchant_id,
            name: dish.name,
            priceFen,
            availableQuantity,
            onSale: input.onSale,
            version: dish.version + 1,
          },
        },
      };
    }),
  );
}

export function updateMerchantSlot({ db, clock, user, params, body }) {
  const input = asRecord(body);
  const now = clock();
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const capacity = requireInteger(input.capacity, 'capacity', { min: 0, max: 10_000 });
  if (typeof input.enabled !== 'boolean') {
    throw validationError('enabled 必须是布尔值。');
  }
  const hash = requestHash(input);
  if (user.role !== 'MERCHANT' && user.role !== 'ADMIN') {
    throw forbidden();
  }
  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(params.slotId);
  if (!slot) {
    throw notFound('SLOT_NOT_FOUND', '时段不存在。');
  }
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `update-slot:${slot.id}`, requestId, hash, now }, () => {
      assertVersion({ version: slot.version }, input.expectedVersion, {
        code: 'MENU_VERSION_CONFLICT',
        message: '时段已发生变化，请刷新菜单后重试。',
      });
      if (capacity < slot.booked_count) {
        throw conflict('INVALID_ORDER_STATE', '容量不能低于已占用名额。');
      }
      db.prepare('UPDATE slots SET capacity = ?, enabled = ?, version = version + 1 WHERE id = ? AND version = ?').run(
        capacity,
        input.enabled ? 1 : 0,
        slot.id,
        slot.version,
      );
      return {
        status: 200,
        body: {
          data: {
            id: slot.id,
            date: slot.date,
            startAt: toShanghaiIso(slot.start_at),
            endAt: toShanghaiIso(slot.end_at),
            capacity,
            booked: slot.booked_count,
            remainingCapacity: capacity - slot.booked_count,
            enabled: input.enabled,
            version: slot.version + 1,
          },
        },
      };
    }),
  );
}

export function listAdminOrders({ db, user, query }) {
  const { page, pageSize, offset } = pageParams(query);
  const status = parseStatus(query.get('status'));
  const where = status ? 'WHERE status = ?' : '';
  const params = status ? [status] : [];
  const rows = db
    .prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);
  const total = db.prepare(`SELECT COUNT(*) AS count FROM orders ${where}`).get(...params).count;
  return {
    status: 200,
    body: {
      data: {
        orders: rows.map((row) => serializeOrder(db, row, user)),
        page,
        pageSize,
        total,
      },
    },
  };
}

export function listMenu({ db, clock, query }) {
  const now = clock();
  const today = shanghaiDate(now);
  const tomorrow = addDays(today, 1);
  const requested = query.get('date') ?? today;
  if (requested !== today && requested !== tomorrow) {
    throw validationError('只能查询今天或明天的菜单。');
  }
  const slots = db
    .prepare('SELECT * FROM slots WHERE date = ? ORDER BY start_at')
    .all(requested)
    .map((slot) => ({
      id: slot.id,
      date: slot.date,
      startAt: toShanghaiIso(slot.start_at),
      endAt: toShanghaiIso(slot.end_at),
      capacity: slot.capacity,
      booked: slot.booked_count,
      remainingCapacity: Math.max(0, slot.capacity - slot.booked_count),
      enabled: slot.enabled === 1 && slot.end_at > now && slot.booked_count < slot.capacity,
      version: slot.version,
    }));
  const dishes = db
    .prepare('SELECT * FROM dishes ORDER BY merchant_id, id')
    .all()
    .map((dish) => ({
      id: dish.id,
      merchantId: dish.merchant_id,
      name: dish.name,
      priceFen: dish.price_fen,
      availableQuantity: dish.available_quantity,
      onSale: dish.on_sale === 1,
      version: dish.version,
    }));
  return { status: 200, body: { data: { date: requested, slots, dishes } } };
}

export function parseStatus(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (!ORDER_STATUSES.includes(value)) {
    throw validationError('status 取值不正确。');
  }
  return value;
}