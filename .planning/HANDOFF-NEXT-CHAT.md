# 新对话交接：食麦呼三分支合流基线（APK 1.37）与待修 3 项根因

更新时间：2026-11-17 22:18（Asia/Shanghai）

---

## 1. 当前基线与环境状态

- **主代码仓库**：`D:\Jixiang\workspace\campus-meal`
- **资料同步工作区**：`D:\Jixiang\workspace\team-context`（注意：正式移动端工程在 `campus-meal\apps\mobile`，后端在 `campus-meal\services\api`）
- **当前分支与远端**：`docs/readme-status`（已推送至 `origin/docs/readme-status`，最新代码提交 `d558f2a`）
- **最新 APK 产物**：
  - 路径：[app-debug.apk](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk)
  - 版本：**`1.37` / `versionCode 38`**（包名 `com.xiujixiang.order`）
  - 大小：`8,274,146` 字节（约 7.89 MB）
  - SHA-256：`cf2df765078abb7f2ec600be6f5abe709a3be06daadfe937b576ce31cf5c3134`
- **构建工具链**：
  - Java 21：`D:\Jixiang\.runtime\jdk21-full\jdk-21.0.13+9`（Gradle 构建需设置 `$env:JAVA_HOME` 并加入 `$env:PATH`）
  - Android SDK：`C:\Users\SPcuteAG\AppData\Local\Android\Sdk`（或 `D:\AndroidSdk`）
- **阿里云 ECS 公网演示服务**：
  - 地址：`https://39.96.195.158/api/v1`（已写入 `apps/mobile/.env.production`）
  - 部署目录：`/opt/jixiang-order/services/api/`（回滚备份位于 `/root/backup-api-20261117-2132`；持久化 SQLite 位于 `/opt/jixiang-order/data/orders.sqlite`，严禁清空覆盖）
  - 状态：`jixiang-api.service` `active`，已同步 `d558f2a` 的全部后端代码，服务器低权限账号 `jixiang` 实跑 `npm test` **98/98 通过**。
  - SSH 运维红线：详见 `D:\Jixiang\workspace\team-context\backend\交接\HANDOFF-FOR-NEXT-AGENT.md`（仅通过 `-i "D:\Jixiang\.runtime\server-keys\jixiang_aliyun_ecs_20261114"` 与 `StrictHostKeyChecking=yes` 调用 `E:\Git\usr\bin\ssh.exe`，严禁读取或泄露私钥内容）。

---

## 2. 本轮已合并完成并验证的内容（`d6111e6` → `d558f2a`）

已将此前分散在 `docs/readme-status`、`origin/student/day3`、`origin/frontend/handoff-2026-11-17`（及 `origin/integration/baseline-2026-11-17`）三条分支上的功能整合进同一分支：

1. **学生端（`apps/mobile/src/modules/student/`）**：
   - **演示/真实模式切换按钮**（合入 `e334250`）：[StudentHome.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/StudentHome.tsx)、[student.css](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/student.css)，顶部常驻切换胶囊，`localStorage` 记忆键 `xiu.student.modeOverride.v1`。演示模式免登录直接进样例流；真实模式走 `useStudentSessionGate` 登录门禁。
   - **7 天动态日期与 08:00–22:00 时段**（合入 `8be07ef`）：[sampleData.ts](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/data/sampleData.ts)、[MenuPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/MenuPage.tsx)、[menu-page.css](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/menu-page.css)、[SlotDiningPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/SlotDiningPage.tsx)，修复旧样例日期过期导致的「暂无可用时段」，补齐全部 8 道样例菜品 7 天库存。
   - **学生开放注册与登录页**：[LoginPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/LoginPage.tsx)、[authView.ts](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/utils/authView.ts)、[auth.ts](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/shared/auth.ts)，对接 `POST /api/v1/auth/student-register` 与 `POST /api/v1/auth/login`。
   - **确认订单页备注输入**（合入 `9cb2926`）：[ConfirmPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/ConfirmPage.tsx)、[OrderDetailPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/OrderDetailPage.tsx)、[orderDraft.ts](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/state/orderDraft.ts)、[remark.ts](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/utils/remark.ts)，50 字上限 + 5 个常用口味快捷标签。
   - **前端 History 路由栈**（合入 `138279a`）：[StudentHome.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/StudentHome.tsx) 接入 `pushState` / `popstate` 并保留手账/卡片风格视觉与 iOS View Transition 转场（未合入被用户否决的 `HomeFeed.tsx` 去 AI 化改版）。
