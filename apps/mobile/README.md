# 唯一安卓应用

这里是三个角色共用的唯一移动应用。学生、档口、管理模块位于 `src/modules/`，公共入口与模块注册位于 `src/app/`，公共样式位于 `src/shared/`。

当前为 **S0 统一应用骨架**：只有一个可运行的网页应用和可打开的学生模块入口，不含登录、菜单、订单、后端请求或模拟账号，尚未生成 APK，也不代表安卓真机验收通过。

## 技术栈（实际安装版本）

- React 19.3.1 + React DOM 19.3.1
- Vite 8.3.8 + `@vitejs/plugin-react` 6.3.0
- TypeScript 7.0.2
- Capacitor 8.6.2（`@capacitor/core`、`@capacitor/android` 为运行时依赖，`@capacitor/cli` 为开发依赖；`android/` 尚未生成）

Node 要求 **>=22.12.0**（已写入 `package.json` 的 `engines`，由 Vite 8 与 Capacitor CLI 8 的实际要求确定）。框架、依赖、锁文件、公共入口和安卓打包配置由 spcuteag 维护。模块负责人不另建项目、不改公共依赖。

## 启动与检查命令

在本目录（`apps/mobile`）执行：

```bash
npm ci               # 首次克隆后按 package-lock.json 安装，推荐
npm run dev          # 开发服务，默认 http://127.0.0.1:5173/
npm run typecheck    # TypeScript 类型检查
npm run build        # 类型检查并产出 dist/
npm run preview      # 预览生产构建，默认 http://127.0.0.1:4173/
```

需要更新依赖时再用 `npm install`。构建产物 `dist/`、依赖 `node_modules/` 均被 .gitignore 忽略，不提交。

开发服务默认只监听本机 `127.0.0.1`。若要在同一可信局域网内用手机浏览器临时查看，可执行 `npm run dev -- --host`，并注意只在可信网络使用；APK 使用打包后的 `dist/`，不依赖开发服务器。

## 入口与点击路径

1. 打开 `http://127.0.0.1:5173/`。
2. 首页显示“角色入口预览”，点击“学生”卡片。
3. 地址变为 `#/student`，显示学生模块占位页。
4. 点击“← 返回角色入口”回到首页。

直接打开 `http://127.0.0.1:5173/#/student` 也可进入学生模块。

S0 没有登录：入口预览不代表角色授权，后续由公共服务端账号与权限决定可进入的模块。

## 学生模块接入方式

学生模块只需要维护两个文件，公共入口已经注册好，魈嘶不需要修改 `src/app/`：

- `src/modules/student/index.ts`：导出 `studentModule`，声明标题、路由、状态和页面组件。
- `src/modules/student/StudentHome.tsx`：学生页面组件，当前是公共层初始化的 S0 占位页，后续由魈嘶维护。

验证生效：把 `StudentHome.tsx` 中可见文字（例如“学生端入口已接通”）改成任意内容，保存后浏览器刷新即可看到变化。若修改的是 `index.ts` 的标题或副标题，首页卡片文字也会随之变化。

模块内部导航由学生模块自己负责（例如用组件状态，或在模块内监听 `#/student/...` 子路径）。公共入口按 `#/student` 前缀匹配同一个模块组件，因此子路径不会回退首页；公共层暂不提供子路由组件或参数。

后续可把页面拆到学生模块内的其他文件，只要 `index.ts` 继续导出 `studentModule` 并指向新的页面组件即可。公共注册表 `src/app/moduleRegistry.ts` 已引用该导出，不需要学生修改公共文件。

## 当前验证状态

2026-11-13 本地一次性检查，无长期证据：

- `npm run typecheck`：通过（退出码 0）。
- `npm run build`：通过，产出 `dist/`。
- `npm run preview`：HTTP 200；用无头 Edge 检查首页与 `#/student`，实际渲染出角色入口和学生占位页。
- 以上均为浏览器检查，不是 APK 构建、安卓安装或真机验收。
- 后端、测试服务地址、登录与角色权限均未接入。

## 安卓打包（尚未执行）

Capacitor 已配置 `appId=com.xiujixiang.order`、`appName=吉祥点餐`、`webDir=dist`。`android/` 需要由工具生成，不能手工伪造空工程，也尚未在本机执行或验证：

```bash
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

生成与构建需要可用的 JDK（建议 17）、Android SDK 和 Gradle 环境；工程路径应避免中文和空格。`appId` 也需在正式发布前由项目方确认。在这些命令实际执行并生成可安装 APK 之前，不得声称已有 APK 或安卓验收结果。