import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { startTestServer } from './helpers.mjs';

let ctx;
let merchantToken;

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

beforeEach(async () => {
  ctx = await startTestServer();
  ctx.addUser({
    id: 'user-qualification-merchant',
    account: 'qualification-merchant',
    password: 'qualification-pass-1',
    displayName: '资质商家',
    role: 'MERCHANT',
  });
  const login = await ctx.api('POST', '/auth/demo-login', {
    body: { account: 'qualification-merchant', password: 'qualification-pass-1' },
  });
  assert.equal(login.status, 200);
  merchantToken = login.body.data.token;
});

afterEach(async () => {
  await ctx.close();
});

function registerBody(requestId) {
  return {
    requestId,
    merchantName: '资质小馆',
    contactName: '李四',
    contactPhone: '13900139000',
  };
}

function shopBody(requestId, overrides = {}) {
  return {
    requestId,
    shopName: '资质小馆一店',
    location: '一食堂一楼 1 号档口',
    description: '资质审核演示',
    ...overrides,
  };
}

function qualificationBody(requestId, overrides = {}) {
  return {
    requestId,
    businessLicense: {
      fileName: 'business-license.png',
      mimeType: 'image/png',
      base64: PNG_BASE64,
    },
    foodPermit: {
      fileName: 'food-permit.png',
      mimeType: 'image/png',
      base64: PNG_BASE64,
    },
    ...overrides,
  };
}

async function register(requestId = 'qualification-register-1') {
  const response = await ctx.api('POST', '/merchant/registration', {
    token: merchantToken,
    body: registerBody(requestId),
  });
  assert.equal(response.status, 201);
  return response.body.data;
}

async function upload(requestId = 'qualification-upload-1', overrides = {}) {
  return ctx.api('POST', '/merchant/qualifications', {
    token: merchantToken,
    body: qualificationBody(requestId, overrides),
  });
}

async function review(merchantId, version, decision = 'APPROVE', requestId = 'qualification-review-1') {
  const admin = await ctx.login('admin');
  return ctx.api('POST', `/admin/merchant-qualifications/${merchantId}/review`, {
    token: admin,
    body: {
      requestId,
      expectedVersion: version,
      decision,
      ...(decision === 'REJECT' ? { reason: '证件照片不清晰' } : {}),
    },
  });
}

test('未上传资质不能创建店铺', async () => {
  await register();
  const response = await ctx.api('POST', '/merchant/shops', {
    token: merchantToken,
    body: shopBody('qualification-shop-blocked-1'),
  });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'QUALIFICATION_REQUIRED');
});

test('上传资质后进入待审核，创建店铺被拒绝', async () => {
  const profile = await register();
  const uploaded = await upload();
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.body.data.status, 'PENDING');
  assert.equal(uploaded.body.data.businessLicense.fileName, 'business-license.png');
  assert.equal(uploaded.body.data.version, 1);

  const current = await ctx.api('GET', '/merchant/qualifications', { token: merchantToken });
  assert.equal(current.status, 200);
  assert.equal(current.body.data.status, 'PENDING');

  const profileAfter = await ctx.api('GET', '/merchant/profile', { token: merchantToken });
  assert.equal(profileAfter.body.data.onboardingStep, 'QUALIFICATION_PENDING');

  const shop = await ctx.api('POST', '/merchant/shops', {
    token: merchantToken,
    body: shopBody('qualification-shop-blocked-2'),
  });
  assert.equal(shop.status, 409);
  assert.equal(shop.body.error.code, 'QUALIFICATION_PENDING');
  assert.equal(shop.body.error.message.includes('一个工作日'), true);

  assert.equal(profile.merchant.id, uploaded.body.data.merchantId);
});

test('管理端审核通过后档口才能创建店铺', async () => {
  await register();
  const uploaded = await upload();

  const list = await ctx.api('GET', '/admin/merchant-qualifications?status=PENDING', {
    token: await ctx.login('admin'),
  });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.qualifications.length, 1);
  assert.equal(list.body.data.qualifications[0].merchantName, '资质小馆');
  assert.equal(list.body.data.qualifications[0].status, 'PENDING');

  const reviewed = await review(uploaded.body.data.merchantId, uploaded.body.data.version);
  assert.equal(reviewed.status, 200);
  assert.equal(reviewed.body.data.status, 'APPROVED');

  const profile = await ctx.api('GET', '/merchant/profile', { token: merchantToken });
  assert.equal(profile.body.data.onboardingStep, 'QUALIFICATION_APPROVED');

  const shop = await ctx.api('POST', '/merchant/shops', {
    token: merchantToken,
    body: shopBody('qualification-shop-allowed-1'),
  });
  assert.equal(shop.status, 201);
  assert.equal(shop.body.data.onboardingStep, 'SHOP_CREATED');
  assert.equal(shop.body.data.qualification.status, 'APPROVED');
});

test('驳回后不能创建店铺，重新上传回到待审核', async () => {
  await register();
  const uploaded = await upload();
  const rejected = await review(uploaded.body.data.merchantId, uploaded.body.data.version, 'REJECT');
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.data.status, 'REJECTED');
  assert.equal(rejected.body.data.reviewReason, '证件照片不清晰');

  const blocked = await ctx.api('POST', '/merchant/shops', {
    token: merchantToken,
    body: shopBody('qualification-shop-blocked-3'),
  });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, 'QUALIFICATION_REJECTED');

  const reuploaded = await upload('qualification-upload-2');
  assert.equal(reuploaded.status, 201);
  assert.equal(reuploaded.body.data.status, 'PENDING');
  assert.equal(reuploaded.body.data.version, 3);
});

test('资质上传校验文件类型与必填项', async () => {
  await register();
  const missing = await upload('qualification-upload-3', { foodPermit: undefined });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, 'VALIDATION_ERROR');

  const badMime = await upload('qualification-upload-4', {
    foodPermit: { fileName: 'food-permit.png', mimeType: 'image/gif', base64: PNG_BASE64 },
  });
  assert.equal(badMime.status, 400);

  const badName = await upload('qualification-upload-5', {
    businessLicense: { fileName: 'license.exe', mimeType: 'image/png', base64: PNG_BASE64 },
  });
  assert.equal(badName.status, 400);
});

test('资质审核受版本约束，且学生不能审核', async () => {
  await register();
  const uploaded = await upload();
  const student = await ctx.login('student');
  const forbidden = await ctx.api(
    'POST',
    `/admin/merchant-qualifications/${uploaded.body.data.merchantId}/review`,
    {
      token: student,
      body: { requestId: 'qualification-student-review', expectedVersion: 1, decision: 'APPROVE' },
    },
  );
  assert.equal(forbidden.status, 403);

  const stale = await review(uploaded.body.data.merchantId, 99, 'APPROVE', 'qualification-review-stale');
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'QUALIFICATION_VERSION_CONFLICT');
});

test('商家只能读取自己的资质文件，管理员可读取', async () => {
  await register();
  const uploaded = await upload();
  const own = await ctx.api('GET', '/merchant/qualifications/files/business-license', {
    token: merchantToken,
  });
  assert.equal(own.status, 200);
  assert.equal(own.body.data.fileName, 'business-license.png');

  const other = await ctx.api('GET', '/merchant/qualifications/files/food-permit', {
    token: await ctx.login('merchant'),
  });
  assert.equal(other.status, 404);

  const admin = await ctx.api(
    'GET',
    `/admin/merchant-qualifications/${uploaded.body.data.merchantId}/files/food-permit`,
    { token: await ctx.login('admin') },
  );
  assert.equal(admin.status, 200);
  assert.equal(admin.body.data.mimeType, 'image/png');
});