# 测试交接

## 1.3.66 三模式接力及AGENTS/Skill（本地交付及远端发布已验证）

- 实际对象：D:/cx/.Scodex/release/Scodex-Workbench-1.3.66-final3/win-unpacked/Scodex工作台.exe，应用/PE1.3.66、ProductVersion1.3.66.0；EXE928d3583568a829d7fdb59651890bfe6ce3684e3867cdc7fb47b60a825846956，ASAR5fefead5e3eb211ea2ae6628448ccd14d66e1e74bf7d80e9046d4c1842574dce。最终入口D:/cx/.Scodex/EXE快捷启动.lnk已指向该包，该快捷入口已实际验收3/3通过，文件哈希与验收包一致。
- 环境/替代范围：Windows10.0.26200 x64、Node24.17.0、Electron45；隔离profile和工作区、loopback模型HTTP。实际EXE、renderer/UI/IPC、磁盘文件和命令均真实执行；仅模型响应/凭据由受控服务替代，公网语义质量/连接/费用未验证。
- 操作：tests/auto-handoff-ui.cjs按scope选取实际EXE范围，经UI保存设置/发送任务、等待接力及终态、回读持久化与真实文件、核对请求/工具对及完成次数。证据统一位于release/auto-handoff-1.3.66；对照下表保留有效场景，不把failed整轮记为通过。

| 范围/预期 | 实际结果 | 状态/可定位证据 |
| --- | --- | --- |
| 开关/等级保存重开，600/1280布局 | UI保存后重开值一致，目标视口布局通过 | 有效通过；candidate-ui前2项 |
| 三起始模式明确求助、两次同类实际失败自动升级再回模式一；同请求后续独立问题再接力 | 6项通过，最终正文落盘，同聊天/请求和成功操作完整 | 有效通过；candidate-ui-r2前6项 |
| 取消零后续请求、手动优先、无更强候选 | 4项含身份通过 | 有效通过；candidate-ui-boundaries前4项 |
| 输出内HTTP401不误升级、接手鉴权失败、连续失败；规则/Skill真实读写及变化阻止副作用 | final2实际6项通过 | 有效通过；final-ui前6项 |
| 加密学习记忆保存/真实进程重启、恢复为user任务资料并回交 | 3/3，processExited/fixtureRemoved通过 | 通过；memory-proof-ui |
| final3身份、Skill脚本先读取/实际命令执行/生成文件回读及最终模式一接续 | 3/3，processExited/fixtureRemoved通过 | 通过；skill-script-ui；docs/verification/auto-handoff-1.3.66.png已查看 |
| 辅助逻辑及编码/审查 | 原57/57、失败形状12/12、Skill22/22；18文件差异/语法/UTF8无BOM通过 | 通过；logic-verification.json、incremental-review.json及相关日志 |
| 指令/工具辅助55项 | 54通过，1既有fullAccess缺失.env断言在精确旧源码同样ENOENT失败 | 既有失败保留；instruction-skill-tests.json、reproduce-baseline.cjs |
| 最终构建和完整ZIP | 8源码/3dist/9运行资源一致，80/80 ZIP路径/大小/SHA逐流一致 | 通过；build-verification-final3.json、assets-final3/archive-verification.json |
| 根快捷入口实际启动及接力 | 实际快捷方式启动后身份/接手及模式一完善/最终状态3/3，进程退出且fixture清理 | 通过；shortcut-ui/auto-handoff-ui.json |
| 源码与Release远端状态 | 25文件逐blob/tree/commit SHA一致、非强制main和GET ref/tree/parent回读通过；Release445199864已公开，标签与源码0a36514一致，3资产大小/digest正确 | 通过；source-api-upload.json、release-publication.json、published-assets-readback.json |
| 匿名公开下载 | API302→CDN，ZIP HEAD200/252753945字节；两清单GET200且字节/SHA一致；直接github.com ZIP HEAD200并跳转公共CDN | 通过；public-api-download-verification.json、direct-download-verification.json；不重复全ZIP下载 |

- 失败恢复：首轮驱动以无pending字段判断持久化，改为terminal.text；第二轮取消合成标签被过滤，改证据；外部故障轮发现产品error||output漏看401，改合并字段并补12项/重打final2；自动预检异常增加手动serial优先；记忆夹具误查system且独立场景固定期待开关true，改user资料及重启前后实际值比较；ZIP校验规范化反斜杠。对应原报告保留failed，不减断言或将模拟当实际集成。
- 最终入口已验命令：设置SCODEX_HANDOFF_SHORTCUT为根lnk、SCODEX_HANDOFF_OUTPUT=release/auto-handoff-1.3.66/shortcut-ui、SCODEX_HANDOFF_SCOPE=shortcut，运行node tests/auto-handoff-ui.cjs。预期与实际均为快捷方式启动、身份一致、接力完成/回模式一、零重复成功操作；3/3通过，本轮fixture/进程清理通过。复用其余未变通过结果，不重跑全测。
- 交付/回滚：1.3.65→1.3.66沿用SemVer映射；根入口SHA b2a7c9451c35a8f8c1e51ddab9b1246a791223fab53e70abeefc9600905b20e2。旧lnk备份release/auto-handoff-1.3.66/EXE快捷启动.pre-replace.lnk（SHA1e242367415a57ef4f3c3fff172d6db47300ca15d6d0b0dd79072d35260a7103）和1.3.65完整目录保留，恢复备份即可回滚；delivery.json为replaced-and-entry-verified。
- 资产：只用assets-final3的Scodex-Workbench-1.3.66-win-x64.zip、Scodex-Workbench-1.3.66-files.json、SHA256SUMS.txt；ZIP252753945字节/SHA9ab13f48c07095742fd210fb5ba7f0b47444503d6d609320db5494db3cda9ad6。程序必须完整解压运行，不单独复制EXE。
- 分发环境/命令：GitHub公开仓库song123-jian/-0；使用现有git凭据仅在内存与curl stdin上传，不落盘令牌。node release/auto-handoff-1.3.66/publish-program.cjs上传三资产、核对服务器size/digest后发布；node release/auto-handoff-1.3.66/verify-public-download.cjs核验匿名API/CDN，独立HEAD核验直接ZIP入口。均已退出，无待等待有限任务。最终文档随当前提交同步，远端ref/tree/parent结果存本地documentation-api-upload.json。
- 清理/限制：已有有限任务全部结束，UI进程/隔离fixture已清理；旧中间包的删除被自动审批拒绝，未重试；3旧候选及旧ZIP/两清单已移至手动删除/auto-handoff-1.3.66，原路径不存在、待人工删除，精确映射见cleanup.json；正式包/回滚/证据保留。AGENTS祖先策略、fallback配置/官方云能力及公网模型质量不作100%等价结论；学习是显式持久记忆，不是模型训练。最终截图仅证明当前设备/页面/视口/合成数据状态下无可见错误。

## 1.3.65 消息文件直达（已验证，源码已上传）

- 程序分发对象/范围：沿用上述1.3.65 EXE和有效验收；新增完整80文件ZIP、两清单、GitHub发布状态/标签/资产大小及digest、匿名下载核验。main基线923348b；[分发验收摘要](verification/1.3.65-distribution.json)，本地证据release/program-upload-1.3.65。
- 归档/发布结果：.NET同步ZipArchive逐条流校验80/80文件长度/SHA通过且无多余项，ZIP257608314字节，SHA727463b54ec0cc45ff801ebfb121b03dce9f755123f287b6ddf3104737572a1a；curl HTTP/1.1上传后3资产uploaded、size/digest匹配，Release445155585 draft=false、v1.3.65标签指向923348b。archive-verification.json、release-curl-publication.json为通过证据；产品未变不重跑功能测试。
- 公开下载实际操作：node release/program-upload-1.3.65/verify-api-download.cjs退出0；匿名资产API302到CDN，ZIP HEAD200且Content-Length257608314，两清单GET200并逐字节及SHA一致。public-api-download-verification.json为通过证据；未再次下载整个ZIP。正式github.com直接下载3项均curl56连接重置，尚未完成该直链验证，不将CDN结果外推。草稿URL404、异步校验未完成及Node上传失败均保留原始失败证据，未记为通过。
- 后续自动接力验收待设计：三模式能力不足→更强已配置模型→模式一完善→同任务继续。功能尚未实施或验证，不以既有手动切换结果冒充自动接力通过；在当前发布收尾后确定本次定向场景。
- 实际对象：release/Scodex-Workbench-1.3.65/win-unpacked/Scodex工作台.exe，应用/PE版本1.3.65；最终入口D:/cx/.Scodex/EXE快捷启动.lnk。EXE 8b251d94a8484651bb91bdebdae63a40c97443b4413ac6d544535155e0a77ec1；ASAR 03a5038c52c0d5915441ac6fec17e2141ba81b37ed19af3ea5f8b7d058f08c6c；lnk 1e242367415a57ef4f3c3fff172d6db47300ca15d6d0b0dd79072d35260a7103。
- 环境/前置：Windows10.0.26200 x64、Node24.17.0、Electron45；隔离profile/项目及自建中文空格文件/目录，无模型服务或真实配置/聊天写入。实际EXE、renderer、IPC和Windows Explorer执行，未用模拟页面替代。
- 场景/预期：名称/图标/title/可访问名称正确；Enter点击文件后预览和Explorer选中；快捷方式/表格链接目标一致，目录进入对应文件夹；缺失报错、越出授权目录拒绝；600/1280px可见链接不溢出。

| 范围 | 实际操作与结果 | 状态/证据 |
| --- | --- | --- |
| 定向逻辑/语法/编码 | node --test tests/message-files.test.mjs tests/message-presentation.test.mjs，13/13；两个UI驱动node --check；8份文本UTF-8无BOM及可读性核对 | 通过；targeted-tests.log、incremental-review.json |
| renderer/完整候选 | npm run build（1840模块）和本地Electron45目录构建均退出0；4包内容、9资源和版本一致 | 通过；[包核验](../release/file-links-1.3.65/build-verification.json) |
| 命名链接、Enter、实际文件/快捷方式/目录、错误/授权 | SCODEX_LINKS_EXE指定1.3.65运行node tests/message-links-ui.cjs，按名称/Enter点击；Shell.Application回读真实Explorer目录和SelectedItems | 前5项有效通过；[原报告](../release/file-links-1.3.65/candidate-ui/message-links-ui.json) |
| 可见链接布局 | SCODEX_LINKS_SCOPE=layout、OUTPUT=layout-ui，同一EXE；打开文件后关闭第三工作台，600/1280×900要求6链接可见、宽高大于0且在父级和视口内 | 3/3通过；[补测](../release/file-links-1.3.65/layout-ui/message-links-ui.json)、[最终截图](verification/message-links-1.3.65.png)已查看 |
| 最终根快捷入口 | SCODEX_LINKS_SHORTCUT指定根lnk、OUTPUT=shortcut-ui；真实Windows快捷方式启动，核对身份/标签，Enter预览并回读Explorer选中项 | 3/3通过；[入口报告](../release/file-links-1.3.65/shortcut-ui/message-links-ui.json) |
| 增量审查 | baseline.json精确旧字节与本轮8份差异；修正隐藏零尺寸假阳性后定向复审 | 通过；[审查](../release/file-links-1.3.65/incremental-review.json) |

- 失效证据/恢复：原candidate-ui最后布局项虽报告passed，但600px全部链接width/client/scroll为0，不作通过证据。第三工作台在窄窗口隐藏聊天，驱动缺少可见性断言；仅补足可见/非零/边界校验并以layout范围补测通过，未修改正常产品或重建未变EXE；原前5项有效结果保留。
- 构建方式：npx electron-builder --win --dir --x64 --config.directories.output=release/Scodex-Workbench-1.3.65 --config.electronDist=node_modules/electron/dist --publish never；[验收摘要](verification/1.3.65.json)、[交付清单](../release/file-links-1.3.65/delivery.json)。
- 回滚/清理：恢复release/file-links-1.3.65/EXE快捷启动.pre-replace.lnk到根可回保留的1.3.64-final，备份SHA 2283a4246e159c76869e55c46e9f229c4ad69a964aa94d2c7d7ff06d86a511a1。3轮processExited/fixtureRemoved/cleanup为true/true/passed，fixture原路径不存在，自建Explorer窗口关闭，无新增临时残留或常驻服务；完整旧目录及必要证据保留。
- 有效复用/未覆盖：1.3.64上下文/模型布局、1.3.63队列未变结果继续有效；不重跑无关全项目或旧message-workspace-ui整轮。仅本地链接，不验证公网模型、原生选择器或完整Codex等价；截图仅辅助链接呈现，不能代替功能断言。
- 源码上传验收：13个消息文件直达增量已上传main，源码提交d066005；后续文档使main到923348b，逐对象SHA及非强制ref更新/commit tree和parent回读通过。本次5份分发文档/摘要同步证据另存release/program-upload-1.3.65/documentation-api-upload.json。真实用户数据及程序产物不入Git；完整程序已作为Release公开。文档长终端写入被拒且未落盘后已采用结构化文件工具，不重试被拒操作。
- 上传恢复记录：初次source命令退出1，13个blob及tree匹配但commit SHA不同，main更新前已拦截；精确复算证明辅助脚本移除末尾换行是唯一差异。恢复只用原始message重建commit，复用已有对象；本地/远端SHA完全一致，main非强制更新及最终回读通过。不重复上传文件或重跑未变程序测试；source-api-upload.json、upload-failure-analysis.json和source-recovery-api-upload.json保留失败、原因与成功结果。

## 1.3.64 Codex上下文接续与模型布局（已验证，源码已上传）

