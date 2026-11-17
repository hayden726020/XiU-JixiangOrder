你接手“吉祥点餐”移动端前端工作。请始终使用简体中文，直接修改项目文件并打开实际页面验收，不只给方案或截图。

## 工作目录与必读文件

- 本地工作副本：`E:\project\workspace\frontend`
- 远端同步工作区：`E:\project\workspace\.git-sync`（稀疏检出 `apps/mobile`）
- 开始前按顺序阅读：
  1. `HANDOFF.md`
  2. `src/modules/merchant/AGENTS.md`
  3. 本次涉及文件，以 HANDOFF 第 5 节为准

## 当前已完成状态

- 档口端默认入口 `#/merchant` 进入入驻/登录门（真实模式未登录先登录）；订单列表 `#/merchant/orders`，数据模式选择 `#/merchant/source`，菜单 `#/merchant/menu`，我的 `#/merchant/my`。
- 开店流程只有“商家注册 → 创建店铺”两步；注册页第 1 步只填写「店铺负责人」「联系电话」，不展示商家名称输入（自动取当前档口账号名提交），也不出现新增菜品步骤。
- 保存后“完成”回到数据模式选择页；第 1 步“取消”返回角色入口 `#/`。
- 刷新修复提交 `98ff18d` 已通过 `tsc --noEmit` 与 `vite build`；上一轮在 390px 视口验证五个页面与流程。
- 2026-11-17 新增档口登录页 `src/modules/merchant/pages/MerchantLoginPage.tsx`：真实模式未登录时直接进入全屏登录页，登录成功后才读取真实菜单与订单；真实横幅显示当前档口账号，并提供「退出登录 / 切换档口账号」。登录页同时提供「先看样例数据」「服务与登录自检」「返回角色入口」。
- 当前基线 `ca97747`（本地同内容 `81113c3`）已纳入登录页、并行完成的注册页照片墙、菜品自定义、品牌图片与档口视觉样式；`3e1710d feat(mobile): 档口端增加底部导航与我的页面` 增加菜单/订单/我的三个底部入口，我的页显示档口账号并提供开店、退出登录与返回角色入口。**不要回退这些功能**。
- 2026-11-17 22:50 当前基线 `ba4bdc3`（远端 `frontend/handoff-2026-11-17`）：`82044d9` 恢复管理端横幅与导航并统一学生端金色配色，`19902d0` 增加档口数据模式选择、钱包页与注册页账号名回填，`ba4bdc3` 拆分学生端订单/菜单组件。注册页已无商家名称输入；`merchantName` 仍提交，取 `session.user.displayName`（截断 20 字符，兜底「档口商家」）。
- 入驻状态提交远端 `ef68433 feat(mobile): 档口端注册完成后不再重复注册`（本地同内容 `9e59744`），其后接记录本节的 docs 提交：真实模式登录后读取 `GET /merchant/profile`；已开店账号不再显示“商家注册 / 开店”入口，入驻页显示只读资料；已有商家未开店时跳过注册第 1 步；退出登录只清除会话，服务端注册数据保留。
- 登录页已用 Headless Edge + 本地模拟服务验证 11 项全通过：未登录进入登录页、显示服务地址与入口、不展示订单；登录成功进入真实订单列表并读到订单；退出回登录页；样例模式免登录；切回真实模式重新要求登录。
- 订单刷新：真实模式下订单列表与详情每 15 秒自动刷新；列表有「刷新列表」按钮和最近更新时间；待接单/可取餐/普通详情有「刷新订单」按钮；发现新单会提示并自动进入「待接单」分组；写操作成功后重新拉取列表。
- 当前工作副本 `tsc --noEmit` 0 错误；`vite build` 成功。出包仍优先直接执行 `vite build`。
- `frontend` 工作副本与远端已同步注册页照片墙、学生端首页改动与本次入驻状态改动；`.runtime/OnboardingPage.parallel.tsx` 只是历史备份，不参与构建。
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
- 远端基线分支：`frontend/baseline-2026-11-17`；专用分支 `frontend/handoff-2026-11-17` 当前远端头 `ba4bdc3`，提交链 `82044d9` → `19902d0` → `ba4bdc3`，其后接记录本节的 docs 提交。
- 远端历史里存在 `ef68433`/`fbbac94`/`d321d90` 三个同内容重复提交（GitHub API 推送产生）；本地已 rebase 到其上，不要再强推本地旧提交。
- GitHub HTTPS 会间歇性超时或 `Connection was reset`；重试即可，或加 `-c http.version=HTTP/1.1`。本次主站不可用时通过 GitHub REST API 更新分支引用。
- 远端没有 `frontend/`；本地副本对应远端 `apps/mobile`。

