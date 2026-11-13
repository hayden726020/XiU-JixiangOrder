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
- 管理端 S2 实际验证：`npm run typecheck` 退出码 0；`npm run build` 成功（71 modules，CSS 23.31 kB、JS 318.16 kB、web chunk 2.08 kB）；用临时内存库启动 `services/api` 实测 18 项，17 项通过（学生/管理员登录、下单、管理列表与详情、401/403、分页、取餐码恒 null）；发现 `status=BOGUS` 未校验返回 200；样例筛选/分页与页面渲染检查 12/12。以上是接口与渲染检查，不是浏览器手工或真机验收。

## 当前尚未完成

- 学生 S1—S3 已实现并在本地 main 完成合并，但尚未推送、未做合并后真机验收；S4—S6 未做。档口 S1 在 `backend/merchant-s1-registration`，未合入 main。管理端 S2 已支持样例/真实切换、状态筛选、分页与只读详情，但配置保存未做；管理端入口仍只提示登录，未按会话角色隐藏。
- android/ 已生成；4.1 MB 旧包与 7.6 MB 新包均已在 A024（Android 16 / API 36）安装。新包完成自检页定位授权/拒绝检查与管理端 S1 概览、订单页复验；未做两机联调、真实服务联调或现场食堂边界校准。
- 学生端已在自己电脑完成克隆与 S0 验证，S1—S3 已提交并推送；S4 起的公共接入口径见 `team-context/backend/公共资料/学生端公共能力接入说明.md`。
- 尚未建立两机联调与现场定位验收记录。
- 公共层已有演示登录/会话、请求封装、服务地址配置与一次性定位代码（`src/shared/`），并通过首页“公共能力自检”进入 `#/system-check`；浏览器 CDP 已实际验证页面渲染、未配置服务的明确失败与登录失败不保存会话。`services/api/` 已合入 main（`00b4ae7`）并通过 46 项自动测试；本轮用临时内存库实测登录、下单、管理列表/详情与 401/403。尚无长期服务地址、无真机联调。契约已升到 DRAFT v0.3，管理端 `GET /admin/orders` 字段已补，`GET/PUT /admin/settings` 仍与 S1 页面结构不一致。

backend/.stfolder 已存在，可能来自用户已有同步设置，本轮保留。未检查设备连接或共享配置，不能断言同步已经运行成功，也不能称其未配置。

## 接口与资料状态

接口为 DRAFT v0.3（联调冻结候选），未经三人确认，没有正式发布提交和长期可用服务。v0.3 补齐档口菜单、订单列表、分页、取餐码过滤、延迟、取消审批、用餐方式理由；管理端 `GET /admin/orders` 已补状态/分页与取餐码过滤说明，`GET/PUT /admin/settings` 为 dining/crowd 两段。资料包为 APK-v2 分发快照，以仓库中的规则与已确认契约为准；文档、JSON 示例和目录存在不代表功能实现。

## 下一步

1. 推送本地 main（当前 ahead 7）前先复核；管理端 S2 页面重新打包并在 A024 复验（当前真机只验过 S1 旧包）。
2. 管理端 S3/S5：配置页对齐真实 `dining`/`crowd` 结构与保存冲突；补服务端 `status` 非法值校验。
3. 档口模块待漪x3推送文件后在 moduleRegistry.ts 注册。
4. 魈嘶在自己电脑克隆后启动统一应用，打开 #/student 并改一处文字确认生效。

## 验证记录

- S0 骨架：在 apps/mobile 执行 npm install（成功，0 vulnerabilities）、npm run typecheck（退出码 0）、npm run build（成功，产出 dist/）、npm run preview（HTTP 200），并用无头 Edge dump-dom 确认首页角色入口和学生占位页已渲染；复核修复后再次通过。git push 返回退出码 0，远端 main 与本地 HEAD 均为 a4795a2fadc4。
- debug APK：2026-11-13 20:02 构建 7.6 MB 新包（含 geolocation 与定位权限），20:22 在 A024 安装成功；包内资源文件名与 `dist/` 一致。
- 真机定位：授权路径 ACCESS_FINE/COARSE_LOCATION granted，无服务端配置时使用演示范围（半径 150 米、误差容忍 60 米）得“范围外 · 判断完成 · 演示范围”；撤销权限后拒绝路径得“无法判断 · 定位权限被拒绝”，页面仍可用。
- 真机管理端（S1 旧包）：`#/admin` 概览显示 4 笔样例订单、1 待处理取消、1 已延迟；`#/admin/orders` 列表渲染 4 笔，不显示取餐码。S2 页面未重新打包。
- 公共层自检页：无头 Edge dump-dom 确认 `#/system-check` 渲染出服务地址、登录、一次性定位区块；CDP 实际点击“读取范围配置”得到 NOT_FOUND 且无成功文案，点击“演示登录”失败后会话仍为“未登录”。浏览器检查；真机仅验证定位权限路径与入口，未验证真实登录或位置上报。
- 管理端 S1：typecheck 退出码 0；build 成功；preview 静态资源均 HTTP 200；SSR 14/14 通过。SSR 是渲染检查，不替代浏览器手工验收、APK 安装或真机检查。
- 契约升为 DRAFT v0.3，管理端段已补；临时内存库已做管理查询实测（不等同真机联调）。此前提交 `f2670ef`（88 个文件）已推送 `origin/main`。2026-11-13 第七轮：合并学生分支后 `npm run typecheck` 退出码 0；`npm run build` 成功（55 modules，CSS 14.10 kB、JS 283.49 kB、web chunk 2.08 kB）；用 JDK 21 与 Android SDK 36 构建 APK 1.1 成功，`aapt2 dump badging` 确认 versionCode 2 / versionName 1.1 / targetSdk 36，包内 `capacitor.plugins.json` 含 geolocation，assets 含学生 S3 文案。APK 构建使用了工作区未提交的 `SystemCheck.tsx` 与 `AndroidManifest.xml`（cleartext）改动；已在 A024（Android 16 / API 36）通过 `adb install -r` 安装并完成学生 S3 页面真机点击验收（菜单→时段→堂食→返回保留→切日期清空），截图见 `team-context/backend/截图/apk-1.1-*.png`。长期服务、两机联调与档口页面仍未验证；管理端 S2 未打包。