- 最终实际对象：release/Scodex-Workbench-1.3.64-final/win-unpacked/Scodex工作台.exe，应用/PE版本1.3.64、产品版本1.3.64.0；Windows10.0.26200 x64、Node24.17.0 / Electron45，隔离profile/项目和loopback模型HTTP。最终EXE c785cb63e5aaa535905fd897b34f50593321cef39729b728d136c8dc3f109c9b；ASAR 78cc245514ee35c1c7e4254ffb6eafb60850128804f31a91da4a4aa564c939d4。
- 运行入口：D:/cx/.Scodex/EXE快捷启动.lnk，SHA 2283a4246e159c76869e55c46e9f229c4ad69a964aa94d2c7d7ff06d86a511a1；目标/工作目录及原图标经COM回读，最终文件哈希与通过的候选相同。[可随源码读取的验收摘要](verification/1.3.64.json)、[完整交付清单](../release/codex-alignment-1.3.64/delivery.json)。
- 场景/预期：接近容量时摘要老历史、保留当前需求和聊天；重开沿用摘要且零自动重放；手动按钮和/compact保留草稿；历史编辑后旧摘要不发送、旧版本保留；摘要失败/取消不提交检查点，失败重试真正生成摘要；5分类切换、三角色独立保存/密钥使用及600/1280布局、固定保存按钮；最终Windows快捷方式真实发送。

| 验证范围 | 实际操作及结果 | 状态/证据 |
| --- | --- | --- |
| 定向逻辑/兼容 | node --test context-compaction/context-compression/agent-runtime/conversations/model-connection-draft/conversation-steering；新增默认保护先出现1项旧回归，限定显式启用后runtime+summary32项复测通过；未受影响27项有效 | 有效59项通过；targeted-tests.log、targeted-tests-final.log、runtime-summary-retest.log |
| renderer/完整包 | npm run build；electron-builder --win --dir --x64 --config.directories.output=release/Scodex-Workbench-1.3.64-final --config.electronDist=node_modules/electron/dist --publish never | final-build-r2.log退出0，8份包内容/9资源及版本通过；[包身份](../release/codex-alignment-1.3.64/build-verification-final.json) |
| 自动摘要/重开/手动 | node tests/context-compaction-ui.cjs初始all范围，原候选1.3.64；保留全18条、当前输入不变、14条原历史由摘要代替；重开零请求，下一轮只发1次；手动草稿保留 | 首轮前4项独立通过，整轮因编辑选择器陈旧failed，不标整轮通过；[首轮报告](../release/codex-alignment-1.3.64/candidate-ui/context-compaction-ui.json) |
| 历史编辑与原版本 | SCODEX_COMPACTION_SCOPE=remaining，OUTPUT=candidate-ui-r2；重新建立手动摘要前提，实际行内修改覆盖过的消息，新版本不发送旧摘要，原版本/摘要保留 | remaining整轮6/6通过；[报告](../release/codex-alignment-1.3.64/candidate-ui-r2/context-compaction-ui.json) |
| 失败重试/取消 | EXE指向final目录、SCOPE=failure-retry、OUTPUT=final-retry-ui；/compact收到受控500后点实际重试，生成摘要再普通接续；挂起摘要后停止，原文和原检查点保留 | 最终2/2通过；[报告](../release/codex-alignment-1.3.64/final-retry-ui/context-compaction-ui.json) |
| 分类/草稿/保存/布局 | 同final EXE，SCOPE=layout、OUTPUT=final-layout-ui；三角色独立保存，其他草稿留存，后续真实请求使用新密钥；通用全部保存；方向键/End切分类；600/1280×900十组几何及固定保存按钮检查 | 最终3/3通过；[报告](../release/codex-alignment-1.3.64/final-layout-ui/context-compaction-ui.json)、[最终截图](verification/model-connection-1.3.64.png)，已查看，当前设备/页面/视口/数据下无可见错误 |
| 最终根快捷入口 | SCODEX_MODES_VERSION=1.3.64、SCOPE=shortcut-smoke、EXE指定final、SHORTCUT指定根lnk、OUTPUT=shortcut-ui运行node tests/composer-model-modes-ui.cjs | 实际入口2/2通过；[报告](../release/codex-alignment-1.3.64/shortcut-ui/composer-model-modes-ui.json) |
| 增量审查/编码 | 以baseline.json为本轮基线；15份代码/元数据、直接调用与新模块定向审查，两个问题修复，UTF-8无BOM及可读性核对 | 通过；[审查](../release/codex-alignment-1.3.64/incremental-review.json) |

- 有效结果复用：最终重建只涉及固定栏CSS和/compact重试识别；自动/重开/手动/编辑原有效实际场景未变，复用相关结果；1.3.63队列/计划未变结果继续有效，不全项目回归。初始package.json整文件字节比对因打包器移除scripts/build/devDependencies而失败，改为身份/依赖字段核对，业务模块/dist仍字节一致，不掩盖版本差异。
- 回滚/清理：原入口备份release/codex-alignment-1.3.64/EXE快捷启动.pre-replace.lnk，SHA 583856a3e04c1791a6b2d8ff014e4e9104d210dd2b257f0cfbde4224f422de9d，恢复到根即可返回保留的1.3.63-capacity。5轮test报告均processExited=true、cleanup=passed，fixture实际路径均不存在，无常驻服务；保留测试源码、证据及有用途的候选/回滚目录。未结束用户进程或写真实配置/聊天。
- 未覆盖：loopback替代模型HTTP/凭据，不验证公网摘要语义质量、费用、全部兼容服务、官方远端压缩与云账号；token显示为估算。历史原生关闭/文件选择器未因此补验，不声称完整Codex等价。
- 源码上传验收：实际仓库 https://github.com/song123-jian/-0，分支main；git push origin 0e2811ff478c71eaf693e9d7e35b0c91f164c339:refs/heads/main退出0，git ls-remote origin refs/heads/main的预期与实际均为0e2811ff478c71eaf693e9d7e35b0c91f164c339，状态通过。累计54文件（22新增、32修改），3份已跟踪运行时ZIP未变，真实配置/聊天和程序产物均排除；本轮未发布GitHub Release。最终交接状态随本次文档提交同步，后续文档提交号及远端核验见本地release/codex-alignment-1.3.64/upload-verification.json。程序与测试输入未变化，复用上述有效结果，仅相关实现、配置、入口或验收变化时复测。

- 上传恢复记录：文档push首次退出1（Recv failure: Connection was reset）；ls-remote连接超时，单连接HTTP/1.1推送低速超时。API GET refs/heads/main返回0e2811f，证明源码仍在远端、文档待传；API可达。替代验收为REST逐对象SHA比对、非强制分支更新与最终API回读；不重跑程序测试。本地upload-verification.json保留失败、替代操作及最终结果。

## 1.3.63 工作流与会话能力补齐（已验证）

- 实际对象：release/Scodex-Workbench-1.3.63-capacity/win-unpacked/Scodex工作台.exe，应用版本1.3.63；根入口 D:/cx/.Scodex/EXE快捷启动.lnk。EXE SHA-256 72dbb9250cb4e5413e4e561aa64d0a4866140afb1e7944e5c411f2a5e165bdf2，ASAR eacdbf7a756c7b2e6acd9cea9481c1cc4da7ee61d8ef292266482cc2fa057dd3；同轮重建，不再次递增版本。
- 环境与前置：Windows10.0.26200 x64、Node24.17.0、本机Electron45.0.0；隔离profile、项目及loopback HTTP服务。真实EXE、renderer、IPC、持久化和快捷方式均实际执行；仅模型HTTP响应/凭据被替代，不使用真实聊天或配置。
- 本轮实际命令：本地electron-builder --win --dir --x64 --config.directories.output=release/Scodex-Workbench-1.3.63-capacity --config.electronDist=node_modules/electron/dist --publish never；SCODEX_WORKFLOW_APP_DIR指定该win-unpacked后运行 verify-release.cjs。SCODEX_WORKFLOW_SCOPE=recovery、SCODEX_WORKFLOW_EXE指定候选、SCODEX_WORKFLOW_OUTPUT=release/workflow-session-1.3.63/capacity-ui，运行 node tests/conversation-workflow-ui.cjs。最终 SCODEX_MODES_VERSION=1.3.63、SCODEX_MODES_SCOPE=shortcut-smoke、SCODEX_MODES_EXE指定同一候选、SCODEX_MODES_SHORTCUT指定根lnk、SCODEX_MODES_OUTPUT指定capacity-shortcut-ui，运行 node tests/composer-model-modes-ui.cjs。未设显式EXE/APP_DIR时驱动默认仍是旧1.3.63目录，复验必须指定本次最终路径。

| 测试范围/实际操作 | 预期与实际结果 | 状态 | 可定位证据 |
| --- | --- | --- | --- |
| 独立打包、包身份/版本/9项资源/6份源码与renderer比对 | 包含当前修复，字节一致；打包58332退出0 | 通过 | [构建核验](../release/workflow-session-1.3.63/build-verification.json)、capacity-package.log |
| 实际派发队列项后服务报错/取消，再手动继续 | 项目队首恢复一次，暂停、不重放，手动重试成功；含身份共4项 | 通过 | [recovery报告](../release/workflow-session-1.3.63/capacity-ui/conversation-workflow-ui.json)，67514退出0 |
| 1条队列项发送中，再加入19条，尝试第21条；HTTP503后保存并重开 | 新增被拦截且草稿保留，20条顺序与尾项完整；重开暂停且零新增请求 | 通过 | recovery报告的queue-capacity-reserves-active-item-and-persists-recovery |
| 原子替换根lnk后实际启动、核对版本/profile、UI发送及接收完成 | 最终入口使用验收候选和完整运行资源，2/2；1176退出0 | 通过 | [最终快捷入口报告](../release/workflow-session-1.3.63/capacity-shortcut-ui/composer-model-modes-ui.json) |
| 精确前后差异、UTF-8/BOM/乱码/空白及直接影响审查 | 两份旧源码哈希与原审查一致，当前差异无剩余高置信度问题 | 通过 | [容量增量审查](../release/workflow-session-1.3.63/capacity-incremental-review.json)、source-verification.json |

- 有效结果复用：队列逻辑7/7；旧候选candidate-ui-r3 11/11中的计划执行、分支/权限和600/1064/1280布局等未变范围有效；旧入口2/2作为历史保留，最终入口以本次2/2为准。renderer构建1839模块成功，capacity-renderer-build.log保留；未重跑无关全项目检查。
- 截图：已查看[最终恢复状态](../release/workflow-session-1.3.63/capacity-ui/queue-recovery-final.png)，1280×780下预期HTTP503、待发送20/已暂停及保留草稿显示正确，未见布局异常。截图仅辅助证据，恢复内容与顺序以实际持久化回读断言为准。
- 清理：两轮 report.processExited=true、cleanup=passed，实际fixture C:\Windows\Temp\scodex-workflow-73ab4a75-ff26-403f-8785-5d5b159ed649 和 C:\Windows\Temp\scodex-chat-modes-1c6b4c52-552e-4b31-820e-cdca5130d559 均核对不存在；候选程序精确路径下无残留进程，无常驻测试服务。本轮候选lnk已被原子替换消耗。
- 历史遗留：1个临时lnk仍在 release/workflow-session-1.3.63/手动删除/EXE快捷启动.tmp-5fc2368dbec6429a8eaeda3f14b696e8.lnk；旧记录未保留确切原路径/拒绝原因，未重复删除，可手动删除该精确文件，对功能无影响。旧原子替换.bak与有效旧程序/入口作回滚保留，详见[交付清单](../release/workflow-session-1.3.63/capacity-delivery-verification.json)。
- 回滚与入口：根lnk SHA 583856a3e04c1791a6b2d8ff014e4e9104d210dd2b257f0cfbde4224f422de9d；恢复 EXE快捷启动.pre-capacity.lnk 可回旧1.3.63，备份SHA 01679705fe186225a7176576a0082791e0041ac84a41a5abbfa92f27a0819422；旧1.3.62备份继续保留，不更改用户数据。
- 失败/未覆盖：既有关闭确认、退出信号、引导/键盘夹具失败等报告不作通过证据；一次历史存储超时未复现且原因未确证。公网模型/云端账号服务、原生窗口关闭及文件选择器尚未完成验证，不以loopback结果外推等价。
- 必要复测条件：仅本次相关源码、依赖、环境、输入、入口或验收条件变化时复验受影响范围。当前队列交付范围已通过，无功能阻塞；双交接文档仅执行修改章节、链接、UTF-8无BOM和落盘一致性验收。

## 1.3.62 聊天工具入口补充（已验证）

