# 三端接口草案

DRAFT v0.3（联调冻结候选），仍待三人确认，不能作为正式发布或真机联调证据。统一前缀 /api/v1；演示服务已在 `services/api/` 实现并通过自动测试，但自动测试不等于真机或现场验收。v0.3 补齐档口菜单、订单列表、分页、取餐码过滤、延迟、取消审批、用餐方式理由和失败重试口径；三人确认前按“联调候选”使用，不宣称正式上线。

## 基础格式

成功响应为 { "data": ... }，错误为 { "error": { "code": "...", "message": "...", "retryable": false } }。金额为整数分，日期按 Asia/Shanghai，时间戳带 +08:00 或明确的时区。所有 ID 都是不透明字符串。

用餐方式 diningMode = DINE_IN（堂食）或 TAKEAWAY（外带），下单必填。
用户身份由服务端认证上下文获得，禁止客户端传 userId/role 来决定权限。具体演示登录/会话方案见下节，示例不包含真实密码或令牌。后端不接受前端指定总价。

## 演示登录与会话

本轮不接真实学生认证。演示账号由 spcuteag 线下分配，密码不写入仓库、示例、日志或 team-context。账号能进入哪个角色由服务端账号数据决定，客户端角色按钮只选择要登录的演示账号，不直接赋权。

| 方法与路径 | 请求 | 成功响应 |
| --- | --- | --- |
| POST /auth/demo-login | { "account": "...", "password": "..." } | 200 { "data": { "token": "...", "tokenType": "Bearer", "expiresAt": "...", "user": { "id": "...", "displayName": "...", "role": "STUDENT" } } } |
| GET /me | 无 | 200 { "data": { "user": { ... }, "canteenId": "..." } } |
| POST /auth/logout | 无 | 204 |

- role 仅允许 STUDENT、MERCHANT、ADMIN；档口账号另含 merchantId，学生账号另含 studentId（均为不透明字符串）。
- 客户端此后请求带 Authorization: Bearer <token>；令牌只保存在内存或必要的短期存储中，不写日志、不进 URL、不出现在错误截图。
- 服务端逐请求校验会话、角色及对象归属；客户端隐藏入口不构成权限控制。
- 会话过期返回 401 SESSION_EXPIRED；未登录或令牌无效返回 401 UNAUTHENTICATED；两者都引导重新登录，不泄露账号是否存在。
- 示例见 auth-demo-login.json 与 me.json，均为虚构数据。

修改请求带 requestId；仅成功的写操作按身份、操作和 requestId 持久化首次结果，重试返回该结果；失败事务不缓存，可用同一 requestId 重试并重新判定；同键不同内容返回 REQUEST_CONFLICT。requestId 去重不能只在进程内保存。已有订单操作另带 expectedVersion，匹配后原子更新并递增 version；版本冲突返回 ORDER_VERSION_CONFLICT，页面刷新再确认。完全相同的重试先识别原操作，不因首次成功已增加 version 而错误再次执行。

## 订单字段与状态

订单至少包含 id、items（dishId/name/quantity/unitPriceFen）、slotId、slotStart、slotEnd、diningMode、diningModeReason（未修改为 null）、totalFen、status、paymentStatus、cancelRequest、cancellationReason（未取消为 null）、version、createdAt、updatedAt、pickedUpAt（未取为 null）、delay（无则 null）。学生订单按权限展示 pickupCode，仅 READY 且未取餐返回可用码，其他状态为 null；档口订单列表和详情、管理查询始终返回 `pickupCode: null`，档口核销时手工输入学生出示的码。

status：NEW → ACCEPTED → PREPARING → READY → COMPLETED。
NEW/ACCEPTED/PREPARING/READY 可在规定权限下取消为 CANCELLED；COMPLETED/CANCELLED 是终态。
paymentStatus：SIMULATED_PAID 或 SIMULATED_REFUNDED；未取消的正常订单为前者，取消成功与模拟退款完成一起变为后者。
cancelRequest 为 { status: NONE | PENDING | APPROVED | REJECTED, reason: string | null, decisionReason: string | null }，独立于订单状态。reason 保留学生申请理由；decisionReason 保存档口批准、拒绝或取餐时结束申请的处理理由，未处理为 null。申请取消不自动停止原订单流程，档口应优先处理；终态不得再批准取消。
订单在申请待处理时完成取餐，必须在同一操作中把申请改为 REJECTED 并写 decisionReason=“订单已取餐”，保留原 reason；档口主动取消或批准申请导致订单取消时，把已有 PENDING 申请改为 APPROVED 并写 decisionReason。终态订单不能残留 PENDING。
delay 为 { reason, expectedReadyAt }，不替换主状态。仅 ACCEPTED/PREPARING/READY 可设置延迟；NEW 尚未接单，不允许填延迟。ACCEPTED/PREPARING/READY 均可按权限主动缺货取消或批准已有 PENDING 申请，COMPLETED/CANCELLED 不可再改变。

