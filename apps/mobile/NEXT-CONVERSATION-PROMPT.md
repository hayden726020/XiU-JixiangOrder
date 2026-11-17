你接手“吉祥点餐”移动端前端工作。请始终使用简体中文，直接修改项目文件并打开实际页面验收，不只给方案或截图。

## 工作目录与必读文件

- 本地工作副本：`E:\project\workspace\frontend`
- 远端同步工作区：`E:\project\workspace\.git-sync`（稀疏检出 `apps/mobile`）
- 开始前按顺序阅读：
  1. `HANDOFF.md`
  2. `src/modules/merchant/AGENTS.md`
  3. 本次涉及文件，以 HANDOFF 第 5 节为准

## 当前已完成状态

- 档口端默认入口 `#/merchant` 是商家注册第 1 步；`#/merchant/setup` 为同一页面。
- 订单列表 `#/merchant/orders`，待接单详情 `#/merchant/orders/demo-order-001`，可取餐详情 `#/merchant/orders/demo-order-003`，菜单 `#/merchant/menu`。
- 开店流程只有“商家注册 → 创建店铺”两步；商家名称和新增菜品已彻底删除。
- 保存后“完成”返回订单列表；第 1 步“取消”返回角色入口 `#/`。
- 刷新修复提交 `98ff18d` 已通过 `tsc --noEmit` 与 `vite build`；上一轮在 390px 视口验证五个页面与流程。
- 当前基线 `ddd9785` 合并了 `9cb2926`：学生端订单备注与免登录预览；档口菜品新增、改名、改类别、删除；以及本次订单刷新修复。**不要回退这些功能**。
- 2026-11-17 已修复档口订单不自动刷新：真实模式下订单列表与详情每 15 秒自动刷新；列表有「刷新列表」按钮和最近更新时间；待接单/可取餐/普通详情有「刷新订单」按钮；发现新单会提示并自动进入「待接单」分组；停留在详情页也会检测其他新单；写操作成功后重新拉取列表。
- 刷新功能已用 Headless Edge + 本地模拟服务在真实模式验证 13 项全通过；合并基线使用基线版注册页执行 `vite build` 成功；详情页停留检测补充提交 `ca24fed` 另通过 3 项验证。
- 合并基线后 `tsc --noEmit` 还剩 1 个学生端既有类型错误（`orderCancelView.ts` 的 `CancelRequest.decisionReason`），不是本次档口改动引入；出包先用 `vite build`，不要用会先跑 tsc 的 `npm run build`。
- `frontend` 工作副本当前有未纳入基线的并行注册页改动（照片墙，引用 `wall-*.webp`，可构建）；基线版注册页在 `.git-sync/apps/mobile`，并行版本备份在 `frontend/.runtime/OnboardingPage.parallel.tsx`。
- `dist/` 已更新，但 debug APK 仍是上一轮产物：
  `E:\project\workspace\frontend\android\app\build\outputs\apk\debug\app-debug.apk`
- APK 尚未安装到手机，`adb devices` 为空；不要宣称已完成真机验收。

## 环境事实（不要重复安装）

- PATH 中没有 node/npm，使用：
  `C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe`（v24.13.0）
- JDK 21：`D:\AndroidSdk\jdk-21\jdk-21.0.13+9`
- Android SDK：`D:\AndroidSdk`（platform 36、build-tools 36.0.0、platform-tools/adb 37.0.3）
- Gradle 8.14.3，依赖走阿里云镜像，发行版走腾讯镜像
- 构建命令见 `HANDOFF.md` 第 3 节

## Git 基线

- 远端：`https://github.com/hayden726020/XiU-JixiangOrder.git`，默认分支 `main`。
- 远端基线分支：`frontend/baseline-2026-11-17`；提交链 `ddd9785 merge: 合并当前前端基线与档口订单刷新修复`（父：`98ff18d` + `9cb2926`）→ `ca24fed fix(mobile): 订单详情页定时检测新订单并保留当前订单` → 本次 docs 提交。
- 本次分支 `frontend/handoff-2026-11-17` 已与基线分支同步到同一提交（以实际 `git log` / `git ls-remote` 为准）。
- GitHub HTTPS 会间歇性超时或 `Connection was reset`；重试即可，或加 `-c http.version=HTTP/1.1`。本次主站不可用时通过 GitHub REST API 更新分支引用。
- 远端没有 `frontend/`；本地副本对应远端 `apps/mobile`。

