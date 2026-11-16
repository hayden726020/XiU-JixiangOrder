# 吉祥点餐管理端前端交接（2026-11-16）

## 1 当前代码基线

| 项 | 值 |
| --- | --- |
| 日常源码目录 | `D:\jixiang\workspace\frontend` |
| Git 基线目录 | `D:\jixiang\workspace\campus-meal-admin-baseline` |
| 分支 | `frontend/admin-redesign-2026-11-16` |
| 基线父提交 | `integration/student-visual-1.14 @ 320aa0f` |
| 本轮代码提交 | `8faaa5d52a4fa35b4c29006b1cdf792933b3da95` |
| 远端 | `https://github.com/hayden726020/XiU-JixiangOrder.git` |
| 稀疏检出范围 | 仅 `frontend/`，其余模块未覆盖 |

本地 Git 是浅克隆 + 部分克隆的稀疏工作区，只用于前端基线交付。需要完整仓库历史或其他角色模块时，请新建完整克隆，不要在当前工作区强制补全或切换目录。

## 2 本轮已完成页面

| 页面/状态 | 路由 | 实现文件 | 状态 |
| --- | --- | --- | --- |
| 管理端概览 | `#/admin` | `pages/OverviewPage.tsx`、`admin-overview.css` | 已按设计稿实现 |
| 订单与异常查询 | `#/admin/orders` | `pages/OrdersPage.tsx`、`admin-orders.css` | 已按设计稿实现 |
| 订单查询空状态 | `#/admin/orders` | `pages/OrdersPage.tsx`、`admin-orders.css` | 已按设计稿实现 |

参考图来源：`D:\jixiang\workspace\设计系列\管理端*.png`。只实现设计稿中的手机应用界面，不实现左侧设计说明卡、页眉或展示稿网格背景。

### 概览页

- 小标题“管理端”，主标题“概览”。
- 三张统计卡：样例订单、待处理取消、已设延迟。
- 两个入口：订单与异常查询、营业与配置。
- 当前会话卡与退出操作。
- 概览使用精简外壳，不显示联调横幅、错误演习、模式切换和后台导航。

### 订单列表

- 状态筛选、当前页异常筛选和刷新按钮。
- 服务端/样例总数、当前页、异常数量摘要。
- 四行订单信息：单号与状态、档口与时段、用餐方式/份数/金额、创建时间与 version。
- 延迟预计时间和取消申请原因使用红色异常行。
- 保留订单卡进入只读详情。
- 空状态下保留筛选，隐藏摘要和订单卡，居中显示图标、标题、说明和绿色描边刷新按钮。
- 空状态分页只在右下角显示“第 N 页”。

## 3 现有数据与权限边界

- `data/source.ts` 保留 sample/live 双数据源。
- 样例统计仍为动态计算，当前样例为订单 4、待处理取消 1、已设延迟 1。
- 真实模式必须使用服务端数据；失败时不回退样例，不显示假总量。
- 管理权限由服务端逐请求校验，禁止在前端伪造 ADMIN 会话绕过权限。
- `demo-admin` 演示密码仅线下交付，不得写入源码、文档、提交、日志或聊天记录。
- 不修改接口契约、服务端、学生或档口模块来迁就页面视觉。

## 4 外壳与后续页面现状

`AdminHome.tsx` 目前只对概览和订单列表使用精简外壳。以下页面仍沿用旧外壳和旧视觉：

- 订单详情 `#/admin/orders/{id}`
- 营业与配置 `#/admin/settings`
- 非管理员身份提示

新对话不要把“订单列表已重构”误认为整个管理端都已完成。修改共享外壳时必须回归概览、订单、详情、配置和非管理员入口。

## 5 剩余管理端设计稿

建议按订单主链路优先：

1. `管理端订单详情只读.png`
2. `管理端订单详情已取消.png`
3. `管理端详情兜底两态.png`
4. `管理端订单错误三态.png`
5. `管理端营业与配置.png`
6. `管理端配置编辑表单.png`
7. `管理端配置保存反馈三态.png`
8. `管理端需管理员身份.png`

每张图可能包含多个状态，需分别实现并保留真实错误、权限和版本冲突语义。

## 6 运行与验证

本机 Node.js 位于 `D:\Node`，PowerShell 使用 `npm.cmd`：

```powershell
$env:Path = "D:\Node;$env:Path"
cd D:\jixiang\workspace\frontend
& "D:\Node\npm.cmd" run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

连接线上演示 API：

```powershell
$env:Path = "D:\Node;$env:Path"
$env:VITE_API_BASE_URL = "https://39.96.195.158/api/v1"
& "D:\Node\npm.cmd" run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

构建检查：

```powershell
$env:Path = "D:\Node;$env:Path"
& "D:\Node\npm.cmd" run build
```

本轮结果：

- `tsc --noEmit` 通过。
- Vite 生产构建通过，139 modules。
- 仅有现有的大 chunk 与动态 import 警告，不是构建失败。
- 已用演示管理员会话打开订单页浏览器预览。
- 未做逐像素视觉复核、真机安装或 APK 包内复验。

## 7 Git 推送环境

- Git 安装在 `D:\Git`，`git` 在 `D:\Git\cmd`。
- Git 直连 GitHub 在本机不稳定，已验证系统代理可用：

```powershell
$env:Path = "D:\Git\cmd;D:\Git\usr\bin;$env:Path"
$env:HTTP_PROXY = "http://127.0.0.1:7892"
$env:HTTPS_PROXY = "http://127.0.0.1:7892"
```

- 仅推送专用分支，不推送或强制更新 `main`。
- `frontend/.gitignore` 已排除 `node_modules`、`dist`、Syncthing 元数据、临时运行目录、Edge 浏览器缓存和 `*.sync-conflict-*`。

## 8 新对话开场

将 `frontend/NEXT-CONVERSATION-PROMPT.md` 全文提交给新对话，并附上本次要实现的下一张 `设计系列` 参考图。