订单创建与模拟付款：POST /orders 一次完成，成功即 NEW + SIMULATED_PAID。无单独待付款订单或支付按钮二次确认接口。失败不能遗留已扣库存或“已付款但无订单”。

取消与模拟退款：NEW 学生可直接取消；ACCEPTED/PREPARING/READY 学生提交申请，由档口批准或拒绝。档口缺货可以主动取消尚未结束订单。批准/主动取消必须记录原因，原子完成取消及模拟退款。制作后的申请由档口按公示规则处理，不自动承诺批准。

库存按菜品份数扣减；时段容量按订单笔数，每单占 1。仅未开始制作取消时恢复菜品；同时尚未到时段开始时才恢复该订单占用的 1 个时段名额。已经开始制作的不恢复。重复取消不重复恢复。降低上限不能小于已占用名额；新增订单由后端原子检查。

## 操作清单

以下为 v0.3 联调冻结候选的路径、主要字段与已实现响应结构；如需变更字段，必须先更新本文、示例、版本和受影响页面，不能由各前端自行猜测。

| 方法与路径 | 输入或用途 | 主要输出与限制 |
| --- | --- | --- |
| POST /auth/demo-login | account, password | 服务端签发会话令牌并返回服务端认定的角色；见上节 |
| GET /me | 当前会话身份 | 返回 user 与 canteenId；仅本人信息 |
| POST /auth/logout | 无 | 204；删除服务端会话，不删除订单 |
| GET /menu?date=YYYY-MM-DD | 今天或明天菜单及时段 | 菜品价格、可售数量、时段起止与剩余名额；过去/关闭时段不可选 |
| POST /orders | requestId, items[{dishId,quantity}], slotId, diningMode | 服务端计价并模拟付款后的订单；字段例子见 create-order.json |
| GET /orders | 学生自己的订单列表 | 不返回其他学生订单 |
| GET /orders/{id} | 获取有权限的订单 | 三端从同一订单来源读取，字段按角色过滤 |
| POST /orders/{id}/cancel | requestId, expectedVersion, reason | NEW 直接取消退款；其余可申请状态设 PENDING，不假装已退款 |
| GET /merchant/orders | 本档口订单列表，query=status,page,pageSize | 受档口身份约束；返回 {orders,page,pageSize,total}，取餐码始终为 null；默认 page=1、pageSize=20，最大 100，按 createdAt 倒序 |
| POST /merchant/orders/{id}/advance | requestId, expectedVersion, action=ACCEPT/START_PREPARING/MARK_READY | 仅允许合法的下一状态，不支持跳到 COMPLETED |
| POST /merchant/orders/{id}/verify | requestId, expectedVersion, pickupCode | 仅 READY 且码正确、未用过时完成；示例见 verify-order.json |
| POST /merchant/orders/{id}/cancel-decision | requestId, expectedVersion, decision=APPROVE/REJECT, reason | 仅处理 PENDING 且非终态订单；reason 写入 cancelRequest.decisionReason；批准后取消并模拟退款；拒绝保留原状态和原申请理由 |
| POST /merchant/orders/{id}/cancel | requestId, expectedVersion, reason | 缺货等主动取消；NEW/ACCEPTED/PREPARING/READY 才允许；见 cancel-refund.json |
| POST /merchant/orders/{id}/delay | requestId, expectedVersion, reason, expectedReadyAt | 仅 ACCEPTED/PREPARING/READY 允许；保存延迟信息，主状态不变，学生能查看 |
| PATCH /merchant/orders/{id}/dining-mode | requestId, expectedVersion, diningMode, reason | 档口确认后更改未结束订单；reason 必填并持久化为 diningModeReason，三端及统计更新 |
| PUT /merchant/menu/{dishId} | requestId, expectedVersion, priceFen, availableQuantity, onSale | 校验非负价格/数量和档口归属；不修改历史订单价格 |
| PUT /merchant/slots/{slotId} | requestId, expectedVersion, capacity, enabled | 容量不得低于已占用量；不静默取消既有订单 |
| GET /dining/config | 当前公开的食堂范围配置 | { canteenId, name, center{latitude,longitude}, radiusMeters, accuracyToleranceMeters, updatedAt, demo }；这是食堂边界，不是学生位置 |
| PUT /me/location | requestId, presence=INSIDE/OUTSIDE/UNKNOWN | 按会话身份保存判断，返回服务端 observedAt 和 expiresAt；拒绝多余坐标字段 |
| DELETE /me/location | 清除本人位置判断 | 重复删除仍成功，不删除订单、不阻碍继续下单 |
| GET /crowd?slotId=... | 所选预约时段的堂食参考 | 见 crowd-reference.json；未来时段不返回当前参考 |
| GET /admin/orders | query=status,page,pageSize | 仅管理身份；返回 {orders,page,pageSize,total}，取餐码恒为 null；不支持日期/档口/异常查询参数 |
| GET/PUT /admin/settings | 档口营业、范围与提醒条件 | 修改含 requestId/expectedVersion；仅管理身份 |

