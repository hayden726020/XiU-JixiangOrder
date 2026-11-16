# 吉祥点餐管理端前端交接（2026-11-16 晚）

## 1 当前代码基线

| 项 | 值 |
| --- | --- |
| 日常源码目录 | `D:\吉祥社代码\workspace\team-context\frontend`（Syncthing 同步目录；旧写法 `D:\jixiang\workspace\frontend` 即此路径） |
| Git 基线目录 | `D:\吉祥社代码\workspace\campus-meal-admin-baseline`（**2026-11-16 晚由 `campus-meal` 仓库 worktree 建立**，共享同一 `.git`；旧克隆已不存在时按此路径重新 `git fetch` + `git worktree add`） |
| 分支 | `frontend/admin-redesign-2026-11-16` |
| 基线父提交 | `integration/student-visual-1.14 @ 320aa0f` |
| 分支前序提交 | `8faaa5d`（概览/订单页）、`bd59ffb`（首版交接）、`ba7c659`（营业与配置页）、`deadc6e`（记录提交号） |
| 本轮提交 | 订单查询空状态按设计稿重做（见 `git log -1 --oneline`） |
| 远端 | `https://github.com/hayden726020/XiU-JixiangOrder.git` |
| 稀疏检出范围 | 仅 `frontend/`；本机 worktree 检出完整仓库树，但只提交 `frontend/` 下本任务文件 |

工作树里的 `frontend/` 与同步目录 `team-context/frontend/` 是两个独立副本：改动先落在同步目录，再由本任务复制到 worktree 提交。**不要直接在 worktree 改代码**（队友看不到），也不要把同步目录整体覆盖到 worktree（会带上他人未完成改动）。

## 2 本轮已完成页面

| 页面/状态 | 路由 | 实现文件 | 状态 |
| --- | --- | --- | --- |
| 管理端概览 | `#/admin` | `pages/OverviewPage.tsx`、`admin-overview.css` | 已按设计稿实现 |
| 订单与异常查询 | `#/admin/orders` | `pages/OrdersPage.tsx`、`admin-orders.css` | 已按设计稿实现 |
| 订单查询空状态 | `#/admin/orders` | `pages/OrdersPage.tsx`、`admin-orders.css` | **本轮按独立设计稿重做**（浅米绿底 `#F4F6F3`、空餐盒线稿图标、胶囊刷新、页码右下） |
| 营业与食堂配置 | `#/admin/settings` | `pages/SettingsPage.tsx`、`admin-settings.css`、`components/SettingsEditor.tsx` | 已按设计稿实现（查看态 + 编辑态展开为过渡实现） |

参考图来源：`frontend/photo/backhand/管理端*.png`（旧记录写作 `设计系列\管理端*.png`）。只实现右侧手机应用界面，不实现左侧设计说明卡、展示稿页眉或画布网格背景。

### 概览页

- 小标题“管理端”，主标题“概览”。
- 三张统计卡：样例订单、待处理取消、已设延迟。
- 两个入口：订单与异常查询、营业与配置。
- 当前会话卡与退出操作。
- 使用精简外壳，不显示联调横幅、错误演习、模式切换和后台导航。

### 订单列表

- 状态筛选、当前页异常筛选和刷新按钮。
- 服务端/样例总数、当前页、异常数量摘要。
- 四行订单信息：单号与状态、档口与时段、用餐方式/份数/金额、创建时间与 version。
- 延迟预计时间和取消申请原因使用红色异常行。
- 保留订单卡进入只读详情。

### 订单查询空状态（本轮）

- 空状态时容器加 `admin-orders--empty`，整页背景改为浅米绿 `#F4F6F3`（非空列表仍为纯白）。
- 筛选区保留，摘要与订单卡隐藏。
- 图标换成极简线稿“带盖空餐盒”（约 70px，深绿 `#2F5E4B`，位于筛选区下方居中偏上）。
- 文案：主标题「当前条件下没有订单」、副文案「可切换状态或刷新重试」；`异常（当前页）` 非全部时副文案显示「可切换状态、调整异常筛选或刷新重试」。
- 刷新按钮：白底、深绿 1px 描边、全圆角胶囊、深绿文字。
- 页码只在右下角显示「第 N 页」，浅灰小字，不显示上一页/下一页。

