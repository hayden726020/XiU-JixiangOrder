# 吉祥点餐前端交接：档口端、局域网预览与 APK 构建

更新时间：2026-11-18

## 1 当前基线与 Git 状态

- 远端仓库：`https://github.com/hayden726020/XiU-JixiangOrder.git`，默认分支 `main`。
- 远端当前前端基线分支：`frontend/baseline-2026-11-17`，包含 `9cb2926 feat(mobile): 增加学生端订单备注与免登录预览，档口菜品新增/改名/改类别/删除`。
- 当前合并提交：`ddd9785 merge: 合并当前前端基线与档口订单刷新修复`，父提交为 `98ff18d`（刷新修复）与 `9cb2926`（并行前端基线）。
- 合并后补齐：`ca24fed fix(mobile): 订单详情页定时检测新订单并保留当前订单`；当前分支再后接本次 docs 提交。
- 远端正式移动端位于 `apps/mobile`，**远端根目录没有 `frontend/` 目录**。本地的 `E:\project\workspace\frontend` 是 `apps/mobile` 的工作副本。
- 本次通过稀疏克隆建立工作区 `E:\project\workspace\.git-sync`（只检出 `apps/mobile`），在其上创建分支 `frontend/handoff-2026-11-17` 提交并推送。
- 2026-11-17 刷新修复提交：`98ff18d fix(mobile): 档口订单列表与详情支持刷新并自动发现新单`；随后合并 `9cb2926` 形成 `ddd9785`。
- 实际提交哈希与推送结果以本次回复中的 `git log -1` / `git ls-remote` 输出为准。
- 2026-11-17 档口登录页提交：远端 `ca97747 feat(mobile): 档口端登录页接通真实模式并同步最新档口页面`（本地同内容提交 `81113c3`，提交树哈希一致）；随后文档提交远端 `bc114d6`（本地同内容 `44e8653`）。同时把 19:10 基线之后并行完成的菜品自定义、品牌图片与档口视觉样式纳入远端。
- 2026-11-17 底部导航提交：`3e1710d feat(mobile): 档口端增加底部导航与我的页面`；菜单、订单、我的三个底部入口上线，「我的」页显示档口账号并提供开店、退出登录与返回角色入口。
- 2026-11-17 入驻状态提交：远端 `ef68433 feat(mobile): 档口端注册完成后不再重复注册`（本地同内容提交 `9e59744`，文档提交 `12da07a`）；档口登录后读取 `GET /merchant/profile`，已开店账号不再显示“商家注册 / 开店”入口，进入入驻页显示只读资料；已有商家但未开店时跳过注册第 1 步。
- 本次推送因 `github.com:443` 直连被阻断，改用 GitHub API 创建同内容提交并更新分支引用（功能提交 `ef68433`，其后接文档提交）；远端分支头提交树与本地同内容提交一致。
- GitHub HTTPS 连接在当前网络下间歇性 `Connection was reset`；重试可成功，不要据此判定仓库不可达。
- 2026-11-17 22:50 最新基线：分支 `frontend/handoff-2026-11-17` 已推送，远端分支头 `ba4bdc3 feat(mobile): 学生端订单与菜单页拆分组件并同步最新样式`；本次提交链 `82044d9 fix(mobile): 恢复管理端横幅与导航并统一学生端金色配色` → `19902d0 feat(mobile): 档口端增加数据模式选择、钱包页与注册页账号名回填` → `ba4bdc3`。
- 本次基线内容：档口端新增数据模式选择页（`#/merchant/source`）、钱包页与「我的」页；注册第 1 步删除「商家名称」输入，服务端仍要求 `merchantName`，页面自动取当前档口账号名（`session.user.displayName`，截断 20 字符，兜底「档口商家」）；学生端订单/菜单页拆分为 `BookingTicket`、`OrderDishCard`、`OrderListIcons`、`OrderMenuIcons`、`OrderTicketCard` 组件；管理端恢复非订单详情页的横幅与导航。
- 本次验证：`tsc --noEmit` 0 错误、`vite build` 成功；无头浏览器 390px 确认注册页无商家名称输入、表单仅「店铺负责人」「联系电话」两项、空表单 2 项校验、填写后可进入第 2 步。本次未重打 APK、未做真机验收。
- 本地 `frontend/src` 与 `.git-sync/apps/mobile/src` 已逐文件一致；`README.md`、`package.json`、`capacitor.config.ts`、`android/` 仍以远端为准，不用本地临时副本覆盖。
- 2026-11-18 基线：新分支 `frontend/handoff-2026-11-18` 已推送，远端分支头 `a6cd08f docs(mobile): 记录 2026-11-18 基线、退出重登与注册名称验收`，其父为档口首页改版提交（本地等价提交 `9ab78df`，树 `4ba593a`），再往前是 2026-11-17 未推送的先登录后入驻改动（本地 `a0dc038`）；远端树与本地 `e5c9d24` 的树 `6916d6a` 完全一致，哈希差异来自 API 推送。本轮内容：档口端首页工作台、注册页商家名称可改、退出后再进入必须重新登录；远端 2026-11-17 分支头为 `1cc7f47`（用 GitHub API 核对）。
- 本轮同时纳入并行会话已完成的改动：档口首页工作台 `pages/HomePage.tsx` 与 `#/merchant` 首页 tab、`merchant.css`/`login.css` 视觉改版与 7 张品牌/菜品图片、管理端 `admin-theme.css`、学生端订单页与 `shared/styles.css` 若干调整；这些改动在本地 `tsc` 与 `vite build` 下均通过。
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
- 边界：样例模式不轮询、不显示刷新按钮；真实模式未登录时进入档口登录页，登录前不发起订单请求。

