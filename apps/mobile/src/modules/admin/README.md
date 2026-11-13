# spcuteag负责的admin模块

这是唯一安卓应用内的模块，不能单独初始化或打包另一个应用。先读本目录 AGENTS.md、移动项目与仓库根规则。

现状（2026-11-13）：S1 骨架、S2 订单筛选/分页/只读详情、S3 配置只读已完成。`data/source.ts` 提供 sample/live 双数据源；真实模式读取 `GET /admin/orders`、`GET /orders/{id}` 与 `GET /admin/settings`，失败抛 `ApiError` 且不回退样例。配置页按服务端 `dining/Crowd` 结构展示，档口营业时间暂无端点；保存、`expectedVersion` 与 `SETTING_VERSION_CONFLICT` 在 S5 接入。
