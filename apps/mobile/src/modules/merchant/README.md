# 漪x3负责的merchant模块

这是唯一安卓应用内的模块，不能单独初始化或打包另一个应用。先读本目录 AGENTS.md、移动项目与仓库根规则。

当前已具备：样例订单与菜单、真实演示服务读取（`GET /menu`、`GET /merchant/orders`）、订单分页（`page/pageSize/total`）、订单全部写操作（advance / verify / cancel-decision / cancel / delay / dining-mode，均带 `requestId` 与 `expectedVersion`），以及菜单与时段编辑（`PUT /merchant/menu/{dishId}`、`PUT /merchant/slots/{slotId}`）。样例模式编辑写入本地样例内存；真实模式依赖 `GET /menu` 返回 dish/slot `version`，演示服务当前未返回该字段，编辑按钮禁用并提示后端补字段。