### 2.5 档口端登录页与真实模式登录门（2026-11-17 本次新增）

- 问题：真实模式此前只能依赖开发环境注入的演示密码一键登录；没有登录页面，未登录时页面只显示一条错误提示。
- 新增档口登录页 `src/modules/merchant/pages/MerchantLoginPage.tsx` 与独立样式 `login.css`：
  - 真实模式且未登录时直接渲染全屏登录页，不再展示订单与菜单区域；
  - 提交后调用公共 `demoLogin`，并校验返回角色必须为 `MERCHANT`；学生/管理员账号会提示角色不匹配并清除会话；
  - 错误提示区分账号密码错误、服务地址未配置、网络/服务不可用；
  - 页面提供服务地址展示、「先看样例数据」「服务与登录自检」「返回角色入口」入口。
- `MerchantHome.tsx` 调整：
  - 登录成功自动跳转 `#/merchant/orders` 并加载真实菜单与订单；
  - 真实横幅显示当前档口账号，新增「退出登录 / 切换档口账号」，调用公共 `logout` 并清除本地会话；
  - 移除开发环境自动登录，登录页保留「使用本地演示凭据一键登录（开发环境）」（仅 `VITE_DEMO_MERCHANT_PASSWORD` 存在时显示）。
- 边界：样例模式仍免登录；未登录不发起任何订单/菜单请求；接口失败不回退样例。

### 2.6 注册完成后不再重复注册（2026-11-17 本次新增）

- 问题：档口注册并开店后退出登录，再次登录进入“店铺信息与入驻”仍看到空白注册表单，容易被误认为需要重新注册。
- 修复：
  - `MerchantHome.tsx` 在真实模式登录后与订单/菜单/时段一起读取 `source.getProfile()`，把入驻状态保存到 `profile`。
  - `OrderListPage.tsx` 在 `profile.onboardingStep === 'SHOP_CREATED'` 时隐藏“商家注册 / 开店”入口；“我的”入口文案改为“店铺信息”。
  - `OnboardingPage.tsx` 读取 profile 期间显示“正在读取当前档口账号的入驻状态…”，避免先闪出注册表单。
  - 已开店（`SHOP_CREATED`）：展示只读的商家名称、店铺负责人、联系电话、店铺名称、档口位置与简介，不再提交注册或开店请求。
  - 已有商家但未开店（`REGISTERED`）：第 1 步只读展示服务端商家资料，直接进入第 2 步创建店铺，不要求重新填写负责人与手机号。
  - 未注册（`NONE`）：保留原两步流程。
- 涉及文件：`src/modules/merchant/MerchantHome.tsx`、`pages/OnboardingPage.tsx`、`pages/OrderListPage.tsx`、`merchant.css`。
- 边界：店铺资料修改服务端暂未提供接口，已完成页面只读展示；退出登录只清除本地会话，不清除服务端商家与店铺数据。

