import {
  conflict,
  forbidden,
  notFound,
  validationError,
} from './errors.mjs';
import { SLOT_DATE_RANGE_DAYS, ensureDateSlots } from './db.mjs';
import {
  parseAddOns,
  parseFlavorGroups,
  parseSides,
  resolveDishImageUrl,
  resolveOrderItemCustomization,
  serializeDish,
} from './dish-customization.mjs';
import { getOwnedMerchantIds, resolveOwnedShop } from './merchant.mjs';
import { generatePickupCode } from './security.mjs';
import { runIdempotent, transaction } from './tx.mjs';
import {
  asRecord,
  newId,
  nowIso,
  requestHash,
  requireEnum,
  requireInteger,
  requireOnlyFields,
  requireString,
  toShanghaiIso,
  shanghaiDate,
  addDays,
} from './util.mjs';
import { recordOrderSettlement } from './wallet.mjs';

export { runIdempotent, transaction };

const ORDER_STATUSES = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'CANCELLED', 'COMPLETED'];
const ACTIVE_STATUSES = ['NEW', 'ACCEPTED', 'PREPARING', 'READY'];
const DELAYABLE_STATUSES = ['ACCEPTED', 'PREPARING', 'READY'];
const UNSTARTED_STATUSES = ['NEW', 'ACCEPTED'];
const DINING_MODES = ['DINE_IN', 'TAKEAWAY'];
const DISH_TYPES = ['STAPLE', 'SNACK', 'DRINK', 'SET'];

function parseOrderRemark(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw validationError('remark 必须是字符串。');
  }
  const text = value.trim();
  if (text.length > 50) {
    throw validationError('remark 不能超过 50 个字。');
  }
  return text === '' ? null : text;
}

function loadOrder(db, orderId) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) ?? null;
}

function loadItems(db, orderId) {
  return db
    .prepare(
      'SELECT dish_id, name, quantity, unit_price_fen, merchant_id, customization_json FROM order_items WHERE order_id = ? ORDER BY item_index, rowid',
    )
    .all(orderId);
}