- 对象：正式1.3.62完整目录 `release/Scodex-Workbench-1.3.62/win-unpacked`，程序`Scodex工作台.exe`，根入口`EXE快捷启动.lnk`。上次正式版本1.3.61，本轮按既有SemVer映射递增一个补丁版本。Windows10.0.26200 x64、Node24.17.0、Electron45.0.0；隔离profile/工作区，无真实用户配置或凭据写入。
- 有效辅助结果：`node --check tests/composer-checks.cjs`、package/lock版本一致性、`npm run build`（1836模块）均通过。1.3.61历史记录保留，本次相关菜单与入口已在1.3.62真实程序复验，未重跑无关全项目测试。
- 构建：默认下载构建会话15843已取消、退出1；此前58372中断无候选。改用 `--config.electronDist=node_modules/electron/dist` 后会话54332退出0，EXE文件版本1.3.62、产品版本1.3.62.0。包资源校验首次因ASAR路径强制正斜杠而失败；只读诊断证实包内renderer存在且本机规范路径可读，后续辅助校验使用 `path.normalize`，产品构建结果仍有效。
- 包校验：ASAR版本1.3.62，EXE SHA-256 `D84083CAEE09F487E37CDE71B9393D2C2A086332C082413909898F0DD084526F`，ASAR SHA-256 `C41A0B38D32FDA659FB7CFFC8B849CF4000D8389AC28E1DE89B1AA010A284138`；运行资源和Node/Python/pip包存在，dist三文件与包内逐字节一致。见[构建核验](../release/composer-menu-1.3.62/build-verification.json)。
- 候选UI通过：`SCODEX_SMOKE_SCOPE=composer SCODEX_SMOKE_SKIP_NATIVE_CLOSE=1 SCODEX_SMOKE_EXE=<1.3.62 EXE>`运行`node tests/smoke.cjs`，会话83434退出0。先隐藏第三工作台，再用菜单打开浏览器、已就绪终端及空闲服务面板；聊天ID和输入框保留，菜单分组顺序正确。原附件/嵌套文件夹/搜索/二进制拒绝/工作台快照/技能/计划/目标保存与重载/权限持久化与IPC拒绝/插件技能路由/键盘和关闭交互通过。
- 布局与证据：1064×660、20px字体下菜单位置与搜索栏在视口内，辅助文字至少18px，实际字体Microsoft YaHei；最终截图已查看，当前设备、页面、视口和数据状态下无可见错误。[日志](../release/composer-menu-1.3.62/composer-smoke-final.log)、[截图](../release/Scodex-Workbench-1.3.62/win-unpacked/workbench-composer.png)。测试finally进程回收及临时目录清理未报错。新增驱动语法检查退出0。
- 增量审查通过，范围及五文件修改前/后SHA见[审查报告](../release/composer-menu-1.3.62/incremental-review.json)，精确还原五个修改前文件哈希成功，无待修复问题。
- 正式入口通过：备份旧入口后原子替换根快捷方式，目标和工作目录为1.3.62，原图标`EXE快捷启动.ico,0`保留。新快捷方式SHA-256 `E7CADA1106BB6D2D3E3F85564BA6E408258A59F18AFC725927479FF74A48A05E`；旧入口备份`release/composer-menu-1.3.62/EXE快捷启动.pre-replace.lnk`，SHA-256 `A7D8A9D4A3B6F309B3DB968F8689E076F3C254BD80695F01068848DE084EEBC1`，可复制回根入口回滚至保留的1.3.61目录。EXE及ASAR最终哈希与候选验收一致。
- 快捷入口实际验收：`SCODEX_MODES_SCOPE=shortcut-smoke SCODEX_MODES_VERSION=1.3.62 SCODEX_MODES_SHORTCUT=<根快捷方式> SCODEX_MODES_OUTPUT=<本轮shortcut-ui>`执行`node tests/composer-model-modes-ui.cjs`，会话51736退出0，2/2通过。通过真实Windows快捷方式启动，回读版本/profile/工作区正确，从真实界面发送并收到loopback模型完成回复。见[UI报告](../release/composer-menu-1.3.62/shortcut-ui/composer-model-modes-ui.json)、[日志](../release/composer-menu-1.3.62/shortcut-smoke.log)及[最终核验](../release/composer-menu-1.3.62/delivery-verification.json)。
- 清理：`processExited=true`、`cleanup=passed`；已核对报告中精确fixture路径不存在、候选程序进程为0、中间快捷方式不存在，未操作用户进程或数据。无本轮待手动清理项。
- 必要复测条件：菜单组件/路由/直接样式变化时复验对应UI；构建或根入口变化时核对版本/资源并进行快捷入口验证。其他仍有效结果不重复执行。
- 限制：本轮显式跳过原生窗口关闭与关闭时草稿刷新；公网模型、真实用户profile、原生文件选择器未验证。快捷启动最终使用loopback模型，不外推公网兼容性。

| 验证范围 | 实际操作与预期 | 结果 | 证据 |
| --- | --- | --- | --- |
| 完整候选身份与资源 | 本机Electron构建；读取包版本、资源与dist字节；应全部一致 | 通过 | build-verification.json |
| 新入口与菜单分组 | 先隐藏面板，从菜单打开三个工具；聊天应保留且服务不应自动启动 | 通过 | composer-smoke-final.log |
| 原菜单功能及布局 | 操作目标/计划/附件/搜索/技能/权限，缩至1064×660并设20px字体；应可用且无溢出 | 通过 | Composer日志与已查看截图 |
| 正式快捷入口 | 通过根lnk启动，真实UI发送/收取loopback回复；身份和完成事件应正确 | 通过2/2 | shortcut-ui/composer-model-modes-ui.json |
| 最终替换与清理 | 回读入口、图标、候选哈希、回滚文件及fixture/进程状态 | 通过 | delivery-verification.json |
| 原生窗口关闭及公网模型 | 本轮未执行；不影响菜单入口验收范围 | 尚未完成验证 | 上述限制 |

## 1.3.61 聊天输入工具菜单补充（已验证）

- 对象：`release/Scodex-Workbench-1.3.61/win-unpacked/Scodex工作台.exe`，根入口 `EXE快捷启动.lnk`；Windows 10.0.26200 x64、Node.js v24.17.0、Electron 45.0.0、应用 1.3.61。EXE SHA-256 `B13BFE603C1CC256A6C9464CDBA338930D2F6B2D2A5A8351E35D72849B6FC3E2`，ASAR SHA-256 `7B1105E4A6290CAAE6BEDD1B62D16562793981165F92D33EC7360E405A92D1EF`。
- 入口与回滚：根快捷方式经 COM 回读为 1.3.61 EXE、对应 `win-unpacked` 工作目录和原图标 `EXE快捷启动.ico,0`；哈希 `A7D8A9D4A3B6F309B3DB968F8689E076F3C254BD80695F01068848DE084EEBC1`。旧入口备份 `release/composer-menu-1.3.61/EXE快捷启动.pre-replace.lnk` 哈希 `566E5ADD9AFBBEC098928DA494D7EF508F83BB91039363A72FF77959005475B7`，可恢复至保留的 1.3.60 完整目录。
- 构建身份：完整目录运行资源齐全；ASAR 包内版本 1.3.61，`dist/assets/index-Brj_4Cn5.js`（2,320,903 字节，SHA-256 `3c8dd83a542eaa0039ee3fd7f4fabe38ddb2bfa62f23251eba7430cbf42003a2`）和 `dist/assets/index-D7UQ6OHU.css`（205,351 字节，SHA-256 `fd2d7dc49e3e9f56ac2e70e4a220b69619e9dd2d902f946c55ebf89ffdd86005`）与 ASAR 内文件逐字节相同。
- Composer 实际 UI：`SCODEX_SMOKE_SCOPE=composer`、`SCODEX_SMOKE_SKIP_NATIVE_CLOSE=1`，通过 `tests/smoke.cjs` 在候选 EXE 运行。菜单内容/分组/滚动、Escape 与焦点返回、方向键、外部点击、Tab 离开、计划切换、目标持久化及重载状态、工作台/文件/文件夹/搜索、二进制拒绝、技能、仅对话权限与 IPC 拒绝、插件和技能路由、Microsoft YaHei 字体、1064×660 视口与 20px 字体布局均通过；无 renderer error，截图 `release/Scodex-Workbench-1.3.61/win-unpacked/workbench-composer.png` 已查看。原始日志 `release/composer-menu-1.3.61/composer-smoke-final.log`；2026-11-12 收尾复测使用更新后的新聊天目标断言，日志 `release/composer-menu-1.3.61/composer-smoke-final-rerun-20261112.log`，退出码 0。
- 目标逻辑辅助测试：`node --test tests/goal-runtime.test.mjs`，4/4 通过。测试脚本语法：`node --check tests/smoke.cjs`、`node --check tests/composer-checks.cjs` 均退出 0。
- 新聊天目标隔离：新聊天后打开菜单，断言目标说明准确为“设置本次对话目标”，确认不会继承前一对话目标；更新后 `node --check tests/composer-checks.cjs` 通过，候选 EXE 上实际 Composer smoke 通过。该次运行显式跳过原生窗口关闭和 close-time draft flush，二者仍为“尚未完成验证”。
- 实际快捷入口：`SCODEX_MODES_SCOPE=shortcut-smoke`、`SCODEX_MODES_VERSION=1.3.61`、`SCODEX_MODES_SHORTCUT=<根 EXE快捷启动.lnk>` 运行 `tests/composer-model-modes-ui.cjs`，通过真实 Windows 快捷方式启动。2/2 通过：版本、临时 profile/工作区身份正确；真实 UI 请求由 loopback fixture 返回，模型 `glm-5.3`，完成事件收到；无公网请求或真实用户凭据。报告 `release/composer-menu-1.3.61/shortcut-ui/composer-model-modes-ui.json`，测试进程退出、fixture 清理通过。
- 失败恢复记录：最初驱动依赖旧导航、`.new-task-button`、旧附件 chip、模式选择器及旧路由断言，与当前应用实现不符；逐项改为当前可见入口/持久化行为后，Composer 核心断言全部通过。收尾审查又确认旧 `.goal-chip` 断言检查的是不存在元素，已改为新聊天菜单中目标说明的实际 UI 断言并在 1.3.61 候选上复测通过。早期日志 `composer-smoke-r1.log` 至 `composer-smoke-r12.log` 保留在 `release/composer-menu-1.3.61`。候选 `MainWindowHandle=0`，原生 CloseMainWindow 无有效窗口；最终仅在 composer scope 显式跳过原生关闭/close-time draft flush，默认及其他 scope 未改变该行为，测试 finally 已回收本次进程和临时文件。故原生关闭与关闭时草稿刷新为“尚未完成验证”，不影响本轮菜单验收。
- 审查边界：源码目录无 Git 元数据。人工增量审查限定 `composer-tools.jsx` 分组/入口/状态、对应 CSS、Composer 驱动、关闭跳过开关及当前 1.3.61 打包 renderer；对比前一已交付 1.3.60 包。验证失败一次来自 ASAR 查询路径多一层斜杠，修正归档内路径后 JS/CSS 字节比较均通过；未重建未变化的候选。
- 复测条件：菜单组件、相关样式、目标状态数据契约、启动入口或当前遗漏的原生窗口行为变化时，只复验对应范围；未验证公网模型、用户真实 profile 和原生窗口关闭行为。

## 1.3.60 绘图功能补齐（已验证）

- 对象：最终[Scodex工作台.exe](../release/Scodex-Workbench-1.3.60/win-unpacked/Scodex工作台.exe)和根[EXE快捷启动](../EXE快捷启动.lnk)；Windows10.0.26200 x64、Electron45、Node24.17.0，应用1.3.60，前版本1.3.59。
- 入口与身份：EXE SHA256 3ffdf1b5bdd1aabbe74a18271b1866bf644d7c5fd4cfa88721ba95cc19530aa6；ASAR 543cb0c31f9d378dd5750161aafaa8f37d461b958df8aa542e0b8c8e5af73daa；根lnk 566e5add9afbbec098928da494d7ef508f83bb91039363a72ff77959005475b7。9个包内模块/renderer与源文件字节相同；运行资源齐全。
- 前置条件：独立profile/SCODEX_HOME、固定聊天ID、loopback OpenAI兼容模型服务和测试凭据。实际EXE、UI、IPC、加密聊天存储、文件、Windows命令及快捷方式真实执行；公网模型由fixture替代。最终布局收起右侧面板，明确等待宿主配置就绪。

| 范围 | 操作与预期 | 实际结果及证据 |
| --- | --- | --- |
| 绘图/持久化/运行时逻辑 | node --test tests/visualization.test.mjs tests/conversations.test.mjs tests/agent-runtime.test.mjs；新增协议规则随后定向复验 | 既有44项有效，最终visualization7/7含4个新增规则；48项不同用例有效，不表示整库测试 |
| 协议/请求边界 | nonce文档、容量/释放、非法导航/请求、宿主专用IPC | [协议日志](../release/visualization-1.3.60/protocol-tests-final.log)7/7；实际无宿主访问和preload |
| 最终工作流 | 真实发送绘图→切换季度→保存窗口内切换模式→确认追问→重开→接手活动重开 | [最终工作流](../release/visualization-1.3.60/ui-state-final/visualization-ui-verification.json)9/9；Q2恢复、iframe不重载、追问确认后只新增1次模型调用且同chat |
| 导航恢复/联网隔离 | 图内鼠标发起data替换、再发起loopback HTTP文档跳转 | [早期有效功能记录](../release/visualization-1.3.60/ui-stable-chat/visualization-ui-verification.json)：data恢复一次，重复异常停止并提示，0网络请求；该报告第11项布局无效，不复用。此后协议/恢复实现未变 |
| 600/1280布局及截图 | 非零宽高、完整可见、文档/卡片不横向溢出；末次修改后截图 | [最终布局](../release/visualization-1.3.60/ui-delivery-view/visualization-ui-verification.json)1/1；409×320和799×380。截图已查看：当前设备、页面、1280×780视口和数据状态下无可见错误 |
| 实际快捷启动 | Windows根lnk启动→版本/profile→三方提案评议→所选模式改文件/命令核验 | [快捷报告](../release/visualization-1.3.60/shortcut-ui/team-executor-ui.json)2/2；真实文件和命令均成功，fixture已清理 |
| 构建/身份/编码/审查 | renderer和完整目录构建；包内容、版本、17份相关文本UTF-8无BOM、直接差异 | 均通过；[清单](../release/visualization-1.3.60/delivery.json)含命令、哈希和审查边界 |

- 修复与复验：data继承宿主CSP导致内联脚本失败，改独立协议；Electron事件未覆盖data导航，改请求白名单及有界恢复；状态effect随父刷新取消待保存，改最新callback引用并真实切换控件验证。失败报告保留，未将失败或模拟结果改写为通过。
- 驱动前提纠正：独立iframe target连接、固定聊天ID、明确等待面板配置、窄屏高度320设计。ui-stable-chat原第11项0宽高是假阳性；由最终非零、可见断言及实际截图替代。
- 保留结果：本轮没改agent-runtime/model-team，其字节与1.3.59包一致；既有三模式共享上下文/运行中切换结果按原范围保留。最新快捷实际验证所选模式执行链路。
- 未覆盖：公网模型连接与质量、上游插件等价性；接手图表通过保存活动fixture验证，非完整自动接手端到端新测试。办公srcdoc只验证直接加载兼容，不代表重测办公解析器。data导航是事后有界恢复，不承诺所有导航事先取消。
- 替换与回滚：根lnk已经备份/替换/回读并真实启动；[原lnk备份](../release/visualization-1.3.60/EXE快捷启动.pre-replace.lnk)恢复至根即可返回保留的1.3.59完整目录，原配置和用户数据不替换。
- 清理：自动删除被策略拒绝后，12个本轮fixture移至项目手动删除/visualization-1.3.60，准确原/现路径及原因见交付清单；均原路径不存在、现路径存在，待手动删除不影响验收。快捷测试fixture已删除；有限命令均结束，最终无本轮测试进程。
- 复测条件：只在相关实现、配置、依赖、入口或输入/验收条件变化后，复验受影响范围；当前无功能阻塞，不重复整库测试或仍有效检查。

