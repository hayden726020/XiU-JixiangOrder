# 吉祥点餐演示 API（S2 最小实现）

负责人：spcuteag。状态：**DRAFT v0.3 建议实现，未三人确认，不能宣称正式接口**。本服务已经实际运行并通过自动化测试，但尚未完成 Android 真机联调记录。

技术选择（本轮统一确定）：

- Node.js **>=24**（使用内置 `node:sqlite`，无需安装数据库或编译原生模块）
- `node:http` 手写路由，零第三方运行时依赖
- `node:test` + `fetch` 做真实 HTTP 断言

选择零依赖是为了减少两位新手的安装步骤和网络风险；服务端与 APK 分离部署，数据库和密码不进入 APK。

## 启动

```bash
cd services/api
npm start
```

默认监听 `0.0.0.0:8787`，数据库在 `services/api/.runtime/orders.sqlite`。首次启动会生成演示账号密码文件 `services/api/.runtime/demo-accounts.json`（权限 0600，`.runtime/` 已被 .gitignore 忽略）。

可用环境变量：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址；真机联调需要局域网可达 |
| `DB_PATH` | `.runtime/orders.sqlite` | 设为 `:memory:` 可用于临时演示，重启清空 |
| `RUNTIME_DIR` | `services/api/.runtime` | 账号文件与数据库目录 |
| `DEMO_STUDENT_PASSWORD` | 自动生成 | 演示学生密码（至少 8 位） |
| `DEMO_MERCHANT_PASSWORD` | 自动生成 | 演示档口密码 |
| `DEMO_ADMIN_PASSWORD` | 自动生成 | 演示管理员密码 |

启动日志只打印服务地址、数据库路径和账号文件路径，**不打印密码、令牌或请求体**。

## 演示账号

| 账号 | 角色 | 绑定 |
| --- | --- | --- |
| `demo-student` | STUDENT | `studentId=demo-student-01` |
| `demo-merchant` | MERCHANT | `merchantId=demo-merchant-01` |
| `demo-admin` | ADMIN | 无 |

密码由首次启动生成到 `.runtime/demo-accounts.json`，或由上述环境变量提供。密码只线下交付，不写入 Git、示例、日志或 team-context。删除该文件后重启会生成新密码，旧会话仍可使用至过期。

## 真机联调

1. 电脑与手机在同一可信 WiFi。
2. 启动服务，确认 `npm start` 日志中的局域网地址。
3. 在 APK 的 `#/system-check` 页填写 `http://<电脑局域网 IP>:8787/api/v1` 并保存。
4. Windows 防火墙需允许 Node 入站；不要为此关闭整台电脑的防火墙。
5. APK 当前为开发联调允许明文 HTTP（`android:usesCleartextTraffic="true"`）。**这只是局域网演示配置，正式交付前必须改为 HTTPS 并移除该属性**，不能用“关闭证书校验”换取可用性。

真机联调记录必须单独写明：实际设备、服务地址、账号、请求结果，以及“自动测试/浏览器检查/真机”三者区别。当前还没有真机 S2 记录。

## 测试

```bash
cd services/api
npm test
```

2026-11-13 实际结果：**46 项通过、0 失败**（5 个测试文件，约 3.1 秒）。覆盖：

- 未登录、错误密码、会话过期、退出登录；
- 学生/档口/管理员角色边界与对象归属；
- 服务端计价、库存扣减、时段容量；
- 同 requestId 重试、同键不同内容、库存/容量并发；
- 状态跳步、版本冲突、核销一次性、重复核销；
- 取消恢复规则（未制作恢复、已制作不恢复、重复取消不重复恢复）；
- 取消申请批准/拒绝、取餐时结束待办申请；
- NEW 不允许延迟，接单后延迟可用；用餐方式修改理由持久化；
- 档口订单列表状态筛选、分页且始终不暴露取餐码；
- 位置字段白名单（拒绝坐标）、10 分钟过期、24 小时清理、同 requestId 不延长；
- 人数去重、外带/取消排除、未来隔离、OUTSIDE 排除、PICKUP 依据；
- 管理端只读查询、配置版本冲突与阈值调整。

自动化测试不等于真机或现场联调；`node:test` 的并发用例是在单进程事件循环内对真实 HTTP 服务发请求，不代表多进程/多实例部署。

## 已实现接口

统一前缀 `/api/v1`，成功 `{ "data": ... }`，错误 `{ "error": { "code", "message", "retryable" } }`。

