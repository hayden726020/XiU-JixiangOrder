# 吉祥点餐前端交接：档口端、局域网预览与 APK 构建

更新时间：2026-11-17

## 1 当前基线与 Git 状态

- 远端仓库：`https://github.com/hayden726020/XiU-JixiangOrder.git`，默认分支 `main`。
- 远端当前前端基线分支：`frontend/baseline-2026-11-17`，包含 `9cb2926 feat(mobile): 增加学生端订单备注与免登录预览，档口菜品新增/改名/改类别/删除`。
- 当前合并提交：`ddd9785 merge: 合并当前前端基线与档口订单刷新修复`，父提交为 `98ff18d`（刷新修复）与 `9cb2926`（并行前端基线）。
- 远端正式移动端位于 `apps/mobile`，**远端根目录没有 `frontend/` 目录**。本地的 `E:\project\workspace\frontend` 是 `apps/mobile` 的工作副本。
- 本次通过稀疏克隆建立工作区 `E:\project\workspace\.git-sync`（只检出 `apps/mobile`），在其上创建分支 `frontend/handoff-2026-11-17` 提交并推送。
- 2026-11-17 刷新修复提交：`98ff18d fix(mobile): 档口订单列表与详情支持刷新并自动发现新单`；随后合并 `9cb2926` 形成 `ddd9785`。
- 实际提交哈希与推送结果以本次回复中的 `git log -1` / `git ls-remote` 输出为准。
- GitHub HTTPS 连接在当前网络下间歇性 `Connection was reset`；重试可成功，不要据此判定仓库不可达。
- **远端 `apps/mobile/android` 是正式安卓工程**：`versionCode 14`、`versionName "1.13"`，Manifest 已声明 `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION`，`capacitor.config.ts` 含 `android.allowMixedContent: true`。
- **本地 `frontend/android` 与 `frontend/capacitor.config.ts` 是本次为出包新生成的临时模板**：`versionCode 2`、`versionName "0.1.0"`，未覆盖远端正式工程。禁止把本地 `android/` 整目录覆盖到远端 `apps/mobile/android`。

## 2 本次完成的工作

### 2.1 最新前端构建

- 重新执行 `tsc --noEmit` 与 `vite build`，均通过，`dist/` 已是最新（2026-11-17）。
- 构建仍有项目原有提示：主 chunk 超过 500kB、`shared/location.ts` 同时被静态与动态导入；不构成失败。

### 2.2 局域网预览（手机浏览器方式）

- 已用 `vite preview --host 0.0.0.0 --port 4173` 启动预览，手机访问地址：
  `http://192.168.110.16:4173/#/`
- 本机与局域网地址均返回 HTTP 200；防火墙公用配置下 `node.exe` 入站规则已放行。
- 预览进程为后台任务，**新会话不要假定其仍在运行**，需重新启动。
- 手机需与电脑处于同一 WiFi；电脑有多个虚拟网卡（192.168.13.1 / 192.168.62.1），真实 WLAN 地址是 `192.168.110.16`。

### 2.3 Android APK 构建

- 已生成 Capacitor Android 工程并成功构建 debug 包：
  `E:\project\workspace\frontend\android\app\build\outputs\apk\debug\app-debug.apk`
- 构建结果：`BUILD SUCCESSFUL in 50m 52s`，124 个任务全部执行。
- 应用信息：`appId com.xiujixiang.order`，`appName 吉祥点餐`，`versionCode 2`，`versionName "0.1.0"`。
- Manifest 已加入 `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION`，供 `@capacitor/geolocation` 使用。
- **APK 尚未安装到手机**：`adb devices` 当前为空，用户未连接数据线或未开启 USB 调试。不要宣称已完成真机安装或真机验收。

### 2.4 档口订单刷新与自动发现新单（2026-11-17 本次修复）

- 问题：订单页只在进入时读取一次订单，列表和详情都没有刷新入口；商家停留在页面上时，服务端新增订单不会出现。
- 修复：
  - 真实模式每 15 秒自动刷新：列表页刷新当前分页，详情页刷新当前订单；页面回到前台时立即补刷一次。
  - 订单列表新增「刷新列表」按钮，并显示“每 15 秒自动刷新 · 最近更新 HH:MM:SS”。
  - 待接单、可取餐和普通详情页在“返回订单列表”右侧新增「刷新订单」按钮。
  - 轮询发现新的 `NEW` 订单时提示“发现 N 笔新订单，已在「待接单」分组显示”。
  - 接单、制作、可取、核销等写操作成功后重新拉取订单列表。
- 涉及文件（未改公共层、学生端或管理端）：
  `src/modules/merchant/MerchantHome.tsx`、`src/modules/merchant/merchant.css`、
  `src/modules/merchant/pages/OrderListPage.tsx`、`pages/OrderDetailPage.tsx`、
  `pages/NewOrderDetailPage.tsx`、`pages/ReadyOrderDetailPage.tsx`。
