你接手“吉祥点餐”管理端前端视觉重构，本轮默认实现下一张管理端设计稿：**管理端配置编辑表单**（若用户附其他图，以附图为准）。

## 开始前必须阅读

1. `D:\吉祥社代码\workspace\team-context\frontend\Agent.md`
2. `D:\吉祥社代码\workspace\team-context\frontend\src\modules\admin\AGENTS.md`
3. `D:\吉祥社代码\workspace\team-context\frontend\HANDOFF.md`
4. 现有实现：`src/modules/admin/pages/SettingsPage.tsx`、`components/SettingsEditor.tsx`、`admin-settings.css`、`admin-orders.css`、`AdminHome.tsx`

工作目录：`D:\吉祥社代码\workspace\team-context\frontend`。
Git 基线目录：`D:\吉祥社代码\workspace\campus-meal-admin-baseline`（分支 `frontend/admin-redesign-2026-11-16`）。
参考图目录：`frontend/photo/backhand/`。

## 当前已完成

- 管理端概览 `#/admin`
- 订单与异常查询 `#/admin/orders`
- 订单查询空状态（浅米绿 `#F4F6F3` 底、空餐盒线稿图标、胶囊刷新按钮、页码右下）
- 营业与食堂配置 `#/admin/settings`（查看态 + 编辑态展开；编辑态仍是过渡实现）

## 本轮任务

1. 先只读核对参考图、现有 SettingsPage/SettingsEditor、`data/source.ts` 的保存契约，列出要替换的界面与必须保留的行为。
2. 只实现参考图右侧手机界面，不实现左侧设计说明卡、展示稿页眉、画布网格或注释文字。
3. 在 `src/modules/admin/` 内完成页面与样式，沿用已建立的视觉体系：背景 `#F4F6F3`、白卡约 14px 圆角、深绿主色 `#1F4A33`、辅助 `#7B857E`、胶囊描边按钮。
4. **必须保留的交互语义**（不得为了视觉删减）：
   - `dining` 与 `crowd` 分别保存，每次只提交一个 section；
   - 进入编辑生成 requestId，字段变化后重新生成；
   - 携带 `expectedVersion`；`SETTING_VERSION_CONFLICT`/409 保留输入并提示“重新读取最新配置（放弃本次输入）”；
   - 保存成功后重新读取并核对 version；
   - 401/403/503/超时/校验失败文案保持“不显示假成功、不回落样例”；
   - 样例模式不写服务端；中心点不在本页编辑，保存时按服务端读取值原样回传。
5. 不同步联调临时 UI：不显示模式切换、错误演习、requestId 调试文本、服务端字段缺口说明。
6. 补齐窄屏（≤359px）、触控尺寸（≥44px）、键盘焦点与 `prefers-reduced-motion`。

## 验证方式

```bash
cd D:\吉祥社代码\workspace\team-context\frontend
npx tsc --noEmit         # 只统计 modules/admin 的错误数，应为 0
npx vite build           # 应通过
```

管理端页面需要管理员会话：

1. 后台启动 `campus-meal/services/api`（8787，首次生成 `.runtime/demo-accounts.json`，密码不打印、不写文档）。
2. localStorage 写入 `xiu.mobile.apiBaseUrl.v1 = http://127.0.0.1:8787/api/v1`。
3. 用 `demo-admin` 调 `/auth/demo-login` 取会话写入 `sessionStorage['xiu.mobile.session.v1']`，**整页刷新**后打开目标路由。
4. 复用 `frontend/.runtime/admin-settings-shot.mjs` / `admin-orders-empty-shot.mjs` 的 CDP 模式（headless Edge，390×844）截图，再用图像核对；核对完只停本次启动的 8787，5173 dev server 保留。

已知：全量 `npm run build` 可能被并行会话未完成的 `merchant/pages/OnboardingPage.tsx`（`DISH_TYPE_OPTIONS`）阻塞，属队友改动，不要代改或回退。

开工先 `git status --short`、`git log -3 --oneline`、`git ls-remote origin refs/heads/frontend/admin-redesign-2026-11-16` 核对。同步目录可能另有并行会话的管理端改动（截至 2026-11-16 20:22：`OrdersPage.tsx` 错误态 `codeLabel`、`OverviewPage.tsx` 的 `navigateTo` 路由修复），这些尚未提交；不要覆盖，也不要替其宣称已完成。

## Git 边界

- 改动先写同步目录 `team-context/frontend`，验证后复制到 `campus-meal-admin-baseline/frontend` 对应路径，只 `git add` 本任务文件后提交。
- 只推 `frontend/admin-redesign-2026-11-16`；不推 `main`、不强推；推送后用 `git ls-remote` 复查。
- 直连 GitHub 不稳定时用命令级代理 `HTTPS_PROXY=http://127.0.0.1:7892`。
- 不把同步目录整体覆盖到 worktree（会带上他人未完成改动）。

## 硬性边界

- 不新建独立应用或第二套前端工程；不改契约、服务端、学生端、档口端或公共请求封装。
- 不提交密码、令牌、演示凭据、真实学生信息或精确坐标。
- 不整目录覆盖他人工作；先核对 Git/工作区状态，只暂存本任务文件。
- 使用简体中文回复。

请先输出：页面现状、参考图与现有编辑态的差异、计划修改文件、保留的交互与验证方式。得到确认后再开始改代码。