export function serializeOrder(db, row, user) {
  const items = loadItems(db, row.id).map((item) => {
    let customization = null;
    if (typeof item.customization_json === 'string' && item.customization_json.length > 0) {
      try {
        customization = JSON.parse(item.customization_json);
      } catch {
        customization = null;
      }
    }
    return {
      dishId: item.dish_id,
      name: item.name,
      quantity: item.quantity,
      unitPriceFen: item.unit_price_fen,
      customization,
    };
  });
  const canSeePickupCode =
    user.role === 'STUDENT' &&
    row.student_id === user.id &&
    row.status === 'READY' &&
    row.picked_up_at === null;
  return {
    id: row.id,
    merchantId: row.merchant_id,
    shopId: row.shop_id ?? null,
    merchantName: row.merchant_name ?? null,
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
    remark: row.remark ?? null,
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
  if (user.role === 'MERCHANT' && !getOwnedMerchantIds(db, user).includes(row.merchant_id)) {
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
  const hasDailyMenu = Boolean(
    db
      .prepare('SELECT 1 FROM daily_menu_days WHERE merchant_id = ? AND date = ?')
      .get(row.merchant_id, slot.date),
  );
  const restoreDaily = db.prepare(
    'UPDATE daily_menu_items SET available_quantity = available_quantity + ? WHERE merchant_id = ? AND date = ? AND dish_id = ?',
  );
  const restoreDish = db.prepare(
    'UPDATE dishes SET available_quantity = available_quantity + ?, version = version + 1 WHERE id = ?',
  );
  for (const item of loadItems(db, row.id)) {
    if (hasDailyMenu) {
      const updated = restoreDaily.run(item.quantity, row.merchant_id, slot.date, item.dish_id);
      if (updated.changes === 0) {
        restoreDish.run(item.quantity, item.dish_id);
      }
    } else {
      restoreDish.run(item.quantity, item.dish_id);
    }
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

function allowedOrderDates(now) {
  const today = shanghaiDate(now);
  return Array.from({ length: SLOT_DATE_RANGE_DAYS }, (_, index) => addDays(today, index));
}

export function createOrder({ db, clock, user, body }) {
  const input = asRecord(body);
  const now = clock();
  const allowedDates = allowedOrderDates(now);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const slotId = requireString(input.slotId, 'slotId', { max: 120 });
  const diningMode = requireEnum(input.diningMode, 'diningMode', DINING_MODES);
  const remark = parseOrderRemark(input.remark);
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 20) {
    throw validationError('items 必须包含 1 到 20 个菜品。');
  }

  const rawLineItems = [];
  const quantities = new Map();
  for (const rawItem of input.items) {
    const item = asRecord(rawItem);
    for (const key of Object.keys(item)) {
      if (!['dishId', 'quantity', 'selectedFlavors', 'selectedSides', 'selectedAddOns'].includes(key)) {
        throw validationError('items 只允许 dishId、quantity、selectedFlavors、selectedSides 与 selectedAddOns。');
      }
    }
    const dishId = requireString(item.dishId, 'items[].dishId', { max: 120 });
    const quantity = requireInteger(item.quantity, 'items[].quantity', { min: 1, max: 99 });
    rawLineItems.push({ dishId, quantity, rawItem: item });
    quantities.set(dishId, (quantities.get(dishId) ?? 0) + quantity);
  }

  const hash = requestHash(input);
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: 'create-order', requestId, hash, now }, () => {
      const slotDateMatch = /^slot-(\d{4}-\d{2}-\d{2})-/.exec(slotId);
      if (slotDateMatch && allowedDates.includes(slotDateMatch[1])) {
        ensureDateSlots(db, slotDateMatch[1]);
      }
      const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
      if (!slot) {
        throw notFound('SLOT_NOT_FOUND', '所选时段不存在。');
      }
      if (!slot.enabled || !allowedDates.includes(slot.date)) {
        throw conflict('SLOT_CLOSED', '该时段已停用或日期不可预约，请选择其他时段。');
      }

      const dishById = new Map();
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
        dishById.set(dishId, dish);
      }

      const merchantIds = new Set([...dishById.values()].map((dish) => dish.merchant_id));
      if (merchantIds.size !== 1) {
        throw validationError('同一订单只能包含同一档口的菜品。');
      }
      const merchantId = [...merchantIds][0];
      const merchantRow = db.prepare('SELECT id, name, status FROM merchants WHERE id = ?').get(merchantId);
      const shopRow = db
        .prepare('SELECT id, name, status FROM shops WHERE merchant_id = ? ORDER BY created_at ASC, rowid ASC LIMIT 1')
        .get(merchantId);
      const activeStatus = shopRow?.status ?? merchantRow?.status;
      if (activeStatus !== 'ACTIVE') {
        throw conflict('MERCHANT_CLOSED', '该档口当前已停用，暂不可下单。');
      }

      const hasDailyMenu = Boolean(
        db
          .prepare('SELECT 1 FROM daily_menu_days WHERE merchant_id = ? AND date = ?')
          .get(merchantId, slot.date),
      );
      if (hasDailyMenu) {
        const findDailyItem = db.prepare(
          'SELECT available_quantity FROM daily_menu_items WHERE merchant_id = ? AND date = ? AND dish_id = ?',
        );
        const deductDailyItem = db.prepare(
          `UPDATE daily_menu_items SET available_quantity = available_quantity - ?
           WHERE merchant_id = ? AND date = ? AND dish_id = ? AND available_quantity >= ?`,
        );
        for (const [dishId, quantity] of quantities) {
          const dailyRow = findDailyItem.get(merchantId, slot.date, dishId);
          if (!dailyRow) {
            throw conflict('OUT_OF_STOCK', '所选菜品今日未上架，请刷新菜单。');
          }
          const changed = deductDailyItem.run(quantity, merchantId, slot.date, dishId, quantity);
          if (changed.changes !== 1) {
            throw conflict('OUT_OF_STOCK', '所选菜品数量不足，请调整数量。');
          }
        }
      } else {
        const updateDish = db.prepare(
          `UPDATE dishes SET available_quantity = available_quantity - ?, version = version + 1
           WHERE id = ? AND available_quantity >= ?`,
        );
        for (const [dishId, quantity] of quantities) {
          const changed = updateDish.run(quantity, dishId, quantity);
          if (changed.changes !== 1) {
            throw conflict('OUT_OF_STOCK', '所选菜品数量不足，请调整数量。');
          }
        }
      }

      const resolvedLines = rawLineItems.map((line) => {
        const dish = dishById.get(line.dishId);
        const { extraUnitPriceFen, customization } = resolveOrderItemCustomization(dish, line.rawItem);
        return {
          dish,
          quantity: line.quantity,
          unitPriceFen: dish.price_fen + extraUnitPriceFen,
          customization,
        };
      });

      db
        .prepare(
          `UPDATE slots SET booked_count = booked_count + 1, version = version + 1
           WHERE id = ? AND enabled = 1`,
        )
        .run(slot.id);

      const totalFen = resolvedLines.reduce((sum, line) => sum + line.unitPriceFen * line.quantity, 0);
      const orderId = newId('ord');
      const snapshotName = shopRow?.name ?? merchantRow?.name ?? null;
      db.prepare(
        `INSERT INTO orders
         (id, student_id, merchant_id, shop_id, merchant_name, slot_id, dining_mode, remark, total_fen, status, payment_status, version,
          pickup_code, picked_up_at, cancellation_reason, cancel_status, cancel_reason,
          delay_reason, delay_expected_ready_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 'SIMULATED_PAID', 1, NULL, NULL, NULL, 'NONE', NULL, NULL, NULL, ?, ?)`,
      ).run(
        orderId,
        user.id,
        merchantId,
        shopRow?.id ?? null,
        snapshotName,
        slot.id,
        diningMode,
        remark,
        totalFen,
        now,
        now,
      );

      const insertItem = db.prepare(
        `INSERT INTO order_items (order_id, item_index, dish_id, name, quantity, unit_price_fen, merchant_id, customization_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      resolvedLines.forEach((line, index) => {
        insertItem.run(
          orderId,
          index,
          line.dish.id,
          line.dish.name,
          line.quantity,
          line.unitPriceFen,
          line.dish.merchant_id,
          line.customization ? JSON.stringify(line.customization) : null,
        );
      });

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
  const shopIdParam = query.get('shopId');
  let merchantIds;
  if (shopIdParam) {
    const shop = resolveOwnedShop(db, user, shopIdParam);
    merchantIds = [shop.merchant_id];
  } else {
    merchantIds = getOwnedMerchantIds(db, user);
  }
  const { page, pageSize, offset } = pageParams(query);
  if (merchantIds.length === 0) {
    return { status: 200, body: { data: { orders: [], page, pageSize, total: 0 } } };
  }
  const placeholders = merchantIds.map(() => '?').join(', ');
  const where = status ? `AND status = ?` : '';
  const params = status ? [...merchantIds, status] : [...merchantIds];
  const rows = db
    .prepare(`SELECT * FROM orders WHERE merchant_id IN (${placeholders}) ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM orders WHERE merchant_id IN (${placeholders}) ${where}`)
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
      const updatedOrder = loadOrder(db, current.id);
      recordOrderSettlement(db, {
        orderRow: updatedOrder,
        items: loadItems(db, current.id),
        now,
      });
      return { status: 200, body: { data: serializeOrder(db, updatedOrder, user) } };
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
  requireOnlyFields(input, [
    'requestId',
    'expectedVersion',
    'name',
    'type',
    'priceFen',
    'availableQuantity',
    'onSale',
    'imageUrl',
    'flavorGroups',
    'sides',
    'addOns',
  ]);
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
  if (!dish || !getOwnedMerchantIds(db, user).includes(dish.merchant_id)) {
    throw notFound('DISH_NOT_FOUND', '菜品不存在或不属于本档口。');
  }
  const name = input.name === undefined
    ? dish.name
    : requireString(input.name, 'name', { min: 1, max: 30 }).trim();
  if (name.length === 0) {
    throw validationError('name 不能为空。');
  }
  const type = input.type === undefined
    ? dish.type
    : requireEnum(input.type, 'type', DISH_TYPES);
  const nextFlavorGroupsJson =
    input.flavorGroups !== undefined ? JSON.stringify(parseFlavorGroups(input.flavorGroups)) : dish.flavor_groups_json;
  const nextSidesJson =
    input.sides !== undefined ? JSON.stringify(parseSides(input.sides)) : dish.sides_json;
  const nextAddOnsJson =
    input.addOns !== undefined ? JSON.stringify(parseAddOns(input.addOns)) : dish.add_ons_json;

  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `update-dish:${dish.id}`, requestId, hash, now }, () => {
      assertVersion({ version: dish.version }, input.expectedVersion, {
        code: 'MENU_VERSION_CONFLICT',
        message: '菜品已发生变化，请刷新菜单后重试。',
      });
      if (name !== dish.name) {
        const duplicate = db
          .prepare('SELECT id FROM dishes WHERE merchant_id = ? AND name = ? AND id <> ?')
          .get(dish.merchant_id, name, dish.id);
        if (duplicate) {
          throw conflict('DISH_NAME_DUPLICATE', '同店菜品名称不能重复。');
        }
      }
      const nextImageUrl =
        input.imageUrl !== undefined
          ? resolveDishImageUrl(input.imageUrl, {
              db,
              merchantId: dish.merchant_id,
              ownerUserId: user.id,
              now,
            })
          : dish.image_url;
      db.prepare(
        `UPDATE dishes
         SET name = ?, type = ?, price_fen = ?, available_quantity = ?, on_sale = ?,
             image_url = ?, flavor_groups_json = ?, sides_json = ?, add_ons_json = ?,
             version = version + 1
         WHERE id = ? AND version = ?`,
      ).run(
        name,
        type,
        priceFen,
        availableQuantity,
        input.onSale ? 1 : 0,
        nextImageUrl,
        nextFlavorGroupsJson,
        nextSidesJson,
        nextAddOnsJson,
        dish.id,
        dish.version,
      );
      const updated = db.prepare('SELECT * FROM dishes WHERE id = ?').get(dish.id);
      return {
        status: 200,
        body: {
          data: serializeDish(updated),
        },
      };
    }),
  );
}

export function deleteMerchantDish({ db, clock, user, params, body }) {
  const input = asRecord(body);
  const now = clock();
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const hash = requestHash(input);
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(params.dishId);
  if (!dish || !getOwnedMerchantIds(db, user).includes(dish.merchant_id)) {
    throw notFound('DISH_NOT_FOUND', '菜品不存在或不属于本档口。');
  }
  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `delete-dish:${dish.id}`, requestId, hash, now }, () => {
      assertVersion({ version: dish.version }, input.expectedVersion, {
        code: 'MENU_VERSION_CONFLICT',
        message: '菜品已发生变化，请刷新菜单后重试。',
      });
      const active = db
        .prepare(
          `SELECT COUNT(*) AS count FROM orders o
           JOIN order_items i ON i.order_id = o.id
           WHERE i.dish_id = ? AND o.merchant_id = ?
             AND o.status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY')`,
        )
        .get(dish.id, dish.merchant_id);
      if (active.count > 0) {
        throw conflict('DISH_IN_USE', '该菜品存在未结束订单，暂不能删除；可先改为停售。');
      }
      db.prepare('DELETE FROM daily_menu_items WHERE dish_id = ?').run(dish.id);
      const removed = db
        .prepare('DELETE FROM dishes WHERE id = ? AND version = ?')
        .run(dish.id, dish.version);
      if (removed.changes !== 1) {
        throw conflict('MENU_VERSION_CONFLICT', '菜品已发生变化，请刷新菜单后重试。');
      }
      return { status: 200, body: { data: { id: dish.id } } };
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
            remainingCapacity: Math.max(0, capacity - slot.booked_count),
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
  const allowedDates = allowedOrderDates(now);
  const requested = query.get('date') ?? allowedDates[0];
  if (!allowedDates.includes(requested)) {
    throw validationError('只能查询未来 7 天内的菜单。');
  }
  ensureDateSlots(db, requested);
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
      enabled: slot.enabled === 1,
      version: slot.version,
    }));

  const configuredMerchants = new Set(
    db.prepare('SELECT merchant_id FROM daily_menu_days WHERE date = ?').all(requested).map((row) => row.merchant_id),
  );
  const dailyOverrides = new Map();
  if (configuredMerchants.size > 0) {
    for (const row of db
      .prepare('SELECT merchant_id, dish_id, available_quantity FROM daily_menu_items WHERE date = ?')
      .all(requested)) {
      if (!dailyOverrides.has(row.merchant_id)) {
        dailyOverrides.set(row.merchant_id, new Map());
      }
      dailyOverrides.get(row.merchant_id).set(row.dish_id, row.available_quantity);
    }
  }

  const dishes = [];
  for (const dish of db.prepare('SELECT * FROM dishes ORDER BY merchant_id, id').all()) {
    if (configuredMerchants.has(dish.merchant_id)) {
      const overrides = dailyOverrides.get(dish.merchant_id);
      if (!overrides || !overrides.has(dish.id)) {
        continue;
      }
      dishes.push(serializeDish({ ...dish, available_quantity: overrides.get(dish.id) }));
    } else {
      dishes.push(serializeDish(dish));
    }
  }
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