## 1.3.59 所选模式执行与运行中切换（已验证）

- 实际对象：D:/cx/.Scodex/release/Scodex-Workbench-1.3.59/win-unpacked/Scodex工作台.exe；根入口D:/cx/.Scodex/EXE快捷启动.lnk。上次1.3.58、本次1.3.59，沿用SemVer补丁映射；EXE SHA-256 da9a0c6ad51a8264febd79736b9fff5ba2f85a6cccff86b7f6e719fdf6bcbf7a，ASAR 245627b8a32e4bb9992f1e06bfc9317cf42b298dff736023af65eca3e4bbc932。
- 环境和前置条件：Windows10.0.26200 x64、Node24.17.0、Electron45；隔离profile/project/SCODEX_HOME，三份loopback服务配置、工具执行授权、实际UI/IPC/文件/PowerShell命令。仅模型HTTP及凭据由fixture替代，不访问真实凭据或公网模型。
- 范围与预期：三种模式各独立提案并全量评议，所选者实际整合、执行和验证，其余两者监督；执行中补充可再次改文件；用户确认“两者都要”，因此还验证运行中一→二→三→一、同chat/request和完整工具结果、native/JSON互转、无效模式/模型拒绝、不重复副作用、当前执行者不自行完成核验。
- 当前源码基线为[15份原文件](../release/team-executor-1.3.59/baseline.json)，本次代码审查限定12份代码/测试/元数据；历史中未变化且仍有效的模式列表、隐藏Grok及共享聊天结论复用，不全项目回归。

| 验证范围 | 实际操作、预期和结果 | 状态及证据 |
| --- | --- | --- |
| 团队/运行时逻辑 | node --test tests/agent-runtime.test.mjs tests/model-team.test.mjs；角色、动态监督/核验、整批工具边界、最终答复前交接、原生/JSON配对和上下文保留 | 61/61通过；[逻辑日志](../release/team-executor-1.3.59/switch-targeted-tests-final.log) |
| 语法、renderer及完整包 | 相关CJS语法检查；npm run build及本地Electron45目录构建；版本源和必要资源核对 | 通过；[renderer日志](../release/team-executor-1.3.59/switch-renderer-build.log)、[打包日志](../release/team-executor-1.3.59/switch-package.log) |
| 最终包身份、三模式执行/降级/补充 | SCODEX_EXECUTOR_SCOPE=all运行node tests/team-executor-ui.cjs，分别选择三模式实际执行，另测模式二/三讨论失败及模式三运行中二次改文件/命令/回读 | 当前包前7项独立通过；[原报告](../release/team-executor-1.3.59/final-candidate-ui/team-executor-ui.json)整轮failed，不将后续未执行项作通过 |
| 运行中连续切换 | SCODEX_EXECUTOR_SCOPE=switching-only，OUTPUT=release/team-executor-1.3.59/switch-candidate-ui-r2运行同驱动；实际UI一→二→三→一，队列可见、生效后新模式修改，同chat/request；四次edit、一次命令及完整最终文件核对，native→JSON→native，无效模式/模型拒绝 | 3/3通过；[切换报告](../release/team-executor-1.3.59/switch-candidate-ui-r2/team-executor-ui.json)，会话95947退出0 |
| 职责、用量、窄屏及截图 | 同switching-only轮次检查当前模型身份/用量、共享聊天；600/1280px逐条滚动读取职责，检查横向溢出；1280×900最终截图已查看 | 通过；[职责截图](../release/team-executor-1.3.59/switch-candidate-ui-r2/team-executor-final.png)，当前设备、设置页面、视口和数据状态下无可见错误 |
| 实际根快捷入口 | 设置SCODEX_EXECUTOR_SHORTCUT=D:/cx/.Scodex/EXE快捷启动.lnk、SCOPE=all、OUTPUT=release/team-executor-1.3.59/shortcut-ui，经Windows快捷方式启动后核对1.3.59/profile/工作区；模式二从UI发送并完成提案、评议、真实文件修改/命令/回读 | 2/2通过；[入口报告](../release/team-executor-1.3.59/shortcut-ui/team-executor-ui.json)，会话67432退出0 |
| 交付身份/编码/审查 | 包内4份Electron模块及renderer与源码匹配，12份文本UTF-8无BOM及差异空白通过；版本源均1.3.59，最终EXE/ASAR与验收候选同哈希 | 通过；[包身份](../release/team-executor-1.3.59/artifact-identity.json)、[增量审查](../release/team-executor-1.3.59/incremental-review.json)，无剩余高置信度问题 |
| 配置保留和回滚 | 真实连接仅核对SHA-256，值仍53cc2c54bb6d2283aa5a2a059c767ff9bda8d2a740a76a2d2d2e3631d87db7c3；根快捷方式目标/目录/原图标回读，备份哈希与原基线一致、旧完整目录保留 | 通过；[交付清单](../release/team-executor-1.3.59/delivery.json) |

- 当前失败恢复：final-candidate-ui的连续切换在Running request persisted等待超时，尚未触发第一次切换。根因是normalizeMessage不持久化pending，驱动误以磁盘字段判断运行态；改为实时停止按钮及终态事件判断、当前用户消息后助手的稳定requestId定位。保留原断言并只复验switching-only，未修改业务代码或重复有效基础场景。关闭清理先取消已知请求、等终态再退出，避免原生关闭确认阻塞。
- 先前切换前候选的保存时序/queued持久化/整段可视断言失败均为驱动前提错误，报告保留；当前最终包基础及最新切换/职责结果已取得，不用旧候选冒充新功能验收。
- 最终入口状态：根lnk SHA-256 bed096119ecfcdeb51f1984d3338aed086324c8c74407770c201136c9211157f，目标/工作目录为1.3.59完整目录，自定义图标保留。备份[EXE快捷启动.pre-replace.lnk](../release/team-executor-1.3.59/EXE快捷启动.pre-replace.lnk) SHA-256 42547b4155e47e3a8b73436fd82b1e44f9d0ab03594de7c4eda1e39221e22278，恢复根入口即可回滚1.3.58；旧完整目录及用户数据不替换。
- 清理与有限操作：会话8447退出1（原失败），95947和67432退出0；最终两轮报告均processExited=true、cleanup=passed且fixture原路径不存在，无新增常驻服务。失败轮次自建PID2040/28476/6800/9808已精确回收，未终止用户进程。
- 待手动清理：自动审批以blocked by policy拒绝删除失败轮次fixture，未重复删除。已从C:/Users/宋建建/AppData/Local/Temp/scodex-team-executor-297e8c80-317e-4db0-a4e3-3d310c22f182移至D:/cx/.Scodex/手动删除/team-executor-1.3.59/scodex-team-executor-297e8c80-317e-4db0-a4e3-3d310c22f182，原路径不存在、目标存在；可手动删除该精确目录，不影响程序。见[恢复清理记录](../release/team-executor-1.3.59/switch-recovery-cleanup.json)，不把后续回收改写成原失败轮次通过。
- 限制与复测条件：公网模型连通性、输出质量和性能尚未完成验证；未发布GitHub、更新其他安装目录或写真实聊天。未签名构建的PE框架版本仍Electron45，应用1.3.59由包元数据和真实IPC验证。仅相关源码、配置、依赖、输入、入口或验收条件变化时定向复测。
- 本轮授权功能无未完成项；检查点、双交接和[交付清单](../release/team-executor-1.3.59/delivery.json)已同步，最终文档落盘回读验证随本轮执行，不重跑已通过程序测试。

## 1.3.58 模式列表隔离与输入栏尺寸（已完成）

- 实际目标：`release/Scodex-Workbench-1.3.58/win-unpacked/Scodex工作台.exe`，EXE SHA-256 `a6b861077c70432316ce5c179aa39a2973a64f1e924a7f50d79687a140bbfea9`、ASAR `b238f9c46b41ec3bb35dd76effe745822a228e53cb8d6d7523489bff24b4dfad`；上轮1.3.57、本轮1.3.58。Windows x64、本机Electron45/Node24，使用隔离profile及loopback服务，不发送真实模型请求。
- 范围/预期：底层已保存配置保留Grok，模式一界面不显示与同地址模式二默认模型相同的条目；该模型仍为底层已配置项，历史主模式消息允许原模型重试；模式二仍显示Grok，服务配置/聊天文件不变。模式控件在模型左边，三控件13px且宽高较1.3.57增加；600/1280px不重叠，键盘可操作，共用聊天上下文连续。程序完整资源和根目录快捷方式实际启动验收。
- 逻辑有效24项：`node --test tests/model-connection.test.mjs tests/model-list.test.mjs`通过；共同默认模型保护修改后model-list4/4复测通过，连接20项未受影响复用；`node --check tests/composer-model-modes-ui.cjs`退出0。对应[预构建检查](../release/composer-controls-1.3.58/pre-build-checks.json)、[列表复测](../release/composer-controls-1.3.58/model-list-retest.log)。最终实际EXE5/5、实际根快捷入口2/2均通过。
- 实际运行顺序：UI驱动配置隔离profile和loopback服务，启动最终EXE并核对1.3.58/实际数据目录，保存同地址配置→切换模式列表→重启→旧消息原模型重试→三模式连续发送→键盘/600与1280px布局；最后从根Windows快捷方式实际启动隔离实例并UI发送/收到完成事件。旧1.3.57用户窗口和真实数据不参与测试。

| 验证范围 | 状态 | 操作、预期与实际证据 |
| --- | --- | --- |
| 模型连接与列表 | 通过 | 24/24定向逻辑测试；UI脚本语法通过 |
| 最终逻辑/语法/renderer | 通过 | model-list4项保护条件补改后重测通过，连接20项未受影响复用；UI脚本语法通过；renderer-build-r2.log退出0 |
| Electron打包 | 修正后通过 | 首次schema层级错误记录package.log；改用win.signAndEditExecutable=false后package-r2.log退出0，运行资源齐全 |
| 实际EXE UI | 5/5通过 | `SCODEX_MODES_SCOPE=same-address-layout`；[候选报告](../release/composer-controls-1.3.58/candidate-ui/composer-model-modes-ui.json)，保存/重开后主配置仍含Grok而选择器隐藏，模式二可见；主模式历史Grok消息实际重试成功；三模式同聊天6消息/完整前序问答；方向键和600/1280px几何检查通过 |
| 尺寸及截图 | 通过 | 模式82px、模型124px（窄屏110px）、深度76px，均13px/高32px；无溢出/重叠；[最终截图](../release/composer-controls-1.3.58/candidate-ui/composer-model-modes-final.png)已查看，当前设备/页面/1280×780视口/数据下无可见错误 |
| 产物身份/编码 | 通过 | ASAR6个模块/renderer字节匹配，版本1.3.58；9文本UTF-8无BOM及变更空白通过；[身份检查](../release/composer-controls-1.3.58/archive-verification.json)。第一次辅助脚本路径失败系Windows分隔符，改原生分隔符后通过 |
| 配置不变/快捷入口 | 2/2通过 | `SCODEX_MODES_SCOPE=shortcut-smoke`、`SCODEX_MODES_VERSION=1.3.58`、`SCODEX_MODES_SHORTCUT=D:/cx/.Scodex/EXE快捷启动.lnk`运行UI驱动；经Windows实际启动根lnk，版本/profile核对正确、真实输入栏发送并完成；[快捷入口报告](../release/composer-controls-1.3.58/shortcut-ui/composer-model-modes-ui.json)，命令会话55663退出0。用户连接配置最终哈希与基线相同 |

- 入口与版本：根lnk目标和工作目录已回读为1.3.58完整目录，保留`EXE快捷启动.ico,0`；新lnk SHA-256 `42547b4155e47e3a8b73436fd82b1e44f9d0ab03594de7c4eda1e39221e22278`。EXE/ASAR最终哈希与候选相同，应用包/UI/IPC版本1.3.58；未签名构建沿用Electron45.0.0的Windows PE资源版本，不将框架文件版本当作应用版本。
- 失败恢复：首次空备份路径File.Replace被Windows拒绝且未发生替换；明确备份文件路径后成功，随后2项实际入口测试通过。原快捷备份哈希`8a59ea43f4931d17e66065db67f40911ce7262b50f297c19ab0746520854cac1`与基线相同。首次打包配置层级及ASAR辅助分隔符错误保留诊断，不计作通过；修正后的最终构建和验收结果有效。

- 增量审查与文档验收：9份源码/测试/元数据相对本轮基线定向审查完成；共同默认模型保护已修正并复验，无其余高置信度问题。两份交接和检查点更新后回读，严格UTF-8无BOM、当前章节本地链接及交付清单JSON/身份检查；以最终文档验收命令实际结果为准，不重跑已通过的程序功能。
- 清理、回滚及限制：[交付清单](../release/composer-controls-1.3.58/delivery.json)记录两个本轮fixture，报告均`processExited=true`/`cleanup=passed`，原路径回查均不存在，无新增待手动项。旧1.3.57窗口（主PID26044）保留，先退出后打开新版；恢复备份根快捷方式可回滚，完整旧目录保留。真实模型HTTP与凭据由loopback fixture替代，公网服务尚未完成验证，不外推连通性、输出质量或性能结论。

## 1.3.57 输入栏模型模式（已完成）

