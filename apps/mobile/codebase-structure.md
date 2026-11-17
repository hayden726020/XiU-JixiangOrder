# 吉祥点餐前端 Codebase Document

> 📁 This document is a project overview. Modules with complex directory structures have been split into independent sub-documents — see section notes for details.

## 1. Tech Stack

- **Node.js >=22.12.0** (from package.json `engines.node` and README.md `运行`)
- **Language**: TypeScript ^7.0.2 (from package.json `devDependencies.typescript`)
- **Runtime / Framework**: React ^19.3.1 + Vite ^8.3.8 (from package.json `dependencies.react` and `devDependencies.vite`)
- **Package manager**: npm（版本未在项目文件中声明；存在 package-lock.json）
- **Monorepo tool**: none（frontend 为独立工作副本，未发现 workspace 或编排配置）
- **Testing**: 未提供测试脚本或测试框架配置

## 2. Project Directory Structure

> 💡 Modules that have been split into sub-documents are marked with `📄 See: [path]` in the directory tree and are not expanded here.
> 💡 TS/JS projects: Must expand according to **actual** directory hierarchy (including git submodule / workspace-pulled business source directories) — do not fill in non-existent levels based on templates.

```
frontend/
├── src/                                      # 单页应用入口、公共能力与三类角色业务界面
│   ├── app/                                  # 应用外壳、角色入口、Hash 路由与模块注册
│   ├── modules/                              # 学生、商家、管理端业务模块
│   │   ├── admin/                            # 管理端概览、订单异常查询与营业配置
│   │   │   ├── components/                   # 管理端样例提示与配置编辑组件
│   │   │   ├── data/                         # 管理端真实服务与样例数据源边界
│   │   │   ├── pages/                        # 管理端概览、订单、订单详情和设置页面
│   │   │   └── utils/                        # 管理端业务展示格式化逻辑
│   │   ├── merchant/                         # 商家订单处理、菜单时段与开店流程
│   │   │   ├── components/                   # 商家订单操作与样例提示组件
│   │   │   ├── data/                         # 商家订单菜单数据契约与数据来源
│   │   │   ├── pages/                        # 商家菜单、订单列表详情和开店页面
│   │   │   ├── state/                        # 商家订单操作、菜单编辑与开店状态逻辑
│   │   │   └── utils/                        # 商家金额等展示辅助逻辑
│   │   └── student/                          # 学生选店点餐、订单、登录和到店判断
│   │       ├── assets/                       # 学生端校园、档口、菜品与界面图片资源
│   │       ├── components/                   # 学生端登录、样例提示与拥挤定位提示组件
│   │       ├── data/                         # 学生端真实/样例数据源及字段映射
│   │       ├── pages/                        # 学生端选店、菜单、确认、订单和个人页面
│   │       ├── state/                        # 学生端会话门禁、订单草稿轮询与定位状态
│   │       └── utils/                        # 学生端订单、菜品、金额与错误展示逻辑
│   └── shared/                               # 会话权限、请求、配置、定位与公共样式
├── photo/                                    # 前端示例图片和视觉参考，不代表真实业务数据
└── package.json                              # 独立前端工作副本的依赖与运行脚本
```

## 3. Dev Commands (Core)

> ⚠️ All commands are sourced from project documentation. Each command is annotated with its source.
> ⚠️ TS/JS projects: If build / test commands come from multiple sources, they must undergo Step 4-C cross-verification, with verification markers noted in comments.

### Build Commands
```bash
# npm run build：依次执行 tsc --noEmit 与 vite build（Source: package.json > scripts.build；cross-verified with README.md > 检查命令）
npm run build

# 当前 Windows 环境的已验证调用（Node 位于 D:\Node，需先补入 PATH）
$env:Path = "D:\Node;$env:Path"; & "D:\Node\npm.cmd" run build
```

验证结论：`VALID`。首次调用因当前 PowerShell 的 PATH 缺少 Node 而失败；补入 `D:\Node` 后，原项目脚本在 `frontend/` 中成功完成 TypeScript 检查及 Vite 构建，无需修改项目构建脚本。

### Test Commands
```bash
# Not provided in documentation, please refer to package.json 与测试框架配置确认
```

### Run / Start Commands
```bash
# 安装依赖（Source: README.md > 运行）
npm install

# 启动 Vite 开发预览（Source: package.json > scripts.dev；cross-verified with README.md > 运行）
npm run dev

# TypeScript 检查（Source: package.json > scripts.typecheck；cross-verified with README.md > 检查命令）
npm run typecheck

# 启动构建产物预览（Source: package.json > scripts.preview）
npm run preview
```

## 4. Dev Environment (Brief)

### Prerequisites

- Node.js >=22.12.0
- npm（版本未在项目文件中声明）

### Configuration Notes (Optional)

- `vite.config` 配置开发服务监听 `127.0.0.1:5173`，构建产物预览监听 `127.0.0.1:4173`。
- 浏览器开发预览通过 Hash 路径进入角色模块；真实服务与样例模式保持分离，真实请求失败不得回退样例数据。