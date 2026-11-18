# 新对话交接：学生端全页面合流基线（`297757e`）与 APK 云端热更新（方案一）落地指南

更新时间：2026-11-18 17:05（Asia/Shanghai）

---

## 1. 当前最新基线与环境状态

- **主代码仓库**：`D:\Jixiang\workspace\campus-meal`
- **协同资料工作区**：`D:\Jixiang\workspace\team-context`（正式移动端工程位于 `campus-meal\apps\mobile`，后端位于 `campus-meal\services\api`）
- **当前分支与远端**：`docs/readme-status`（已推送至 `origin/docs/readme-status`，最新提交 **`297757e`**，`git status` 干净）
- **最近提交链**：
  - `297757e fix(student): allow opening orders and order detail before entering a shop`
  - `50730da feat(student): merge redesigned ConfirmPage, OrderDetailPage, and dish customization flow`
  - `10396b2 feat(student): 重构确认订单页纸质票据视觉并优化当前店铺行与确认下单按钮`
  - `4d37cfa fix(student,merchant): 修复学生端我的跳点餐导航保持选店页并同步当前三端与服务端基线`
- **已验证状态**：
  - 前端构建：`npm --prefix apps/mobile run build`（`tsc --noEmit && vite build`）通过（187 modules，0 报错）。
  - 后端单测：`npm --prefix services/api test` **107/107 全部通过**。
- **构建工具链（本机已就绪，勿重复安装）**：
  - JDK 21：`D:\Jixiang\.runtime\jdk21-full\jdk-21.0.13+9`（或 `D:\AndroidSdk\jdk-21\jdk-21.0.13+9`）
  - Android SDK：`C:\Users\SPcuteAG\AppData\Local\Android\Sdk`（或 `D:\AndroidSdk`）
- **阿里云 ECS 公网服务器**：
  - 公网 HTTPS 地址：`https://39.96.195.158`（接口前缀 `https://39.96.195.158/api/v1`，已具有受信任 Let's Encrypt 短期 IP HTTPS 证书与 Nginx 443 反代）
  - 后端部署目录：`/opt/jixiang-order/services/api/`（SQLite 持久化库位于 `/opt/jixiang-order/data/orders.sqlite`，**严禁清空或覆盖线上数据库文件**）
  - SSH 连接规范：详见 `D:\Jixiang\workspace\team-context\backend\交接\HANDOFF-FOR-NEXT-AGENT.md`，仅通过 `-i "D:\Jixiang\.runtime\server-keys\jixiang_aliyun_ecs_20261114"` 与 `StrictHostKeyChecking=yes` 调用 `E:\Git\usr\bin\ssh.exe`（严禁读取或打印私钥内容）。

---

## 2. 本轮已完成内容概览

1. **学生端全套新版页面替换与合流（`apps/mobile/src/modules/student/`）**：
   - **首页与选店点餐页**：[HomeFeed.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/components/HomeFeed.tsx)、[ShopSelectPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/ShopSelectPage.tsx)
   - **点餐菜单页（含菜品口味/配菜/加料选择与 7 天横滑日期条）**：[MenuPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/MenuPage.tsx)、[OrderDishCard.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/components/OrderDishCard.tsx)、[order-menu.css](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/order-menu.css)
   - **预约取餐时段页**：[SlotDiningPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/SlotDiningPage.tsx)、[BookingTicket.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/components/BookingTicket.tsx)、[booking-reference.css](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/booking-reference.css)
   - **确认订单页（新版纸质票据视觉）**：[ConfirmPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/ConfirmPage.tsx)、[confirm-order.css](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/confirm-order.css)
   - **订单列表页**：[OrderListPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/OrderListPage.tsx)、[OrderTicketCard.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/components/OrderTicketCard.tsx)、[order-list-new.css](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/order-list-new.css)
   - **订单详情页（新版暖白齿孔小票视觉）**：[OrderDetailPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/OrderDetailPage.tsx)、[order-detail.css](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/order-detail.css)
   - **新版「我的」页面 + 设置内模式切换**：[ProfilePage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/ProfilePage.tsx)、[profile.css](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/profile.css)、[mode.ts](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/data/mode.ts)、[StudentHome.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/StudentHome.tsx)（右上角齿轮「账号与设置」弹窗内含「演示模式 / 真实模式」切换并持久化至 `localStorage`；真实模式未登录页 [LoginPage.tsx](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/src/modules/student/pages/LoginPage.tsx) 底部附带一键切回演示模式入口）。
2. **后端与档口/管理端基线（`4d37cfa`）**：
   - 包含菜品定制、今日菜单、商家与店铺资料编辑、营业时间、钱包、自助注册、多店铺支持等 v0.7 能力，单测 107/107 通过。

---

## 3. 下一 Agent 核心任务：落地「方案一（ECS 云端静态托管 + Capacitor `server.url` 热更新 APK）」

用户决定采用 **方案一** 实现 APK 前端热更新：将前端 `dist/` 部署到阿里云 ECS 的 Nginx（`https://39.96.195.158/`），并将 Capacitor 配置指向该地址，打一次 APK。之后每次修改前端只需构建并上传 `dist/` 到 ECS，手机打开 App 即刻生效，无需再重打 APK。

请按以下 **4 个步骤** 依次执行：

