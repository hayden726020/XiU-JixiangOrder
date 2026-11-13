# 唯一安卓应用

这里是三个角色共用的唯一移动应用。学生、档口、管理模块位于 `src/modules/`，公共入口与模块注册位于 `src/app/`，公共样式位于 `src/shared/`。

当前为 **S1 样例骨架**：网页应用可打开学生与管理员样例模块；公共层已有演示登录、请求封装与一次性定位，但没有可用服务端、真实菜单/订单或模拟账号。含定位插件的 7.6 MB debug APK 已在 A024 安装，完成定位授权/拒绝与管理端 S1 页面真机复验；真实服务未接入。

## 技术栈（实际安装版本）

- React 19.3.1 + React DOM 19.3.1
- Vite 8.3.8 + `@vitejs/plugin-react` 6.3.0
- TypeScript 7.0.2
- Capacitor 8.6.2（`@capacitor/core`、`@capacitor/android` 为运行时依赖，`@capacitor/cli` 为开发依赖；`android/` 已生成）
- `@capacitor/geolocation` 8.2.4（Android 一次性定位；权限在 AndroidManifest 中声明为 ACCESS_COARSE_LOCATION / ACCESS_FINE_LOCATION）

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
2. 首页显示“角色入口预览”与学生、档口、管理员三张卡片。
3. 点击“学生”进入 `#/student`；点击“管理员”进入 `#/admin`，管理页内部使用 `#/admin/orders`、`#/admin/orders/{id}`、`#/admin/settings`。档口仍显示公共占位。
4. 首页“公共能力自检”进入 `#/system-check`，用于检查服务地址、演示登录与一次性定位；该页不代表角色授权。
5. 点击“← 返回角色入口”回到首页。

直接打开 `http://127.0.0.1:5173/#/student`、`#/admin` 或 `#/system-check` 也可进入对应页面。

S2 管理端可在“样例 / 真实服务”间切换：样例不请求后端；真实模式需要先到 `#/system-check` 以管理员账号登录。入口可见仍不代表权限，服务端逐请求校验角色。

## 学生模块接入方式

学生模块只需要维护两个文件，公共入口已经注册好，魈嘶不需要修改 `src/app/`：

- `src/modules/student/index.ts`：导出 `studentModule`，声明标题、路由、状态和页面组件。
- `src/modules/student/StudentHome.tsx`：学生页面组件，当前是公共层初始化的 S0 占位页，后续由魈嘶维护。

验证生效：把 `StudentHome.tsx` 中可见文字（例如“学生端入口已接通”）改成任意内容，保存后浏览器刷新即可看到变化。若修改的是 `index.ts` 的标题或副标题，首页卡片文字也会随之变化。

模块内部导航由学生模块自己负责（例如用组件状态，或在模块内监听 `#/student/...` 子路径）。公共入口按 `#/student` 前缀匹配同一个模块组件，因此子路径不会回退首页；公共层暂不提供子路由组件或参数。

后续可把页面拆到学生模块内的其他文件，只要 `index.ts` 继续导出 `studentModule` 并指向新的页面组件即可。公共注册表 `src/app/moduleRegistry.ts` 已引用该导出，不需要学生修改公共文件。

## 管理端当前能力（S2）

- `#/admin/orders`：状态筛选（NEW…CANCELLED）、分页、待处理取消申请与延迟标记；点击进入只读详情。
- `#/admin/orders/{id}`：复用 `GET /orders/{id}`，管理视角不返回取餐码；不含任何订单写操作。
- 真实模式使用 `GET /admin/orders`；服务端当前只支持 `status/page/pageSize`，异常筛选仅作用于当前页。失败时显示错误，不回退样例。
- 配置页仍是 S1 样例结构；真实 `GET /admin/settings` 返回 `dining`/`crowd`，在 S5 对齐。

## 当前验证状态

2026-11-13 本地一次性检查，无长期证据：