### 营业与食堂配置

- 精简外壳：`AdminHome` 的 `admin-panel--settings`，隐藏页头、页脚、返回链接、联调横幅与后台导航；背景 `#F4F6F3`。
- 页面结构：小标题「管理端」→ 主标题「营业与食堂配置」→ 副标题「查看食堂范围与提醒阈值，可分别编辑保存」→ 食堂范围（食堂 / 中心点 / 范围半径 / 误差容忍 / 配置版本 / 更新时间，6 行键值右对齐）→ 注释（演示值 + 中心点隐私口径）→ 提醒条件（当前参考阈值 / 预约需求阈值）→ 档口营业时间（样例模式两张并排卡：名称 + 「营业中」浅绿标签 + 时钟线框图标 + 时段换行；真实模式为浅绿缺口提示条）→ 底部通栏主按钮「编辑配置」。
- 配色：主色深绿 `#1F4A33`、背景 `#F4F6F3`、白卡圆角约 14px 浅阴影；正文 `#2A362D`，辅助 `#7B857E`/`#939A94`。
- 交互：点「编辑配置」在页尾展开编辑卡，分「食堂范围」「提醒条件」两组，各自主按钮保存；取消编辑收起。编辑态尚未按 `管理端配置编辑表单.png` 精修。
- 编辑语义保留：`dining`/`crowd` 分别保存、每次一个 section、`requestId` 变更后重发、`expectedVersion`、`SETTING_VERSION_CONFLICT` 保留输入并提示重新读取、保存成功后重读确认版本、401/403/503/超时文案、样例模式拒绝写。
- 数据边界：真实模式读 `GET /admin/settings`；服务端无档口营业时间端点，真实模式不展示样例档口，改用缺口提示，不伪造管理员会话。

## 3 现有数据与权限边界

- `data/source.ts` 保留 sample/live 双数据源。
- 样例统计仍为动态计算，当前样例为订单 4、待处理取消 1、已设延迟 1。
- 真实模式必须使用服务端数据；失败时不回退样例，不显示假总量。
- 管理权限由服务端逐请求校验，禁止在前端伪造 ADMIN 会话绕过权限。
- `demo-admin` 演示密码仅线下交付，不得写入源码、文档、提交、日志或聊天记录。
- 不修改接口契约、服务端、学生或档口模块来迁就页面视觉。

## 4 外壳与后续页面现状

`AdminHome.tsx` 目前对概览、订单列表、营业与配置使用精简外壳。以下仍沿用旧外壳和旧视觉：

- 订单详情 `#/admin/orders/{id}`
- 非管理员身份提示（`管理端需管理员身份.png` 设计稿未实现）

新对话不要把“概览/订单/配置已完成”误认为整个管理端都已完成。修改共享外壳时必须回归概览、订单、详情、配置和非管理员入口。

### 并行会话未提交改动（2026-11-16 20:22 记录，未纳入远端基线）

同步目录 `team-context/frontend` 里另有管理端改动，**未提交、未推送**（按“不代提交他人工作”处理）：

- `pages/OrdersPage.tsx`：错误态改为 `admin-orders__error-state` + `codeLabel`（401/403/503/NETWORK/ERROR）徽标 + 精简文案 + 重试/去登录按钮，对应 `管理端订单错误三态.png`。
- `admin-orders.css`：新增错误态样式（约 331—403 行）；本轮的 `admin-orders--empty` 空状态样式仍保留（8 处）。
- `pages/OverviewPage.tsx`：新增 `navigateTo()`（`history.pushState` + 手动派发 `hashchange`），两个入口链接拦截默认跳转。

只读核对：`npx tsc --noEmit` 中 `modules/admin` 错误数 0，结构完整（`codeLabel` 已渲染），但**未做错误路径 CDP 视觉核对**、未写接入记录。新对话开工先 `git status` 与 `git log` 判断是否已由该会话提交；若仍未提交，不覆盖、也不替其宣称“错误三态已完成”。

