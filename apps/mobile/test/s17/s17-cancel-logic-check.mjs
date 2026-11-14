import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDir, '../..');
const viteEntry = pathToFileURL(join(mobileRoot, 'node_modules/vite/dist/node/index.js')).href;
const { createServer } = await import(viteEntry);

const server = await createServer({
  configFile: false,
  root: mobileRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ''}`);
  }
}

function order(overrides = {}) {
  return {
    id: 'demo-order-001',
    merchantId: 'demo-merchant-01',
    merchantName: '一食堂·家常档',
    items: [{ dishId: 'demo-dish-01', name: '演示鸡肉饭', quantity: 1, unitPriceFen: 2000 }],
    slotId: 'demo-slot-1',
    slotStart: '2026-11-15T11:30:00+08:00',
    slotEnd: '2026-11-15T12:00:00+08:00',
    diningMode: 'DINE_IN',
    totalFen: 2000,
    status: 'NEW',
    paymentStatus: 'SIMULATED_PAID',
    cancelRequest: { status: 'NONE', reason: null, decisionReason: null },
    cancellationReason: null,
    version: 1,
    createdAt: '2026-11-14T15:20:00+08:00',
    updatedAt: '2026-11-14T15:40:00+08:00',
    pickedUpAt: null,
    delay: null,
    pickupCode: null,
    demo: false,
    ...overrides,
  };
}

try {
  const { deriveCancelAreaView } = await server.ssrLoadModule(
    '/src/modules/student/utils/orderCancelView.ts',
  );
  const { cancelErrorText } = await server.ssrLoadModule(
    '/src/modules/student/utils/cancelTexts.ts',
  );
  const { initialCancelState, reduceCancel, validateCancelReason } = await server.ssrLoadModule(
    '/src/modules/student/state/orderCancel.ts',
  );
  const { buildCancelFingerprint, createRequestIdKeeper, CANCEL_REQUEST_PREFIX } =
    await server.ssrLoadModule('/src/modules/student/utils/requestId.ts');

  const sample = deriveCancelAreaView(order(), { mode: 'sample' });
  check('样例模式显示只读说明', sample.kind === 'sample' && sample.actionLabel === null);

  const created = deriveCancelAreaView(order(), { mode: 'real' });
  check('NEW 可直接取消', created.kind === 'new' && created.actionLabel === '取消订单');

  const accepted = deriveCancelAreaView(order({ status: 'ACCEPTED' }), { mode: 'real' });
  check('ACCEPTED 需申请取消', accepted.kind === 'apply' && accepted.reasonRequired === true);

  const pendingReady = deriveCancelAreaView(
    order({ status: 'READY', cancelRequest: { status: 'PENDING', reason: '临时有事', decisionReason: null } }),
    { mode: 'real' },
  );
  check('READY+PENDING 不可再提交', pendingReady.kind === 'pending' && pendingReady.actionLabel === null);
  check('READY+PENDING 提示仍可取餐', pendingReady.noticeText.includes('仍可取餐'));

  const rejected = deriveCancelAreaView(
    order({
      status: 'PREPARING',
      cancelRequest: { status: 'REJECTED', reason: '临时有事', decisionReason: '已开始制作' },
    }),
    { mode: 'real' },
  );
  check('REJECTED 可再次申请', rejected.kind === 'rejected' && rejected.actionLabel === '再次申请');
  check('REJECTED 展示档口理由', rejected.decisionReason === '已开始制作');

  const approved = deriveCancelAreaView(
    order({
      status: 'CANCELLED',
      paymentStatus: 'SIMULATED_REFUNDED',
      cancelRequest: { status: 'APPROVED', reason: '临时有事', decisionReason: '已批准' },
    }),
    { mode: 'real' },
  );
  check('APPROVED 展示模拟退款', approved.kind === 'approved' && approved.resultText.includes('模拟退款'));

  const invalid = deriveCancelAreaView(
    order({ status: 'NEW', cancelRequest: { status: 'PENDING', reason: 'x', decisionReason: null } }),
    { mode: 'real' },
  );
  check('NEW+PENDING 判定非法组合', invalid.kind === 'invalid' && invalid.actionLabel === null);

  const completed = deriveCancelAreaView(order({ status: 'COMPLETED' }), { mode: 'real' });
  check('COMPLETED 无取消按钮', completed.kind === 'none' && completed.actionLabel === null);

  check('空理由被拒绝', validateCancelReason('   ').ok === false);
  check('201 字理由被拒绝', validateCancelReason('字'.repeat(201)).ok === false);
  const trimmed = validateCancelReason('  临时有事  ');
  check('合法理由去首尾空白', trimmed.ok === true && trimmed.reason === '临时有事');
  check('控制字符被拒绝', validateCancelReason('临时\n有事').ok === false);

  const keeper = createRequestIdKeeper({ prefix: CANCEL_REQUEST_PREFIX });
  const first = keeper.ensure(buildCancelFingerprint({ orderId: 'o1', reason: '临时有事' }));
  const same = keeper.ensure(buildCancelFingerprint({ orderId: 'o1', reason: ' 临时有事 ' }));
  check('同单同理由复用请求号', first === same);
  const changed = keeper.ensure(buildCancelFingerprint({ orderId: 'o1', reason: '换一个理由' }));
  check('理由变化换请求号', changed !== first);
  keeper.complete();
  const afterComplete = keeper.ensure(buildCancelFingerprint({ orderId: 'o1', reason: '换一个理由' }));
  check('complete 后换请求号', afterComplete !== changed);

  let state = initialCancelState();
  state = reduceCancel(state, { type: 'open-confirm' });
  check('打开确认相位', state.phase === 'confirming');
  state = reduceCancel(state, { type: 'submit', requestId: 'req-1' });
  check('提交相位保留请求号', state.phase === 'submitting' && state.requestId === 'req-1');
  const conflict = reduceCancel(state, { type: 'conflict' });
  check('冲突清空请求号', conflict.phase === 'conflict-read' && conflict.requestId === null);
  const retry = reduceCancel(state, { type: 'retryable-fail' });
  check('可重试失败保留请求号', retry.phase === 'retry-pending' && retry.requestId === 'req-1');

  check(
    '错误文案不含码串',
    ['ORDER_VERSION_CONFLICT', 'INVALID_ORDER_STATE', 'REQUEST_CONFLICT', 'FORBIDDEN']
      .map((code) => cancelErrorText(code))
      .every((text) => !/ORDER_VERSION_CONFLICT|INVALID_ORDER_STATE|REQUEST_CONFLICT|FORBIDDEN/.test(text)),
  );
} finally {
  await server.close();
}

console.log(
  failures === 0
    ? 'ALL S17 CANCEL CHECKS PASSED'
    : `${failures} S17 CANCEL CHECK(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);