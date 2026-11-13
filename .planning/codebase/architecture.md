# 单 APK 架构与职责地图

方案版本 APK-v1，更新日期 2026-11-13。当前是文档与目录骨架，没有已实现程序或安装包。

一个 apps/mobile 应用，通过公共登录进入 src/modules/student、merchant 或 admin。角色由服务端身份决定，页面入口不授予权限。三个模块共用 src/app 的入口与页面切换、src/shared 的请求和定位方法，由 Capacitor 打包成同一 APK。

魈嘶只负责学生模块，漪x3只负责档口模块；spcuteag负责管理模块、公共层、移动项目配置与将来工具生成的 android/ 工程。services/api 是独立运行的订单服务，负责身份、库存、时段、订单、模拟付款退款和堂食参考。contracts 独立存放三人约定，不嵌套到服务内。

定位授权后在设备内判断食堂范围及误差，不上传精确坐标；未知或拒绝不影响下单。参考人数按用户去重，当前与未来时段分开，不能称为全食堂真实人数。

代码通过唯一仓库 https://github.com/hayden726020/XiU-JixiangOrder.git 协作。backend 中按姓名分发只读资料，student 和 merchant 仍写各自进度。旧 apps/student、merchant、admin 只作迁移指引，不是应用入口。网页只作开发辅助，不作为 APK 验收替代。
