# 公共开发状态

更新日期：2026-11-13。方案版本：APK-v1。维护人：spcuteag。

## 本轮已完成

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

## 当前尚未完成

- 学生、档口业务代码仍未实现；管理端 S1 只读样例已在真机复验，但仍无真实接口、权限、筛选与详情、配置保存；管理员入口尚未按会话角色限制。
- android/ 已生成；4.1 MB 旧包与 7.6 MB 新包均已在 A024（Android 16 / API 36）安装。新包完成自检页定位授权/拒绝检查与管理端 S1 概览、订单页复验；未做两机联调、真实服务联调或现场食堂边界校准。
- 学生端尚未在自己电脑克隆并验证；S0 不能记为通过。
- 尚未建立两机联调与现场定位验收记录。
- 公共层已有演示登录/会话、请求封装、服务地址配置与一次性定位代码（`src/shared/`），并通过首页“公共能力自检”进入 `#/system-check`；浏览器 CDP 已实际验证页面渲染、未配置服务的明确失败与登录失败不保存会话。服务端未实现，未做真实登录、位置上报或定位联调。契约已升到 DRAFT v0.2（补演示登录与食堂范围），管理端 admin 段仍缺，三人尚未确认。

backend/.stfolder 已存在，可能来自用户已有同步设置，本轮保留。未检查设备连接或共享配置，不能断言同步已经运行成功，也不能称其未配置。

## 接口与资料状态

接口为 DRAFT v0.2，未经三人确认，没有正式发布提交和可用服务。v0.2 补了演示登录/会话与食堂范围配置；管理端所需的 `/admin/orders`、`/admin/settings` 字段、筛选分页与冲突码仍是缺口。资料包为 APK-v1 分发快照，以仓库中的规则与已确认契约为准；文档、JSON 示例和目录存在不代表功能实现。

## 下一步

1. 管理端 S2：订单筛选与只读详情，并把 admin 段补进 `contracts/API.md` 待确认区。
2. 配置服务地址并补服务端最小实现，联调 `#/system-check` 的登录成功、会话与位置上报/清除；真实食堂边界仍需现场校准。
3. 档口模块待漪x3推送文件后在 moduleRegistry.ts 注册。
4. 魈嘶在自己电脑克隆后启动统一应用，打开 #/student 并改一处文字确认生效。

## 验证记录

- S0 骨架：在 apps/mobile 执行 npm install（成功，0 vulnerabilities）、npm run typecheck（退出码 0）、npm run build（成功，产出 dist/）、npm run preview（HTTP 200），并用无头 Edge dump-dom 确认首页角色入口和学生占位页已渲染；复核修复后再次通过。git push 返回退出码 0，远端 main 与本地 HEAD 均为 a4795a2fadc4。
- debug APK：2026-11-13 20:02 构建 7.6 MB 新包（含 geolocation 与定位权限），20:22 在 A024 安装成功；包内资源文件名与 `dist/` 一致。
- 真机定位：授权路径 ACCESS_FINE/COARSE_LOCATION granted，无服务端配置时使用演示范围（半径 150 米、误差容忍 60 米）得“范围外 · 判断完成 · 演示范围”；撤销权限后拒绝路径得“无法判断 · 定位权限被拒绝”，页面仍可用。
- 真机管理端：`#/admin` 概览显示 4 笔样例订单、1 待处理取消、1 已延迟；`#/admin/orders` 列表渲染 4 笔，不显示取餐码。
- 公共层自检页：无头 Edge dump-dom 确认 `#/system-check` 渲染出服务地址、登录、一次性定位区块；CDP 实际点击“读取范围配置”得到 NOT_FOUND 且无成功文案，点击“演示登录”失败后会话仍为“未登录”。浏览器检查；真机仅验证定位权限路径与入口，未验证真实登录或位置上报。
- 管理端 S1：typecheck 退出码 0；build 成功；preview 静态资源均 HTTP 200；SSR 14/14 通过。SSR 是渲染检查，不替代浏览器手工验收、APK 安装或真机检查。
- 契约仍为 DRAFT v0.2，没有真实接口测试。本轮提交 `f2670ef`（88 个文件）已推送 `origin/main`，`git ls-remote` 与本地 HEAD 一致，工作区干净；交接见 `team-context/backend/HANDOFF.md`。