# 项目交接

## 1.3.66 自动接力与指令/技能执行（本地交付验证通过，仓库上传待完成）

- 当前状态：产品实现、最终候选构建与相关实际EXE验收完成；根EXE快捷启动.lnk已原子切至final3，快捷入口实际验收3/3通过，身份/接力回交/最终状态及清理正常。源码及程序未上传。用户已授权本地更新和上传，不再等待通知。
- 版本/构建：1.3.65→1.3.66，沿用既定SemVer补丁映射；npm run build及本地Electron45目录打包，最终release/Scodex-Workbench-1.3.66-final3/win-unpacked/Scodex工作台.exe，应用/PE1.3.66。最终8源码/3dist/9资源一致，未变renderer结果复用。
- 身份：EXE SHA256 928d3583568a829d7fdb59651890bfe6ce3684e3867cdc7fb47b60a825846956；ASAR 5fefead5e3eb211ea2ae6628448ccd14d66e1e74bf7d80e9046d4c1842574dce；根快捷方式 b2a7c9451c35a8f8c1e51ddab9b1246a791223fab53e70abeefc9600905b20e2。

| 需求/范围 | 已实施行为 | 验证与状态 |
| --- | --- | --- |
| 接力配置与执行 | 开关/等级可保存，连续两次同类工具失败或专用工具求助，选择已配置更强不同模型，答复后交模式一实际完善 | 候选实际EXE按范围通过；快捷入口3/3通过 |
| 连续性与边界 | 同聊天/请求/工具结果，成功操作不重放；手动优先、取消停止，无更强候选不升级；无数字次数上限、同问题去重 | 三起始模式、两次独立接力、取消/手动/外部故障/鉴权边界有效 |
| AGENTS约束 | 非空override优先、空文件回退，规则变化阻止执行，副作用前披露目录规则 | 初始及目录工具实际读写/变化拦截通过 |
| Skill与学习 | 元信息可见、正文/引用按需读；脚本先读后用现有权限执行；显式加密记忆重启恢复并作为user资料注入 | memory-proof-ui 3/3、skill-script-ui 3/3通过 |

- 本轮修复与审查：合并error/reason/output排除输出中HTTP401等外部失败；最后异步检查及预检异常均尊重新手动serial。18文件增量审查、语法/UTF8无BOM通过，无剩余本轮高置信度缺陷。基线与原字节保存在release/auto-handoff-1.3.66/baseline.json及baseline/；增量范围以incremental-review.json为准。
- 验证限制：逻辑57/57、追加失败形状12/12、Skill22/22通过；指令/工具55项54通过，既有fullAccess断言期待不存在.env被保护、基线同样ENOENT失败，未修改无关策略或弱化断言。多轮failed报告只复用其有效场景，恢复原因及证据见测试交接。
- 分发资产：release/auto-handoff-1.3.66/assets-final3包含完整80文件ZIP和两清单；ZIP252753945字节，SHA9ab13f48c07095742fd210fb5ba7f0b47444503d6d609320db5494db3cda9ad6，80/80逐流路径/大小/SHA一致。旧中间包不得用于上传。
- 回滚：入口备份release/auto-handoff-1.3.66/EXE快捷启动.pre-replace.lnk，SHA1e242367415a57ef4f3c3fff172d6db47300ca15d6d0b0dd79072d35260a7103；复制回根可恢复保留的1.3.65完整目录。原子替换保留图标/参数，不改用户数据，不结束用户进程；交付状态见delivery.json。
- 仓库待办：沿用release/codex-alignment-1.3.64/source-repo，基线6bdb971adfcd83043e8beb4d0ea07bce9eed8c71，上传明确的代码/版本/测试及相关文档；完整程序发布v1.3.66 Release，上传后核对标签提交/资产大小和digest/API-CDN。当前未上传。
- 清理：全部有限构建/测试/压缩已结束，测试进程及隔离fixture已清理；正式final3、1.3.65回滚、必要证据/基线保留，自动审批拒绝删除后未重试，3个旧候选和旧ZIP/两清单已逐项移至手动删除/auto-handoff-1.3.66，原路径不存在，待人工删除；精确映射及原因见cleanup.json，不影响正式程序。
- 对标边界：基于公开文档与实际程序证据，不承诺未公开内部实现100%等价；保留现有祖先规则继承策略，未导入project_doc_fallback_filenames或官方云服务。学习记忆不是模型训练，公网模型质量/费用未验证；official-comparison.json记录公开文档来源。
- 当前待办：源码与Release上传及最终远端核验；本地交付已验证，尚不能标记全部上传完成。[验收摘要](verification/1.3.66.json)、[最终界面](verification/auto-handoff-1.3.66.png)。使用Skill：requirement-understanding、code-write-review、openai-docs；无Agent。

## 1.3.65 消息文件直达（已完成，源码已上传）

