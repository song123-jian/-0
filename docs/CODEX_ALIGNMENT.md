# 本机 Codex 对齐记录（Scodex 正式1.3.20）

## 范围与结论

1.3.20已补齐Git丢弃与soft／mixed／hard重置：取消、并发、外部内容／索引变化、重命名／未跟踪文件、确认期间项目／退出与权限设置保护均接入；权限保存忙锁与git:mutate等待逻辑已进入当前候选。30项辅助测试、候选实际EXE 12项及包内构建一致性通过，根快捷方式已覆盖到正式1.3.20（SHA256 `9d45ce8e4cc2356ab7f9ce8d57ececa853b6609f13d00f51987c29a3fa50dd05`），旧正式1.3.19已精确删除且未备份。[候选验收](../release/git-discard-reset-20261030/candidate-ui-4/source-control-ui-verification.json)、[正式入口](../release/git-discard-reset-20261030/shortcut-verification.json)、[替换与清理](../release/git-discard-reset-20261030/final-delivery-verification.json)。实际UI由CDP驱动，远端使用本地bare仓库，模型使用loopback fixture；不据此声明整体95%或100%。
1.3.19已补齐GitHub PR工作台：Windows加密连接、匿名／认证列表与默认折叠详情、草稿／正式创建、取消与重复PR回读、转为可审查、HEAD SHA绑定merge／squash合并，以及共享Git锁、项目切换／退出、只读和禁网保护。9项PR服务与4项Git定向用例、候选实际EXE9项及同哈希正式入口4项通过；正式SHA256 `e64f5578c8c7025e8a8984f641ed94b7601d4458399a214d3e9bfa48747fac43`。GitHub API使用本机兼容服务，真实EXE／IPC／Git／Windows加密参与，未验证公网账号或真实分支保护；不据此声明整体95%或100%。附件继续默认折叠成记录行，点击或Enter展开；微软雅黑正文16px、辅助14px。旧1.3.18及重复构建已移出原入口至“手动删除”，未复制备份，但自动审批阻止删除，尚需人工物理删除。[正式验收](../release/pr-flow-20261030/formal-entry/github-pulls-ui-verification.json)、[最终入口与清理状态](../release/pr-flow-20261030/final-delivery-verification.json)。

1.3.18已新增公开GitHub技能插件目录：默认openai/skills，可查看详情和默认折叠的随包文件、安装／更新／启停／卸载及添加公开来源；固定提交、Blob内容校验、用户修改保护与停用后主进程拒绝旧技能选择已接通。9个有效服务用例、完整候选6项、最终文案候选5项与快捷方式解析后的正式入口5项通过；最终EXE SHA256 `b47a97d027d27162ab000d0172c3d8cae18bacd5e00163fc4e3efdbb4eebeb49`。[正式验收](../release/plugin-marketplace-20261030/formal-entry/plugin-marketplace-ui-verification.json)、[测试汇总](../release/plugin-marketplace-20261030/targeted-tests-summary.json)。公开GitHub目录／文件操作真实执行，模型回复使用受控本机端点；未自动安装依赖或连接MCP服务，不等同全部第三方插件市场。旧1.3.17 EXE已按要求删除且未备份，用户数据保留；附件继续默认折叠成记录行，点击展开。

1.3.17已接通旧SSE的真实SDK连接、Bearer与自定义头、OAuth授权与重启续期、工具／资料、网络策略、逐事件体积限制及断开清理。候选实际EXE7项和同哈希正式入口3项通过，SHA256 `47b8599e288b34e144ae1734a4f4450dbbefdff071b5924f4a51bbc413e134e1`；[本轮验收](../release/mcp-sse-20261030/candidate-ui-2/mcp-sse-ui-verification.json)、[正式入口](../release/mcp-sse-20261030/formal-entry/mcp-sse-ui-verification.json)、[测试汇总](../release/mcp-sse-20261030/targeted-tests-summary.json)。上一正式EXE1.3.16已删除且不备份，配置和用户数据保留。公网服务兼容性与整体Codex对齐仍不计为100%。

