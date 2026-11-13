# 公共方法与样式

由 spcuteag 维护公共样式、请求、错误处理、身份上下文和一次性定位适配。模块负责人只调用这里的方法，不直接拼 URL、不自行读取定位插件、不改公共依赖。

## 服务地址

`src/shared/config.ts` 按以下顺序取服务地址：

1. 本地存储键 `xiu.mobile.apiBaseUrl.v1`（调试或管理端写入，优先）；
2. 构建时环境变量 `VITE_API_BASE_URL`；
3. 浏览器开发环境默认 `/api/v1`。

真机（Capacitor native）未配置时返回明确错误 `API_BASE_NOT_CONFIGURED`，禁止使用 `localhost` / `127.0.0.1`。APK 不内置服务端密钥或凭据。

## 请求与错误

```ts
import { apiRequest, ApiError } from '../shared';

try {
  const data = await apiRequest<MenuResponse>('/menu?date=2026-11-13');
} catch (error) {
  if (error instanceof ApiError) {
    // error.code / error.message / error.retryable / error.status
  }
}
```

- 成功响应必须为 `{ data: ... }`；错误为 `{ error: { code, message, retryable } }`。
- 非 2xx、超时、网络失败、缺 `data` 都抛出 `ApiError`，不会返回样例数据。
- 401 会清除本地会话；`UNAUTHENTICATED` 与 `SESSION_EXPIRED` 都引导重新登录。
- 超时或网络失败的写请求**不代表未执行**；必须复用同一 `requestId` 查询或重试。
- 客户端不自动重试写请求。

## requestId

```ts
import { RequestIdGuard } from '../shared';

const guard = new RequestIdGuard('order');
await apiRequest('/orders', {
  method: 'POST',
  body: { requestId: guard.getId(), items, slotId, diningMode },
});
guard.reset(); // 仅在明确结束该操作或开始另一笔订单后调用
```

同一操作失败重试时不要调用 `reset()`；服务端按身份 + 操作 + requestId 去重。

## 会话与角色

- `demoLogin(account, password)` 调用 `POST /auth/demo-login`，保存服务端返回的会话与角色。
- `loadSessionIdentity()` 调用 `GET /me` 校验服务端认定的角色。
- `logout()` 调用 `POST /auth/logout` 并清除本地会话。
- `getSession()` / `subscribeSession()` 供页面显示状态；**本地角色只用于界面提示，不能作为权限依据**。
- 令牌只保存在内存与 `sessionStorage`，不写日志、不进 URL、不进入错误报告。
- 演示账号与密码由 spcuteag 线下交付，不写入仓库、示例或进度文件。

## 一次性定位

```ts
import { DEMO_DINING_CONFIG, checkPresenceOnce, fetchDiningConfig } from '../shared';

const config = await fetchDiningConfig(); // 失败时应显示无法判断，不能回落 INSIDE/OUTSIDE
const result = await checkPresenceOnce(config);
// result = { presence: 'INSIDE' | 'OUTSIDE' | 'UNKNOWN', reason, permission, demoConfig }
```

- 只在用户主动点击后请求权限，每次请求一次位置；不做持续追踪。
- 范围与误差判断全部在设备内完成，返回给模块的只有 `presence`、`reason`、`permission`、`demoConfig`，不含经纬度。
- 精度超过 `accuracyToleranceMeters`、边界不确定、权限拒绝、超时、系统关闭定位都返回 `UNKNOWN`，不阻塞下单。
- `reportPresence(presence, requestId)` 只发送 `INSIDE` / `OUTSIDE` / `UNKNOWN`；`clearPresence()` 删除本人判断记录，不影响订单。
- 页面应说明演示范围参数未经现场校准，不能宣称为真实食堂人数或座位保证。

## 自检页

`#/system-check`（首页“公共能力自检”按钮）用于检查服务地址、演示登录、范围配置、一次定位授权/拒绝与上报/清除。它只是开发与真机检查工具，不代表角色授权或业务验收。