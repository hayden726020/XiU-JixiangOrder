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
- TypeScript、Vite 构建已通过；上一轮已在 390px 视口验证五个页面与流程。
- 本次已重新构建 `dist/`，并成功产出 debug APK：
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

- 远端：`https://github.com/hayden726020/XiU-JixiangOrder.git`，默认分支 `main`，基线提交 `e08292d`。
- 本次分支：`frontend/handoff-2026-11-17`，已提交并推送（以实际 `git log` 为准）。
- GitHub HTTPS 会间歇性 `Connection was reset`，重试即可，不要因此判定不可达。
- 远端没有 `frontend/`；本地副本对应远端 `apps/mobile`。

## 关键约束

- **不要把本地 `frontend/android/` 覆盖到远端 `apps/mobile/android`**：远端是正式工程（versionCode 14 / 1.13），本地是本次临时的 Capacitor 模板（versionCode 2 / 0.1.0）。
- 不要把本地 `capacitor.config.ts` 覆盖远端版本：远端含 `android.allowMixedContent: true`，删掉会影响 HTTP 后端访问。
- 不提交 `node_modules/`、`dist/`、`.runtime/`、`.bugfix/`、`.stfolder/`、`.codeartsdoer/`、`preview/`、`photo/`、`*.sync-conflict-*`。
- 只推专用分支，不推 `main`，不强推。

## 新对话优先事项

1. 连接手机并开启 USB 调试，执行：
   ```powershell
   & "D:\AndroidSdk\platform-tools\adb.exe" devices
   & "D:\AndroidSdk\platform-tools\adb.exe" install -r "E:\project\workspace\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
   ```
   无法连线时，把 APK 复制到手机存储手动安装。
2. 打开 App 验证角色入口、档口端页面、定位权限弹窗、无白屏与运行时错误。
3. 原生 App 内 `/api/v1` 相对地址不可用，需配置可访问的后端绝对地址。
4. 正式发布应在远端 `apps/mobile/android` 上递增版本构建，不用本地临时工程。
5. 浏览器验收可用局域网预览，先启动：
   ```powershell
   & $node "node_modules\vite\bin\vite.js" preview --host 0.0.0.0 --port 4173
   ```
   手机访问 `http://192.168.110.16:4173/#/`（IP 变化时以 `ipconfig` WLAN IPv4 为准）。

## 数据与兼容边界

- `MerchantRegistrationDraft` 只包含 `contactName`、`contactPhone`。
- `MerchantRegistrationInput.merchantName` 为可选；真实服务端若强制要求，先确认契约，不得伪造名称或假成功。
- 样例模式只使用本机样例数据，不冒充真实服务端。
- 不修改公共模块契约、服务端、学生端或管理端来迁就档口端视觉。
- 不提交真实个人信息或敏感凭据。

## 验证要求

```powershell
& $node "node_modules\typescript\bin\tsc" --noEmit
& $node "node_modules\vite\bin\vite.js" build
```

至少验证：

1. `#/merchant` 默认进入注册页，页面无商家名称、无新增菜品。
2. 联系人、联系电话校验与两步开店流程。
3. `#/merchant/orders` 列表及详情返回。
4. 390px 视口无横向溢出、无运行时异常。
5. APK 安装后可正常启动。

请先汇报从 HANDOFF 和实际工作区核实到的状态，不要重复询问已确认的远端与工具链路径。