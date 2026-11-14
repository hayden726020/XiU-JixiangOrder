import { createRequestHandler, readJsonBody } from './http.mjs';
import { authenticate, createSession, findUserByAccount, requireRole, toUserView, tokenHash, verifyPassword } from './security.mjs';
import { readSetting } from './db.mjs';
import { ApiError, forbidden } from './errors.mjs';
import { asRecord, requireOnlyFields, requireString, toShanghaiIso } from './util.mjs';
import {
  advanceOrder,
  changeDiningMode,
  createOrder,
  decideCancellation,
  getOrder,
  listAdminOrders,
  listMenu,
  listMerchantOrders,
  listStudentOrders,
  merchantCancelOrder,
  setDelay,
  studentCancelOrder,
  updateMerchantDish,
  updateMerchantSlot,
  verifyOrder,
} from './orders.mjs';
import {
  deleteLocation,
  getCrowd,
  getDiningConfig,
  getHealth,
  reportLocation,
} from './location.mjs';
import { getAdminSettings, putAdminSettings } from './admin.mjs';
import { createDish, createShop, getMerchantProfile, listMerchants, registerMerchant } from './merchant.mjs';

function withAuth(roles, handler) {
  return async (ctx) => {
    const user = authenticate(ctx.db, ctx.req, ctx.clock);
    if (roles && !roles.includes(user.role)) {
      throw forbidden();
    }
    return handler({ ...ctx, user });
  };
}

function withBody(roles, handler) {
  return withAuth(roles, async (ctx) => {
    const body = await readJsonBody(ctx.req);
    return handler({ ...ctx, body });
  });
}

function queryOf(req) {
  return new URL(req.url ?? '/', 'http://localhost').searchParams;
}

async function demoLogin(ctx) {
  const body = asRecord(await readJsonBody(ctx.req));
  requireOnlyFields(body, ['account', 'password']);
  const account = requireString(body.account, 'account', { max: 120 });
  const password = requireString(body.password, 'password', { min: 1, max: 200 });
  const user = findUserByAccount(ctx.db, account);
  if (!user || !verifyPassword(password, user.password_stored)) {
    throw new ApiError('UNAUTHENTICATED', '账号或密码不正确。', 401, false);
  }
  const { token, expiresAt } = createSession(ctx.db, user.id, ctx.clock);
  return {
    status: 200,
    body: {
      data: {
        token,
        tokenType: 'Bearer',
        expiresAt: toShanghaiIso(expiresAt),
        user: toUserView(user),
      },
    },
  };
}

async function logout(ctx) {
  const header = ctx.req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (token.length > 0) {
    ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
  }
  return { status: 204 };
}

function me(ctx) {
  const dining = readSetting(ctx.db, 'dining_config');
  return {
    status: 200,
    body: {
      data: {
        user: toUserView(ctx.user),
        canteenId: dining?.value?.canteenId ?? null,
      },
    },
  };
}