## 关键约束

- **不要把本地 `frontend/android/` 覆盖到远端 `apps/mobile/android`**：远端是正式工程（versionCode 14 / 1.13），本地是本次临时的 Capacitor 模板（versionCode 2 / 0.1.0）。
- 不要把本地 `capacitor.config.ts` 覆盖远端版本：远端含 `android.allowMixedContent: true`，删掉会影响 HTTP 后端访问。
- 不提交 `node_modules/`、`dist/`、`.runtime/`、`.bugfix/`、`.stfolder/`、`.codeartsdoer/`、`preview/`、`photo/`、`*.sync-conflict-*`。
- 只推专用分支，不推 `main`，不强推。

## 新对话优先事项

1. **先重打 APK**（本次刷新修复只在源码，旧包不含）：先用基线版注册页执行 `vite build`，再按 HANDOFF 第 3 节执行 `gradlew.bat assembleDebug`；然后安装：
   ```powershell
   & "D:\AndroidSdk\platform-tools\adb.exe" devices
   & "D:\AndroidSdk\platform-tools\adb.exe" install -r "E:\project\workspace\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
   ```
   无法连线时，把 APK 复制到手机存储手动安装。`frontend` 当前有未纳入基线的并行注册页改动，构建前先确认使用基线版 `OnboardingPage.tsx`（备份在 `.runtime/OnboardingPage.parallel.tsx`）；本次不要跑 `npm run build`，因为它会先执行 tsc 并触发学生端既有类型错误。
2. 打开 App 验证角色入口、档口端页面、定位权限弹窗、无白屏与运行时错误。
3. 在真实模式验收订单刷新：列表显示「刷新列表」并每 15 秒更新；用学生端或接口新增订单，确认 15 秒内自动进入「待接单」并提示；详情页「刷新订单」可用。
4. 原生 App 内 `/api/v1` 相对地址不可用，需配置可访问的后端绝对地址。
5. 正式发布应在远端 `apps/mobile/android` 上递增版本构建，不用本地临时工程。
6. 浏览器验收可用局域网预览，先启动：
   ```powershell
   & $node "node_modules\vite\bin\vite.js" dev --host 0.0.0.0 --port 5176
   ```
   手机访问 `http://192.168.110.16:5176/?mode=real#/merchant/orders`（IP 变化时以 `ipconfig` WLAN IPv4 为准）。样例模式不显示刷新按钮，必须切到“真实 · 演示服务”并登录档口账号。

## 数据与兼容边界

- `MerchantRegistrationDraft` 只包含 `contactName`、`contactPhone`。
- `MerchantRegistrationInput.merchantName` 为可选；真实服务端若强制要求，先确认契约，不得伪造名称或假成功。
- 样例模式只使用本机样例数据，不冒充真实服务端。
- 不修改公共模块契约、服务端、学生端或管理端来迁就档口端视觉。
- 不提交真实个人信息或敏感凭据。

## 验证要求

```powershell
& $node "node_modules\typescript\bin\tsc" --noEmit   # 当前会剩 1 个学生端既有类型错误
& $node "node_modules\vite\bin\vite.js" build        # 基线版注册页可通过
```

至少验证：

1. `#/merchant` 默认进入注册页，页面无商家名称、无新增菜品。
2. 联系人、联系电话校验与两步开店流程。
3. `#/merchant/orders` 列表及详情返回。
4. 真实模式订单列表显示「刷新列表」与自动刷新说明；等待 15 秒或手动刷新，最近更新时间变化。
5. 新增订单后 15 秒内自动进入「待接单」并出现“发现 N 笔新订单”提示；详情页「刷新订单」可用且无错误。
6. 390px 视口无横向溢出、无运行时异常。
7. APK 安装后可正常启动。

请先汇报从 HANDOFF 和实际工作区核实到的状态，不要重复询问已确认的远端与工具链路径。