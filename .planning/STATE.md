# 公共开发状态

更新日期：2026-11-13。方案版本：APK-v2。维护人：spcuteag。

## 本轮已完成

- 学生端 S1—S3 已由魈嘶推送 `student/s0-baseline @ 454553e`；本机核对改动仅限 `apps/mobile/src/modules/student/`，与 main 合并无冲突，合并提交 `32519ed`（本地，未推送）。
- 契约 DRAFT v0.2 增补客户端接入口径：首版每天 3 个时段（档口 2026-11-13 冻结）、样例开关由模块 data source 决定、模块必须复用 shared 的 ApiError 与 requestId。
- 重打 debug APK：versionCode 2 / versionName 1.1，含学生 S1—S3 页面与 geolocation 插件；4,915,302 字节，SHA-256 `7111a8430f0a05c7fe22c24c2d5b86db496fc83b782dc7b52779023cc0906f97`。已在 A024（Android 16 / API 36）安装并完成学生 S3 页面真机验收，截图见 `team-context/backend/截图/apk-1.1-*.png`；真实接口与档口页面仍未验证。

- 用户确认一个 APK，学生、档口和管理三个模块共用后台。
- 新代码位置为 apps/mobile/src/modules/student、merchant、admin；公共 src/app、src/shared 与 APK 工程由 spcuteag 维护。
- 更新共同方案、三人执行方案和 Agent 文件；旧分端目录改为迁移指引。
- 在 team-context/backend 按姓名分发资料，保持队友只读、各自进度仍写原目录。
- 用户提供远端仓库地址 https://github.com/hayden726020/XiU-JixiangOrder.git。2026-11-13 只读查询为空仓库（退出码 0、无引用）；没有验证写权限。
- 在 apps/mobile 建立 S0 最小可运行骨架：React 19.3.1 + Vite 8.3.8 + TypeScript 7.0.2；已安装 Capacitor 8.6.2 的 core/cli/android 依赖并配置 appId、appName、webDir。
- 建立公共应用入口、hash 入口、模块契约与公共样式；注册学生模块占位入口（#/student）；档口和管理员为公共占位。
- 实际执行 npm install、npm run typecheck、npm run build、npm run preview；类型检查与构建通过，预览返回 HTTP 200，用无头 Edge 实际渲染首页与 #/student。以上均为浏览器检查。
- 已初始化本地 Git（main），提交骨架并成功推送 origin/main；首个骨架提交为 a4795a2fadc4。远端不再是空仓库，本次推送同时验证了写权限。
- 2026-11-13 生成 Capacitor android/ 工程（minSdk 24、compileSdk/targetSdk 36），并使用本机已有 JDK 21 与 Android SDK 36 成功构建 debug APK：android/app/build/outputs/apk/debug/app-debug.apk（4.1 MB，package com.xiujixiang.order、versionCode 1、versionName 1.0、Android Debug 签名）。android/ 已纳入 Git；APK、build/ 与 local.properties 被忽略。
- 2026-11-13 管理端 S1 样例骨架接入：`modules/admin` 新增类型、样例数据、数据源、概览/订单/配置页与样式；`#/admin` 由公共占位改为 `adminModule`，模块内部处理 `#/admin/orders`、`#/admin/settings`；页面只读、标注样例、不显示取餐码。
- 管理端 S1 实际验证：`npm run typecheck` 退出码 0（覆盖 `src/shared/`）；`npm run build` 成功（44 modules，CSS 8.73 kB、JS 261.39 kB、web chunk 2.08 kB；`shared/` 已随 `#/system-check` 进入产物）；preview 首页/JS/CSS 均 HTTP 200；Vite SSR 渲染管理端三个子路径，14 项断言全部通过。以上不是浏览器手工验收，也不是真机复验。
- 2026-11-13 管理端 S2 接入：`data/source.ts` 改为异步数据源，支持 sample/live；订单页增加状态筛选、分页、异常标记与本地异常过滤；新增 `pages/OrderDetailPage.tsx` 与路由 `#/admin/orders/{id}`；真实模式需 ADMIN 会话，失败不回退样例。
- 2026-11-13 管理端 S3 接入：配置页对齐 `GET /admin/settings` 的 `dining`（canteenId/name/center/radius/accuracy/version/updatedAt/demo）与 `crowd`（crowdedAt 单阈值/version/demo）只读结构；`data/source.ts` 新增 `getSettings()`，live 严格解析且失败不回退样例；真实模式明确“服务端未提供档口营业时间”，不用样例档口与半径冒充；页面无保存控件。
- 管理端 S2 实际验证：`npm run typecheck` 退出码 0；`npm run build` 成功（71 modules，CSS 23.31 kB、JS 318.16 kB、web chunk 2.08 kB）；用临时内存库启动 `services/api` 实测 18 项，17 项通过（学生/管理员登录、下单、管理列表与详情、401/403、分页、取餐码恒 null）；发现 `status=BOGUS` 未校验返回 200；样例筛选/分页与页面渲染检查 12/12。以上是接口与渲染检查，不是浏览器手工或真机验收。
- 管理端 S3 实际验证：`npm run typecheck` 退出码 0；`npm run build` 成功（71 modules，CSS 23.31 kB、JS 321.57 kB、web chunk 2.08 kB）；临时内存库配置接口 17/17；无头 Edge + CDP 检查样例模式 7/7、真实模式 11/11（150/60 米、10 人、档口营业时间未提供、无样例残留、无保存按钮）、服务关闭后失败态 6/6。以上是浏览器与临时服务检查，不是真机或现场联调。
- 2026-11-13 管理端 S4 接入：新增 `components/SettingsEditor.tsx` 与 `admin-s4.css`；受控草稿只编辑 dining 的 name/radiusMeters/accuracyToleranceMeters 与 crowd 的 crowdedAt，校验与服务端约束一致；进入编辑生成 requestId，字段改动重新生成，内容不变的提交复用同一 requestId；展示 expectedVersion。样例与真实模式都只生成“未写入服务端”草稿提示，不发送 PUT、不显示“已保存”；S5 再实现真实保存与 `SETTING_VERSION_CONFLICT`。
- 管理端 S4 实际验证：`npm run typecheck` 退出码 0；`npm run build` 成功（84 modules，含并行学生 S4—S6 合并；CSS 29.65 kB、JS 349.94 kB、web chunk 2.08 kB）；无头 Edge + CDP 检查 23/23：编辑入口、表单初值、requestId 变化、样例不写入提示、按钮禁用、半径 0 校验、刷新恢复 300 米、真实模式只读提示、服务端配置保持 150/60/10、真实订单页回归。以上不是真机或现场联调。
- 2026-11-13 管理端 S5 接入：`data/source.ts` 新增 `updateSettings()`（`PUT /admin/settings`，单 section、requestId、expectedVersion）；`SettingsEditor` 拆成 dining/crowd 两个保存动作，成功后重新 `GET /admin/settings` 校验 version 并更新页面；`SETTING_VERSION_CONFLICT` 保留输入并提供“重新读取最新配置（放弃本次输入）”；样例模式不发送 PUT；服务端校验失败与 401/403 有可理解文案。
- 管理端 S5 实际验证：服务端 `npm test` 46/46；`npm run typecheck` 退出码 0；`npm run build` 成功（84 modules，CSS 29.65 kB、JS 353.69 kB、web chunk 2.08 kB）；无头 Edge + CDP 27/27：dining 150→420（version 2）、crowd 10→12（version 2）、刷新持久、外部改 430/version 3 后旧版本保存得冲突且输入保留、手动重读、样例不写入、半径 0 前端校验、服务端 400/401/403。以上不是真机或现场联调。
- 2026-11-13 管理端 S6 接入：`data/source.ts` 增加样例错误演习（401/403/503，不请求服务端）；`AdminHome` 增加演习开关，并允许已登录的非管理员连接真实服务以核对 403；`OrdersPage`/`SettingsPage` 区分 401/403/503/超时标题与文案；`SettingsEditor` 对断网/503 显示“保存结果待确认”并复用同一 requestId；新增 `admin-s6.css`。
- 管理端 S6 实际验证：服务端 `npm test` 46/46；`npm run typecheck` 退出码 0；`npm run build` 成功（85 modules，CSS 30.09 kB、JS 357.25 kB、web chunk 2.08 kB）；CDP 40/40：样例 401/403/503 订单与配置均不显示数据、关闭演习恢复、学生真实 403、无效令牌 401、断网保存显示结果待确认且 requestId 不变、恢复网络后同一 requestId 保存成功（410/version 2）；API 401/403 错误响应仅 `code/message/retryable`，无令牌/取餐码/坐标。以上不是真机或现场联调。
- 2026-11-14 管理端 S7 接入：非管理员（学生或未登录）访问管理端只显示“需要管理员身份”与登录入口，不渲染导航、订单、配置或错误演习；管理员才渲染管理页面与演习开关。管理端入口完成按角色收口。
- 管理端 S7 实际验证：`npm run typecheck` 退出码 0；`npm run build` 成功（85 modules，CSS 30.09 kB、JS 357.91 kB、web chunk 2.08 kB）；CDP 20/20：未登录/学生入口无管理数据与导航、管理员真实订单与配置可查询、401/403/503 错误态复核通过、4 张错误态截图不含取餐码或令牌；APK 1.6（versionCode 7，4,940,446 字节，SHA-256 `8324db67ad00fbcea67f90615d0bbc31b1a52de030859816d82412ce2a2bcbe3`）构建成功。随后用 APK 包内 `assets/public` + 390×844 手机视口 + Android WebView UA 在电脑模拟复验 18/18：包内 JS 为 `index-CWjhMBev.js`，未登录/学生入口收口、管理员真实订单/配置、401/403/503 均通过；截图 `apk-1.6-sim-*.png`。本机无 AVD/system-images，未运行 Android 模拟器或真机。
- 2026-11-14 D2-0 接入：`GET /menu` 的 dishes/slots 补 `version`；菜单/时段 PUT 的旧版本冲突改为 `MENU_VERSION_CONFLICT`；契约补 version 字段、档口客户端过滤口径与 PUT 返回新版本；合入档口 S11 `7802dcd`（菜单/时段编辑）；服务端测试扩到 58 项。
- D2-0 实际验证：服务端 `npm test` 58/58；移动端 `npm run typecheck` 退出码 0、`npm run build` 成功（86 modules，CSS 33.02 kB、JS 388.99 kB）；从新 main 启动 8788 内存库（PID 31120，局域网 `192.168.110.42:8788`），API 实测 10/10：menu version、PUT 菜品/时段成功且 version+1、GET 同步、旧版本 `MENU_VERSION_CONFLICT`、学生 403、未登录 401。
- 2026-11-14 D2-1 接入：合入学生 S10 `63d9a63`（登录守卫、真实下单与详情）与档口 `b7fd1c9`（取消理由展示修复）；升 APK 1.7 / versionCode 8；学生构建为真实模式，默认 API `http://192.168.110.42:8788/api/v1`。
- D2-1 实际验证：服务端 `npm test` 58/58；`npm run typecheck` 退出码 0；默认构建 103 modules（CSS 35.07 kB、JS 413.32 kB）；APK 1.7 为 4,958,798 字节，SHA-256 `0bcfe7baa7740fa25ef3039a2c04a16509f9fb664500ebeacb27508699712ba3`，`aapt2` 确认 versionCode 8 / versionName 1.7 / targetSdk 36；包内 `assets/public` + 390×844 手机视口 + Android WebView UA 复验 10/10：学生真实模式与真实菜单、S10 登录守卫文案、管理入口收口、档口数据源切换与未登录提示、默认服务地址 8788；截图 `apk-1.7-sim-*.png`。未真机。

