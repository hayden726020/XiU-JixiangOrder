# 新对话交接：学生端正式页面收尾

更新时间：2026-11-16（Asia/Shanghai）

## 当前基线

- 仓库：`D:\Jixiang\workspace\campus-meal`
- 分支：`docs/readme-status`
- 最新基线提交：`cd170d813ee1da6e54e562a3ad86a375875cab91`（`feat(student): unify pages and student navigation`）
- 页面基线 `cd170d8` 及 handoff 提交 `0344783`、`1b4cddb` 已推送到 `origin/docs/readme-status`；最后一次 `git push` 返回成功，推送范围为 `0344783..1b4cddb`。推送后 `git status` 显示本地与远端跟踪分支一致。此前 `git ls-remote` 因网络解析错误失败，未能单独读取远端 HEAD。
- APK 版本：`1.16` / versionCode `17`。最新 APK 已安装到 A024（Android 16）；`apps/mobile/android/app/build.gradle` 的版本号改动已包含在基线提交。

## 本轮改动

- 接入学生登录页面和登录视觉资源，错误凭据提示区分账号密码错误、服务地址未配置及网络错误；登录仍调用共享 `demoLogin` 与会话管理。
- 学生点餐菜单页改为校园照片、蓝白手账卡片和黄色强调；保留真实菜单、库存、数量和下单流程，移除样例订单测试按钮和阶段编号。
- 修复学生订单与详情在未选择档口时的不可达问题；未登录订单页保留底部导航。
- 订单、档口、菜单、预约、确认、详情和个人中心隐藏重复的公共调试外壳；正式模式移除“真实接口”等内部说明，样例模式继续显示样例标识。
- 学生页主次按钮和店铺、菜单、订单、个人中心底栏统一视觉与选中状态；去除菜单页重复黄色选中底色。
- 新页面和资源位于 `apps/mobile/src/modules/student/`。未改服务端契约。

## 验证和部署

- `npm run typecheck`：通过。
- `npm run build`：通过；仍提示 JS chunk 大于 500 kB，以及 `shared/location.ts` 动态导入被静态导入覆盖。
- `git diff --check`：通过。
- `npx cap sync android`：通过。
- Android `assembleDebug`：使用 Android Studio 内置 JDK 25 构建成功；系统默认 JDK 17 不支持 Java 21 源码。
- ADB 将 version 1.16 安装到 A024，安装成功。
- 代码复核通过。手机完整页面流程按用户要求转由用户手动检查；真实/错误凭据登录服务连通性尚未完成实机验证，不要标记为通过。
- 未创建真实订单。

## 下一步

1. 当前页面基线与 handoff 已推送到 `origin/docs/readme-status`；后续继续开发前先同步并检查远端分支状态，禁止强推。
2. 用户手动检查 A024 上的登录交互、错误凭据提示、服务连通、点餐/订单/个人中心视觉与导航。如需改动，基于本基线继续。
3. 不使用演示密码尝试登录；不要读取或提交 `services/api/.runtime/demo-accounts.json`。真实订单操作需用户另行授权。
4. 合并前对照最新 `origin/main` 和 `origin/integration/student-visual-1.14`，目前没有合 main、建 PR 或强推。