### 2.7 「我的信息」与注册资料同步（2026-11-17 本次新增）

- 需求：档口端登录并注册商家后，「我的」页展示的个人信息要与注册时填写的内容一致，并可在「我的信息」页修改。
- 实现：
  - 新增 `pages/MerchantMyInfoPage.tsx` 与路由 `#/merchant/my/info`，与“已完成商家注册与开店”的 6 项资料对齐：商家名称只读（跟随档口账号），店铺负责人、联系电话、店铺名称、档口位置、店铺简介可编辑；
  - 「我的」页新增资料组：我的信息入口、店铺负责人、联系电话（数据取 `GET /merchant/profile` 或样例档案）；
  - `MerchantSource` 新增 `updateProfile`：样例模式写本机样例档案；真实模式调用 `PATCH /merchant/profile`（含店铺字段），服务端未提供时显示失败，不显示成功；
  - 保存成功后同时更新页面 `profile` 状态，入驻完成页、注册摘要与「我的」页立即同步；
  - 样例模式商家档案写入 `localStorage`（键 `merchant-sample-profile-v1`），刷新或重新进入样例模式不再要求重复注册。
- 涉及文件：`data/types.ts`、`data/source.ts`、`state/onboarding.ts`、`pages/MerchantMyInfoPage.tsx`、`MerchantHome.tsx`、`merchant.css`、`pages/SourceSelectPage.tsx`。
- 验证：样例模式下注册 → 开店 → 我的信息回填 6 项 → 修改全部字段 → 入驻完成页与「我的」页同步、刷新保持，全部通过；真实模式用本地模拟服务验证保存成功与保存失败两条路径，入驻完成页同步新店铺名称/位置/简介，全部通过。
- 真实验证边界：真实服务当前只有 `GET /merchant/profile`，`PATCH /merchant/profile` 返回 404，店铺资料也没有单独的更新接口；需公共服务补接口后才能真实保存，页面会明确提示失败而不是假成功。

### 2.8 进入档口端先显示登录页（2026-11-17 本次修复）

- 问题：进入档口端后直接显示“已完成商家注册与开店”或上次登录后的工作台，跳过登录账号页；用户要求每次进入先看到登录页，再登录、注册/入驻。
- 修复：
  - 档口端默认进入真实模式登录页（开发环境需要样例时用 `?mode=sample`）；
  - `MerchantHome.tsx` 新增入口门 `entryGate`：每次挂载档口模块都先显示登录页，即使浏览器仍保留上次档口会话；登录成功后本次会话内不再重复拦截，刷新或重新进入会再次要求登录；
  - 登录页「先看样例数据」改为 `enterSampleMode`：标记样例入口后进入订单列表，不再落到入驻完成页；
  - 登录页顶部标注改为“档口端 · 先登录再入驻”；
  - 未登录且切到真实模式时仍回登录页，避免空身份发起请求。
- 并行冲突处理：本次合并了另一会话在 `MerchantHome.tsx` 的底部「首页」tab、`setup.from` 来源区分改动；同时给 `state/actionMatrix.ts` 的 `ActionInput` 补回 `diningMode` 字段，恢复类型检查通过。
- 验证：390px 视口下，入口显示登录页、登录页不出现“已完成商家注册与开店”；点「先看样例数据」进入订单列表；已登录后刷新仍回到登录页；真实登录 → 入驻页 → 我的信息保存 → 刷新回登录页，全部通过。

### 2.6 2026-11-18 注册商家名称与退出后重新登录

