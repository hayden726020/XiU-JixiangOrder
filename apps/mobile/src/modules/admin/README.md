# spcuteag负责的admin模块

这是唯一安卓应用内的模块，不能单独初始化或打包另一个应用。先读本目录 AGENTS.md、移动项目与仓库根规则。

现状（2026-11-13）：S1 骨架、S2 订单筛选/分页/只读详情、S3 配置只读、S4 配置草稿编辑、S5 真实配置保存、S6 错误态与失败恢复已完成。`data/source.ts` 提供 sample/live 双数据源；真实模式读取 `GET /admin/orders`、`GET /orders/{id}` 与 `GET /admin/settings`，失败抛 `ApiError` 且不回退样例。配置页按服务端 `dining/crowd` 结构展示，档口营业时间暂无端点；`components/SettingsEditor.tsx` 提供受控表单、字段校验、requestId/expectedVersion、`PUT /admin/settings` 单 section 保存；成功后重新 GET 确认并更新页面，`SETTING_VERSION_CONFLICT` 保留输入、需手动重新读取。S6 增加样例错误演习（401/403/503）与真实 401/403/503 页面态；错误态不渲染数据、不提供切换管理员按钮；保存失败按同一 requestId 重试，断网时显示“保存结果待确认”。样例模式不发送 PUT。
