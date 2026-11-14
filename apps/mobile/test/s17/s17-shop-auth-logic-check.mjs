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

function gate(kind, usable) {
  return {
    kind,
    usable,
    message: kind === 'ok' ? '' : '不可用',
    identityText: '',
    roleLabel: '',
  };
}

const okGate = gate('ok', true);

try {
  const { deriveShopAuthGate } = await server.ssrLoadModule(
    '/src/modules/student/utils/shopAuthView.ts',
  );
  const { loginGuideContent } = await server.ssrLoadModule(
    '/src/modules/student/components/loginGuideTexts.ts',
  );

  const sampleInput = {
    mode: 'sample',
    gate: gate('missing', false),
    error: null,
  };
  const sampleResult = deriveShopAuthGate(sampleInput);
  check('样例模式不激活登录引导', sampleResult.active === false);
  check('样例模式不改入参', sampleInput.gate.kind === 'missing');

  const missingResult = deriveShopAuthGate({
    mode: 'real',
    gate: gate('missing', false),
    error: null,
  });
  check('未登录会话激活引导', missingResult.active === true);
  check('未登录原因 unauthenticated', missingResult.reason === 'unauthenticated');

  const expiredResult = deriveShopAuthGate({
    mode: 'real',
    gate: gate('expired', false),
    error: null,
  });
  check('过期会话原因 session-expired', expiredResult.reason === 'session-expired');

  const wrongRoleResult = deriveShopAuthGate({
    mode: 'real',
    gate: gate('wrong-role', false),
    error: null,
  });
  check('非学生身份原因 forbidden', wrongRoleResult.reason === 'forbidden');

  const errorInput = { code: 'UNAUTHENTICATED', message: 'x', retryable: false };
  const errorResult = deriveShopAuthGate({
    mode: 'real',
    gate: okGate,
    error: errorInput,
  });
  check('401 错误激活引导', errorResult.active === true && errorResult.reason === 'unauthenticated');
  check('401 错误不改入参', errorInput.code === 'UNAUTHENTICATED');

  const sessionError = deriveShopAuthGate({
    mode: 'real',
    gate: okGate,
    error: { code: 'SESSION_EXPIRED', message: 'x', retryable: false },
  });
  check('SESSION_EXPIRED 原因正确', sessionError.reason === 'session-expired');

  const forbidden = deriveShopAuthGate({
    mode: 'real',
    gate: okGate,
    error: { code: 'FORBIDDEN', message: 'x', retryable: false },
  });
  check('403 原因正确', forbidden.reason === 'forbidden');

  check(
    '网络错误不激活引导',
    deriveShopAuthGate({
      mode: 'real',
      gate: okGate,
      error: { code: 'NETWORK_ERROR', message: 'x', retryable: true },
    }).active === false,
  );
  check(
    '店铺列表不可用不激活引导',
    deriveShopAuthGate({
      mode: 'real',
      gate: okGate,
      error: { code: 'SHOP_LIST_UNAVAILABLE', message: 'x', retryable: true },
    }).active === false,
  );

  const recheck = deriveShopAuthGate({
    mode: 'real',
    gate: gate('missing', false),
    error: null,
    recheckNotice: true,
  });
  check('重检失败提示非空', recheck.notice.length > 0);

  const texts = [];
  for (const reason of ['unauthenticated', 'session-expired', 'forbidden']) {
    for (const scope of ['shop', 'orders', 'detail']) {
      texts.push(loginGuideContent({ reason, scope }));
    }
  }
  check('九条登录文案完整', texts.length === 9);
  check(
    '九条登录文案两两不同',
    new Set(texts.map((item) => `${item.title}|${item.description}`)).size === 9,
  );
  check(
    '登录文案不含错误码',
    texts.every(
      (item) =>
        !/UNAUTHENTICATED|SESSION_EXPIRED|FORBIDDEN|401|403|HTTP|userId|role/.test(
          `${item.title}${item.description}`,
        ),
    ),
  );
  check(
    '店铺 403 文案包含资源名',
    loginGuideContent({ reason: 'forbidden', scope: 'shop' }).description.includes(
      '无法查看学生店铺列表',
    ),
  );
} finally {
  await server.close();
}

console.log(
  failures === 0
    ? 'ALL S17 SHOP AUTH CHECKS PASSED'
    : `${failures} S17 SHOP AUTH CHECK(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);