- 边界：样例模式不轮询、不显示刷新按钮；真实模式未登录时不发起订单请求。

## 3 本次安装的工具链

均位于 `D:\AndroidSdk`，可从命令行直接复用：

| 组件 | 路径 / 版本 |
| --- | --- |
| JDK 21 | `D:\AndroidSdk\jdk-21\jdk-21.0.13+9`（Temurin 21.0.13） |
| Android SDK | `D:\AndroidSdk`（`ANDROID_HOME` / `ANDROID_SDK_ROOT`） |
| platform | `platforms\android-36`（API 36，Platform.Version 16） |
| build-tools | `build-tools\36.0.0` |
| platform-tools | `platform-tools`（adb 37.0.3） |
| 许可文件 | `licenses\android-sdk-license`（已手工补齐标准哈希） |
| Gradle | 8.14.3（wrapper 指向腾讯镜像） |
| Node | `C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe`（v24.13.0，PATH 中无 node/npm） |

构建命令（在 `E:\project\workspace\frontend\android` 下）：

```powershell
$env:JAVA_HOME = "D:\AndroidSdk\jdk-21\jdk-21.0.13+9"
$env:ANDROID_HOME = "D:\AndroidSdk"
$env:ANDROID_SDK_ROOT = "D:\AndroidSdk"
cmd /c "gradlew.bat assembleDebug --console=plain"
```

Gradle 依赖已配置阿里云镜像（google / central / gradle-plugin），Gradle 发行版走腾讯镜像，SDK 与命令行工具来自 Google 官方源。首次构建耗时较长（依赖下载），后续增量构建会明显加快。

## 4 档口端功能（沿用上一轮，不要撤销）

- 当前基线同时包含 `9cb2926` 的并行前端功能：学生端订单备注与免登录预览；档口菜品新增、改名、改类别、删除。相关文件包括 `src/modules/merchant/pages/MenuPage.tsx`、`data/source.ts`、`data/types.ts`、`state/menuEdit.ts` 及学生端若干文件，**不要回退或覆盖**。
- 本次刷新修复只改订单列表与订单详情相关文件，不改菜单、学生端或公共层。

| 页面 | 地址 | 状态 |
| --- | --- | --- |
| 商家注册开店 | `#/merchant` | 档口端默认入口，直接进入注册第 1 步 |
| 商家注册开店（别名） | `#/merchant/setup` | 与默认入口一致 |
| 订单列表 | `#/merchant/orders` | 独立列表地址 |
| 订单详情－待接单 | `#/merchant/orders/demo-order-001` | 可直达、刷新保持 |
| 订单详情－可取餐 | `#/merchant/orders/demo-order-003` | 可直达、刷新保持 |
| 菜单与库存 | `#/merchant/menu` | 保留既有页面 |

- 开店流程只有两步：商家注册（联系人、联系电话）→ 创建店铺（店铺名称、档口位置、店铺简介可选）。
- 已删除“商家名称”字段、 “新增菜品”第三步及其表单、提示与提交逻辑。
- 保存成功后“完成”返回订单列表；第 1 步“取消”返回角色入口 `#/`。
- 注册数据边界：`MerchantRegistrationDraft` 只有 `contactName`、`contactPhone`；`MerchantRegistrationInput.merchantName` 为可选。
- 未做真实服务端注册联调，不得宣称真实接口成功。

## 5 本次提交到远端的范围

只同步 `apps/mobile` 下的前端源码与交接文档，**不包含**：

- 本地 `android/`（临时工程）与 `capacitor.config.ts`（会覆盖远端正式配置）；
- `node_modules/`、`dist/`、`.runtime/`、`.bugfix/`、`.stfolder/`、`.codeartsdoer/`、`preview/`、`photo/`；
- `*.sync-conflict-*` 冲突副本。

源码变更包括 `src/app/App.tsx`、`src/modules/admin/*`、`src/modules/merchant/*`、`src/modules/student/*` 等，具体以该分支的 `git show --stat` 为准。

## 6 实际验证结果

已通过：

- 刷新修复提交 `98ff18d`：`tsc --noEmit` 0 错误；`vite build` 成功。
- Headless Edge + 本地模拟服务（真实模式）自动验证 13 项全部通过：刷新按钮可点击、15 秒自动刷新、最近更新时间更新、新单自动进入「待接单」并提示、详情页刷新按钮与刷新完成、停留在详情页发现新单、无运行时异常或 `console.error`。
- 合并基线 `ddd9785`：使用基线版注册页执行 `vite build` 成功；合并无冲突。
- 上一轮：4173 本机与局域网 HTTP 200；`gradlew.bat assembleDebug` `BUILD SUCCESSFUL`。
- 五个档口端设计页面、两步开店流程、订单详情直达与 390px 布局：上一轮已在 Headless Edge 中验证通过并记录。

