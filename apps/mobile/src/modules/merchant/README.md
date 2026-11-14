# 漪x3负责的merchant模块

这是唯一安卓应用内的模块，不能单独初始化或打包另一个应用。先读本目录 AGENTS.md、移动项目与仓库根规则。

当前已具备：样例订单与菜单、真实演示服务读取（`GET /menu`、`GET /merchant/orders`）、订单分页（`page/pageSize/total`）、订单全部写操作（advance / verify / cancel-decision / cancel / delay / dining-mode，均带 `requestId` 与 `expectedVersion`），以及菜单与时段编辑（`PUT /merchant/menu/{dishId}`、`PUT /merchant/slots/{slotId}`）。样例模式编辑写入本地样例内存；真实模式依赖 `GET /menu` 返回 dish/slot `version`，当前演示服务已返回该字段。

新增“商家注册与开店”页（`pages/OnboardingPage.tsx`）：按“商家注册 → 创建店铺 → 新增菜品”填写商家名称、联系人、手机号、店铺名称、档口位置、店铺简介，以及菜品类型、名称、价格、可售数量。样例模式会把注册、店铺和新菜品写入本机样例内存（新菜品可在档口菜单看到）；真实模式按约定路径调用 `POST /merchant/registration`、`POST /merchant/shops`、`POST /merchant/menu` 和 `GET /merchant/profile`，服务端未提供时显示失败，不显示成功。真实模式要求带 `merchantId` 的档口会话，页面不接收 `merchantId` 参数，归属校验由共同服务按会话身份完成。已有接单、开始制作、标记可取与核销操作不变。