- 2026-11-14 D2-2/D2-3 实测（真实服务 8788 + 浏览器页面模拟）：用 `services/api/.runtime/` 临时脚本（已被 .gitignore 排除，不入库）完成学生真实下单与同 requestId 幂等、档口 ACCEPT→PREPARING→READY→verify、错码/重复核销/版本冲突/取消审批/缺货/延迟/用餐方式、菜单/时段编辑；真实服务 API 43/43 通过。页面侧用无头 Edge + 390×844 手机视口 + Android WebView UA（浏览器模拟，非真机、非 APK 安装）跑通 20/20：学生登录并在明天时段真实下单、档口接单/制作/可取/核销、页面菜单与时段编辑 version+1、管理端查询同单。
- D2-4 三端同单（2026-11-14 15:00，浏览器页面模拟，非真机）：同一订单 id `ord_7731268f-bb2a-49a3-b21f-de92eac92431`；学生页“待接单”“合计 ¥20.00”，档口页 NEW→READY→COMPLETED，管理页“已完成”20.00 元、version 5、无取餐码；三端金额 2000 分、时段 `slot-2026-11-15-lunch` 一致。截图 `team-context/backend/截图/day2-d2-4-*.png`。APK 1.7 仍未安装真机。
- D2-2/D2-3/D2-4 已知缺口：学生订单详情无轮询，档口推进后学生页面仍显示“待接单”；学生页 READY 取餐码展示未验证（本次取餐码通过学生会话 API 读取后由档口页面核销）；管理端订单响应仍无档口名称字段，页面显示“服务端未返回档口字段”；8788 为内存库，重启清空。

