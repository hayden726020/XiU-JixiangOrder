# 漪x3负责的merchant模块

这是唯一安卓应用内的模块，不能单独初始化或打包另一个应用。先读本目录 AGENTS.md、移动项目与仓库根规则。

当前已具备：样例订单与菜单、真实演示服务读取（`GET /menu`、`GET /merchant/orders`）、订单分页（`page/pageSize/total`）、订单全部写操作（advance / verify / cancel-decision / cancel / delay / dining-mode，均带 `requestId` 与 `expectedVersion`），以及菜单与时段编辑（`PUT /merchant/menu/{dishId}`、`PUT /merchant/slots/{slotId}`）。样例模式编辑写入本地样例内存；真实模式依赖 `GET /menu` 返回 dish/slot `version`，当前演示服务已返回该字段。

新增“商家注册与开店”页（`pages/OnboardingPage.tsx`）：按“商家注册 → 创建店铺 → 新增菜品”填写商家名称、店铺负责人、手机号、店铺名称、档口位置、店铺简介，以及菜品类型、名称、价格、可售数量。样例模式会把注册、店铺和新菜品写入本机样例内存（新菜品可在档口菜单看到）；真实模式按约定路径调用 `POST /merchant/registration`、`POST /merchant/shops`、`POST /merchant/menu` 和 `GET /merchant/profile`，服务端未提供时显示失败，不显示成功。真实模式要求带 `merchantId` 的档口会话，页面不接收 `merchantId` 参数，归属校验由共同服务按会话身份完成。已有接单、开始制作、标记可取与核销操作不变。
## 菜品图片与自选配置（2026-11-17 新增）

菜单页的“新增菜品”和“编辑菜品”都带同一套商家配置（`components/DishCustomizeEditor.tsx`），并在右侧/下方给出学生端按钮预览（`components/DishCustomizePreview.tsx`）：

- **菜品图片**：商家自己从本机选 JPG/PNG/WebP，前端压缩到最长边 640px、JPEG 0.72 后再保存；编辑中可更换或移除。
- **口味特征**：商家自定义特征组（如“辣度”）和组内选项（如“不辣/微辣/中辣/特辣”），可勾选“学生必须选”；学生端为单选按钮。
- **固定配菜**：商家自定义配菜名称（如“土豆丝”），**不加价**，单独一栏；学生端每个配菜显示“加 / 不加”按钮。
- **加购项**：商家自定义名称与加价（0—100 元），学生端可多选，选中后计入合计。
- 商家可随时增删组、选项、配菜和加购项；保存菜品时一并校验名称长度、重复项和价格格式。

**当前保存范围（必须如实区分）**：样例模式写入本机样例内存；真实模式先写入浏览器 `localStorage`（键 `merchant.dish-customization.v1:real`，样例模式对应 `:sample`），**尚未提交给服务端**。真实模式页面会显示“当前图片先保存在本机”的提示。刷新页面后本机配置仍在；换设备、换浏览器或清缓存会丢失。删除菜品时会一起删除该菜品的图片与选项配置。

**待共同服务补齐的字段（交给后端）**：`imageUrl`（字符串，可为 data URL 或对象存储 URL）、`flavorGroups`（`[{ id, name, required, options: [{ id, name }] }]`）、`sides`（`[{ id, name }]`）、`addOns`（`[{ id, name, priceFen }]`）。`GET /menu` 返回 `imageUrl` 时前端已能读取并在列表显示；其余三个字段需要后端落库并在学生端 `/menu` 回传后，学生端选择按钮才能真正下单。在这些字段落地前，不要把这部分写成“已同步服务端”。
## 制作今日菜单（2026-11-17 新增）

菜单页的“菜品（N）”标题旁新增「制作今日菜单」，用于从菜品库勾选当天要卖的菜（`pages/MenuPage.tsx` 的 `daily-menu` 面板；样例数据源在 `data/source.ts` 的 `dailyMenus` / `libraryDishes`）：

- **菜品库**：跨日期的菜品集合，包含样例日期已有菜品和之后新增的菜品；新增菜品仍直接进入当天菜单，不需要在新增时填日期。
- **今日上架**：勾选即进当天菜单，取消勾选即当天不卖；菜品库本身不删，之后可以再勾回来。
- **今日库存**：每道菜在制作菜单里可单独填当天库存（0—10000 整数），保存后写回当天菜品。
- **删除语义**：菜单列表里的“删除”是从**菜品库彻底删除**，会同时从所有日期移除；只是今天不卖请用制作菜单取消勾选。
- 样例模式按日期分别保存当天菜单，切换日期互不影响；同一样例内存生命周期内有效。

**真实模式边界**：`getDishLibrary` / `setDailyMenu` 当前返回 `UNSUPPORTED`，按钮禁用并显示说明，不伪造成功。需要共同服务提供：

1. 菜品库读取：`GET /merchant/dishes`（或 `/merchant/dish-library`），返回当前商家全部菜品，字段与 `Dish` 对齐（`id/name/type/priceFen/availableQuantity/onSale/version/imageUrl/...`），图片与选项字段可用上一节的四个字段。
2. 每日菜单保存：`PUT /merchant/menus/{date}`，body `{ requestId, expectedVersion, dishes: [{ dishId, availableQuantity }] }`；`expectedVersion` 建议按“当天菜单”单独递增，避免两个设备同时改菜单时静默覆盖；返回保存后的当天菜单。
3. 学生端 `GET /menu?date=...` 只返回当天已上架的菜品；未勾选的菜不可见、不可下单。

在这些接口落地前，“制作今日菜单”只作为样例演示与交互口径，不能对外写成已接通真实服务。