1.3.16为定时任务增加所属项目选择，并将附件默认收起为记录行，点击可查看文件名、路径和移除操作；旧任务仅在缺少项目归属时迁移，已有归属及运行记录保持。候选、正式程序和快捷方式实际入口均通过定向 UI 验收，1.3.16 正式 EXE SHA256 为 `ee4efe49b70565e142c12634c400cdc94430bf0e277aa5dddf94a10e5566dbe1`；详见[正式入口报告](../release/task-scheduled-projects-attachments-20261030/evidence/shortcut-ui/scheduled-task-ui-verification.json)。1.3.13 的待发送文件、图片和工作台状态快照仍按摘要折叠，1.3.12 的已发送附件及 1.3.11 的工具记录继续保持隐藏式显示。整体仍未达到完整 Codex 对齐。

1.3.9已新增主窗／独立窗的消息编辑、成功回答重新生成和对话版本选择；按正确前缀创建新分支，原回答及后续、原附件、草稿和重启保留。工具重新执行默认关闭、明确勾选后仍需现有审批；20版本上限不丢历史，分叉保留全部版本且消息标识独立。28有效辅助、8实际EXE功能范围、最终入口、7包内对象和12文件增量审查通过；初始7范围SHA31972c82…按未变行为复用，最后提示修正后的补验与正式入口为SHAc1545400…。1.3.9历史入口复核通过，退出0。

1.3.8已新增真实版本控制工作台：工作区／已暂存差异、暂存／取消、本地提交、新建分支及隔离工作树作为项目打开，接通当前工作树内的模型审批／PowerShell写入和真实HTTP开发预览。仓库快照绑定真实Git元数据及index，所选文件另做内容指纹，运行／未保存／只读与写入中退出保护已接通。27有效辅助、8实际EXE范围、9包内对象和17文件增量审查通过；该轮正式快捷方式指向1.3.8，版本／SHA／重启项目与历史／双视口复核通过、退出0。前5范围按未受影响的旧候选SHA复用，后3和正式入口为当前SHA。该阶段的跨项目并行限制已由1.3.12补齐；完整跨任务协作仍未提供。

1.3.7已新增项目／最近侧栏和完整最近页的右键菜单，落地重命名、置顶、未读、归属项目、聊天分叉、复制、导出、独立窗口、归档恢复和永久删除。独立窗口由主工作台统一保存历史，支持真实发送／审批／停止和双向草稿同步；删除项目保留磁盘文件，运行、未保存与最后项目保护已接通。29辅助和13实际EXE范围有效，10包内对象一致，18文件增量审查完成；该轮快捷方式更新指向1.3.7，版本／SHA／实际菜单及历史复核通过，最终正常退出。5个初版菜单范围在两处renderer修复后按未受影响结果复用，各范围保留实际SHA。

截至1.3.6，同项目最多3聊天并行、独立事件／审批／停止、草稿附件切换、后台未读及文本／表格／图片共享提交保护已落地；37辅助、10实际范围与正式入口复核通过。不是跨项目独立工作树；完整跨任务协作仍有缺口。1.3.5已接入MCP OAuth动态注册及预配置公共客户端、独立授权窗口、真实SDK发现／PKCE／state与本机回调、Windows加密、重启续期／令牌轮换、清除和取消保护；30项辅助、12个实际EXE范围及最终入口复核通过。本机OAuth／MCP服务真实执行，只有模型回复替代，公网身份提供方全面兼容性尚未完成验证。此前1.3.4已增加MCP资源、URI模板与提示词的真实SDK目录／预览、参数、加入草稿及模型逐次审批，并处理通知失效、取消和旧连接；15辅助、14实际范围及正式入口复核通过。1.3.3已新增模型真实图片读改读和裁剪／缩放／旋转／翻转／亮度／文字的确定性编辑，接入逐次审批、版本／未保存／并发保护、缩略图历史和编辑器同步，并修复切项目时未完成图片加载串入新项目的竞态；生成式重绘仍未接入。1.3.2已有常用XLSX／UTF-8 CSV／TSV的AI批量读改读。此前已在项目执行、MCP 和 AI 浏览器之上接入托管开发服务，并将回复区改为真实处理时长、Markdown 正文和紧凑可展开操作记录。deepseek-v4.1-flash 已在实际 EXE 完成文件、网页、视觉及服务启停链路。参考目录只读；不修改本机 `.codex` 的认证、权限或模型配置，不导出凭据，不以测试连接替换用户默认配置。