## 关键约束

- **不要把本地 `frontend/android/` 覆盖到远端 `apps/mobile/android`**：远端是正式工程（versionCode 14 / 1.13），本地是本次临时的 Capacitor 模板（versionCode 2 / 0.1.0）。
- 不要把本地 `capacitor.config.ts` 覆盖远端版本：远端含 `android.allowMixedContent: true`，删掉会影响 HTTP 后端访问。
- 不提交 `node_modules/`、`dist/`、`.runtime/`、`.bugfix/`、`.stfolder/`、`.codeartsdoer/`、`preview/`、`photo/`、`*.sync-conflict-*`。
- 只推专用分支，不推 `main`，不强推。

## 新对话优先事项

1. **先重打 APK**（登录页与刷新修复仅在源码，旧包不含）：在 `frontend` 或 `.git-sync/apps/mobile` 执行 `vite build`，再按 HANDOFF 第 3 节执行 `gradlew.bat assembleDebug`；然后安装：
   ```powershell
   & "D:\AndroidSdk\platform-tools\adb.exe" devices
   & "D:\AndroidSdk\platform-tools\adb.exe" install -r "E:\project\workspace\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
   ```
   无法连线时，把 APK 复制到手机存储手动安装。本次不要跑 `npm run build`，因为它会先执行 tsc 并触发学生端既有类型错误。
2. 打开 App 验证角色入口、档口端页面、定位权限弹窗、无白屏与运行时错误。
3. 真实模式验收登录门：带 `?mode=real` 进入档口端先出现登录页，账号密码登录成功后才加载真实菜单与订单；横幅「退出登录 / 切换档口账号」可回到登录页；样例模式仍免登录。
4. 原生 App 内 `/api/v1` 相对地址不可用，需配置可访问的后端绝对地址。
5. 正式发布应在远端 `apps/mobile/android` 上递增版本构建，不用本地临时工程。
6. 浏览器验收可用局域网预览，先启动：
   ```powershell
   & $node "node_modules\vite\bin\vite.js" dev --host 0.0.0.0 --port 5176
   ```
   手机访问 `http://192.168.110.16:5176/?mode=real#/merchant/orders`（IP 变化时以 `ipconfig` WLAN IPv4 为准）。样例模式不显示刷新按钮，必须切到“真实 · 演示服务”并登录档口账号。

## 数据与兼容边界

- `MerchantRegistrationDraft` 包含 `merchantName`、`contactName`、`contactPhone`；注册页不展示 `merchantName` 输入，提交时自动填当前档口账号名（`session.user.displayName`，截断 20 字符，兜底「档口商家」）。
- 真实服务端 `POST /merchant/registration` 强制要求 `merchantName`（2—30 字符），不得省略该字段，也不得伪造名称或假成功。
- 样例模式只使用本机样例数据，不冒充真实服务端。
- 不修改公共模块契约、服务端、学生端或管理端来迁就档口端视觉。
- 不提交真实个人信息或敏感凭据。

## 验证要求

```powershell
& $node "node_modules\typescript\bin\tsc" --noEmit   # 当前 0 错误
& $node "node_modules\vite\bin\vite.js" build        # 通过
```

至少验证：

1. `#/merchant` 默认进入入驻/登录门；`#/merchant/setup` 进入注册页，页面无商家名称输入（`[data-field="merchantName"]` 不存在），无新增菜品步骤。
2. 未注册账号：联系人、联系电话校验与两步开店流程；已有商家未开店：第 1 步只读、直接创建店铺；已开店：入驻页只读展示且订单列表无注册入口。
3. `#/merchant/orders` 列表及详情返回。
4. 带 `?mode=real` 时未登录进入档口登录页，不展示订单；登录成功进入真实订单列表；退出后回登录页，再次登录仍识别已注册状态。
5. 真实模式订单列表显示「刷新列表」与自动刷新说明；等待 15 秒或手动刷新，最近更新时间变化。
6. 新增订单后 15 秒内自动进入「待接单」并出现“发现 N 笔新订单”提示；详情页「刷新订单」可用且无错误。
7. 390px 视口无横向溢出、无运行时异常。
8. APK 安装后可正常启动。

请先汇报从 HANDOFF 和实际工作区核实到的状态，不要重复询问已确认的远端与工具链路径。