# 公共应用入口

由 spcuteag 维护登录、角色入口、页面切换和统一启动。当前是 S1 样例骨架，只有一个基于 hash 的轻量入口，没有登录和权限。

## 文件

- `App.tsx`：应用外壳、首页角色入口、hash 路由、未知入口提示和返回按钮。
- `moduleContract.ts`：模块接入契约 `MobileModule`（id、标题、副标题、路由、状态、页面组件）。
- `moduleRegistry.ts`：已注册学生模块与管理员模块；档口暂用公共占位组件。
- `placeholders.tsx`：档口占位页，不是业务实现。

## 路由

- `#/`：角色入口预览。
- `#/student`：学生模块，由 `src/modules/student/index.ts` 导出。
- `#/admin`：管理员模块，由 `src/modules/admin/index.ts` 导出；模块内部处理 `#/admin/orders`、`#/admin/settings` 子路径。
- `#/merchant`：公共占位，待漪x3的模块文件进入本仓库后注册。

公共层按模块顶层路由及其前缀匹配，例如 `#/student/menu` 仍渲染学生模块；模块内部如何响应子路径由模块自己负责。未知路由显示“未找到该入口”，不回退成首页。

## 模块接入约定

模块负责人只修改自己的模块目录，提供 `index.ts` 导出模块对象；由 spcuteag 在 `moduleRegistry.ts` 中注册。不要直接修改本目录或公共依赖。若要新增或调整模块字段，先提出字段、原因和对页面的影响，由 spcuteag 统一修改契约。

入口选择只用于预览，不构成角色授权；登录和服务端权限校验尚未实现。