# 吉祥点餐前端交接：档口端、局域网预览与 APK 构建

更新时间：2026-11-17

## 1 当前基线与 Git 状态

- 远端仓库：`https://github.com/hayden726020/XiU-JixiangOrder.git`，默认分支 `main`。
- 远端最新提交基线：`e08292d docs(contract): 修 C1—C3 并更新契约确认状态`。
- 远端正式移动端位于 `apps/mobile`，**远端根目录没有 `frontend/` 目录**。本地的 `E:\project\workspace\frontend` 是 `apps/mobile` 的工作副本。
- 本次通过稀疏克隆建立工作区 `E:\project\workspace\.git-sync`（只检出 `apps/mobile`），在其上创建分支 `frontend/handoff-2026-11-17` 提交并推送。
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

- `tsc --noEmit`：0 错误。
- `vite build`：成功，dist 更新。
- `http://127.0.0.1:4173/` 与 `http://192.168.110.16:4173/`：HTTP 200。
- `gradlew.bat assembleDebug`：`BUILD SUCCESSFUL`，产出 `app-debug.apk`。
- 五个档口端设计页面、两步开店流程、订单详情直达与 390px 布局：上一轮已在 Headless Edge 中验证通过并记录，本轮未重复回归。

尚未验证：

- APK 真机安装、首次启动、WebView 内页面渲染。
- 原生 App 内的真实定位授权与后端联调。

## 7 新对话应优先做的事

1. **把 APK 装到手机**：手机开启“开发者选项 → USB 调试”，连接数据线后执行：

   ```powershell
   & "D:\AndroidSdk\platform-tools\adb.exe" devices
   & "D:\AndroidSdk\platform-tools\adb.exe" install -r "E:\project\workspace\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
   ```

   不能用数据线时，直接把 `app-debug.apk` 复制到手机存储，在文件管理器中点击安装（需允许“安装未知来源应用”）。

2. 打开 App 验证：角色入口、档口端五个页面、地图定位授权弹窗、页面无白屏。
3. 原生 App 里 `window.location.origin` 不是 `http://192.168.110.16:4173`，`/api/v1` 相对地址不可用；需在应用内配置可访问的后端绝对地址。
4. 若要发正式版本，应在远端 `apps/mobile/android`（versionCode 14 / 1.13）上构建并递增版本号，不要使用本地临时工程。
5. 浏览器验收可继续使用局域网地址；服务需重新启动。

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
- 分支：`frontend/handoff-2026-11-17`。
- 只推该专用分支，不推 `main`，不强推。
- 提交信息建议：`feat(mobile): 同步档口端与后台页面并补充 APK 构建交接`。
- 推送后用 `git log -1 --oneline`、`git status`、`git ls-remote` 核对。