无需登录：`GET /health`、`POST /auth/demo-login`、`GET /dining/config`、`GET /menu`、`GET /crowd`。

需要登录（Bearer）：

- `GET /me`、`POST /auth/logout`
- 学生：`POST /orders`、`GET /orders`、`GET /orders/{id}`、`POST /orders/{id}/cancel`
- 三端：`GET /orders/{id}`（按身份过滤）、`PUT /me/location`、`DELETE /me/location`
- 档口：`GET /merchant/orders`、`POST /merchant/orders/{id}/advance|verify|cancel-decision|cancel|delay`、`PATCH /merchant/orders/{id}/dining-mode`、`PUT /merchant/menu/{dishId}`、`PUT /merchant/slots/{slotId}`
- 管理：`GET /admin/orders`、`GET/PUT /admin/settings`

主要规则：

- 金额由服务端按菜单计算，整数分；首单即 `NEW + SIMULATED_PAID`。
- `requestId` 去重与订单、库存、容量、模拟付款在同一 SQLite `BEGIN IMMEDIATE` 事务中完成；同键不同内容返回 `REQUEST_CONFLICT`。
- 库存按份数、容量按订单笔数；只剩一份/一个名额时并发最多成功一笔。
- 订单 `NEW → ACCEPTED → PREPARING → READY → COMPLETED`；只有核销能完成，取餐码一次性。
- 学生 NEW 可直接取消；后续状态只能申请；档口批准/拒绝。未制作取消恢复菜品；未制作且时段未开始才恢复名额；重复取消不重复恢复。
- 位置只接受 `INSIDE/OUTSIDE/UNKNOWN`，含坐标或身份字段直接 400；10 分钟失效，最迟 24 小时清理；同 requestId 重放不延长。
- 人数按稳定用户去重；外带、取消、退款、未来订单不混入当前参考；无数据返回 `UNKNOWN` 与 `null`，不把未知当 0。

### 与 DRAFT v0.3 联调候选对齐

完整字段和档口 6 条口径见 `contracts/API.md`。本实现与契约一致的关键点：

- `GET /menu` 返回 `{ date, slots:[{id,date,startAt,endAt,capacity,booked,remainingCapacity,enabled}], dishes:[{id,merchantId,name,priceFen,availableQuantity,onSale}] }`。
- `GET /merchant/orders` 返回 `{ orders, page, pageSize, total }`，支持 `status`、`page`、`pageSize`；档口列表和详情的 `pickupCode` 始终为 null。
- 订单新增 `diningModeReason`；PATCH dining-mode 的 reason 必填并持久化。
- NEW 不允许设置延迟；ACCEPTED/PREPARING/READY 才允许。
- `GET /crowd` 的 `updatedAt/expiresAt` 为 +08:00 时间；`basis` 顺序为 `RESERVATION, LOCATION, PICKUP`。
- `GET /admin/settings` 返回 `{ dining:{...,version}, crowd:{...,version} }`。
- `PUT /admin/settings` 使用 `{ requestId, section:"dining"|"crowd", expectedVersion, value:{...} }`；版本不一致返回 `SETTING_VERSION_CONFLICT`。

这些字段已与演示服务实现和自动测试对齐，但契约仍需三人确认；前端按此实现时标注“按 DRAFT v0.3 联调候选”。

## 未实现与限制

- 没有真实学生认证、真实支付、退款渠道、实名或风控。
- 只有一个演示食堂和两个演示档口；没有多食堂、跨档口订单、配送。
- 没有 HTTPS、反向代理、限流、审计日志、备份和运维监控；CORS 当前允许任意 Origin，仅适合开发。
- 位置判断仍可被伪造，只作参考，不能用于鉴权、付款或核销。
- 管理端 S1 页面仍是样例，尚未接入本服务。
- `.runtime/` 下的数据库与账号文件不入库；删除即清空演示数据。

## 当前验证状态

- 2026-11-13：`npm test` 46/46 通过（含 NEW 延迟拒绝、用餐方式理由持久化、档口列表分页与取餐码过滤）。
- 2026-11-13：浏览器 `#/system-check` 实际保存 `http://127.0.0.1:8790/api/v1`、登录 `demo-student`、读取服务端食堂配置、定位无法判断时上报 UNKNOWN 成功（服务端返回 observedAt/expiresAt）。
- 未完成：Android 真机 S2 联调（设备在联调前断开），两机下单/接单/核销，现场食堂边界校准。