### 步骤 1：同步最新后端代码至阿里云 ECS（`https://39.96.195.158/api/v1`）
1. 在 ECS 上备份现有 `/opt/jixiang-order/services/api` 与 `/opt/jixiang-order/data/orders.sqlite*` 到 `/root/backup-api-20261118/`。
2. 将本地 `D:\Jixiang\workspace\campus-meal\services\api\src\*`、`test\*`、`package.json` 同步至 ECS `/opt/jixiang-order/services/api/`（**切勿覆盖 `/opt/jixiang-order/data/orders.sqlite`**）。
3. 在 ECS 以 `jixiang` 用户运行 `npm test` 确认 **107/107 通过**，随后 `systemctl restart jixiang-api.service` 并确认 `https://39.96.195.158/api/v1/health` 返回 200。

### 步骤 2：在阿里云 ECS Nginx 部署前端 `dist/` 静态站点（`https://39.96.195.158/`）
1. 在本地 `D:\Jixiang\workspace\campus-meal\apps\mobile` 执行 `npm run build`，生成最新生产构建产物 `dist/`。
2. 将 `dist/` 上传至 ECS（例如 `/var/www/jixiang-order/` 或 `/opt/jixiang-order/web/dist/`，确保 Nginx worker 用户有读取权限）。
3. 检查并更新 ECS 上的 Nginx 443 站点配置：
   - 保持 `location /api/v1/` 反代 `http://127.0.0.1:8787/api/v1/` 不变（注意保留请求体大小限制如 `client_max_body_size 10m;` 以支持菜品图片上传）；
   - 新增/更新根路径 `location /` 指向前端 `dist/` 目录：
     ```nginx
     root /var/www/jixiang-order;
     index index.html;

     location = /index.html {
         add_header Cache-Control "no-cache, no-store, must-revalidate";
         add_header Pragma "no-cache";
         add_header Expires "0";
     }

     location / {
         try_files $uri $uri/ /index.html;
     }
     ```
     > **关键点**：`index.html` 必须禁止缓存（`no-cache, no-store`），这样手机 WebView 每次启动或刷新都会拉取最新的 `index.html` 及其引用的新 hash JS/CSS，实现真正秒级热更新。
4. 执行 `nginx -t && systemctl reload nginx`，从本机验证 `https://39.96.195.158/` 返回 200 且能加载 `index.html` 与 `assets/*`。

### 步骤 3：配置 `capacitor.config.ts` 并打包热更新版 Android APK
1. 修改 [capacitor.config.ts](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/capacitor.config.ts)：
   ```ts
   import type { CapacitorConfig } from '@capacitor/cli';

   const config: CapacitorConfig = {
     appId: 'com.xiujixiang.order',
     appName: '食麦呼',
     webDir: 'dist',
     server: {
       url: 'https://39.96.195.158',
       cleartext: false,
     },
     android: {
       allowMixedContent: true,
     },
   };

   export default config;
   ```
2. 在 [build.gradle](file:///D:/Jixiang/workspace/campus-meal/apps/mobile/android/app/build.gradle) 中递增 `versionCode` 与 `versionName`（例如升至 `versionCode 40` / `versionName "1.39"`）。
3. 在 `D:\Jixiang\workspace\campus-meal\apps\mobile` 下执行：
   ```powershell
   $env:JAVA_HOME = "D:\Jixiang\.runtime\jdk21-full\jdk-21.0.13+9"
   $env:ANDROID_HOME = "C:\Users\SPcuteAG\AppData\Local\Android\Sdk"
   $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
   npm run build
   npx cap sync android
   .\android\gradlew.bat -p android assembleDebug
   ```
4. 核对生成的 `D:\Jixiang\workspace\campus-meal\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk` 文件大小、SHA-256 与版本号。

### 步骤 4：提供一个一键前端热更新脚本（方便后续秒级发布前端）
- 在 `campus-meal` 下编写或说明一键部署命令（`npm --prefix apps/mobile run build` + `scp`/`tar` 同步 `apps/mobile/dist/*` 到 ECS `/var/www/jixiang-order/`），并提交推送至 `origin/docs/readme-status`。

---

## 4. 新对话直接复制的开场提示词（Prompt）

```text
请先阅读 D:\Jixiang\workspace\team-context\HANDOFF-NEXT-CHAT.md（与 D:\Jixiang\workspace\campus-meal\.planning\HANDOFF-NEXT-CHAT.md 同步）以及 D:\Jixiang\workspace\team-context\backend\交接\HANDOFF-FOR-NEXT-AGENT.md。
当前代码基线已在 D:\Jixiang\workspace\campus-meal 的 docs/readme-status 分支（297757e）。
请按 HANDOFF-NEXT-CHAT.md 第 3 节的 4 个步骤落地「方案一（阿里云 ECS 前端静态托管 + Capacitor server.url 热更新 APK）」：
1. 备份并同步最新 services/api 到阿里云 ECS（https://39.96.195.158/api/v1），确保 107/107 测试通过且不覆盖线上 SQLite 数据；
2. 将 apps/mobile 的 dist/ 部署到 ECS Nginx 根目录（https://39.96.195.158/），对 index.html 配置 no-cache；
3. 将 capacitor.config.ts 的 server.url 指向 https://39.96.195.158，递增版本号并打包生成最新 app-debug.apk；
4. 验证公网页面与接口可达，提交并推送到 origin/docs/readme-status。
```