- 商家名称重新可填写：注册第 1 步恢复「商家名称」输入框（2—20 字），默认值只在首次进入且为空时预填一次当前档口账号名，之后不再覆盖商家手工填写或清空的内容；注册提交与第 2 步商家摘要都使用表单值，不再用账号名强制替换。服务端 `POST /merchant/registration` 仍要求 `merchantName`。
- 退出登录统一清会话：此前只在真实模式调用 `logout()`，真实登录后切到样例再点退出会留下登录态。现在样例模式下点「退出登录」同样调用 `clearSession()` 并回角色入口。
- 记住数据模式：档口端把样例/真实模式写入 `localStorage`（`merchant-data-mode-v1`），从角色入口（URL 不带 `?mode=`）再次进入时沿用上次模式；真实模式直接落到登录页，不再默认回样例而免登录。
- 已注册账号重复进入：登录后读取 `GET /merchant/profile`，已开店账号只显示只读摘要/完成页，不出现注册表单。
- 同轮纳入的并行改动见第 1 节最后一条；本轮未改学生端业务逻辑。

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
| 档口登录（真实模式未登录） | `#/merchant/orders?mode=real`（入口带 `?mode=real`） | 全屏登录页；登录成功才加载真实数据 |
| 订单列表（档口默认入口） | `#/merchant`、`#/merchant/orders` | 登录后默认进入；已开店不显示注册入口 |
| 商家注册开店 | `#/merchant/setup` | 已开店显示只读资料；已有商家直接创建店铺 |
| 订单列表 | `#/merchant/orders` | 独立列表地址 |
| 订单详情－待接单 | `#/merchant/orders/demo-order-001` | 可直达、刷新保持 |
| 订单详情－可取餐 | `#/merchant/orders/demo-order-003` | 可直达、刷新保持 |
| 菜单与库存 | `#/merchant/menu` | 保留既有页面 |

- 开店流程只有两步：商家注册（商家名称、店铺负责人、联系电话）→ 创建店铺（店铺名称、档口位置、店铺简介可选）；服务端已有商家资料时第 1 步只读，已有店铺时整页只读，不重复注册。
- 2026-11-18 起「商家名称」输入框已恢复且可自由修改（默认预填账号名，仅首次一次）；此前的“已删除商家名称字段”约定作废。
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

- 档口登录页提交 `81113c3`：`tsc --noEmit` 0 错误；Headless Edge + 本地模拟服务 11 项全部通过——真实模式未登录直接进入登录页、显示服务地址与样例/自检入口、不展示订单；登录成功进入真实订单列表并读到订单、横幅显示账号与退出入口；退出回登录页；样例模式免登录；样例切回真实重新要求登录。
- 刷新修复提交 `98ff18d`：`tsc --noEmit` 0 错误；`vite build` 成功。
- Headless Edge + 本地模拟服务（真实模式）自动验证 13 项全部通过：刷新按钮可点击、15 秒自动刷新、最近更新时间更新、新单自动进入「待接单」并提示、详情页刷新按钮与刷新完成、停留在详情页发现新单、无运行时异常或 `console.error`。
- 合并基线 `ddd9785`：使用基线版注册页执行 `vite build` 成功；合并无冲突。
- 详情页停留检测提交 `ca24fed`：Headless Edge 3 项通过——停留在详情页能在 15 秒内发现新单、当前订单仍正常显示、无运行时异常或 `console.error`；补齐后 `vite build` 成功。
- 上一轮：4173 本机与局域网 HTTP 200；`gradlew.bat assembleDebug` `BUILD SUCCESSFUL`。
- 五个档口端设计页面、两步开店流程、订单详情直达与 390px 布局：上一轮已在 Headless Edge 中验证通过并记录。
- 入驻状态提交：`tsc --noEmit` 0 错误；`vite build` 成功；Headless Edge + 本地模拟服务 8/8 通过——已开店账号登录后不显示“商家注册 / 开店”入口、「我的」显示“店铺信息”、入驻页只读展示且不出现注册表单；已有商家资料时直接进入创建店铺；无运行时异常与 `console.error`。
- 2026-11-18 本轮：`tsc --noEmit` 0 错误；`vite build` 成功（`dist/` 被同步工具占用时改用 `--outDir .runtime/dist-check` 验证，仅 chunk 体积与动态导入提示）。Headless Edge 390px 三组场景全部通过：注册页存在商家名称输入框、默认预填、可手工修改、第 2 步摘要与完成页使用手填名称（5/5）；真实登录 → 退出清会话 → 回角色入口 → 从角色入口再进要求重新输入账号密码 → 重新登录不显示注册表单（7/7）；真实登录后切样例再退出同样清除会话（5/5）。

已知问题（不属于本次档口改动）：

