# 吉祥点餐单 APK 项目

交付一个安卓安装包，内含学生、档口、管理三个角色。三个角色使用同一订单服务；登录身份决定可进入的功能，不能靠随意选择角色获得管理权限。完整方案见 [.planning/PROJECT.md](.planning/PROJECT.md)。

已决定使用网页技术制作统一界面，通过 Capacitor 打包为安卓应用。统一移动应用位于 `apps/mobile`，当前技术栈为 React 19.3.1 + Vite 8.3.8 + TypeScript 7.0.2，要求 Node >=22.12.0；Capacitor 8.6.2 依赖已安装但 `android/` 尚未生成。网页只供开发检查与备用展示，本轮不另做微信小程序。

## 开发入口

先读 [共同规则](AGENTS.md)、[共同阶段](.planning/ROADMAP.md)、[状态](.planning/STATE.md)，再读 [移动项目规则](apps/mobile/AGENTS.md) 和本人模块规则。接口仍为 [DRAFT v0.1](contracts/README.md)，不得把示例当作真实服务。

移动应用启动方式见 [apps/mobile/README.md](apps/mobile/README.md)。在 `apps/mobile` 下执行 `npm ci`、`npm run dev`，打开 `http://127.0.0.1:5173/`；学生模块入口为 `#/student`。入口选择在 S0 仅用于预览，不代表角色授权。

## 目录

- apps/mobile/src/modules/student：魈嘶的学生模块。
- apps/mobile/src/modules/merchant：漪x3的档口模块。
- apps/mobile/src/modules/admin：spcuteag的简单管理模块。
- apps/mobile/src/app：spcuteag维护的登录、角色入口和页面切换。
- apps/mobile/src/shared：spcuteag维护的公共样式、请求、定位等共用方法。
- apps/mobile/android：将由 Capacitor 工具初始化生成；当前未创建。
- services/api：独立公共服务，由 spcuteag 维护。
- contracts：共同接口与示例，由 spcuteag 协调三人确认。

## 当前事实与仓库

`apps/mobile` 已有 S0 最小可运行骨架：一个公共入口、模块契约、学生模块占位入口，以及已安装的依赖锁文件。类型检查、生产构建和浏览器渲染检查已通过；独立只读复核已完成，指出的公共层问题已修复。没有业务代码、后端、数据库、APK 或通过的业务测试，也没有安卓安装或真机验收结果。

用户指定仓库：[hayden726020/XiU-JixiangOrder](https://github.com/hayden726020/XiU-JixiangOrder)。克隆及推送地址：https://github.com/hayden726020/XiU-JixiangOrder.git。远端在 2026-11-13 检查时为空仓库；只读连接成功不等于拥有写权限。后续连接本地仓库前先检查远端已有分支与内容，保留历史，不覆盖或强推。

## 第一阶段需要补齐

spcuteag提供实际安装、启动、测试与 APK 构建命令，统一手机可访问的服务地址和账号取得方式。首日完成最小 APK 的安装、测试服务连接及定位授权/拒绝检查。签名密钥、密码和真实数据不写入仓库或同步资料。

个人资料分发在仓库旁的 `team-context/backend`，不在本仓库内，克隆后不存在；代码与已确认契约在本仓库维护。两位队友只读 backend 的个人资料，仍在自己的 student/merchant 目录写进度。