- 程序上传：已验收1.3.65完整80文件目录已发布为[完整Windows ZIP及校验清单](https://github.com/song123-jian/-0/releases/tag/v1.3.65)，Release 445155585，v1.3.65标签指向923348b。3资产uploaded、服务器大小/digest一致；README已提供正式下载地址及完整解压说明。不包含用户配置/聊天；未重建未变程序或覆盖旧Release。[分发摘要](verification/1.3.65-distribution.json)。
- 分发验证：ZIP257608314字节，SHA727463b54ec0cc45ff801ebfb121b03dce9f755123f287b6ddf3104737572a1a；.NET同步流80/80文件长度/SHA一致，无缺失/重复/多余项。匿名资产API→CDN ZIP HEAD=200且长度正确，两清单GET=200且字节/SHA与本地一致。直接github.com下载连接重置，尚未完成该直链验证；未将CDN替代结果外推为直链已验证。
- 恢复与限制：yauzl异步未完成不作通过，改同步校验；Node fetch上传失败后curl HTTP/1.1成功；草稿untagged地址404更正为v1.3.65。失败及成功证据保留release/program-upload-1.3.65，不重传资产。当前仅分发说明和交接增量，无产品代码变化；源码库文档同步由documentation-api-upload.json记录远端回读。
- 后续需求排队：用户已授权三模式能力不足自动交更强已配置模型、完成后交回模式一完善再继续；尚未调查/实施。当前上传文档门禁完成后，再复用1.3.59同聊天运行中切换设计，限定触发、能力顺序和循环上限。
- 当前状态：根[EXE快捷启动](../EXE快捷启动.lnk)已原子切至[1.3.65完整程序](../release/Scodex-Workbench-1.3.65/win-unpacked/Scodex工作台.exe)，实际入口启动/标签/文件打开3项通过；图标和用户数据保留，本轮13个增量文件已上传main并回读确认。
- 主要变更：本地Markdown命名链接保留“快捷入口”等名称，加文件图标、完整路径title及可访问名称；原始路径仍简写文件名。点击复用现有预览、Explorer定位与目录浏览，不新增依赖或扩大授权。
- 版本/身份：1.3.64→1.3.65，沿用SemVer补丁映射，同轮修复不再递增；PE版本1.3.65。EXE 8b251d94a8484651bb91bdebdae63a40c97443b4413ac6d544535155e0a77ec1；ASAR 03a5038c52c0d5915441ac6fec17e2141ba81b37ed19af3ea5f8b7d058f08c6c；lnk 1e242367415a57ef4f3c3fff172d6db47300ca15d6d0b0dd79072d35260a7103。候选与最终相同；[交付清单](../release/file-links-1.3.65/delivery.json)、[验收摘要](verification/1.3.65.json)。
- 验证/纠正：逻辑13/13、renderer及本地Electron45完整构建退出0、4包内容/9资源一致；candidate-ui前5项有效。原600px布局因隐藏零尺寸元素产生假阳性，不采用；修正驱动后layout-ui 3/3通过，600/1280px下6个链接可见、非零且在边界内。[最终聊天视图](verification/message-links-1.3.65.png)已查看，链接呈现正常。
- 增量审查：baseline.json精确旧字节与本轮8份代码/测试/版本差异及直接引用已审查，布局验收断言遗漏已修正，无剩余高置信度问题；[审查记录](../release/file-links-1.3.65/incremental-review.json)。
- 回滚/清理：将[原入口备份](../release/file-links-1.3.65/EXE快捷启动.pre-replace.lnk)复制回根入口，可返回保留的1.3.64-final，备份SHA 2283a4246e159c76869e55c46e9f229c4ad69a964aa94d2c7d7ff06d86a511a1；新旧完整目录均保留。3轮测试进程、自建Explorer窗口退出，fixture清理成功；无本轮临时残留或常驻服务。
- 仓库状态：13份消息文件直达增量源码已上传，源码提交[d066005](https://github.com/song123-jian/-0/commit/d066005f17ac191d5b5e9016926dce3907f50d28)，随后文档提交使main到923348b；本次程序分发及5份文档增量基于该点同步，精确提交与远端核验见本地release/program-upload-1.3.65/documentation-api-upload.json。排除EXE/LNK、用户配置/聊天、release/dist/依赖；完整程序使用上述Release资产。
- 上传恢复：初次13个blob和tree全部一致，但辅助脚本去掉message末尾换行，导致commit SHA不同；更新main前已拦截。精确复算后仅以原始message重建commit，复用已上传对象，SHA完全一致且非强制更新/远端回读通过；程序验证不受影响。source-api-upload.json、upload-failure-analysis.json及source-recovery-api-upload.json保留证据。
- 限制/决策：不写真实用户数据，不结束用户进程；仅本地链接和所述视口验收，不外推整个系统或Codex等价。旧1.3.64上下文/设置及1.3.63队列未变结果继续有效。轻量重构评估无有证据且收益足以追加的候选。文档长终端写入被策略拒绝且未落盘，已改用结构化文件工具。
- 使用Skill：requirement-understanding95、code-write-review94；无Agent。

| 已完成需求 | 状态 | 证据 |
| --- | --- | --- |
| 命名链接、图标、完整路径悬停 | 通过 | candidate-ui及shortcut-ui |
| 文件/快捷方式/目录、键盘、错误和授权边界 | 通过 | candidate-ui前5项、shortcut-ui 3/3 |
| 可见链接窄屏布局、候选与最终入口 | 通过 | layout-ui 3/3、包核验及交付清单 |
| 增量源码上传 | 已完成 | 13文件，源码提交d066005及API远端回读 |
| 完整程序公开发布 | 已发布 | Release445155585；80文件校验、3资产digest及匿名CDN下载响应通过，直链网络限制见分发摘要 |

## 1.3.64 Codex上下文接续与模型布局（已完成）

- 当前状态：根[EXE快捷启动](../EXE快捷启动.lnk)已原子切至[1.3.64完整程序](../release/Scodex-Workbench-1.3.64-final/win-unpacked/Scodex工作台.exe)，图标与用户数据保留；实际根入口启动/聊天2项通过。累计源码已推送既定仓库main，远端回读确认源码提交0e2811ff478c71eaf693e9d7e35b0c91f164c339；最终上传状态随本次文档提交同步。
- 版本/构建：1.3.63→1.3.64，沿用既有SemVer补丁映射；同轮恢复和CSS重建不再次递增。npm run build及本地Electron45目录构建均退出0；PE版本1.3.64 / 1.3.64.0，8份包内容和9项资源核对通过。[交付清单](../release/codex-alignment-1.3.64/delivery.json)、[可随源码阅读的验收摘要](verification/1.3.64.json)。
- 最终身份：EXE c785cb63e5aaa535905fd897b34f50593321cef39729b728d136c8dc3f109c9b；ASAR 78cc245514ee35c1c7e4254ffb6eafb60850128804f31a91da4a4aa564c939d4；lnk 2283a4246e159c76869e55c46e9f229c4ad69a964aa94d2c7d7ff06d86a511a1。
- 范围：electron/context-compaction.cjs新增有界分批模型摘要、源内容SHA校验与恢复；main/runtime接入并保留系统/当前输入；conversations保存摘要和估算；聊天支持/compact、按钮、摘要查看及上下文状态；失败/取消保留原文，失败重试仍走摘要。模型与连接按模型一/二/三、通用设置、诊断分组，折叠服务信息/高级说明、修复密钥按钮重叠并固定保存栏；保留角色草稿与独立保存。
- 关键决策：配置窗口时按本地估算85%触发语义摘要，留空不假定服务容量，既有服务超限容量保护继续有效；/compact可手动执行。摘要作为user角色历史资料，当前系统指令/输入和完整聊天不被摘要覆盖；恢复须匹配原文SHA，编辑历史或分支后失效。摘要请求不附工具，不能扩大原授权。85%为本机策略，不声称是Codex官方阈值。
- 验证/审查：有效定向逻辑59项（最终运行时/摘要32项，未变27项复用）；实际候选自动/手动/重开/编辑/失败取消有效，final-retry-ui 2/2、final-layout-ui 3/3、shortcut-ui 2/2。15份当前代码/版本差异已审查，旧默认策略回归及/compact重试分类问题均修复，无剩余高置信度问题。[审查](../release/codex-alignment-1.3.64/incremental-review.json)。
- 回滚：将[原入口备份](../release/codex-alignment-1.3.64/EXE快捷启动.pre-replace.lnk)复制回根入口，可返回保留的1.3.63-capacity完整目录；备份SHA 583856a3e04c1791a6b2d8ff014e4e9104d210dd2b257f0cfbde4224f422de9d。只恢复入口，不替换配置/聊天；新旧程序都要保留完整win-unpacked目录。不结束用户进程。
- 清理/限制：5轮测试fixture已删除、测试进程退出，无新增常驻服务。首轮编辑驱动旧弹窗假设失效，改为当前行内编辑后通过；首轮整轮failed保留，只复用独立有效项。包清单字节校验误差已改为运行身份/依赖结构校验，开发字段由打包器移除。模型HTTP/凭据由loopback替代，公网语义质量/费用/兼容性未验证；未实现Responses远端压缩、官方账号云会话，不宣称完全等价。原队列20条/计划等未变结果复用。
- 源码仓库状态：已上传 https://github.com/song123-jian/-0 的main；源码提交[0e2811f](https://github.com/song123-jian/-0/commit/0e2811ff478c71eaf693e9d7e35b0c91f164c339)，基线b18db09f7f8a66f3bae7169d6501a2423a9cb74a。累计54个文件（22新增、32修改）涵盖源码、测试及文档；push退出0，git ls-remote回读相同。排除配置/聊天、EXE、构建缓存；3份已跟踪运行时ZIP与远端相同。凭据模式检查仅命中一个安全单测标记（无密钥内容），已定向核对。本轮未发布GitHub Release，公开下载安装仍为历史1.3.31；本次上传状态另随文档提交同步。
- 轻量重构评估：基于本轮差异和验收，无有证据且收益足够的额外重构，不扩展范围。
- 使用Skill：requirement-understanding95（需求/边界）、code-write-review94（增量与编码）、openai-docs95（官方压缩能力对照）；未调用Agent。

| 已完成需求 | 状态 | 证据 |
| --- | --- | --- |
| 自动/手动摘要、状态、保存恢复和历史失效 | 本地通过 | 验收摘要、候选UI及final-retry-ui |
| 模型配置分组、草稿/独立保存、密钥与固定底栏布局 | 通过 | final-layout-ui及[最终视图](verification/model-connection-1.3.64.png) |
| 1.3.64完整构建、根入口更新和真实启动 | 通过 | build-verification-final、shortcut-ui与交付清单 |
| 所有累计增量源码上传 | 完成 | 54文件，源码提交0e2811f，push及远端回读通过；最终文档另行同步 |

- 上传恢复：源码推送成功；后续文档Git HTTPS先连接重置、后单连接HTTP/1.1超时，API只读确认main仍为源码提交。影响仅最终4份文档上传；改用已可达的GitHub REST上传文档Git对象，核对blob/tree/commit哈希一致后非强制更新main，并用API回读；程序与有效验收结果保持，失败证据保存在本地upload-verification.json。

## 1.3.63 工作流与会话能力补齐（已完成）

- 当前状态：本轮队列/计划能力及容量收尾已完成；根[EXE快捷启动](../EXE快捷启动.lnk)已原子切至[1.3.63完整程序](../release/Scodex-Workbench-1.3.63-capacity/win-unpacked/Scodex工作台.exe)，工作目录正确、自定义图标保持。完整Electron目录须一并保留。
- 实际变更：src/workbench.jsx 的 enqueueMessage 把同会话正在发送的队列项计入20条上限，避免失败恢复形成21条并在保存时丢尾项；tests/conversation-workflow-ui.cjs 新增显式候选EXE、recovery范围和满额/失败/重开断言。原队列编辑、排序、暂停、FIFO、持久化、分支隔离及同会话计划转执行保留。
- 版本与基线：上一正式1.3.62，本轮1.3.63，同轮恢复修复重建不再次递增。原始基线为 baseline.json；恢复基线为 capacity-baseline.json，均位于 release/workflow-session-1.3.63。容量修复前两份源码已按上次审查SHA精确还原并保存，见[容量增量审查](../release/workflow-session-1.3.63/capacity-incremental-review.json)。
- 构建与验收：沿用本地Electron45 x64独立打包，58332退出0；当前renderer构建1839模块成功。9项必要资源、应用版本及6份包内容一致；真实候选recovery 4/4、最终根快捷启动2/2通过，有限会话67514/1176均退出0。见[构建核验](../release/workflow-session-1.3.63/build-verification.json)、[候选恢复验收](../release/workflow-session-1.3.63/capacity-ui/conversation-workflow-ui.json)、[最终入口验收](../release/workflow-session-1.3.63/capacity-shortcut-ui/composer-model-modes-ui.json)。
- 最终身份：EXE SHA-256 72dbb9250cb4e5413e4e561aa64d0a4866140afb1e7944e5c411f2a5e165bdf2；ASAR SHA-256 eacdbf7a756c7b2e6acd9cea9481c1cc4da7ee61d8ef292266482cc2fa057dd3；根快捷方式 SHA-256 583856a3e04c1791a6b2d8ff014e4e9104d210dd2b257f0cfbde4224f422de9d。入口最终文件与验收候选相同，见[交付清单](../release/workflow-session-1.3.63/capacity-delivery-verification.json)。
- 回滚：恢复 release/workflow-session-1.3.63/EXE快捷启动.pre-capacity.lnk 到根入口，可回到保留的旧1.3.63完整目录；备份SHA 01679705fe186225a7176576a0082791e0041ac84a41a5abbfa92f27a0819422。此前1.3.62完整目录及 EXE快捷启动.pre-replace.lnk 继续保留。只恢复入口，不改用户配置/聊天，也不结束用户进程。
- 清理：本次两轮测试进程均已退出，fixture原路径核对不存在，无常驻测试服务；中间候选快捷方式已随原子替换消耗。历史遗留1个无效快捷方式仍在 release/workflow-session-1.3.63/手动删除/EXE快捷启动.tmp-5fc2368dbec6429a8eaeda3f14b696e8.lnk，旧记录未保留确切原路径/拒绝原因，本轮未重复删除；可手动删除该精确文件，不影响运行。旧原子替换.bak保留作为回滚证据。准确状态见交付清单。
- 有效结果复用：原逻辑7/7、旧候选11/11中的计划/分支/布局等未变范围继续有效；本次不重复全项目测试。1280×780最终恢复截图已查看：预期HTTP503提示、20条已暂停和保留草稿显示正确，未见布局异常。
- 约束/限制：隔离profile/项目、loopback模型服务，未写真实配置或聊天、未发布远端或更新其他安装目录。公网模型/云会话/账号服务、原生关闭及文件选择器未验证；此前官方功能页访问403的历史限制不构成等价证据。
- 审查与后续：容量增量差异及直接影响已审查，未发现剩余高置信度问题；轻量重构评估无有证据且收益足以追加的候选，不扩写范围。当前授权交付无功能待办；仅有上述历史手动清理项。
- 使用Skill：requirement-understanding95（30/20/16/15/9/5，恢复需求边界）、code-write-review94（30/20/15/15/9/5，精确差异与定向验证）；未调用Agent。

| 已完成需求 | 状态 | 证据 |
| --- | --- | --- |
| 活动队列项计入20条容量，满额保留草稿 | 通过 | capacity-ui报告的容量场景 |
| 派发错误/取消恢复及手动继续，满额恢复20条且重开暂停 | 通过 | 实际候选recovery 4/4 |
| 候选重建、根快捷入口切换及实际运行 | 完成 | build-verification、capacity-shortcut-ui、capacity-delivery-verification |

## 1.3.62 聊天工具入口补充（已完成）

- 目标：保留现有菜单，补入浏览器、集成终端、运行与预览，按上下文→工具→任务与创作→插件与技能排列；复用现有 `runToolAction`，不自动启动服务。
- 差异范围：`composer-tools.jsx`新增三个入口和工具分组，`workbench.jsx`仅接现有回调，`composer-checks.cjs`补充实际UI验收；package/lock由1.3.61递增至1.3.62，沿用既有SemVer补丁映射，未改依赖或用户配置。
- 构建：`npm run build`通过；`npx electron-builder --win --dir --x64 --config.directories.output=release/Scodex-Workbench-1.3.62 --config.electronDist=node_modules/electron/dist --publish never`退出0。完整目录为`release/Scodex-Workbench-1.3.62/win-unpacked`，EXE文件版本1.3.62、产品版本1.3.62.0。默认下载构建曾中断/取消，改用同版本本地Electron45成功；辅助ASAR校验的Windows分隔符错误已修正，未改产品。
- 候选验收：包版本、Electron必要资源及dist三文件逐字节一致性通过，见[包身份](../release/composer-menu-1.3.62/build-verification.json)。实际候选Composer smoke退出0；新入口、聊天保留、菜单顺序、原功能、权限和1064×660/20px布局通过，[日志](../release/composer-menu-1.3.62/composer-smoke-final.log)及[截图](../release/Scodex-Workbench-1.3.62/win-unpacked/workbench-composer.png)已查看。当前设备、页面、视口和数据状态下无可见错误。
- 增量审查：五个本轮文件已按修改前SHA精确还原核对基线，未发现需修复问题；无Git，不扩大检查历史或无关改动。见[审查](../release/composer-menu-1.3.62/incremental-review.json)。
- 正式入口：根[EXE快捷启动](../EXE快捷启动.lnk)已原子切换至验收通过的1.3.62完整目录，原图标保留。替换后哈希、工作目录、版本、资源、实际快捷启动UI往返2/2通过，详见[交付核验](../release/composer-menu-1.3.62/delivery-verification.json)与[快捷入口UI](../release/composer-menu-1.3.62/shortcut-ui/composer-model-modes-ui.json)。
- 回滚：旧1.3.61完整目录保留；根快捷方式备份为`release/composer-menu-1.3.62/EXE快捷启动.pre-replace.lnk`，SHA-256 `A7D8A9D4A3B6F309B3DB968F8689E076F3C254BD80695F01068848DE084EEBC1`。需要回滚时将该备份复制回根快捷方式；只恢复入口，不改真实聊天/配置。
- 清理与限制：测试进程已退出、隔离fixture已删除，中间快捷方式已随原子替换消耗，保留完整交付、证据及回滚文件，无本轮待手动清理项。原生窗口关闭/关闭时草稿刷新、公网模型、原生文件选择器未在本轮验证；loopback回复仅验证本地真实UI/IPC/存储链路，不代表上游Codex或公网插件100%等价。
- 轻量重构评估：入口复用已有工具路由，未引入额外状态或新依赖；现有差异和验收证据未发现有必要追加的重构，不扩大范围。
- Skill评估：requirement-understanding 95（30/20/16/15/9/5，需求边界与保留要求）；frontend-implementation 93（29/20/15/15/9/5，复用React交互与实际UI验收）；code-write-review 94（30/20/15/15/9/5，可核验基线及编码/引用回归检查）。未调用Agent。

| 已完成需求 | 状态 | 证据 |
| --- | --- | --- |
| 菜单补齐浏览器、终端、运行与预览并调整分组，保留全部原功能 | 完成 | Composer实际EXE验收、增量审查及截图 |
| 完整1.3.62程序与根快捷入口更新 | 完成 | 构建/交付核验、快捷入口真实UI往返2/2、旧入口备份 |

## 1.3.61 聊天输入工具菜单补充（已完成）

- 目标与边界：按用户“自己补充”整理聊天输入框的“添加工具和上下文”菜单；只调整分组并补充入口/状态信息，不移除现有文件、图片、工作台快照、目标、计划、绘图、已安装技能、全部技能和搜索能力。不是 Codex 像素级复制，也不承诺上游插件等价。
- 实现：`src/components/composer-tools.jsx` 增加“上下文”“任务与创作”分组、目标执行状态/轮数提示和插件中心入口；保留原入口及选择、搜索行为。`src/styles.css` 增加分组标题样式。Composer 验收驱动适配当前真实导航、附件披露、技能/目标状态和路由；smoke 增加仅用于 composer scope 的原生关闭跳过开关，其他 scope 默认行为不变。
- 版本与产物：1.3.60→1.3.61，沿用既有 SemVer 补丁映射。完整程序为[Scodex工作台.exe](../release/Scodex-Workbench-1.3.61/win-unpacked/Scodex工作台.exe)，必须保留同目录 Electron 运行资源。EXE SHA-256 `B13BFE603C1CC256A6C9464CDBA338930D2F6B2D2A5A8351E35D72849B6FC3E2`；ASAR SHA-256 `7B1105E4A6290CAAE6BEDD1B62D16562793981165F92D33EC7360E405A92D1EF`。ASAR 内版本为 1.3.61，renderer JS/CSS 与当前 dist 字节一致。
- 根[EXE快捷启动](../EXE快捷启动.lnk)现指向 1.3.61 完整目录，工作目录一致，原 `EXE快捷启动.ico` 图标保留；快捷方式 SHA-256 `A7D8A9D4A3B6F309B3DB968F8689E076F3C254BD80695F01068848DE084EEBC1`。回滚备份[旧快捷方式](../release/composer-menu-1.3.61/EXE快捷启动.pre-replace.lnk)与原 1.3.60 入口哈希一致：`566E5ADD9AFBBEC098928DA494D7EF508F83BB91039363A72FF77959005475B7`；1.3.60 完整目录保留。
- 验收：候选实际 UI 的菜单内容、滚动、键盘与关闭、计划状态、目标保存/重开/状态、附件/文件夹/搜索、技能、权限拒绝、插件和技能路由、字体及 1064×660 布局通过；随后实际从根快捷方式启动 1.3.61 并经 UI 发送/收取 loopback fixture 回复。报告见[快捷入口验收](../release/composer-menu-1.3.61/shortcut-ui/composer-model-modes-ui.json)，完整 Composer 验收日志及截图位于 1.3.61 目录和同名 release 验收目录。
- 收尾复测（2026-11-12）：增量审查发现旧 `.goal-chip` 断言检查了当前界面不存在的元素，不能证明新聊天不继承旧目标；改为检查新聊天菜单中目标项显示“设置本次对话目标”。`node --check tests/composer-checks.cjs` 通过；限定 composer scope 在 1.3.61 候选 EXE 上复测退出码 0，记录见[复测日志](../release/composer-menu-1.3.61/composer-smoke-final-rerun-20261112.log)。候选包未变，本次只改验收驱动。
- 审查与限制：当前目录无 Git 元数据；定向审查仅覆盖 Composer 组件、分组样式、相关验收驱动及其对照的已打包 1.3.60→1.3.61 renderer，本次还人工复核了新聊天目标断言。测试驱动中途修正的旧选择器/持久化预期不是产品功能失败。候选没有可用原生窗口句柄，本轮 Composer smoke 明确跳过原生关闭与关闭时草稿刷新；这两项仍未验证。模型由 loopback fixture 替代，不代表公网模型验证。未发布 GitHub 或更改用户配置/真实聊天。
- 当前状态：根快捷入口已更新并经实际 UI 启动验收；工作区、快捷备份、候选、截图及测试证据已保留。使用 Skill：requirement-understanding、frontend-implementation、code-write-review。

## 1.3.60 绘图功能补齐（已完成）

- 当前目标与范围：补齐聊天交互图表、有限JSON状态保存、用户确认后追问及接手活动图表兼容；不宣称与 Codex 或 C:/Users/宋建建/.codex 插件100%等价。目标、计划和插件的其他功能未在本轮扩大重写。
- 当前状态：1.3.59→1.3.60，沿用既有SemVer补丁递增映射；失败重建不再加版本。根[EXE快捷启动](../EXE快捷启动.lnk)已指向[1.3.60完整程序](../release/Scodex-Workbench-1.3.60/win-unpacked/Scodex工作台.exe)，工作目录及用户自定义图标已回读，实际快捷启动验收通过。
- 实现：visualize_render工具接入运行时；普通/接手图表活动持久化；scodex-chart有界内存文档、随机URL、主frame专用注册/释放IPC、nonce CSP与opaque沙箱；状态桥接与追问确认；父界面刷新不取消待保存状态。
- 安全边界：图表无preload、不能读取宿主、不能联网/提交表单/加载外部资源。HTTP/文件子文档由请求白名单拦截；Electron未报告的data文档替换由宿主恢复一次，再次异常停止图表。不是所有导航都在发生前阻止，不能作此承诺。

| 已完成需求 | 验证与结果 |
| --- | --- |
| 图表绘制与隔离 | 真实EXE绘制31610个非透明画布像素；origin=null、宿主读取SecurityError、无本地接口 |
| 状态保存/重开 | Q1→Q2保存，无iframe重载；250ms保存窗口内切换模式仍保存；重开恢复Q2 |
| 追问确认与共享聊天 | 确认前无新增模型请求，确认后仅加1次请求，沿用同一聊天 |
| 接手图表兼容 | 实际保存takeover_visualize_render活动后重开显示及恢复状态；本轮未把完整自动接手编排当成新验证 |
| 布局与预览兼容 | 600×800、1280×780图表完整可见且无横向溢出；原办公srcdoc加载路径有效 |
| 完整程序与快捷启动 | 最终包9份源码/renderer字节匹配，必要Electron及工作区运行资源齐全；真实快捷启动和选定模式文件/命令执行2/2通过 |

- 有效证据：[交付清单与增量审查](../release/visualization-1.3.60/delivery.json)、[最终状态/追问工作流](../release/visualization-1.3.60/ui-state-final/visualization-ui-verification.json)9/9、[最终布局](../release/visualization-1.3.60/ui-delivery-view/visualization-ui-verification.json)1/1、[真实快捷入口](../release/visualization-1.3.60/shortcut-ui/team-executor-ui.json)2/2。最终截图已查看：当前设备、页面、1280×780视口和数据状态下无可见错误。
- 构建：npm run build及本机Electron45 Windows x64完整目录打包均退出0；命令见交付清单。最终EXE SHA256 3ffdf1b5bdd1aabbe74a18271b1866bf644d7c5fd4cfa88721ba95cc19530aa6，ASAR 543cb0c31f9d378dd5750161aafaa8f37d461b958df8aa542e0b8c8e5af73daa。17份相关文本UTF-8无BOM；版本和关键包内容一致。
- 增量审查：仅图表新增代码、直接集成、相关测试及版本元数据；旧ASAR和1.3.59有效审查记录作为基线，workbench去除本轮增量后哈希与旧记录相同。发现并修复CSP继承、导航事件覆盖和状态回调生命周期问题；最终范围内无剩余高置信度缺陷。无全项目/全历史审计。
- 失败记录保留：ui-r3为data继承宿主CSP；ui-explicit-nav/ui-native-navigation确认导航事件不覆盖；ui-recovery验证有界恢复；ui-acceptance为夹具聊天ID问题；ui-stable-chat第11项0宽高布局是假阳性，不作为有效结果。后续布局专测和最终程序工作流已取得真实通过证据。
- 回滚：[旧入口备份](../release/visualization-1.3.60/EXE快捷启动.pre-replace.lnk) SHA256 bed096119ecfcdeb51f1984d3338aed086324c8c74407770c201136c9211157f；恢复到根EXE快捷启动.lnk即可回1.3.59。旧完整目录保留。新lnk SHA256 566e5add9afbbec098928da494d7ef508f83bb91039363a72ff77959005475b7。
- 清理：删除被自动策略拒绝，未重试；12个本轮隔离fixture已逐项移入[手动删除目录](../手动删除/visualization-1.3.60)，原路径不存在，准确映射见交付清单。可手动删除该目录；不影响程序。快捷启动测试fixture已由驱动删除，所有有限会话结束，无遗留Scodex测试进程。
- 约束和限制：未读取真实凭据内容、写真实聊天或连接配置、发布GitHub、替换其他安装目录。公网模型连通性/质量、上游专属插件及完整自动图表接手未在本轮新验证。未签名包PE框架资源仍为Electron45，应用版本以包元数据及实际IPC为准。
- 待办：本轮授权范围无功能待办；只需按需手动删除已隔离的测试目录。轻量重构评估无必要扩展。使用Skill：code-write-review、frontend-implementation、security-best-practices。后续按变化范围复测，不重复有效结果。

## 1.3.59 所选模式执行与运行中切换（已完成）

- 用户目标：选择哪个模式，哪个模式就参与独立提案、评议全部方案、整合讨论并负责最终文件修改、命令、验证和交付。用户已确认“两者都要”：执行中可补充修改方案/文件，也可切换执行模式，三模式继续共用聊天和上下文。
- 运行行为：切换先校验目标聊天、已配置模型与网络权限并排队；当前模型响应及整批工具完成、真实结果入上下文后生效。保留同一任务、文件追踪、权限、引导和已完成操作；界面显示待切换/生效，更新执行身份与用量。其余两个模型监督，新执行者不自行充当独立完成核验者。
- 实现范围：electron/main.cjs、model-team.cjs、agent-runtime.cjs、preload.cjs，src/workbench.jsx、components/model-team-settings.jsx及直接相关测试/版本元数据。原生/JSON通道转换保留工具调用与结果配对；没有新增非必要依赖。
- 版本及基线：上次1.3.58，本次1.3.59，沿用项目既有SemVer补丁映射，同轮重建不重复递增。无Git元数据，[基线](../release/team-executor-1.3.59/baseline.json)含15份原文件；实际增量审查范围为12份代码、测试和版本元数据。

| 已完成需求 | 结果 | 依据 |
| --- | --- | --- |
| 所选模式提案、全量评议及实际执行 | 三种模式均使用自己的服务/模型，讨论失败仍由所选者执行 | 当前最终包基础7项独立通过，含两种降级和运行中补充 |
| 运行中补充修改 | 引导排队并被接受，二次实际改文件、命令和回读 | [最终包基础报告](../release/team-executor-1.3.59/final-candidate-ui/team-executor-ui.json)中的steering场景 |
| 运行中切换且上下文通用 | 一→二→三→一，同chat/request，真实edit四次、命令一次，无重放 | [切换与职责报告](../release/team-executor-1.3.59/switch-candidate-ui-r2/team-executor-ui.json)3/3通过 |
| 完整程序和根快捷入口 | 构建、身份、资源及实际快捷启动工作流通过 | [快捷入口报告](../release/team-executor-1.3.59/shortcut-ui/team-executor-ui.json)2/2通过 |
| 增量审查和职责界面 | 12份文本审查、编码/空白检查及600/1280px布局通过 | [增量审查](../release/team-executor-1.3.59/incremental-review.json)，最新职责截图已查看 |

- 最终程序：[完整EXE](../release/Scodex-Workbench-1.3.59/win-unpacked/Scodex工作台.exe)；根[EXE快捷启动](../EXE快捷启动.lnk)已用File.Replace备份替换，工作目录为完整win-unpacked目录，图标仍为根EXE快捷启动.ico。不能单独搬移EXE而遗漏运行资源。
- 最终身份：EXE SHA-256 da9a0c6ad51a8264febd79736b9fff5ba2f85a6cccff86b7f6e719fdf6bcbf7a；ASAR 245627b8a32e4bb9992f1e06bfc9317cf42b298dff736023af65eca3e4bbc932；快捷方式bed096119ecfcdeb51f1984d3338aed086324c8c74407770c201136c9211157f。4份Electron模块及renderer与当前源码匹配，[包身份](../release/team-executor-1.3.59/artifact-identity.json)通过。
- 构建：npm run build；npx electron-builder --win dir --x64 --config.npmRebuild=false --config.win.signAndEditExecutable=false --config.electronDist=node_modules/electron/dist --publish never --config.directories.output=release/Scodex-Workbench-1.3.59。相关[renderer日志](../release/team-executor-1.3.59/switch-renderer-build.log)、[打包日志](../release/team-executor-1.3.59/switch-package.log)完成；[逻辑日志](../release/team-executor-1.3.59/switch-targeted-tests-final.log)61/61通过。
- 验收边界：模型HTTP与凭据由loopback fixture替代，实际EXE/UI/IPC/磁盘/文件/Windows命令及快捷方式均真实执行；公网模型连通性、质量和性能尚未验证。沿用未签名目录构建，Windows PE框架版本为Electron45，应用1.3.59以包元数据和实际IPC核对。
- 失败恢复：final-candidate-ui整轮failed，前7项独立通过并保留；连续切换驱动在发起切换前误从磁盘寻找不持久化的pending状态。改为实时UI判断运行、持久化稳定requestId，并先取消已知请求再退出后，switching-only 3/3通过。原失败证据未改写为通过，未无故重建或重复基础验收。
- 用户数据与范围：真实连接配置最终SHA-256仍53cc2c54bb6d2283aa5a2a059c767ff9bda8d2a740a76a2d2d2e3631d87db7c3；未读取密钥内容、修改真实聊天、终止用户进程、发布GitHub或更新其他安装目录。
- 回滚：将[旧快捷方式备份](../release/team-executor-1.3.59/EXE快捷启动.pre-replace.lnk)恢复到根EXE快捷启动.lnk；备份SHA-256 42547b4155e47e3a8b73436fd82b1e44f9d0ab03594de7c4eda1e39221e22278与原基线一致。旧release/Scodex-Workbench-1.3.58/win-unpacked完整目录保留，用户配置和数据不替换。
- 清理：两轮最终验收fixture均已删除、测试进程退出；失败轮次会话8447退出1且四个自建进程已核实回收。删除其临时fixture被自动审批以blocked by policy拒绝，未重复强删；已移至项目[手动删除目录](../手动删除/team-executor-1.3.59/scodex-team-executor-297e8c80-317e-4db0-a4e3-3d310c22f182)，原Temp路径不存在，待手动删除，不影响程序。精确路径、原因见[清理记录](../release/team-executor-1.3.59/switch-recovery-cleanup.json)。
- 当前需求无功能待办；轻量重构评估无必要扩展。交付、身份、验收和回滚见[交付清单](../release/team-executor-1.3.59/delivery.json)、[测试交接](TEST_HANDOFF.md)及[结构化检查点](WORK_CHECKPOINT.md)。使用Skill：requirement-understanding、code-write-review；最终文档回读验证随落盘执行。

## 1.3.58 模式列表隔离与输入栏尺寸（已完成）

- 目标：模式一选择器隐藏同地址模式二默认模型Grok 4.7、保留已有连接配置；顺序改为模式→模型→回答深度并把三个控件放大一档，继续共用聊天上下文。
- 已确认：同地址时旧normalizeConnection会把模式二默认模型追加到主列表。本机主默认glm-5.3、列表末项为grok-4.7。用户选择“只隐藏模式一下拉项，保留配置”。停止今后自动追加，并在模式一仅隐藏同地址子模型默认项；旧消息仍能按已配置原模型重试。
- 实现范围：`electron/model-connection.cjs`停止同地址自动回填；`src/lib/model-list.js`分离配置白名单与可见列表，同主/子默认模型保留可见；`src/workbench.jsx`调整顺序并保留旧消息原模型重试；`src/styles.css`调整三个控件为13px/32px，宽82/124/76px，窄屏模型110px。三份相关测试及两份版本元数据同步更新。
- 版本/入口：上轮1.3.57，本轮1.3.58，沿用SemVer补丁映射。最终完整目录为`release/Scodex-Workbench-1.3.58/win-unpacked`；根[EXE快捷启动](../EXE快捷启动.lnk)已切换，工作目录和原自定义图标保留。应用版本由包内元数据及实际UI/IPC核对；沿用未签名目录构建，Windows PE框架资源版本仍为Electron45.0.0。
- 基线与约束：[13文件基线清单](../release/composer-controls-1.3.58/baseline.json)及其baseline目录；保留用户1.3.57进程和旧完整目录，不改用户模型配置、聊天或凭据，不发布GitHub、不更新其他安装目录。连接配置最终SHA-256仍为`53cc2c54bb6d2283aa5a2a059c767ff9bda8d2a740a76a2d2d2e3631d87db7c3`。

| 已完成需求 | 状态 | 验收依据 |
| --- | --- | --- |
| 模式一隐藏Grok、配置保留 | 完成 | 实际EXE保存/重开后主配置仍含Grok、模式一下拉隐藏、模式二可见；历史原模型重试成功 |
| 控件交换位置并放大 | 完成 | 模式→模型→回答深度；键盘、600/1280px布局及尺寸检查通过 |
| 三模式共享聊天和上下文 | 完成 | 实际EXE三模式同聊天6条消息、完整前序问答通过 |
| 1.3.58完整程序及快捷入口 | 完成 | 构建打包退出0、候选UI5/5、根快捷方式启动发送2/2；资源齐全 |
| 增量审查及清理 | 完成 | 9份代码/测试/元数据差异审查及编码检查通过；测试进程退出、两个fixture已删除 |

- 构建方式：`npm run build`；`npx electron-builder --win dir --x64 --config.npmRebuild=false --config.win.signAndEditExecutable=false --config.electronDist=node_modules/electron/dist --publish never --config.directories.output=release/Scodex-Workbench-1.3.58`。首次配置层级错误已修正；[最终打包日志](../release/composer-controls-1.3.58/package-r2.log)退出0。
- 交付身份：EXE SHA-256 `a6b861077c70432316ce5c179aa39a2973a64f1e924a7f50d79687a140bbfea9`，ASAR `b238f9c46b41ec3bb35dd76effe745822a228e53cb8d6d7523489bff24b4dfad`，快捷方式`42547b4155e47e3a8b73436fd82b1e44f9d0ab03594de7c4eda1e39221e22278`；最终路径文件与验收产物一致，详见[交付清单](../release/composer-controls-1.3.58/delivery.json)。
- 验证与审查：24项逻辑通过；实际EXE5/5及快捷入口2/2；包内6份直接模块/renderer字节匹配。仅审查本轮4份业务源码、3份测试和2份元数据相对基线的差异；共同默认模型保护修正后复测通过，无其余高置信度问题。截图结论限定为当前设备、页面、1280×780视口和数据状态下无可见错误；详见[测试交接](TEST_HANDOFF.md)。
- 恢复记录：首次File.Replace空备份参数被拒绝且未替换；指定明确备份路径后原子替换成功。ASAR辅助核对首次使用了错误的Windows分隔符，修正后通过，未修改程序。有效测试均在最终候选上完成，无需重复已通过检查。
- 运行与回滚：先退出仍运行的1.3.57用户窗口，再双击根快捷方式，避免单实例复用旧窗口；未擅自终止用户进程。回滚时将`release/composer-controls-1.3.58/EXE快捷启动.pre-replace.lnk`恢复为根快捷方式，旧目录保留；备份哈希与基线相同。始终保留完整win-unpacked资源目录。
- 限制及待办：两个本轮隔离fixture已删除、测试进程退出，无本轮待清理项或功能待办；HTTP模型和凭据是loopback fixture，公网模型连通性未验证。轻量重构评估无必要扩展事项。使用Skill：requirement-understanding、frontend-implementation、code-write-review；[结构化检查点](WORK_CHECKPOINT.md)同步维护。

## 1.3.57 输入栏模型模式（已完成）

- 当前状态：源码与完整Windows运行目录已更新为1.3.57；[EXE快捷启动](../EXE快捷启动.lnk) 已切换并通过实际启动/发送验收，原自定义图标保留。
- 用户最终要求：三模式共用同一聊天记录与上下文，模式切换只改变后续模型服务；分别使用main/subagent/advisor配置，不改变回答模式、子任务及三模型协作开关。旧聊天默认模式一，重试使用原消息模式。
- 实现范围：模型列表/选择helper、输入栏、连接请求路由、聊天消息白名单、版本源及相关测试。模型宽142→110px，模型和回答深度字号13→12px；未配置模式明确提示，模式三默认模型缺失时拒发。

| 已完成需求 | 结果与证据 |
| --- | --- |
| 紧凑输入栏及三模式 | [最终UI报告](../release/composer-model-modes-1.3.57/final-ui/composer-model-modes-ui.json)4/4；同一聊天三次请求均保留前面模式问答，键盘及600/1280px布局通过 |
| 路由、保存、兼容和重试 | 36项逻辑结果有效，模型列表3项修正后复测；原候选未受影响的重试/重启结果复用，详见测试交接 |
| 完整EXE及快捷入口 | [实际快捷方式报告](../release/composer-model-modes-1.3.57/shortcut-ui/composer-model-modes-ui.json)2/2；经Windows启动根目录lnk后从真实UI发送完成，完整运行资源存在 |

- 版本/构建：上次1.3.56，本轮1.3.57，沿用既有SemVer补丁映射；同轮重建沿用目标版本。`npm run build`后以本机Electron45、`--win dir --x64`、`npmRebuild=false`、`signAndEditExecutable=false`、`electronDist=node_modules/electron/dist`、`--publish never`打包。
- 最终程序：`D:/cx/.Scodex/release/Scodex-Workbench-1.3.57/win-unpacked/Scodex工作台.exe`；EXE SHA-256 `fddabfb6e107058cf8229f39f15e7384f8d5d5edb7133981cf6ceecdcecb8109`，ASAR `768664fa7af4158b57a7273d34d12a483811c7496f38d11cc7f004ccf2bf6b70`，包内模块与当前源码/renderer匹配；[交付清单](../release/composer-model-modes-1.3.57/delivery.json)记录入口、图标、哈希及验证来源。
- 增量审查：以修改前基线11份文本和新增UI脚本为范围，已修复模式三缺默认模型的提示边界，未发现其余高置信度问题；编码、差异空白和版本源一致性通过。早期UI失败来自fixture等待、项目绑定、选择器与刷新顺序，已定向修正；没有将失败整轮作为通过。
- 回滚/清理：旧1.3.56完整目录不变；`release/composer-model-modes-1.3.57/baseline/EXE快捷启动.lnk`为回滚入口备份。恢复该快捷方式即可回滚，用户数据/配置未替换；保留完整win-unpacked目录。7个UI临时profile删除、测试进程退出，日志/截图/基线保留，无待手动清理项。
- 限制/待办：本地HTTP fixture替代公网服务，没有读取真实凭据、发送公网模型请求、终止用户进程或发布GitHub；没有更新其他安装目录。当前授权需求无遗留阻塞，无必要追加重构；后续恢复先读[检查点](WORK_CHECKPOINT.md)及[测试交接](TEST_HANDOFF.md)。

## 1.3.56 本地 EXE 快捷启动（已完成）

- 目标：生成完整 Windows x64 解压目录并建立直达 EXE 的快捷方式；保留原下载 EXE、`快捷启动.lnk`、`打开软件先点击环境检查.lnk` 和用户数据。GitHub `v1.3.55` Release 只有单个 EXE，仓库没有已打包运行目录。
- 版本：本地 `package.json`、`package-lock.json` 由 `1.3.55` 递增到 `1.3.56`；未修改业务源码，未发布 GitHub。
- 构建：`npm run build` 成功，Vite 处理 1835 个模块；Electron Builder 使用本机 Electron `45.0.0` 和已记录的本地构建参数成功输出到 `release/Scodex-Workbench-1.3.56/win-unpacked`。EXE、`resources/app.asar`、ICU、Chrome PAK、V8 snapshot、locale 及项目工具 ZIP 均存在，包内应用版本为 `1.3.56`。
- 实际验收：`tests/browser-cdp-ui.cjs` 的 `restart-only` 在候选 EXE 上通过设置保存和重启恢复两项检查；使用临时 profile、临时 `SCODEX_HOME` 和本地 fixture，不访问真实凭据或公网模型。报告及截图见 [重启验收报告](../release/Scodex-Workbench-1.3.56/verification/restart-only/cdp-ui-verification.json) 和同目录 `cdp-settings.png`。
- 产物身份：EXE SHA-256 `EA8C2E1415774B502ECDEFECB5B5485722ED1C31756758D3920E2265DE7AC87E`；ASAR SHA-256 `614E218947EBDC9960437D0F65E829DD951A136CF8F1444DC2A57E9A054DFB05`。
- 入口：[EXE快捷启动](../EXE快捷启动.lnk) 直接指向 `release/Scodex-Workbench-1.3.56/win-unpacked/Scodex工作台.exe`，工作目录为 `win-unpacked`。按用户提供的图片更新为根目录 `EXE快捷启动.ico`（16/24/32/48px），原图保存在 `EXE快捷启动.png`；`build/icon.ico` 和程序 EXE 内嵌图标未修改，旧两个快捷入口保留。
- 边界：先前 `full` smoke 与旧 UI 假设下的 `workbench-changes` 未通过，原因及证据见测试交接；不作为本次通过依据。`restart-only` 不覆盖完整业务功能或公网模型连通性。本地候选未替换到其他正式安装路径，也未发布 GitHub。

## 本机启动修复（2026-11-09，已完成）

- 目标与验收：解决用户“打不开”，补齐实际运行依赖，通过根目录快捷入口验证真实 Electron 界面及一次本地交互；不改业务源码、版本、锁文件或用户配置。
- 已核实：`debug.log` 报 `Invalid file descriptor to ICU data received`，对应缺少资源的单文件 EXE；已有 npm 依赖，但 `node_modules/electron/dist` 和 `path.txt` 缺失。Electron `45.0.0` 使用首次运行下载机制，`npm ci` 本身不会提供完整运行文件。
- 下载诊断与结果：原路径自动下载长期无进展，已仅停止本任务的安装子进程并回收命令；镜像安装成功，158223852 字节 ZIP 的官方 SHA-256 `ae53887a23bb640369c93dbd38c408a2af5c0deb86f2fa76c6c244cb444b7f47` 匹配，实际命令返回 `v45.0.0`。
- 快捷方式失败证据：实际打开原快捷方式，CMD 13104 停在 `Node.js 24.x and npm are required`；读取该任务自己创建的控制台确认了报错。终端中的 `D:/RJBC/node.exe` 可用，但 ShellExecute 使用的环境未包含该路径。
- 修复：通过镜像取得 Electron `45.0.0` 运行资源，ZIP 官方 SHA-256 与安装文件匹配；启动脚本补齐缺失 Electron 检查与安装、本机 `D:/RJBC` Node/npm PATH 和可覆盖的镜像默认值。
- 验收：根目录快捷方式已在持续会话启动工作台，当前应用 PID `32568`、标题“Scodex 工作台”，响应正常；Vite PID `31148` 监听 `127.0.0.1:4178`。会话标识 `71035`，结束服务可在该会话按 Ctrl+C。实际隔离 Electron renderer、应用版本和本地 profile 均核对成功；通过 UI 切换外观、读取隔离设置文件并刷新后确认选择仍生效。详细证据见 [启动验证报告](startup-verification.json)。
- 测试恢复：ShellExecute 不转交临时注入环境；NODE_OPTIONS 预加载、项目内测试 profile 和未保持运行的服务会话均无法用于可靠验收，失败机制和处理已记录在测试交接。最终改用系统临时目录 profile 与一次性实际 UI 验收；无公网模型请求，也未读取凭据。
- 环境检查入口现名：[打开软件先点击环境检查](../打开软件先点击环境检查.lnk)，由原快捷方式在项目根目录内重命名；仍指向 `cmd.exe /d /c` 调用 `start-scodex.cmd`，工作目录和自动补装行为不变。缺少 npm 依赖时运行 `npm ci`，缺少 Electron 运行文件时自动补装。若 Node.js 24/npm 本身缺失，脚本仍提示人工安装，不会自动安装 Node.js。

| 当前待办 | 状态 | 阻塞 |
| --- | --- | --- |
| 确认启动失败原因 | 已完成 | 无 |
| 修复启动脚本并安装运行文件 | 已完成 | 无 |
| 快捷入口与真实界面验收 | 已完成；窗口与 4178 服务保持运行 | 无 |
| 增量审查、证据及双交接 | 已完成 | 无 |

- 增量审查：仅审查新增 `start-scodex.cmd` 全部 52 行，核对环境路径、Node 主版本、依赖完整性、Electron 镜像/安装、启动与错误分支；无业务源码变更，未发现高置信度问题。
- 临时文件：配置 profile 已从系统临时目录退出并清理；递归删除 `.startup-check` 被策略拒绝且未重试，已移入 `手动删除/startup-check-20261109/`。该文件夹是本轮唯一待手动处理项，不影响快捷启动；上一下载阶段的清理记录继续有效。
- 验证边界：未调用模型服务、读取或修改用户连接配置及凭据；实际功能在临时隔离 profile 中验收。下载的 EXE 为 Electron 主程序文件而非独立便携包，请使用同目录 [快捷启动](../快捷启动.lnk) 或 [打开软件先点击环境检查](../打开软件先点击环境检查.lnk)，二者调用同一启动脚本。

## 本地下载检查点（2026-11-09，下载与入口准备已完成）

- 当前目录：`D:/cx/.Scodex`；来源为 [song123-jian/-0](https://github.com/song123-jian/-0)，`main` 提交 `b18db09f7f8a66f3bae7169d6501a2423a9cb74a`，包版本 `1.3.55`。最终 GitHub 查询确认该提交和 Release `v1.3.55` 仍为最新。
- 源码完整性：原树 343 个文件、54509311 字节；341 个未修改文件逐个通过 Git blob SHA-1 核对，两份原有交接文档补充本地记录。没有修改业务源码、版本源或锁文件；本目录没有成功克隆的 `.git` 元数据。

| 已完成需求 | 状态 | 交付物 |
| --- | --- | --- |
| 最新源码和文件夹内快捷启动 | 文件下载和入口配置已完成 | [源码元数据](../package.json)、[快捷启动](../快捷启动.lnk)、[环境检查入口](../打开软件先点击环境检查.lnk)、[启动脚本](../start-scodex.cmd)、[原版 EXE](../Scodex-Workbench-1.3.55-x64.exe) |

- 启动方式：双击根目录 `快捷启动.lnk`；入口调用 `start-scodex.cmd`，使用本机 `D:\RJBC` Node.js/npm，检查 Node.js 24.x 和运行依赖；缺少 npm 依赖时执行 `npm ci`，缺少 Electron 运行文件时从镜像补装，随后执行仓库原有的 `npm run dev`。当前会话首次安装已完成。
- 发布附件边界：EXE 为官方原始拆分文件，需配套运行资源，不能当作独立便携安装包使用；PE 资源版本是 Electron `45.0.0`，应用源码版本为 `1.3.55`。快捷方式使用源码启动路径。
- 验证与审查：源码与原始 EXE SHA-256、快捷方式配置、实际启动以及隔离界面设置保存已验证，见 [测试交接](TEST_HANDOFF.md) 和 [本机验收报告](startup-verification.json)。
- 传输调整：源码归档因 600 秒超时失败，浅克隆未收到有效 pack，均未交付为成功结果；最终使用固定提交的并发 HTTP 下载及逐文件摘要核对完成源码，EXE 使用已验证的 HTTP 206 分段传输并完整核对摘要。
- 旧清理记录：下载阶段的旧交接记载 31 项已移动，但原清理清单在当前目录不存在，无法复核这些旧条目的现状；本轮不改变旧文件。本轮新增的待手动处理目录另见上方检查点。
- 运行与回滚：应用由持续会话 `71035` 启动，Electron PID `32568`，Vite PID `31148`，地址 `http://127.0.0.1:4178/`；按 Ctrl+C 可停止开发服务。未替换原始下载文件，也未修改用户配置。
- 当前限制：下载的同名 EXE 单文件不含完整便携资源，不能独立启动；使用快捷方式即可。模型服务未作连通性测试。以下历史发布记录来自上游其他机器，不代表本机运行验收。

<!-- formal-build-1.3.55:start -->
## 当前增量：1.3.55 模型三完成态文案、正式构建与 EXE 替换（已完成）

- 目标：模型三独立提案返回结构化结果后，活动记录显示“正在模型三 · 独立提案已返回结构化结果”，并将包含本次改动的正式 `1.3.55` EXE 替换到入口。
- 源码变更：`src/lib/message-presentation.js` 仅对模型三独立提案成功态合并目标文案；`tests/message-presentation.test.mjs` 与 `tests/model-team-ui.cjs` 同步精确断言；`package.json`、`package-lock.json` 递增为 `1.3.55`。
- 验证：`node --test tests/message-presentation.test.mjs tests/model-team.test.mjs` 43/43；相关 `node --check` 与 `git diff --check` 通过；候选模型团队 UI 8/8、正式入口模型团队 UI 8/8；候选/正式 `restart-only` 各 2/2。
- 增量审查：仅检查模型三独立提案成功态分支、直接文案拼接和版本/产物引用；模型一/二成功态及失败、取消、评议路径由回归断言覆盖，未发现高置信度问题。
- 构建与产物：首次默认构建因 Electron 联网检查 `connect ETIMEDOUT 20.205.243.166:443` 失败；随后复用本机 Electron 45、关闭依赖重建和签名编辑后成功生成候选。候选/正式 EXE SHA-256 `7322246bf4839585af09ab6518145bd26ce9a92dc74df9a8a37c30c512889ac9`；ASAR SHA-256 `208e5f3d9f4f86f047661851ba34d01949187ad39b37ddf3a2be99e169b6b4c4`。
- 正式替换：旧 `1.3.54` EXE/ASAR 已保存到 `release/formal-build-1.3.55-20261108/rollback-1.3.54`；正式入口与候选哈希一致，用户数据、配置和凭据未作为替换对象。报告：`release/formal-build-1.3.55-20261108/formal-replacement.json`。
- GitHub 发布：[`v1.3.55`](https://github.com/song123-jian/-0/releases/tag/v1.3.55) 已正式发布，Release ID `438314791`；EXE 资产 ID `724365962`，大小 `249798144` 字节，GitHub SHA-256 `7322246bf4839585af09ab6518145bd26ce9a92dc74df9a8a37c30c512889ac9` 与正式入口一致。下载地址：https://github.com/song123-jian/-0/releases/download/v1.3.55/Scodex-Workbench-1.3.55-x64.exe。
- 发布验证边界：GitHub 返回资产状态 `uploaded`；匿名下载 HEAD 返回公开重定向 `302`。匿名完整流式下载因当前代理/CDN 长时间无有效进度而停止，未取得下载文件的完整哈希，不据此声称匿名完整下载验收通过。资产上传及 API 摘要核对记录：`release/formal-build-1.3.55-20261108/github-asset-upload.json`。
- 限制：三模型完整流程使用 loopback fixture；本轮未读取、打印或落盘模型凭据，也未新增公网模型请求。

<!-- formal-build-1.3.55:end -->

<!-- formal-hello-1.3.54:start -->
## 当前增量：正式入口真实 `你好` 连通性与上限审计（已完成）

- 目标：使用正式 `1.3.54` 入口和已保存连接配置发送一次 `你好`，并核对模型上下文/输出是否仍被应用层固定上限截断。
- 实际结果：`E:/GDP/Scodex/App/Scodex工作台.exe` 返回完成事件，模型 `gpt-6.1-sol`、HTTP 200、输出 31 tokens、应用退出码 0；连接配置哈希保持不变，隔离副本中的加密凭据已清理。服务正文长度 40，严格等于 `你好` 的断言为 false，因此只判定连接链路通过，不伪造精确回复通过。
- 非敏感证据：`release/formal-build-1.3.54-20261108/formal-hello/external-latency.json`，只含状态、模型名、HTTP 状态、耗时、用量和响应长度/布尔匹配结果，不含 API Key、Authorization 或响应正文。
- 上限审计：模型请求路径使用动态上下文容量和服务默认输出；`MAX_TOOL_CALLS`、`MAX_ROUNDS`、`MAX_OPERATIONS` 为无限值，讨论三路并行保留。文件大小、模型列表数量、地址数量、密钥格式、技能枚举和日志保留边界属于输入/资源防护，继续保留；讨论等待超时继续用于缩小上下文重试和真实降级，不伪造评议结果。
- 清理：递归删除本轮临时 profile 被策略拒绝且未重试；本轮三个隔离 fixture 均已移至项目根目录 `手动删除/`，原路径已不存在，详见报告清理字段。
- 源码辅助变更：`tests/latency-external-smoke.cjs` 增加精确提示词和输出目录环境变量，保留密钥隔离与非敏感记录规则；不改变正式 EXE 代码。

<!-- formal-hello-1.3.54:end -->

<!-- formal-build-1.3.54:start -->
## 当前增量：1.3.54 三模型完成态文案、正式构建与 EXE 替换（已完成）

- 目标：三模型独立提案运行中显示“正在模型三 · 独立提案”，结构化响应完成后显示“模型三 · 独立提案已返回结构化结果”，并把包含本次修正的 `1.3.54` 构建替换到正式入口。
- 源码变更：`src/lib/message-presentation.js` 为模型讨论操作提供运行/成功/失败状态文案；`src/components/agent-activity.jsx` 避免成功详情重复显示；`tests/message-presentation.test.mjs` 与 `tests/model-team-ui.cjs` 增加精确断言。`package.json`、`package-lock.json` 同步为 `1.3.54`。
- 验证：`node --test tests/message-presentation.test.mjs tests/model-team.test.mjs` 43/43；相关 `node --check` 通过；候选模型团队 UI 8/8，候选和正式入口 `restart-only` 各 2/2。候选模型三完成态断言实际通过。
- 产物身份：候选/正式 EXE SHA-256 `f77326e9b380482b4c126df5d1481921600f41e122c7788b1057e5e775767e4c`；候选/正式 ASAR SHA-256 `00b39e491f3413e054c42416fc3456d9824cf1e8b5bb52a72a054cf80a553563`；详细报告 `release/formal-build-1.3.54-20261108/formal-replacement.json`。
- 正式替换：旧 `1.3.53` EXE/ASAR 已备份到 `release/formal-build-1.3.54-20261108/rollback-1.3.53`；只替换正式应用文件，用户数据、配置和凭据未作为替换对象。
- 限制：三模型完整流程使用 loopback fixture，未据此推断公网模型质量；本轮未读取、打印或落盘模型凭据，也未新增公网模型请求。

<!-- formal-build-1.3.54:end -->

<!-- formal-build-1.3.53:start -->
## 当前增量：1.3.53 三模型提案状态修正、正式构建与 EXE 替换（已完成）

- 目标：将三模型讨论的提案状态在真实结构化响应后显示为已完成，并把包含当前源码的 `1.3.53` 构建替换到正式入口。
- 状态证据：候选三模型 UI 8/8 通过；保存的实际操作记录中，模型一、模型二、模型三的独立提案均为 `succeeded`，详情均为“独立提案已返回结构化结果”。报告为 `release/formal-build-1.3.53-20261108/candidate-ui-r7/model-team-ui.json`，对应隔离 profile 记录位于其 `fixture-*/profile/conversations.json`。
- 版本与构建：源码 `package.json`、`package-lock.json` 为 `1.3.53`；候选目录为 `release/formal-build-1.3.53-20261108/candidate/win-unpacked`。前置 `npm run build` 与 Electron Builder 候选构建均成功。
- 产物身份：候选与正式 EXE SHA-256 均为 `4ef974adec0feaa30543fa0defafdb0216d6411d385adf2c58f941810f04cddf`；候选与正式 ASAR SHA-256 均为 `946b13e32740401bf29d1d065a815af6acdf74a3d2ad71bff7ecb6f6e80c4c63`。完整记录见 `release/formal-build-1.3.53-20261108/formal-replacement.json`。
- 正式替换：替换前 `1.3.52` 的 EXE/ASAR 已备份到 `release/formal-build-1.3.53-20261108/rollback-1.3.52`；只替换正式应用文件，用户数据、配置和凭据未作为替换对象。
- 正式验证：候选与正式入口的 `SCODEX_CDP_SCOPE=restart-only` 各 2/2 通过，报告分别为 `release/formal-build-1.3.53-20261108/candidate-restart/cdp-ui-verification.json` 与 `release/formal-build-1.3.53-20261108/formal-restart/cdp-ui-verification.json`；两份报告均确认版本 `1.3.53`，临时 profile 已清理，最终无 Scodex 进程。
- 最终增量审查：本轮没有新增业务源代码；定向核对候选 UI 状态证据、版本元数据、候选/正式哈希、回滚范围和重启报告，未发现高置信度问题。

<!-- formal-build-1.3.53:end -->

<!-- formal-build-1.3.52:start -->
## 当前增量：1.3.52 正式构建、EXE 替换、重启验收与真实连通性验证（已完成）

- 目标：将当前 `workbench` 源码构建为正式 EXE，替换 `E:/GDP/Scodex/App/Scodex工作台.exe` 与 `resources/app.asar`，保留用户数据、配置和凭据。
- 版本与构建：`package.json`、`package-lock.json` 为 `1.3.52`；`npm run build` 与 Electron Builder 本地 Electron 45 `--win dir --x64` 均退出 0。候选目录为 `release/formal-build-1.3.52-20261108/candidate/win-unpacked`。
- 产物身份：候选和正式 EXE SHA-256 均为 `361b5fb...1b009bce`；候选和正式 ASAR SHA-256 均为 `a16c3aa...98042473`；包内版本 `1.3.52`。完整哈希见 `release/formal-build-1.3.52-20261108/formal-replacement.json`。
- 正式替换：替换前 `1.3.51` 的 EXE/ASAR 已备份到 `release/formal-build-1.3.52-20261108/rollback-1.3.51`；只替换应用文件，正式入口与候选哈希一致。
- 正式验证：候选和正式入口的 `SCODEX_CDP_SCOPE=restart-only` 均 2/2 通过，报告分别为 `release/formal-build-1.3.52-20261108/candidate-ui/cdp-ui-verification.json` 与 `release/formal-build-1.3.52-20261108/formal-restart/cdp-ui-verification.json`；临时 profile 已清理，最终无 Scodex 进程。
- 附件路径验证：消息路径隐藏、预览、原生 Explorer 选择三个相关场景通过；同一重跑随后在与本轮无关的旧快捷键文案断言处停止，未将该部分写为通过。
- 真实连通性：正式默认配置只发送一条 `你好`；模型 `gpt-6.1-sol` 返回 HTTP 200，非空回复已持久化。记录见 `release/formal-build-1.3.52-20261108/formal-hello/hello-verification.json`，未记录凭据或 Authorization。
- 交付报告：`release/formal-build-1.3.52-20261108/formal-replacement.json`。
- 最终增量审查：正式构建阶段未新增源代码；本轮定向核对 `package.json`/`package-lock.json` 的 `1.3.52` 版本元数据、候选/正式产物身份、回滚范围和交付报告，未发现高置信度问题。源代码改动沿用前置定向审查与测试记录；`src/workbench.jsx` 的两处既有尾随空白提示未纳入本轮清理。

<!-- formal-build-1.3.52:end -->

<!-- formal-build-1.3.51:start -->
## 当前增量：1.3.51 正式构建、EXE 替换与重启验收（已完成）

- 目标：将当前 `workbench` 源码构建为正式 EXE，并替换 `E:/GDP/Scodex/App/Scodex工作台.exe` 与 `resources/app.asar`；本轮只递增版本元数据和替换应用文件，保留用户数据、配置和凭据。
- 版本与构建：`package.json`、`package-lock.json` 已同步为 `1.3.51`；`npm run build` 与 Electron Builder 本地 Electron 45 `--win dir --x64` 构建均退出 0。候选目录为 `release/formal-build-1.3.51-20261108/candidate/win-unpacked`。
- 产物身份：候选和正式 EXE SHA-256 均为 `1067e12eabcdc93ce3068db79e01443119c41192451393d8ae2274aa71b559c0`；ASAR SHA-256 均为 `4683aa2607333ba40cd1ea212869b1169f168efb721acc6438177aee4ffb93b9`；包内版本 `1.3.51`，关键主进程、运行时、上下文压缩、模型团队和协调器模块与源码逐字节一致。
- 正式替换：替换前 `1.3.50` 已备份到 `release/formal-build-1.3.51-20261108/rollback-1.3.50`，回滚只恢复 EXE 和 ASAR；正式入口与候选哈希完全一致。
- 正式验证：候选和正式入口均运行 `SCODEX_CDP_SCOPE=restart-only node tests/browser-cdp-ui.cjs`，各 2/2 通过；报告分别为 `release/formal-build-1.3.51-20261108/candidate-ui/cdp-ui-verification.json` 和 `release/formal-build-1.3.51-20261108/formal-restart/cdp-ui-verification.json`，临时 profile 已清理，最终无 Scodex 进程。
- 交付报告：`release/formal-build-1.3.51-20261108/formal-replacement.json`。本轮未读取、打印或写入凭据，也未发送公网模型请求；构建沿用本地未签名路径。

<!-- formal-build-1.3.51:end -->

<!-- formal-build-1.3.50:start -->
## 当前增量：1.3.50 正式构建、EXE 替换与重启验收（已完成）

- 目标：将当前 `workbench` 源码构建为正式 EXE，并替换 `E:/GDP/Scodex/App/Scodex工作台.exe` 与 `resources/app.asar`；只替换应用文件，保留用户数据、配置和凭据。
- 版本与构建：`package.json`、`package-lock.json` 已同步为 `1.3.50`；`npm run build` 退出 0；候选使用本机 Electron 45、`npmRebuild=false`、`signAndEditExecutable=false` 的已验证打包路径，Electron Builder 退出 0。
- 候选产物：`release/formal-build-1.3.50-20261108/candidate-r2/win-unpacked/Scodex工作台.exe`；EXE SHA-256 `f2a665a8206981f1bcc276f39ba32b55875311c865ebf8e8d07e33cade2f2b5a`，ASAR SHA-256 `7ece575c96621e827eff01771f8f5049e3da609177698ce651b2f5cda2b6aaea`；包内版本 `1.3.50`，关键主进程、运行时、上下文压缩、模型团队和协调器模块与源码逐字节一致。
- 正式替换：正式入口 EXE/ASAR 与候选哈希完全一致；替换前 `1.3.49` 已备份到 `release/formal-build-1.3.50-20261108/rollback-1.3.49`，回滚只恢复 EXE 和 ASAR。
- 正式验证：候选和正式入口均运行 `SCODEX_CDP_SCOPE=restart-only node tests/browser-cdp-ui.cjs`，各 2/2 通过；覆盖启动、版本、设置保存、退出重启和状态恢复。报告分别为 `release/formal-build-1.3.50-20261108/candidate-ui/cdp-ui-verification.json` 和 `release/formal-build-1.3.50-20261108/formal-restart/cdp-ui-verification.json`，临时 profile 已清理，最终无 Scodex 进程。
- 定向回归：`node --test tests/context-compression.test.mjs tests/model-adapter.test.mjs tests/model-connection.test.mjs tests/model-team.test.mjs` 共 67/67 通过；相关 Electron 文件语法检查和 `git diff --check` 通过。本轮没有新增产品逻辑代码，增量审查仅覆盖版本元数据和产物身份，未发现高置信度问题。
- 限制：公网模型请求、真实凭据发送和完整团队 UI 不在本轮正式 EXE 重启验收范围；构建跳过外部资源编辑与签名，沿用项目已有未签名候选路径。
- 交付报告：`release/formal-build-1.3.50-20261108/formal-replacement.json`。

<!-- formal-build-1.3.50:end -->

<!-- formal-build-1.3.49:start -->
## 当前增量：1.3.49 模型二命令通道正式构建、替换与验收（已完成）

- 目标：将当前 `workbench` 源码构建为正式 EXE，并替换 `E:/GDP/Scodex/App/Scodex工作台.exe` 及其 `resources/app.asar`；只替换应用文件，保留用户数据、配置和凭据。
- 构建：`package.json`、`package-lock.json` 为 `1.3.49`；`npm run build` 与 `npx electron-builder --win dir --x64 --config.directories.output=release/formal-build-1.3.49-20261108/candidate-local` 均退出 0，候选包内版本为 `1.3.49`。
- 候选产物：`release/formal-build-1.3.49-20261108/candidate-local/win-unpacked/Scodex工作台.exe`；EXE SHA-256 `9a8f469de0869fc563a1e99dadf51d4179a47c61818a9ad2f750940f99bf4ed2`，ASAR SHA-256 `4ae6b35c38b53dd2e6376186d2dec7d23e75b74acec49dfb91165436180ce83d`。`electron/main.cjs`、`electron/agent-runtime.cjs`、`electron/model-team.cjs`、`electron/subagent-coordinator.cjs` 与候选包内文件逐字节一致。
- 正式替换：正式入口 EXE/ASAR 与候选哈希完全一致，包内版本 `1.3.49`；替换前 `1.3.48` 已备份到 `release/formal-build-1.3.49-20261108/rollback-1.3.48`，回滚只恢复 EXE 和 ASAR。
- 正式验证：候选和正式入口均运行 `SCODEX_CDP_SCOPE=restart-only node tests/browser-cdp-ui.cjs`，各 2/2 通过；报告分别为 `release/formal-build-1.3.49-20261108/candidate-local-ui/cdp-ui-verification.json` 和 `release/formal-build-1.3.49-20261108/formal-restart/cdp-ui-verification.json`，临时 profile 已清理。
- 增量审查：本轮重点核对模型二编辑型子任务的 `run_command`、协调器当前任务排除/其他编辑任务互斥、规划型只读边界及对应测试；未发现高置信度问题。公网模型请求、真实凭据发送和完整团队 UI 不在本轮正式 EXE 重启验收范围。
- 交付报告：`release/formal-build-1.3.49-20261108/formal-replacement.json`。

<!-- formal-build-1.3.49:end -->

<!-- formal-build-20261108:start -->
## 当前增量：动态上下文压缩版本 1.3.48 正式构建与替换（已完成）

- 目标：将当前 `workbench` 源码构建为正式 EXE，并替换 `E:/GDP/Scodex/App/Scodex工作台.exe` 及其 `resources/app.asar`，保留用户数据和配置。
- 版本与构建：`package.json`、`package-lock.json` 已同步为 `1.3.48`；`npm run build` 退出 0；`npx electron-builder --win dir --x64 --config.directories.output=release/formal-build-1.3.48-20261108/candidate` 退出 0。
- 候选产物：`release/formal-build-1.3.48-20261108/candidate/win-unpacked/Scodex工作台.exe`；EXE SHA-256 `36272dad0f5ca6a702776c97e45c53cfd4624b500ff70a6eb5c82b6b4ff4b2d9`，ASAR SHA-256 `fb2c7d0be870fd56330c1dc81611d3e8abf01842b89b7d91daa5abf58897d464`。包内版本 `1.3.48`，`electron/main.cjs`、`electron/context-compression.cjs`、`electron/model-team.cjs` 与源码哈希一致。
- 正式替换：正式入口与候选 EXE/ASAR 哈希完全一致，包内版本 `1.3.48`；替换前 `1.3.47` 文件已备份到 `release/formal-build-1.3.48-20261108/rollback-1.3.47`。仅替换 EXE/ASAR，未写入用户数据或凭据。
- 正式验证：`SCODEX_CDP_SCOPE=restart-only node tests/browser-cdp-ui.cjs` 在正式入口上 2/2 通过，覆盖启动、设置保存、退出重启和状态恢复；报告 `release/formal-build-1.3.48-20261108/formal-restart/cdp-ui-verification.json`，临时 profile 已清理。候选同范围 2/2 通过，报告位于 `release/formal-build-1.3.48-20261108/candidate-ui/cdp-ui-verification.json`。
- 基线核对：替换前正式 ASAR 磁盘哈希为 `88866a041347b04b4e76f73f788e75c19970ea4cfc30dbd74be367544e7f460f`，包内版本确认是 `1.3.47`；交接中旧哈希记录存在一处差异，已以磁盘实测值建立回滚基线。
- 限制：公网模型请求、真实凭据发送和完整团队 UI 不在本轮正式 EXE 重启验收范围；相关隔离链路测试结果继续沿用前一增量记录。

<!-- formal-build-20261108:end -->

<!-- context-compression-20261108:start -->
## 当前增量：发送前动态上下文压缩与活动证据保留（源码/测试已完成）

- 目标：模型请求发送前按实际上下文容量和内容重要性压缩历史消息、工具结果、附件及任务资料；系统指令、当前需求、工具调用与结果配对、最近消息、路径和错误证据优先保留，无法安全保留时阻止发送。
- 主要变更：`electron/context-compression.cjs` 提供动态 token 估算、分组预算和关键证据保护；`electron/agent-runtime.cjs` 在每次请求前压缩并在服务报告上下文过长时自适应重试；`electron/main.cjs` 将学习记忆和三模型讨论作为任务资料消息；`electron/chat-attachments.cjs`、`electron/skill-context.cjs`、`electron/skill-catalog.cjs`、`electron/mcp-context.cjs` 移除会先于请求发生的固定正文裁剪。
- 历史证据：`electron/browser-tools.cjs`、`electron/mcp-context.cjs`、`electron/mcp-runtime.cjs`、`electron/service-tools.cjs`、`electron/spreadsheet-tools.cjs`、`electron/task-collaboration.cjs`、`electron/agent-tools.cjs`、`electron/artifact-tools.cjs` 的活动输出不再额外按固定字符数裁剪，发送前统一交给上下文压缩；CDP、MCP 结果、文件/命令、服务日志、表格大小/范围和审批预览等资源与安全边界保留。
- 验证：核心压缩、Agent 运行时、MCP 资料/活动记录和办公成品 `node --test tests/context-compression.test.mjs tests/mcp-context.test.mjs tests/agent-runtime.test.mjs tests/artifact-tools.test.mjs`，37/37；浏览器 11/11、MCP 运行时 6/6、服务/表格 14/14、任务协作 22/22；相关文件 `node --check` 通过，`git diff --check` 通过。
- 已知限制：整组混合回归 119 项中 114 项通过、5 项失败，均为本轮前已存在的旧权限断言；`electron/permission-policy.cjs` 已按此前用户要求在完整访问下直接放行，旧测试仍期待 `never` 隐藏或拒绝工具。未将这些旧断言失败归因于上下文压缩。
- 源码阶段记录：该增量记录形成时只完成源码、测试和交接文档；正式构建与替换在上方 `formal-build-20261108` 增量中完成。公网模型请求未纳入本轮验证。

<!-- context-compression-20261108:end -->

## 上游交付状态（原环境历史记录）

- 当前源码基线：`1.3.55`，位于 `E:/GDP/Scodex/workbench`。
- 当前正式入口：`E:/GDP/Scodex/App/Scodex工作台.exe`，包内版本 `1.3.55`；候选、正式入口和回滚证据见上方 `formal-build-1.3.55` 增量。
- 已完成基线：`.codex` 浏览器、电脑操控、SKILL 配置、键盘快捷键和三模型协作能力已在 1.3.46 正式入口完成定向验收。
- 当前目标：交付包含模型三完成态文案修正的 `1.3.55` 正式 EXE，并完成候选/正式身份核对、回滚备份和 UI/重启验收。
- 当前阶段：`1.3.55` 候选与正式模型团队 UI 各 8/8、候选与正式 `restart-only` 各 2/2、正式 EXE/ASAR 替换和哈希核对已完成；报告 `release/formal-build-1.3.55-20261108/formal-replacement.json`。

## 已完成需求记录

| 需求 | 状态 | 证据 |
| --- | --- | --- |
| 消息中的本地文件/目录链接与第三工作区访问 | 已完成并保留 | `docs/WORK_CHECKPOINT.md` 顶部检查点及相关 `release` 报告 |
| 1.3.44 完整访问程序替换 | 已完成并保留 | `docs/WORK_CHECKPOINT.md` 的 2026-11-07 正式入口章节 |
| `.codex` 设置参照合并 | 已完成并替换正式入口 | 已验证参照源码位于 `E:/GDP/Scodex/repo-source-current`；候选与正式报告见测试交接 |
| 不同模型自动选择工具通道和推理参数 | 已完成（隔离链路） | `node --test tests/model-adapter.test.mjs tests/model-compatibility.test.mjs tests/model-team.test.mjs tests/model-connection.test.mjs`，68/68 |
| 模型角色显示名称调整 | 已完成候选验收 | 工作区模型 UI 5/5；团队 UI 8/8，报告 `release/model-role-labels-20261108/team-ui-retest-2/model-team-ui.json` |
| 三模型独立讨论、评分与自动份额 | 已实施并完成候选验收 | `tests/model-observability.test.mjs`、`tests/model-team.test.mjs` 合计31/31；隔离候选实际UI 8/8，最终记录包含 `debate-proposal` 与 `debate-review`；报告 `release/model-debate-20261108-r2/team-ui/model-team-ui.json` |
| 三模型协作正式入口替换 | 已完成 | 正式入口1.3.46；包身份、正式profile最小回归和用户数据哈希核验见 `release/model-debate-20261108-r3/formal-replacement.json` |
| 动态上下文压缩正式构建与 EXE 替换 | 已完成 | 版本 `1.3.47` 候选/正式哈希、回滚和 `restart-only` 2/2 验收见 `release/context-compression-20261108-r1/` |
| 1.3.48 正式 EXE 重建与替换 | 已完成 | 候选/正式哈希、回滚和候选/正式 `restart-only` 2/2 验收见 `release/formal-build-1.3.48-20261108/` |
| 1.3.49 模型二命令通道正式 EXE 重建与替换 | 已完成 | 候选/正式哈希、回滚、2/2 重启验收和替换报告见 `release/formal-build-1.3.49-20261108/` |
| 1.3.50 正式 EXE 重建与替换 | 已完成 | 候选/正式哈希、回滚、2/2 重启验收和替换报告见 `release/formal-build-1.3.50-20261108/` |
| 1.3.51 正式 EXE 重建与替换 | 已完成 | 候选/正式哈希、回滚、2/2 重启验收和替换报告见 `release/formal-build-1.3.51-20261108/` |
| 1.3.52 动态上下文/模型团队/附件路径正式 EXE 重建与替换 | 已完成 | 候选/正式哈希、回滚、候选/正式 `restart-only` 2/2、附件相关三场景和真实 `你好` HTTP 200 见 `release/formal-build-1.3.52-20261108/` |
| 1.3.54 三模型提案完成态文案正式 EXE 重建与替换 | 已完成 | 候选模型团队 UI 8/8、候选/正式 `restart-only` 各 2/2、候选/正式哈希、回滚和交付报告见 `release/formal-build-1.3.54-20261108/` |

## 主要变更和影响范围

- 直接范围：`electron` 设置/IPC/本地能力/电脑操控文件，`src` 设置页面、快捷键和工作台状态，版本文件及本轮验证资料。
- 现有 `workbench` 未提交的消息路径、第三工作区、模型适配和其他用户改动必须保留。
- `E:/GDP/.codex` 仅作为读取参照；不得复制凭据、会话或运行数据。
- 构建继续使用现有 `build/icon.ico` 与 `build/icon.png`，沿用用户确认的 Scodex 图标，不替换图标资源。

## 关键决策与约束

- 参考设置只允许导入已核实的公开字段；密钥、令牌和聊天记录不进入渲染器或交接文档。
- 快捷键使用统一归一化格式并持久化，非法输入回退到默认值。
- `.codex` 配置写入采用原子替换并保留电脑操控配置中的未知字段。
- 同一 `.codex` 配置目录的读-改-写操作必须串行执行，避免并发保存不同浏览器键时覆盖彼此更新。
- 三模型各自独立提出方案并评议全部方案；按正确性25%、证据20%、任务适配20%、约束15%、可验证性10%、风险10%计算三方中位分。低于60分或约束低于5/10的方案淘汰；领先至少10分且得分不低于70的方案获100%，否则按合格方案得分归一并以最大余数法分配100%。模型二、三的讨论请求无工具，模型一独占实际修改与执行。
- 不执行 `git reset --hard`、`git checkout --` 或覆盖用户未提交改动的整文件替换。

## 验证方式和结果

- 已有有效结果：1.3.44 消息路径/第三工作区相关定向验证和候选构建，详见 `docs/WORK_CHECKPOINT.md`。
- 本轮首轮定向测试：`node --test tests/shortcuts.test.mjs tests/codex-integration-config.test.mjs tests/tray-capabilities.test.mjs` 共 9 项，8 项通过、1 项失败；电脑操控配置写回丢失 `strings.extra`。
- 本轮修复后定向测试：`node --test tests/shortcuts.test.mjs tests/codex-integration-config.test.mjs tests/tray-capabilities.test.mjs` 共 10/10 通过，包含同目录并发更新两键均保留。
- 1.3.45 候选构建：`npm run build` 和 `npx electron-builder --win portable --x64` 均退出 0；候选 package.json 版本为 `1.3.45`。
- 1.3.45 候选实际 UI：6/6 通过，报告 `release/workbench-settings-20261108-r3/integration-settings-ui-verification.json`；覆盖浏览器 TOML、电脑操控 JSON 未知字段、插件开关、参考目录重启恢复、SKILL 列表刷新和快捷键触发/恢复。候选 EXE SHA-256 `3A8B8E88B55DEEF3AB6CB633688852E56B3F99BF7A1CEDDC63E3A09DC38AC096`，ASAR SHA-256 `16511D44521536E9FCEBA8384EE6942E76853E06BC7BD2F40527FDA796FA9393`。
- 增量代码审查：覆盖本轮配置队列、并发回归和 UI 验收驱动，未发现高置信度问题；队列按规范化配置目录串行化并保留原子写入。
- 正式替换与重开：报告 `release/settings-reference-20261108/formal-replacement.json`；正式 ASAR 版本 `1.3.45`，EXE/ASAR 哈希与候选一致，主进程 PID `29240` 正在运行，标题和输入框 UI 核验通过。
- 用户数据保留：`C:/Users/Administrator/AppData/Roaming/scodex-workbench` 中已记录的 5 个持久文件 SHA-256 全部保持不变，聊天数量为 2；回滚备份位于 `release/settings-reference-20261108/rollback-1.3.44`。
- 模型适配复测：隔离响应覆盖原生工具通道拒绝后切换兼容 JSON、推理强度回退、顾问模型单次适配、手动通道保持、取消和错误边界，68/68通过；未使用聊天中的真实密钥。
- 三模型最终定向验证：`node --test tests/model-observability.test.mjs tests/model-team.test.mjs` 31/31通过，`node --check electron/model-usage.cjs`通过；隔离源码快照 Vite 1836 modules构建、305项许可清单生成及 Electron `--win --dir --x64`候选构建通过。候选实际UI 8/8通过，报告 `release/model-debate-20261108-r2/team-ui/model-team-ui.json`，截图 `release/model-debate-20261108-r2/team-ui/model-team-settings.png`；报告中的EXE哈希与候选一致，阶段历史含 `debate-proposal`、`debate-review`、`repeated-error`、`completion`。
- 本轮增量代码审查：按当前Git基线审查 `electron/model-usage.cjs` 与 `tests/model-observability.test.mjs` 两个实际差异文件；白名单仍只接受已知阶段，持久化回读断言覆盖新阶段，`git diff --check`通过，未发现当前范围问题。
- 版本递增与候选：项目 `package.json`、`package-lock.json` 已同步为1.3.46；隔离快照候选 `release/model-debate-20261108-r3/candidate/win-unpacked/Scodex工作台.exe` 构建和包内版本核验通过，EXE/ASAR哈希分别为 `3a8d995b98a21ecdf41950cec47ace1266c0669d2bf678c5688afc9075afa6d9` / `e0d6ae586c54af920b731ca5317e80d5fa2b5f3a9a5daadd9140f1690e20db10`。
- 正式替换与回归：旧1.3.45 EXE/ASAR已备份至 `release/model-debate-20261108-r3/rollback-1.3.45` 并核对；正式入口包内版本1.3.46，正式profile启动读取标题、2条会话和模型一/二/三标签，进程正常退出；`conversations.json`、`model-connection.json`、`settings.json` 前后哈希不变。正式工作区模型UI 5/5通过，报告 `release/model-debate-20261108-r3/formal-workspace-ui/workspace-model-ui.json`。

## 已知限制、风险和待办

- 固定交接文件此前被删除，本文件为依据最新检查点补建的本轮真实草稿。
- 当前 `workbench` 存在大量用户未提交改动；每次写入前需核对直接基线。
- 模型角色文案阶段与三模型讨论流程均已完成候选验收。用量账本已将 `debate-proposal`、`debate-review` 纳入阶段白名单，并通过持久化回读及8项候选UI验收；没有待完成的本轮功能验证。
- 已确认并修复的本轮问题：序列化归一化配置时覆盖原始 `strings` 对象；同目录并发读-改-写丢失浏览器键。配置目录写队列修复后定向 10/10、候选 UI 6/6 通过。
- 正式入口当前为1.3.49；本轮回滚目录为 `release/formal-build-1.3.49-20261108/rollback-1.3.48`。模型公网请求未纳入本轮正式 EXE 重启验收，公网供应商兼容性仍需单独授权和测试条件。
- 候选UI专用 fixture 的删除操作被自动审批策略拒绝，未重试删除；已从测试输出目录移动到 `手动删除/model-debate-20261108-r2-fixture-02c7e326-1426-4c50-b319-54de5246c9c8`，原路径已核实不存在，待手动删除。验收报告与截图保留在 `release/model-debate-20261108-r2/team-ui/`。
- 1.3.46正式入口完整团队UI复跑在第5项附近遇到CDP `Runtime.evaluate`超时，报告 `release/model-debate-20261108-r3/formal-ui/model-team-ui.json` 保留为失败证据；同一正式入口的工作区模型UI 5/5和正式profile最小回归通过，未将该失败报告标为通过。1.3.47正式入口采用不依赖审批的 `restart-only` 2/2复验通过。

## 运行、迁移和回滚

- 目标正式入口：`E:/GDP/Scodex/App/Scodex工作台.exe`。
- 本轮候选输出到 `release/formal-build-1.3.51-20261108/candidate/win-unpacked`；正式入口已替换为1.3.51候选 EXE/ASAR。回滚目录 `release/formal-build-1.3.51-20261108/rollback-1.3.50` 保存替换前应用文件，回滚只恢复应用文件，不改用户数据和配置。
- 回滚仅恢复 `Scodex工作台.exe` 与 `resources/app.asar` 到1.3.50备份，保留用户数据和配置；构建与替换证据为 `release/formal-build-1.3.51-20261108/` 下的候选、回滚和正式验收报告。