当前具备可验收的本地执行闭环，尚未达到完整 Codex 对齐。界面入口、已安装说明、真实执行器和公网服务可用性分别判断，不将估算相似度写成实测百分比。

## 能力对照

| 能力 | 当前实际状态 | 验证边界 |
| --- | --- | --- |
| 公开技能插件目录（1.3.18） | 公开GitHub来源、固定提交目录／详情、随包文件折叠、安装／更新／启停／卸载、技能发现与聊天选择 | 9有效服务用例、完整候选6项及最终候选／正式入口各5项；真实GitHub API、磁盘与IPC；仅模型回复替代，更新／恶意包在服务层验证，不自动安装依赖或登录服务 |
| 消息编辑／重新生成／版本（1.3.9） | 主窗／独立窗编辑与重新生成，原分支及后续、附件／草稿、重启和20版本保护；分叉保留版本 | 28辅助、8实际功能范围及最终入口；明确勾选才重新请求工具，文件不回滚；原7范围与最终补验按实际SHA分别记录 |
| Git版本控制（本地1.3.8／远端同步1.3.14／丢弃重置1.3.20） | 本地状态、差异、暂存／提交、分支和工作树；远端状态、Fetch、干净工作区快进 Pull、确认 Push；新增单文件丢弃、soft／mixed／hard reset、确认锁、权限与外部变化保护 | 30项辅助测试、候选实际EXE 12项及正式快捷方式入口通过；远端使用本机bare repository，未验证公网主机或认证；1.3.19 PR工作台候选9项／正式入口4项仍有效，API为本机兼容服务 |
| 工作树作为项目（1.3.8） | 确切登记根进入模型文件／命令及开发预览，原项目隔离；设置存储和Git页可打开，当前树禁止删除 | 真实审批／PowerShell写文件、原项目无该文件、HTTP启动就绪停止、重启项目持久化；该阶段结果，跨项目聊天并行另见1.3.12 |
| 项目／最近右键（1.3.7） | 完整聊天菜单与项目登记管理，子菜单／快捷键／归档恢复／二次确认 | 29辅助、13实际范围；删除项目保留磁盘文件，外部应用正文渲染未验收 |
| 独立窗口（1.3.7） | 白名单快照，真实发送／审批／停止／双向草稿，主窗口统一保存 | 共享当前项目，跨项目发送先切换，不是独立工作树；最多8窗的配置边界经审查，未对8窗上限做实际验收 |
| 跨项目聊天并行（1.3.12） | 最多3项聊天任务、按所属项目路由、独立审批／停止、后台未读、草稿与附件切换及共享文件保护 | 1.3.12实际EXE11项通过，含A/B项目各自真实文件输出；沿用未变路径结果，非完整跨任务协作 |
| 聊天附件隐藏式记录（1.3.12／1.3.13） | 已发送及待发送文件／图片摘要折叠，点击展开；草稿支持逐项移除，工作台快照可加入／移除，聊天切换重置折叠 | 1.3.12完整套件 11/11；1.3.13候选及正式入口定向 UI 场景通过；CDP 驱动，未覆盖原生鼠标 |
| 工具隐藏式记录（1.3.11） | 成功记录默认折叠为一行，点击展开详情；运行中、失败、待审批、取消和中断保持展开；状态图标区分成功、失败与取消 | 候选及正式入口范围通过；此增量未覆盖原生 Windows 文件对话框 |
| 项目、定时任务、插件、技能导航 | 定时任务支持项目归属；附件以记录行折叠并可展开查看／移除（1.3.16） | 候选、正式 EXE 与快捷方式入口定向 UI 验收通过；导航和其他工具沿用既有版本记录 |
| 命令搜索与快捷键 | Ctrl Shift P、方向键、Enter、Escape；文件、终端、设置快捷键 | 旧结果沿用，新增“执行项目任务”实际切换成功 |
| 真实项目工具 | 列目录、读文件、字面搜索、写入、精确替换、命令、计划 | 实际 EXE、本机受控模型端点、真实文件和 PowerShell |
| 检查、修改、运行、修正闭环 | 真实测试退出 1，修改后退出 0；中文输出和差异可查看 | 外部模型被确定性端点替代；未冒充公网 Grok 通过 |
| SKILL 与 AGENTS | 已选 SKILL、根和所读文件沿途 AGENTS 进入模型上下文 | 实际请求包含验收指引；不等于所有技能依赖可用 |
| 文件保护 | 项目限定、最新哈希、唯一替换、未保存与并发保护、写后回读 | UTF-8 文本上限 2 MB；不是通用二进制编辑工具 |
| 权限与模式 | 对话不执行、仅对话主进程拒绝工具、规划只读；命令可审批和拒绝 | 任意 Shell 没有系统级沙箱，受限策略禁止自动执行 |
| 流式模型协议 | 原生工具通道和显式 JSON 兼容通道；中断／截断不执行 | 不自动把协议失败降级为普通回答后宣称任务完成 |
| 取消与历史 | 可取消请求和正在管理的命令；保留差异、退出码和执行偏好 | 已完成修改保留；重启不恢复活审批或继续未完任务 |
| 托盘与第三工作台 | 关闭隐藏、恢复、明确退出、单实例、分隔条调宽 | 沿用 1.0.5 已通过的实际程序范围 |
| MCP 连接与模型工具 | stdio、Streamable HTTP、SSE（1.3.17）、Schema 校验、每次审批、取消、旧连接保护、加密配置及退出清理 | 真实 SDK 服务与实际 EXE；外部模型用本机确定性端点替代 |
| MCP 规划与策略 | 规划可逐次审批读取资料；其他工具仍需用户白名单与服务只读标记；普通对话和禁止审批策略无模型 MCP | 实际请求、拒绝、策略变化与调用日志核对 |
| MCP 资料（1.3.4） | stdio／认证HTTP资源、URI模板和提示词，分页、参数、纯文本预览、保留草稿后显式发送、模型目录→读取／提示词；逐次审批、取消、通知／代次失效、脱敏和有界内容 | 15辅助、14实际功能范围、最终文案／双视口和入口复核有效通过；仅模型回复替代，真实SDK／EXE／IPC／历史；OAuth另见下一行，旧SSE在1.3.17已补齐；公开SKILL目录见1.3.18，MCP服务仍需单独配置 |
| MCP OAuth（1.3.5／SSE1.3.17） | 动态注册／预配置公共客户端、独立登录、PKCE／state／issuer／资源绑定、加密保存、刷新／失效恢复、清除／重启及交换期间取消；模型不自动登录 | 30有效辅助、12实际EXE范围，含真实OAuth服务／Windows加密／SDK／原生和JSON逐次审批／双视口／最终入口；未验证全部公网账号与身份提供方 |
| AI 浏览器工具 | 标签列表、打开、Bing 搜索、顶层快照、点击、填入、按键、滚动、截图及关闭 | 17 个实际 EXE 范围；确定性端点只替代该组模型，网页与保存副作用真实发生 |
| 网页隔离与审批 | 项目／对话独立临时 session，不读取手工标签；逐次批准后复核策略、页面和元素 | 默认关闭；规划无点击／填入／按键；普通对话与 never 不开放；不是系统沙箱 |
| 真实网页图片 | 原生／JSON 两通道传送 image_url，历史保留有界缩略图 | 真实模型识别画布 V75487，与实际网页截图独立核对一致 |
| 新密钥真实执行 | deepseek-v4.1-flash 文件读改读、网页中文填入保存、截图识别通过 | 实际 1.3.0 EXE、真实中转、受控项目和本地网页；没有替换真实默认配置 |
| 开发服务 | 手动与模型启动／日志／列表／停止、脚本选择、回环预览、托盘保留、切项目／退出清理、异常主进程观察清理 | 服务候选 8 辅助、14 个实际 EXE 范围及 1 条真实中转链路；最终 1.3.1 服务入口独立验收，保留原 SHA |
| 回复与记录 | 真实时长及历史保存、Markdown、紧凑可展开行、计划／文件摘要、复制代码、失败重试和停止 | 正式 1.3.1 的 19 辅助与 10 个实际 EXE 范围；旧历史缺失时长不编造 |
| 字体与布局 | 微软雅黑正文 16px，辅助至少 14px；操作和表格局部滚动 | 回复区 1440×900 与 1080×700、深浅色实际检查；未变路径沿用历史布局结果 |
| AI 表格（1.3.2） | XLSX／UTF-8 CSV／TSV读取、hash、批量修改、公式／样式／工作表、逐次审批、冲突保护与编辑器同步 | 12辅助、15实际范围有效通过；模型回复用受控端点，文件和UI真实；按各次SHA记录。无公式引擎，复杂图片／图表／表对象等拒绝覆盖 |
| AI 图片（1.3.3） | 真实视觉与SHA、按序确定性变换、PNG／JPEG审批保存、源／目标hash与dirty保护、记录／历史和编辑器同步 | 26辅助、17实际范围及入口复核有效；原生／JSON真实image_url、尺寸／像素／文字、真实另存为、重启与跨项目加载验证。模型回复为受控端点；8MB／2000万像素／12操作，无生成式重绘 |
| Grok 普通对话 | 同一实际 EXE 的普通请求返回 OK | 不证明工具执行可用 |
| 公网 Grok 工具 | 尚未完成验证，被中转端 HTTP 426 拒绝 | 服务提示 Grok CLI 1.0.4 需升级至至少 1.0.13 |
| 默认连接与测试连接 | 旧默认组无 Grok，grok-4.7 曾返回 404；新测试密钥目录也无 Grok | 新密钥 11 个模型，普通对话与原生 echo 通过；测试后已移除隔离连接凭据 |