已知问题（不属于本次档口改动）：

- 合并基线后 `tsc --noEmit` 剩 1 个学生端既有类型错误：`src/modules/student/utils/orderCancelView.ts` 引用 `CancelRequest.decisionReason`，但 `student/types.ts` 的 `CancelRequest` 未声明该字段。需学生端负责人补类型；在修复前请用 `vite build` 出包，不要用会先跑 tsc 的 `npm run build`。
- 本地 `frontend` 工作副本当前有一份并行中的注册页改动（`OnboardingPage.tsx` 引用 `wall-*.jpg`，实际资源是 `.webp`），**未纳入本次基线**；直接在本副本 `vite build` 会报 5 个资源缺失。并行版本已备份到 `frontend/.runtime/OnboardingPage.parallel.tsx`，基线版注册页可正常构建。不要把它当作本次基线的一部分推送。

尚未验证：

- **本次刷新修复未重打 APK**：现有 `app-debug.apk` 仍是上一轮构建，手机安装后不会包含本轮代码。
- 公网真实后端的新单轮询联调；本轮使用本地模拟服务验证前端行为，不能当作真实接口联调证据。
- APK 真机安装、首次启动、WebView 内页面渲染。
- 原生 App 内的真实定位授权与后端联调。

## 7 新对话应优先做的事

1. **先重打 APK**（本次修复只在源码，旧包不含）：在基线目录（`E:\project\workspace\.git-sync\apps\mobile` 或去掉并行注册页改动后的 `frontend`）执行 `vite build`，再按第 3 节命令执行 `gradlew.bat assembleDebug`；随后安装：

   ```powershell
   & "D:\AndroidSdk\platform-tools\adb.exe" devices
   & "D:\AndroidSdk\platform-tools\adb.exe" install -r "E:\project\workspace\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
   ```

   不能用数据线时，直接把 `app-debug.apk` 复制到手机存储，在文件管理器中点击安装（需允许“安装未知来源应用”）。

   注意：`frontend` 当前有一份并行注册页改动引用缺失的 `wall-*.jpg`，直接构建会失败；基线版注册页在 `.git-sync/apps/mobile`，备份在 `frontend/.runtime/OnboardingPage.parallel.tsx`。合并基线还有 1 个学生端 tsc 类型错误，出包请直接跑 `vite build`，不要跑含 tsc 的 `npm run build`。

2. 打开 App 验证：角色入口、档口端五个页面、地图定位授权弹窗、页面无白屏；在真实模式进入订单列表，确认「刷新列表」、15 秒自动刷新与新单提示；进入详情确认「刷新订单」。
3. 原生 App 里 `window.location.origin` 不是预览地址，`/api/v1` 相对地址不可用；需在应用内配置可访问的后端绝对地址。
4. 若要发正式版本，应在远端 `apps/mobile/android`（versionCode 14 / 1.13）上构建并递增版本号，不要使用本地临时工程。
5. 浏览器验收可用局域网预览：`vite dev --host 0.0.0.0 --port 5176` 或 `vite preview --host 0.0.0.0 --port 4173`；服务需重新启动，不要假定后台进程仍在运行。若要验收真实模式，需先准备可达的公共后端；仅用样例数据看不到刷新按钮。

## 8 运行与预览命令

在 `E:\project\workspace\frontend` 下（Node 未进 PATH）：

```powershell
$node = "C:\Program Files\Adobe\Adobe Creative Cloud Experience\libs\node.exe"
& $node "node_modules\typescript\bin\tsc" --noEmit
& $node "node_modules\vite\bin\vite.js" build
& $node "node_modules\vite\bin\vite.js" preview --host 0.0.0.0 --port 4173
```

手机与电脑同一 WiFi，访问 `http://192.168.110.16:4173/#/`；IP 变化时以 `ipconfig` 的 WLAN IPv4 为准。

## 9 Git 操作约定

- 工作区：`E:\project\workspace\.git-sync`（稀疏检出 `apps/mobile`）。
- 当前分支：`frontend/handoff-2026-11-17`，HEAD 为 `ddd9785`（合并 `98ff18d` + `9cb2926`）。
- 远端基线分支 `frontend/baseline-2026-11-17` 已同步到同一 `ddd9785`；只推专用分支，不推 `main`，不强推。
- 提交信息：`fix(mobile): 档口订单列表与详情支持刷新并自动发现新单`、`merge: 合并当前前端基线与档口订单刷新修复`、`docs(mobile): 更新基线与交接说明`。
- GitHub 主站连接可能超时或 `Connection was reset`；重试或用 `-c http.version=HTTP/1.1`。本次主站不可用时通过 GitHub REST API 更新分支引用，远端与本地 SHA 一致。
- 推送后用 `git log -1 --oneline`、`git status`、`git ls-remote` 核对。