- `npm run typecheck`：通过（退出码 0）。
- `npm run build`：通过，产出 `dist/`。
- `npm run preview`：首页、JS、CSS 均 HTTP 200。
- 管理员 S1 样例页另用 Vite SSR 渲染 `#/admin`、`#/admin/orders`、`#/admin/settings` 三个入口，14 项断言全部通过（样例横幅、4 笔订单、金额、状态、异常标记、不含取餐码）；这是渲染检查，不是浏览器手工验收。
- 管理员 S2 实际执行：`typecheck` 退出码 0；`build` 成功（71 modules，CSS 23.31 kB、JS 318.16 kB、web chunk 2.08 kB）；用临时内存库启动 `services/api` 实测 18 项，17 项通过（学生/管理员登录、下单、管理列表与详情、401/403、分页、取餐码恒 null），发现 `status=BOGUS` 未校验返回 200；样例筛选/分页与页面渲染检查 12/12 通过。以上是接口与渲染检查，不是浏览器手工或真机验收。
- 已推送默认分支 `main`，首个骨架提交 `a4795a2fadc4`；克隆地址见仓库根 README。
- debug APK 已于同日构建，旧包（4.1 MB，无定位插件）在 A024（Android 16 / API 36）真机安装并验证首页与角色入口；该包早于管理端 S1。
- 公共层自检页 `#/system-check` 已用无头 Edge + CDP 实际点击检查：未配置服务时读取范围配置返回 NOT_FOUND 且无成功文案，演示登录失败后仍为“未登录”。这是浏览器检查。
- 含 `@capacitor/geolocation` 与定位权限的新包（7.6 MB）已在 A024 安装。授权路径：系统弹窗选“使用应用时”后 FINE/COARSE 均 granted；无服务端配置时使用演示范围（半径 150 米、误差容忍 60 米），设备判断为“范围外 · 判断完成 · 演示范围”。拒绝路径：撤销权限后重试选“不允许”，结果为“无法判断 · 定位权限被拒绝”，页面仍可用。
- 管理端 S1 已在同一 APK 真机复验：概览显示 4 笔样例订单、1 待处理取消、1 已延迟；订单与异常页渲染 4 笔，不显示取餐码。
- 两机联调、真实登录成功、位置上报与真实食堂边界校准均未执行。
- 后端、测试服务地址、登录与角色权限均未接入真实服务。

## 安卓打包（已实际执行）

Capacitor 已配置 `appId=com.xiujixiang.order`、`appName=吉祥点餐`、`webDir=dist`。`android/` 已由 `npx cap add android` 生成（minSdk 24，compileSdk/targetSdk 36）。

构建要求 **JDK 21**（Capacitor 8.6.2 的 Java 源发行版为 21，JDK 17 会报“无效的源发行版：21”）、Android SDK 36 与可用 Gradle。需设置 `JAVA_HOME` 指向 JDK 21、`ANDROID_HOME` 指向 Android SDK；工程路径应避免中文和空格。

```bash
npm run build
npx cap add android     # 仅在 android/ 不存在时执行
npx cap sync android
cd android
./gradlew assembleDebug # Windows 使用 gradlew.bat
```

产物为 `android/app/build/outputs/apk/debug/app-debug.apk`（debug 签名，`*.apk` 被 .gitignore 忽略）。2026-11-13 实际构建结果：BUILD SUCCESSFUL，aapt 校验 package=`com.xiujixiang.order`、versionCode=1、versionName=1.0、label=吉祥点餐。19:35 首包（4.1 MB）已在 A024（Android 16 / API 36）安装并验证入口；20:02 含 `@capacitor/geolocation` 8.2.4 与定位权限的新包（7.6 MB）于 20:22 安装成功，完成自检页定位授权/拒绝与管理端 S1 页面真机检查。未做真实登录、位置上报、两机联调或现场食堂边界校准；构建通过不等于业务验收。AndroidManifest 已声明 `ACCESS_COARSE_LOCATION` 与 `ACCESS_FINE_LOCATION`。