export function createApp({ db, clock, logger = () => {} }) {
  const routes = [
    { method: 'GET', pattern: /^\/api\/v1\/health$/, handler: getHealth },
    { method: 'POST', pattern: /^\/api\/v1\/auth\/demo-login$/, handler: demoLogin },
    { method: 'POST', pattern: /^\/api\/v1\/auth\/logout$/, handler: withAuth(null, logout) },
    { method: 'GET', pattern: /^\/api\/v1\/me$/, handler: withAuth(null, me) },

    { method: 'GET', pattern: /^\/api\/v1\/dining\/config$/, handler: getDiningConfig },
    { method: 'GET', pattern: /^\/api\/v1\/menu$/, handler: (ctx) => listMenu({ ...ctx, query: queryOf(ctx.req) }) },
    { method: 'GET', pattern: /^\/api\/v1\/merchants$/, handler: withAuth(null, listMerchants) },
    { method: 'GET', pattern: /^\/api\/v1\/crowd$/, handler: (ctx) => getCrowd({ ...ctx, query: queryOf(ctx.req) }) },

    { method: 'POST', pattern: /^\/api\/v1\/orders$/, handler: withBody(['STUDENT'], createOrder) },
    {
      method: 'GET',
      pattern: /^\/api\/v1\/orders$/,
      handler: withAuth(['STUDENT'], (ctx) => listStudentOrders({ ...ctx, query: queryOf(ctx.req) })),
    },
    {
      method: 'GET',
      pattern: /^\/api\/v1\/orders\/(?<id>[^/]+)$/,
      handler: withAuth(null, (ctx) => getOrder({ ...ctx, params: decodeParams(ctx.params) })),
    },
    {
      method: 'POST',
      pattern: /^\/api\/v1\/orders\/(?<id>[^/]+)\/cancel$/,
      handler: withBody(['STUDENT'], (ctx) => studentCancelOrder({ ...ctx, params: decodeParams(ctx.params) })),
    },

    {
      method: 'GET',
      pattern: /^\/api\/v1\/merchant\/profile$/,
      handler: withAuth(['MERCHANT'], getMerchantProfile),
    },
    {
      method: 'POST',
      pattern: /^\/api\/v1\/merchant\/registration$/,
      handler: withBody(['MERCHANT'], registerMerchant),
    },
    {
      method: 'POST',
      pattern: /^\/api\/v1\/merchant\/shops$/,
      handler: withBody(['MERCHANT'], createShop),
    },
    {
      method: 'POST',
      pattern: /^\/api\/v1\/merchant\/menu$/,
      handler: withBody(['MERCHANT'], createDish),
    },

    {
      method: 'GET',
      pattern: /^\/api\/v1\/merchant\/orders$/,
      handler: withAuth(['MERCHANT'], (ctx) => listMerchantOrders({ ...ctx, query: queryOf(ctx.req) })),
    },
    {
      method: 'POST',
      pattern: /^\/api\/v1\/merchant\/orders\/(?<id>[^/]+)\/advance$/,
      handler: withBody(['MERCHANT'], (ctx) => advanceOrder({ ...ctx, params: decodeParams(ctx.params) })),
    },
    {
      method: 'POST',
      pattern: /^\/api\/v1\/merchant\/orders\/(?<id>[^/]+)\/verify$/,
      handler: withBody(['MERCHANT'], (ctx) => verifyOrder({ ...ctx, params: decodeParams(ctx.params) })),
    },
    {
      method: 'POST',
      pattern: /^\/api\/v1\/merchant\/orders\/(?<id>[^/]+)\/cancel-decision$/,
      handler: withBody(['MERCHANT'], (ctx) => decideCancellation({ ...ctx, params: decodeParams(ctx.params) })),
    },
    {
      method: 'POST',
      pattern: /^\/api\/v1\/merchant\/orders\/(?<id>[^/]+)\/cancel$/,
      handler: withBody(['MERCHANT'], (ctx) => merchantCancelOrder({ ...ctx, params: decodeParams(ctx.params) })),
    },
    {
      method: 'POST',
      pattern: /^\/api\/v1\/merchant\/orders\/(?<id>[^/]+)\/delay$/,
      handler: withBody(['MERCHANT'], (ctx) => setDelay({ ...ctx, params: decodeParams(ctx.params) })),
    },
    {
      method: 'PATCH',
      pattern: /^\/api\/v1\/merchant\/orders\/(?<id>[^/]+)\/dining-mode$/,
      handler: withBody(['MERCHANT'], (ctx) => changeDiningMode({ ...ctx, params: decodeParams(ctx.params) })),
    },
    {
      method: 'PUT',
      pattern: /^\/api\/v1\/merchant\/menu\/(?<dishId>[^/]+)$/,
      handler: withBody(['MERCHANT'], (ctx) => updateMerchantDish({ ...ctx, params: decodeParams(ctx.params) })),
    },
    {
      method: 'PUT',
      pattern: /^\/api\/v1\/merchant\/slots\/(?<slotId>[^/]+)$/,
      handler: withBody(['MERCHANT', 'ADMIN'], (ctx) => updateMerchantSlot({ ...ctx, params: decodeParams(ctx.params) })),
    },

    { method: 'PUT', pattern: /^\/api\/v1\/me\/location$/, handler: withBody(null, reportLocation) },
    {
      method: 'DELETE',
      pattern: /^\/api\/v1\/me\/location$/,
      handler: withAuth(null, deleteLocation),
    },

    {
      method: 'GET',
      pattern: /^\/api\/v1\/admin\/orders$/,
      handler: withAuth(['ADMIN'], (ctx) => listAdminOrders({ ...ctx, query: queryOf(ctx.req) })),
    },
    {
      method: 'GET',
      pattern: /^\/api\/v1\/admin\/settings$/,
      handler: withAuth(['ADMIN'], getAdminSettings),
    },
    {
      method: 'PUT',
      pattern: /^\/api\/v1\/admin\/settings$/,
      handler: withBody(['ADMIN'], putAdminSettings),
    },
  ];

  return { routes, handler: createRequestHandler({ routes, db, clock, logger }) };
}

function decodeParams(params) {
  const decoded = {};
  for (const [key, value] of Object.entries(params)) {
    decoded[key] = decodeURIComponent(value);
  }
  return decoded;
}