## 当前尚未完成

- 学生 S1—S6 已合入 main（并行合并 `7f40dfa`）；已用 APK 1.2（versionCode 3）在 A024 完成 S4—S6 真机验收：S4 三态与定位占位、S5 确认页/正常提交/订单详情/回跳同一笔、S6 时间轴与取餐码占位，截图见 `team-context/backend/截图/apk-1.2-*.png`；学生 S9 已在 main，S10 `63d9a63`（登录守卫、真实下单与详情）已由 D2-1 合入 main。档口 S1—S11 已在 main（S11 `7802dcd` 由 D2-0 合入），`b7fd1c9`（固定展示取消理由）已由 D2-1 合入；档口真实菜单/订单/接单/制作/可取/核销/取消审批/缺货/延迟/用餐方式/菜单编辑代码均已进主干。管理端 S2—S7 已提交推送并完成入口收口；档口营业时间端点、预约需求阈值字段未做。服务端 `status` 校验、READY 取消、取消申请 `reason`/`decisionReason` 分离已合入。D2-2/D2-3/D2-4 已在 2026-11-14 用真实服务 8788 + 浏览器页面模拟完成（见本轮已完成），真机与 APK 安装仍未验证。
- android/ 已生成；4.1 MB 旧包与 7.6 MB 新包均已在 A024（Android 16 / API 36）安装。APK 1.7（versionCode 8）已构建并完成包内资源电脑模拟复验，含档口 S2—S11、学生 S10、管理 S7；尚未安装真机。本机无 AVD/system-images，Android 模拟器与真机未验；两机联调与现场边界未做。
- 学生端已在自己电脑完成克隆与 S0 验证，S1—S3 已提交并推送；S4 起的公共接入口径见 `team-context/backend/公共资料/学生端公共能力接入说明.md`。
- 尚未建立两机联调与现场定位验收记录。
- 公共层已有演示登录/会话、请求封装、服务地址配置与一次性定位代码（`src/shared/`），并通过首页“公共能力自检”进入 `#/system-check`；浏览器 CDP 已实际验证页面渲染、未配置服务的明确失败与登录失败不保存会话。`services/api/` 已合入 main（`00b4ae7`）并通过 58 项自动测试（含 D2-0 菜单 version/写操作）；本轮用临时内存库实测登录、下单、管理列表/详情、401/403 与管理配置结构。尚无长期服务地址、无真机联调。契约已升到 DRAFT v0.3，管理端 `GET /admin/orders` 与 `GET /admin/settings` 的 dining/crowd 字段已补并对齐；`PUT /admin/settings` 已由 S5 接入（单 section、保存后重读确认）；S6 已补 401/403/503 错误态与保存重试，无接口变更；D2-0 补 menu version，D2-1 未改接口。