## 尚未对齐的运行能力

- MCP工具、资料／提示词和OAuth公共客户端授权已接通；旧SSE已在1.3.17完成本机真实服务验收；OAuth公网身份提供方兼容性尚未全面验证。公开GitHub SKILL插件目录已在1.3.18落地；通用第三方市场、依赖自动安装和MCP账号一键接通尚未提供。AI 浏览器与网页搜索已接入；任意桌面鼠标键盘、跨域框架、第三方扩展、WebMCP、截图批注和自动密码／上传／下载尚未提供。
- 定时任务只在 Scodex 进程存活时运行；完全退出后不执行，不是 Windows 服务。
- Git已提供本地状态、差异、暂存、提交、新分支、托管工作树，以及远端状态、Fetch、干净工作区快进 Pull、经确认的普通 Push；1.3.20新增丢弃、soft／mixed／hard reset、确认锁和权限／外部变化保护。1.3.19已实现GitHub PR列表／详情、草稿／正式创建、转为可审查和SHA绑定合并，9项服务、候选实际EXE9项及正式入口4项通过，API为本机兼容服务；完整跨任务协作仍未对齐。远端同步仅在本机 bare repository 验收，公网主机和认证尚未验证。
- 托管开发服务的当前项目范围已通过验收；完整跨任务协作及全部办公／图片 AI 生成链路仍未验收为 Codex 同等能力，有界AI表格与图片确定性编辑已落地，手动图片编辑继续保留；生成式重绘仍未接入。
- 实际界面交互由真实 EXE 的 CDP 驱动完成；不能宣称原生鼠标键盘验收通过。主 renderer 截图不包含原生 WebContentsView 图层，不将其当作完整 Windows 截图；网页图片由实际浏览器工具另行获取并视觉核对。
- 当前单一工作台连接沿用聚合模组 2，CLI 默认与模组 2 的独立配置保留；两路 Grok 的服务条件尚不齐备。

