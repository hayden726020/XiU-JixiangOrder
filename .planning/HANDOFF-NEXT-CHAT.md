# 新对话交接：食麦呼当前基线

更新时间：2026-11-16（Asia/Shanghai）

## 当前基线

- 仓库：`D:\Jixiang\workspace\campus-meal`
- 分支：`docs/readme-status`
- 应用代码基线：`b3fb5c16e5f1d97098c14f673d36effdc7a77a45`（`feat: build order page hero from UI elements`）；当前分支与 `origin/docs/readme-status` 同步。此 handoff 文件随后单独提交。
- 不要重置、强推或覆盖现有历史。
- APK：`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`，Gradle 配置 `versionName 1.16` / `versionCode 17`，包名 `com.xiujixiang.order`。最近构建已安装到 A024（Android 16）。
- 正式产品显示名为“食麦呼”，学生、档口、管理端共享同一个 APK 和应用壳。历史包名 `com.xiujixiang.order` 不变。

## 已完成

- 学生登录状态持久化一段时间，支持后续自动恢复登录。
- 未发布阶段学生点餐前后端均允许任意时段提交；既有库存、档口启停、时段名额等规则仍有效。
- 修复学生端跨页底部导航不统一，以及“我的→订单→点餐”错误跳首页；首页推荐非售卖时段仍可进入点餐。
- 修复演示鸡肉饭菜单滑动问题。根因为 `.student-page` 后加载的通用 CSS 把菜单底部留白覆盖到 8px；现在提高选择器优先级并使用自然页面滚动。A024 上实测上滑将 `scrollY` 从 0 移至 98，汇总栏可完整滚到固定导航上方。
- 学生首页品牌标题加大并与推荐提示卡分行；A024 截图确认不再被提示卡遮挡。
- 软件品牌统一为“食麦呼”：应用页标题、登录/个人页、学生选店页标识、Android 桌面名、HTML 标题、API 启动日志和相关 README 均已更新。真实食堂/店铺业务文案保留“食堂”。
- “我的订单”页原来只显示一张包含全部图文的横幅。现改为独立的标题、校园照片卡、取餐文字、黄色取餐贴纸及枝叶装饰；枝叶在安全区内。未登录分支的重复标题也已移除。
- 订单页改版在 A024 上查看通过；点餐滚动及首页标题修复也均有真机检查。没有创建真实订单。

## 最近提交

- `5db6f6d` 修复学生流程、导航与菜单滚动相关问题。
- `f442c4e` 初次统一品牌为“时麦呼”。
- `2652c5c` 按用户最终确认改为“食麦呼”，覆盖学生选店页品牌标识。
- `fb05d30` 修复学生首页主标题遮挡。
- `b3fb5c1` 将订单页合成横幅拆分为独立 UI 元素。

以上均已推送到 `origin/docs/readme-status`。当前没有未提交改动。

## 最近验证证据

- `apps/mobile` 的 `npm run build` 通过，Android `npx cap sync android` 与 `gradlew assembleDebug` 通过，更新包已用 ADB 安装到 A024。
- 订单页 A024 实机画面确认标题、校园图、便签/提醒和订单卡片均正常显示，枝叶不盖住状态栏；共享底部导航保留。
- UI reviewer 复核订单页自然滚动、状态栏安全区和固定底栏留白，无阻塞问题。
- Vite 仍提示主 JS chunk 大于 500 kB，以及 `shared/location.ts` 动态导入与静态导入并存；这些不是本轮构建失败。
- API 测试在较早的后端改动阶段为 84/84；最近品牌/样式提交没有重跑 API 测试。不要把早先测试结果说成最近一次运行。

## 下一个对话建议

1. 从此提交开始。先读根 `AGENTS.md`、`apps/mobile/AGENTS.md`、`apps/mobile/src/modules/student/AGENTS.md`，再看本文件与实际 Git 状态。
2. 用户要做人工验收。优先让用户检查 A024 上的登录保留、未发布时段下单、菜单上下滚动、四个底部入口路由及“我的订单”视觉；只记录实际观察，不把构建通过当完整验收。
3. 如果用户报告订单页设计细节，基于 [OrderListPage.tsx](../apps/mobile/src/modules/student/pages/OrderListPage.tsx) 和 [order-list.css](../apps/mobile/src/modules/student/order-list.css) 调整；菜单滚动/底栏在 [menu-page.css](../apps/mobile/src/modules/student/menu-page.css) 与 `student.css` 之间存在 CSS 特异性关系，修改前检查最终生效值。
4. 界面品牌固定写“食麦呼”；不要把“食堂”业务实体、真实场所名或样例档口名机械替换成品牌。
5. 真实账号登录、定位现场边界、跨角色真实下单/取餐仍需按用户授权和实际设备逐项验收；不访问或输出凭据文件，不创建真实订单，除非用户明确要求。