backend/.stfolder 已存在，可能来自用户已有同步设置，本轮保留。未检查设备连接或共享配置，不能断言同步已经运行成功，也不能称其未配置。

## 接口与资料状态

接口为 DRAFT v0.3（联调冻结候选），未经三人确认，没有正式发布提交和长期可用服务。v0.3 补齐档口菜单、订单列表、分页、取餐码过滤、延迟、取消审批、用餐方式理由；管理端 `GET /admin/orders` 已补状态/分页与取餐码过滤说明，`GET /admin/settings` 的 dining/crowd 字段已补并由 S3 页面只读对齐；`PUT` 保存与版本冲突已由 S5 接入（单 section、保存后重读确认）；S6/S7 只补页面错误态、重试与入口权限，未改接口。D2-0 补 `GET /menu` 的 dishes/slots `version`，明确“服务端返回全部菜品、档口客户端按 merchantId 过滤、写操作按归属校验”，`PUT /merchant/menu|slots` 成功返回新 version、旧版本返回 `MENU_VERSION_CONFLICT`。取消申请已补 `cancelRequest.decisionReason`：`reason` 保留学生申请理由，批准/拒绝/取餐结束申请写入处理理由；READY 取消、非法 `status` 400 与稳定排序已随解阻修正合入。资料包为 APK-v2 分发快照，以仓库中的规则与已确认契约为准；文档、JSON 示例和目录存在不代表功能实现。