## 可定位证据

- [1.3.18公开技能：完整候选](../release/plugin-marketplace-20261030/candidate-ui-3/plugin-marketplace-ui-verification.json)、[最终候选](../release/plugin-marketplace-20261030/candidate-final-check-3/plugin-marketplace-ui-verification.json)、[正式入口](../release/plugin-marketplace-20261030/formal-entry/plugin-marketplace-ui-verification.json)、[最终界面](../release/plugin-marketplace-20261030/formal-entry/public-plugin-catalog.png)、[构建与身份](../release/plugin-marketplace-20261030/build-verification.json)、[增量审查](../release/plugin-marketplace-20261030/incremental-review.json)、[清理](../release/plugin-marketplace-20261030/runtime-cleanup.json)。最终SHA b47a97d0…；旧完整候选的模型／重启结果仅按未变实现复用，未声称在最终包重跑。
- [1.3.14远端同步：候选入口](../release/remote-git-20261025/evidence/candidate-ui-final/source-control-ui-verification.json)、[正式入口](../release/remote-git-20261025/evidence/formal-ui-final/source-control-ui-verification.json)、[正式界面](../release/remote-git-20261025/evidence/formal-ui-final/remote-sync.png)、[构建与包身份](../release/remote-git-20261025/build-verification.json)、[22项定向测试](../release/remote-git-20261025/targeted-tests.json)、[增量审查](../release/remote-git-20261025/incremental-review.json)、[快捷方式](../release/remote-git-20261025/shortcut-verification.json)、[视觉记录](../release/remote-git-20261025/evidence/visual-verification.json)、[清理状态](../release/remote-git-20261025/runtime-cleanup.json)。正式 EXE SHA `8481AC97…`；公网仓库、PR 创建／合并和原生鼠标未验收。
- [1.3.13候选入口](../release/draft-attachments-20261025/candidate-ui-final/cross-project-chats-ui-verification.json)、[正式入口](../release/draft-attachments-20261025/final-ui-2/cross-project-chats-ui-verification.json)、[收起态](../release/draft-attachments-20261025/final-ui-2/draft-attachments-collapsed.png)、[展开态](../release/draft-attachments-20261025/final-ui-2/draft-attachments-expanded.png)、[构建核验](../release/draft-attachments-20261025/build-verification.json)、[增量审查](../release/draft-attachments-20261025/incremental-review.json)、[清理记录](../release/draft-attachments-20261025/runtime-cleanup.json)。正式 EXE SHA `04ca72ef…`；快捷方式 SHA `A28ED175…`；测试实际覆盖附件、图片、工作台快照、移除与聊天切换复位，不等于本轮完整套件回归。
- [1.3.12实际 EXE 完整套件](../release/cross-project-chats-20261025/final-suite-2-20261025/cross-project-chats-ui-verification.json)、[正式入口复核](../release/cross-project-chats-20261025/final-suite-2-20261025/post-replacement-verification.json)、[收起态](../release/cross-project-chats-20261025/final-suite-2-20261025/message-attachments-collapsed.png)、[展开态](../release/cross-project-chats-20261025/final-suite-2-20261025/message-attachments-expanded.png)。正式 EXE SHA `d4c5b930…`，快捷方式 SHA `A84E9DF3…`；附件夹具已移入“手动删除”目录，原 Temp 路径不存在。报告中的 `restartCheckPending` 为遗留标记，独立重启场景实际通过。
- [1.3.11工具记录 UI](../release/activity-status-20261025/evidence/context-menu-ui-verification.json)、[正式入口 UI](../release/activity-status-20261025/post-replacement/context-menu-ui-verification.json)、[构建与包](../release/activity-status-20261025/evidence/build-verification.json)、[增量审查](../release/activity-status-20261025/evidence/incremental-review.json)、[快捷方式](../release/activity-status-20261025/evidence/shortcut-verification.json)、[正式入口截图](../release/activity-status-20261025/post-replacement/compact-activity.png)、[清理状态](../release/activity-status-20261025/runtime-cleanup.json)、[文档核验](../release/activity-status-20261025/evidence/document-verification.json)。正式 EXE SHA `d4e86811…`，快捷方式 SHA `0f18645d…`；夹具已移入项目“手动删除”目录，两个 Temp 源路径不存在。

