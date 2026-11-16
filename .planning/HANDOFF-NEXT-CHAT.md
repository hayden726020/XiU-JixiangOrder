# 新对话交接：食麦呼当前基线

更新时间：2026-11-16（Asia/Shanghai）

## 当前基线

- 仓库：`D:\Jixiang\workspace\campus-meal`
- 分支：`docs/readme-status`
- 当前提交：`f0411f8 fix(mobile): commit back route inside view transition`
- 当前分支相对 `origin/docs/readme-status`：本次交接前 ahead 10、behind 0；交接提交并推送后应重新核对。
- 已确认工作区干净；不要重置、强推或覆盖历史。
- 唯一移动应用位于 `apps/mobile`，Capacitor Android；包名 `com.xiujixiang.order`。
- 最新 APK：`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`，版本 `1.25` / `versionCode 26`。
- 最新 APK 已成功构建并由 ADB 安装到已连接的 A024 手机。随后 ADB daemon 意外无法启动，最新安装状态尚未再次读取确认；先重连检查。
- Java 21 可用：`D:\Jixiang\.runtime\jdk21-full\jdk-21.0.13+9`。构建时设置 `JAVA_HOME` 并将其 `bin` 加到 `PATH`。

## 本轮主要改动

- `90dff4f` 合并 `integration/merchant-shimaifu-1.17` 商家前端和本会话学生按钮/取餐时段动效。
- `539a6c8` 按另一台电脑 agent 的验收约定修复商家路由：`#/merchant` 与 `#/merchant/setup` 均显示注册页；注册页取消及返回进入 `#/` 角色首页；订单列表在 `#/merchant/orders`，详情和菜单继续使用各自子路由。
- `4f9efc8`、`9fe656d`、`fcdb333`、`d6db957`、`f0411f8` 改善返回按钮反馈：按钮保持按下约 280ms 后触发导航；使用 View Transitions 做旧页模糊淡出、新页淡入；通过 `flushSync` 同步 React 更新；减少动态效果偏好下立即切换；等待期间拦截其他点击，地址变化会取消旧返回动作。
- 全局按钮禁用系统蓝色触摸高亮、文字选择和长按菜单样式。
- 最近遇到的问题：用户反馈 `1.23` APK 中页面过渡仍未显示。之后以 `flushSync` 和同步导航事件修正，`1.25` 已构建安装，但用户尚未复验过渡视觉。**下一位 agent 应先在手机实际点击返回键，确认旧页模糊离场与新页顺滑进入可见；若仍不可见，优先检查 Android WebView View Transition 实际执行情况并提供可见的兼容 CSS 回退。**

## 最近验证证据

- 最近一次 `npm run build`：通过（TypeScript 编译与 Vite 构建均成功，140 modules）。
- 最近一次 `npx cap sync android`：通过。
- 最近一次 `gradlew -p android assembleDebug`：BUILD SUCCESSFUL。
- 最近一次 `adb install -r ...app-debug.apk`：Success，ADB 当时确认安装版本 `1.25` / `versionCode 26`。
- 设备 WebView 查询返回 `com.google.android.webview 157.0.8103.38`；它具备 View Transitions API 的现代 Chromium 基础，但目前没有实际动画录屏或人工复验。
- TypeScript reviewer 检查 `f0411f8`，未发现过渡、路由同步、等待取消或点击拦截方面的可操作问题；`npm run typecheck` 通过。
- 构建保留 Vite 大 chunk（约 538kB）和动态导入无效警告；不影响本次构建成功。
- 学生端登录问题未取得真实账号/服务端复现证据，不能宣称已修好或已验收。之前检查的商家前端合入没有直接改学生认证逻辑；手机端登录仍依赖可访问的服务地址和有效学生演示账号。

## 建议下一步

1. `git status -sb` 确认交接提交与推送状态；不要覆盖新 agent 或用户的更改。
2. 在 A024 上打开当前 APK，复验学生页面返回、商家注册取消，以及返回时模糊/淡入过渡确实可见；按用户授权再操作真实登录。
3. 如果动画仍不明显，给 Android WebView 157 的实际行为优先级高于 API 支持推断；加无需 View Transitions API 的兼容实现，并再次安装、人工核验。
4. 真实学生登录需记录服务地址配置情况、脱敏错误码及有效演示账号验证结果；不把凭据写入代码或交接文件。
5. 代码行为改动按根 `AGENTS.md`、`apps/mobile/AGENTS.md` 和对应模块说明执行；保护协作者成果，完成构建并安排 reviewer。