## 下一步

1. D2-2/D2-3/D2-4 已完成（2026-11-14，真实服务 API 43/43、浏览器页面模拟 20/20）；但仍需真机/APK 安装复验，不得把浏览器模拟写成真机通过。
2. D2-5：主动定位、范围判断、拒绝仍堂食、清除位置；拥挤三态与详情轮询（学生详情轮询是本次 D2-4 的已知缺口）。
3. D2-6：完整流程验收（真机优先，无设备则电脑模拟并标注）；补 `status` 校验、营业时间端点与预约需求阈值；两机联调与现场边界放最后。

## 验证记录

- D2-2/D2-3 真实服务 API 实测（2026-11-14，临时内存库 8788，脚本在 `.runtime/` 不入库）43/43：学生登录与明天时段真实下单、同 requestId 同内容重发返回同一单且订单数不增、同 requestId 不同内容 `REQUEST_CONFLICT`、未登录 401/档口下单 403、关闭时段 `SLOT_CLOSED`；档口 NEW→ACCEPTED→PREPARING→READY→COMPLETED、错码 `PICKUP_CODE_INVALID` 且仍 READY、同 requestId 重复核销返回首次结果、新 requestId `PICKUP_CODE_USED`、旧版本 `ORDER_VERSION_CONFLICT`、取消申请 PENDING/拒绝保留原状态/批准退款、NEW 直接取消、缺货取消、NEW 延迟 409、菜单/时段 PUT 成功 version+1 与旧版本 `MENU_VERSION_CONFLICT`、学生写菜单 403；管理端同单 `pickupCode=null`。
- D2-4 三端页面同单（2026-11-14，无头 Edge + 390×844 + Android WebView UA，浏览器模拟，非真机）20/20：学生页登录并真实下单 `ord_7731268f-bb2a-49a3-b21f-de92eac92431`（待接单、合计 ¥20.00、无样例横幅）；档口页同一 id NEW→READY→COMPLETED 并用学生取餐码核销；管理页同一 id 已完成、20.00 元、version 5、无取餐码；档口页面菜品编辑 v12→v13、时段编辑 v11→v12。截图 `team-context/backend/截图/day2-d2-4-*.png`。学生页在档口推进后仍显示“待接单”，因 S10 详情无轮询，D2-5 处理。APK 1.7 未安装真机。
- S0 骨架：在 apps/mobile 执行 npm install（成功，0 vulnerabilities）、npm run typecheck（退出码 0）、npm run build（成功，产出 dist/）、npm run preview（HTTP 200），并用无头 Edge dump-dom 确认首页角色入口和学生占位页已渲染；复核修复后再次通过。git push 返回退出码 0，远端 main 与本地 HEAD 均为 a4795a2fadc4。
- debug APK：2026-11-13 20:02 构建 7.6 MB 新包（含 geolocation 与定位权限），20:22 在 A024 安装成功；包内资源文件名与 `dist/` 一致。
- 真机定位：授权路径 ACCESS_FINE/COARSE_LOCATION granted，无服务端配置时使用演示范围（半径 150 米、误差容忍 60 米）得“范围外 · 判断完成 · 演示范围”；撤销权限后拒绝路径得“无法判断 · 定位权限被拒绝”，页面仍可用。
- 真机管理端（S1 旧包）：`#/admin` 概览显示 4 笔样例订单、1 待处理取消、1 已延迟；`#/admin/orders` 列表渲染 4 笔，不显示取餐码。S2 页面未重新打包。
- 公共层自检页：无头 Edge dump-dom 确认 `#/system-check` 渲染出服务地址、登录、一次性定位区块；CDP 实际点击“读取范围配置”得到 NOT_FOUND 且无成功文案，点击“演示登录”失败后会话仍为“未登录”。浏览器检查；真机仅验证定位权限路径与入口，未验证真实登录或位置上报。
- 管理端 S1：typecheck 退出码 0；build 成功；preview 静态资源均 HTTP 200；SSR 14/14 通过。SSR 是渲染检查，不替代浏览器手工验收、APK 安装或真机检查。
- 管理端 S3：typecheck 退出码 0；build 成功（71 modules，CSS 23.31 kB、JS 321.57 kB、web chunk 2.08 kB）；临时内存库配置接口 17/17；无头 Edge + CDP 检查 `#/admin/settings` 样例 7/7、真实 11/11、服务关闭失败态 6/6。浏览器与临时服务检查，不是真机或现场联调。
- 管理端 S4：typecheck 退出码 0；build 成功（84 modules，CSS 29.65 kB、JS 349.94 kB、web chunk 2.08 kB）；CDP 23/23，含草稿编辑、requestId 重新生成、样例/真实均不发送 PUT、半径 0 校验、刷新恢复与真实订单回归。未打包、未真机。
- 管理端 S5：服务端 `npm test` 46/46；typecheck 退出码 0；build 成功（84 modules，CSS 29.65 kB、JS 353.69 kB、web chunk 2.08 kB）；CDP 27/27：dining 保存 420/version 2、crowd 保存 12/version 2、重读一致、刷新持久、旧版本冲突保留输入且服务端未被覆盖、手动重读、样例不写入、前端与服务端校验、401/403。未打包、未真机。
- 管理端 S6：服务端 `npm test` 46/46；typecheck 退出码 0；build 成功（85 modules，CSS 30.09 kB、JS 357.25 kB、web chunk 2.08 kB）；CDP 40/40：样例 401/403/503 订单与配置不显示数据、关闭演习恢复、学生 403、无效令牌 401、断网保存结果待确认且 requestId 不变、恢复网络同 requestId 保存成功、API 错误响应与日志不含令牌/取餐码/坐标。未打包、未真机。
- 管理端 S7：typecheck 退出码 0；build 成功（85 modules，CSS 30.09 kB、JS 357.91 kB、web chunk 2.08 kB）；CDP 20/20：未登录/学生入口只显示身份提示、无管理数据与导航；管理员真实订单/配置可查；401/403/503 错误态复核；4 张截图见 `team-context/backend/截图/admin-s7-*.png`。APK 1.6（vc7，4,940,446 字节，SHA-256 `8324db67…`）构建成功；另用 APK 包内 `assets/public` + 手机视口 + Android WebView UA 复验 18/18（截图 `apk-1.6-sim-*.png`），本机无 AVD/system-images，未运行 Android 模拟器或真机。
- D2-0：服务端 `npm test` 58/58；typecheck 退出码 0；build 成功（86 modules，CSS 33.02 kB、JS 388.99 kB）；8788 新服务 API 10/10：menu version、PUT 菜品/时段成功且 version+1、GET 同步、旧版本 `MENU_VERSION_CONFLICT`、学生 403、未登录 401。未真机。
- D2-1：服务端 `npm test` 58/58；typecheck 退出码 0；默认构建 103 modules（CSS 35.07 kB、JS 413.32 kB）；APK 1.7（vc8，4,958,798 字节，SHA-256 `0bcfe7ba…`）构建成功；包内资源 + 手机视口 + Android WebView UA 复验 10/10（学生真实模式/菜单、S10 登录守卫、管理入口收口、档口数据源与未登录提示、默认地址 8788）。未真机。
- 契约升为 DRAFT v0.3，管理端段已补；临时内存库已做管理查询实测（不等同真机联调）。此前提交 `f2670ef`（88 个文件）已推送 `origin/main`。2026-11-13 第七轮：合并学生分支后 `npm run typecheck` 退出码 0；`npm run build` 成功（55 modules，CSS 14.10 kB、JS 283.49 kB、web chunk 2.08 kB）；用 JDK 21 与 Android SDK 36 构建 APK 1.1 成功，`aapt2 dump badging` 确认 versionCode 2 / versionName 1.1 / targetSdk 36，包内 `capacitor.plugins.json` 含 geolocation，assets 含学生 S3 文案。APK 构建使用了工作区未提交的 `SystemCheck.tsx` 与 `AndroidManifest.xml`（cleartext）改动；已在 A024（Android 16 / API 36）通过 `adb install -r` 安装并完成学生 S3 页面真机点击验收（菜单→时段→堂食→返回保留→切日期清空），截图见 `team-context/backend/截图/apk-1.1-*.png`。长期服务、两机联调与档口页面仍未验证；管理端 S2 未打包。