- [1.3.10隐藏式记录历史](../release/context-attachments-20261025/context-menu-ui-verification.json)、[正式入口复核](../release/context-attachments-20261025/post-replacement/post-replacement-verification.json)、[展开截图](../release/context-attachments-20261025/compact-activity.png)。该版本首次交付紧凑记录布局；其版本文件继续保留。

- [1.3.9消息版本：实际功能记录](../release/message-revisions-20261025/revision-ui-verification.json)、[28辅助](../release/message-revisions-20261025/targeted-tests.json)、[正式入口复核](../release/message-revisions-20261025/post-replacement-verification.json)、[最终菜单](../release/message-revisions-20261025/workspace-menu-final.png)、[12文件增量审查](../release/message-revisions-20261025/incremental-review.json)、[构建／包](../release/message-revisions-20261025/build-verification.json)、[清理映射](../release/message-revisions-20261025/runtime-cleanup.json)。最终SHAc1545400…，两夹具已移入手动删除，原输入路径与现存位置分别记录。

- [1.3.8版本控制：8个实际EXE范围](../release/source-control-20261025/source-control-ui-verification.json)、[27项辅助](../release/source-control-20261025/targeted-tests.json)、[正式入口复核](../release/source-control-20261025/post-replacement-verification.json)、[最终界面](../release/source-control-20261025/source-control.png)、[视觉记录](../release/source-control-20261025/visual-verification.json)。SHA248e7320…为1.3.8交付程序；前5范围沿用SHAd5095bac…且未受最后访问修复影响，不冒称全部同包重跑。
- [1.3.8包一致性](../release/source-control-20261025/build-verification.json)、[17文件增量审查](../release/source-control-20261025/incremental-review.json)、[快捷方式](../release/source-control-20261025/shortcut-verification.json)、[清理实际残留](../release/source-control-20261025/runtime-cleanup.json)。Windows移动失败后一份部分迁移、一份未移动；确切现存路径已核对，不影响功能，不运行其中夹具。
- [1.3.7菜单：13个实际EXE范围](../release/context-menu-20261025/context-menu-ui-verification.json)、[29项辅助](../release/context-menu-20261025/targeted-tests.json)、[正式入口复核](../release/context-menu-20261025/post-replacement-verification.json)、[最终菜单](../release/context-menu-20261025/context-menu.png)、[视觉核验](../release/context-menu-20261025/visual-verification.json)。前5项初版SHA结果在renderer修复后按未受影响范围复用，后8项为最新SHA4242973e…，未声称同一二进制全部重跑。
- [1.3.7包一致性](../release/context-menu-20261025/build-verification.json)、[18文件增量审查](../release/context-menu-20261025/incremental-review.json)、[清理映射](../release/context-menu-20261025/runtime-cleanup.json)。最新驱动只补焦点／布局就绪及缩放关闭再打开的实际边界；不改已验收产品。