2. **商家端（`apps/mobile/src/modules/merchant/`，合入 `3e1710d`）**：
   - 菜品新增、改名、改类别、删除（[MenuPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/pages/MenuPage.tsx)、[source.ts](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/data/source.ts)）。
   - 菜品口味/加料编辑器与预览（[DishCustomizeEditor.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/components/DishCustomizeEditor.tsx)）。
   - 订单列表与详情页 15s 定时刷新并自动发现新单（[MerchantHome.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/MerchantHome.tsx)）。
   - 真实模式档口登录页（[MerchantLoginPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/pages/MerchantLoginPage.tsx)）与底部「菜单 / 订单 / 我的」导航栏。
3. **管理端（`apps/mobile/src/modules/admin/`，合入 `9091620`）**：
   - 管理端概览、订单、配置页重设计同步。
4. **后端服务（`services/api/`，合入 `8cc9838` + `445f22c` + `85ed5b2`）**：
   - 支持学生开放注册、认证限流、订单备注（`remark`）、商家菜品改名/改类别/删除（`DELETE /api/v1/merchant/menu/:dishId`），并取消学生下单时的时段名额上限（不再抛 `SLOT_FULL`）。
5. **已执行测试证据**：
   - 移动端单测：`node --test apps/mobile/test/*.mjs` -> **12/12 通过**
   - 服务端单测：`npm --prefix services/api test` -> **98/98 通过**（本地与 ECS 均通过）
   - 前端构建：`npm --prefix apps/mobile run build` -> **通过**（164 modules）

---

## 3. 下一对话待解决的 3 个问题（已定位根因，待修改并打 APK 1.38）

用户在收尾前指出 3 个待修复问题（多为「演示端修了但真实端没修，或只改了 JS 没改 Android 原生层」），根因与精确修改位置如下：

### 问题 A：手机左划手势退出会直接退出 App（而非返回上一页）
- **根因**：
  1. `138279a` 只在学生端前端 JS（[StudentHome.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/StudentHome.tsx)）加了 `window.history.pushState` / `popstate`。
  2. 但 Capacitor Android 工程既未安装 `@capacitor/app` 插件，[MainActivity.java](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/android/app/src/main/java/com/xiujixiang/order/MainActivity.java) 也只是空的 `public class MainActivity extends BridgeActivity {}`。
  3. 查看 [BridgeActivity.java](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/BridgeActivity.java) 可知，Capacitor 默认不注册 `OnBackPressedCallback`。在 Android 13–16 真机上左划返回会直接触发 Activity 默认 `finish()` 关闭整个 App，根本不会调用 `webView.goBack()`。
- **修复方案**：
  1. 在 [MainActivity.java](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/android/app/src/main/java/com/xiujixiang/order/MainActivity.java) 的 `onCreate` 中通过 `getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) { ... })` 拦截系统返回：
     - 若 `bridge != null && bridge.getWebView() != null`：先通过 `bridge.getWebView().evaluateJavascript` 或 `canGoBack()` 处理前端内页返回；若处于子模块顶层（`#/student`、`#/merchant`、`#/admin`、`#/system-check`）且无历史可退，则跳回 `#/`（角色选择入口）；**仅当当前已在 `#/`（或空 hash）且不可后退时，才调用 `setEnabled(false)` / `finish()` 退出 App**。
  2. 检查商家端 [MerchantHome.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/MerchantHome.tsx) 与管理端 [AdminHome.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/admin/AdminHome.tsx) 的子页面切换（全部走 `window.location.hash` / `history`），确保三端左划都能逐级返回上一页。

