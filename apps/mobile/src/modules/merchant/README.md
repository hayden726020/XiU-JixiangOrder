# 漪x3负责的merchant模块

这是唯一安卓应用内的模块，不能单独初始化或打包另一个应用。先读本目录 AGENTS.md、移动项目与仓库根规则。

当前已具备：样例订单与菜单、真实演示服务读取（`GET /menu`、`GET /merchant/orders`）、订单分页（`page/pageSize/total`）、只读菜单页，以及真实写操作 `POST /merchant/orders/{id}/advance`（接单 / 开始制作 / 标记可取）与 `POST /merchant/orders/{id}/verify`（核销），请求带 `requestId` 与 `expectedVersion`。取消申请、缺货取消、延迟与用餐方式变更仍为占位提示，尚未接入真实服务。