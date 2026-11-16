# 管理模块

本模块归 spcuteag。先读仓库根 AGENTS.md、apps/mobile/AGENTS.md，以及 services/api/AGENTS.md；后者是其完整开发说明。

本模块在唯一 APK 内提供档口营业配置、订单与异常查询、食堂范围和提醒条件。使用共同登录与请求方法，不创建独立管理应用或另一套身份系统；服务端必须验证管理权限，不能只依赖前端入口隐藏。