### 问题 B：档口端「菜单与库存」页面时段仍有人数限制
- **根因**：
  1. 魈嘶的 `85ed5b2` 只在后端 [orders.mjs](file:///D:/Jixiang/workspace/campus-meal/services/api/src/orders.mjs#L256-L261) 去掉了学生下单时的 `booked_count < capacity` 限制。
  2. 但档口端前端 [MenuPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/pages/MenuPage.tsx#L934-L1025) 仍展示 `<h3>时段（接单名额）</h3>`、`名额 {slot.capacity}`、`剩余 {slot.remaining}（已满）` 以及「接单名额」输入框和 `“接单名额”指订单笔数上限...名额不能低于已占用`（对应 [menuEdit.ts](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/state/menuEdit.ts) 的 `parseSlotPatch` 与后端 [orders.mjs](file:///D:/Jixiang/workspace/campus-meal/services/api/src/orders.mjs#L664-L685) 的 `updateMerchantSlot`）。
- **修复方案**：
  1. 在 [MenuPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/pages/MenuPage.tsx#L933-L1025) 将时段区块改为无名额上限展示（显示时段范围、已接单笔数、开放/关闭状态；编辑时段仅切换「开放接单」开关或不再限制名额下限，去掉「（已满）」红字警告与名额上限提示）。
  2. 在 [menuEdit.ts](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/state/menuEdit.ts) 与后端 [orders.mjs](file:///D:/Jixiang/workspace/campus-meal/services/api/src/orders.mjs#L682) 放开 `capacity < slot.booked_count` 的报错限制。

### 问题 C：商家注册小概率能进去（演示模式能进、真实模式被踢走或找不到入口）
- **根因**：
  1. 从角色页点「商家端」进入 `#/merchant` 时默认是 `sample` 模式，此时 `viewFromRoute()` 返回 `{ name: 'setup' }`（商家注册/开店页），所以在演示模式下能看到注册页。
  2. 但当用户点顶部「**真实 · 演示服务**」切换到真实模式时，[MerchantHome.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/MerchantHome.tsx#L313-L325) 的 `changeMode('real')` **强制执行了 `window.location.hash = ORDERS_ROUTE; setView({ name: 'list' })`**，直接把用户从 `setup` 注册页踢到了订单列表！
  3. 切到真实模式后若未登录，会渲染 [MerchantLoginPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/pages/MerchantLoginPage.tsx)，而该登录页上**没有「商家注册 / 开店」入口**；登录成功后 `handleMerchantLoggedIn()`（第 170–175 行）又强制跳去 `list`（订单列表）。
  4. 此外，[MerchantHome.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/MerchantHome.tsx#L828) 的底部导航栏写了 `{merchantLoggedIn && <nav className='merchant-tabbar'>}`，导致演示模式下未登录真实账号时底栏（含「我的 → 店铺信息与入驻」）不显示。
- **修复方案**：
  1. 在 [MerchantHome.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/MerchantHome.tsx) 中：`changeMode()` 若当前已在 `setup`（`#/merchant` 或 `#/merchant/setup`），保持 `setup` 视图不跳走；底部导航栏在 `mode === 'sample' || merchantLoggedIn` 时均显示，并可直接进「开店/入驻」。
  2. 在 [MerchantLoginPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/merchant/pages/MerchantLoginPage.tsx) 增加醒目的「商家注册 / 开店」入口（或在登录成功后若原路由为 `setup` 则留在 `setup`），确保真实模式与演示模式都能 100% 稳定进入商家注册页。

---

## 4. 新对话直接复制的开场提示词（Prompt）

```text
请先阅读 D:\Jixiang\workspace\campus-meal\.planning\HANDOFF-NEXT-CHAT.md 与 .planning\STATE.md。
当前基线在 D:\Jixiang\workspace\campus-meal 的 docs/readme-status 分支（已打 APK 1.37 / versionCode 38 并同步 ECS 39.96.195.158）。
请按 HANDOFF-NEXT-CHAT.md 第 3 节已定位的根因，依次修复以下 3 个问题并打包 APK 1.38（versionCode 39）：
1. 手机左划手势直接退出 App（在 MainActivity.java 增加 OnBackPressedCallback 联动 WebView 后退与角色首页回退，不再直接 finish App）；
2. 档口端「菜单与库存」页面时段仍有人数/名额限制（移除档口端 MenuPage 时段名额限制展示与校验）；
3. 商家注册小概率能进去（修复 MerchantHome 切换真实模式/登录时强制把 setup 跳回 list 的问题，补齐真实模式登录页与底栏的商家注册开店入口）。
```
