# 吉祥点餐单 APK 项目

交付一个安卓安装包，内含学生、档口、管理三个角色。三个角色使用同一订单服务；登录身份决定可进入的功能，不能靠随意选择角色获得管理权限。完整方案见 [.planning/PROJECT.md](.planning/PROJECT.md)。

已决定使用网页技术制作统一界面，通过 Capacitor 打包为安卓应用。统一移动应用位于 `apps/mobile`，技术栈为 React 19.3.1 + Vite 8.3.8 + TypeScript 7.0.2，要求 Node >=22.12.0；Capacitor 8.6.2 与 `@capacitor/geolocation` 8.2.4 已安装。项目包含独立 Node.js API（`services/api`），但尚无长期部署服务。网页供开发检查与备用展示，本轮不另做微信小程序。

## 开发入口

先读 [共同规则](AGENTS.md)、[共同阶段](.planning/ROADMAP.md)、[状态](.planning/STATE.md)，再读 [移动项目规则](apps/mobile/AGENTS.md) 和本人模块规则。共享契约仍为草案，详见 [contracts/README.md](contracts/README.md)；不得把演示数据当作生产服务。

移动应用启动方式见 [apps/mobile/README.md](apps/mobile/README.md)。在 `apps/mobile` 下执行 `npm ci`、`npm run dev`，打开 `http://127.0.0.1:5173/`；学生、档口和管理员入口分别为 `#/student`、`#/merchant`、`#/admin`，公共连接自检入口为 `#/system-check`。API 启动、演示账号及限制见 [services/api/README.md](services/api/README.md)。演示入口不代表生产授权或真实业务数据。

## 目录

- apps/mobile/src/modules/student：魈嘶的学生模块。
- apps/mobile/src/modules/merchant：漪x3的档口模块。
- apps/mobile/src/modules/admin：spcuteag的简单管理模块。
- apps/mobile/src/app：spcuteag维护的登录、角色入口和页面切换。
- apps/mobile/src/shared：spcuteag维护的公共样式、请求、定位等共用方法。
- apps/mobile/android：已由 Capacitor 生成（minSdk 24、compileSdk/targetSdk 36）并纳入 Git；`build/`、`local.properties`、`*.apk` 与 Web 构建资源被忽略。
- services/api：独立公共服务，由 spcuteag 维护。
- contracts：共同接口与示例，由 spcuteag 协调三人确认。

## 当前事实与仓库

截至 2026-11-14，移动端已有学生选店、菜单/订单流程，档口订单处理与商家开店相关页面，以及管理端查询/配置页面；API 已实现登录、订单、菜单、档口、管理、位置与开店相关接口，使用本地 SQLite 演示数据。服务及客户端均面向开发演示，接口契约仍是草案，不代表生产部署或三角色端到端验收。曾有 debug APK 在 A024 真机完成部分页面与定位检查；这不等于当前代码版本全部通过真机验收。各模块及服务的当前细节和已执行检查见对应 README 与 `.planning/STATE.md`。

用户指定仓库：[hayden726020/XiU-JixiangOrder](https://github.com/hayden726020/XiU-JixiangOrder)。克隆及推送地址：https://github.com/hayden726020/XiU-JixiangOrder.git。远端初始为空；2026-11-13 已推送默认分支 main，首个骨架提交为 a4795a2fadc4，写权限经实际推送验证。后续修改仍先检查远端已有分支与内容，保留历史，不覆盖或强推。

## 当前边界

这是开发中的五天 MVP，不是正式上线产品。API README 记录了自动化测试的实际结果；自动化测试、浏览器检查、真机检查和完整现场联调应分别看待。演示付款不发生资金交易，演示账号密码仅在本机运行时生成；签名密钥、密码和真实个人数据不得写入仓库或同步资料。

个人资料分发在仓库旁的 `team-context/backend`，不在本仓库内，克隆后不存在；代码与已确认契约在本仓库维护。两位队友只读 backend 的个人资料，仍在自己的 student/merchant 目录写进度。