- 合并基线后 `tsc --noEmit` 剩 1 个学生端既有类型错误：`src/modules/student/utils/orderCancelView.ts` 引用 `CancelRequest.decisionReason`，但 `student/types.ts` 的 `CancelRequest` 未声明该字段。需学生端负责人补类型；在修复前请用 `vite build` 出包，不要用会先跑 tsc 的 `npm run build`。
- 当前工作副本执行 `tsc --noEmit` 已通过；若检出远端旧提交仍出现上述学生端类型错误，以实际代码为准。
- 本地 `frontend` 工作副本与远端档口模块已同步到 `81113c3`；此前并行完成的注册页照片墙、菜品自定义与品牌图片改动均已纳入该提交，不再存在“只在本机未提交”的注册页版本。

尚未验证：

- **本次刷新修复未重打 APK**：现有 `app-debug.apk` 仍是上一轮构建，手机安装后不会包含本轮代码。
- 公网真实后端的新单轮询联调；本轮使用本地模拟服务验证前端行为，不能当作真实接口联调证据。
- APK 真机安装、首次启动、WebView 内页面渲染。
- 原生 App 内的真实定位授权与后端联调。

## 7 新对话应优先做的事

1. **先重打 APK**（档口首页工作台、商家名称可改、退出后重登、登录页与刷新修复都只在源码，旧包不含）：在基线目录（`E:\project\workspace\.git-sync\apps\mobile`）或已同步的 `frontend` 执行 `vite build`，再按第 3 节命令执行 `gradlew.bat assembleDebug`；随后安装：

   ```powershell
   & "D:\AndroidSdk\platform-tools\adb.exe" devices
   & "D:\AndroidSdk\platform-tools\adb.exe" install -r "E:\project\workspace\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
   ```

   不能用数据线时，直接把 `app-debug.apk` 复制到手机存储，在文件管理器中点击安装（需允许“安装未知来源应用”）。

   注意：合并基线还有 1 个学生端 tsc 类型错误，出包请直接跑 `vite build`，不要跑含 tsc 的 `npm run build`。

2. 打开 App 验证：角色入口、档口端登录页、地图定位授权弹窗、页面无白屏；带 `?mode=real` 进入真实模式时先出现档口登录页，登录成功后才读取真实菜单与订单；在订单列表确认「刷新列表」、15 秒自动刷新与新单提示；进入详情确认「刷新订单」；横幅「退出登录 / 切换档口账号」可回到登录页。
2.1 本轮重点验收链路：登录 → 「我的」 → 「退出登录」 → 从角色入口再次点击档口端 → 必须重新输入账号密码；重新登录后进入入驻页应显示已完成/无需再次注册。另在样例模式点「退出登录」后切回真实模式，也必须重新登录。
3. 验证注册状态持久化：用已完成开店的档口账号登录后，订单列表不显示“商家注册 / 开店”，从「我的 → 店铺信息」进入应看到只读商家与店铺资料；退出登录再登录仍保持该行为。已有商家未开店的账号应直接进入创建店铺步骤。
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
- 当前分支：`frontend/handoff-2026-11-18`（从 `1cc7f47` 之后继续，包含 `a0dc038 feat(mobile): 档口端先登录后入驻并支持我的信息修改` 与本轮提交）；上一轮分支 `frontend/handoff-2026-11-17` 远端头为 `1cc7f47`，勿强推覆盖。
- 远端基线分支 `frontend/baseline-2026-11-17` 已快进到同一提交；只推专用分支，不推 `main`，不强推。注意远端哈希与本地哈希不同但树一致，下一次操作前先 `git fetch` 核对，不要用本地提交直接强推。
- 提交信息：`fix(mobile): 档口订单列表与详情支持刷新并自动发现新单`、`merge: 合并当前前端基线与档口订单刷新修复`、`docs(mobile): 更新当前基线、刷新验收与交接说明`、`fix(mobile): 订单详情页定时检测新订单并保留当前订单`、`feat(mobile): 档口端登录页接通真实模式并同步最新档口页面`、`feat(mobile): 档口首页工作台与注册名称可改并修复退出重登`。
- GitHub 主站连接可能超时或 `Connection was reset`；重试或用 `-c http.version=HTTP/1.1`。本次 `github.com:443` 连续失败而 `api.github.com` 可达，因此通过 GitHub REST API 上传变更树、创建提交并新建分支引用；远端哈希与本地不同但树一致，核验要用 API 查询分支头后比对 tree。
- 推送后用 `git log -1 --oneline`、`git status`、`git ls-remote` 核对。