- [1.3.6并行：10实际范围](../release/concurrent-chats-20261025/concurrent-chats-ui-verification.json)、[37辅助](../release/concurrent-chats-20261025/targeted-tests.json)、[入口](../release/concurrent-chats-20261025/post-replacement-verification.json)、[增量审查](../release/concurrent-chats-20261025/incremental-review.json)；1.3.5→1.3.6，SHA656d0cc2…。

- [1.3.5 OAuth：12实际范围](../release/mcp-oauth-20261025/mcp-oauth-ui-verification.json)、[30辅助](../release/mcp-oauth-20261025/targeted-tests.json)、[最终入口](../release/mcp-oauth-20261025/post-replacement-verification.json)、[界面](../release/mcp-oauth-20261025/mcp-oauth-workbench.png)、[增量审查](../release/mcp-oauth-20261025/incremental-review.json)；1.3.4→1.3.5，12范围均为SHA5f56bdcf…。

- [1.3.4 MCP资料：14功能范围](../release/mcp-context-20261025/mcp-context-ui-verification.json)、[资料预览](../release/mcp-context-20261025/mcp-context-browser.png)、[最终入口](../release/mcp-context-20261025/post-replacement-verification.json)、[增量审查](../release/mcp-context-20261025/incremental-review.json)；1.3.3→1.3.4末位加1，报告保留各范围真实SHA。
- [1.3.3图片：17实际范围](../release/image-runtime-20261025/image-ui-verification.json)、[最终图片工作台](../release/image-runtime-20261025/image-workbench.png)、[真实输出](../release/image-runtime-20261025/pixel-evidence.json)、[包内一致性](../release/image-runtime-20261025/build-verification.json)、[增量审查](../release/image-runtime-20261025/incremental-review.json)、[入口替换后复核](../release/image-runtime-20261025/post-replacement-verification.json)；1.3.2→1.3.3按约定末位加1，范围保留真实SHA。

