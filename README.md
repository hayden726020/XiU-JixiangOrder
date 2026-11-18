# 吉祥点餐 / 食麦呼

一个使用 React、TypeScript 和 Capacitor 构建的单 APK 点餐项目，包含学生、档口和管理三个角色；独立的 Node.js API 负责身份、菜单、订单和管理数据。项目仍在开发与联调中。

## 仓库状态

以下状态于 **2026-11-18** 核对远端分支；不同分支的改动不能视为已合入 `main`。

| 分支 | 已核对状态 |
| --- | --- |
| [`main`](https://github.com/hayden726020/XiU-JixiangOrder/tree/main) | 核对时为提交 `e08292d`。包含三角色移动端、独立 API、SQLite 演示数据及订单流程；Android 工程配置为 `1.13` / `versionCode 14`。 |
| [`docs/readme-status`](https://github.com/hayden726020/XiU-JixiangOrder/tree/docs/readme-status) | 核对时为提交 `6c9247c`。包含更多学生、档口和管理端界面与 API 改动，Android 工程配置为 `1.39` / `versionCode 40`。其 `.planning/STATE.md` 记录了服务部署及测试结果；这些记录未在本次核对中重新实测。 |
| [其他开发分支](https://github.com/hayden726020/XiU-JixiangOrder/branches) | 11 月 18 日仍有前端、档口等分支更新。合入状态以 GitHub 的提交与 PR 为准。 |

`main` 的 [接口契约](contracts/README.md) 仍为草案，不能把开发分支的功能、测试记录或部署记录当作默认分支的验收结果。现有文档中的浏览器检查、自动化测试、APK 构建、真机检查和线上部署记录各有范围；当前代码的完整三角色真机联调与生产验收尚无统一证据。

## 本地启动

移动端要求 Node.js **>=22.12.0**，API 要求 Node.js **>=24**。在仓库根目录分别启动：

```bash
cd apps/mobile
npm ci
npm run dev
```

```bash
cd services/api
npm start
```

移动端默认开发地址为 `http://127.0.0.1:5173/`。学生、档口、管理和公共自检入口分别为 `#/student`、`#/merchant`、`#/admin`、`#/system-check`。入口可见不代表获得相应权限；API 依账号角色校验请求。API 的演示账号由运行时生成，具体启动方式、配置和限制见 [服务说明](services/api/README.md)。

## 项目结构与验证

- [`apps/mobile`](apps/mobile/README.md)：统一移动应用与 Capacitor Android 工程。三个角色模块位于 `src/modules/student`、`src/modules/merchant`、`src/modules/admin`。
- [`services/api`](services/api/README.md)：独立 API 和 SQLite 演示数据；数据库与运行时账号不入库。
- [`contracts`](contracts/README.md)：接口草案与虚构示例。
- [`.planning/STATE.md`](.planning/STATE.md)：开发过程和分阶段验证记录；阅读时注意记录对应的日期与分支。

可在 `apps/mobile` 运行 `npm run typecheck`、`npm run build`，在 `services/api` 运行 `npm test`。这些检查不能替代 APK 真机与现场联调。演示付款不发生真实资金交易；请勿将密码、签名密钥或真实个人数据提交到仓库。
