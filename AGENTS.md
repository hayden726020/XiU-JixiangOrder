# 项目共同开发规则

## 任务与事实

目标：2026-11-13 至 2026-11-17 完成一个 APK 内含学生、档口、管理三角色的五天 MVP。完整产品要求见 .planning/PROJECT.md。当前是协作骨架，无业务代码，contracts/API.md 是待确认草案。不得声称已有后端、已通过测试或已经正式上线。

最新产品要求和五天计划优先于旧讨论版的四天日程。先阅读 .planning/STATE.md 和本人方案，再读本模块 AGENTS.md、contracts/README.md 与 API.md、相关 team-context 进度。不需要一次加载整个项目。

## 目录所有权

| 负责人 | 可负责修改 | 专属开发说明 |
| --- | --- | --- |
| 魈嘶 | apps/mobile/src/modules/student/、.planning/people/student.md、仓库外 team-context/student/ | apps/mobile/src/modules/student/AGENTS.md |
| 漪x3 | apps/mobile/src/modules/merchant/、.planning/people/merchant.md、仓库外 team-context/merchant/ | apps/mobile/src/modules/merchant/AGENTS.md |
| spcuteag | services/api/、contracts/、apps/mobile/src/modules/admin/、apps/mobile/src/app/、apps/mobile/src/shared/、移动项目及安卓打包配置、根配置与依赖锁文件、公共类型、部署说明、.planning 公共状态、仓库外 team-context/backend/ | services/api/AGENTS.md |

每个 Agent 都不是独自在代码库工作：保护已有改动，不覆盖队友成果，不改队友进度。公共文件与队友模块变更先提出具体原因及影响，由对应负责人协调；在现有授权范围内完成本模块工作，不为普通检查重复索要许可。后端 Agent 从仓库根或管理目录开工，也要读 services/api/AGENTS.md。

## 一致性和边界

- 所有端使用同一套正式契约。契约更改由 spcuteag 在同一个 PR 更新说明、示例、版本和受影响页面清单；页面代码由对应负责人按约定版本修改，不因此扩大后端 Agent 的目录权限。三人确认后才作为正式依据。草案和同步目录中的 JSON 不自动成为正式契约。
- 前端可以使用明确标注的样例适配层，但不得因真实请求失败就悄悄返回假成功。正式联调切换到共同服务并记录同一提交版本。
- 堂食和外带同等可选；拥挤提示不拒绝下单、不自动改为外带。拒绝定位仍可下单。
- 不持续后台定位，不保存或记录精确坐标；仅保存范围判断及时间，短时参考失效，最迟 24 小时清除位置判断记录。
- 堂食参考去除重复用户，排除取消、退款和外带；未来预约与当前在场参考分开，未知不当作无人，不声称全食堂实测人数。
- 模拟付款退款必须清楚标识。价格、权限、库存、时段名额、订单变更及一次性核销由后端验证，不能只靠按钮禁用。
- 不接真实资金、不建长期运行服务、不发布到外部或更改远程设置，除非用户已明确授权相应操作。不写真实学生资料或凭据进代码、测试、同步文件和日志。

## 协作方式

在已有 Git 仓库中先检查状态。实际 origin 存在且网络可用时读取远端更新，再查看相关分支或 Draft PR；不存在时如实记为未配置，禁止猜远程地址。任务分支建议使用 student/、merchant/、backend/ 前缀。先推任务分支和 Draft PR，给出实际验证证据；通过检查和队友确认后再合 main，不强推 main。

team-context 在仓库旁边：自己的目录写，队友目录只读。仅接收模式不等于操作系统写保护。同步更新后重新读取相关进度；不能把 Git 仓库、.env、依赖目录或数据库放入同步文件夹。进度是信息提示，main 上已确认契约才是正式依据。

卡住 30 分钟说明目标、实际表现、错误及复现步骤。每天中午处理卡点，晚上由 spcuteag 牵头合用同一版本演示。11 月 16 日晚冻结新功能，17 日验收交付。

## 验证与交接

行为变更先补能失败的针对性测试，再最小实现；使用项目实际存在的命令，禁止把未建立的命令填成通过。提交前检查改动范围，执行相应测试与构建，安排对应语言 reviewer 或 code-reviewer 独立复核；权限、外部输入和位置数据处理增加 security-reviewer。这里只要求后续代码开发采用这些复核，不代表当前文档已经通过业务测试。

每次交接写清：分支/PR/提交、接口版本、改动页面、实际执行命令及结果、人工操作证据、样例还是真实请求、已知问题、下一个依赖。更新本人 progress.md；公共状态由 spcuteag 汇总。长期任务以 .planning 为准，同步进度不能私自改排期。

## 单 APK 的整体边界

唯一移动应用目录为 apps/mobile，三个业务模块在 src/modules/student、merchant、admin。只有一个应用入口、公共登录/路由和安卓工程；三名成员不能分别初始化三个独立应用。框架和实际命令由 spcuteag 统一，Capacitor 为已选打包路线。android/ 由工具初始化时生成，当前不伪造空安卓工程。后台 services/api 是独立公共服务，不放进 APK。

第 1 天完成最小 APK 的真机安装、测试服务连接和一次定位授权/拒绝检查。角色权限来自服务端账号，入口选择不构成授权；学生不能调用档口或管理接口。交付验收使用同一 APK 的不同账号，记录版本和所用服务。尚未生成 APK 时必须明确标注。

team-context/backend 下的个人姓名目录和公共资料均为 spcuteag 发布的阅读副本；学生/档口 Agent 不因目录包含本人姓名就获得写权限。正式代码与契约以已确认仓库版本为准，资料副本标注版本和来源，队友各自仍写 student/merchant 的 progress.md。既有同步标记和设置必须保留，本轮不改变同步配置。