- [1.3.2表格：15实际范围](../release/spreadsheet-runtime-20261025/spreadsheet-ui-verification.json)、[最终界面](../release/spreadsheet-runtime-20261025/spreadsheet-workbench.png)、[入口替换后复核](../release/spreadsheet-runtime-20261025/post-replacement-verification.json)；1.3.1→1.3.2按用户约定末位加1。

- [1.3.1 回复区实际 EXE：10 范围](../release/conversation-layout-20261025/conversation-ui-verification.json)、[最终界面](../release/conversation-layout-20261025/conversation-layout.png)、[替换后复核](../release/conversation-layout-20261025/post-replacement-verification.json)
- [服务：14 个实际范围](../release/dev-services-20261025/services-ui-verification.json)、[真实模型服务链路](../release/dev-services-20261025/live-services-verification.json)；服务截图助手历史失败与本版入口补验分别记录。
- [最终包一致性](../release/conversation-layout-20261025/build-verification.json)、[本次增量审查](../release/conversation-layout-20261025/incremental-review.json)、[入口与版本](../release/conversation-layout-20261025/shortcut-verification.json)
- 1.3.0 → 1.3.1 为用户确认的正式版本映射，以后末位加 1；服务候选 1.4.0 不作为正式版本。

- [1.3.0 浏览器实际 EXE：17 个范围](../release/browser-runtime-20261024/browser-ui-verification.json)、[真实中转：3 条链路](../release/browser-runtime-20261024/live-relay-verification.json)
- [新密钥模型与工具探测](../release/browser-runtime-20261024/relay-key-probe.json)、[实际画布截图](../release/browser-runtime-20261024/live-webpage-visual-proof.jpg)
- [1.3.0 包一致性](../release/browser-runtime-20261024/build-verification.json)、[增量审查](../release/browser-runtime-20261024/incremental-review.json)、[快捷方式](../release/browser-runtime-20261024/shortcut-verification.json)
- 17 项中的首五范围使用初始功能包；之后仅修复 DOM 异常传播，剩余范围和真实中转使用最终包。报告保留逐项 SHA；未宣称同一二进制完整重跑。

- [1.2.0 MCP 实际 EXE 验收](../release/mcp-runtime-20261024/mcp-ui-verification.json)、[最终插件页面](../release/mcp-runtime-20261024/mcp-connections.png)
- [1.2.0 包一致性](../release/mcp-runtime-20261024/build-verification.json)、[1.2.0 增量审查](../release/mcp-runtime-20261024/incremental-review.json)

- [实际 EXE 验收：16 个范围](../release/agent-workflow-20261024/agent-workflow-ui-verification.json)
- [真实 Grok 工具阻塞](../release/agent-workflow-20261024/real-relay-verification.json)、[普通对话对照](../release/agent-workflow-20261024/real-relay-diagnostic.json)、[只读工具对照](../release/agent-workflow-20261024/real-relay-read-diagnostic.json)
- [默认连接模型目录](../release/agent-workflow-20261024/default-model-catalog.json)
- [包一致性](../release/agent-workflow-20261024/build-verification.json)、[增量审查](../release/agent-workflow-20261024/incremental-review.json)、[最终界面](../release/agent-workflow-20261024/agent-workflow.png)
- [项目交接](HANDOFF.md) 与 [测试交接](TEST_HANDOFF.md)
