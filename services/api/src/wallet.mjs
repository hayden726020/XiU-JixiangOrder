import { conflict, forbidden, validationError } from './errors.mjs';
import { getOwnedMerchantIds, resolveOwnedShop } from './merchant.mjs';
import { runIdempotent, transaction } from './tx.mjs';
import {
  asRecord,
  newId,
  requestHash,
  requireInteger,
  requireOnlyFields,
  requireString,
  toShanghaiIso,
} from './util.mjs';

function buildIncomeLabel(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '订单收入';
  }
  const first = items[0];
  const suffix = first.quantity > 1 ? ` ×${first.quantity}` : '';
  const extra = items.length > 1 ? ` 等${items.length}项` : '';
  return `订单收入 · ${first.name}${suffix}${extra}`;
}

export function recordOrderSettlement(db, { orderRow, items, now }) {
  if (!orderRow || orderRow.status !== 'COMPLETED' || orderRow.payment_status !== 'SIMULATED_PAID') {
    return;
  }
  if (!Number.isInteger(orderRow.total_fen) || orderRow.total_fen <= 0) {
    return;
  }
  const merchant = db.prepare('SELECT owner_user_id FROM merchants WHERE id = ?').get(orderRow.merchant_id);
  const label = buildIncomeLabel(items);
  db.prepare(
    `INSERT INTO wallet_entries (id, merchant_id, owner_user_id, kind, order_id, label, amount_fen, created_at)
     VALUES (?, ?, ?, 'income', ?, ?, ?, ?)
     ON CONFLICT(order_id) DO NOTHING`,
  ).run(
    newId('we'),
    orderRow.merchant_id,
    merchant?.owner_user_id ?? null,
    orderRow.id,
    label,
    orderRow.total_fen,
    now,
  );
}

export function syncMerchantWallet(db, merchantIds) {
  if (!Array.isArray(merchantIds) || merchantIds.length === 0) {
    return;
  }
  const placeholders = merchantIds.map(() => '?').join(', ');
  const missingOrders = db
    .prepare(
      `SELECT o.* FROM orders o
       LEFT JOIN wallet_entries w ON w.order_id = o.id
       WHERE o.merchant_id IN (${placeholders})
         AND o.status = 'COMPLETED'
         AND o.payment_status = 'SIMULATED_PAID'
         AND o.total_fen > 0
         AND w.id IS NULL`,
    )
    .all(...merchantIds);
  if (missingOrders.length === 0) {
    return;
  }
  const loadItemsStmt = db.prepare(
    'SELECT dish_id, name, quantity, unit_price_fen FROM order_items WHERE order_id = ? ORDER BY item_index, rowid',
  );
  for (const orderRow of missingOrders) {
    const items = loadItemsStmt.all(orderRow.id);
    recordOrderSettlement(db, {
      orderRow,
      items,
      now: orderRow.picked_up_at ?? orderRow.updated_at ?? orderRow.created_at,
    });
  }
}

function readWalletSummary(db, merchantIds) {
  if (merchantIds.length === 0) {
    return {
      balanceFen: 0,
      totalIncomeFen: 0,
      totalWithdrawnFen: 0,
      pendingSettlementFen: 0,
      entries: [],
      demo: true,
    };
  }
  const placeholders = merchantIds.map(() => '?').join(', ');
  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_fen ELSE 0 END), 0) AS total_income_fen,
         COALESCE(SUM(CASE WHEN kind = 'withdraw' THEN amount_fen ELSE 0 END), 0) AS total_withdrawn_fen
       FROM wallet_entries
       WHERE merchant_id IN (${placeholders})`,
    )
    .get(...merchantIds);
  const pending = db
    .prepare(
      `SELECT COALESCE(SUM(total_fen), 0) AS pending_fen
       FROM orders
       WHERE merchant_id IN (${placeholders})
         AND status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY')
         AND payment_status = 'SIMULATED_PAID'`,
    )
    .get(...merchantIds);
  const rows = db
    .prepare(
      `SELECT id, merchant_id, kind, order_id, label, amount_fen, created_at
       FROM wallet_entries
       WHERE merchant_id IN (${placeholders})
       ORDER BY created_at DESC, rowid DESC
       LIMIT 100`,
    )
    .all(...merchantIds);
  const totalIncomeFen = totals?.total_income_fen ?? 0;
  const totalWithdrawnFen = totals?.total_withdrawn_fen ?? 0;
  return {
    balanceFen: totalIncomeFen - totalWithdrawnFen,
    totalIncomeFen,
    totalWithdrawnFen,
    pendingSettlementFen: pending?.pending_fen ?? 0,
    entries: rows.map((row) => ({
      id: row.id,
      merchantId: row.merchant_id,
      kind: row.kind,
      orderId: row.order_id ?? null,
      label: row.label,
      amountFen: row.amount_fen,
      createdAt: toShanghaiIso(row.created_at),
    })),
    demo: true,
  };
}

export function getMerchantWallet({ db, user, query }) {
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
  syncMerchantWallet(db, merchantIds);
  return {
    status: 200,
    body: { data: readWalletSummary(db, merchantIds) },
  };
}

export function withdrawMerchantWallet({ db, clock, user, body }) {
  if (user.role !== 'MERCHANT') {
    throw forbidden();
  }
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'amountFen', 'shopId', 'label']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const amountFen = requireInteger(input.amountFen, 'amountFen', { min: 1, max: 10_000_000 });
  const label =
    input.label === undefined || input.label === null
      ? '模拟提现到结算账户'
      : requireString(input.label, 'label', { min: 1, max: 40 });
  let shopId = null;
  if (input.shopId !== undefined && input.shopId !== null) {
    shopId = requireString(input.shopId, 'shopId', { max: 120 });
  }
  const hash = requestHash(input);
  const now = clock();

  return transaction(db, () =>
    runIdempotent(
      db,
      { actorId: user.id, operation: 'merchant-wallet-withdraw', requestId, hash, now },
      () => {
        let targetMerchantId;
        let merchantIds;
        if (shopId) {
          const shop = resolveOwnedShop(db, user, shopId);
          targetMerchantId = shop.merchant_id;
          merchantIds = [shop.merchant_id];
        } else {
          merchantIds = getOwnedMerchantIds(db, user);
          targetMerchantId = user.merchant_id ?? merchantIds[0];
        }
        if (!targetMerchantId) {
          throw conflict('MERCHANT_NOT_REGISTERED', '请先完成商家注册。');
        }
        syncMerchantWallet(db, merchantIds);
        const current = readWalletSummary(db, merchantIds);
        if (amountFen > current.balanceFen) {
          throw conflict('INSUFFICIENT_BALANCE', '可提现余额不足。');
        }
        db.prepare(
          `INSERT INTO wallet_entries (id, merchant_id, owner_user_id, kind, order_id, label, amount_fen, created_at)
           VALUES (?, ?, ?, 'withdraw', NULL, ?, ?, ?)`,
        ).run(newId('we'), targetMerchantId, user.id, label, amountFen, now);
        return {
          status: 201,
          body: { data: readWalletSummary(db, merchantIds) },
        };
      },
    ),
  );
}