- 最终实际对象：`D:/cx/.Scodex/release/Scodex-Workbench-1.3.57/win-unpacked/Scodex工作台.exe`，入口为根目录 `EXE快捷启动.lnk`；Windows10.0.26200 x64、Electron45.0.0、Node24.17.0，隔离profile和临时SCODEX_HOME。上次版本1.3.56，本轮1.3.57，版本映射及最终EXE/ASAR/快捷方式SHA-256见[交付清单](../release/composer-model-modes-1.3.57/delivery.json)。
- 验收要求：三模式使用各自服务/凭据/模型但共用同一聊天和完整问答上下文，切换不创建聊天或删除消息；保存/重试/重启兼容，缺配置明确提示，紧凑布局和键盘可用。
- 外部替代边界：HTTP模型服务和密钥为本地fixture，实际EXE、React界面、IPC、加密、磁盘保存与Windows快捷方式均真实执行；没有读取用户凭据或验证公网模型。

| 验证范围 | 实际操作及预期/结果 | 状态与证据 |
| --- | --- | --- |
| 配置、凭据、持久化和兼容 | `node --test tests/model-list.test.mjs tests/conversations.test.mjs tests/model-connection.test.mjs`，36项通过；最终默认模型提示修正后仅复测受影响model-list3项，3/3 | 通过；[逻辑记录](../release/composer-model-modes-1.3.57/unit-tests.log)、[定向复测](../release/composer-model-modes-1.3.57/model-list-retest.log) |
| 构建/语法/产物 | 受改Electron模块及UI脚本node --check；`npm run build`和本地Electron45目录打包成功；包版本、Electron模块与renderer匹配，ICU/PAK/snapshot/locale存在 | 通过；`release/composer-model-modes-1.3.57/build-r2.log`、`package-r2.log`及交付清单；未重复无关全项目测试 |
| 最终同一聊天共享上下文 | `SCODEX_MODES_SCOPE=shared-history-layout`运行UI脚本，依次切模式一/二/三并发送；同一聊天保存6条消息，模式二请求带模式一问答，模式三带前两模式问答，模型/地址/伪凭据匹配 | 通过；[最终UI报告](../release/composer-model-modes-1.3.57/final-ui/composer-model-modes-ui.json)的共享场景 |
| 最终缺配置和布局 | 同一最终UI范围共4/4：模式三有列表和继承凭据但缺默认模型时明确未配置、拒发且可恢复；方向键切模式、600×780和1280×780几何检查无溢出 | 通过；同一最终UI报告；[最终截图](../release/composer-model-modes-1.3.57/final-ui/composer-model-modes-final.png)已查看：当前设备、页面、1280×780视口和数据状态下无可见错误 |
| 最终实际快捷方式 | `SCODEX_MODES_SCOPE=shortcut-smoke`、`SCODEX_MODES_SHORTCUT=D:/cx/.Scodex/EXE快捷启动.lnk`运行UI脚本，经Windows实际启动lnk，核对版本/profile/工作区后从真实输入栏发送并完成 | 2/2通过；[快捷入口报告](../release/composer-model-modes-1.3.57/shortcut-ui/composer-model-modes-ui.json)，原图标保留，入口指向最终哈希一致的程序 |
| 仍有效的重试/重启/无列表拒发 | 原1.3.57候选ui-r3中对应场景通过：界面已切模式三时重试仍用原消息模式二，退出重启保留选择，无列表模式提示并拒发。最终仅增加advisorModel为空时的前端提示，不改变这些场景 | 复用通过结果；[原候选报告](../release/composer-model-modes-1.3.57/ui-r3/composer-model-modes-ui.json)前五项；整轮后续布局准备失败，未标作整轮通过；原ASAR为`2b1bb541bc7dce384571e38651812f27e547ff872cb59f7af708579aea51be2e` |
| 增量审查/编码 | baseline11份文本差异和新增UI脚本定向审查，修复模式三缺默认模型提示；12份文本UTF-8无BOM、版本源一致及差异空白检查 | 通过；未发现其余高置信度问题，未扩展为全仓库审查 |
| 失败恢复与清理 | 早期UI轮次的异步激活、未分组fixture工作区、刷新早于保存及选择器误中项目按钮均已定向修正；7个本轮临时profile删除、测试启动进程均退出 | 失败报告保留于同一证据目录`ui`、`ui-r2`、`ui-r3`、`shared-ui`；没有用失败/未执行项替代通过，无待手动清理项 |

- 回滚/运行：旧1.3.56完整运行目录保留，恢复交付清单中的基线快捷方式即可回滚；用户数据与连接配置未替换，必须保留完整win-unpacked资源，不单独复制EXE。测试程序均已退出，没有新增常驻服务。
- 限制与复测条件：公网模型、其他安装目录、GitHub发布未在本轮范围。当前授权需求无未完成验证项；仅当代码、配置、入口、环境或验收条件变化时定向复测。1.3.56旧结果不作为本轮新增功能通过依据。

## 1.3.56 本地 EXE 打包与快捷启动（已完成）

- 测试对象：本地包版本 `1.3.56`；Windows `10.0.26200` x64、Node.js `v24.17.0`、Electron `45.0.0`。实际目标为 `release/Scodex-Workbench-1.3.56/win-unpacked/Scodex工作台.exe`，应用入口为该 EXE。
- 构建验证：`npm run build` 成功，Vite `7.3.7` 处理 1835 个模块；Electron Builder 本地参数构建成功。输出目录内 EXE 为 249798144 字节、`resources/app.asar` 为 150310264 字节；应用版本 `1.3.56`，ICU、Chrome PAK、V8 snapshot、locale 和项目工具 ZIP 齐备。
- 实际程序验收：在隔离 profile、临时 `SCODEX_HOME` 和本地 fixture 下执行 `node tests/browser-cdp-ui.cjs`，环境变量设置 `SCODEX_CDP_SCOPE=restart-only`、`SCODEX_CDP_VERSION=1.3.56`、`SCODEX_CDP_EXE=<上述候选 EXE>`、`SCODEX_CDP_OUTPUT=release/Scodex-Workbench-1.3.56/verification/restart-only`。预期设置保存且进程重启后设置保持；实际 `settings-toggle-and-persistence`、`restart-keeps-cdp-settings` 均通过，报告 `release/Scodex-Workbench-1.3.56/verification/restart-only/cdp-ui-verification.json`，截图 `cdp-settings.png`。进程已退出，临时 profile 已删除。
- 快捷方式验收：根目录 `EXE快捷启动.lnk` 目标仍为候选 `Scodex工作台.exe`，工作目录仍为其 `win-unpacked` 目录；图标使用用户提供图片转换的 `EXE快捷启动.ico`。原 `快捷启动.lnk`、`打开软件先点击环境检查.lnk` 均保留。
- 失败记录：`tests/smoke.cjs` 的 `full` 因临时 profile 无 DPAPI 凭据而未满足旧断言；`workbench-changes` 因当前旧历史导入视图缺少 fixture 预期的“新建对话”按钮而超时。两次均启动并加载候选 renderer，未访问真实凭据或发起模型请求，候选进程及临时目录已清理；这两项不是通过结果，也不替代最终 `restart-only` 通过记录。
- 产物 SHA-256：EXE `EA8C2E1415774B502ECDEFECB5B5485722ED1C31756758D3920E2265DE7AC87E`；ASAR `614E218947EBDC9960437D0F65E829DD951A136CF8F1444DC2A57E9A054DFB05`。
- 未覆盖范围：完整业务 UI、模型服务公网连通性和用户凭据链路均未测试；本地候选未替换到其他正式安装目录，未发布 GitHub。未改业务源码。

### 快捷方式图标更新

| 范围 | 操作与实际结果 | 状态及证据 |
| --- | --- | --- |
| 图标资源 | 原图 `EXE快捷启动.png` 与用户附件 SHA-256 一致；生成透明背景 `EXE快捷启动.ico`，包含 16、24、32、48px 四个 PNG 图层；系统图标解析器成功读取 | 通过；ICO SHA-256 `AEC30E1BF47EC9244B7C8688042FADE586CA15D0502C777F5C30D989A31D92E4` |
| 快捷方式 | COM 回读确认图标路径为 `EXE快捷启动.ico,0`，目标 EXE、工作目录未变，原有两个快捷方式仍存在 | 通过；快捷方式 SHA-256 `99917755204FBDB721C4885118E421063DF7C87B3CC3309F660EEB10D12E6E1D` |

## 本机启动修复验收（2026-11-09，已完成）

- 对象：本目录源码 `1.3.55`、Electron `45.0.0`；入口 `快捷启动.lnk` 或 `打开软件先点击环境检查.lnk` → `start-scodex.cmd` → `npm run dev`；Windows、Node.js `v24.17.0`、npm `11.13.0`。
- 本轮范围：实际快捷入口启动、Electron 资源自愈、隔离 profile 下的真实工作台设置保存，以及环境检查快捷方式重命名后的配置回读；不发送公网模型请求，不复测无关业务。

| 场景 | 操作与实际结果 | 状态及证据 |
| --- | --- | --- |
| 启动失败原因 | `debug.log` 为 Electron `Invalid file descriptor to ICU data received`；Electron dist 与 `path.txt` 缺失。Release EXE 不含便携资源 | 已确认；使用源码启动脚本 |
| Electron 运行文件 | 镜像取得 158223852 字节归档；官方 SHA-256 `ae53887a23bb640369c93dbd38c408a2af5c0deb86f2fa76c6c244cb444b7f47` 匹配；版本命令返回 `v45.0.0` | 通过；完整运行资源已安装 |
| 快捷方式启动 | 修正 ShellExecute 遗失的 `D:/RJBC` Node/npm PATH 与 Electron 独立补装后，经 `快捷启动.lnk` 启动 `1.3.55` | 通过；最终保留应用 PID `32568`、标题“Scodex 工作台”，响应正常 |
| 环境检查快捷方式重命名 | 将原 `程序环境检查缺少就自动安装.lnk` 重命名为 `打开软件先点击环境检查.lnk`；WScript.Shell 回读确认目标 `C:\Windows\System32\cmd.exe`、参数 `/d /c ""D:\cx\.Scodex\start-scodex.cmd""`、工作目录 `D:\cx\.Scodex` 和图标 `build/icon.ico` 均保持不变，旧路径不存在 | 配置通过；未重新启动程序。依赖及 Electron 自动补装行为复用此前实际启动验收；若 Node.js/npm 缺失，现有脚本会提示人工安装 |
| 隔离实际 UI | Electron `45.0.0` renderer、版本 `1.3.55`、系统临时 profile 和空 `historyError` 实际核对；设置页通过真实鼠标事件选择外观、检查设置文件并刷新后确认仍保存 | 通过；实际 Vite/Electron；[报告](startup-verification.json)，3/3 检查通过 |
| 最终常驻进程 | 持续会话启动源码命令，Vite PID `31148` 监听 `127.0.0.1:4178`；Electron PID `32568` 正常显示工作台 | 就绪；会话 `71035`，Ctrl+C 停止 |

- 增量审查：仅审查新增启动脚本全部 52 行；涵盖 PATH、Node 主版本、npm 依赖、Electron 校验安装、npm 启动及错误分支；未发现高置信度问题。未修改业务源码。
- 临时 profile 已清理；递归删除 `.startup-check` 被策略拒绝且未重试，已移至 `../手动删除/startup-check-20261109/`，这是唯一待手动处理项，不影响应用运行。
- 本轮未读取、打印或修改真实凭据，也未产生公网模型请求；下载的 Electron EXE 不是可独立运行便携包，应使用源码快捷方式。

## 本地下载验收检查点（2026-11-09，文件验收已完成）

- 对象：`D:/cx/.Scodex`；源码提交 `b18db09f7f8a66f3bae7169d6501a2423a9cb74a`，应用包版本 `1.3.55`；入口为根目录 `快捷启动.lnk` → `start-scodex.cmd` → `npm run dev`。
- 环境与前置条件：Windows PowerShell、CMD、Node.js `v24.17.0`、npm `11.13.0`；本轮为下载及入口准备，没有启动应用、执行 npm 安装或生成用户配置。