## 5 剩余管理端设计稿

建议按订单主链路优先：

1. `管理端订单详情只读.png`
2. `管理端订单详情已取消.png`
3. `管理端详情兜底两态.png`
4. `管理端订单错误三态.png`
5. ~~`管理端营业与配置.png`~~（已完成）
6. ~~`管理端订单空状态.png`~~（本轮完成）
7. `管理端配置编辑表单.png`（**下一张**；当前编辑态为过渡实现，未按图精修）
8. `管理端配置保存反馈三态.png`
9. `管理端需管理员身份.png`

每张图可能包含多个状态，需分别实现并保留真实错误、权限和版本冲突语义。

## 6 运行与验证

Bash（本机实测）：

```bash
cd D:\吉祥社代码\workspace\team-context\frontend
npm run dev -- --port 5173 --strictPort
```

PowerShell（旧记录写法）：

```powershell
$env:Path = "D:\Node;$env:Path"
cd D:\吉祥社代码\workspace\team-context\frontend
& "D:\Node\npm.cmd" run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

连接线上演示 API：`VITE_API_BASE_URL=https://39.96.195.158/api/v1`。

管理端页面需要管理员会话，本机核对链路：

1. 后台启动 `campus-meal/services/api`（8787，首次生成 `.runtime/demo-accounts.json`，密码不打印、不入文档）。
2. 浏览器默认 API 为相对 `/api/v1`，需在 localStorage 写 `xiu.mobile.apiBaseUrl.v1 = http://127.0.0.1:8787/api/v1`。
3. 用 `demo-admin` 调 `/auth/demo-login` 取会话，写入 `sessionStorage['xiu.mobile.session.v1']` 后**整页刷新**（会话是模块级变量）。
4. 打开目标路由，如 `http://127.0.0.1:5173/#/admin/orders`（空库时即为空状态）。

CDP 截图脚本（headless Edge，390×844）：

- `frontend/.runtime/admin-settings-shot.mjs`：营业与配置页查看态、编辑态、档口两卡样式。
- `frontend/.runtime/admin-orders-empty-shot.mjs`：订单空状态（自动等待空状态；非空时把状态筛选置为 CANCELLED）。
- 输出在 `frontend/.runtime/`。核对完只停本次启动的 8787，5173 dev server 保留。

本轮结果：

- `npx tsc --noEmit` 中 `modules/admin` 错误数 **0**。
- `npx vite build` 通过（约 200 ms）。
- 全量 `npm run build` 可能被并行会话未完成的 `src/modules/merchant/pages/OnboardingPage.tsx`（`DISH_TYPE_OPTIONS` 未定义）阻塞，属队友改动，不要代改或回退。
- 订单空状态截图核对：容器背景 `rgb(244,246,243)`、图标 70.39px、筛选保留、页码右下；未做逐像素比对、真机安装或 APK 包内复验。

## 7 Git 推送环境

- Git 安装在 `D:\dev\Git`；`git` 可直接调用。
- 2026-11-16 20:00 曾出现 `github.com:443` 全断（直连与代理均超时）；20:10 起直连恢复，但 **pack 传输仍可能中断**（`fetch-pack: unexpected disconnect`），此时改用命令级代理：

```bash
HTTPS_PROXY=http://127.0.0.1:7892 HTTP_PROXY=http://127.0.0.1:7892 git fetch origin <branch>
```

- 只推专用分支，不推 `main`、不强推；推送后用 `git ls-remote` 复查 refs。
- `frontend/.gitignore` 已排除 `node_modules`、`dist`、临时运行目录、Syncthing 元数据、Edge 浏览器缓存和 `*.sync-conflict-*`。
- 本机提交身份此前为 `CodeArts Agent <codearts-agent@local>`（用 `-c user.name/-c user.email` 临时指定，不改全局配置）。

## 8 新对话开场

将 `frontend/NEXT-CONVERSATION-PROMPT.md` 全文提交给新对话，并附上下一张参考图 `frontend/photo/backhand/管理端配置编辑表单.png`（若用户附其他图，以附图为准）。