### 档口读取响应（v0.3 联调冻结候选）

`GET /merchant/orders?status=READY&page=1&pageSize=20` 返回：

```json
{
  "data": {
    "orders": ["Order，字段见订单字段与状态"],
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

- `status` 可省略；传入时只接受 NEW/ACCEPTED/PREPARING/READY/COMPLETED/CANCELLED，不合法返回 VALIDATION_ERROR。
- 当前只支持状态筛选和分页，不承诺日期筛选；页面不得自行猜测未定义查询参数。
- 列表和详情都按档口身份过滤，取餐码为 `null`。

### 管理端读取响应（v0.3 联调候选）

`GET /admin/orders?status=NEW&page=1&pageSize=20` 返回 `{ data: { orders, page, pageSize, total } }`：

- 仅管理身份；未登录返回 401，学生/档口返回 403 FORBIDDEN。
- `status` 可省略；取值同订单状态；`page` 默认 1，`pageSize` 默认 20、最大 100；按 `createdAt` 倒序。非法 `status` 应返回 VALIDATION_ERROR（当前服务端尚未校验，待补）。
- 列表与详情均返回 `pickupCode: null`；管理端不得展示学生取餐码。
- 详情复用 `GET /orders/{id}`，管理身份可读；不存在或不可见返回 404 ORDER_NOT_FOUND。
- 当前只定义状态与分页；日期、档口、异常筛选参数尚未定义，页面不得自行猜测。异常（待处理取消申请、延迟）只在已加载结果中标记，不跨页推断。
- 当前订单响应未返回 `merchantId`、`merchantName` 或学生信息；管理端无法按档口展示或筛选，需后续补字段或专用视图，页面不得用样例名称冒充真实档口。
- `GET /admin/settings` 返回 `{ data: { dining, crowd } }`：
  - `dining`：`canteenId,name,center{latitude,longitude},radiusMeters,accuracyToleranceMeters,updatedAt,version,demo`。
  - `crowd`：`crowdedAt,version,demo`；当前只有单一提醒阈值，预约需求阈值尚无字段。
  - 当前没有档口营业时间、启用状态或档口名称字段；管理端真实模式不得用样例值填充。
  - 管理端 S3 已按此结构只读展示；`PUT /admin/settings`（`requestId,section,expectedVersion,value`、`SETTING_VERSION_CONFLICT`）的保存与冲突流程在 S5 接入。

`GET /menu?date=YYYY-MM-DD` 返回 `{ data: { date, slots, dishes } }`：

- `slots[]` 字段为 `id,date,startAt,endAt,capacity,booked,remainingCapacity,enabled`；已结束、已满或服务端停用的时段 `enabled=false`。
- `dishes[]` 字段为 `id,merchantId,name,priceFen,availableQuantity,onSale`；档口按 `merchantId` 过滤自己的菜品。
- 只支持今天和明天；其他日期返回 VALIDATION_ERROR。

首版不增加学生在线申请变更用餐方式的流程。学生订单详情说明“如需更改堂食或外带，请联系档口，由档口确认”；学生线下提出后，档口使用 dining-mode 操作更新，`reason` 必填并持久化为响应的 `diningModeReason`。学生端只读回结果，不自行修改或假装已经提交变更申请。

核销错误的检查顺序固定为：先身份和订单访问权限，再识别同一 requestId 的重试或不同内容冲突，再判断该订单是否已取餐及是否处于 READY，最后检查 expectedVersion 和取餐码。同一请求重试返回首次结果；新的请求再次核销已取订单返回 PICKUP_CODE_USED，即使它携带旧版本，也不优先显示版本冲突。未准备好或已取消返回 INVALID_ORDER_STATE。

## 位置和堂食参考

位置在手机侧一次计算后只提交 presence。服务端以收到新报告的时间作为 observedAt，不允许重放同一 requestId 延长有效期。位置判断 10 分钟后失效，最迟 24 小时清除；学生可主动删除。这里的 10 分钟、取餐后 30 分钟是演示初值，待现场验证后调整。精确经纬度不能进入请求、日志、持久化或错误报告。

范围内必须考虑定位误差；误差过大、边界不确定用 UNKNOWN。手机范围判断的具体示例由 spcuteag 在第一阶段提供。客户端判断可被伪造，仅作参考，不能用于鉴权、付款、核销或确认真实入场。

统计按同一食堂的稳定用户身份去重；菜品份数不能直接当人数：

- reservedDineInUsers：所选时段有效堂食订单的不同用户数，排除取消/退款/外带；包括该时段已取餐的有效订单，表示预约用户规模。
- currentReferenceUsers：取当前时段有效堂食订单且有 10 分钟内 INSIDE 判断的用户，与 30 分钟内已取堂食订单的用户的并集，再按用户去重。这里“当前时段”明确为 slotStart ≤ now < slotEnd，不把未来订单加入。
- 最近有效 OUTSIDE 判断优先排除当前参考中的该用户；UNKNOWN 不作为 INSIDE。位置过期或用户清除判断后，仍可仅按近期取餐记录参考，但必须说明该依据，不继续沿用旧 INSIDE。
- 未来时段 currentReferenceUsers = null，basis 仅为 RESERVATION；当前时段可使用 LOCATION 与 PICKUP 等实际存在的依据。当前位置不能推断明天人数。
- 没有足够数据时人数可为 null，不能强行用 0 表示未知。重复刷新或重复请求不得增加人数；取消、退款、变更为外带和过期记录及时退出对应统计。

返回至少包含 canteenId、slotId、referenceScope=PLATFORM_ONLY、reservedDineInUsers、currentReferenceUsers、level、basis、updatedAt、expiresAt、demo、message。
level 为 CROWDED、NO_ALERT、UNKNOWN；NO_ALERT 文案仍须说明不代表有座位。位置和取餐只是近似依据，不提供精确全食堂人数或座位承诺。

提醒条件由管理端设置，预约需求和当前参考分别比较各自条件，不将两个数直接相加。未有现场验证时演示值只在 demo=true 下演示；正式条件未确认或数据不够则 UNKNOWN。当前缺少位置不等于所有信息都缺失：可仅按预约或近期取餐提示，并准确说明依据。

## 错误清单

| HTTP | code | 页面行为 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR / INVALID_LOCATION_PAYLOAD | 说明输入问题；不记录含坐标的原始请求 |
| 401 | UNAUTHENTICATED | 引导重新登录，不泄露其他账号 |
| 401 | SESSION_EXPIRED | 提示会话过期并重新登录，不重复提交原写操作 |
| 403 | FORBIDDEN | 拒绝越权操作 |
| 404 | ORDER_NOT_FOUND | 订单不存在或对当前身份不可见 |
| 409 | OUT_OF_STOCK / SLOT_FULL / SLOT_CLOSED | 刷新可售信息，保留学生选择供调整 |
| 409 | REQUEST_CONFLICT / ORDER_VERSION_CONFLICT | 不创建另一单；核对或刷新再确认 |
| 409 | INVALID_ORDER_STATE / ALREADY_CANCELLED | 显示当前状态，不重复修改或返还 |
| 409 | PICKUP_CODE_USED / PICKUP_CODE_INVALID | 核销未成功，不改已取状态 |
| 503 | SERVICE_UNAVAILABLE | 明确失败或结果待确认，重试同请求；不返回样例成功 |

返回错误码和易懂 message。具体是否可重试由 retryable 字段说明；网络超时不代表操作未发生，客户端按同一 requestId 恢复查询或重试。

## 档口接入口径（2026-11-13 联调冻结候选）

1. READY 缺货取消：允许。NEW/ACCEPTED/PREPARING/READY 都可由档口按权限主动取消并模拟退款；COMPLETED/CANCELLED 不允许。
2. NEW 延迟：不允许。只有 ACCEPTED/PREPARING/READY 可设置 `reason` 与 `expectedReadyAt`，且必须持久化。
3. 取消申请审批：仅处理 `cancelRequest.status=PENDING` 且订单非终态；批准与订单取消/退款原子完成，拒绝只改申请状态，不改变订单主状态；理由必填。
4. 用餐方式变更：档口确认后允许修改未结束订单，`reason` 必填并持久化，响应字段为 `diningModeReason`；学生端只读结果。
5. 失败重试：成功的写操作按身份+操作+requestId 持久化首次响应；失败事务不缓存，可用同一 requestId 重试并重新判定；同一 requestId 不同内容返回 REQUEST_CONFLICT。
6. 列表与取餐码：`GET /merchant/orders` 返回 `{orders,page,pageSize,total}`，支持 status 筛选，默认第 1 页、每页 20、最大 100，按 createdAt 倒序；档口列表和详情始终不返回取餐码，核销由学生出示、档口手工输入。

## 正式确认前仍需补齐

v0.3 已补齐档口菜单、订单列表、分页、延迟、取消审批、用餐方式理由与取餐码过滤，并已由演示服务实现和自动测试覆盖。仍需三人确认签署、真机可访问服务地址、Android 两机联调记录、现场食堂范围/提醒阈值和服务端正式部署方式；在这些完成前不能宣称正式接口或正式联调。

## 客户端接入口径（v0.3 延续）

1. 首版时段数量：午餐固定 3 个时段（11:30—12:00、12:00—12:30、12:30—13:00），由档口于 2026-11-13 冻结；样例中 12:30—13:00 为已满，用于演示不可选。GET /menu 返回的 slots 数量与启停始终以服务端为准，客户端不得写死时段或数量。
2. 样例与真实模式：公共层不提供全局“样例开关”。各模块在自身 data source 内选择 sample/real，首版默认 sample。切换 real 的前提是已配置服务地址且已登录；real 请求失败必须显示失败或结果待确认，不得回退样例，也不得把样例数据标成真实结果。
3. 错误与 requestId 统一：模块复用 apps/mobile/src/shared 的 apiClient（ApiError 含 code/message/status/retryable）与 requestId 能力；不得另定义同名错误类并用 instanceof 判断 shared 错误，避免把真实失败降级为 UNKNOWN，也不得维护第二套 requestId 生成/复用逻辑。base URL 已包含 `/api/v1`，调用 `apiRequest` 时 path 只写 `/merchant/orders` 这类相对路径，不能再拼 `/api/v1`；下单 requestId 在内容不变时复用、内容变化时重生成、操作结束或开始新单后重置。
4. 定位：模块只使用 shared/location 的一次性定位与范围判断，不直接引入 @capacitor/geolocation，不上传坐标。定位说明卡可先占位且不触发权限；接入真实定位时使用 shared/location 的现有方法。
5. 以上口径为 DRAFT v0.3 联调冻结候选，三人确认前仍不能宣称正式发布。

## 单 APK 客户端补充

客户端统一为 apps/mobile 中三个角色模块，接口仍由独立 services/api 提供，不能把服务端放进 APK。公共会话与角色入口由 spcuteag维护，服务器逐请求验证角色和对象归属；客户端切换入口不改变授权。Android 一次性定位通过公共适配实现，模块只使用范围结果，仍遵守不上传坐标、短时失效和用户可删除的约定。此架构补充不改变 DRAFT v0.3 的待确认状态，演示登录/会话仍须三人确认后生效。