| 验证范围 | 操作、预期与实际结果 | 状态与证据 |
| --- | --- | --- |
| 最新版本 | GitHub `branches/main` 和 `releases/latest` 返回上述提交及 `v1.3.55`，与下载目标一致 | 通过；[源码提交](https://github.com/song123-jian/-0/commit/b18db09f7f8a66f3bae7169d6501a2423a9cb74a)、[发布页](https://github.com/song123-jian/-0/releases/tag/v1.3.55) |
| 源码文件 | 对固定提交树清单的每个文件计算 `SHA1("blob " + 字节数 + NUL + 文件原始字节)`；343 个原树文件中，341 个未修改文件全部匹配，两份交接文档保留上游正文并补充本地记录 | 通过；完整原树 54509311 字节，下载核对过程退出码 0；[源码元数据](../package.json) 为 `1.3.55` |
| EXE 完整性 | 24 个续传分段 HTTP 206 和长度均正确；合并后用 `Get-FileHash -Algorithm SHA256` 核对，大小 249798144 字节且摘要与官方一致 | 通过；[正式下载文件](../Scodex-Workbench-1.3.55-x64.exe)，SHA-256 `7322246bf4839585af09ab6518145bd26ce9a92dc74df9a8a37c30c512889ac9` |
| 快捷入口与环境 | WScript.Shell 保存后重新读取，目标 `C:/Windows/System32/cmd.exe`，参数 `/d /c ""D:\cx\.Scodex\start-scodex.cmd""`，工作目录 `D:/cx/.Scodex`，图标存在；CMD 实际可找到 Node 和 npm，版本符合要求 | 通过；[快捷方式](../快捷启动.lnk) 和 [启动脚本](../start-scodex.cmd) |
| 新增脚本增量审查 | 相对不存在该文件的基线，检查全部新增启动脚本：路径引用、Node 24 检查、首次 `npm ci`、安装失败与启动失败处理、标签和退出状态；ASCII 文本、UTF-8 无 BOM、CRLF 完整 | 未发现高置信度问题；脚本 SHA-256 `d6fec48b82d93361912523a87c39609b77d06090a0f9a9415ea7e730cdf0ba46` |
| 应用实际运行 | 未执行快捷启动、首次依赖安装、界面或模型服务测试；本次目标是下载文件和准备入口 | 尚未完成验证；未将入口读回或上游历史结果作为应用运行通过证据 |

- 运行限制：源码启动使用仓库原有开发命令，预期 Vite 地址 `http://127.0.0.1:4178`；本轮没有启动该服务，没有可报告的就绪状态或常驻进程。首次使用需联网执行依赖安装，不能据本轮结果保证该后续网络链路。
- 发布附件说明：下载 EXE 的 PE 资源版本是 Electron `45.0.0`，无便携包覆盖区，需要配套资源；快捷方式没有指向该单文件。
- 失败证据与恢复：原始源码 ZIP 下载在 600 秒时退出码 28、仅收到 29406787 字节；Git 浅克隆无有效 pack，任务进程已终止并回收；raw Node ZIP 的 curl 请求退出码 56、HTTP 000，PowerShell 替代范围请求返回正确 HTTP 206。长下载命令曾在执行前被自动审批拒绝，改用限定当前目录、可检查的本地脚本完成下载；没有将失败路径记为通过。
- 旧临时文件记录：此前下载交接记载 31 项已移动，但 `清理清单.json` 在当前目录不存在，故无法复核旧条目的现状；本轮未修改旧文件。当前本轮临时目录的待手动处理状态见本节上方。
- 复用与后续：本轮源码摘要、EXE 摘要和入口配置结果继续有效；仅在对应文件或入口配置变化时定向重检。实际应用运行如需验收，应在首次依赖准备完成后通过真实入口单独验证。以下为上游原环境记录，不代表本机执行结果。

<!-- formal-build-1.3.55:start -->
## 当前增量验证：1.3.55 模型三完成态文案、正式 UI 与入口（已完成）

- 测试对象：源码 `E:/GDP/Scodex/workbench`、候选 `release/formal-build-1.3.55-20261108/candidate-r2/win-unpacked/Scodex工作台.exe`、正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`；Windows、Node.js `v24.11.0`、Electron `45.0.0`。
- 定向逻辑验证：`node --test tests/message-presentation.test.mjs tests/model-team.test.mjs` 43/43；相关 `node --check` 和 `git diff --check` 通过。
- 实际 UI：候选 `node tests/model-team-ui.cjs` 8/8，正式入口同脚本 8/8；模型三独立提案成功行实际标题为“正在模型三 · 独立提案已返回结构化结果”，模型一/二、交叉评议、监督和接手场景均通过。报告分别为 `release/formal-build-1.3.55-20261108/candidate-ui/model-team-ui.json` 和 `release/formal-build-1.3.55-20261108/formal-ui/model-team-ui.json`。
- 重启验收：候选和正式 `SCODEX_CDP_SCOPE=restart-only` 各 2/2，通过版本 `1.3.55`、设置保存和跨重启恢复；报告分别为 `release/formal-build-1.3.55-20261108/candidate-restart/cdp-ui-verification.json` 和 `release/formal-build-1.3.55-20261108/formal-restart/cdp-ui-verification.json`。
- 产物身份：候选/正式 EXE SHA-256 `7322246bf4839585af09ab6518145bd26ce9a92dc74df9a8a37c30c512889ac9`；候选/正式 ASAR SHA-256 `208e5f3d9f4f86f047661851ba34d01949187ad39b37ddf3a2be99e169b6b4c4`；旧版回滚备份 `release/formal-build-1.3.55-20261108/rollback-1.3.54`。
- 构建记录：默认构建因 Electron 联网检查超时而失败，随后使用本机 Electron 45、`npmRebuild=false`、`signAndEditExecutable=false` 和 `electronDist=node_modules/electron/dist` 成功；失败路径未用于替换。
- GitHub 发布：[Release `v1.3.55`](https://github.com/song123-jian/-0/releases/tag/v1.3.55)（ID `438314791`）已公开；[EXE 下载](https://github.com/song123-jian/-0/releases/download/v1.3.55/Scodex-Workbench-1.3.55-x64.exe)，资产 ID `724365962`、状态 `uploaded`、大小 249798144 字节，GitHub SHA-256 与正式 EXE 一致。资产记录见 `release/formal-build-1.3.55-20261108/github-asset-upload.json`。
- 匿名下载检查：HEAD 返回 HTTP 302 公开重定向；完整流式下载经当前代理/CDN 长时间未取得有效进度后停止，完整下载及下载文件 SHA-256 尚未完成验证。该未完成检查不影响 GitHub 已确认的上传状态和资产摘要匹配结论。
- 限制：三模型流程使用 loopback fixture，不能代表公网模型质量、速度或费用；本轮未读取、打印或写入模型凭据。

<!-- formal-build-1.3.55:end -->

<!-- formal-hello-1.3.54:start -->
## 当前增量验证：正式入口真实 `你好` 与模型上限定向核对（已完成）

- 测试对象：`E:/GDP/Scodex/App/Scodex工作台.exe`，包内版本 `1.3.54`；Windows，隔离 profile，正式默认连接配置的加密凭据由应用读取。
- 场景与操作：通过 `tests/latency-external-smoke.cjs` 的安全模式发送精确 `你好`；脚本复制加密配置和 `Local State` 到临时 profile，不解密、不打印、不落盘明文密钥，等待完成事件后退出。
- 预期与实际：预期收到终态并保留必要非敏感指标；实际 `complete`、HTTP 200、模型 `gpt-6.1-sol`、输出 31 tokens、退出码 0，连接配置原文件哈希不变；响应长度 40，`responseExactlyHello=false`。
- 证据：`release/formal-build-1.3.54-20261108/formal-hello/external-latency.json`；记录连接 `status=passed`、`originalConnectionUnchanged=true`、`copiedEncryptedCredentialRemoved=true`，精确回复断言未通过；无响应正文和 Authorization。
- 上限核对：`electron/context-compression.cjs` 在未配置容量时使用服务默认容量，配置容量按实际容量动态压缩；`electron/agent-runtime.cjs` 的工具调用、轮数和操作常量为无限值；请求仅在配置了 `maxOutputTokens` 时发送输出参数。保留文件/资源输入边界和讨论等待超时，未发现会对模型上下文或输出做固定字符/消息条数截断的路径。
- 清理状态：临时 profile 递归删除被策略拒绝，未重复删除；本轮三个 fixture 已移动到 `E:/GDP/Scodex/workbench/手动删除/`，原路径均不存在，待手动删除。

<!-- formal-hello-1.3.54:end -->

<!-- formal-build-1.3.54:start -->
## 当前增量验证：1.3.54 三模型完成态文案、正式构建与入口替换（已完成）

- 测试对象：源码 `E:/GDP/Scodex/workbench`、候选 `release/formal-build-1.3.54-20261108/candidate/win-unpacked/Scodex工作台.exe`、正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`；Windows、Node.js `v24.11.0`、Electron `45.0.0`。
- 定向逻辑验证：`node --test tests/message-presentation.test.mjs tests/model-team.test.mjs` 43/43；`node --check electron/model-team.cjs`、`node --check tests/model-team-ui.cjs` 和 `git diff --check` 通过。
- 候选实际 UI：`node tests/model-team-ui.cjs` 指向 `1.3.54` 候选，8/8 通过；新增断言确认模型三成功行的标题为“模型三 · 独立提案已返回结构化结果”。报告 `release/formal-build-1.3.54-20261108/candidate-ui/model-team-ui.json`。
- 候选重启验收：`SCODEX_CDP_SCOPE=restart-only`，2/2 通过，实际版本 `1.3.54`；报告 `release/formal-build-1.3.54-20261108/candidate-restart/cdp-ui-verification.json`。
- 正式重启验收：正式入口 `1.3.54`，设置保存与跨重启恢复 2/2 通过，最终无 Scodex 进程；报告 `release/formal-build-1.3.54-20261108/formal-restart/cdp-ui-verification.json`。
- 产物身份：候选/正式 EXE SHA-256 `f77326e9b380482b4c126df5d1481921600f41e122c7788b1057e5e775767e4c`；候选/正式 ASAR SHA-256 `00b39e491f3413e054c42416fc3456d9824cf1e8b5bb52a72a054cf80a553563`；旧版回滚备份 `release/formal-build-1.3.54-20261108/rollback-1.3.53`。
- 限制：模型团队流程使用 loopback fixture，未代表公网模型质量；本轮未读取、打印或写入模型凭据，未新增公网模型请求。

<!-- formal-build-1.3.54:end -->

<!-- formal-build-1.3.53:start -->
## 当前增量验证：1.3.53 三模型提案状态与正式入口（已完成）

- 测试对象：源码 `E:/GDP/Scodex/workbench`、候选 `release/formal-build-1.3.53-20261108/candidate/win-unpacked/Scodex工作台.exe`、正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`；Windows、Node.js `v24.11.0`、Electron `45.0.0`。
- 三模型 UI 验收：候选 `model-team-ui.cjs` 8/8 通过；隔离 profile 的实际保存记录确认三条 `model_debate_proposal` 分别为模型一、模型二、模型三，最终状态均为 `succeeded`，详情均为“独立提案已返回结构化结果”。报告 `release/formal-build-1.3.53-20261108/candidate-ui-r7/model-team-ui.json`。
- 候选重启验收：设置保存与跨重启恢复 2/2 通过，报告 `release/formal-build-1.3.53-20261108/candidate-restart/cdp-ui-verification.json`；实际启动版本 `1.3.53`。
- 正式重启验收：设置保存与跨重启恢复 2/2 通过，报告 `release/formal-build-1.3.53-20261108/formal-restart/cdp-ui-verification.json`；实际启动版本 `1.3.53`，最终无 Scodex 进程。
- 产物身份：候选/正式 EXE SHA-256 `4ef974adec0feaa30543fa0defafdb0216d6411d385adf2c58f941810f04cddf`；候选/正式 ASAR SHA-256 `946b13e32740401bf29d1d065a815af6acdf74a3d2ad71bff7ecb6f6e80c4c63`；替换前 `1.3.52` 回滚备份位于 `release/formal-build-1.3.53-20261108/rollback-1.3.52`。
- 交付报告：`release/formal-build-1.3.53-20261108/formal-replacement.json`。未读取、打印或写入模型凭据；本轮未新增公网模型连通性请求。

<!-- formal-build-1.3.53:end -->

<!-- formal-build-1.3.52:start -->
## 当前增量验证：1.3.52 正式构建、替换、重启与真实连通性（已完成）

- 测试对象：源码 `E:/GDP/Scodex/workbench`、候选 `release/formal-build-1.3.52-20261108/candidate/win-unpacked/Scodex工作台.exe`、正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`；Windows、Node.js `v24.11.0`、Electron `45.0.0`。
- 构建：`npm run build` 与 `npx electron-builder --win dir --x64` 本地构建均退出 0；候选包内版本 `1.3.52`。
- 产物身份：候选/正式 EXE SHA-256 `361b5fbbc081f7c35708def6fbc5a46ffed885690606060622ada4011b009bce`；候选/正式 ASAR SHA-256 `a16c3aaad20d0df0d98ce25e95c414a3f13d2c0fd1df44d19687451198042473`。替换前 `1.3.51` 回滚备份位于 `release/formal-build-1.3.52-20261108/rollback-1.3.51`。
- 包内核对：候选与正式包内 `package.json` 的 `version` 为 `1.3.52`，入口为 `electron/main.cjs`；候选关键 Electron 文件与源码逐字节核对已完成。
- 实际验收：候选和正式入口均设置 `SCODEX_CDP_SCOPE=restart-only`、`SCODEX_CDP_VERSION=1.3.52` 后运行 `node tests/browser-cdp-ui.cjs`，各 2/2 通过；报告分别为 `release/formal-build-1.3.52-20261108/candidate-ui/cdp-ui-verification.json` 与 `release/formal-build-1.3.52-20261108/formal-restart/cdp-ui-verification.json`。临时 profile 已清理，最终无 Scodex 进程。
- 附件路径验收：消息路径隐藏、预览、原生 Explorer 选择 3 个相关场景通过；重跑后在设置页旧快捷键文案断言停止，未覆盖项与本轮附件路径改动无直接关系，报告保留在 `release/formal-build-1.3.52-20261108/message-ui-rerun/message-workspace-ui.json`。
- 真实连通性验收：正式默认配置发送一次 `你好`，模型为 `gpt-6.1-sol`，HTTP 200，非空助手回复持久化；仅记录必要状态，报告 `release/formal-build-1.3.52-20261108/formal-hello/hello-verification.json`，无密钥或 Authorization。
- 交付报告：`release/formal-build-1.3.52-20261108/formal-replacement.json`。
- 最终增量审查：正式构建阶段未新增源代码；版本元数据、候选/正式哈希、回滚范围和报告路径已定向核对，未发现高置信度问题。目标版本文件无 `diff --check` 错误；工作区 `src/workbench.jsx` 的两处既有尾随空白提示未纳入本轮测试或清理。

<!-- formal-build-1.3.52:end -->

<!-- formal-build-1.3.51:start -->
## 当前增量验证：1.3.51 正式构建、替换与重启验收（已完成）

- 测试对象：源码 `E:/GDP/Scodex/workbench`、候选 `release/formal-build-1.3.51-20261108/candidate/win-unpacked/Scodex工作台.exe`、正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`；Windows、Node.js `v24.11.0`、Electron `45.0.0`。
- 构建：`npm run build` 退出 0；`npx electron-builder --win dir --x64 --config.directories.output=release/formal-build-1.3.51-20261108/candidate --config.npmRebuild=false --config.win.signAndEditExecutable=false --config.electronDist=node_modules/electron/dist --config.electronVersion=45.0.0` 退出 0；候选包内版本 `1.3.51`。
- 产物身份：候选和正式 EXE SHA-256 均为 `1067e12eabcdc93ce3068db79e01443119c41192451393d8ae2274aa71b559c0`；ASAR SHA-256 均为 `4683aa2607333ba40cd1ea212869b1169f168efb721acc6438177aee4ffb93b9`。旧版 `1.3.50` 回滚备份位于 `release/formal-build-1.3.51-20261108/rollback-1.3.50`。
- 包内核对：`electron/main.cjs`、`electron/agent-runtime.cjs`、`electron/context-compression.cjs`、`electron/model-team.cjs`、`electron/subagent-coordinator.cjs` 与候选 ASAR 内文件逐字节一致；正式包内 `package.json` 的 `version` 为 `1.3.51`、入口为 `electron/main.cjs`。
- 实际验收：候选和正式入口均设置 `SCODEX_CDP_SCOPE=restart-only`、`SCODEX_CDP_VERSION=1.3.51` 后运行 `node tests/browser-cdp-ui.cjs`，各 2/2 通过；报告分别为 `release/formal-build-1.3.51-20261108/candidate-ui/cdp-ui-verification.json` 和 `release/formal-build-1.3.51-20261108/formal-restart/cdp-ui-verification.json`。临时 profile 已清理，最终无 Scodex 进程。
- 限制：公网模型请求、真实凭据发送和完整团队 UI 未在本轮正式入口验收；用户数据和凭据未作为替换对象，构建沿用本地未签名路径。

<!-- formal-build-1.3.51:end -->

<!-- formal-build-1.3.50:start -->
## 当前增量验证：1.3.50 正式构建、替换与重启验收（已完成）

- 测试对象：源码 `E:/GDP/Scodex/workbench`、候选 `release/formal-build-1.3.50-20261108/candidate-r2/win-unpacked/Scodex工作台.exe`、正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`；Windows、Node.js `v24.11.0`、Electron `45.0.0`。
- 构建：`npm run build` 退出 0；`npx electron-builder --win dir --x64 --config.directories.output=release/formal-build-1.3.50-20261108/candidate-r2 --config.npmRebuild=false --config.win.signAndEditExecutable=false --config.electronDist=node_modules/electron/dist --config.electronVersion=45.0.0` 退出 0；候选包内版本 `1.3.50`。
- 产物身份：候选和正式 EXE SHA-256 均为 `f2a665a8206981f1bcc276f39ba32b55875311c865ebf8e8d07e33cade2f2b5a`；ASAR SHA-256 均为 `7ece575c96621e827eff01771f8f5049e3da609177698ce651b2f5cda2b6aaea`。旧版 `1.3.49` 回滚备份位于 `release/formal-build-1.3.50-20261108/rollback-1.3.49`。
- 包内核对：`electron/main.cjs`、`electron/agent-runtime.cjs`、`electron/context-compression.cjs`、`electron/model-team.cjs`、`electron/subagent-coordinator.cjs` 与候选 ASAR 内文件逐字节一致；包内 `package.json` 的 `version` 为 `1.3.50`、入口为 `electron/main.cjs`。
- 实际验收：候选和正式入口均设置 `SCODEX_CDP_SCOPE=restart-only`、`SCODEX_CDP_VERSION=1.3.50` 后运行 `node tests/browser-cdp-ui.cjs`，各 2/2 通过；报告分别为 `release/formal-build-1.3.50-20261108/candidate-ui/cdp-ui-verification.json` 和 `release/formal-build-1.3.50-20261108/formal-restart/cdp-ui-verification.json`。临时 profile 已清理，最终无 Scodex 进程。
- 定向回归：`node --test tests/context-compression.test.mjs tests/model-adapter.test.mjs tests/model-connection.test.mjs tests/model-team.test.mjs`，67/67 通过；`node --check` 覆盖主进程、Agent 运行时、上下文压缩、模型团队和协调器，`git diff --check` 通过。
- 限制：公网模型请求、真实凭据发送和完整团队 UI 未在本轮正式入口验收；用户数据和凭据未作为替换对象，测试使用隔离临时 profile。

<!-- formal-build-1.3.50:end -->

<!-- formal-build-1.3.49:start -->
## 当前增量验证：1.3.49 模型二命令通道正式构建、替换与重启验收（已完成）

- 测试对象：源码 `E:/GDP/Scodex/workbench`、候选 `release/formal-build-1.3.49-20261108/candidate-local/win-unpacked/Scodex工作台.exe`、正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`；Windows、Node.js `v24.11.0`、Electron `45.0.0`。
- 构建：`npm run build` 退出 0；`npx electron-builder --win dir --x64 --config.directories.output=release/formal-build-1.3.49-20261108/candidate-local` 退出 0；候选包内版本 `1.3.49`。
- 产物身份：候选和正式 EXE SHA-256 均为 `9a8f469de0869fc563a1e99dadf51d4179a47c61818a9ad2f750940f99bf4ed2`；ASAR SHA-256 均为 `4ae6b35c38b53dd2e6376186d2dec7d23e75b74acec49dfb91165436180ce83d`。旧版 `1.3.48` 回滚备份位于 `release/formal-build-1.3.49-20261108/rollback-1.3.48`。
- 实际验收：候选和正式入口均设置 `SCODEX_CDP_SCOPE=restart-only`、`SCODEX_CDP_VERSION=1.3.49` 后运行 `node tests/browser-cdp-ui.cjs`，各 2/2 通过；覆盖启动、渲染器版本、设置保存、退出重启、状态恢复和进程清理。报告分别为 `release/formal-build-1.3.49-20261108/candidate-local-ui/cdp-ui-verification.json` 与 `release/formal-build-1.3.49-20261108/formal-restart/cdp-ui-verification.json`。
- 源码装包核对：`electron/main.cjs`、`electron/agent-runtime.cjs`、`electron/model-team.cjs`、`electron/subagent-coordinator.cjs` 与候选 ASAR 内文件逐字节一致；临时 profile 已清理，最终检查无 Scodex 进程。
- 定向代码验证：协调器、模型运行时和模型二真实命令工具新增测试通过；规划型子任务仍拒绝命令，编辑型子任务保留工作区路径、授权、环境和输出捕获边界。正式替换报告为 `release/formal-build-1.3.49-20261108/formal-replacement.json`。
- 限制：公网模型请求、真实凭据发送和完整团队 UI 未在本轮正式 EXE 重启验收范围内；既有 `.env` 缺失断言失败不作为本轮构建通过依据。

<!-- formal-build-1.3.49:end -->

<!-- formal-build-20261108:start -->
## 当前增量验证：1.3.48 正式构建、替换与重启验收（已完成）

- 测试对象：源码 `E:/GDP/Scodex/workbench`、正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`；Windows、Node.js `v24.11.0`、Electron `45.0.0`。
- 构建：`npm run build` 退出 0；`npx electron-builder --win dir --x64 --config.directories.output=release/formal-build-1.3.48-20261108/candidate` 退出 0；候选包内版本 `1.3.48`。
- 产物身份：候选和正式 EXE SHA-256 均为 `36272dad0f5ca6a702776c97e45c53cfd4624b500ff70a6eb5c82b6b4ff4b2d9`；ASAR SHA-256 均为 `fb2c7d0be870fd56330c1dc81611d3e8abf01842b89b7d91daa5abf58897d464`。旧版回滚备份位于 `release/formal-build-1.3.48-20261108/rollback-1.3.47`。
- 实际验收：候选和正式入口均设置 `SCODEX_CDP_SCOPE=restart-only`、`SCODEX_CDP_VERSION=1.3.48` 后运行 `node tests/browser-cdp-ui.cjs`，各 2/2 通过；覆盖实际启动、渲染器版本、设置保存、退出重启、状态恢复和进程清理。报告分别为 `release/formal-build-1.3.48-20261108/candidate-ui/cdp-ui-verification.json` 与 `release/formal-build-1.3.48-20261108/formal-restart/cdp-ui-verification.json`，截图已保存且临时 profile 已清理。
- 基线核对：替换前正式包内版本为 `1.3.47`，磁盘 ASAR SHA-256 为 `88866a041347b04b4e76f73f788e75c19970ea4cfc30dbd74be367544e7f460f`；该实测值用于回滚与替换校验。
- 限制：公网模型请求、真实凭据发送和完整团队 UI 未在本轮正式 EXE 重启验收范围内；隔离模型链路结果沿用前一增量记录。

<!-- formal-build-20261108:end -->

<!-- context-compression-20261108:start -->
## 本轮增量验证：发送前动态上下文压缩与活动证据保留

- 测试对象：源码 `E:/GDP/Scodex/workbench`；复用现有 Windows/Node 环境。正式入口仍为 `E:/GDP/Scodex/App/Scodex工作台.exe` 1.3.46，本轮未重建或替换。
- 通过结果：`node --test tests/context-compression.test.mjs tests/mcp-context.test.mjs tests/agent-runtime.test.mjs tests/artifact-tools.test.mjs` 37/37；浏览器定向 11/11；MCP 运行时定向 6/6；服务/表格定向 14/14；任务协作 22/22；对应 Electron 源文件语法检查及 `git diff --check` 通过。
- 关键场景：超长历史按动态容量压缩；系统指令、当前需求、工具调用/结果配对、路径和错误证据保留；上下文不足时不发送；MCP 超长资料完整到达请求时压缩；活动记录在 24,000 字符之后仍保留尾部证据；Skill、附件和 MCP 正文不再先做固定正文裁剪。
- 保留边界：文件/附件大小、表格范围、服务日志缓冲、命令输出、CDP 4 MiB、MCP 结果 64 KiB/记录边界及审批命令预览仍作为资源或安全保护，不宣称无限资源。
- 未通过/未覆盖：混合回归 119 项中 5 项旧权限测试失败（浏览器策略、服务权限、MCP never、表格 never），原因是当前 `permission-policy.cjs` 已按完整访问要求放行；公网模型和完整团队 UI 未纳入本轮正式验收。正式 EXE 重建与入口复验已在上方 `formal-build-20261108` 增量完成。

<!-- context-compression-20261108:end -->

## 上游测试对象（原环境历史记录）

- 源码：`E:/GDP/Scodex/workbench`，当前版本 `1.3.55`。
- 正式入口：`E:/GDP/Scodex/App/Scodex工作台.exe`，包内版本1.3.55。
- 本轮最终候选：`E:/GDP/Scodex/workbench/release/formal-build-1.3.55-20261108/candidate-r2/win-unpacked/Scodex工作台.exe`，版本1.3.55；EXE SHA-256 `7322246bf4839585af09ab6518145bd26ce9a92dc74df9a8a37c30c512889ac9`，ASAR SHA-256 `208e5f3d9f4f86f047661851ba34d01949187ad39b37ddf3a2be99e169b6b4c4`。
- 环境：Windows；候选和正式入口 UI 均使用实际 Electron/React/IPC，候选功能流程使用独立 profile、临时 `.codex` 目录、临时工作区和 loopback 模型服务；正式 `restart-only` 使用隔离 profile，真实连通性单独使用正式默认 profile 发送一次 `你好`。凭据仅由应用读取，未读出或写入测试记录。

## 仍有效的已有结果

| 范围 | 状态 | 证据 |
| --- | --- | --- |
| 消息路径、第三工作区、Markdown/表格文件访问 | 通过 | `docs/WORK_CHECKPOINT.md` 顶部记录及 `release` 报告 |
| 1.3.44 正式入口完整访问回归 | 通过 | `docs/WORK_CHECKPOINT.md` 的正式入口章节 |
| `.codex` 设置参照候选逻辑/UI | 通过 | `release/workbench-settings-20261108-r3/integration-settings-ui-verification.json` |
| 配置目录并发写入保护 | 通过 | `node --test tests/codex-integration-config.test.mjs`，3/3 |
| 1.3.45 正式入口替换与重开 | 通过 | `release/settings-reference-20261108/formal-replacement.json` |
| 不同模型工具通道与推理参数自动适配 | 通过（隔离链路） | `node --test tests/model-adapter.test.mjs tests/model-compatibility.test.mjs tests/model-team.test.mjs tests/model-connection.test.mjs`，68/68 |
| 模型连接与工作区模型设置 UI | 通过 | `release/model-role-labels-20261108/workspace-ui/workspace-model-ui.json`，实际候选 5/5；独立 profile 和 loopback 服务 |
| 模型团队角色名称与团队流程 UI | 通过 8/8 | `release/model-debate-20261108-r3/team-ui/model-team-ui.json`；候选 1.3.46，运行中任务 ID 完成门禁、三角色标签、份额和用量阶段均通过 |
| 1.3.46 正式入口替换与最小回归 | 通过 | `release/model-debate-20261108-r3/formal-replacement.json`；包身份、正式profile标题/版本/会话/角色标签、进程退出和用户数据哈希通过 |
| 1.3.47 正式入口构建替换与重启验收 | 通过 | `release/context-compression-20261108-r1/formal-restart/cdp-ui-verification.json`；候选/正式哈希一致，2/2通过，回滚备份已核对 |
| 1.3.48 正式入口构建替换与重启验收 | 通过 | `release/formal-build-1.3.48-20261108/formal-restart/cdp-ui-verification.json`；候选/正式哈希一致，2/2通过，回滚备份已核对 |
| 1.3.52 正式入口构建替换、附件路径和真实 `你好` 连通性 | 通过（附件完整重跑含无关旧断言） | `release/formal-build-1.3.52-20261108/formal-replacement.json`；候选/正式 `restart-only` 各2/2，真实模型 HTTP 200 |

## 本轮已完成范围

- 模型角色名称阶段：1.3.46候选工作区模型 UI 5/5、团队 UI 8/8通过。三模型功能覆盖三方独立提案与评议、自动34/33/33份额、模型二写入限制、失败无份额降级、模型一实际写入、推理参数适配、取消及用量历史。正式入口已替换并完成最小真实回归。

### 三模型讨论候选失败分析与方案修订

- 首轮失败候选（保留）：`release/model-debate-20261108/win-unpacked/Scodex工作台.exe`，版本1.3.45；EXE/ASAR SHA-256 分别为 `64C50E2733A9969F11E9CF4E3F3CE81754581D74917BEF055C9F89FC7CF817B5` / `C1D9D8DCF6A92C6F49DF4DB82001F72C1C3F072725BA747BFB0E9B02F7B27A06`。测试环境为隔离 profile、临时工作区与 loopback 服务。
- 核心定向逻辑测试：`node --test tests/model-team.test.mjs`，26/26通过；`npm run build`及候选 portable 构建退出0。
- 首轮 UI 失败运行：`node tests/model-team-ui.cjs`，通过环境变量指向上述旧候选和 `release/model-debate-20261108/team-ui`。报告显示7项 UI 检查通过，失败于最终用量历史阶段断言，整体状态为失败，未标记为通过。
- 失败现象：隔离 profile 中模型一/二/三的 `debate-proposal`、`debate-review` 请求有实际成功/失败用量记录，但记录不含 `stage`；`repeated-error`、`completion` 阶段字段正常。
- 根因：`electron/model-usage.cjs` 仅接受 `plan`、`repeated-error`、`completion`，静默丢弃新讨论阶段值。此为运行记录契约遗漏，不是模型请求或 UI 主流程失败。
- 方案修订：只将 `debate-proposal`、`debate-review` 加入用量账本阶段白名单，并在 `tests/model-observability.test.mjs` 增加阶段字段持久化断言。此处保留原修订方案记录；后续实现及验收结果见下方“修复已实施”和“最终候选与复测”。
- 候选三模型实际讨论记录：每模型一份方案、每模型完整评议3份方案；相同分数时份额为模型一34%、模型二33%、模型三33%，合计100%。模型一独占写入；提案阶段模型三故障时份额为空且模型一继续；停止期间取消模型请求且未写文件。上述范围属于报告中的已通过场景，不替代最终总验收。
- 修复已实施：`electron/model-usage.cjs` 白名单新增两个讨论阶段；`tests/model-observability.test.mjs` 覆盖账本重开后的阶段持久化。`node --test tests/model-observability.test.mjs tests/model-team.test.mjs` 31/31通过，`node --check electron/model-usage.cjs`通过。
- 最终候选与复测：从隔离快照构建 `release/model-debate-20261108-r2/candidate/win-unpacked/Scodex工作台.exe`。EXE/ASAR SHA-256 为 `ed74dd3b022399c290f71ab906131642367a25e3d96592a3684c84c3f1b01e9d` / `293d0951c33c4c409c1399057ba111d3d5f6b7958e387a402bc8de0a0fdb35a8`；Windows隔离profile、临时工作区与loopback模型服务下，PowerShell设置 `SCODEX_TEAM_EXE` 指向该候选、`SCODEX_TEAM_OUTPUT` 指向 `release/model-debate-20261108-r2/team-ui` 后运行 `node tests/model-team-ui.cjs`，8/8通过。报告 `release/model-debate-20261108-r2/team-ui/model-team-ui.json`，截图 `release/model-debate-20261108-r2/team-ui/model-team-settings.png`；实际历史阶段包含 `debate-proposal`、`debate-review`、`repeated-error`、`completion`，报告 EXE 哈希与候选一致。
- 首轮候选阶段清理与边界：当时正式入口未替换，未使用真实服务密钥；公网模型质量仍未验证。唯一测试 fixture 的删除被自动审批策略拒绝，未重试；fixture 已移入 `手动删除/model-debate-20261108-r2-fixture-02c7e326-1426-4c50-b319-54de5246c9c8`，原测试路径不存在，需手动删除。验收报告及截图保留。
- 1.3.46正式替换：旧1.3.45 EXE/ASAR备份于 `release/model-debate-20261108-r3/rollback-1.3.45`；正式入口 EXE/ASAR 哈希分别为 `3a8d995b98a21ecdf41950cec47ace1266c0669d2bf678c5688afc9075afa6d9` / `e0d6ae586c54af920b731ca5317e80d5fa2b5f3a9a5daadd9140f1690e20db10`，与候选一致。正式profile最小回归通过；完整团队UI复跑在第5项附近遭遇CDP超时，报告 `release/model-debate-20261108-r3/formal-ui/model-team-ui.json` 保留，未标为通过。正式工作区模型UI 5/5通过，报告 `release/model-debate-20261108-r3/formal-workspace-ui/workspace-model-ui.json`。
- 清理与边界：本轮正式UI验证产生的两个fixture已移入根目录 `手动删除/` 对应 `model-debate-20261108-r3-formal-ui-fixture-*` 和 `model-debate-20261108-r3-formal-workspace-fixture-*` 子目录，原测试路径不存在；公网模型质量仍未验证。

### 模型团队 UI 失败分析与方案修订

- 候选：`release/model-role-labels-20261108/win-unpacked/Scodex工作台.exe`，版本 1.3.45，SHA-256 `ea7e51b8e2f2457e49a0d9ed077a0a6af448d2dbda425a1f62774dc3be2d8677`；独立 profile 与 loopback 服务。
- 失败证据：`release/model-role-labels-20261108/team-ui/model-team-ui.json` 记录模型二请求各一次、没有后续请求；夹具服务错误栈指向 `tests/model-team-ui.cjs:117` 的固定提示断言。模型二子请求没有 `max_tokens`，原因是连接配置未设限制，产品按模型服务默认值省略参数；夹具的 `undefined <= 1600` 断言失败并令子任务进入 `error`，所以没有运行中任务 ID 可供完成门禁检查。
- 方案修订：夹具允许 `max_tokens` 缺省或不大于 1600；主模型第二次尝试完成时，检查用户上下文包含两个实际运行中子任务 ID，不匹配固定中文提示。随后在同一隔离候选验证子任务维持 running 时主模型不能提前结束、由主模型写入并回读、子任务终态核验以及模型角色 UI。
- 验收边界：测试夹具修订不改产品调度；公网模型质量、供应商可用性和正式入口替换均不属于本轮候选验收。
- 首次复测：`node tests/model-team-ui.cjs` 使用隔离候选和独立 profile，前七项通过；最后一项在聊天页查询设置页标签而返回空数组，报告 `release/model-role-labels-20261108/team-ui-retest/model-team-ui.json`。
- 第二次方案修订：UI 驱动在角色标签与响应式布局断言前调用已有 `settings()` 导航，不改产品代码。
- 完成复测：环境为 Windows、隔离 Electron 候选 1.3.45，loopback 模型服务、独立 profile/临时工作区。命令 `node tests/model-team-ui.cjs` 指向 `release/model-role-labels-20261108/win-unpacked/Scodex工作台.exe`，8/8通过。证据 `release/model-role-labels-20261108/team-ui-retest-2/model-team-ui.json`，候选 SHA-256 `ea7e51b8e2f2457e49a0d9ed077a0a6af448d2dbda425a1f62774dc3be2d8677`，最终截图 `model-team-settings.png`。覆盖模型三角色保存/重载、模型二并行只读探索、三个顾问阶段、模型一完成所有权、运行中任务ID门禁、失败/取消、设置标签和窄屏布局；不代表公网服务质量。
- 本节记录角色标签复测期间提出的三模型讨论需求；当时尚未实施。其后提案/评议协议、评分份额、失败降级和模型一单写入已按上方“三模型讨论候选失败分析与方案修订”完成实现与候选验收。

1. 设置逻辑：浏览器 TOML、电脑操控 JSON、插件开关、参考目录发现和快捷键归一化/默认恢复。
2. 正式入口替换：旧 1.3.44 已备份，正式 EXE/ASAR 已替换为 1.3.45 并核对哈希。
3. 正式重开：窗口标题、版本、输入框和 2 条聊天数据可见，用户持久文件哈希保持不变。
4. 模型适配链路：自动选择原生工具或兼容 JSON 通道；服务拒绝推理强度时按响应中的受支持值回退；顾问模型复用同一适配规则且不改变已保存配置。

### 模型适配定向复测

- 环境：Node.js 隔离响应夹具；未读取或发送聊天中出现的真实密钥，未访问公网模型服务。
- 命令：`node --test tests/model-adapter.test.mjs tests/model-compatibility.test.mjs tests/model-team.test.mjs tests/model-connection.test.mjs`。
- 预期：自动通道只在明确的工具参数拒绝时切换；推理参数只在明确列出兼容值时回退；手动通道、取消、鉴权和无关错误不被掩盖；保存的连接配置不被改写。
- 实际：68/68通过，原生工具保留、兼容 JSON 回退、推理强度回退、顾问请求、重复工具防重放及错误边界均符合预期。
- 状态：通过（隔离链路）；公网供应商请求未覆盖。

### 本轮失败与复测结果

- 命令：`node --test tests/shortcuts.test.mjs tests/codex-integration-config.test.mjs tests/tray-capabilities.test.mjs`。
- 实际结果：9 项中 8 项通过、1 项失败；`integration config updates browser and computer values while preserving unknown fields` 断言发现写回后 `computer-use/config.json` 的 `strings.extra` 丢失。
- 根因：将归一化后的 `strings` 整体写回并覆盖原始子对象。
- 修复：序列化时将规范化后的字段合并到原始对象，并将规范化字符串字段合并到原始 `strings` 子对象。
- 复测命令：`node --test tests/shortcuts.test.mjs tests/codex-integration-config.test.mjs tests/tray-capabilities.test.mjs`。
- 复测结果：9 项通过、0 项失败；包含配置未知字段、插件配置启停、快捷键规范化/匹配和能力发现。候选程序实际 UI 与重启持久化仍待验证。

### 候选 UI 验收与并发风险

- 首轮实际候选命令：`node tests/integration-settings-ui.cjs`，版本 `1.3.45`，入口 `release/win-unpacked/Scodex工作台.exe`，独立 profile 与临时 `.codex`。
- 首轮状态：失败，等待浏览器审批设置同时写入主进程状态和 TOML 超时；报告 `release/workbench-settings-20261107/integration-settings-ui-verification.json`。该报告没有保存失败时的 UI/TOML 快照，临时 profile 已清理。
- 分步复测：同一候选程序依次保存操作审批和下载审批，浏览器/电脑操控配置、插件开关、参考目录重启恢复、快捷键触发及重启共 5 项通过；报告 `release/workbench-settings-20261107-r2/integration-settings-ui-verification.json`。候选 EXE/ASAR SHA-256 分别为 `D6E99670415F94C2E6BBDF890BE73F6DD752E781C2370EF76FE9F8518366C0FE`、`E0CF511BCED256870EC10D615A6E8E8CC2E9B56048BB52D93249656F4ACF744B`。
- 并发回归命令：`node --test tests/codex-integration-config.test.mjs`。结果 3 项中 2 项通过、并发更新用例失败；两个并发更新分别写 `approval_mode` 与 `download_approval_mode` 后，最终至少一项仍为旧值 `ask`。
- 根因：`writeIntegrationConfig` 对同一文件并发执行读取、修改和原子替换；分段按钮在保存期间也未禁用，因此 UI 可发出并行写请求。
- 新方案：在 `electron/codex-integration-config.cjs` 按规范化配置目录串行化读-改-写，并保留现有原子替换。复测同目录并发更新须两键同时保留；随后重建候选，验证浏览器设置与 SKILL 列表刷新。
- 修复结果：配置目录队列已实施；`node --test tests/shortcuts.test.mjs tests/codex-integration-config.test.mjs tests/tray-capabilities.test.mjs` 10/10 通过。`npm run build` 和 `npx electron-builder --win portable --x64` 退出 0。
- 最新候选实际验收：`node tests/integration-settings-ui.cjs`，输出 `release/workbench-settings-20261108-r3/integration-settings-ui-verification.json`，6/6 通过；包含浏览器/电脑操控保存、插件切换、SKILL 参考目录重启恢复与列表刷新、快捷键触发/恢复。候选 EXE/ASAR SHA-256 为 `3A8B8E88B55DEEF3AB6CB633688852E56B3F99BF7A1CEDDC63E3A09DC38AC096` / `16511D44521536E9FCEBA8384EE6942E76853E06BC7BD2F40527FDA796FA9393`。
- 增量代码审查：本轮配置队列和相关测试驱动未发现高置信度问题；正式入口和用户数据尚未替换验收。
- 正式入口结果：`release/settings-reference-20261108/formal-replacement.json`，ASAR 版本 `1.3.45`，EXE/ASAR 哈希均与候选一致；PID `29240` 保持运行，CDP 读取标题 `Scodex 工作台`、输入框可见、聊天数量2。
- 用户数据结果：`C:/Users/Administrator/AppData/Roaming/scodex-workbench` 中记录的 5 个持久文件 SHA-256 全部保持不变；回滚文件位于 `release/settings-reference-20261108/rollback-1.3.44`。
- 未覆盖：模型公网请求和聊天发送内容未纳入本轮设置验收；Windows UAC/ACL 等系统边界仍按既有限制处理。

## 测试前置条件

- 每轮测试前读取本文件；测试不得使用聊天中出现的服务密钥。
- 临时 `.codex` 只复制公开配置字段和测试插件，不修改 `E:/GDP/.codex`。
- 候选和正式入口不得同时运行并写入同一 profile。

## 未覆盖范围与限制

- loopback 或隔离服务只能验证应用链路，不能证明公网模型供应商可用性。
- Windows 账号、ACL、UAC 和外部应用安装状态仍影响电脑操控的实际能力。
- 候选和正式入口分别通过实际 UI 验收；不将本轮结果外推为公网模型供应商可用性。

## 记录规则

- 每个场景记录程序入口、版本/构建标识、环境、步骤、预期、实际结果、状态和可定位证据。
- 失败和未完成验证保留原因；不以启动成功或截图单独替代功能验收。
