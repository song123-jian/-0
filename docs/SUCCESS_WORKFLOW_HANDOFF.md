<!-- message-resource-links-20261107:start -->
## 消息路径与设置参照测试交接（实际程序部分通过）

- 测试对象：release/message-workspace-20261107/candidate/win-unpacked/Scodex工作台.exe，1.3.44、Electron45、Windows x64、Node24；build-candidate.log已完成。正式入口E:/GDP/Scodex/App/Scodex工作台.exe仍1.3.43。
- 有效已有结果：release/message-workspace-20261107/targeted-tests.log记录26/26、0失败，覆盖message-files、message-presentation、settings、desktop-control；接续摘要确认同轮完成，本次不重复执行未变化范围。

| 场景/操作 | 预期与实际 | 状态/证据 |
| --- | --- | --- |
| 路径解析、中文/空格/Markdown/行号及命令拒绝 | 本机路径保留，命令不识别为路径 | 通过，targeted-tests.log |
| 目录授权/过期/权限和UTF-8预览 | 仅授权目录可读，过期拒绝、文本正确 | 通过，同上 |
| 参考配置白名单 | 仅兼容公开字段，无凭据返回 | 通过，同上 |
| 相关消息/设置/操控及原有存储辅助 | 原用例正常 | 通过，同上；不是实际UI验收 |
| 实际Electron消息链接 | 用户1/助手4/表格1链接通过，第三工作区选中及Markdown已显示 | 首组通过；ui/message-workspace-ui.json |
| Explorer与后续设置/重启/快捷键 | Explorer COM状态未读到窗口而超时；后续未执行，正常退出0 | 失败证据保留，尚未完成验证 |
| 构建、包身份、正式替换/启动 | 候选构建完成；其余未执行 | build-candidate.log；尚未完成整体交付 |

- 失败恢复与下一轮：ui-continuation中原生Explorer/Markdown/源码组通过，原COM失败保留；其后chat-only预期拒绝实际允许，根因为测试假设与既有完整访问策略不符。只将该用例改为真实grant目录越界拒绝；继续五类设置/重启/快捷键/提示，不改既有全局权限，不重跑已通过组。
- 前置：隔离profile和受控工作区；真实文件/IPC/Electron，若外部模型HTTP使用loopback须明确替代范围。E:/GDP/.codex只读，配置白名单实际读取成功，不等于所有运行能力已验证。
- 当前续验：ui-settings/message-workspace-ui.json的目录grant边界和四类参考设置应用/技能发现/磁盘保存两组通过；加上原链接与Explorer两组，4组继续有效。computer-use原生`Control_L+r`与`Ctrl+r`两次均未见页面请求，第二次焦点回到外层窗口；已停止输入重试，快捷键原生输入标记“尚未完成验证”。实际持久化记录确认`desktop_screenshot`成功；上一轮状态条读取到初始化中文而非设置事件，磁盘已证实`computerLocale=en-US`，现等待事件后核对英文/颜色。续验驱动已等待模型保存、兼容候选无“执行任务”按钮；浏览器审批通过，继续提示/重启/布局，不判为产品缺陷或通过。
- 阻塞/限制：没有完整宿主源码，不能证明全部Codex功能复制；当前未完成项是待执行工作，不记通过。三个已有夹具/候选仍需在最终验收后核实清理。
<!-- message-resource-links-20261107:end -->

<!-- advisor-repair-20261107:start -->
## 1.3.43上一增量测试交接（完成）

- 当前结果：原1.3.42已按NSIS安装为本轮1.3.43；导航缩小后再次覆盖成功，81文件与候选匹配。正式入口E:/GDP/Scodex/App/Scodex工作台.exe；文件/注册表1.3.43，ProductVersion1.3.43.0。EXE ff62a366831b92fba6ec200d0549a2aac0cb32114c2b2aec174a4dfcdca5b02e；ASAR a11e9f6480c4804caf45da933be898273f16783e3c4293d46df1610a7324dd59；安装包263a4d6ab09097919b124f1eaee64e6c71b6f77d2b2855f650a1523ba4d1d89f。
- 最新尺寸：导航20px、按钮行高12px、普通线宽6px/高1px（间隔9px，激活14px）；单条预览300px、正文12px、收紧内边距。悬停/聚焦单条、移开隐藏、原生点击/键盘定位、回到最新及流式历史阅读逻辑保留。
- 正式数据：真实profile原2会话/2消息及原有字段、当前活动会话保留。顾问仅从无路由claude-sonnet-5-5改claude-sonnet-4-6，其他配置与加密凭据未变。真实profile验收与缩小后正式验收各3组通过；已正常退出测试并以常规入口重开PID31140，无调试端口。
- 备份与回滚：本轮固定E:/GDP/Scodex/App.previous保存旧1.3.42，29文件逐项哈希通过；正常退出工作台后可恢复该目录文件，profile独立保留。未执行真实卸载/回滚，文件备份可恢复性仅由完整哈希核对支持。
- 清理：递归删除临时夹具被自动审批blocked by policy拒绝，未重试；11份夹具已移至workbench/手动删除/advisor-repair-20261107/fixtures，原路径不存在；25旧源码仍在同目录obsolete-source，未物理删除。截图、报告、测试源码、候选、安装包和回滚备份保留。
- 限制：GPT/国模/Grok/Claude实际工具及标记通过；Kiro HTTP200/工具成功但一轮回复偏离标记，该格式用例保留失败，后续真实顾问计划/完成两关口通过；不外推所有公网兼容。首缩小打包因下载ETIMEDOUT失败，仅改用已安装Electron45.0.0的electronDist后成功，不改产品逻辑。
- 使用Skill：requirement-understanding、systematic-debugging、computer-use；无子Agent。

- 实际环境：Windows x64，Node24.11/Electron45；实际候选与正式EXE、React、IPC、Windows加密及文件系统。隔离UI仅用loopback替代外部模型HTTP；真实公网用例另列，不由模拟代替。最终视口1064×660，窄窗口600×720。

| 范围及操作 | 预期/实际结果与状态 | 证据 |
| --- | --- | --- |
| 适配/保存辅助 | adapter90/90、保存16/16范围重叠不相加；枚举17/17、runtime19/19通过，GPT首次69/70中的唯一失败已修复并定向复验 | [枚举](../release/advisor-repair-20261107/enum-green.log)、[runtime](../release/advisor-repair-20261107/runtime-final.log) |
| 候选适配UI | 原生/JSON、子模型、错误隔离、取消、设置8组通过 | [实际候选](../release/advisor-repair-20261107/candidate-ui/model-adapter-ui.json) |
| 工作区完整配置 | 前4组弹窗/焦点、三角色独立保存、错误保留草稿、三角色模型列表、历史阅读/忙时草稿通过；末组驱动Enter缺text仅修驱动后由导航最终记录覆盖 | [工作区](../release/advisor-repair-20261107/workspace-ui/workspace-model-ui.json)、[导航](../release/advisor-repair-20261107/navigation-final/workspace-model-ui.json) |
| 真实顾问及五组 | 顾问双关口与写文件仅一次2组通过；GPT/国模/Grok/Claude通过，Kiro格式偏离保留失败，模型联网为单次观测 | [顾问](../release/advisor-repair-20261107/real-advisor-final/model-adapter-ui.json)、[五组](../release/advisor-repair-20261107/live-final/live-models.json) |
| 缩小后的实际候选 | 原生悬停第2条只见单条、移开隐藏、原生点击定位、再返回首条；键盘/600宽弹窗无溢出；尺寸20/12/1px、预览300px/12px符合预期；1组及补充几何通过 | [缩小UI](../release/advisor-repair-20261107/compact-ui/workspace-model-ui.json)、[最终截图](../release/advisor-repair-20261107/compact-ui/workspace-model-final.png) |
| 构建身份/正式替换 | 94文件ASAR SHA及运行package字段一致，NSIS退出0、81正式文件匹配，文件/注册表版本1.3.43；通过 | [构建](../release/advisor-repair-20261107/build-verification-compact.json)、[正式替换](../release/advisor-repair-20261107/formal-replacement.json) |
| 真实profile与重开 | 首3组验证顾问单角色保存、其他配置/加密凭据及聊天不变；缩小后3组验证正式入口、原生悬停尺寸、原字段/活动会话不变；测试均正常退出0，常规入口重开PID31140 | [首profile](../release/advisor-repair-20261107/formal-profile-verification.json)、[最终profile](../release/advisor-repair-20261107/formal-compact-profile-verification.json)、[重开](../release/advisor-repair-20261107/formal-reopen.json) |
| 审查及清理 | 25文件增量审查通过，之后仅CSS尺寸补审；11夹具移手动删除，原址不存在，报告/截图保留；不再依赖被移动fixture | [审查](../release/advisor-repair-20261107/incremental-review.json)、[清理](../release/advisor-repair-20261107/cleanup-verification.json) |

- 截图结论：当前设备、页面、视口和数据状态下无可见错误。未变化模型与保存逻辑结果继续有效，不因新需求或交接重跑。新消息文件访问功能尚未实施/验证，范围见最新节；真实回滚/卸载及其他未变化业务未纳入。
<!-- advisor-repair-20261107:end -->

<!-- github-update-1.3.42:start -->
## GitHub 1.3.42 本机升级验证（2026-11-07，升级范围通过）

- 实际对象：Scodex 工作台 1.3.42，Windows x64；正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`。Windows 产品版本 1.3.42.0，设置页显示 v1.3.42；主程序 PID 35716 保留在聊天页，原快捷方式启动，设置→常规→退出程序可完整退出。
- 前置与范围：旧 1.3.31 未运行，EXE/ASAR 摘要与原安装记录一致；安装前将 83 个 App 文件复制并逐项大小/SHA-256 核对到固定 `E:/GDP/Scodex/backups/App.previous`。本轮只验收下载身份、原路径安装及最小实际界面操作，不把发行说明或旧版本逻辑测试计作新版实测。

| 验证范围 | 环境、实际操作与预期 | 实际结果/状态及证据 |
| --- | --- | --- |
| 发布与完整包 | 初次 GitHub Latest API→curl 断点续传→Get-Item/Get-FileHash；预期完整字节数及摘要一致 | 通过；v1.3.42，181114245 字节；SHA-256 `7adcf6e067747afe073c4a70443625cc3745f7cd0ed38508e065d594f811847b`。根目录安装包与候选一致；[发行记录](../release/github-update-1.3.42-20261107/release-identity.json) |
| 旧版回滚完整性 | robocopy App→备份，逐项核对相对路径、大小及 SHA-256；预期 83 文件一致 | 通过；611251042 字节、83 文件匹配；[固定清单](../../backups/App.previous.manifest.json) |
| 正式覆盖安装 | Start-Process 安装器，参数 /S /currentuser /D=E:\GDP\Scodex\App，等待结束；预期退出 0、原入口版本更新 | 通过；安装 PID 6056 已退出 0；原目录版本 1.3.42.0；[安装结果](../release/github-update-1.3.42-20261107/installation-result.json) |
| 安装后身份与入口 | 读取正式 EXE/ASAR 摘要、Windows 卸载注册、根/桌面快捷方式；预期版本对应且指向原 App | 通过；EXE `317a924eb2a279cbe6d4501090a3a661c46b742a922e83077e32d1c8dfd8eccc`，ASAR `24dd7be3e20cc0ee06a34175419f979c6572716875884f180d2debfcc8317a05`；注册 1.3.42，两个快捷方式目标正确；[入口证据](../release/github-update-1.3.42-20261107/installed-entry-verification.json) |
| 实际程序界面 | 启动正式 EXE，用 computer-use 读取主界面→点击设置→核对 v1.3.42→Alt+左箭头返回；预期页面/版本/导航正确 | 3/3 通过；主界面、设置版本和返回聊天均核对；[实际界面报告](../release/github-update-1.3.42-20261107/ui-verification.json)。未发送模型消息或编辑配置 |
| 清理及残留 | 新版验收后清理较早 App 备份和下载副本；删除被审批拒绝后按规则移动并重新读取路径 | 已移动、尚未删除；4 项原址不存在、现存于 E:/GDP/Scodex/手动删除/github-update-1.3.42-20261107；[精确清单](../release/github-update-1.3.42-20261107/cleanup-verification.json) |

- 有效旧结果：1.3.31 记录仅用于安装基线与回滚来源；未重复无关逻辑、全量测试或构建。复用原始已发布安装包，本轮无产品代码差异，增量产品代码审查不适用。
- 失败与恢复：初始单流慢速中止；Range 首次连接超时后恢复，分段脚本被执行策略在启动前拒绝，改断点续传后完整摘要通过。原生窗口激活及无截图几何输入失败，带截图状态确认后坐标设置导航及键盘返回成功。一次交接补丁定位错误在落盘前中止，修正文件定位后更新。删除命令被 blocked by policy 拒绝，未重复删除，安全移动后回读确认。最终 API 重查被未鉴权限流，不记为通过，不影响初次元数据与完整包摘要。
- 未覆盖与限制：模型尚未配置，公网模型生成、全部新功能回归、源码同步均未执行；没有把页面出现或发行说明成绩扩展为这些功能通过。残留只待手动删除，不影响已验收升级。
- 回滚与复测：保留 1.3.31 正式安装包和固定 App.previous 备份；完整退出后再恢复，保留 profile。只有安装包/正式文件/运行环境或当前验收要求变化时，才定向复验受影响范围。[最终交付记录](../release/github-update-1.3.42-20261107/delivery-verification.json)。使用 Skill：requirement-understanding、computer-use；无子 Agent。
<!-- github-update-1.3.42:end -->

<!-- projectless-chat-20261101:start -->
## 无项目对话及GitHub发布验证（2026-11-01，1.3.31已完成）

- 对象：Scodex工作台1.3.31，Windows/Electron45/Node24；正式E:/GDP/Scodex/App/Scodex工作台.exe。EXE SHA256 65f36ee0b6c5a2f18a190a0b8fcfd6718f86c98e3e54f0d5fd08605f896b1785；ASAR 2813d9f25bd8f877a3fd380369e9564bf9a9929f16d8fbfe7a32adcc9372a888。独立临时profile、默认home、真实React/IPC/工具及持久化；仅模型HTTP用loopback受控服务。

| 验证范围 | 环境、步骤与预期 | 实际状态与证据 |
| --- | --- | --- |
| 逻辑回归 | node --test tests/projectless-chat.test.mjs tests/project-registry.test.mjs tests/conversations.test.mjs；空注册、迁移、绑定、归档拒绝、通用目录与历史 | 19/19通过，[GREEN](../release/projectless-chat-20261101/workspace-green.log) |
| 候选最后项目归档恢复 | 实际菜单归档最后项目→零项目→恢复及选择 | 对应细项通过，复用[前三组报告](../release/projectless-chat-20261101/candidate-final-ui/projectless-ui-verification.json)；原整体failed保留后续驱动断言，不改写 |
| 正式程序六组 | 零项目启动→发送落盘→保留可选项目切普通对话并发送→删除最后项目核对登记/聊天/磁盘→真实write_file并读中文→退出重启恢复并再次发送 | 6/6通过，脚本退出0，[正式报告](../release/projectless-chat-20261101/formal-ui/projectless-ui-verification.json)；真实配置未改 |
| 构建及原路径替换 | 138项固定输入→Vite→electron-builder dir→prepackaged NSIS→静默安装原App→81文件逐项比对、回读快捷方式 | sourceDrift=[]，构建/安装退出0，版本1.3.31与哈希匹配，[构建](../release/projectless-chat-20261101/build-verification-r2.json)、[安装身份](../release/projectless-chat-20261101/installed-file-verification.json) |
| 公开源码及增量审查 | 仅12白名单文件，131桌面输入字节及package语义核对；无手机端覆盖；差异、UTF8/BOM、语法、根版本外锁依赖及敏感字面量 | 通过，[身份](../release/projectless-chat-20261101/published-source-identity.json)、[公开审查](../release/projectless-chat-20261101/publication-incremental-review.json) |
| GitHub主分支与标签 | 分支推送→PR #2创建/合并→fetch main/tag→12文件哈希及文件树回读 | main与v1.3.31均a243e29cc6bd2126a6f2246ddd17741eda56d820，匹配提交9b98881源码树；通过，[源码终验](../release/projectless-chat-20261101/final-source-verification.json) |
| 安装包发行与匿名下载 | 草稿→上传→digest核对→正式发布设Latest→无Authorization完整流式下载SHA | 非草稿/非预发行、Latest=v1.3.31；HTTP200，189910973字节、SHA256 4701036f0ef136ad67e5353a8e067168a53478fb9add514dcab1bd42d78474e9与GitHub/安装包一致；通过，[发行](../release/projectless-chat-20261101/final-delivery-verification.json)、[下载](../release/projectless-chat-20261101/public-download-verification.json) |
| 清理与双交接 | 回读两交接的本轮区块、相对链接、编码/BOM、非本轮章节保留；检查3失败夹具原/现路径 | 成功夹具已删除；3失败夹具可恢复移到手动删除且原址不存在，无运行依赖；双交接通过，详见cleanup-verification.json及handoff-final-verification.json |

- 正式命令：SCODEX_PROJECTLESS_DEFAULT_HOME=1、SCODEX_PROJECTLESS_SCOPE=formal、SCODEX_PROJECTLESS_EXE=正式入口、SCODEX_PROJECTLESS_OUTPUT=本轮formal-ui，node tests/projectless-ui.cjs；退出0。最终截图已查看，当前设备、页面、视口和数据状态下无可见错误。成功临时OvE4TX自动删除，无需要保留的常驻测试或未结束有限任务。
- 发布检出：E:/GDP/Scodex/-0-import-candidate-20261031，feature/release-1.3.31；使用既有Git凭据与代理，未记录令牌。两公开交接已随源码提交并回读，内容只引用本轮有效证据。发布说明回读与候选一致；1.3.30公开版保留回滚。
- 安装包与回滚：E:/GDP/Scodex/Scodex-Workbench-Setup-1.3.31-x64.exe及同摘要Release；旧App83文件备份E:/GDP/Scodex/backups/projectless-chat-20261101-1.3.30/App-1.3.30与旧Setup保留。
- 恢复证据：默认home冲突已修复；网络白名单/异步菜单/保存节流/旧按钮为原驱动问题。手机并发差异使首轮整快照相同假设失败，改为桌面白名单并复核；首次整包上传90秒写超时且草稿无资产，改1MiB流式33.2秒上传后验收通过；原失败未改写，未重复运行无关全量测试。
- 待手动清理：E:/GDP/Scodex/workbench/手动删除/projectless-chat-20261101下scodex-projectless-ui-Wew3nF、S5SNq0、tPTY75对应目录（实际完整名称见[清单](../release/projectless-chat-20261101/cleanup-verification.json)）。自动审批拒绝删除blocked by policy，已移动而非已删除；仅此三目录可手动删除，不影响程序与验收。
- 未覆盖：公网模型生成、第二台真实设备、未变化业务与手机端并发功能。此前1.3.30未变化结果按原范围复用，不计为本轮新增通过；若代码/配置/输入/程序或资产身份变化，仅复验受影响内容。当前无功能或发布阻塞。使用Skill：requirement-understanding、test-driven-development；无子Agent。
<!-- projectless-chat-20261101:end -->

<!-- repo-sync-1.3.30-20261101:start -->
## GitHub 发布检出 1.3.30 验证（2026-11-01，已完成）

- 实际对象：E:/GDP/Scodex/-0-import-candidate-20261031，feature/release-1.3.30提交447927139ed12cf8bf1eb58ecea689bf76b86428；Windows/Node24.11/npm11.6，已有缓存依赖+NODE_PATH=E:/GDP/Scodex/workbench/node_modules。
- 安装包：E:/GDP/Scodex/Scodex-Workbench-Setup-1.3.30-x64.exe，189909290字节、SHA256 0eded7ad986368d264070805ea3045545365282aafb6f0172e86431be503f39f。已验收实际程序为1.3.30候选及E:/GDP/Scodex/App/Scodex工作台.exe；后续并发版本不冒充本轮对象。本轮分发同一已验收安装包，不重复重建/递增/替换本机程序。

| 验证范围 | 环境、真实步骤及预期 | 最终实际/状态 | 证据 |
| --- | --- | --- | --- |
| 正式源码身份 | 逐文件SHA核对136桌面输入，验证运行/构建字段 | 135字节相同，package省略3未完成手机脚本后JSON一致；通过 | [身份](../release/repo-sync-1.3.30-20261101/published-source-identity.json) |
| 完整发布测试与复测 | npm test -- --test-concurrency=1；EBUSY后仅修fixture退出等待并执行node --test tests/session-background.test.mjs | 首轮402/403，定向7/7；六项重叠不相加，去重403项全部覆盖，无剩余失败；产品和功能断言未改 | [首轮](../release/repo-sync-1.3.30-20261101/npm-test.log)、[复测](../release/repo-sync-1.3.30-20261101/session-background-retest.log)、[汇总](../release/repo-sync-1.3.30-20261101/test-summary.json) |
| 实际EXE结果复用 | 对应1.3.30桌面代码、配置和安装包身份未变化 | 既有21/21逻辑、候选6/6和正式3/3实际UI及安装结果继续有效；仅模型发现用loopback，异机为受控标记 | [正式安装](../release/device-initialization-20261101/installation-verification.json)及设备初始化章节 |
| 增量审查/编码 | 仅a13a91e→本轮12文件，含新模块/测试与清理修正；版本、UTF8/BOM、凭据字面量 | 无剩余高置信度问题，UTF8无BOM，无替换字符或真实凭据字面量；通过 | [审查](../release/repo-sync-1.3.30-20261101/incremental-review.json) |
| GitHub PR/源码 | Git推送→API创建PR/保护检查→合并回读→fetch main/tag→文件树比较 | [PR #1](https://github.com/song123-jian/-0/pull/1)merged=true；main/tag均ba3e6f3ff5e28a7dc350269bff00854adba32323，README版本/链接/SHA正确；通过 | [最终核验](../release/repo-sync-1.3.30-20261101/final-delivery-verification.json) |
| Release与真实匿名下载 | 创建v1.3.30草稿→上传既有安装包→核对GitHub digest→发布→无Authorization完整流式下载计算SHA | draft=false、prerelease=false；HTTP200、189909290字节、SHA与GitHub digest和正式安装包相同；通过；未保存重复安装包 | [下载验收](../release/repo-sync-1.3.30-20261101/public-download-verification.json)、[发布响应](../release/repo-sync-1.3.30-20261101/release-published.json) |
| 文档与清理 | 回读双交接内容、链接、编码、BOM及格式；确认精确残留原/现路径 | 3文件可恢复移动，原址不存在，无运行依赖；双交接回读记录见右列 | [清理](../release/repo-sync-1.3.30-20261101/cleanup-verification.json)、[文档核验](../release/repo-sync-1.3.30-20261101/handoff-final-verification.json) |

- 初始失败及恢复：Git直连超时后使用系统现有代理成功；依赖联接前置检查被拦，未创建联接，既有依赖通过NODE_PATH复用；Windows helper的EBUSY仅测试teardown缺退出等待，原失败保留。目录删除被自动审批blocked by policy拒绝，未执行删除；之后可恢复移动成功，不将移动记为删除。
- 待手动清理：E:/GDP/Scodex/workbench/手动删除/repo-sync-1.3.30-20261101/scodex-session-iXh1Xg，3个已知测试残留，无运行依赖。可仅删除该目录；其余证据、发布检出、安装包和回滚备份保留。
- 未覆盖：内置浏览器控制失败后只读确认一次，未完成最终网页截图；GitHub API和匿名完整下载实际通过。公网模型生成、高级浏览器、第二台实体电脑/克隆MachineGuid、真实卸载、手机和并发1.3.31未纳入。
- 复测条件：相关源码/配置/安装包身份/授权端点变化后只补验受影响范围；无当前待验收功能或未结束有限任务。使用Skill：computer-use；无Agent。
<!-- repo-sync-1.3.30-20261101:end -->

<!-- device-initialization-20261101:start -->
## 电脑端设备初始化验证（2026-11-01，已完成）

- 对象与环境：Scodex工作台1.3.30，Windows/Electron45/Node24；真实候选及正式E:/GDP/Scodex/App/Scodex工作台.exe。每阶段先读取相关交接，使用受控临时profile/密钥；未执行无关全项目测试。
- 前置：正式基线1.3.29，同轮目标1.3.30，失败重建未再次递增；候选通过后由同一win-unpacked生成NSIS，旧程序退出并备份App/profile后安装。

| 验证范围 | 真实步骤与预期 | 最终状态 | 证据 |
| --- | --- | --- | --- |
| 定向逻辑 | node --test tests/device-profile.test.mjs tests/model-connection.test.mjs tests/model-list.test.mjs；空白/发现/保存、同机/异机、迁移及坏标记保护 | 21/21通过 | [GREEN](../release/device-initialization-20261101/discovery-green.log) |
| 候选实际EXE | node tests/device-profile-ui.cjs；真实表单→loopback获取模型→加密保存→正常退出→重启；foreign marker隔离及旧版迁移 | 6/6通过；foreign原文件不变；重启保留 | [候选报告](../release/device-initialization-20261101/candidate-ui/device-profile-ui-verification.json) |
| 正式路径实际EXE | SCODEX_DEVICE_EXE指正式入口、SCOPE=formal；临时profile空白→获取→保存→重启 | 3/3通过；临时配置清理 | [正式报告](../release/device-initialization-20261101/formal-ui/device-profile-ui-verification.json) |
| 当前电脑初始化 | 备份移开旧profile→默认启动正式EXE→读取真实状态和空白表单→正常退出→无调试参数启动 | 模型/地址/列表/主子密钥为空；消息0、草稿0；独立home，无旧模型及同步凭据文件 | [当前profile](../release/device-initialization-20261101/current-profile-verification.json) |
| 构建及恢复 | 版本/NSIS退出码；81个正式文件、3源码+3dist及270个备份文件哈希；快捷方式指向原入口 | 全部一致；1.3.30.0；备份可恢复 | [安装](../release/device-initialization-20261101/installation-verification.json)、[文件](../release/device-initialization-20261101/final-file-verification.json)、[备份](../release/device-initialization-20261101/backup-manifest.json) |
| 实体电脑画面 | 正式窗口置前；1466×933最终截图一次，集中核对文字、布局、导航、输入及状态 | 当前设备、页面、视口和数据状态下无可见错误 | [截图](../release/device-initialization-20261101/final-desktop.jpg)、[界面核验](../release/device-initialization-20261101/final-visual-verification.json) |
| 审查与清理 | 仅本轮11文件差异；源码哈希未再变化；清理5个失败profile和测试端口文件 | 无未解决范围内问题；快照/证据/备份保留 | [审查](../release/device-initialization-20261101/incremental-review.json)、[清理](../release/device-initialization-20261101/cleanup-verification.json) |

- 失败证据：早期脚本0会话/设置文字按钮预期错误已校正；发现模型必填RED及按钮An object could not be cloned实际UI失败均已修复并通过同轮重建复验；ASAR核验路径改用Windows原生分隔符，截图按实际JPEG编码保存。历史失败保留，不作最终通过依据。
- 替代与未覆盖：仅模型发现用loopback替代公网，EXE/React/IPC/Windows身份及加密真实；异机使用受控标记，未实测第二台实体电脑或Windows克隆；未配置真实服务，未验收公网模型生成。无标记旧拷贝按迁移保留，不宣称识别来源。
- 运行及复测：PID12568，默认入口无remote-debugging参数；正常快捷方式启动、程序退出停止；E:/GDP/Scodex/workbench/workspace保留。无未结束有限任务或当前待验收项。未变化旧版无关结果复用，相关实现/配置/环境/输入/验收变化后仅复测直接范围。
- 双交接落盘回读、UTF8无BOM、链接/格式核验：[最终交接核验](../release/device-initialization-20261101/handoff-final-verification.json)。
<!-- device-initialization-20261101:end -->

<!-- mobile-implementation-20261101:start -->
## 手机端原生实施验证（2026年11月1日，进行中）

- 验收范围：对照原方案M1、M2、M3逐步实施，手机实现为原生Android；不交付网页/PWA/WebView。当前M1部分通过；M2手机网关与桌面电脑代理未实现；M3为debug候选，非正式交付。
- 当前测试对象：原生Android APK `com.scodex.mobile` v0.1.0，候选SHA-256 `5CA465FBC49FA841FC9B1541BA41A4C0E829F3F32835D47C70A61538FE87CFA6`，900230字节，APK v2签名有效且已安装；MuMu设备`127.0.0.1:16384`为Android 15/API 35。桌面产品保持正式版本1.3.30；本轮使用运行时密钥实际验收`https://catbee.online/v1`的模型连接、流式切换及本地停止。
- 本轮构建与安装：JDK 17纯Java回归5/5通过；Gradle 9.1.0 `:app:assembleDebug` BUILD SUCCESSFUL，33项任务（5执行、28复用）；`apksigner verify`确认v2有效，`aapt dump badging`确认为`com.scodex.mobile` v0.1.0、minSdk26/targetSdk35。`adb install -r`成功，`am start -W`返回`Status: ok`并启动`MainActivity`；进程PID 35847存在。设备回拉包为900230字节且哈希与候选一致。安装前回拉旧安装包作为[本轮回滚副本](../release/android-native-implementation-20261101/previous-installed-before-generation-registry-20261102.apk)，SHA-256 `C65BE5E51DD545FADB94CBDD56FCCFEB08B3878F5A3B60C798E158765D892BC6`；[安装后回拉副本](../release/android-native-implementation-20261101/installed-current-5CA465FB.apk)。
- 体系边界：桌面`chat:send`、取消、审批与agent runtime当前通过Electron IPC工作；项目未发现手机网关/配对接口。`catbee.online`只覆盖模型目录与生成，不覆盖账号、项目授权、电脑注册及远程执行。网关部署位置与认证责任待用户决定。
- 环境与凭据：Windows主机通过HTTPS访问模型服务；凭据不写入APK或应用存储。MuMu已安装并启动debug APK；API密钥将在应用内运行时输入后验证，不作为交接内容。
- 本轮长消息折叠验收：在MuMu Android15/API35、实际安装的`com.scodex.mobile` v0.1.0 APK上验证6行无入口、8行边界无入口、9行默认6行高度、展开/收起高度变化、稳定ID和展开状态持久化、进程重启恢复、另一长消息状态独立、16行助手正文完整，以及首条可见消息锚点保持。脚本仅注入并回滚应用私有SharedPreferences夹具，不访问模型服务。
- 当前回归结果（M1流式回复归属与停止回调）：以无Git仓库的修改前`MainActivity.java` SHA-256 `F10FA0E6F4067FB705E6F221BFE1E478CB75853143D581B68C0F863451D88671`为审查基线。新增生产注册表的纯JVM测试覆盖会话隔离、单会话停止、替换时旧绑定失效、全部取消及迟到请求绑定；5/5通过。构建、签名、安装、启动和回拉哈希匹配均通过。由于本轮未请求模型服务，真实流式切换/停止与服务端终态尚未验证；本轮未截图或完整读取屏幕无障碍树。[本轮验收报告](../release/android-native-implementation-20261101/generation-registry-verification.json)
- 测试脚本前置失败（非产品结果）：Windows PowerShell 5.1未能正确读取无BOM UTF-8脚本中的中文字符串；改用PowerShell 7后解析通过。第一次设备执行因测试备份目标`files/`目录不存在而停止，未发送消息或写入偏好；应用随后已重新启动并确认回到前台。脚本已改为在应用私有根目录暂存会话与设置备份，下一轮再运行。
- TDD RED基线（已执行）：在已安装`com.scodex.mobile` v0.1.0、MuMu Android15/API35上运行`android-native/tests/long-message-folding-verification.ps1`。先发送8个显式短行，未出现“展开”，对应边界断言通过；再发送9行，因当前APK无展开入口触发预期失败，证明该测试可检测缺失行为。脚本使用本机不可用端口，不请求外部模型；finally恢复原会话及模型连接设置、清除测试草稿和临时备份。复核为1个原对话/2条原消息、测试行不存在，API密钥未持久化。该结果是RED基线，不是产品验收通过。
- 旧记录迁移RED（已执行）：新APK首次启动后直接回读旧会话JSON，预期每条既有消息立即拥有非空`id`和`expanded=false`；实际首条旧消息仍缺少`id`，测试按预期失败。未发送消息或改动会话；脚本恢复原设置并重启应用。下一版实现后用同场景验证首次加载持久化及再次启动ID保持一致。
- 旧记录首次加载迁移（修订构建，C65BE5E5）：在MuMu Android15/API35上停止应用、保留现有会话内容并重启；直接回读`scodex_local_conversations.xml`确认全部既有消息已有非空稳定`id`和`expanded=false`，脚本通过并在结束时恢复原设置。此用例未改消息正文，无外部模型请求。
- 原定长消息验收已执行并生成报告；为直接验证6行预览高度，后续在同一设备新增6行参照消息并改走独立报告路径`../release/android-native-implementation-20261101/long-message-folding-verification-v2.json`。复验仍使用本机SharedPreferences隔离夹具，finally恢复原会话与设置，不访问模型服务。
- 夹具注入前置失败（非产品结果）：`run-as`子shell中相对路径解析未落在应用根目录，无法创建`shared_prefs/folding-test-conversations.xml`；脚本在启动测试应用前中止并已还原原会话/设置，无本机临时文件残留。只读确认应用私有目录为`/data/user/0/com.scodex.mobile`，`shared_prefs`存在且`run-as`进程UID为应用UID。改用绝对路径后shell重定向仍返回Permission denied，表明该子shell写入行为不适用；下一轮用应用UID直接执行`tee`接收标准输入。
- 首次fixture UI检索失败（非产品结论）：绝对路径`run-as tee`成功写入且应用启动；会话fixture含四条预期消息，8行用户正文边界为`[937,1235][1376,1893]`，下一条作者节点为`[1332,1949][1376,1955]`，消息正文落在聊天视口之外，未进入无障碍树。脚本finally还原原偏好并重启应用；已改为滚动至9行消息的折叠按钮可见，再测该消息自身的顶部阅读锚点。重启后分别滚动检查展开的9行消息、助手正文与另一条长消息。
- 折叠主场景部分复验（未通过完备验收）：同一已安装候选实际UI已通过8行无入口、9行有入口、展开正文高度增加、9行顶部锚点稳定、收起恢复原始高度、状态写入SharedPreferences以及强制停止并重启后恢复展开状态。失败只在助手正文断言：测试把当前屏幕裁切后的TextView可访问边界与用户折叠高度比较，错误地把viewport裁切当成文本截断；不作为产品失败证据。finally恢复原会话和设置，设备回到原1个对话/2条消息，无fixture或密钥残留。修订断言为助手无折叠控件且其rendered text包含第16行，再验证另一长消息独立折叠状态。
- 第二次设备测试前置失败（非产品结果）：会话与设置备份已完成，但`uiautomator dump`写出`/sdcard/window.xml`有效层级后以139退出，严格检查退出码使测试中止；脚本的finally已恢复两份偏好并重启应用。现在改用本轮专属`/data/local/tmp/scodex-folding-ui.xml`，每次先删除旧文件，再以新文件能否读取并解析为准；最终清除该临时层级文件。
- 第三次设备测试前置失败（非产品结果）：脚本读取的UI层级有效，但定位器把未指定的可选筛选条件解释为空字符串，误报缺少“设置”节点；只读状态确认表明节点存在，偏好备份已恢复、应用仍在前台。已修复定位器并将先前标准路径的临时`/sdcard/window.xml`纳入清理。
- 第四次设备测试前置失败（非产品结果）：定位器匹配到“设置”后将单个XML节点展开为标量，再用`[0]`取其首个子节点，得到空值；消息与设置测试未开始，脚本finally恢复应用并清理临时文件。已让节点集合始终保留数组形态，并增加空点击目标保护。
- 6行参照高度复验首轮（验收脚本断言失败）：已安装APK和UI均正常；9行消息收起高度514px、6行参照516px，设备物理密度640dpi，差值0.5dp。严格像素相等过严，不能据此证明产品行为失败；已通过只读回读确认`MainActivity`前台、原会话1个/原消息2条、无夹具/密钥/临时文件。更新脚本以密度归一化并要求高度差小于1dp，再运行一次。
- 6行参照高度复验通过：MuMu报告物理密度640dpi，参照高度516px、9行消息收起514px，差值0.5dp，小于1dp阈值；展开后729px，折叠按钮和状态符合预期。原本因严格像素相等产生的首次失败已按测试精度差异处理，不作为产品失败结论。

| 范围 | 场景、操作与预期 | 实际结果/状态 | 证据 |
| --- | --- | --- | --- |
| 旧凭据鉴权诊断 | `GET /v1/models`，Bearer鉴权，预期返回模型目录 | HTTP 401；旧凭据被拒绝，随后用户提供新凭据；未重复旧请求 | 当前任务检查点中的脱敏结果 |
| 模型目录 | 使用新凭据请求`GET https://catbee.online/v1/models`，预期读取可用模型ID | HTTP 200，返回5项：`deepseek-v4-flash`、`deepseek-v4-pro`、`deepseek-v4.1-flash`、`glm-5.3-flash`、`kimi-k3.1-pro` | 当前任务检查点 |
| 最小真实生成 | `POST /v1/chat/completions`，模型`deepseek-v4-flash`，提示“只回复 OK”，`max_tokens=8`、`temperature=0` | HTTP成功，模型返回`OK`；证明该主机、端点、当前凭据与该模型组合可完成最小生成 | 当前任务检查点 |
| 原生工程离线构建 | Gradle 9.1.0执行`--offline --no-daemon --console=plain :app:assembleDebug`，预期生成debug APK | 配置阶段失败：离线缓存缺少AGP 9.0.1所需Kotlin Gradle插件传递组件；未进入Java编译或打包 | 本轮Gradle输出 |
| 原生工程联网首次构建 | Gradle 9.1.0在线解析依赖后执行`:app:assembleDebug` | 依赖解析已继续至`:app:compileDebugJavaWithJavac`任务依赖判定；随后因Gradle进程未设置`ANDROID_HOME`停止，尚未编译Java | 本轮Gradle输出 |
| 原生工程定向构建 | 给Gradle进程设置SDK目录后执行`:app:assembleDebug`，预期Java编译成功并生成debug APK | 通过，33项Gradle任务完成；Java编译、资源处理、debug签名和APK打包成功。日志有SDK XML版本和弃用API警告 | `android-native/app/build/outputs/apk/debug/app-debug.apk`（869450字节） |
| 下拉版本定向构建 | 给Gradle进程设置SDK目录后执行`:app:assembleDebug`，预期编译原生下拉并生成debug APK | 通过，33项任务完成（5执行、28 up-to-date），APK 895719字节；SDK XML和deprecated API警告未阻止构建 | SHA-256 `D893B8BC12BA9584BFB32BC1C25E7EB44892061F06E43DA05118FED433FC35BE` |
| 原生菜单修订构建与安装 | 使用缓存Gradle 9.1.0 `bin/gradle.bat`构建并ADB安装，实际回拉安装包核对哈希 | 通过，BUILD SUCCESSFUL，33项任务；安装成功并启动，版本`0.1.0`；回拉包与候选哈希一致 | 895867字节，SHA-256 `45414F30DDC2AE8C46845F9D935DE5E7D94F155F8340B3B4A6E3078B40DFAAE5`；[安装回拉副本](../release/android-native-implementation-20261101/installed-current-45414F30.apk) |
| APK身份与安装 | `aapt dump badging`、`apksigner verify`，再ADB安装并启动真实Activity | 通过；`com.scodex.mobile` v0.1.0，minSdk26/targetSdk35，debug签名有效；安装成功，Activity为前台 resumed 页面 | APK SHA-256 `DE2B910A9EDD2764CFC795AF34FAAA61FF27A0C8044623D5FA95466CFBF36A31` |
| 下拉版本APK安装 | `adb install -r`安装重建后的候选并启动`MainActivity` | 通过，895719字节，包名/版本不变；已安装新版并启动 | APK SHA-256 `D893B8BC12BA9584BFB32BC1C25E7EB44892061F06E43DA05118FED433FC35BE` |
| MuMu首屏可见性 | 设备`127.0.0.1:16384`、Android15/API35、1440×2560；启动后截图和无障碍树核对页面、控件、状态栏、安全区与遮挡 | 局部通过：页面正常显示，模式、输入、新建、历史和设置节点可见且可点击；首屏当前设备/页面/视口/数据状态下无可见错误；尚未操作交互 | [首屏截图](../release/android-native-implementation-20261101/mumu-initial.png)，ADB UI hierarchy |
| 导航首次实际点击 | ADB点击“历史”“设置”，读取当前无障碍层级，预期出现对应标题和API字段 | 通过：历史列表标题及设置中的API地址、密钥、模型目录入口可见 | 本轮ADB UI hierarchy |
| 四模式首轮切换 | 按问答、规划、编程、办公顺序点击，并读取应用私有偏好，预期每项分别落盘 | 尚未完成逐项验证。测试初次停留在设置页且模式栏隐藏，偏好未变化。 | ADB `run-as`偏好回读及本轮检查输出 |
| 四模式断言脚本前置诊断 | 检查失败后核对设备当前导航状态与模式栏可见性，定位点击无效原因 | 失败原因是测试从设置页开始；该页隐藏模式栏，坐标点击落在设置内容上。属于测试前置状态错误，不归因于实现。下一轮先点“对话”，核验模式节点可见后再逐项点击并解析SharedPreferences XML | 本轮ADB hierarchy及解析后的偏好值`office` |
| 四模式逐项选择与持久化 | 先进入“对话”页确认四模式可见；按问答、规划、编程、办公顺序点击；每次读取SharedPreferences XML并解码嵌入JSON，预期当前会话mode分别匹配点击项 | 通过，`answer`、`plan`、`code`、`office`四项逐项匹配持久化值 | ADB点击及`run-as`+PowerShell结构化XML/JSON回读 |
| Android模型目录请求 | 设置页使用当前运行时密钥读取`https://catbee.online/v1/models`，预期显示5个模型 | 通过；实际界面状态为“已读取 5 个模型”，说明应用请求返回并填充候选数据 | MuMu UI层级回读；密钥字段不读取或输出 |
| 旧版模型候选展开 | 在旧`AutoCompleteTextView`字段及箭头点击，预期出现候选列表 | 失败；两种点击均只聚焦输入框，UI层级无候选项；字段仍可编辑。该路径已由修订方案替换 | [失败截图](../release/android-native-implementation-20261101/mumu-model-dropdown.png) |
| 原生模型菜单与持久化 | 点独立箭头，预期显示5项；选一个模型并回读偏好；再手动输入自定义ID并回读 | 通过；菜单列出全部5项；选择`deepseek-v4-pro`已持久化，手动输入`manual-model-check`已持久化，随后菜单恢复到`deepseek-v4-flash`且回读一致 | [菜单截图](../release/android-native-implementation-20261101/mumu-model-menu.png)、ADB UI hierarchy与`run-as` SharedPreferences回读 |
| 空凭据目录失败及空菜单状态 | 无候选时请求模型目录，预期显示鉴权/密钥错误；打开菜单应明确无候选，同时可手动输入模型ID | 通过；设置页显示`读取失败（请先填写API密钥）`；菜单显示“当前没有可选模型”，无旧候选；输入`manual-model-check`后界面与偏好一致，随后恢复`deepseek-v4-flash` | [脱敏验收记录](../release/android-native-implementation-20261101/model-directory-state-verification.json)、MuMu UI hierarchy与`run-as` SharedPreferences回读 |
| 空数组成功响应 | 用模型API返回HTTP 200、空`data`数组，预期候选保持清空并提示模型可手动输入 | 尚未完成验证；当前没有隔离的可控HTTP服务端，未更改用户模型服务或密钥 | 代码分支静态检查；不能作为运行通过证据 |
| 并发目录请求乱序响应 | 交错发出两次读取并使旧请求晚返回，预期旧结果及错误不得覆盖最新请求状态 | 代码已增加请求代次检查；MuMu未连接受控乱序服务，尚未完成运行验证 | `MainActivity.modelRequestGeneration` 代码定向审查 |
| Android真实流式问答与对话保存 | 在候选APK中使用`deepseek-v4-flash`提交`Reply with exactly OK`，预期界面回复`OK`且消息落盘 | 通过；应用完成流式聊天请求，界面回复`OK`；`scodex_local_conversations.xml`结构化回读确认用户消息和助手回复两条均保存；API密钥偏好不存在 | [验收记录](../release/android-native-implementation-20261101/android-chat-verification.json) |
| 草稿保存与进程重启恢复 | 输入测试草稿，预期按会话ID落盘；结束后台测试进程并重启后输入框恢复、消息不丢失 | 通过；重启前后同一草稿均存在，输入框恢复原文，已保存的两条聊天消息保持不变；验收后清空测试草稿 | [验收记录](../release/android-native-implementation-20261101/draft-restoration-verification.json) |
| 用户长消息折叠 | 实际注入6/8/9/12行用户消息及16行助手消息；在MuMu中逐项查看控件、展开/收起、状态落盘、重启恢复、消息隔离和阅读锚点 | 通过；6行516px、9行收起514px（差0.5dp，小于1dp容差），展开729px；阅读锚点882px前后不变；8行无入口，助手全文无折叠，展开状态重启后恢复 | [增强验收报告](../release/android-native-implementation-20261101/long-message-folding-verification-v2.json)，SHA-256 `82610A3049D6EFA085CDFF4435471046446EB5956D7FBBCB365F0464F3157963` |
| M1回复注册表纯JVM回归 | JDK 17用`javac -encoding UTF-8`编译生产`GenerationRegistry.java`与`GenerationRegistryTest.java`，再运行测试入口 | 通过，5项：多会话隔离、仅停止目标会话、旧回复替换失效、Activity销毁全取消、失效后迟到绑定立即取消；测试输出目录已清理 | `android-native/tests/GenerationRegistryTest.java`；[验收报告](../release/android-native-implementation-20261101/generation-registry-verification.json) |
| M1候选APK构建与MuMu安装 | Gradle 9.1.0 `:app:assembleDebug`；签名/包身份核对；`adb install -r`后启动并回拉安装包 | 通过构建和签名；安装成功，`am start -W`返回`Status: ok`、进程PID 35847；回拉包哈希与候选一致。未做截图或完整无障碍树检查 | 候选900230字节，SHA-256 `5CA465FBC49FA841FC9B1541BA41A4C0E829F3F32835D47C70A61538FE87CFA6`；[安装副本](../release/android-native-implementation-20261101/installed-current-5CA465FB.apk) |
| M1应用内模型连接 | 模拟器设置页点击“测试连接”，预期通过用户所配模型服务返回简单结果 | 通过，原生页面显示“连接成功：OK” | [本轮验收报告](../release/android-native-implementation-20261101/generation-registry-verification.json)；密钥仅运行时输入 |
| M1真实流式与会话归属 | 在MuMu原生聊天发送1至300逐行请求；生成期间新建会话，再通过历史返回原会话，预期回复只归原会话且持续保存 | 通过；原会话助手全文包含1至300，正文1091字符；新会话保持空白，未见串会话 | 原生UI层级回读与`scodex_local_conversations.xml`结构化回读；[本轮验收报告](../release/android-native-implementation-20261101/generation-registry-verification.json) |
| M1真实流式本地停止 | 原生聊天发起长响应，在UI显示“正在回答”/“停止接收”时点击停止；核对本地消息、状态及延迟回调 | 本地停止通过：追加“已停止接收；服务端终态尚未确认。”，状态提示可见，按钮恢复；2秒后助手正文不变。服务端终态尚未验证 | 真正模型请求经`https://catbee.online/v1`；服务端无可读运行状态接口；[本轮验收报告](../release/android-native-implementation-20261101/generation-registry-verification.json) |
| 模型测试数据恢复 | 备份模拟器会话与设置，测试后恢复并重启应用 | 通过；会话/设置文件哈希分别恢复一致；原1会话/2消息可见，测试消息0条，API密钥未持久化，临时层级文件已删除 | ADB `run-as` 哈希/结构化偏好回读及恢复后原生界面层级 |
| Android IME/窄屏输入栏可见性 | MuMu API 35聊天页点击输入框，预期键盘弹出后输入区和操作按钮位于可视区域上方，底部导航不遮挡输入 | 尚未完成验证：API30+加入`max(systemBars.bottom, ime.bottom)`后，候选已成功构建并安装。输入框获得焦点但1440×2560截图无软键盘，控件边界保持输入框`[56,2128][1160,2296]`、底部导航`[56,2328][1384,2560]`。临时将`show_ime_with_hard_keyboard`设为1后仍未显示；默认且唯一IME为MuMu Sogou/Nemu输入服务，窗口请求高度为0。桌面键盘图标只打开“暂无键盘方案”面板。故无法判断IME inset修订效果，须在设备具备可显示键盘的IME后复验；临时设置已恢复0。通过ADB输入的测试草稿确实保存到当前会话，验证后已清空。 | [无键盘截图](../release/android-native-implementation-20261101/mumu-keyboard-open-ime-inset-20261101.png)、[临时开启设置时截图](../release/android-native-implementation-20261101/mumu-keyboard-open-visible-ime-20261101.png)，ADB输入法/窗口状态及uiautomator hierarchy |

- 已知失败及恢复：首次目录请求返回401；新凭据下主机请求成功，Android应用内目录读取随后显示5项。旧`AutoCompleteTextView`下拉点击失败后，修订为独立箭头+原生`PopupMenu`，实际展示5项、选择和手动输入均已通过。增量审查发现空目录/失败状态和并发响应边界；当前已清空每次读取的候选、加入最新请求代次保护并显示可手动输入提示。MuMu实际验证了空密钥失败后的无候选状态和模型手动输入；HTTP 200空数组及受控乱序响应仍未实测。首次` .\gradlew`命令未启动，因为工程没有wrapper且系统PATH无Gradle；改用缓存`bin/gradle.bat`后构建成功。模式逐项点击测试的失败由起始页为设置页引起，后续先进入对话页再逐项点击并已通过。本轮首次结果检查因`adb`不在PATH停止，改用SDK绝对路径后安装成功。IME测试临时启用系统显示设置仍未使MuMu Sogou/Nemu窗口显示键盘；画面确认其键盘工具只是无方案的按键映射面板，故不把此轮当作键盘布局验收。测试草稿已清除，设置已恢复原值0。凭据不在此文档或命令输出中保存。
- 构建失败恢复：离线缺失插件通过联网解析解决；首次在线构建因缺少SDK环境变量停止。给Gradle进程设置已确认SDK目录后，`:app:assembleDebug`成功。本次警告未阻止APK生成。
- 未覆盖：HTTP 200空模型数组、受控并发乱序响应、完整软键盘/窄屏验收、附件；手机网关、账号/设备配对、项目范围、桌面代理、远程运行/审批/停止终态、差异/成品及断线恢复；APK正式签名、版本升级和回滚。Android模型目录、原生下拉选择、手动输入、一次真实流式问答、草稿进程重启恢复及本轮用户长消息折叠在候选版中通过；尚未广泛验证目录模型。
- 后续验收入口：Android debug APK安装到已连接MuMu，记录包名、版本、SHA256、实际页面操作及请求结果；APK不得打包凭据，应用不持久化本轮密钥。
<!-- mobile-implementation-20261101:end -->

<!-- mobile-plan-20261101:start -->
## 手机端方案文档验证 2026年11月1日

- 实际对象：Scodex手机端详细落地方案1.0，桌面DOCX、Markdown与3张配图，非手机版程序；Word入口为C:/Users/Administrator/Desktop/Scodex手机端落地方案_20261101/Scodex手机端详细落地方案.docx。
- 环境与前置：Windows、捆绑Python/python-docx/pdfplumber、Word16.0只读PDF导出、捆绑Poppler；参考对象MuMu/com.larus.nova15.5.0，物理1440×2560。测试前定向核对本节，不运行产品测试。

| 验证范围 | 场景、操作与预期 | 实际结果与状态 | 证据 |
| --- | --- | --- | --- |
| 参考交互 | 实际打开/关闭对话与工作、模型/强度、目标、加号、侧栏和资料面板；观察布局与状态恢复 | 相关范围核实完成；无发送、上传、授权或任务执行 | [观察](mobile-plan-20261101/observations.json) |
| 内容与结构 | Python定向核对21章顺序、30个唯一验收编号、源稿与桌面Markdown一致、3个图片链接及3张嵌入图；解析全部DOCX XML与关系 | 全部通过；无外部关系和替换字符 | [文档验收](mobile-plan-20261101/document-verification.json) |
| 排版与文件 | Word只读导出PDF，Poppler生成页图，逐页查看1至24页；核对可读性、分页、缺字、重叠、正文截断、UTF-8无BOM及清单SHA256 | 最终24页全部通过；无可见截断、缺字、图表重叠或空白页 | [最终PDF](mobile-plan-20261101/render-verified/mobile-plan.pdf)、[原生导出](mobile-plan-20261101/render-verified/native-render.json) |
| 清理与交接 | 核对53个旧页图/缓存源与目标及哈希，回读两份交接的本任务标记块并检查内容、链接、编码和格式 | 文件移动成功；待人工删除，不影响文档验收；双交接最终回读记录另见右列 | [清理](mobile-plan-20261101/cleanup-verification.json)、[双交接回读](mobile-plan-20261101/handoff-final-verification.json) |

- 产物身份：DOCX SHA256 562b31c5f788c6d2c64536c844dc81032700537eeb2dbcb54301b5545d7b8871；Markdown SHA256 71ce2992a9d98ae398d357e4e6a1d36418f0cba2bb132ba7e7fa5e2a81784e87；PDF为最终24页。
- 失败与修正：默认渲染无LibreOffice，使用Word替代；29页/23页早期版本的分页及图标问题已修正，未将失败稿记为通过。[渲染失败](mobile-plan-20261101/render-failure.json)、[排版修正](mobile-plan-20261101/layout-revision.json)。旧临时图删除被策略拒绝，改为可恢复移动，[清理失败](mobile-plan-20261101/cleanup-failure.json)保留。
- 未覆盖：手机功能、APK、真实手机键盘、网络模型和远程执行尚未实施，本轮不记为通过；30项为未来用例；不重跑未变化产品测试或全量构建。
- 清理与复测：旧53个文件现位于本任务“手动删除”目录，清单记录原/现路径与哈希；可人工删除，最终PDF/24张页图和必要失败证据保留。文档内容、图片或生成方式变化时仅复验受影响项。当前文档验收无待办、无运行中有限任务。
<!-- mobile-plan-20261101:end -->

## 电脑操控提示与 Esc 停止验证（2026-11-01，1.3.29正式验收完成）

- 实际对象：Scodex工作台1.3.29，正式入口[EXE](../../App/Scodex工作台.exe)，FileVersion1.3.29、ProductVersion1.3.29.0；EXE SHA256 b0ae1303ece73ebf2d7c4e96f0d28f31fdf69bc97926887aa5d55837e58a751a，ASAR SHA256 e4554953159d73f45ff9763ea4e50bf328631500d3a155f628221e1824f2d5e9。原正式1.3.28已完成安装替换。
- 环境与前置：Windows10.0.26300 x64、Electron45、Node24.11.0；独立UUID profile/project/home、真实WinForms输入夹具、受控桌面权限。实际EXE、React、IPC、Windows输入及hook真实，仅模型HTTP使用loopback；未使用用户模型凭据。
- 实际命令：node tests/desktop-stop-ui.cjs。候选以SCODEX_DESKTOP_STOP_EXE指向win-unpacked、OUTPUT=candidate-ui-native-focus、SCOPE=full；正式以EXE=E:/GDP/Scodex/App/Scodex工作台.exe、OUTPUT=release/desktop-stop-20261101/formal-ui、SCOPE=formal。测试前均读取并核对本节及版本环境，有限任务已等待到退出0。

| 测试范围/操作与预期 | 实际结果 | 状态与证据 |
| --- | --- | --- |
| node --test tests/desktop-control.test.mjs tests/desktop-tools.test.mjs；共享owner、IPC来源、竞态、取消和权限 | 8/8；产品未再变化，继续复用 | 通过，[辅助记录](../release/desktop-stop-20261101/auxiliary-verification.json) |
| 相关JS/PS及UI驱动语法；原生监听ready后关闭stdin应释放 | 语法通过；hook ready239ms、总252ms、exit0 | 通过，[原生hook](../release/desktop-stop-20261101/native-hook-verification.json) |
| 固定快照npm run build、electron-builder dir；包资源与输入一致 | Vite成功、dir退出0；85项electron/dist与3zip一致，sourceDrift为空 | 通过，[构建](../release/desktop-stop-20261101/build-verification.json) |
| 候选实际身份/权限，提示不抢焦点，正常中文输入及模型自身Esc | 版本/profile/工作区一致；500×66无横向溢出、focus保留、模型Esc未自取消、完成后释放 | 通过，[候选6组](../release/desktop-stop-20261101/candidate-ui-native-focus/desktop-stop-ui-verification.json) |
| 外部窗口前台按Esc、原生点击停止；后续输入应阻断，普通聊天继续 | 均取消并释放hook，无后续输入；无关聊天完成。HTTP418错误及退出重启均正确清理 | 通过，同候选6组；正式复用错误场景 |
| prepackaged NSIS与静默安装至既有App；正式路径功能 | NSIS/安装退出0，正式EXE/ASAR同候选；注册版本1.3.29、三处快捷方式有效目标/图标正确；正式5/5通过 | 通过，[安装包](../release/desktop-stop-20261101/installer-build-verification.json)、[正式替换](../release/desktop-stop-20261101/formal-replacement.json)、[正式5组](../release/desktop-stop-20261101/formal-ui/desktop-stop-ui-verification.json) |
| 正式提示条截图及交互结果 | 已查看500×66提示截图；当前设备、页面、视口和数据状态下无可见错误 | 限定范围通过，[最终提示截图](../release/desktop-stop-20261101/formal-ui/desktop-control.png) |
| 17文件增量审查、最终版本/哈希及临时清理 | 差异审查完成，最终17项无漂移；EXE/ASAR/Setup身份一致；三UUID目录删除、EXE/夹具退出 | 通过，[审查](../release/desktop-stop-20261101/incremental-review.json)、[最终核对](../release/desktop-stop-20261101/final-incremental-verification.json)、[清理](../release/desktop-stop-20261101/cleanup-verification.json) |

- 失败证据与恢复：首快照遗漏build/icon.svg，补直接输入后成功；[首轮UI](../release/desktop-stop-20261101/candidate-ui/desktop-stop-ui-verification.json)仅第一组通过，随后SetForegroundWindow失败、模型requests为空。只将新驱动改为真实原生点击并保留前台断言，同一候选6/6通过；原失败不改为整体通过。最终汇总首次因开始菜单默认图标空路径/index0而中断，按Windows实际有效图标解析修正检查后通过，未改产品，见[元数据失败](../release/desktop-stop-20261101/formal-metadata-failure.json)。
- 版本/打包：1.3.28→1.3.29只递增一次；已验收win-unpacked使用electron-builder --win nsis --x64 --prepackaged candidate/win-unpacked，未重建程序。最终Setup位于E:/GDP/Scodex/Scodex-Workbench-Setup-1.3.29-x64.exe，SHA256 a2cdd94f8f08fd39223a48ebe80d06bfad24dedec0bbb19fed662d0e43318fa9。
- 回滚：保留1.3.28 Setup，SHA256 5d862a1754662ecb0092155b6ddc629dcaed979421914fa2cdb825541b457aa2；正常关闭Scodex后安装回同一App路径，保留用户数据。实际卸载未验收，不以配置审阅代替通过。
- 清理状态：3组UUID临时目录不存在、测试进程均退出，无常驻测试服务。三份构建中间目录已移动到手动删除/desktop-stop-20261101，实际原/现路径见清理记录；不影响正式运行。source-snapshot/node_modules为junction，项目node_modules目标保留，不应递归清理链接目标。测试源码、基线、失败/通过证据、最终Setup和回滚Setup继续保留。
- 未覆盖与复测条件：公网模型、高级浏览器交付、真实卸载及未变化业务路径未纳入本次验收。辅助8/8、候选6/6、正式5/5范围重叠，不相加计数；只在相关实现、配置、依赖、环境、输入或验收条件变化时复测受影响范围。
- 文本与交接：17个本轮文本UTF-8无BOM/替换字符，语法和增量审查证据有效；两份交接及检查点写入后分别回读核对内容、链接、编码与格式。使用Skill：无；无子Agent。

<!-- desktop-stop-20261101:end -->

## 主/子模型协同正式验证（2026-11-01，1.3.28已交付）

- 实际对象：Scodex工作台1.3.28 Windows x64安装版；入口`E:/GDP/Scodex/App/Scodex工作台.exe`，FileVersion1.3.28／ProductVersion1.3.28.0；正式EXE SHA256 `ee178876e4e7516dc81b7816a2bd520795efd33811955b9637a9c197bd04fa1c`，ASAR SHA256 `1b57d0406d6bed8b3555b50e47b66144db5b72bf3a780cc9dd74547f015f743f`。Node v24.11.0、Electron45、Windows10.0.26300 x64。
- 环境与前置：源码和三个实际EXE轮次均使用独立临时项目／profile／home及本机OpenAI兼容主、子模型响应夹具；真实EXE、React设置、IPC、权限、Windows加密存储与文件写入链路运行。公开模型单项请求使用用户提供的对应凭据，但未写入项目文件；无真实用户profile写入。

| 验证范围 | 场景、操作与预期 | 实际结果／状态及证据 |
| --- | --- | --- |
| 定向代码与模型连接 | `node --test tests/model-connection.test.mjs tests/model-list.test.mjs tests/agent-tools.test.mjs tests/subagent-coordinator.test.mjs tests/agent-runtime.test.mjs tests/subagent-runtime.test.mjs`；核对独立密钥、工具通道、推理强度、路径锁、取消和回读 | 41/41通过；[增量审查](../release/subagent-release-20261101/incremental-review.json) |
| 语法、Vite与包身份 | 相关CJS及验收脚本`node --check`；`npm run build`；portable与NSIS构建；对比包内4个Electron文件、index.html及两项renderer资源；7z测试安装包并提取ASAR比哈希 | 全部通过；7/7文件一致，安装包ASAR与正式程序一致；[替换记录](../release/subagent-release-20261101/formal-replacement.json) |
| portable候选实际程序 | `node tests/subagent-ui.cjs`；配置独立主／子地址和随机密钥并回读加密磁盘；双子任务分配、并发改不同文件，拒绝主模型／重叠写入，等待回读；终态回收慢任务 | 4/4通过，隔离profile删除；[候选报告](../release/subagent-release-20261101/candidate-ui/subagent-ui-verification.json) |
| 安装候选解包入口 | 同脚本指定`release/win-unpacked/Scodex工作台.exe`及独立输出；确认安装器将使用的相同ASAR和执行入口 | 4/4通过，隔离profile删除；[解包报告](../release/subagent-release-20261101/unpacked-ui/subagent-ui-verification.json) |
| 正式入口复验 | 安装到`E:/GDP/Scodex/App`后同脚本从正式EXE执行；比对版本、哈希、注册表及快捷方式 | 4/4通过，隔离profile删除；[正式报告](../release/subagent-release-20261101/formal-ui/subagent-ui-verification.json)、[替换记录](../release/subagent-release-20261101/formal-replacement.json) |
| 用户选择的公开模型 | 对GPT `gpt-6.1-sol`、Claude Kiro `claude-sonnet-5`、聚合国模 `deepseek-v4.1-flash`各POST“您好测试” | 三项HTTP 200且有实际回复；[实测记录](../release/subagent-release-20261101/public-model-check.json) |
| 安装、回滚与清理 | 旧1.3.27 Setup和程序哈希先核对；1.3.28 Setup退出0后回读正式EXE／ASAR、注册表和快捷方式；清理本轮临时profile及中间目录 | 通过；旧1.3.27安装包保留。递归删除被自动审批拒绝，两个中间目录完整移至手动删除；原路径不存在，见[基线](../release/subagent-release-20261101/formal-baseline.json)与替换记录 |

- 排除项：Grok `grok-4.7`模型目录返回200，但普通／流式生成均返回426，上游要求升级Grok CLI；用户明确将其排除出本轮上线验收，不计入三模型通过结果，也不声称其可用。诊断见[实测记录](../release/subagent-release-20261101/public-model-check.json)。
- 失败恢复：初轮模型配置验收脚本通过IPC保存后未刷新React页面，页面仍显示旧状态；修正测试驱动并只复验该EXE范围后全部通过。初轮NSIS构建在重新下载Electron时GitHub连接超时；改用已通过portable验收的解包目录执行`--prepackaged`，退出0。ASAR资产比对脚本首次使用POSIX路径导致假缺失，改用Windows路径后7/7匹配；均未降低产品断言。
- 未覆盖与复测条件：真实卸载、公网Supabase和未变化的其他业务路径不在本轮验收。当前三模型HTTP200是单次观测，不保证后续可用率。只有源代码、配置、上游服务或验收标准变化影响对应结论时，才复测相关范围；不以本机夹具代替公网模型响应。无运行中的有限测试进程。

## 安装包与新图标验证（2026-11-01，1.3.27已交付）

- 当前状态与版本：安装包、新图标和桌面快捷方式已交付；1.3.26→1.3.27，本轮只递增一次。实际应用版本1.3.27、EXE FileVersion1.3.27／ProductVersion1.3.27.0，安装器显示1.3.27。安装版成为当前快捷启动入口，旧1.3.26便携程序保留回滚。
- 用户指定位置：[安装包](../../Scodex-Workbench-Setup-1.3.27-x64.exe)位于E:/GDP/Scodex；[安装程序入口](../../App/Scodex工作台.exe)位于E:/GDP/Scodex/App；[桌面快捷方式](C:/Users/Administrator/Desktop/Scodex工作台.lnk)已创建，根目录和开始菜单快捷方式也指向同一安装版及其内嵌图标。
- 图标与配置：蓝紫色六边形终端取代绿色显示器；build/create-icon.ps1生成512px PNG、SVG及16/20/24/32/40/48/64/128/256px ICO。安装器、应用及卸载器采用新图标；NSIS为当前用户的中文引导安装，可选择目录并创建快捷方式，deleteAppDataOnUninstall=false。新增dist:installer命令，无新依赖。
- 发布边界：固定已验收1.3.26 ASAR，只更新图标和打包／版本元数据；77项electron/dist逐字节一致，node/python/pip三个运行时包SHA一致。当前源码未发布的主子模型增量保持独立，不冒称已包含。真实用户profile、模型凭据和业务数据未修改。
- 产物身份：Setup SHA256 cf15ba903626b9693b165fdc1b20082bf8173ecfe21116f593111d7d324f7790，189905359字节；安装EXE SHA256 7a7fe24c89136e0490e0140bb549459a7d52c9010b727fd6da105d1497d8af5f；ASAR SHA256 120e7b0120633ffb313990aaed1fb79818f2549c02b38b196edd19af5e28cd0f。
- 验证：[构建与包一致性](../release/desktop-installer-20261101/build-verification.json)、[安装及快捷方式](../release/desktop-installer-20261101/installation-verification.json)、[实际安装版验收](../release/desktop-installer-20261101/installed-ui/cdp-ui-verification.json)、[增量审查](../release/desktop-installer-20261101/incremental-review.json)。应用版本、独立profile、设置保存和CDP真实操作均通过；现有CDP容量等未变化结果复用。
- 失败恢复及限制：首次静默安装的/D参数在JavaScript传输中丢失反斜杠，装到E:/GDPScodexApp；Setup已退出0但预期路径检查失败，原失败证据保留。卸载清理整条命令被自动审批拒绝（blocked by policy），未执行。随后完整移动到正确目录，修正仅本轮安装／卸载注册信息及快捷方式，并补齐预期卸载图标；原误装路径已不存在，实际安装版验收通过。没有将未执行的卸载行为记为通过，详见[失败与恢复](../release/desktop-installer-20261101/installation-path-failure.json)。
- 运行与回滚：桌面双击Scodex工作台即可启动。回退可正常关闭应用后，将快捷方式恢复至旧1.3.26便携入口；原根目录快捷方式备份位于release/desktop-installer-20261101/baseline/root-Scodex工作台.lnk。必要时从Windows已安装应用管理新安装版；实际卸载未验收，数据保留为已确认配置。
- 清理与检查点：实际验收临时profile已删除，所有本轮有限进程已结束。两份无运行依赖的构建暂存已移至[手动删除](../手动删除/desktop-installer-20261101)，原址不存在，待手动处理不影响使用；[清理记录](../release/desktop-installer-20261101/cleanup-verification.json)记录原／现路径。保留Setup、固定发布ASAR和配置、基线备份及必要证据。
- 洞悉评估：本轮图标、版本、NSIS配置及测试输出路径差异已完成定向审查，无需新增依赖或范围外重构；无达标下一步候选。使用Skill：无；无子Agent。

- 测试环境：Windows10.0.26300 x64、Electron45、Node24.11；实际入口E:/GDP/Scodex/App/Scodex工作台.exe。运行时使用独立UUID profile/project/home及loopback模型／网页；EXE、React、IPC、浏览器和磁盘链路真实，不涉及真实模型密钥。
- 构建命令：node node_modules/electron-builder/cli.js --projectDir release/desktop-installer-20261101/app-source --win nsis --x64，退出0；暂存已按清理记录移动。固定发布ASAR和published-package-config.json保留。
- 实际验收：SCODEX_CDP_EXE指向安装EXE、SCODEX_CDP_VERSION=1.3.27、SCODEX_CDP_SCOPE=formal-smoke、SCODEX_CDP_OUTPUT指向本轮installed-ui后运行node tests/browser-cdp-ui.cjs，退出0。

| 检查对象与场景 | 预期／实际 | 状态与证据 |
| --- | --- | --- |
| 新图标生成／嵌入 | 512px透明PNG、9档ICO尺寸与PNG目录完整；源图及EXE实际提取图均为新六边形 | 通过，snapshot.json及executable-icon.png |
| 构建及发布边界 | NSIS构建0；77项产品文件、3份运行时包一致；版本及图标为本轮变更 | 通过，build-verification.json |
| 安装、修正与注册信息 | 首轮路径失败保留；目录完整移动，安装和卸载路径、桌面／开始菜单／根目录链接及图标均回读正确；文件SHA与候选一致 | 修正后通过，installation-verification.json |
| 实际启动与设置保存 | 界面版本1.3.27、指定隔离目录、无历史错误；设置开关与磁盘一致 | 通过，installed-ui/cdp-ui-verification.json第1组 |
| 实际CDP核心路径 | 两次明确审批，browser_open及Runtime.evaluate 21*2成功，结果42到达模型并持久化最终回复 | 通过，同报告第2组 |
| 编码、差异和元数据 | 相关文本UTF-8无BOM；锁文件仅根版本变化；驱动只新增可选输出目录；node --check通过 | 通过，incremental-review.json |
| 最终交付与清理 | Setup最终位置及哈希、快捷方式和回滚入口正确；误装目录与测试profile原址不存在；两份构建暂存移入手动删除 | 通过，清理记录和document-verification.json |

- 未覆盖范围：公网模型和实际卸载未测试；不把配置审阅当作卸载功能通过。旧CDP容量／隔离结果因产品代码逐字节一致继续有效，未重复全量测试。仅在相关实现、打包资源、运行环境或验收条件改变时补验受影响范围。

## 主模型/子模型协同分派验证（2026-11-01，源码增量）

- 实际测试对象：Scodex Workbench 当前源码（package version 1.3.26）、Electron 模块、Node v24.11.0；使用临时 Windows 工作区和本地模型响应夹具。未使用真实用户密钥，未以正式 EXE 作为本轮测试对象。
- 测试入口与前置：在 `E:\GDP\Scodex\workbench` 执行 `node --test tests/model-connection.test.mjs tests/model-list.test.mjs tests/agent-tools.test.mjs tests/subagent-coordinator.test.mjs tests/agent-runtime.test.mjs tests/subagent-runtime.test.mjs`；另执行相关 CJS `node --check` 和 `npm run build`。测试前读取并核对本交接章节及项目交接章节。

| 测试范围与场景 | 预期／实际结果 | 状态与证据 |
| --- | --- | --- |
| 主/子模型连接、同地址跟随密钥、不同地址独立密钥、模型列表 | 22项全部通过；凭据未出现在公共状态或磁盘明文 | 通过；`tests/model-connection.test.mjs`、`tests/model-list.test.mjs` |
| 子模型路径隔离、工具白名单、文件哈希和并发锁 | 13项相关断言通过；非重叠路径允许并发，重叠路径拒绝，子模型无命令工具 | 通过；`tests/agent-tools.test.mjs`、`tests/subagent-coordinator.test.mjs` |
| 主模型分派→子模型编辑→等待→主模型回读整合 | 主请求4轮、子请求3轮；主/子地址、模型和Bearer密钥分别核对；授权文件从`before`变为`after`并由主模型读取验证 | 通过；`tests/subagent-runtime.test.mjs` |
| 模型运行时工具协议与取消边界 | 13项既有运行时测试通过，结果回传、失败停止、取消和工具协议保持有效 | 通过；`tests/agent-runtime.test.mjs` |
| 语法与前端构建 | 6个相关 CJS `node --check` 退出码0；Vite 1825 modules构建成功，仅有既有大 chunk警告 | 通过；命令退出码与构建输出 |

- 汇总：本轮定向测试37/37通过，无运行中的有限任务；测试临时目录由测试钩子清理。没有执行公网模型、真实密钥、实际 UI/正式 EXE 的端到端验收，因此这些范围标记为未覆盖。
- 失败恢复：首次运行连接测试22项中20项通过、2项失败，错误均为同地址子模型未识别本次新主密钥；修复后相关范围22/22通过，运行时夹具首轮仅因断言遗漏文件工具行号失败，改为核对真实返回`1: after`后通过。
- 构建限制：本轮仅运行源码 `npm run build`，没有递增版本、打包或替换正式 EXE；正式1.3.26入口不能作为包含本轮改动的验收对象。

## CDP权限与容量扩展验证（2026-11-01，1.3.26已交付）

- 当前目标与状态：当前对话 AI 页面 CDP 和容量扩展已交付，正式版本1.3.26；包含实际已发布1.3.25全部功能。正式文件名沿用1.3.20，应用版本及 FileVersion/ProductVersion 为1.3.26；现有快捷方式目标保留。
- 容量：每 AI 标签10,000条；全部 AI 标签合计64 MiB（序列化 UTF-8）；单事件8 MiB；分页最多1,000条；完整模型结果包络4 MiB。缓存淘汰、单事件截断、超额结果明确报告。
- 权限与约束：CDP默认关闭，只允许当前项目／对话 AI 标签及受管 flattened 子会话；保留审批、计划模式、网站规则、取消与撤权检查。拒绝手工标签、外部上下文、未知子会话和 Browser/SystemInfo/Tethering/Tracing 全局域。真实用户配置、凭据与业务数据未修改。
- 版本基线：1.3.25 →1.3.26，本轮只递增一次；正式SHA256 709ca2d9d9acc7754b0a20c098e4c67a83823e82e297d22f51f2a5bdc08dbace，178050353字节；回滚1.3.25 SHA256 155689a53cb088503d1c840aeff62938dd007e070ad179ff344b0189a74bd403。
- 构建与源码：沿用 electron-builder portable x64，以实际已发布1.3.25隔离运行时为基线合并已核验CDP模块；renderer保留正式版本。package/lock为1.3.26；不以暂存文件覆盖并发源码。保留 [构建核验](../release/browser-cdp-20261101/merged-build-verification.json)、[合并清单](../release/browser-cdp-20261101/merged-v126/merge-inputs.json)、[验收ASAR](../release/browser-cdp-20261101/merged-v126/validated-app.asar)。
- 主要变更：browser-cdp-cache.cjs按UTF-8字节限制缓存及分页；browser-tools.cjs限制完整模型包络并按需省略预览；browser-cdp-scope.cjs限制目标树/子会话和Cookie Network路由；panel-browser.cjs管理连接、事件及撤权；偏好、设置和主进程接入。README已同步。
- 证据：[分项验收](../release/browser-cdp-20261101/acceptance-verification.json)、[持久化分项快照](../release/browser-cdp-20261101/persisted-acceptance-evidence.json)、[正式入口验收](../release/browser-cdp-20261101/formal-smoke/cdp-ui-verification.json)、[替换与快捷方式](../release/browser-cdp-20261101/formal-replacement.json)、[增量审查](../release/browser-cdp-20261101/incremental-review.json)。
- 运行与回滚：[正式入口](../release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe)；若需回滚，先正常关闭应用，用[1.3.25备份](../release/browser-cdp-20261101/formal-previous-1.3.25.exe)恢复同一路径，不覆盖用户数据。测试进程与loopback服务均已结束，无本轮常驻服务。
- 限制：模型和网页服务为loopback夹具，公网模型未测；模型参数解析仍限160000字符，不承诺端到端4 MiB输入参数；浏览器全局与跨标签CDP不开放。
- 清理：自动审批拒绝递归删除，仅返回blocked by policy；未重复删除。13个归属明确目录已移入[手动删除](../手动删除/browser-cdp-20261101)，8个原址已不存在。原址／新址及处理方式见[清理清单](../release/browser-cdp-20261101/cleanup-verification.json)。必要证据、最终候选、ASAR及回滚程序保留；残留不影响使用。
- 失败恢复：旧Cookie接口不支持页面browserContextId，改为已验证的页面Network读写清理。旧HTTP逐Buffer解码破坏跨块汉字，改为Buffer.concat后一次UTF-8解码。审批循环读到旧DOM导致假超时，正式smoke改为两个不同命令的精确审批；仅修驱动，不重复大结果和边界操作。原失败报告保留，不改写成整体通过。
- 增量审查与洞悉：沿用原发布基线与本次明确差异，已复审Cookie路由及测试驱动新差异，无未解决的高置信度问题。直接影响范围无需新增依赖或追加重构，无达标下一步候选。使用Skill：test-driven-development、security-best-practices（复用已读取说明与评估）；无子Agent。

- 实际对象与环境：Scodex Workbench1.3.26 Windows x64 portable，Windows10.0.26300、Electron45、Node24.11；上述正式入口。独立UUID profile/project/home，替代范围仅loopback模型和网页；实际EXE、React、IPC、CDP、磁盘均真实。
- 操作命令：node --test tests/browser-tools.test.mjs tests/browser-cdp-cache.test.mjs tests/browser-cdp-scope.test.mjs；原生辅助 node node_modules/electron/cli.js tests/browser-cdp-native-scope.cjs；实际应用 node tests/browser-cdp-ui.cjs，以SCODEX_CDP_EXE／VERSION=1.3.26／SCOPE=restart-only或formal-smoke指定候选及正式入口。相关CJS与驱动node --check通过。

| 验证范围与场景 | 预期／实际结果 | 状态与证据 |
| --- | --- | --- |
| 缓存淘汰、UTF-8、分页、包络、权限作用域 | 26项辅助断言全部通过；不代替实际应用 | 通过，[日志](../release/browser-cdp-20261101/targeted-tests.log) |
| 原生Cookie读写清理 | 仅AI Cookie读写，清理保留手工Cookie；原生中文长度及SHA一致 | 通过，[原生记录](../release/browser-cdp-20261101/native-scope-verification.json) |
| 实际1.3.26目标、子会话与Cookie | 12操作：8成功，4预期拒绝；目标过滤、Worker42、仅AI Cookie。后续夹具失败不影响这些已断言结果 | 分项通过，[快照](../release/browser-cdp-20261101/persisted-acceptance-evidence.json)；boundary-network原整组仍failed |
| 实际1.3.26中文大结果到模型 | 1376170汉字／4128510内容字节；完整模型包络4128787字节；实际与预期SHA均fe230a907b9a9ad88d2d455e05ffdcd61be7dac8e2d92098028e9e31ec96137b；2工具成功及最终回复持久化 | 分项通过，同快照；delivery-utf8原整组仍failed，仅后续审批驱动超时 |
| 候选保存及重启恢复 | 开启设置落盘，完全退出后重启，UI与磁盘均true、版本及隔离目录正确，2/2通过 | 通过，[重启报告](../release/browser-cdp-20261101/restart-only/cdp-ui-verification.json) |
| 正式入口网页及CDP | 设置保存；browser_open和Runtime.evaluate 21*2逐次审批，2操作成功、模型断言42、最终回复持久化；2/2组通过 | 通过，[正式报告](../release/browser-cdp-20261101/formal-smoke/cdp-ui-verification.json) |
| 原已通过且未受影响范围 | 1.3.24 SHA cb79048d9894968965e5a0b43c54fa3a25ccb60cd500ab034c4cefcdaf79fae7的事件分页2/2/1、3 MiB结果、手工tab_id拒绝、审批撤权及关闭工具目录按原项复用 | 有效旧证据，见验收聚合reused；不声称原失败整组通过 |
| 视觉检查 | 已查看1464×901实际候选重启设置截图：当前设备、页面、视口和受控数据状态下无可见错误 | 限定范围通过，[最终设置截图](../release/browser-cdp-20261101/restart-only/cdp-settings.png) |
| 包身份、替换、增量审查、清理和文档 | 正式／候选SHA一致，旧版备份正确；精确驱动差异已复审；残留移动结果回读，UTF-8无BOM及新链接验证 | 通过，见替换／审查／清理记录；文档核验见document-verification.json |

- 未覆盖：公网模型、端到端4 MiB参数和浏览器全局CDP不在通过结论中。再次验证仅在相关实现、参数、运行环境或验收条件变化时进行；不重跑未变化的其他工作台功能。

## 工作台四项补齐（2026-11-01，最终验收）

- 实际对象：Scodex工作台1.3.25 / Electron45 / Windows 10.0.26300 / Node v24.11.0；最终正式入口[EXE](../release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe)。SHA256 155689a53cb088503d1c840aeff62938dd007e070ad179ff344b0189a74bd403。
- 环境与隔离：使用真实EXE/React/IPC/磁盘、独立UUID profile及受控项目。模型、图像和Supabase REST在大部分功能用例中由loopback夹具替代；真实模型单项使用用户选定服务及凭据，测试后加密profile已清理。
- 命令：node --test tests/supabase-sync.test.mjs tests/office-artifacts.test.mjs；实际入口为node tests/workbench-completion-ui.cjs，按SCODEX_COMPLETION_SCOPE=final、real、formal限定范围，并设置EXE和OUTPUT。真实凭据仅通过进程环境传入，不写日志。

| 范围/步骤与预期 | 实际结果 | 状态与证据 |
| --- | --- | --- |
| 初轮模型控件、503重试/用量、成品、目标、双设备同步和预览 | 11组通过，外部服务为loopback；未受最后修正影响的结果继续有效 | [有效原验收](../release/workbench-completion-20261101/ui/acceptance.json) |
| 最后同步accept与Office解析定向辅助复测 | 10/10通过；远端写入不提前标记本地合并已接受 | [测试日志](../release/workbench-completion-20261101/final-targeted-tests.log) |
| 最终实际Office/PDF/PNG文件生成回读，预览入口编辑保存 | 真实文件/界面操作通过；标题中文正确；过期hash拒绝覆盖，原并发内容保留 | [最终7组](../release/workbench-completion-20261101/final-ui/acceptance.json) |
| 最终A推送/B拉取/A重启同步，检查聊天数和密文 | 通过；三方合并结果真实落盘，云端夹具仅有密文 | 同上 |
| 真实模型列表、完整下拉、deepseek-v4-flash实际流式回复 | 返回5模型；回复SCODEX_REAL_MODEL_OK；HTTP200，72输入+9输出=81 tokens，首token1707ms，总1941ms（单次观测） | [真实模型3组](../release/workbench-completion-20261101/real-model/acceptance.json) |
| portable与替换后正式路径：选第二模型、保存、退出重启、预览IPC | 各3组通过；版本/profile身份匹配、磁盘选项恢复、Office正文可读 | [portable](../release/workbench-completion-20261101/portable-ui/acceptance.json)、[formal](../release/workbench-completion-20261101/formal-ui/acceptance.json) |
| 1064与1464宽视口、文档编辑对话框、中文截图 | 边界/横向溢出断言通过；最终1464×901截图已查看 | [截图](../release/workbench-completion-20261101/final-ui/document-preview.png) |
| 构建/包与必要依赖 | 固定快照无漂移，77项包内文件一致，3个运行时zip一致；FileVersion/ProductVersion1.3.25 | [构建](../release/workbench-completion-20261101/build-snapshot-verification.json)、[运行时资源](../release/workbench-completion-20261101/runtime-resource-verification.json) |
| 增量代码审查与文本 | 23个产品/配置文件及新测试分支定向审查；UTF8无BOM/替换字符检查通过 | [审查](../release/workbench-completion-20261101/incremental-review.json) |

- 视觉结论仅限：当前设备、页面、视口和数据状态下无可见错误。不代表所有Office版式或所有页面。
- 失败与范围：初始旧凭据/models为HTTP401；更换用户提供的凭据后200，旧失败不记为通过。一次candidate-final构建因并发sourceDrift失败，固定快照通过。测试驱动旧选择器失败已据实际UI修复，未降低产品断言。
- 未覆盖：公网Supabase、真实图像生成、Git/MCP公网集成、高级浏览器自动化、Office原生Word/PowerPoint版式及原生另存为弹窗；前两项缺配置，公网集成与高级浏览器按用户要求排除。
- 替换/回滚及清理见[正式记录](../release/workbench-completion-20261101/formal-replacement.json)和[清理清单](../release/workbench-completion-20261101/cleanup-verification.json)。所有5轮测试进程退出且fixture不存在。递归删除被自动审批拒绝，中间目录已移入手动删除；不影响通过结果。
- 复测条件：仅实现、配置、输入、依赖或环境变化使相应结果失效时重测；不因交接更新重复运行。最后一行并发模型列表归一化留在源码，未纳入本次快照或归入本轮审查结论。
<!-- workbench-completion-20261101:end -->

## 1.3.23 默认模型完整下拉选择（当前有效验收）

- 实际对象：Scodex工作台1.3.23、Electron45、Windows10.0.26300 x64、Node24.11.0。候选完整验收使用同次打包win-unpacked/Scodex工作台.exe，正式复验使用[原正式portable路径](../release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe)，最终SHA256 4f706e591b4da8196b95a8f29a7858252451a965f4aba13c51b46e546a2f2052；应用版本和FileVersion/ProductVersion均1.3.23。
- 环境与前置：独立UUID profile/project/home及空参考能力目录，关闭托盘常驻；HTTP /v1/models来自本机兼容夹具，使用无效外部凭据样例。实际程序、React、IPC、键盘、磁盘持久化和重启均真实；未修改真实配置或发送公网生成。

| 验证范围 | 场景、步骤和预期 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| 旧1.3.22 RED | 真实设置获取四模型后要求完整select选项 | 按预期失败INPUT≠SELECT，确认原控件原因；进程/夹具已回收 | [RED](../release/model-picker-20261101/red/model-picker-ui.json) |
| 配置与协调逻辑 | node --test tests/model-list.test.mjs tests/model-connection.test.mjs；列表替换、有效/失效选择、保存、凭据边界 | 通过8/8 | [辅助日志](../release/model-picker-20261101/targeted-tests.log) |
| 实际候选完整链路 | 点击获取四模型，核对两个完整select；原生ArrowDown切第二项、子代理选第四项；保存并回读config，正常退出再启动 | 通过；默认deepseek-v4.1-flash、子代理kimi-k3.1-pro，重启完整列表保留 | [候选7组](../release/model-picker-20261101/full/model-picker-ui.json) |
| 列表维护与异常 | 手动增删、子代理空值跟随；获取137项并选择末尾/中间；503不改列表或选择；1064×660无横向溢出 | 通过；候选7组中的后3组 | 同候选报告；错误画面为故意503场景，不标作干净截图 |
| 构建与版本 | Vite/Electron portable构建；sourceDrift与ASAR资源比对，manifest及EXE版本/哈希 | 通过；sourceDrift为空，69个包内资源一致 | [构建核验](../release/model-picker-20261101/build-verification.json) |
| 正式替换与复验 | 原子替换后从旧约定路径启动；版本/隔离身份、四模型完整列表、键盘选择、保存/磁盘、完整退出重启 | 通过4/4组；正式程序与候选同SHA，退出和夹具删除通过 | [正式4组](../release/model-picker-20261101/formal/model-picker-ui.json)、[替换](../release/model-picker-20261101/formal-replacement.json) |
| 最终界面与审查 | 查看正式程序1464×901截图；审查本次模型表单/CSS、两处版本和新测试及本轮支持脚本 | 当前设备、页面、视口和数据状态下无可见错误；增量差异未发现高置信度问题 | [最终截图](../release/model-picker-20261101/formal/model-picker.png)、[审查](../release/model-picker-20261101/incremental-review.json) |
| 清理与恢复能力 | 核对所有测试进程退出、三个UUID目录消失、暂存消费、旧正式回滚哈希 | 通过；解包目录删除被自动审批拒绝，已移入手动删除并记录，不影响程序 | [清理清单](../release/model-picker-20261101/cleanup-verification.json) |

- 命令：SCODEX_MODEL_PICKER_VERSION=1.3.23、SCODEX_MODEL_PICKER_SCOPE=full、SCODEX_MODEL_PICKER_EXE=候选实际EXE运行node tests/model-picker-ui.cjs；正式路径复验使用SCOPE=formal。测试前均读取本交接对应章节，只验证当前改动及替换路径影响。
- 失败恢复：正式替换首次因空备份路径抛错，旧正式哈希未变；改显式回滚路径后核对新旧哈希，再取得正式4组，不重建或重跑候选完整功能。8项辅助、7组候选继续有效；只在相关源码/配置/输入/环境/验收发生变化时复测。
- 未覆盖：公网服务、所有模型生成能力及未变化的其他业务；不以本机模型列表响应替代它们。候选解包入口现移至手动删除目录，完整portable候选及正式程序保留，可用于后续复测。
- 运行/回滚：用户从原快捷方式启动；需恢复时关闭应用，以已保留1.3.22回滚文件恢复正式路径，不覆盖数据目录。

<!-- model-picker-20261101:end -->

## 1.3.22 最高权限与模型列表修复（当前验证范围）

- 对象：最新统一portable候选与正式程序均1.3.22，SHA256 7cead37da042916ac7cdbaa83eeb4c10fe2dde20886c30f6a2b80cdfebbacf6c；实际正式入口 release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe。前一正式版1.3.21已覆盖，无旧备份。
- 环境与隔离：Windows、Node24、Electron45；独立profile、项目、fake home与loopback模型。EXE/React/IPC/文件/命令/Windows桌面均真实，不读取真实凭据或业务数据，不证明公网服务。
- 运行与前置：设置→配置→启用完整访问，保存danger-full-access/never、全部网络及电脑操控；受限/规划测试按场景切换。完整访问以当前Windows账号权限为限。
- 通过与复用：共11项去重范围通过；模型用同SHA最终候选，权限/桌面主体用同SHA候选，正式入口复核和取消用最终路径。先前38项辅助作为既有证据保留，不重复无关测试。

| 验证范围 | 实际操作与预期 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| 模型列表 | 获取137项及重复项；替换3个旧项；失效选择回退，有效42/93保留；503不损坏；保存、主聊天与重启一致 | 通过，137项完整区域内滚动，无可见溢出 | final-candidate-ui/ui-verification-all.json的前4项 |
| 最高权限 | 点击快捷设置、重载与落盘回读；对项目外文本write/read核对hash，运行真实PowerShell命令；切workspace-write验证越界拒绝 | 通过，零审批，命令及文件实际结果一致，拒绝未生成文件 | final-candidate-ui/ui-verification-permissions.json |
| 原生桌面 | screenshot→click→中文type→CTRL+A→替换type→点击记录→点击列表→scroll；模型收到真实JPEG | 通过，8步成功，记录中文替换、点击1次、TopIndex15 | final-candidate-ui/ui-verification-desktop-native-boundaries.json的前5项及requests |
| 禁用与规划 | 禁用时截图拒绝；规划不提供desktop_click且伪造调用拒绝 | 通过 | 同上 |
| 停止 | 截图返回后点击停止，随后待返回的desktop_type不执行；控件文字不变，持久化无后续输入操作 | 通过 | formal-entry-ui/ui-verification-desktop-stop.json |
| 正式入口 | 原约定路径启动，核对1.3.22/隔离目录并执行权限/项目外写读/命令/受限拒绝 | 通过4项，进程退出且fixture清理 | formal-entry-ui/ui-verification-formal.json |

- 报告边界：模型报告整体失败因后续旧read_file断言，模型前4项仍有效；桌面主体报告整体失败因后续菜单定位，前5项及8步原生结果有效。驱动已修正，两处后续范围分别取得独立通过报告；聚合报告逐项引用，不把原失败整体改为成功。
- 清理：所有本轮UUID fixture原路径不存在，退出与清理记录可追溯；无本轮残留用户进程。必要源码基线、诊断和candidate-rebuilt构建基座保留。
- 未覆盖：真实公网模型与不同Windows账号/UAC桌面。功能复测仅在相关实现、配置、依赖或验收条件变化后进行。
- 交付：正式文件与候选相同SHA；快捷方式目标参数保持、版本描述1.3.22；无旧备份，不修改数据配置。构建沿用npm run build与electron-builder portable，最终统一候选复用既有runtime并逐项核对源码。
- 证据：[聚合验收](../release/permission-models-20261031/acceptance-verification.json)、[正式文件](../release/permission-models-20261031/formal-verification.json)、[审查](../release/permission-models-20261031/incremental-review.json)、[清理](../release/permission-models-20261031/cleanup-verification.json)、[构建](../release/auto-interaction-20261031/build-verification.json)。

## 1.3.22 对话与任务自动衔接

- 当前状态：本轮实现、实际候选验收、正式替换及正式入口复核已完成；本轮无阻塞。版本从正式1.3.21递增一次至1.3.22，失败重建及复测未再次递增。
- 当前目标：普通聊天自动衔接问答、编程、文件、图片和表格；两窗口不再需要执行开关；完整访问+never按设置执行真实工具和项目外文件；目标入口支持保存、编辑、清除、连续请求和重启恢复。
- 约束：保留用户数据、配置和已有修改；用户要求不备份旧EXE、不结束用户进程。规划只读、仅对话无本机工具；revision/collaboration只采用本次明确授权，scheduled/subagent不开本机工具；网络、凭据、哈希冲突、未保存编辑和Windows/UAC保护保留。
- 实际范围：EXE、React、IPC、磁盘文件、命令、Chromium图片处理和ExcelJS工作簿真实；仅模型由loopback替代。公网中转模型兼容性未纳入本轮验收，生成式图片重绘和无人值守后台目标循环未实现。目标随聊天保存并用于后续用户发起的请求。
- 使用 Skill：test-driven-development（既有94分评估及说明继续有效）；主Agent实施，无子Agent。
- 审查基线：[implementation-baseline.json](../release/auto-interaction-20261031/implementation-baseline.json)，39文件快照；无Git元数据。原有Supabase等无关修改保留。实际本轮30个代码/测试文件（19个产品文件）；新增策略测试纳入审查，最新驱动完成条件变更单独复审。
- 最终正式入口：E:/GDP/Scodex/workbench/release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe。文件名沿用旧路径，FileVersion/ProductVersion及应用实际版本均为1.3.22。快捷方式E:/GDP/Scodex/Scodex工作台.lnk仍指向该入口；下次由快捷方式启动即可使用新版。
- 候选：E:/GDP/Scodex/workbench/release/auto-interaction-20261031/candidate/Scodex-Workbench-1.3.22-x64.exe。候选与正式文件SHA256均为7cead37da042916ac7cdbaa83eeb4c10fe2dde20886c30f6a2b80cdfebbacf6c，176386657字节；包内69个electron/dist源码资源SHA与当前文件一致，package运行字段及依赖一致。
- 构建：npm run build成功（Vite1823模块）；沿用既有electron-builder prepackaged portable x64路线。[构建报告](../release/auto-interaction-20261031/build-verification.json)、[正式替换与复核](../release/auto-interaction-20261031/formal-replacement.json)。未保留旧EXE，不能提供旧二进制回滚；当前候选可用于恢复本轮同版本入口，配置及数据未触碰。

- 测试对象与环境：Scodex Workbench1.3.22 Windows x64 portable，Electron45、Node24.11.0；入口为上述正式路径。独立profile、C:/Windows/Temp项目、fake home、空技能目录和loopback模型，不读取或写入真实凭据和业务数据。
- 定向测试命令：node --test tests/chat-policy.test.mjs tests/permission-policy.test.mjs tests/image-tools.test.mjs tests/spreadsheet-tools.test.mjs tests/agent-tools.test.mjs tests/browser-tools.test.mjs tests/dev-services.test.mjs tests/mcp-runtime.test.mjs tests/mcp-context.test.mjs tests/task-collaboration.test.mjs；受影响复测为image/spreadsheet两个文件。
- 实际UI驱动：tests/auto-interaction-ui.cjs。正式复核设置SCODEX_AUTO_EXE为正式入口、SCODEX_AUTO_VERSION=1.3.22、SCODEX_AUTO_PHASE=green、SCODEX_AUTO_SCOPE=collaboration、SCODEX_AUTO_OUTPUT=release/auto-interaction-20261031/formal-entry-recheck，再运行node tests/auto-interaction-ui.cjs。

| 验证范围/操作 | 预期与实际 | 状态与证据 |
| --- | --- | --- |
| 正式1.3.21 RED | 普通发送应创建文件，实际无write_file且未生成calculator.cjs，正确暴露旧缺项；不重跑。 | 有效RED，[原始RED](../release/auto-interaction-20261031/red-corrected/auto-interaction-ui-verification.json) |
| 策略/权限/文件/图片/表格/浏览器/服务/MCP/协作辅助 | 首轮89/92通过；3处旧文案断言修正后受影响15/15通过，未受影响77项复用，合计92项覆盖通过。图片辅助processor为替代处理器；真实图片另由EXE验证。 | 通过，[首轮日志](../release/auto-interaction-20261031/targeted-green.log)、[定向复测](../release/auto-interaction-20261031/targeted-recheck.log) |
| 同聊天解释→编程→解释 | 真正创建calculator.cjs、读取并运行node，退出0、输出5；回到解释不修改文件，无执行开关。 | 通过，[unpacked16项](../release/auto-interaction-20261031/green-unpacked/auto-interaction-ui-verification.json) |
| 项目外、图片和表格 | 项目外文件读改读；24×16图片真实缩放至12×8并改像素，独立解码；真实XLSX的A1与B2保存后由独立ExcelJS回读。 | 通过，同上；portable同候选15项有效记录见[portable前15项](../release/auto-interaction-20261031/green-portable/auto-interaction-ui-verification.json)（该报告整体因后续协作前置条件失败，不能记整体通过） |
| 规划/仅对话/revision/独立窗口 | 规划工具目录只读；仅对话无本机工具；重新生成默认无工具，勾选才有；独立窗口直接调用并同步。 | 通过，unpacked及portable上述有效记录 |
| 目标完整生命周期 | UI保存与编辑，连续两次请求带目标；EXE重启恢复同聊天目标；清除后后续请求不再注入。 | 通过，unpacked及portable上述有效记录 |
| 协作本次授权 | 真实UI建立绑定目标与来源；false无本机工具/无操作，true提供工具且真实read_file成功；来源聊天不被切换。 | 通过，[正式入口增强断言6/6](../release/auto-interaction-20261031/formal-entry-recheck/auto-interaction-ui-verification.json)；先前[协作候选6项](../release/auto-interaction-20261031/collaboration-portable/auto-interaction-ui-verification.json)只检查目录与请求，最终以正式增强断言为准 |
| 正式替换与零审批 | 正式文件、候选及启动的EXE SHA一致；实际版本1.3.22；真实创建/运行及协作读取保存成功；full+never审批数量0。 | 通过，正式入口报告、[替换记录](../release/auto-interaction-20261031/formal-replacement.json) |
| 视觉/字体 | 正式1464×901截图已查看，当前页面和数据状态下无可见遮挡/溢出；输入框微软雅黑≥16px的运行时断言通过。不以截图代替功能验收，不称目标菜单像素完全一致。 | 通过限定范围，[正式截图](../release/auto-interaction-20261031/formal-entry-recheck/actual-workbench.png) |
| 代码与打包 | 本轮30文件增量审查，无高置信度问题；驱动新完成条件已复审，node --check通过；69项包内文件与当前源码资源一致。 | 通过，[增量审查](../release/auto-interaction-20261031/incremental-review.json)、[构建核验](../release/auto-interaction-20261031/build-verification.json) |

- 先前正式复核失败留证：[完成判据失败](../release/auto-interaction-20261031/formal-entry/auto-interaction-ui-verification.json)。当时读取工具请求step1已ok=true，但磁盘仍是pending归一化后的cancelled占位；已修等待并在formal-entry-recheck通过。失败不覆盖最终通过，也不被冒称通过。
- 有限任务状态：必要构建、辅助测试及实际EXE验收均已结束；最终processExited=true、fixtureRemoved=true，无本轮常驻服务。未覆盖公网模型/公网MCP、生成式图片重绘、无人值守目标后台循环；不将loopback作为上述真实链路证据。

- 失败恢复：ASAR校验的Windows路径已改path.normalize并通过；协作初次目标未绑定项目，改为真实UI创建绑定目标；增强操作断言后发现磁盘pending归一化的中间态误判，完成判据改为非cancelled、非error且有最终持久化回复后再核对操作。只改驱动，不降低断言、不改产品，不重复构建。
- 清理：所有本轮UI fixture已退出并清理；自动审批拒绝递归删除构建目录（blocked by policy），两个归属明确的中间目录已移至E:/GDP/Scodex/workbench/手动删除/auto-interaction-20261031/package-staging和candidate-unpacked，原路径不存在，待用户手动删除，不影响正式程序。[清理清单](../release/auto-interaction-20261031/cleanup-verification.json)。保留候选、基线、测试源码及必要证据。
- 轻量重构评估：共享toolPolicyAllowed已消除本轮工具权限门槛重复；现有证据未发现需追加重构的高置信度问题，不扩大范围。其他权限/模型列表、Supabase及公网独立待办仍依其原章节记录，不因本轮交付自动记为通过。


## 新仓库 smoke CDP 超时阶段诊断（2026-10-31）

- 第九轮实际 smoke 在项目入口改造后发生 `Runtime.evaluate` 超时，失败时没有任务档案，页面只保留初始导航状态，尚不能判断是 Dashboard 视口、定时任务入口还是项目切换操作导致。
- 方案更新：候选 smoke 增加阶段字段到失败报告，重复一次同一隔离运行以取得定位证据；不修改产品源码或放宽验收。
## 新仓库 smoke 项目切换入口校准（2026-10-31）

- 第八轮实际烟测已通过定时任务失败持久化、插件空态、公开目录空态和隔离技能启停；项目切换步骤仍使用不存在的 `.workspace-switch` 与 `.project-menu`，导致空引用。
- 方案更新：使用当前 `.project-section-heading` 的“创建项目”按钮和 `.project-item[title=路径]` 直接切换；保留项目注册、往返切换、重启持久化验收，不改产品代码。
## 新仓库 smoke 公开目录空态断言校准（2026-10-31）

- 第七轮实际烟测已通过工作区祖先隔离并显示本机插件为空；公开目录页面未出现旧 `.extension-public-empty`，实际空态为“读取公开目录”，因为没有配置来源且页面不会自动联网。
- 方案更新：只将 smoke 断言改为当前 `.marketplace-panel .extension-empty strong` 与“读取公开目录”，保持无公网请求和产品行为不变。
## 新仓库 smoke 用户目录祖先进一步隔离（2026-10-31）

- 第六轮实际快照显示临时工作区仍加载12个插件，来源为“项目 .codex”；Windows `os.tmpdir()` 位于当前用户目录下，祖先扫描仍能命中用户 `.codex`。之前的空参考目录环境变量不影响项目祖先发现。
- 方案更新：只把 workbench-changes 的 fixture 工作区移至 `C:/Windows/Temp` 唯一目录，继续保留独立 profile、空参考目录、任务／技能／项目重启断言；不读写用户 `.codex`，不改产品代码。
## 新仓库 smoke 工作区祖先配置隔离（2026-10-31）

- 第五轮实际快照显示插件页加载完成但发现12个包，来源为“项目 .codex”；本机 `E:/GDP/.codex/plugins/cache` 存在两项。由于 smoke fixture 位于仓库 `workspace` 下，程序会按祖先规则发现该配置，这不是产品故障。
- 方案更新：只让 `workbench-changes` 使用系统临时目录下的 fixture 工作区，避开 `E:/GDP/.codex`；保留空插件、独立技能、任务持久化、项目切换和重启验收。候选其他范围、产品源码和用户目录不变。
## 新仓库定时任务暂停按钮诊断（2026-10-31）

- 第四轮实际烟测在“暂停”步骤超时，隔离 `scheduled-tasks.json` 仍为 enabled=true；按钮在页面存在且未禁用。当前证据不足以判断是 DOM 点击未命中、React 状态未更新或 IPC 写入失败。
- 方案更新：只记录暂停按钮属性、点击目标和任务 JSON，继续执行一次真实候选 smoke；不改产品逻辑或断言。
## 新仓库插件页加载诊断（2026-10-31）

- 第三轮实际 smoke 已通过任务失败记录和两处主导航入口；插件页仍未在 20 秒内出现“当前没有已发现的插件包”。临时参考目录变量已配置，现有失败报告没有插件列表／加载状态，不能判断是测试环境污染还是异步 IPC 未完成。
- 方案更新：只扩展 smoke 失败报告的插件页文本、插件行和空状态字段，不改变产品或通过断言；收集一次真实候选证据后再决定修复方向。
## 新仓库 smoke 重启入口诊断（2026-10-31）

- 第二轮实际烟测已通过任务失败持久化和插件页空目录环境隔离；失败点为重启后进入技能页仍调用已移除的 `.activity-more` 菜单。产品当前导航提供工作台主导航“技能”按钮。
- 方案更新：只将重启后的技能入口改为 `.workbench-primary-nav` 按钮，保留技能开关、项目重启和欢迎页断言；语法检查后复测同一候选 EXE。
## 新仓库隔离烟测个人能力目录（2026-10-31）

- 插件页通过导航且标题正确；空插件断言失败。定向源码显示本机能力扫描默认读取当前用户 `.codex/plugins/cache` 与 `.agents/skills`，且本机两处存在目录项。`SCODEX_HOME` 只隔离 Scodex 项目配置，并不覆盖个人参考目录；因此测试预期受用户环境污染。
- 方案更新：只在候选 smoke 的 workbench-changes 环境把 `SCODEX_REFERENCE_HOME`、`SCODEX_REFERENCE_AGENTS_HOME` 指向 `tempRoot` 下创建的空目录。保留产品代码和既有“无插件包”验收，不访问或更改用户能力目录；语法／差异检查通过后复测真实隔离 EXE。
## 新仓库烟测诊断结果与方案切换（2026-10-31）

- 失败快照 `repo-0-staging/release/smoke-failure-scodex-smoke-75015a55-5c39-4134-ae93-6a5543990be7.json` 显示：无隔离 API Key 时，任务运行实际返回缺少凭据错误并写入 `failed`、`completedAt` 和 `output`；UI 也显示执行失败。定时任务实际链路通过，之前超时只是烟测在后续入口使用了不存在的 `.activity-more` 选择器。
- 方案切换：只改候选 `tests/smoke.cjs`，通过当前 `.workbench-primary-nav` 的“插件”按钮进入插件中心；不改产品代码、模型配置或验收断言。先做差异与语法检查，再重跑同一真实隔离 EXE smoke。
## 新仓库定时任务烟测诊断（2026-10-31）

- 真实候选前置：repo-0-staging/release/Scodex-Workbench-1.3.21-x64.exe，portable x64，既有 SHA 见项目交接；工作区 SCODEX_SMOKE_SCOPE=workbench-changes 配独立 profile 与空 SCODEX_HOME，不访问真实凭据。
- 定向源码显示按钮处理等待 run IPC；调度服务先持久化 running，模型请求结束后落最终结果；无隔离凭据预期立即返回缺少 API Key 错误。此前测试只等 failed 且 output，超时后 fixture 已删除，状态未知。
- 新方案：候选 smoke 失败时仅保存隔离任务 JSON 与页面诊断快照，然后继续清理 profile；先核对脚本差异与语法，再真实执行单轮 smoke。记录实际烟测退出码、快照内任务状态和未覆盖链路。
- 不改产品、模型服务、成功断言或定时任务行为；不读写真实密钥，不推送。
## 新仓库候选烟测失败恢复记录（2026-10-31）

- 构建前置已通过：315/315 Node测试、294组件许可证生成、Vite 1822模块及portable x64构建均成功。实际隔离烟测在加载迁移历史后失败于`.new-task-button`选择器超时。
- 当前UI源码提供`.recent-section-heading button[aria-label="新建对话"]`；失败属于测试驱动旧选择器，不改变产品行为。按方案只修改候选`tests/smoke.cjs`定位辅助函数，随后复测烟测；不重复全量测试、不使用真实凭据、不推送。

## 新仓库候选失败恢复记录（2026-10-31）

- 首轮对象：`E:/GDP/Scodex/repo-0-staging`，`npm ci --no-audit --no-fund`退出0；`npm run dist`的Node测试阶段305/307通过，2项失败，未进入构建和烟测。
- `storage.test.mjs`单独复现：`normalizeLibrary(JSON.stringify(library))`对新建活动会话多出`unreadResult:false`。`settings.test.mjs`单独9/9通过；并发轮报Electron安装器尝试重建`node_modules/electron/dist`并在Windows文件竞争时找不到`locales/hu.pak`，不能归因于设置逻辑。
- 修复方案：只在`electron/conversations.cjs`的`createConversation()`补齐`unreadResult:false`，再定向复测storage/settings；不修改断言、不使用真实凭据、不推送。复测通过后才进入构建/烟测；并发运行时竞争若再次出现，按环境阻塞记录，不重复无变化的全量轮。

# 测试交接

## 新仓库 -0 导入准备（本地候选待验证）

- 目标：`https://github.com/song123-jian/-0.git`。只读GitHub元数据确认仓库公开、默认分支`main`、大小0且无refs；本地暂存克隆位于`E:/GDP/Scodex/repo-0-staging`，尚未提交或推送。
- 源与复制：`E:/GDP/Scodex/workbench`无Git元数据。已选择复制`src/`、`electron/`（排除生成的`third-party-licenses.json`）、`scripts/`、`tests/`、`build/`、`resources/workspace-tools-bundle/`及`index.html`、`package.json`、`package-lock.json`、`vite.config.js`；共218个文件、52,181,467字节。复制时源/目标逐文件SHA-256一致。
- 排除：父目录私有运行数据、`workspace/`、`手动删除/`、`release/`、`docs/`、`node_modules/`、`dist/`、`resources/workspace-tools/`、旧README及本机生成许可证清单。候选加入了面向开发者的README和保守`.gitignore`；未选择或添加项目许可证。
- 安全与许可：选中源码/脚本/测试中无边界匹配的静态凭据格式或明显开发者个人路径；受控Bearer样式值只出现在测试夹具。`workspace-tools-bundle`约49MB，Node、Python与pip归档内可找到上游license/notice；需在构建前再核验包清单并生成机器相关的第三方许可证清单。尚未运行代码测试或构建。
- 状态：已克隆公开空仓库，远端无写入。候选后续需安装锁定依赖、执行定向测试与Windows构建/烟测、审查导入差异并更新交接。公开Push/PR未获授权。
- M10：用户给定`https://catbee.online`。匿名只读首页返回HTTP 200，标题为“Cat Bee - AI API Gateway”，公开页面未提及MCP；没有MCP端点/安全配置，因此未发送协议请求，真实公网MCP往返尚未完成。聊天中出现过的密钥未使用，建议撤销/轮换。


## 1.3.21 登录期间后台助手（候选与正式入口已替换）

- 对象：portable x64 候选 [Scodex-Workbench-1.3.21-x64.exe](../release/session-scheduler-20261031/candidate-wmi-rebuilt-2/Scodex-Workbench-1.3.21-x64.exe)，版本 1.3.21，SHA256 `1B38F22036B0D62F673DB414188A8B283E123F6126BDD3EB2B70ACEBA1B0334D`；Windows 10.0.26300、Node v24.11.0、Electron45; formal entry target now contains the same SHA and File/ProductVersion 1.3.21.
- 入口与前置：实际候选由 `node tests/scheduled-background-ui.cjs` 驱动，`SCODEX_BACKGROUND_SCOPE=session`，隔离 profile／项目／Scodex home，loopback 模型端点；不读取真实凭据或业务数据。
- 实际结果：报告 [scheduled-background-ui-verification.json](../release/session-scheduler-20261031/candidate-wmi-ui-4/scheduled-background-ui-verification.json) 状态 `passed`，7/7 检查通过。确认打包程序在原生登记被拒时选择 `backend=session`；WMI 创建的隐藏 helper 在主程序退出后仍存活且 `inAnyJob=false`，到期启动同一候选一次，`launchCount=1`、loopback 请求 1 次、运行记录 `succeeded`、无可见窗口；已有实例转交保持同一 browser PID 且请求 1 次；权限拒绝可见并无模型请求；暂停、停用、删除、重启与 1064×660／1440×900 均通过。
- 辅助与审查：`node --check electron/main.cjs`、`node --check tests/scheduled-background-ui.cjs` 通过；`node --test tests/scheduled-background.test.mjs tests/session-background.test.mjs` 为 18/18；包内 `main.cjs`、`session-background.cjs` 与源逐字节一致，见 [wmi-candidate-package-verification-2.json](../release/session-scheduler-20261031/wmi-candidate-package-verification-2.json)；增量审查见 [incremental-review-wmi-session.json](../release/session-scheduler-20261031/incremental-review-wmi-session.json)。
- 限制：当前用户 Windows 原生计划任务登记仍因 `0x80070005` 权限不足不可用；本轮通过的是当前登录期间 WMI 会话助手，不代表重启后自动恢复或公网模型／Git／MCP 集成。
- 正式替换：已覆盖 `E:/GDP/Scodex/workbench/release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe`，覆盖后 SHA256 为 `1B38F22036B0D62F673DB414188A8B283E123F6126BDD3EB2B70ACEBA1B0334D`，FileVersion/ProductVersion 均为 `1.3.21`；旧 1.3.20 未创建备份。快捷方式 `E:/GDP/Scodex/Scodex工作台.lnk` 目标路径、工作目录、空参数和图标保持，描述更新为 `Scodex 工作台 1.3.21`，记录见 [formal-replacement.json](../release/session-scheduler-20261031/formal-replacement.json)。
- Formal entry recheck: six session checks passed (enable, execute after exit, restart persistence, existing-instance handoff, visible permission failure, pause/disable/delete). Independent 1064x660 and 1440x900 layout checks also passed; evidence: `release/session-scheduler-20261031/formal-entry-session/layout-only/formal-layout-verification.json`; combined coverage is 7 checks.
- 清理：本轮 6 份后台候选 fixture 与 2 份正式入口诊断 fixture 均已核对无产品进程，并从 Temp 原路径移动到 `C:/Users/Administrator/AppData/Local/Temp/手动删除/session-scheduler-20261031/`；原路径不存在，未物理删除。映射见 [runtime-cleanup-final.json](../release/session-scheduler-20261031/runtime-cleanup-final.json)。 Formal layout recheck fixture was removed.

## 当前验收检查点：1.3.21 五类工作流

- 对象：实际portable候选 [Scodex-Workbench-1.3.21-x64.exe](../release/workflow-completion-20261031/candidate-final/Scodex-Workbench-1.3.21-x64.exe)，SHA256 `fe29cf99ab7719e12deb1667cc1749e55b6b46f7546f9da25057a5eb1b2368a4`，167305765字节；Electron45、Windows 10.0.26300，版本1.3.21，正式1.3.20保持。独立SHA与prepackaged-build-verification.json一致; formal entry is covered by 1.3.21.
- 范围：固定[50项验收清单](WORKFLOW_ACCEPTANCE.md)。优先复用可核验且未受影响的旧实际EXE结果，仅新增技能选择核验、随包资料与共享执行接入的定向验收。
- 环境：Windows、Node v24.11.0、Electron45；实际portable使用独立profile、项目和Scodex home，不读取真实凭据。模型由确定性loopback端点替代，文件/命令/EXE真实；本机Git/API/OAuth不冒充公网。
- 场景与预期：选中个人/项目/自定义/托管技能后按主进程当前正文执行；读取包内相对文件且哈希可回读；失效选择、越界、链接、敏感/非UTF8/超量、取消/状态变化拒绝；规划受file-read权限、对话不提供执行工具。新增用例及命令在实际执行后记录。
- 有效辅助结果：`node --test tests/agent-tools.test.mjs tests/skill-context.test.mjs` 19项通过、0失败，[targeted-tests.log](../release/workflow-completion-20261031/targeted-tests.log)。新增普通文本工具二进制／超量读写边界用例；仅覆盖文件工具及技能资料模块，不代替实际EXE功能验收；未变化的通过结果继续复用。
- 构建状态：最初electron-builder复制node.zip遇到EBUSY；快照资源三项SHA与ZIP逐项CRC/长度通过。恢复复制路径遇到目标已存在，随后核验win-unpacked包内源码/manifest/资源SHA并使用prepackaged成功产出portable。最终候选身份见本节对象和[prepackaged构建报告](../release/workflow-completion-20261031/prepackaged-build-verification.json)；中间失败均保留，不代表功能通过。
- 实际候选验收：[报告](../release/workflow-completion-20261031/skill-context-ui-verification.json)为`passed`，四项检查全部通过，候选SHA与本节对象一致。报告含F10二进制／超量文件拒绝及持久化记录；已有技能上下文、`skill_read`、项目读改读和命令退出码1/0继续有效；驱动已按会话ID与唯一F10提示词双重匹配并退出0，loopback范围仍不代表公网模型。
- F10恢复记录：首次驱动因新对话未重新开启执行任务而退出1；第二次真实收到两条精确拒绝，但持久化查询误取上一对话成功读取。两份失败诊断分别见[首次失败](../release/workflow-completion-20261031/skill-context-ui-f10-initial-failure.json)和[记录查询失败](../release/workflow-completion-20261031/skill-context-ui-f10-persistence-failure.json)。最终驱动按新对话与提示词定位操作后退出0。
- 固定清单48/50（96%）已有候选证据；F10双重匹配复测已完成。G10公网仓库认证/Push/PR及M10指定公网MCP往返仍阻塞。loopback不替代公网结果；UI对标和后台助手既有阻塞仍保留。
- 文档验收：[document-verification.json](../release/workflow-completion-20261031/document-verification.json)记录本轮交接、清单、报告和检查点的落盘回读、关键字段、链接、严格UTF8无BOM检查；候选及辅助测试记录见[清单](../release/workflow-completion-20261031/workflow-acceptance.json)和[定向日志](../release/workflow-completion-20261031/targeted-tests.log)。
- 恢复文档验收：[recovery-document-verification.json](../release/workflow-completion-20261031/recovery-document-verification.json)记录双交接及检查点的回读、编码和链接结果；之后每轮测试前仍须重读本节。原生键盘偏航遗留隔离目录`release/native-input-20261031`，仅启动旧候选、未做功能测试，待清理。
- 校验前置失败：portable-recovery-build.log记录缺少7zip-bin，尚未进入electron-builder；快照node.zip已成功读取并写入。恢复校验改用既有yauzl与Node原生CRC32，检查三个ZIP所有条目的CRC和长度后，才进入新目录打包；不重跑已通过的19项辅助或前端构建。
- 第1条恢复结果：node.zip 2183、python.zip 34、pip.zip 469个文件条目CRC32/长度全部通过，源与快照SHA一致；copyfile仍EBUSY，portable尚无产物，build-recovery-verification.json保持failed。第2条方案改afterPack字节读写并逐项SHA验证，使用candidate-streamed；原通过的ZIP及19项辅助结果复用，不将打包尝试计为功能通过。

- 打包恢复第2路径结果：stream-build-verification.json为failed，afterPack以wx写入已存在node.zip时报EEXIST；工具包装退出0不代表构建通过。只读核对发现electron-builder仍合并复制extraResources，三个运行包SHA与已验证快照一致，main、新skill-context及前端入口与当前源码一致。停止重跑复制方案，改为先完整核对electron/dist和manifest，再以现有candidate-streamed/win-unpacked作prepackaged生成portable，不修改产品源码或重新复制运行包。原失败证据保留。

- prepackaged首次核验在打包前停止：Windows ASAR嵌套文件路径使用POSIX分隔符，导致CSS提取误报不存在；同一文件用本机分隔符可读。仅将核验脚本改path.normalize，产品及打包路线不变。失败报告保留prepackaged-sourcecheck-failure.json，未运行实际程序测试。

- 实际功能测试状态：portable候选四项真实流程检查已验收通过；命令 `node tests/skill-context-ui.cjs` 退出0。19项辅助测试和前端构建仍只作辅助证据，不替代公网能力验收。
- 最终真实复测：报告 [skill-context-ui-verification.json](../release/workflow-completion-20261031/skill-context-ui-verification.json) 为`passed`，四项检查全部通过；主流程证据为8项技能上下文持久化操作、2项F10拒绝操作、`skill_read`成功、`run_command`退出码`1,0`、源码回读`a + b`及4字节／2,097,153字节夹具哈希。停用技能由主进程拒绝，错误包含停用原因，loopback请求数未增加。

- 清理记录：本轮最终fixture原路径已不存在，因递归删除受执行策略拦截，已移入 `release/手动删除/scodex-skill-context-ui-8f30c954-4d52-4a6d-a747-faeb08df6044`；无Scodex工作台.exe残留进程。
- F10清理记录：[workflow-f10-runtime-cleanup.json](../release/workflow-completion-20261031/workflow-f10-runtime-cleanup.json)记录8份隔离fixture（两次失败、两次通过及最终发现的4份遗漏同类夹具），已移入 `手动删除/workflow-f10-20261031`；8个原Temp路径不存在，目标共23,463个文件／1,520,882,484字节、无重解析点、归属进程0，未物理删除。
- 偏航与用户目录副作用：此前旧候选仅启动，未发送键盘输入、消息或模型请求，但误传真实`--scodex-home`；启动自动在`C:\Users\Administrator\workspace-tools`安装Node/Python/pip。此目录仍在。精确清理尝试被自动审批拦截，命令未执行；保留路径和清单，未动其他用户文件。
- 当前候选本轮F10复测后不重复技能上下文场景；外部模型、Git/PR及指定MCP要取得真实目标及安全授权后再验收，不使用对话中粘贴的服务凭据。

## UI 对标验收：1.3.21（已完成）

- 测试对象：参考 EXE [Scodex工作台.exe](../release/chat-reference-final-ui-20261024/win-unpacked/Scodex工作台.exe)，版本 1.0.4；候选 [Scodex-Workbench-1.3.21-x64.exe](../release/ui-alignment-20261031/candidate-rebuilt/Scodex-Workbench-1.3.21-x64.exe)，版本 1.3.21，SHA256 `7130CAA34BFF7ADE485017AE72613B9DF3F5AAADF80B6FF5876EF7675CB3C9F1`。运行环境 Windows 10.0.26300、Electron 45，独立 profile／虚假 home／受控 fixture，不使用真实凭据或业务数据。
- 程序入口：对两个实际 EXE 传入 `--remote-debugging-port`、`--user-data-dir` 和 `--disable-gpu`，通过 CDP 连接页面；视口固定为 1280×819、deviceScaleFactor 1。
- 场景与操作：分别启动参考和候选，等待聊天渲染完成；采集侧栏展开状态，点击收起并采集折叠状态，再恢复展开；读取 DOM 几何、文字标签、字体、颜色、边框、图标计数和折叠控件状态，并截取四张 PNG。
- 预期：候选在两种状态下与参考布局和导航层级一致，侧栏宽度及主区位置一致，文字与样式可见性一致，折叠交互可用。
- 实际结果：通过。报告 [ui-alignment-measurement.json](../release/ui-alignment-20261031/measure-candidate-2/ui-alignment-measurement.json) 状态为 `passed`，总相似度 100%；几何 99.99%、导航 100%、字体 100%、外观 100%、交互 100%。四张证据图在 `../release/ui-alignment-20261031/measure-candidate-2/measurements/`。
- 本轮修复：空归档项目不再显示无效归档入口；折叠侧栏恢复参考版的项目／最近标题和条目文字窄列。`npm run build` 通过（1822 modules），预打包候选包内源码核对通过，见 [rebuild-verification.json](../release/ui-alignment-20261031/rebuild-verification.json)。增量审查见 [incremental-review.json](../release/ui-alignment-20261031/incremental-review.json)。
- 范围限制：该测试覆盖固定视口的视觉／布局和折叠交互，不覆盖后台助手退出后到期触发、模型服务、公网 Git／PR 或其他尚未完成阶段；后台助手阻塞按下方记录保持未完成验证。

## 待办复测：1.3.21 登录期间后台助手（候选退出后触发失败）

- 对象：portable x64 候选 [Scodex-Workbench-1.3.21-x64.exe](../release/session-scheduler-20261031/candidate/Scodex-Workbench-1.3.21-x64.exe)，SHA256 `5ea1ef7a153a73b9a5fa75855ab30ab87058f87235b25c0834c0c1df6868c262`；当前正式仍为 1.3.20，候选未替换。Windows10.0.26300、Node24.11.0、Electron45；实际运行使用专用 profile／项目及回环模型，不操作业务数据或真实凭据。
- 方案边界：原生 Windows 计划任务登记返回 0x80070005；仅确认未登记后使用隐藏助手作本次登录期间的备用，不重复不变的原生失败路径；重启电脑后需重新打开程序。助手实际触发必须真实执行，不以模拟作通过。
- 范围：备用选择／持久化、助手启动／就绪／心跳／停用、重复及错误处理、主程序完全退出后触发、无窗口和单实例转交、任务失败与记录、暂停／删除／停用、重启及双视口。新增实现与实际新包均尚未完成验证。
- 复用：未变协作 22 项辅助、11 项实际候选及其界面结果有效；调度原辅助 18/18、恢复服务 10/10 和实际拒绝恢复 4/4只对原实现有效。成功原生登记仍未验证，不因切换备用实现变为通过。

| 验证范围 | 状态 | 预期与证据 |
| --- | --- | --- |
| 写后回读、编码、语法与定向辅助 | 首轮17项中15通过、2失败 | [写后核验](../release/session-scheduler-20261031/write-verification.json)的5文件编码、3份JS语法及PowerShell解析通过；[辅助日志](../release/session-scheduler-20261031/targeted-tests.log)2个真实助手启动超时 |
| 候选 UI 与后台触发 | 失败 | [实际候选报告](../release/session-scheduler-20261031/candidate-ui/scheduled-background-ui-verification.json)：默认关闭、启用隐藏助手及限制说明通过；主程序退出后 `OS-CLOSED` 未触发，无模型请求。退出后触发失败阻止后续场景验收 |
| 生命周期诊断 | 失败，助手随主程序退出 | 最新[实际候选报告](../release/session-scheduler-20261031/candidate-ui-breakaway/run-6fe0e6f78ade4b14a63f4f1c881c6e09/scheduled-background-ui-verification.json)：测试 PowerShell PID 23100 由 `WmiPrvSE.exe` 启动且 `inJob=false`；Node PID 2336 两次检查均在 Job 外，候选实际 SHA256 匹配。首项真实 UI 检查通过；退出后 OS 触发未产生请求，退出码1。主 PID 26368 与助手 PID 2304 均属于某个 Job，助手父 PID 2060；主程序退出后助手消失，状态为 `launchCount=0`、`stopped=false`。IsProcessInJob 不标识 Job 身份，受控启动 broker 尚未验证。 |
| 其余实际场景与双视口 | 未执行 | 退出后触发恢复后，再验收单实例转交、暂停／删除、持久化与双视口 |
| 正式入口与旧版本替换 | 未执行 | 新包验收后覆盖正式入口，核对哈希、版本与旧路径不存在 |

- 修改前基线：[source-baseline.json](../release/session-scheduler-20261031/source-baseline.json)；本阶段文档落盘检查见 document-verification.json。失败 fixture 保留于 `C:\Users\Administrator\AppData\Local\Temp\scodex-background-ui-4117702a-57ac-4a03-b1d5-11db4fff81dc`；PID 5152 已不存在，`scheduled-session-status.json` 仍记 `stopped=false`、`launchCount=0` 且心跳停在 `2026-10-31T02:31:08Z`，`scheduled-tasks.json` 中计划仍启用。报告的 `taskRemoved=true` 只证明 OS 调度项移除，不证明 fixture 计划文件已停用。
- 恢复前证据：命令 `node --test tests/scheduled-background.test.mjs tests/session-background.test.mjs`退出1；10个原生服务和5个备用选择用例通过，2个实际PowerShell助手在就绪前超时。[单进程诊断](../release/session-scheduler-20261031/helper-start-diagnostic/diagnostic.json)以及同目录 status.json.14204.tmp显示第二次心跳的 File.Replace 第3参数为空字符串，报“路径的形式不合法”，进程已退出；辅助fixture由测试自身清理。保留原failed日志；修复.NET空参数后，仅复验2个真实助手用例，尚未记为通过。诊断目录保留至证据提取完毕，未触碰业务数据。
- 第1条修复后的 `node --test --test-name-pattern='real Windows helper' tests/session-background.test.mjs`退出1，2项仍超时，[原日志](../release/session-scheduler-20261031/helper-recovery-tests.log)保留。[API诊断](../release/session-scheduler-20261031/helper-api-diagnostic/diagnostic.json)显示实际子进程无脚本输出、无状态且退出0；[独立启动对比](../release/session-scheduler-20261031/helper-spawn-diagnostic.json)中detached=false在3207ms正常停止、心跳无错误，detached=true在50ms脚本前退出。替代第2路径移除detached标志，复验只覆盖2个真实助手用例；父进程独立性仍须新EXE完整退出后验证，不以辅助通过代替。
- 本轮启动隔离失败证据：[launcher-diagnostic.json](../release/session-scheduler-20261031/candidate-ui-breakaway/launcher-diagnostic.json)。测试宿主对 `node.exe` 调用 `CreateProcess` 并传入 `CREATE_BREAKAWAY_FROM_JOB | CREATE_UNICODE_ENVIRONMENT`（`0x01000400`）；创建成功后仍查询到 `IsProcessInJob=true`，启动守卫终止 runner，候选及 driver 未启动。该证据只覆盖该 runner 启动方式。
- Explorer ShellExecute 首次诊断失败：[shell-runner-diagnostic.json](../release/session-scheduler-20261031/candidate-ui-breakaway/shell-runner-diagnostic.json)记录 PowerShell PID 9328 的父 PID 4268 已退出；StrictMode 下空 CIM 结果没有 `Name` 属性，异常发生在 Job 查询和候选哈希读取之前。候选、driver 和 fixture 均未启动。该结果只说明诊断启动器路径失败，不计为候选功能结果。随后修复 PowerShell 与 Node runner 可缺失父进程名的诊断，并增加逐轮独立输出目录及 Node 进程信息缺失守卫；第二次尝试结果见下条。
- 最新 WMI + PowerShell 7 启动轮：[启动器报告](../release/session-scheduler-20261031/candidate-ui-breakaway/run-6fe0e6f78ade4b14a63f4f1c881c6e09/shell-runner-diagnostic.json)记录 PowerShell PID 23100 由 `WmiPrvSE.exe` 启动、`inJob=false`；Node runner PID 2336 的两次 Job 查询均为 false，候选 SHA256 匹配。它是已完成的真实候选验收轮而非隔离阻塞：首项默认关闭／启用助手／真实 UI 操作通过，随后退出后触发失败，driver 退出1；完整进程与状态证据见上方候选报告。此前被称为“Explorer ShellExecute”的启动记录缺少父进程名称，不能证明 Explorer 启动链路。
- 方案切换前置证据：独立 WMI `Win32_Process.Create` 探针返回 0，创建的 PowerShell 父进程为 `WmiPrvSE.exe`，`IsProcessInJob=false`；普通 ShellExecute 仍在 Job 内。新实现将以短暂 WMI broker 创建助手，失败时记录 broker 错误；本轮只复测助手启动、主程序退出后的到期触发和直接受影响的清理路径。
- 使用 Skill：systematic-debugging（97/100，沿用已读取说明）；无子 Agent。

## 1.3.21 跨任务协作（同一候选累计11项通过，正式入口未替换）

- 对象：本阶段源代码及[portable x64 1.3.21候选](../release/task-collaboration-20261031/candidate/Scodex-Workbench-1.3.21-x64.exe)，SHA256 `2b288859c6e5267288b9dd9cc0a4d17dbea13fd7a133c0c2b789333613d2a97f`；正式入口仍是1.3.20。环境沿用Windows10.0.26300、Node v24.11.0、Electron45。
- 范围：任务列表与有界文本读取、交接发送、审批后目标复核、运行状态与有界等待；草稿／归档／项目／并发保护，主窗口统一保存、重启持久化及双视口交互。
- 前置：修改基线已保存；不使用业务数据与真实凭据，不结束用户进程。功能验收必须在包含本阶段改动的实际候选EXE上执行；服务／单元验证仅作辅助。受控回环模型不覆盖公网模型，CDP不覆盖原生Windows图层。

| 范围 | 预期 | 当前状态 |
| --- | --- | --- |
| 定向辅助与写后检查 | 列表／分页／文本预算、附件隔离、草稿／stale／归档／并发／权限、桥接取消／claim／超时／关闭及审批边界 | `node --test tests/task-collaboration.test.mjs` 22/22通过；[日志](../release/task-collaboration-20261031/targeted-tests.log)；9个本阶段代码文件严格UTF-8、无BOM及替换字符，相关语法检查通过 |
| 前端及portable构建 | 生成包含本次改动的1.3.21候选 | `npm run build`退出0、1822 modules；electron-builder结构化API退出0，[前端日志](../release/task-collaboration-20261031/frontend-build.log)、[打包日志](../release/task-collaboration-20261031/portable-build.log)；[包内8项逐字节一致](../release/task-collaboration-20261031/build-verification.json) |
| 实际EXE与重启／布局 | 跨项目路由、审批、状态与保存符合预期；1064×660和1440×900可操作 | 累计11/11通过：同SHA及fixture复用前8项，本轮末3项；[最终报告](../release/task-collaboration-20261031/candidate-ui-5/task-collaboration-ui-verification.json)，EXE两次启动均退出0 |
| 增量审查及视觉 | 只审本轮4份既有代码差异及5份新代码／测试，查看实际候选截图 | [9文件审查](../release/task-collaboration-20261031/incremental-review.json)未发现高置信度缺陷；[视觉记录](../release/task-collaboration-20261031/visual-verification.json)，两视口无横向溢出，1440×900截图下无可见错误 |
| 测试临时文件 | 仅清理本阶段专用fixture，保留证据及业务数据 | 2份fixture已移至精确人工删除目录，原路径不存在，5867文件／378769777字节尚未物理删除；[路径映射及状态](../release/task-collaboration-20261031/runtime-cleanup.json) |
| 既有功能 | 未变范围继续沿用已记录有效结果 | 1.3.20及更早结果有效；调度恢复4项有效，成功OS链路仍未覆盖 |

- 首轮命令：`node tests/task-collaboration-ui.cjs`，工具会话66142最终退出1；[原失败报告](../release/task-collaboration-20261031/candidate-ui/task-collaboration-ui-verification.json)保持failed。profile审计记录network／approval-required／“沙箱网络访问未启用”，fixture的全局与项目B设置漏开网络；模型未收到请求。正常停止清理超时，随后核对命令行fixture及父子归属，仅结束本轮自有PID8092；未结束用户进程。失败fixture暂留作诊断，报告中的exitCode=null是当时快照。
- 第2轮：补齐fixture两份networkAccess／allowLocalBinding后，`node tests/task-collaboration-ui.cjs` 会话64712退出1，EXE PID9884正常退出0。身份／跨项目fixture、查看引用／快捷键共2项通过；第3项在比较持久化executionEnabled时遇undefined而预期false。既有electron/conversations.cjs:42只保存true，省略代表未启用；实际TEST:DEFAULT请求tools=[]、effort=medium、目标偏好true，产品无需修改。原报告保持failed，不将未完整通过的场景记作通过。
- 第3轮：false省略断言修正后，默认仅回答和实时回执通过，累计3项；EXE PID12108退出0，驱动退出1。第4项真实read_file成功，模型收到了项目B内容、task_send未开放；界面显示正确回答但仍“正在保存…”，驱动读磁盘得到空助手内容，退出后回读磁盘已有完整结果。根因为finished仅等运行行消失，未等防抖保存，不是已确认的产品缺陷。
- 第4轮：finished等待保存后，第4项及后续保护、审批边界通过，累计8项；工具会话30651退出1，EXE PID19872退出0，无清理错误。第9项的发送返回submitted=true、等待返回timedOut=true／settled=false；目标用户消息含来源标题TEST:MODEL-REJECT和独立指令行TEST:MODEL-HANDOFF。测试端首个标签匹配误走MODEL-REJECT分支，向tools=[]的目标返回task_list，目标以“当前模式不允许执行工具。”拒绝。报告requests顺序与fixture的末条消息支持此根因；原失败报告保持failed，不把未完整通过的第9项记为通过。
- 恢复验收：只将测试端TEST标签匹配限定为独立指令行，保留全部行为断言；原失败消息回放、驱动语法／编码及落盘回读通过。设上述fixture、PRIOR_REPORT指向candidate-ui-4、OUTPUT指向candidate-ui-5后运行 `node tests/task-collaboration-ui.cjs`，工具会话30143退出0，EXE PID11000和10712均退出0，无清理错误。末3项实际验证通过：发送后来源结束而目标继续、1秒有界等待timedOut=true／settled=false，目标结束后读取completed；3项并行时拒绝追加且拒绝忙目标；重启7条聊天保持、运行0，双视口及模态快捷键保护。产品包不变，22项辅助结果有效。
- 视觉与复用：1440×900[最终截图](../release/task-collaboration-20261031/candidate-ui-5/task-collaboration.png)已查看，当前设备、页面、视口和数据状态下无可见错误；1064×660仅几何和交互检查，不额外截屏。fixture已移动，原报告路径保留当时事实，后续若需新功能测试应新建专用fixture，不用已移动路径继续恢复；只在代码、输入、环境或验收条件变化时补测受影响范围，不重跑无关测试。
- 首次包内核验脚本失败：asar提取 `dist/assets/index-BTZu6nG7.js` 报not found；目录查找按Windows原生分隔符拆分。路径改用 `path.normalize` 后8项通过；未修改产品或重建，不把本次脚本失败记录为程序功能失败。
- 正式替换未执行；成功调度链路需要具备Windows当前用户登记权限的环境，不能靠协作测试补作通过。本阶段两份fixture现位于 `E:/GDP/Scodex/workbench/手动删除/task-collaboration-20261031-1.3.21`，原路径均不存在，尚未物理删除；此前自动审批拒绝递归删除，未重试。保留移动后的权限审计、源代码、候选及必要证据，用户配置及业务数据未动；前阶段人工清理项见下节。

## 1.3.21 退出后定时调度（恢复4项通过，成功调度尚未完成验证）

- 对象：Windows10.0.26300、Node v24.11.0、Electron45、portable x64 1.3.21；正式入口仍为下节1.3.20。恢复候选 [EXE](../release/background-scheduler-20261031/candidate-recovery/Scodex-Workbench-1.3.21-x64.exe)，SHA256 `3b2ac32060b8e0a1c4be756e71846950e2cbc80ca8d7e7a2e658f162cd22a2a1`，167296688字节，文件／产品／包版本1.3.21；本轮重建不重复递增。
- 本轮范围：调度服务重复保护、异常恢复、后台偏好／状态与OS任务登记；实际EXE完全退出后触发、同profile现有进程转交、失败记录、停用／删除、重启及双视口。
- 前置条件：源文件写后核对及定向辅助通过，构建候选版本1.3.21；独立profile与受控项目，不使用真实凭据或业务数据。实际Windows任务仅登记到本轮专用profile，结束后精确删除；不结束用户进程。
- 实际恢复入口：设置 `SCODEX_BACKGROUND_SCOPE=registration-denied`、`SCODEX_BACKGROUND_EXE`为恢复候选、`SCODEX_BACKGROUND_OUTPUT`为candidate-recovery-ui，再运行 `node tests/scheduled-background-ui.cjs`。通过真实React／IPC启用后台，读取Windows拒绝原因，退出／重启核对设置和任务；在1064×660及1440×900核对错误区，再停用、暂停／删除并重启回读。CDP驱动实际EXE；loopback模型端点存在但本轮请求0，不代表公网模型通过。

| 范围 | 预期 | 当前状态 |
| --- | --- | --- |
| 原辅助与恢复后的后台服务 | 并发不重复、持久化／恢复及错误可读，不泄露命令 | 原18/18有效；修改后 `node --test tests/scheduled-background.test.mjs` 10/10通过；源／驱动语法与编码通过；[原定向日志](../release/background-scheduler-20261031/targeted-tests.log)，恢复结果沿用实际工具输出，不重跑补证 |
| 实际EXE拒绝原因 | 呈现HRESULT与登记操作，无EncodedCommand | 通过；`Windows 拒绝登记计划任务：当前用户权限不足（0x80070005）。`，registered=false |
| 实际EXE重启保持 | 偏好、任务及错误原因保持 | 通过；enabled=true持久化，原因相同，tasksPersisted=true |
| 实际EXE双视口错误区 | 新增开关与错误完整可见，无水平溢出 | 通过；1064×660与1440×900；scrollWidth等于视口宽度、errorFits=true |
| 实际EXE停用／暂停／删除与重启 | 清除错误、状态持久化，不误发模型请求 | 通过；disabled、errorCleared、pauseAndDeletePersisted、noModelRequests为true；OS任务原本不存在，不等于真实移除已登记任务通过 |
| 成功登记、退出后触发、无窗口、实例转交、已登记任务移除 | 真实OS链路按计划执行且不重复 | 尚未完成验证；当前令牌登记E_ACCESSDENIED，不用模拟补作通过 |
| 构建、增量审查与正式替换 | 包内一致，审查本轮差异，候选通过后覆盖正式 | 构建退出0、7对象一致、12文件审查无新增高置信度问题；正式替换未执行 |

- 构建：前端1820 modules有效；同一electron-builder结构化API恢复打包退出0，[恢复日志](../release/background-scheduler-20261031/portable-recovery-build.log)末尾completed，包内主进程／preload／两服务／HTML／JS／CSS共7对象逐字节匹配，manifest1.3.21。[构建身份](../release/background-scheduler-20261031/build-verification.json)；首次PowerShell参数拆解ENOENT的失败日志保留。
- 首轮失败：`node tests/scheduled-background-ui.cjs`退出1，`Error: Windows task registered`，0个完整场景通过；初次候选SHA256 `b4fbaba2c2572c91dfc074c06117d21065758646f6a9acec32644bfd4212167d`，167295341字节。[失败报告](../release/background-scheduler-20261031/candidate-ui/scheduled-background-ui-verification.json)保持failed。原EncodedCommand异常正文已改结构化JSON／UTF-8／HRESULT；失败不因恢复4项通过而改作成功链路通过。
- 环境诊断：当前Windows令牌为Medium、IsAdmin=false；直接COM、显式当前SID、专用子目录及schtasks登记均为`0x80070005 E_ACCESSDENIED`或Access is denied，未留下任务；诊断子目录已删除。这些结果只证明当前环境登记受限，未证明其他Windows环境成功；不以提升权限或修改安全策略绕过。
- 恢复证据：[实际EXE报告](../release/background-scheduler-20261031/candidate-recovery-ui/scheduled-background-ui-verification.json)4/4通过，命令退出0，三个测试启动退出码均0。报告记录版本、SHA、入口、实际运行profile、步骤及未覆盖范围；专用OS任务不存在，相关进程为空，模型请求0。成功链路不在相同条件下反复重跑。
- 视觉边界：[错误区截图](../release/background-scheduler-20261031/candidate-recovery-ui/scheduled-background-denied.png)已查看，错误文字清晰、无重叠；详情纵向排列与右上留白来自未变的 `.tool-view`、`.scheduled-view`基线，不属于本轮新增差异，不声明整个任务页无可见错误。截图不含Windows原生图层，CDP不等于原生鼠标验收。
- 增量审查：[12文件记录](../release/background-scheduler-20261031/incremental-review.json)，比较本轮修改前source-baseline.json与新增3文件；无Git元数据，不追溯全历史。无新增高置信度问题；成功OS链路运行覆盖仍受环境限制。
- 清理实际状态：2份独立fixture及初次失败候选绝对路径、归属、文件数量、无重解析点和无相关进程已核对；自动审批审查拒绝递归删除，原因为 `blocked by policy`，删除未执行。现已移动到 `E:/GDP/Scodex/workbench/手动删除/background-scheduler-20261031-1.3.21`，5941文件／1131538215字节，3个原路径均不存在、目标文件数量和字节数均一致，尚未物理删除；可在资源管理器仅删除该精确目录。[清理清单](../release/background-scheduler-20261031/runtime-cleanup.json)记录原路径及当前实际位置。恢复候选、正式1.3.20、配置、业务数据和证据保留。

- 复用结果：1.3.20及更早未变实现的有效结果继续沿用；不重跑无关Git／PR／MCP全量测试。公网模型／Git／OAuth和原生鼠标／Windows完整图层不在本轮验收内。
- 必要复测条件：具备当前用户计划任务登记权限的环境；或调度实现、OS登记参数、运行入口／profile、构建产物及受影响布局变化。下一轮先读本节，只补成功链路及受影响范围。正式入口与上一版本保持，未替换、不执行回滚，不声明95%或交付完成。

## 1.3.20 Git 丢弃与重置（实际候选与正式入口已完成）

- 测试对象：Windows 10.0.26300、Node v24.11.0、Electron 45；候选 `../release/git-discard-reset-20261030/candidate/Scodex-Workbench-1.3.20-x64.exe` 与正式 `../release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe` 均为 1.3.20，正式 SHA256 `9d45ce8e4cc2356ab7f9ce8d57ececa853b6609f13d00f51987c29a3fa50dd05`。
- 程序入口：候选由 `node tests/source-control-ui.cjs` 驱动；正式入口由 `E:/GDP/Scodex/Scodex工作台.lnk` 解析，当前目标为正式 1.3.20。独立 profile、隔离 Git 仓库和本机兼容服务用于本轮验收；无真实凭据、公网模型或公网 Git 写入。
- 前置条件：候选／正式文件存在且版本字段一致；运行前确认没有 Scodex／electron 进程；测试后回读文件、版本、快捷方式、旧路径和 fixture 状态。

| 场景／操作 | 预期与实际结果 | 状态／证据 |
| --- | --- | --- |
| `node --test tests/source-control.test.mjs` | 30 项全部通过，覆盖取消、确认锁、hard 受影响路径指纹、重命名、权限／写入保护及远端同步边界 | 通过；[定向日志](../release/git-discard-reset-20261030/targeted-tests.log) |
| `npm run build` | 1.3.20 前端构建完成，1820 modules；包内对象与源文件核对 | 通过；[构建核验](../release/git-discard-reset-20261030/build-verification.json) |
| portable x64 打包 | Electron builder 退出码 0，候选版本与包内 manifest 为 1.3.20 | 通过；[构建核验](../release/git-discard-reset-20261030/build-verification.json) |
| 候选实际 EXE：Git 状态／暂存／提交／分支 | 真实 EXE、React、IPC、Git 读写结果符合预期，未丢失未提交内容 | 通过；候选报告 12/12 |
| 候选实际 EXE：丢弃与 soft／mixed／hard reset | 取消保留文件，确认后按模式改变 HEAD／index／工作区；未跟踪文件、重命名、外部内容和 stale index 保护正确 | 通过；[候选报告](../release/git-discard-reset-20261030/candidate-ui-4/source-control-ui-verification.json) |
| 候选实际 EXE：权限锁、并发、项目／退出与重启 | 确认期间设置保存被拒，Git 并发被拒，外部变化要求重新核对，重启保留项目和布局 | 通过；候选报告 12/12 |
| 候选／正式双视口 | 1064×660 与 1440×900 的受影响布局可见，无本轮报告的水平溢出；字体为 Microsoft YaHei | 通过；候选报告的 `discard-reset-restart-layout` |
| 正式入口与替换 | 快捷方式目标、版本、SHA、工作目录、图标、空参数和窗口样式符合预期；旧 1.3.19 正式路径不存在 | 通过；[入口核验](../release/git-discard-reset-20261030/shortcut-verification.json)、[最终交付](../release/git-discard-reset-20261030/final-delivery-verification.json) |
| 测试清理 | 候选 fixture 目录已删除，未删除配置／业务数据或其他 release 文件；无运行中的有限任务 | 通过；[清理记录](../release/git-discard-reset-20261030/runtime-cleanup.json) |
| 增量代码审查 | 以 1.3.19 包内主进程和当前权限锁／驱动基线为界，检查 main 与 UI 驱动，未发现高置信度问题 | 通过；[审查记录](../release/git-discard-reset-20261030/incremental-review.json) |

### 有效结果、未覆盖范围与恢复

- 当前有效结果：定向辅助测试 30/30、候选实际 EXE 12/12、前端／portable 构建、包内一致性、快捷方式和替换清理均对应 1.3.20。当前有限任务已结束，候选和测试进程已退出。
- 清理证据：候选报告中的 fixture `C:/Users/Administrator/AppData/Local/Temp/scodex-git-ui-b5f1a612-2d3c-4382-aacf-bc6e6780b749` 已核对并删除；删除期间仅为该 fixture 文件清除只读属性。旧 1.3.19 正式 EXE 删除前核对绝对路径、SHA、版本和独占读取，未创建备份。
- 尚未覆盖：公网 Git 主机／认证、公网模型、原生 Windows 鼠标／键盘及原生截图图层；本地 bare Git 和 loopback fixture 仅用于受控验收。EXE 未签名，renderer 源基线不完整。
- 必要复测条件：仅当 Git／权限锁实现、构建产物、快捷方式目标、环境、输入或验收标准变化时，复测受影响场景；不重复无关全量测试。

## 1.3.19 GitHub PR（正式入口通过，人工清理待办）

- 对象／入口：portable x64 1.3.19；E:/GDP/Scodex/Scodex工作台.lnk → [最终EXE](../release/pr-flow-20261030/final/Scodex-Workbench-1.3.19-x64.exe)，SHA256 e64f5578c8c7025e8a8984f641ed94b7601d4458399a214d3e9bfa48747fac43，与候选一致；文件、产品、package／lock及包内版本均1.3.19。上次1.3.18，本轮SemVer末位加1，重试未重复递增。
- 环境／前置：Windows10.0.26300、Electron45、Node v24.11.0；隔离profile／Scodex home、真实临时Git仓库、React／IPC、Windows safeStorage与原生确认；GitHub API用本机兼容fixture替代。无真实凭据、公网写入或模型请求。

| 范围／实际操作 | 预期及实际结果 | 状态／可定位证据 |
| --- | --- | --- |
| PR服务及Git直接回归 | 运行定向测试，PR9/9与Git4/4，正常、失败、权限和冲突边界通过 | 通过；[测试汇总](../release/pr-flow-20261030/targeted-tests-summary.json) |
| 前端与portable候选 | 沿用项目构建，均退出0；7项包内对象与源码一致 | 通过；[构建记录](../release/pr-flow-20261030/build-verification.json) |
| 候选实际EXE完整流程 | 身份、加密连接、创建／取消／重复／就绪、HEAD SHA合并及变化拒绝、只读／禁网／运行保护、重启解密、折叠双视口、断开清除 | 通过9/9，退出0；[候选报告](../release/pr-flow-20261030/candidate-ui-2/github-pulls-ui-verification.json) |
| 快捷方式解析后的最终EXE | 核对包身份，连接与加密、详情默认折叠、点击／Enter展开、1440×900和1064×660、断开清除 | 通过4/4，退出0；[正式报告](../release/pr-flow-20261030/formal-entry/github-pulls-ui-verification.json) |
| 字体／布局与增量审查 | 正式截图已查看；正文16px、辅助14px微软雅黑，双视口无横向溢出；14项审查哈希恢复后均无漂移 | 通过；[视觉记录](../release/pr-flow-20261030/visual-verification.json)、[审查](../release/pr-flow-20261030/incremental-review.json) |
| 最终入口、版本及清理 | 核对正式EXE与快捷方式哈希和版本；3份fixture原路径不存在；无本轮进程；旧EXE及重复构建原路径不存在、目标存在 | 入口核验通过；清理已移动待人工删除；[最终记录](../release/pr-flow-20261030/final-delivery-verification.json)、[清理清单](../release/pr-flow-20261030/runtime-cleanup.json) |
| 当前文档 | 本轮相关章节回读一致、当前链接存在、UTF-8严格解码、无BOM及替换字符 | 以[文档验证](../release/pr-flow-20261030/document-verification.json)落盘结果为准 |

- 复用边界：候选与正式同SHA，完整9项结果复用，最终入口只补4项；旧附件／插件及其他未变路径沿用有效历史记录。初始驱动转义失败保持failed，修正驱动后的9项才为通过；文档换行匹配失败未改变产品，不重跑功能。
- 清理：删除被自动审批以 blocked by policy 拒绝。验证后移动83文件／922598688字节至 E:/GDP/Scodex/workbench/手动删除/pr-flow-20261030-20261030T144236867，未复制备份，原路径均不存在，尚未物理删除。用户数据、配置和正式EXE保留；此精确目录可在资源管理器人工删除。无待结束有限任务或本轮常驻服务。
- 尚未完成验证：公网GitHub账号、真实分支保护、公网模型、原生鼠标和Windows截图原生图层；EXE未签名。不以本机兼容fixture结果代替公网兼容性，不声明整体95%或100%。
- 必要复测条件：相关实现、构建、入口或验收条件变化时，仅复测受影响范围；下一增量1.3.20需按其直接影响范围验收。

## 1.3.18 公开技能插件目录（候选及正式入口已通过）

### 对象、环境和复用边界

- 上次正式1.3.17 → 本次1.3.18，SemVer末位加1；实际portable x64 [历史正式入口核验](../release/plugin-marketplace-20261030/shortcut-verification.json)，SHA256 `b47a97d027d27162ab000d0172c3d8cae18bacd5e00163fc4e3efdbb4eebeb49`，文件／产品版本1.3.18。`E:/GDP/Scodex/Scodex工作台.lnk`已指向此路径，工作目录、图标及空参数保持；旧1.3.17 EXE已精确删除且不备份。
- 环境：Windows10.0.26300、Electron45、Node v24.11.0；独立profile／项目／Scodex home；CDP操作真实EXE renderer、React和IPC。公开GitHub目录／Blob、实际磁盘、重启为真实链路；只有完整候选的1次模型回复由本机受控端点替代，不读真实密钥。
- 复用：完整候选6项使用SHA `9439caf2be238f7ef338ee3bb4c4a1ab1a32cae298e7710e6c99a008a01892b7`；随后只修托管插件启停文案，服务、main、preload未变。最终候选及正式入口均使用SHA `b47a97d0…` 各5项；模型上下文、主进程旧技能拒绝和重启范围按未变实现复用完整候选，不声称最终EXE重跑全部。其他未变MCP／附件与既有功能沿用有效记录，不运行无关全量测试。

### 测试记录

| 范围／操作 | 预期及实际结果 | 状态／证据 |
| --- | --- | --- |
| 服务定向用例 | 固定提交目录、来源、安装／更新／卸载、文件修改保护、路径／大小／Blob SHA及权限拒绝；8个未变用例通过，损坏夹具改同长度后SHA单项通过，共9有效用例 | [汇总](../release/plugin-marketplace-20261030/targeted-tests-summary.json)、[8通过及原失败](../release/plugin-marketplace-20261030/blob-tests.log)、[SHA单项](../release/plugin-marketplace-20261030/blob-hash-retest.log) |
| 完整实际候选：读取目录并安装 | UI读取真实公开目录38项，查看详情、安装gh-address-comments的6个文件；磁盘及技能发现一致，无安装脚本执行 | 通过；[完整候选6项](../release/plugin-marketplace-20261030/candidate-ui-3/plugin-marketplace-ui-verification.json) |
| 完整实际候选：选择技能、停用与重启 | UI选用后技能进入实际聊天请求；停用后主进程拒绝旧选择、不发新请求，重启保留停用／目录状态，再启用成功 | 通过；同完整候选报告，模型1请求为本机替代 |
| 最终候选：文案、详情与来源 | 安装／启停文案准确，停用从技能目录排除；详情两视口不越界，随包文件初始收起、真实Enter展开；卸载删除管理文件并移出技能，自定义来源可添加／删除 | 5/5通过；[最终候选](../release/plugin-marketplace-20261030/candidate-final-check-3/plugin-marketplace-ui-verification.json)，退出0、模型0请求 |
| 正式入口：解析快捷方式后实际操作 | 核对包版本／SHA，真实目录、安装／启停／卸载、来源管理及双视口布局符合预期，详情Enter触发可信keydown／keypress／keyup并展开 | 5/5通过；[正式报告](../release/plugin-marketplace-20261030/formal-entry/plugin-marketplace-ui-verification.json)，退出0、模型0请求 |
| 前端／portable构建及包内一致性 | 构建退出0；6项main／preload／service／renderer对象逐字节匹配，manifest与EXE版本1.3.18 | [构建与身份](../release/plugin-marketplace-20261030/build-verification.json)，沿用Electron45及既有构建配置 |
| 增量审查与清理 | 11个代码／测试／版本文件按原始内容快照审查；最终仅驱动有差异、定向复审通过；8份隔离fixture和重复候选输出已删除 | [增量审查](../release/plugin-marketplace-20261030/incremental-review.json)、[清理](../release/plugin-marketplace-20261030/runtime-cleanup.json) |

- 已执行命令：项目根 `node --test tests/plugin-marketplace.test.mjs`；同长度损坏夹具的单项以 `node --test --test-name-pattern="download mismatch and write denial" tests/plugin-marketplace.test.mjs` 验证。先前8项未变结果复用，不重复叠加计数。
- 实际UI驱动：`node tests/plugin-marketplace-ui.cjs`；完整候选指定 `SCODEX_MARKET_EXE`、`SCODEX_MARKET_OUTPUT`。最终补验与正式入口设置 `SCODEX_MARKET_SCOPE=entry`；正式EXE由 `.lnk` 的TargetPath解析，输出本轮 `formal-entry`。具体对象与PID见原报告，有限测试及EXE均已结束。
- 布局：1440×900及1064×660无页面／面板水平溢出，Microsoft YaHei16px；窄视口详情top20、bottom640、安装按钮bottom621。初始文件清单收起且Enter展开，完整几何及键盘事件见正式报告。[最终截图](../release/plugin-marketplace-20261030/formal-entry/public-plugin-catalog.png)、[视觉记录](../release/plugin-marketplace-20261030/visual-verification.json)：当前设备、页面、视口和数据状态下无可见错误。

### 失败恢复、未覆盖和清理

- 原失败均保留：根API尾斜杠404修复见[url-recovery](../release/plugin-marketplace-20261030/url-recovery.json)；raw主机超时改固定Blob API，见[下载探测](../release/plugin-marketplace-20261030/download-probe.json)。SHA夹具首轮长度变化先触发编码守卫，改同长度后验证内容拒绝；未把夹具失败当作产品通过。
- 视口变更后首次取值仍为旧布局，驱动等两帧后测量；Enter原先缺字符事件，补text／unmodifiedText后记录真实按键事件并展开。产品CSS未调整，几何断言完整保留；原失败及诊断材料保留，无无变化重试或降低断言。
- 尚未完成验证：真实公网模型对新安装技能的执行效果、原生Windows鼠标／OS图层、全部公网仓库兼容性；更新／恶意包用例仅在服务层验证，公开GitHub只读。安装不自动执行脚本、安装依赖或登录／接通MCP；不据本轮通过宣称完整Codex等价。
- 本轮8份隔离fixture已删除，测试EXE退出0；重复候选EXE及unpacked目录已删除，原始报告中的candidate路径为当时事实。最终EXE、源码、基线、日志及截图保留；无本轮常驻服务／手动清理项，用户数据配置未动。旧1.3.17已按用户要求删除无备份，需要旧版须另行构建；[快捷方式核验](../release/plugin-marketplace-20261030/shortcut-verification.json)。
- 文档收尾与最终检查复用以上有效结果，仅回读受影响文档及核对最终入口、版本／哈希与清理状态；[文档核验](../release/plugin-marketplace-20261030/document-verification.json)。本轮无未完成的功能验收项；后续仅在相关实现／环境／输入或标准变化时补测受影响范围。

## 1.3.17 MCP SSE（历史候选及正式入口通过）

### 对象、环境与有效范围

- 对象：实际 portable x64 EXE，版本1.3.17，SHA256 `47b8599e288b34e144ae1734a4f4450dbbefdff071b5924f4a51bbc413e134e1`；当时正式路径为 `release/mcp-sse-20261030/final/Scodex-Workbench-1.3.17-x64.exe`，已在1.3.18交付时删除且未备份；历史[正式入口验收](../release/mcp-sse-20261030/formal-entry/mcp-sse-ui-verification.json)保留，当前快捷方式指向顶部1.3.18。上次1.3.16 → 本次1.3.17，SemVer patch加1。
- 环境：Windows10.0.26300、Electron45、Node v24.11.0；独立 profile／项目／Scodex home；真实 SDK SSE／OAuth 回环服务、Windows 加密、React、IPC与重启。仅模型回复由受控端点替代，无真实凭据、公网账号或模型请求。
- 本轮范围：SSE 配置、连接、Bearer／OAuth、工具和资料、审批／拒绝／取消、网络策略、重启、双视口与正式入口。复用1.3.16定时任务／折叠及其他未变结果；不重跑无关全项目测试。

### 测试记录

| 范围／操作 | 预期与实际 | 状态／证据 |
| --- | --- | --- |
| 相关辅助首轮：5份 MCP test 文件 | 37项，36通过，跨源负向夹具失败；SDK将端点规范化导致输入无效，不是已确认产品故障 | 原失败日志保留；其余36项对应范围继续有效 |
| SSE定向恢复：名称筛选SSE | 原始跨源 endpoint 输入被拒，目标未收到认证；Bearer／工具／资料、OAuth／续期、断线代次及事件体积限制9/9通过 | [SSE日志](../release/mcp-sse-20261030/sse-incremental-tests.log) |
| 加强取消单项 | slow实际抵达服务后取消，record拒绝时未抵达服务，取消后连接仍可用 | 1/1通过；[取消日志](../release/mcp-sse-20261030/cancel-evidence-test.log) |
| 候选EXE完整本轮场景 | 真实点击保存／连接、资料预览；模型工具批准／拒绝／取消；独立OAuth授权；策略阻断；退出重启手动重连；两种窗口布局 | 7/7通过、退出0；[候选报告](../release/mcp-sse-20261030/candidate-ui-2/mcp-sse-ui-verification.json) |
| 快捷方式解析后的正式路径 | 同哈希身份；实际进入页面、保存并连接SSE／预览资料；字体及双视口布局 | 3/3通过、退出0；[正式报告](../release/mcp-sse-20261030/formal-entry/mcp-sse-ui-verification.json) |
| 构建与包一致性 | 前端和portable构建退出0；7项包内文件逐字节匹配；manifest／EXE版本1.3.17 | [构建核验](../release/mcp-sse-20261030/build-verification.json) |
| 替换与清理 | 快捷方式目标、工作目录、图标、空参数符合基线；上一正式EXE删除且未备份；三份fixture原路径均不存在 | [入口](../release/mcp-sse-20261030/shortcut-verification.json)、[清理](../release/mcp-sse-20261030/runtime-cleanup.json) |

- 执行命令：`node --test tests/mcp-sse.test.mjs tests/mcp-runtime.test.mjs tests/mcp-store.test.mjs tests/mcp-oauth.test.mjs tests/mcp-context.test.mjs`；恢复用 `node --test --test-name-pattern='SSE' tests/mcp-sse.test.mjs tests/mcp-oauth.test.mjs`。重叠结果不相加为新用例数量，详见[测试汇总](../release/mcp-sse-20261030/targeted-tests-summary.json)。
- 实际候选在项目根运行 `node tests/mcp-sse-ui.cjs`，输出 `release/mcp-sse-20261030/candidate-ui-2`；正式设置 `SCODEX_SSE_SCOPE=entry`、`SCODEX_SSE_EXE` 为快捷方式解析出的正式路径、`SCODEX_SSE_OUTPUT` 为本轮 `formal-entry`。其余完整候选结果按相同 SHA／实现复用。
- 首轮UI仅包身份通过，后因驱动生成的选择器引号错误失败；修正JSON转义后同候选7/7通过，未重建产品。原始[失败报告](../release/mcp-sse-20261030/candidate-ui/mcp-sse-ui-verification.json)及[恢复记录](../release/mcp-sse-20261030/ui-driver-recovery.json)保留。替换保护的自身匹配误报及处理见[替换恢复](../release/mcp-sse-20261030/replacement-recovery.json)。
- 代码审查：以1.3.16的16份原始文件及SHA清单为基线，实际13份代码／测试／版本差异；检查认证分流、网络权限、连接清理、事件限制、取消和UI，未解决问题0。新增驱动入口筛选及截图定位调整由实际正式入口3项验证；见[审查](../release/mcp-sse-20261030/incremental-review.json)。
- 界面：1440×900和1064×660，页面及MCP容器无水平溢出，Microsoft YaHei；正文16px、预览14px。最终[截图](../release/mcp-sse-20261030/formal-entry/mcp-sse-workbench.png)及[视觉记录](../release/mcp-sse-20261030/visual-verification.json)：当前设备、页面、视口和数据状态下无可见错误。
- 尚未完成验证：公网SSE／各家OAuth身份提供方、真实公网模型对本轮SSE工具的兼容性、原生Windows鼠标／文件选择器。CDP操作实际EXE不等同原生输入。其他既有Codex能力缺口未纳入本轮验收。
- 运行与回滚：测试EXE均已退出、隔离目录已清理，无需保留本轮服务；1.3.16正式文件已删除且无回滚副本，配置及用户数据保留。最终包未签名，保留既有bundle体积提示。仅当实现／环境／输入或验收标准影响对应结果时补测受影响范围。

## 1.3.16 定时任务项目归属与附件折叠（候选、正式及快捷方式入口通过）

- 测试对象：候选及正式 portable x64 EXE SHA256 均为 `ee4efe49b70565e142c12634c400cdc94430bf0e277aa5dddf94a10e5566dbe1`；正式文件与产品版本 1.3.16，Windows 10.0.26300、Electron 45、Node v24.11.0；renderer `assets/index-CIUEhCWU.js`。
- 辅助验证：`node --test tests/scheduled-tasks.test.mjs` 7/7 通过；主进程、服务、辅助与 UI 验收脚本语法检查通过；`npm run build` 与 portable x64 构建退出码 0。Vite 转换 1818 个模块，许可证元数据 294 项；保留既有大 chunk 提示。
- 候选与正式路径各 5 项实际 UI 通过：运行记录各状态默认收起、鼠标／Enter 展开与收回、1440×900 与 1064×660 布局；任务附件摘要默认收起，项目 A 默认值正确，展开后文件名／路径／移除按钮可见，移除并保存成功，切换 A→B→A 后任务仍归属 B。
- 弹窗布局：1440×900 下编辑器边界 y=20..880、正文 769/705 px、操作按钮 y=821..857；1064×660 下边界 y=20..640、正文 769/465 px、操作按钮 y=581..617。标题和操作按钮均在视口内，正文需要时滚动。PNG 签名、尺寸和两态内容差异检查通过。
- 正式路径报告：[候选](../release/task-scheduled-projects-attachments-20261030/evidence/candidate-ui/scheduled-task-ui-verification.json)、[正式路径](../release/task-scheduled-projects-attachments-20261030/evidence/formal-ui/scheduled-task-ui-verification.json)。两份记录均为实际 EXE renderer，退出码 0、模型请求 0、隔离 fixture 删除成功；CDP 不等同于原生 Windows 鼠标或文件选择器测试。
- 快捷方式解析到正式 1.3.16，描述为 1.3.16，工作目录、图标及空参数保持；目标 SHA256 与正式包一致。修正驱动检查名称后，从该快捷方式目标实际运行 5 项 UI 检查并全部通过，退出码 0、模型请求 0、fixture 已清理；报告及截图见[快捷方式入口](../release/task-scheduled-projects-attachments-20261030/evidence/shortcut-ui/scheduled-task-ui-verification.json)和[运行记录折叠态](../release/task-scheduled-projects-attachments-20261030/evidence/shortcut-ui/task-runs.png)。`node --check tests/task-runs-ui.cjs` 通过。差异审查发现并修正的内容仅为报告检查名称；没有发现产品功能问题。旧正式 1.3.15 文件已移除且没有备份。

## 1.3.15 定时任务运行记录折叠（已通过）

- 测试对象：候选与正式便携EXE `release/task-run-disclosure-20261025/{candidate,final}/Scodex-Workbench-1.3.15-x64.exe`，Windows 10.0.26300、Electron 45、Node v24.11.0；两者 SHA256 均为 `e67885ae458896b75935243f2a4bae2dc77395e9a43a37ca11123e186218731a`，包内 renderer `index-DGeARomF.js` SHA256 `dd78fb7f047dd5a3fbd25e6373be0d6c3b02115228b1cc2c54cc10d8fe0c7d2c`。
- 实际UI状态：运行时诊断报告确认页面URL为候选`app.asar/dist/index.html`，加载脚本是包内`assets/index-DGeARomF.js`，app版本为1.3.15；`userDataPath`与`workspaceRoot`均指向此次隔离fixture。三条运行记录均`open=false`、无`open`属性。
- 结果：候选和正式入口各完成 4 项实际 UI 检查并通过：三种状态默认收起；鼠标和 Enter 键展开／收回成功记录；成功完整输出与失败详情可读；1440×900、1064×660 视口无水平溢出。焦点断言为 `SUMMARY.task-run-summary`，三条记录均 `open=false` 且无 `open` 属性。
- 证据：[候选报告](../release/task-run-disclosure-20261025/evidence/candidate-ui-final-2/task-run-disclosure-ui-verification.json)、[正式报告](../release/task-run-disclosure-20261025/evidence/formal-ui-final/task-run-disclosure-ui-verification.json)、[正式截图](../release/task-run-disclosure-20261025/evidence/formal-ui-final/task-runs.png)。两次报告均记录隔离 fixture、零模型／公网请求、EXE 子进程退出码 0 和 fixture 清理完成。
- 辅助验证：`node --check tests/task-runs-ui.cjs`通过；候选构建之前的 `npm run build` 已通过，Vite 转换 1818 个模块并生成 294 项许可证元数据。测试驱动补齐 Enter 按下文本事件与焦点断言后，候选和正式实际验收均通过。
- 限制：测试由 CDP 驱动实际 EXE renderer，不等同于原生 Windows 鼠标输入；数据为隔离定时任务 fixture，未发送模型或公网请求。

## 1.3.14 远端 Git 正式入口验收（已通过）

- 实际对象：Windows 10.0.26300、Electron 45、Node v24.11.0；候选与正式 EXE 均为 1.3.14，SHA256 `8481AC97A3420BFF4A2BDE6702B6F4B9AD20E53A1AA72639B31BB3CF2F793C5A`。正式入口由 `E:\GDP\Scodex\Scodex工作台.lnk` 指向，工作目录为 `E:\GDP\Scodex`。
- 定向测试：`node --test tests/source-control.test.mjs`，22/22 通过，覆盖 Git 状态／暂存与提交保护、远端 Fetch 状态、干净工作区快进 Pull、系统确认的普通 Push、Push 后 Fetch 刷新和远端错误脱敏；耗时约 74.3 秒，退出码 0。`npm run build` 通过，Vite 1818 模块、许可证元数据 294 项；保留既有大 chunk 提示。
- 实际 UI：候选与正式包分别执行远端同步场景，均通过。真实 EXE、Git 仓库／对象／文件和 renderer 均参与；远端使用本机 bare repository，模型响应为本机 fixture，未访问公网仓库或模型。Push 前有系统确认，Push 后本地领先／远端领先均为 0。
- [候选入口报告](../release/remote-git-20261025/evidence/candidate-ui-final/source-control-ui-verification.json)与[正式入口报告](../release/remote-git-20261025/evidence/formal-ui-final/source-control-ui-verification.json)各为 1/1 通过，实际 EXE 子进程退出码 0、无模型请求；[正式界面截图](../release/remote-git-20261025/evidence/formal-ui-final/remote-sync.png)为 1440×900 renderer 画面。只在该页面、视口和数据状态下作视觉结论，不代表原生鼠标或全系统验证。
- [包身份记录](../release/remote-git-20261025/build-verification.json)、[定向测试记录](../release/remote-git-20261025/targeted-tests.json)、[增量审查](../release/remote-git-20261025/incremental-review.json)、[快捷方式](../release/remote-git-20261025/shortcut-verification.json)、[视觉记录](../release/remote-git-20261025/evidence/visual-verification.json)及[清理记录](../release/remote-git-20261025/runtime-cleanup.json)。
- 清理状态：删除受策略阻止，单次移动受权限／隐藏或只读项阻止；未重试。候选 Temp 源仍有 3734 项／189410574 字节，手动删除目录有部分副本 122 项／58803 字节；正式 Temp 源仍有 3854 项／189469377 字节。当前没有其他进程引用，需按清理报告列出的确切路径在资源管理器手动处理；不运行这些夹具。
- 验收边界：本机 bare remote 不证明公网 Git 主机、认证或网络服务兼容；未实现 PR 创建／合并、强制推送或丢弃操作。CDP 驱动实际 EXE renderer，不等于原生 Windows 鼠标验收。

## 1.3.13 正式入口验收（已通过）

- 实际对象：Windows 10.0.26300、Electron 45、Node v24.11.0；候选及正式 EXE 均为 [Scodex-Workbench-1.3.13-x64.exe](../release/draft-attachments-20261025/final/Scodex-Workbench-1.3.13-x64.exe)，SHA256 `04ca72efd67fdd85683dc7ecfa3ab8f8653a535f4f04b457a7111cf919c106d7`，文件／产品版本均为 1.3.13。快捷方式 `E:/GDP/Scodex/Scodex工作台.lnk` 指向正式路径，SHA256 `A28ED1753E28C57CD25F38BB705B6A34FD22D440A80ACB11ADEFA2AF90F05DE1`；工作目录、图标和空参数保持。
- 定向辅助：`npm run build` 通过，Vite 1818 模块、许可证元数据 294 项；`node --check tests/concurrent-chats-ui.cjs` 通过。portable x64 构建使用本机 Electron 45、`npmRebuild=false`、`signAndEditExecutable=false`，退出 0；EXE 未签名，既有 bundle 大小警告保留。
- 候选和正式入口实际 UI：`SCODEX_RUNS_ONLY=drafts-attachments-skill-mode node tests/concurrent-chats-ui.cjs`，分别使用 `release/draft-attachments-20261025/candidate/Scodex-Workbench-1.3.13-x64.exe` 和 `release/draft-attachments-20261025/final/Scodex-Workbench-1.3.13-x64.exe`，每次创建本机隔离 profile、项目和回环模型 fixture，无公网请求。最新候选与正式报告均为 identity 与目标场景 2/2 通过，子进程退出 0、无清理错误。最终追加验证待发送文件、图片及工作台状态快照：摘要默认收起且字号 14px，点击显示详情；文件可移除／重加，快照可加入／展开／移除，切换聊天后恢复收起。候选截图：[收起态](../release/draft-attachments-20261025/candidate-ui-final/draft-attachments-collapsed.png)、[展开态](../release/draft-attachments-20261025/candidate-ui-final/draft-attachments-expanded.png)；正式截图：[收起态](../release/draft-attachments-20261025/final-ui-2/draft-attachments-collapsed.png)、[展开态](../release/draft-attachments-20261025/final-ui-2/draft-attachments-expanded.png)。
- 详细报告：[最新候选入口](../release/draft-attachments-20261025/candidate-ui-final/cross-project-chats-ui-verification.json)、[正式入口](../release/draft-attachments-20261025/final-ui-2/cross-project-chats-ui-verification.json)、[构建核验](../release/draft-attachments-20261025/build-verification.json)。第一次驱动复测因 selector 字符串引号语法错误而未到移除操作；核对进程正常退出后修正测试定位器，之后候选与正式实际 EXE 场景通过；未发现产品故障。
- 当前正式程序包内 UI 实际来自候选构建 SHA `04ca72ef…`，与正式目录文件逐字节哈希一致。主 renderer CDP 验收，未做原生鼠标验证；本轮未执行完整 11 场景套件，相关旧结果不冒充新 SHA 下的完整回归。
- 本轮实际夹具源：失败尝试 `C:/Users/Administrator/AppData/Local/Temp/scodex-runs-ui-eda12311-086f-4b54-b21d-92da89a03401`；候选 `.../scodex-runs-ui-ae753f1a-4974-496d-ad17-36e7caa1888f` 与 `.../scodex-runs-ui-76d250f4-c337-4dae-b246-f9c672049ee9`；正式入口 `.../scodex-runs-ui-16977a88-5241-4def-9c5a-580bfae927d8` 与 `.../scodex-runs-ui-4e3398c7-5e28-4660-8cd7-e2ed6c210984`。递归删除被策略拒绝，五项均已移至[手动清理目录](../release/draft-attachments-20261025/runtime-cleanup.json)，共 18,162 项／943,264,452 字节；Temp 源已核实不存在；不要运行，可由资源管理器手动删除。
- [增量审查记录](../release/draft-attachments-20261025/incremental-review.json)覆盖附件状态呈现、CSS 展开规则、移除回调、目标切换复位、测试断言及版本字段；未发现未解决问题。项目无 Git 元数据，本轮使用修改前读取基线和相关实际 EXE 证据作定向审查。

## 1.3.12 正式入口验收（已通过）

- 实际对象：Windows 10.0.26300、Electron 45、Node v24.11.0；最终 EXE [Scodex-Workbench-1.3.12-x64.exe](../release/cross-project-chats-20261025/final/Scodex-Workbench-1.3.12-x64.exe)，版本 1.3.12，SHA256 `d4c5b930ab7be24ee175db9f0d23d60f9361c32787202646065577428fefcb0d`。启动入口为 `Scodex工作台.lnk` 解析出的该正式路径；快捷方式 SHA256 `A84E9DF3315284BC57750BE75FB74CEBAACD63BDC44173373830185F10C95E38`。
- [完整套件报告](../release/cross-project-chats-20261025/final-suite-2-20261025/cross-project-chats-ui-verification.json)记录 11/11 实际 EXE 检查通过：项目路由、并行停止／未读、草稿／附件／技能、运行中全局保护、审批归属、后台停止、共享文件冲突、布局、重启历史和最终入口。实际 EXE、React、IPC、文件、PowerShell 与历史存储使用真实链路；模型响应使用本机隔离 fixture，没有公网模型请求。
- 附件验收：发送一个文本文件和一张图片；默认 `details.open=false`，文件与图片详情均不可见，摘要显示名称和数量；点击摘要后文件解析状态和图片可见。摘要宽度上限 420px、字号 14px。截图：[收起态](../release/cross-project-chats-20261025/final-suite-2-20261025/message-attachments-collapsed.png)、[展开态](../release/cross-project-chats-20261025/final-suite-2-20261025/message-attachments-expanded.png)。`restart-history` 场景重启 EXE 后实际断言 `open=false` 且文件／图片记录仍存在。
- 正式入口复测在 `Scodex/workbench` 根目录运行 `node tests/concurrent-chats-ui.cjs`；环境为 `SCODEX_RUNS_OUTPUT=E:\GDP\Scodex\workbench\release\cross-project-chats-20261025\final-suite-2-20261025`、`SCODEX_RUNS_EXE=E:\GDP\Scodex\workbench\release\cross-project-chats-20261025\final\Scodex-Workbench-1.3.12-x64.exe`、`SCODEX_RUNS_FIXTURE=C:\Users\Administrator\AppData\Local\Temp\scodex-runs-ui-c67286eb-c609-4e09-b25a-a5ad13e20faf`、`SCODEX_RUNS_ONLY=final-entry`。最终报告 [post-replacement-verification.json](../release/cross-project-chats-20261025/final-suite-2-20261025/post-replacement-verification.json) 显示版本／SHA、共享历史 2 条、存储会话 22 条均符合预期，正式入口 passed，EXE 子进程退出码 0；其余 10 项沿用同 SHA／同 fixture 完整套件的有效结果。
- `attachmentDetails.restartCheckPending=true` 是截图子项遗留标记；独立 `restart-history` 检查实际断言通过。保留原始 JSON，不对报告作手工改写。
- 失败恢复：首个候选发现收起时详情仍占位，已将 CSS 显示规则限定为 `<details>` 展开状态；首次默认打包因在线签名／资源编辑连接超时失败，随后使用项目已验证的本机 Electron 配置完成构建和验收。失败记录保留在旧的候选／预检输出目录。
- 本轮最终入口隔离夹具已移至[手动清理目录](../手动删除/scodex-runs-ui-c67286eb-c609-4e09-b25a-a5ad13e20faf)，4 项／189,378,353 字节；原 Temp 路径不存在且无重解析点。可在资源管理器删除该目录，不要运行其中程序。
- 验证边界：CDP 驱动真实 renderer，未做原生 Windows 鼠标验收；受控模型响应为本机 fixture。仅在附件渲染、持久化结构、目标 EXE 或验收条件变化时复测。

## 1.3.12 验收过程记录（阶段历史）

- 正式基线原为 1.3.11；本轮正式目标 1.3.12。候选和正式文件 `release/attachment-disclosure-20261025/candidate/Scodex-Workbench-1.3.12-x64.exe`、`release/cross-project-chats-20261025/final/Scodex-Workbench-1.3.12-x64.exe` SHA256 均为 `d4c5b930ab7be24ee175db9f0d23d60f9361c32787202646065577428fefcb0d`。快捷方式已指向正式文件，当前哈希 `A84E9DF3315284BC57750BE75FB74CEBAACD63BDC44173373830185F10C95E38`；待从正式目标运行 `final-entry`。验收驱动 `tests/concurrent-chats-ui.cjs` 当前 SHA256 `7DBBF01DAD01276469ADEC07353FC3AD4514A5F4EDFE02900F1D6AA7C431F585`。
- 原跨项目运行与首轮 `full-suite-3-20261025` 结果：路由、并行停止／未读、草稿／附件／技能通过。旧“后台任务时拒绝 addProject”的断言与已实现跨项目切换相冲突，已改为实际点击项目侧栏并验证任务继续；模型配置和对话存储保护断言保留。
- 最新 `final-suite-1-20261025/cross-project-chats-ui-verification.json` 使用上述 1.3.12 EXE：`cross-project-routing` 和 `interleaving-cap-stop-unread` 通过；附件历史检查失败，`details.open=false` 时仍观察到一个附件详情子项有布局框（断言 `1 !== 0`）。原因定位到新 CSS 对详情容器无条件声明 `display:flex`，失败 EXE 退出码 0、`cleanupError=null`。这属于产品显示缺陷，不能记作通过；先将显示限定在 details 展开状态，再重建并用截图和真实 EXE 复验。
- 样式修复后的默认 Electron Builder 调用退出码 1：`connect ETIMEDOUT 20.205.243.166:443`，发生在自动签名／资源编辑阶段。生成物 `1719317b...` 未按构建成功验收，不启动。上次正式构建使用的配置明确关闭自动 npm rebuild 与 EXE 资源编辑并指定本机 Electron 45；已读取其原始配置。下一次用该配置并覆写输出目录重建后，先核对退出码／哈希／文件版本及包内 CSS，再运行实际 EXE。
- 历史本机构建配置重建成功，候选 SHA256 `d4c5b930ab7be24ee175db9f0d23d60f9361c32787202646065577428fefcb0d`、文件版本 1.3.12；`final-suite-2-20261025` 的 11/11 实际 EXE 场景通过，进程退出码 0、无 cleanupError。附件记录默认收起、点击展开，文件解析状态／图片可见，重启后仍收起。摘要宽 420px、字号 14px。干净截图：[收起](../release/cross-project-chats-20261025/attachment-visual-1-20261025/message-attachments-collapsed.png)、[展开](../release/cross-project-chats-20261025/attachment-visual-1-20261025/message-attachments-expanded.png)；单独实际 EXE 场景通过，输出含 identity 与附件场景。对应临时夹具已移入[手动删除](../手动删除/scodex-runs-ui-13245c81-640b-442a-9c41-7a01cc164589)，3 项／186,496,653 字节，源路径不存在。没有真实模型请求。
- 更早的 `full-suite-2-20261025` 未启动 EXE：相对路径从报告目录解析导致 `spawn ENOENT`，见[启动预检失败](../release/cross-project-chats-20261025/full-suite-2-20261025/launch-preflight-failure.json)。夹具已移至[手动删除](../手动删除/scodex-runs-ui-32b58797-e6b6-4d46-a076-6142fe3e0a27)，源路径不存在，3 项／597 字节。
- 新方案：改为 `.message-attachment-disclosure:not([open]) > .message-attachment-details { display:none }`、展开态才启用 flex；保留单行摘要和附件数据。用 `release/activity-status-20261025/electron-builder.config.cjs` 的已验证本机 Electron／关闭 rebuild 与签名编辑设置，CLI 覆盖 `directories.output` 至 `release/attachment-disclosure-20261025/candidate`，重建同一 1.3.12 版本并覆盖无效候选。先核验候选身份，再在新独立输出目录重跑完整实际 EXE 套件；附件场景在断言前保存收起态截图，并核对收起／展开可见元素、解析状态、图片、窄视口和重启默认状态。配置／存储保护及并行切换仍在同套件验收。无真实模型请求。
- 最新失败夹具 Temp 源路径已移至[手动删除](../手动删除/scodex-runs-ui-614ea5af-55bb-423e-bb03-52e0cf6b1d01)，4 项／189,362,046 字节；子进程退出码 0、无引用进程，递归删除策略阻止后未重试。先前 `full-suite-3` 夹具位置见其本轮实际清理记录。
- 最终程序已复制至上述正式路径，哈希与候选相同。首次 `File.Replace(temp,link,$null,true)` 因空备份路径失败，正式链接保持原 1.3.11 状态；随后以同卷 `File.Move(temp,link,true)` 成功替换。正式链接的目标／描述／工作目录／图标／参数均已回读，目标 SHA 与候选相同。下一步使用同一隔离套件 fixture 与最终 EXE 运行 `final-entry`。

## 1.3.11 候选与正式入口增量验证

- 目标对象：Scodex Workbench `Scodex-Workbench-1.3.11-x64.exe`，Windows 10.0.26300、Electron 45、Node v24.11.0。候选和最终入口实际程序 SHA256 均为 `d4e86811841f658b04108a57154dd26f2424c2e62ef2ad12a636174bd99c4193`；版本为 1.3.11。
- 定向辅助：`npm run build` 通过；`node --test tests/message-presentation.test.mjs tests/agent-runtime.test.mjs` 为 20/20；`node --check tests/context-menu-ui.cjs` 通过。构建及包内版本／ASAR 对比见[构建报告](../release/activity-status-20261025/evidence/build-verification.json)。
- 候选实际入口：`node tests/context-menu-ui.cjs`，`SCODEX_MENU_ONLY=compact-activity-records,cancelled-activity-status`，使用隔离 profile 和受控文件夹。通过：成功记录初始 `open=false`，摘要显示“已读取 / 1 项”，点击后 `open=true` 且详情可见；取消／中断记录初始 `open=true`、状态类含 `cancelled`、摘要分别包含“已停止／已中断”，共 2 项。报告：[候选 UI](../release/activity-status-20261025/evidence/context-menu-ui-verification.json)，[截图](../release/activity-status-20261025/evidence/compact-activity.png)。程序退出码 0，操作系统确认进程退出。
- 正式入口：从 `Scodex工作台.lnk` 指向的最终 EXE 运行同一受限 UI 场景；相同两项行为和截图验收通过，退出码 0，操作系统确认进程退出。报告：[正式入口 UI](../release/activity-status-20261025/post-replacement/context-menu-ui-verification.json)，[截图](../release/activity-status-20261025/post-replacement/compact-activity.png)。
- 包与增量审查：正式 EXE 文件版本 1.3.11，候选与最终 EXE 哈希相同；与 1.3.10 包比较 ASAR 的 13,206 个条目，变化限于 renderer JS、HTML 资源引用和包版本字段，CSS 未变化。相关代码与验收断言未发现本轮未解决问题；无 Git 仓库，测试驱动旧源码未保留，具体审查限制见[增量审查报告](../release/activity-status-20261025/evidence/incremental-review.json)。
- 快捷方式：[核验报告](../release/activity-status-20261025/evidence/shortcut-verification.json)记录目标存在、指向正式 1.3.11、目标哈希匹配；工作目录 `E:/GDP/Scodex`、原图标和空参数未改，描述已更新为 1.3.11。
- 清理：候选与正式入口各自的隔离 fixture 原 Temp 路径均不存在；内容已移入[手动删除目录](../release/activity-status-20261025/runtime-cleanup.json)，每个 3,631 项，字节数分别为 185,450,984 与 187,548,866。自动审批拒绝递归删除后未再尝试删除；测试进程均已退出，既有桌面程序未触碰。
- 文档：项目交接、测试交接、对齐记录和 README 均已落盘回读；内容、UTF-8 无 BOM、当前入口链接和版本字段见[文档核验报告](../release/activity-status-20261025/evidence/document-verification.json)。
- 限制：本轮 `requests` 为空，未发送真实模型请求，也不据此宣称公网模型可用。截图是实际 EXE 的 renderer 截图，不是原生 Windows 全屏或文件对话框验收。

## 1.3.10 候选与正式入口增量验证

- 候选对象：`release/context-attachments-20261025/candidate/Scodex-Workbench-1.3.10-x64.exe`，SHA256 `d2a64520bed203e71dd46fb511e4da567d3f3c4f55fdaab051e412b7f0667e99`；正式对象：`release/context-attachments-20261025/final/Scodex-Workbench-1.3.10-x64.exe`，同一SHA；Windows 10.0.26300、Electron 45、Node v24.11.0。
- 定向命令：`npm run build`（Vite 1818 模块，退出 0）；`node --test tests/message-presentation.test.mjs tests/agent-runtime.test.mjs`（20/20 通过）；`node --check tests/context-menu-ui.cjs`（退出 0）；`node tests/context-menu-ui.cjs`，`SCODEX_MENU_ONLY=compact-activity-records,attachments`、测试文件选择夹具开启。
- `compact-activity-records`：实际候选窗口中，已有一项成功操作初始 `agent-activity-shell.open=false`，摘要显示“已读取 / 1 项”，点击摘要后 `open=true` 且单项详情可见；通过。展开状态截图：[compact-activity.png](../release/context-attachments-20261025/compact-activity.png)。
- `attachments`：项目／最近记录的聊天、项目目录清单、跨项目切换、文本文件、图片、工作台快照、技能和仅对话权限禁用／恢复均通过；实际候选进程退出，报告 `processExited=true`，无 `error` 或 `cleanupError`。报告：[context-menu-ui-verification.json](../release/context-attachments-20261025/context-menu-ui-verification.json)。
- 首轮失败及修复：`context-menu-ui-failure-1792919335453.json` 记录 renderer `ReferenceError: useEffect is not defined` 和空 root；加入导入后重建候选并完成上述复测。此前 `attach:folder` 驱动定位失败已由子菜单可见性诊断修正，附件定向复测通过。
- 正式入口复核：从 `Scodex工作台.lnk` 解析到 1.3.10 final 程序，`SCODEX_MENU_ONLY=compact-activity-records` 实际运行；初始 `agent-activity-shell.open=false`，点击摘要后 `open=true` 且详情可见，进程退出码 0。报告：[post-replacement-verification.json](../release/context-attachments-20261025/post-replacement/post-replacement-verification.json)。
- 限制：文件选择结果由测试专用主进程夹具提供，未验证原生 Windows 对话框的鼠标选择与外观；中转 Opus 5.5 真实请求返回 HTTP 503 `All available accounts exhausted`，本轮 `liveRelayRequests` 为空，未声称真实模型通过。测试进程已退出。自动审批拒绝了递归删除请求（`blocked by policy`）；未重试删除，两个临时目录已移入[手动删除夹具 1](../手动删除/scodex-menu-ui-8e023518-7d2f-4d59-8256-c1f8336485b6)和[手动删除夹具 2](../手动删除/scodex-menu-ui-a32e7a85-2e92-4b2e-99b6-9e87c783be6d)，源路径均不存在，清单分别为 3,639 项／189,367,069 字节和 3,631 项／185,449,888 字节。详见[清理记录](../release/context-attachments-20261025/runtime-cleanup.json)。

## 1.3.10 对象、入口与结论（历史）

- 正式Scodex Workbench **1.3.10**，上次正式1.3.9；SemVer末位加1，同轮重建不递增。[最终EXE](../release/context-attachments-20261025/final/Scodex-Workbench-1.3.10-x64.exe)，文件版本1.3.10，SHA`d2a64520bed203e71dd46fb511e4da567d3f3c4f55fdaab051e412b7f0667e99`。
- `E:/GDP/Scodex/Scodex工作台.lnk`已指向该最终包，写后SHA`de7f49302c5841f29fff77b18b2edfe004172b1cc38d6ff9dc4f069696dac29`。目录／图标／空参数保持、描述1.3.10；实际解析目标后的紧凑记录复核通过，测试及EXE退出0。
- Windows10.0.26300／Electron45／Node24.11.0；隔离profile／SCODEX_HOME与同卷受控项目，不改真实模型、凭据及用户数据。真实EXE／React／IPC、历史／文件和PowerShell；只有模型回复用本机SSE服务替代，不证明公网Grok兼容。CDP交互和renderer截图，非原生鼠标／OS缩放或Windows全屏验收。
- 20/20定向单元测试、候选附件范围、候选紧凑记录范围、正式入口紧凑记录范围、构建／包核对及三文件增量审查通过。所有必要有限操作终态，无本轮常驻测试实例／服务；两个临时夹具已移入手动删除，不影响功能。

## 1.3.9 辅助、构建与审查

| 对象／命令 | 场景、预期及实际结果 | 状态 |
| --- | --- | --- |
| node --test tests/conversation-revisions.test.mjs tests/conversations.test.mjs tests/context-actions.test.mjs | 正确前缀／完整原分支、版本切换及后续、附件／模型与明确执行、草稿／过期／运行／归档／20版本、normalize旧历史、分叉ID与子窗限定动作 | 28/28通过 |
| node --test --test-name-pattern="version limit" tests/conversation-revisions.test.mjs | 收尾只改上限提示，原19备选不丢且达到20拒绝新增 | 1/1复测通过，非额外唯一用例 |
| node --check tests/conversation-revisions-ui.cjs | 引号修正、最终入口和几何／最终报告字段的新增驱动差异 | 退出0 |
| npm run build；electron-builder portable x64 | 1818模块／294许可证；最终输出final，Electron45、npmRebuild=false、signAndEditExecutable=false | 退出0 |
| 包／版本／编码 | main、preload、conversations、workspace-windows和3renderer对象共7项与源一致；manifest关键字段一致，sourceDrift=[]；lock仅两处根版本1.3.9，源码UTF8无BOM、无替换字符／中文正常 | 通过 |
| 12文件增量审查 | baseline-manifest／review-baseline与恢复的原始内容一致；仅本轮差异及直接引用，文案／驱动修正仅定向复审，无未解决本轮问题 | 通过 |

[辅助](../release/message-revisions-20261025/targeted-tests.json) · [构建／包](../release/message-revisions-20261025/build-verification.json) · [增量审查](../release/message-revisions-20261025/incremental-review.json)。辅助不替代实际程序验收；未运行无关全项目测试或历史扫描。

## 1.3.9 实际EXE：8个功能范围及正式入口

驱动node tests/conversation-revisions-ui.cjs；SCODEX_REVISION_EXE指定确切程序，FIXTURE复用同轮隔离数据，ONLY强制选中所需范围。原7范围SHA31972c82…源于[初始实际记录](../release/message-revisions-20261025/initial-runtime-verification.json)，最终补验及入口SHAc1545400…分别见[最终增量](../release/message-revisions-20261025/final-runtime-verification.json)与[正式入口原始记录](../release/message-revisions-20261025/final-entry-runtime-verification.json)；[合并记录](../release/message-revisions-20261025/revision-ui-verification.json)逐项保留真实SHA和复用依据。

| 范围 | 实际操作、预期与结果 | 状态／SHA |
| --- | --- | --- |
| edit-prefix-attachments-and-draft | 编辑早期用户消息；只发送此前正确前缀、原图片／附件，旧回答／后续和未发送草稿保留 | 通过／31972c82… |
| switch-and-follow-up-retention | 双向切回初始与编辑版本，各自新增后续，再来回切换不丢消息 | 通过／31972c82… |
| regenerate-earlier-success | 重新生成已有成功回答，正确前缀，旧分支及后续保留 | 通过／31972c82… |
| detached-edit-sync-and-stale-guard | 真实子窗编辑、主窗保持选中另一聊天和草稿，双向快照；过期表单拒绝且不发请求 | 通过／31972c82… |
| running-and-version-limit-guards | 生成中禁用编辑／版本，子窗IPC拒绝；达到20版本拒绝新增且19备选保留 | 通过／31972c82…，最终文案另验 |
| tool-reexecution-explicit-and-no-rollback | 默认不请求工具；明确勾选、真实审批及PowerShell写文件，旧文件／操作保留，再生成默认仍不执行 | 通过／31972c82… |
| restart-and-layout | 编辑版本、消息和备选完整重启；1080×700／1440×900，字体16px微软雅黑、版本条／编辑框不越界 | 通过／31972c82… |
| version-limit-copy-and-final-entry | 最终包的准确新建聊天引导，无请求／不丢20版本；真实右键分叉保留全部版本且消息ID独立、原聊天不变；重启和两视口编辑框边界通过 | 通过／c1545400… |
| formal-entry-restart（替换后） | 从正式.lnk解析EXE，4聊天和20版本重启一致；截图10个菜单项齐全、最终边界在1440×900内，正常退出0 | 通过／c1545400… |

最终入口命令：解析.lnk TargetPath设置SCODEX_REVISION_EXE，SCODEX_REVISION_FIXTURE为同轮d420027d…夹具，SCODEX_REVISION_ONLY=formal-entry-restart；命令与EXE退出0。[最终菜单](../release/message-revisions-20261025/workspace-menu-final.png)、[视觉记录](../release/message-revisions-20261025/visual-verification.json)、[替换后核验](../release/message-revisions-20261025/post-replacement-verification.json)、[快捷方式](../release/message-revisions-20261025/shortcut-verification.json)。当前设备、页面、视口和数据状态下无可见错误。

## 1.3.9 失败恢复、边界和清理

- 代码审查发现20版本提示建议分叉继续，但分叉保留全部版本，不解除上限；只改为导出需要内容并新建聊天的明确引导，不改变保留／分叉逻辑。同轮仍1.3.9，final独立候选构建、实际补验后更新入口；原未变7范围按验收条件继续有效。
- [驱动语法前置失败](../release/message-revisions-20261025/final-driver-preflight-failure.json)：新增CDP表达式嵌套引号错误，EXE未启动；改JS字符串编码并让语法失败立即停止后续命令，语法与实际范围复验通过，未因此重写产品。
- [入口首轮边界失败](../release/message-revisions-20261025/revision-ui-failure-1792904727164.json)：启动／历史及10项标签通过，菜单边界断言失败，EXE退出0；首轮没有几何证据。补诊断实际观察初始bottom1122.5625→两帧后892、top394.4375（1440×900），对应菜单useLayoutEffect再定位；仅补驱动几何记录与有界布局等待，保持完整边界断言，最终通过。未虚构首轮原始坐标。
- 上次正式1.3.8→本次1.3.9；最终入口为final/Scodex-Workbench-1.3.9-x64.exe，SHA见顶部；初始31972c82…与最终c1545400…分别保留证据，不混用。写前核对快捷方式SHA／目标，候选字段核对后同目录File.Move替换，最终回读及实际入口通过。没有额外旧EXE备份；可将.lnk指回既有1.3.8程序及描述，SHA248e7320892a6945af16555f5876307efca7a2fb4e227355ce915be4664c615d；启动前从托盘退出旧实例，用户进程未被结束。
- [清理记录](../release/message-revisions-20261025/runtime-cleanup.json)：递归删除被自动审批拒绝（blocked by policy），未执行且未重试或换工具删除。核对绝对路径、reparse0、owned进程0后，两夹具3628／3626项同卷移至[首夹具](../手动删除/scodex-revision-ui-f125a184-dc19-4cb6-8e00-ebf796354e68)和[最终夹具](../手动删除/scodex-revision-ui-d420027d-1fd8-41a2-968b-591ce44fffc0)，原release内路径均不存在。可在资源管理器手动删除上述精确目录，不运行夹具程序；其他旧夹具、测试源码、有效证据和正式包保留。报告内原fixture输入路径为测试时事实，现存位置以清理记录为准；未来测试新建隔离夹具。
- 未覆盖：本轮没有真实公网模型请求、原生鼠标或OS窗口缩放验收，不据本机模型替代服务宣称公网Grok通过。EXE未签名；既有bundle／元数据提示保留。完整跨项目并行协作、远端Git／PR、全部办公和生成式重绘仍是整体对齐缺口；原菜单外部应用正文渲染、8窗上限及MCP等不变边界沿用原版本记录，未重复验收。
- 四文档落盘回读、链接、UTF8无BOM及哈希见document-verification.json；仅当相关实现、环境、输入或验收条件变化时复测受影响内容。整体目标active，本轮无功能阻塞，手动清理残留不影响有效结论。

## 1.3.8 辅助、构建与增量审查

| 对象／命令 | 场景、预期与实际结果 | 状态 |
| --- | --- | --- |
| node --test tests/source-control.test.mjs | NUL／中文／空格／改名／独立删除／二进制／stale文件及index／字面路径／首次提交／分支／身份失败／冲突／真实元数据和共用commonDir，退出0 | 16/16有效 |
| source-control.test.mjs新增3项定向匹配 | 确切登记根访问、junction替换拒绝、开发服务动态目录；敏感／相对越界仍拒绝，退出0 | 3/3通过 |
| node --test tests/dev-services.test.mjs | 受影响服务目录与生命周期辅助，退出0 | 8/8通过 |
| 定向语法与UTF8回读 | main和最终UI驱动node --check退出0；17文件与候选／原始基线一致，UTF8无BOM、无异常替换字符，中文对照正常 | 通过 |
| npm run build；electron-builder portable x64 | 1816模块／294许可证；第四次portable退出0；前端未变复用build，Electron45、npmRebuild=false、signAndEditExecutable=false | 通过 |
| 版本／包内对象及manifest | main／preload／git-service／worktrees／dev-services／project-registry和3renderer对象共9项与源一致；manifest关键字段一致，lock仅两处根版本1.3.8，无新依赖 | 通过 |
| 17文件增量差异审查 | 精确原始baseline-manifest和review-baseline，范围内状态／权限／生命周期／异步／边界／版本／测试检查；未解决本轮问题0，无全历史扫描 | 通过 |

新增3项实际命令：`node --test --test-name-pattern="exact registered worktree|replaced by junction|development service resolves" tests/source-control.test.mjs`。16原Git范围不受后续worktrees／dev-services改动影响，按原结果复用，不重复叠加计数。

[辅助记录](../release/source-control-20261025/targeted-tests.json) · [构建与包](../release/source-control-20261025/build-verification.json) · [增量审查](../release/source-control-20261025/incremental-review.json)。辅助证据不替代实际程序验收。

## 1.3.8 实际EXE：8个有效范围

命令`node tests/source-control-ui.cjs`；SCODEX_GIT_FIXTURE复用同轮独立项目／profile，默认跳过已通过范围，ONLY强制选中范围。按真实UI查看差异／填写表单／逐次审批，核对Git对象、文件、持久化与服务实际响应。替换后EXE取自正式.lnk解析目标，ONLY=restart-layout-and-final-entry。

| 范围 | 实际操作、预期与结果 | 状态／SHA |
| --- | --- | --- |
| diff-stage-unstage-local-commit | 选择中文文件看差异，暂存／取消再暂存、填说明提交；Git核对仅暂存内容入提交，未暂存保留 | 通过／d5095bac… |
| external-content-and-index-stale-protection | 看过差异后外部改文件或另行暂存，UI拒绝旧操作、原index内容保留 | 通过／d5095bac… |
| new-branch-preserves-working-files | UI新建scodex/ui-feature并切换，Git分支及未提交原文符合预期 | 通过／d5095bac… |
| readonly-unsaved-and-running-guards | 只读策略、真实编辑器未保存、真实运行请求分别拒绝Git写入，保存／停止正常完成 | 通过／d5095bac… |
| write-lifecycle-project-and-exit-guards | Git写入期间切项目／退出被拒，写入完成且程序继续运行、工作文件保留 | 通过／d5095bac… |
| managed-worktree-project-and-model-task | Git页打开托管树项目，真实模型审批后PowerShell写task-isolated.txt，原项目无该文件；当前树删除拒绝，真实HTTP服务启动／响应就绪／停止 | 通过／248e7320… |
| nonrepo-unborn-and-storage-entry | 普通目录明确不是仓库；首次暂存／提交成功；设置存储管理可见作为项目入口，当前项禁用 | 通过／248e7320… |
| restart-layout-and-final-entry | 完整退出重启，当前树项目与5聊天持久化；1080×700／1440×900页面无横向溢出、微软雅黑16px；选择真实差异文件截图，退出0 | 通过／248e7320… |

[合并实际报告](../release/source-control-20261025/source-control-ui-verification.json)：前5范围未受最后工作树访问修复影响，保留SHAd5095bac…；后3和正式入口为当前SHA248e7320…，不冒称同一二进制全部重跑。report.requests仅保留最后复核轮次，不作为所有轮次完整网络日志。1.3.7菜单29辅助／13实际及更早未受影响范围按原版本／SHA复用。

## 1.3.8 正式入口、视觉、失败恢复与清理

- [快捷方式](../release/source-control-20261025/shortcut-verification.json)：写前核对原SHABE11D322…与1.3.7，候选TargetPath／描述为1.3.8、目录／图标／空参数保持；同目录File.Move后回读SHA和字段，文件版本和EXE哈希与验收候选一致，没有额外备份旧EXE。
- [替换后实际复核](../release/source-control-20261025/post-replacement-verification.json)：从正式.lnk解析EXE目标，强制重启／项目／5聊天／双视口／字体复核，实际SHA248e7320…，EXE退出0。
- [最终截图](../release/source-control-20261025/source-control.png)与[视觉记录](../release/source-control-20261025/visual-verification.json)：晚于正式入口替换，实际版本控制页选task-isolated.txt，已独立查看最终图像。结论限“当前设备、页面、视口和数据状态下无可见错误”；不推断全系统绝对无错误。
- 已修复前置：一行全改名被Git识别D+A，测试改高相似R及独立删除保护；core.quotepath=false避免中文C引用；CRLF按语义文本比较。ASAR同路径header缓存清除后再核对，无盲重建。
- 产品失败：userData整体保护误拦工作树模型cwd；改确切登记／非链接根授权，模型每次工具guard和服务首次／最终目录校验后，3新增辅助及真实EXE模型／服务通过。原initial-test-failure、source-control-ui-failure-*、source-control-ui-before-path-hardening等报告保留。
- 存储续验实际页面已有入口，旧.settings-nav选择器导致等待失败；只改驱动为.settings-category-list，并读取确认已完成的首次提交，不重复写入。剩余2范围随后通过，产品／EXE不变。文档插入的LF／CRLF定位差异已按实际标题修复，保留原换行约定。
- [清理实际状态](../release/source-control-20261025/runtime-cleanup.json)：两夹具预检查无reparse、owned进程0；跨卷Move-Item报Windows权限或隐藏／只读项错误。首份ea6681e3…原Temp剩3512项，项目手动删除同名位置219项；第二份94c7f634…仍在原Temp共3749项，其项目目标未创建。失败后只读确认一次即停止，未重试强删／移动或提升权限。三个实际现存位置需按记录在资源管理器手动删除，不运行其中程序；旧夹具不动，此残留不影响功能。未来复测新建隔离夹具，不复用已分散或待删除目录。
- 回滚沿用已有1.3.7EXE，路径／SHA和快捷方式方法见项目交接，保留用户数据／配置。无本轮常驻测试进程或服务；文档验收见release/source-control-20261025/document-verification.json。
- 未覆盖：远端推送／PR创建合并、丢弃／强制重置、完整跨项目任务协作、公网Grok与全部OAuth提供方兼容、原生鼠标和8窗口上限未新增验收。只有相关实现／配置／依赖／输入或验收标准变化才定向复测，文档更新不触发程序重测。

## 1.3.7 验证记录

- 命令：node --test tests/context-actions.test.mjs tests/conversations.test.mjs tests/project-registry.test.mjs tests/chat-runs.test.mjs；29/29 通过，见[辅助记录](../release/context-menu-20261025/targeted-tests.json)。npm run build 1815 模块／294 许可证，portable x64 构建两次均退出 0；版本、运行 manifest 及 10 个包内对象一致，见[构建记录](../release/context-menu-20261025/build-verification.json)。
- 实际命令：node tests/context-menu-ui.cjs；输入为本轮独立项目／历史／回环模型服务，真实步骤见[验收驱动](../tests/context-menu-ui.cjs)，期望与实际见下表及[逐项证据](../release/context-menu-20261025/context-menu-ui-verification.json)。SCODEX_MENU_FIXTURE 曾复用同轮夹具，ONLY 只运行待验范围且强制重验选中项；成功项未无变化重跑。夹具现已清理移动，未来复测不可再使用其原路径或手动删除目录中的程序。

| 范围／实际操作 | 预期与实际结果 | 状态／构建 |
| --- | --- | --- |
| 两视口右键、碰边子菜单、Shift F10及方向键 | 10项完整、菜单及子菜单不越界，焦点／Escape恢复；1440×900及1080×700，微软雅黑16px／辅助14px | 通过／初版 |
| 重命名、置顶、阅读状态、4种复制 | 中文名称／状态落盘，剪贴板标题、Markdown、文本、ID对应当前聊天 | 通过／初版 |
| 分叉、移动项目、导出及完整最近页右键 | 新聊天／消息ID、父关联、目标项目、实际MD文件及最近页菜单正确 | 通过／初版 |
| 聊天归档恢复、取消及确认永久删除 | 归档可恢复，取消保留，确认后移除记录 | 通过／初版 |
| 项目重命名／置顶／未读／归档恢复／删除 | 登记及关联聊天移除，磁盘keep.txt原文仍在 | 通过／初版 |
| 独立聊天窗、编辑草稿、发送及独立性 | 白名单桥、无Node／主桥暴露，主窗选中项及其他草稿不变，回复真实落盘 | 通过／最新 |
| 子窗审批、真实命令、停止、运行门禁 | 明确批准后PowerShell写文件，停止保留结果，结构操作被禁用 | 通过／最新 |
| 关闭子窗、项目窗和新聊天窗 | 主任务继续完成，项目列表／新聊天与独立窗口一致 | 通过／最新 |
| 双向草稿 | 子窗→主窗、主窗→子窗均同步，失焦不锁旧值 | 通过／最新 |
| 空项目、当前项目移除、最后项目和dirty | 空项目创建自己聊天，移除切换回退项目，最后项目及未保存操作被拒，目录保留 | 通过／最新 |
| 打开方式、项目新聊天及快捷键 | MD/TXT真实导出，Notepad默认打开请求及资源管理器两个测试目录确认；重命名／归档快捷键有效 | 通过／最新；外部正文未验 |
| 完整退出再启动、窗口清理 | 7条历史、名称／置顶／项目／分叉持久化，无旧子窗恢复 | 通过／最新 |
| 正式入口、缩放关闭／右键重开及最终截图 | 原.lnk解析的1.3.7实际启动；1080菜单→1440缩放关闭→重开，版本／历史／退出0 | 通过／最新及替换后 |

- 初版 SHA13fc205323eb0fedcba85d57dd6dccf9a89616701d8d56b80b8b5c9fbf4b496d 的前 5 范围未受后续两处 renderer 修复影响，沿用有效结果；后 8 范围使用最新 SHA4242973e…，逐项报告保留原始SHA。没有声称同一二进制全量重跑。其他 1.3.6 并行／1.3.5 OAuth／1.3.4 资料等未变化路径按原版本及 SHA 沿用下方记录。
- [最终截图](../release/context-menu-20261025/context-menu.png)已在最后驱动修正后的实际运行中生成并人工查看，[视觉记录](../release/context-menu-20261025/visual-verification.json)结论仅为：当前设备、页面、视口和数据状态下无可见错误。菜单／分组／图标／快捷键／删除确认、字体和页面边界均有定向操作证据；不能推断全系统绝对无错误。
- [增量审查](../release/context-menu-20261025/incremental-review.json)：18文件、原始基线及直接依赖，范围内无未解决项。最后仅复审驱动就绪／事件记录／缩放关闭重开差异；node --check tests/context-menu-ui.cjs退出0，产品及包不变，复用此前有效审查。

## 1.3.7 失败恢复、边界与清理

- 保留 context-menu-ui-failure-*.json、driver-preflight-failure.json：碰边早读两帧修正；关子窗后CDP返回超时改主Target.closeTarget；驱动探针引号及open父菜单遗漏修正；历史100ms保存前置读早改等一致。反向草稿同步确为产品失焦锁旧值，改pending draft回声后真实复验通过；空项目错误选旧聊天补当前项目空聊天后通过。未无证据重写其他产品部分。
- 替换后首次 final 的 Menu visible 超时，EXE退出0，报告 failure-1792898388029 保留；补诊断轮通过，未捕获首次原事件。菜单源码resize关闭与驱动未等待视口就绪构成时序缺口；只补focus／两帧，最终实际观察contextmenu→menu:true→resize→menu:false→contextmenu→menu:true，见入口报告的entryTrace。定向复核命令：解析.lnk TargetPath为SCODEX_MENU_EXE，SCODEX_MENU_ONLY=final-layout-and-entry node tests/context-menu-ui.cjs，退出0；29辅助和其他12范围未重跑。
- .lnk首次File.Replace因空备份参数绑定失败，原SHA及1.3.6目标未变；后用核对基线的同卷File.Move覆盖。最终字段、目标SHA及版本已读回。无新旧EXE混用、没有额外旧EXE备份；恢复可将原.lnk指回已有1.3.6程序，SHA656d0cc2bcdd92087b8a684953a6497c09a54eff0bca99872edec6a9fb24cf21。启动新版前请从托盘完整退出旧版，未擅自结束用户进程。
- 尚未覆盖：默认应用正文渲染、公网模型及所有身份提供方、原生鼠标、8窗上限的实际操作；8窗限制已静态审查。任务共享当前项目，跨项目发送须先切项目，非独立工作树。EXE未签名，既有bundle／description／author提示保留；以上不冒作已验收。
- [清理证据](../release/context-menu-20261025/runtime-cleanup.json)：3644项已移至[待手动删除](../手动删除/scodex-menu-ui-f912cff5-9d5c-4d9f-a1f4-28e8e26e6163)，原Temp路径不存在、reparse0、owned进程0。无本轮有限任务、EXE或测试服务残留；两个本轮Notepad按唯一测试输入确认后结束。沿用清理限制，未重试递归删除；可用资源管理器删除该确切目录，不运行其中程序。报告中的原始fixture输入路径保留测试时事实，现位置映射以runtime-cleanup.json为准，其他旧夹具未触碰。
- 四份说明已落盘回读、链接、UTF-8无BOM核验，见release/context-menu-20261025/document-verification.json。后续复测只在本次实现／配置／环境／输入或验收条件变化时覆盖受影响部分；不重复无变化的有效结果。

## 1.3.6 验证记录

| 范围／命令 | 场景、预期及实际结果 | 状态 |
| --- | --- | --- |
| node --test tests/chat-runs.test.mjs tests/conversations.test.mjs tests/agent-tools.test.mjs tests/spreadsheet-tools.test.mjs tests/image-tools.test.mjs | 请求标识／重复／3项／释放／保留、未读、共享锁及真实双工具箱冲突；历史、文本／表格／图片直接回归37/37退出0 | 通过 |
| npm run build；electron-builder portable x64 | 1811模块／294许可证，Electron45，npmRebuild=false／signAndEditExecutable=false；EXE退出0、10关键对象及manifest一致，锁仅2根版本 | 通过 |
| node tests/concurrent-chats-ui.cjs（续验SCODEX_RUNS_FIXTURE） | 新隔离实例真实启动1.3.6；分轮只执行未过场景，10范围同一SHA；CDP驱动实际renderer，非原生鼠标 | 通过 |
| 交错／门禁／停止／未读 | A/B/C保持流式，新建D可编辑；UI／IPC第四项与同聊天重复拒绝；A/B文本不串，C独立取消且迟到不串；后台结果未读并选择清除；运行历史不能删归档 | 通过 |
| 草稿／附件／技能／计划 | 文字、真实图片、文件、技能及一次计划切换后恢复，另一聊天为空；实际发送模型只收到D附件、1图片，历史对应，另一草稿保留 | 通过 |
| 后台错误／全局保护 | 一个503错误不影响另一个完成；运行时模型连接／存储迁移／项目切换IPC拒绝 | 通过 |
| 双审批归属／拒绝 | 两个真实命令分别待审批，任务入口跳转正确；A批准生成A文件，B拒绝无B文件，状态各自保存 | 通过 |
| 后台审批停止 | C待审批，另项流式；只停C，无文件／无残留审批，另一项完成 | 通过 |
| 共享文件读改读 | 两聊天同时读取同基线再精确修改，1成功1明确冲突；文件保留胜出中文CRLF，两者均真实回读 | 通过 |
| 导航／双视口／字体／截图 | 返回运行聊天可用；1440×900／1080×700无横溢出，输入可见，微软雅黑16px／辅助14px，独立停止可见；折叠与展开实际等待生效 | 通过 |
| 完整退出重启 | 无活请求或审批，26聊天保留，已发送图片／文件历史保留，磁盘数量一致 | 通过 |
| 正式入口复核 | 解析实际.lnk目标强制执行final-entry，1.3.6／同SHA、2共享任务历史与附件历史，退出0 | 通过 |
| 15代码／配置／测试文件增量审查 | Electron1.3.5包内基线；renderer源按确切变更记录恢复，原始整源哈希未保留；仅差异及直接路径，无范围内未解决项 | 通过／基线限制已记录 |
| 文档与清理 | README／对齐／双交接回读、内容／链接／UTF8无BOM；3638夹具移动、原路径不存在、owned进程0 | 通过／待手动删除 |

- [37辅助](../release/concurrent-chats-20261025/targeted-tests.json)、[10实际范围](../release/concurrent-chats-20261025/concurrent-chats-ui-verification.json)、[包与构建](../release/concurrent-chats-20261025/build-verification.json)、[增量审查](../release/concurrent-chats-20261025/incremental-review.json)、[入口复核](../release/concurrent-chats-20261025/post-replacement-verification.json)、[快捷方式](../release/concurrent-chats-20261025/shortcut-verification.json)、[截图](../release/concurrent-chats-20261025/concurrent-chats.png)、[视觉](../release/concurrent-chats-20261025/visual-verification.json)、[清理](../release/concurrent-chats-20261025/runtime-cleanup.json)。
- 环境／驱动失败均保留原报告：初始进程初始化未启动；历史未保存ID／同名空聊天定位；Chromium拒绝测试PNG后使用实际canvas生成有效输入；侧栏异步保存等待；only入口必须排除旧记录强制执行。产品未因此盲目重写。首轮忙碌退出阻塞仅结束核实owned实例树；随后清理先取消自身任务、正常退出0。
- 文字草稿持久化；未发图片／文件／技能等仅内存缓冲，完整退出不恢复。共享提交锁只覆盖模型文件工具，外部程序／任意Shell无系统级隔离。不把模拟回复、辅助、构建或单截图当整体系统或公网验证。
- 下一轮1.3.7用户新增右键菜单尚未实施；实施前读项目交接，每轮测试前读取本文件。已有OAuth、资料、图片、表格与早期结果按原版本／SHA且未受影响范围复用。
- 恢复可将.lnk指回已有1.3.5EXE（路径／SHA见项目交接），不额外备份旧程序；先从托盘退出旧实例。未动用户真实模型／认证／数据。文档验证release/concurrent-chats-20261025/document-verification.json。

## 1.3.5 辅助、构建与增量审查

| 对象／命令 | 场景、预期及实际结果 | 状态 |
| --- | --- | --- |
| node --test tests/mcp-oauth.test.mjs tests/mcp-store.test.mjs tests/mcp-runtime.test.mjs tests/mcp-context.test.mjs | 初始29项通过27；覆盖OAuth配置／加密／SDK授权／PKCE／issuer资源／刷新／取消及store、工具、资料直接回归。两项测试前置失误，不放宽产品检查 | 27结果有效复用 |
| node --test --test-name-pattern="callback rejects\|expired stored access" tests/mcp-oauth.test.mjs | 原始HTTP真实错误Host／Unicode和重复state／回调重放；一次目录后的并发读取与重启续期脱敏。修正前置后2/2、退出0 | 通过 |
| node --test --test-name-pattern="cancel during delayed token" tests/mcp-oauth.test.mjs | 真实token POST开始后取消，服务迟到签发不保存，窗口清理；1/1、退出0 | 通过 |
| 定向node --check与UTF8回读 | store／oauth／oauth-window／runtime／main／preload／fixture／测试语法通过；实际驱动执行可解析，13文件落盘与基线／候选一致，UTF8无BOM、无异常替换字符，中文对照正常 | 通过 |
| npm run build；electron-builder portable x64 | 1810模块、294许可证；Electron45、npmRebuild=false、signAndEditExecutable=false，输出release/mcp-oauth-20261025；构建退出0。既有大bundle与元数据提示保留 | 通过 |
| 包内／manifest与版本 | 7主进程／直接模块＋3renderer对象共10项逐字节一致；name／version／main／type／dependencies一致，lock结构只两处根版本1.3.5 | 通过 |
| 13文件增量差异审查 | 无Git，以oauthBase本轮首次读取为基线、新增文件此前缺失；检查权限／凭据／URL绑定／取消／队列／旧配置／续期／UI及测试，未发现范围内未解决项，无新依赖 | 通过 |

[辅助记录](../release/mcp-oauth-20261025/targeted-tests.json)、[构建与包核对](../release/mcp-oauth-20261025/build-verification.json)、[增量审查](../release/mcp-oauth-20261025/incremental-review.json)。Node辅助的加密适配器是AES-GCM，不能替代以下真实Windows加密验收。

## 1.3.5 实际EXE：12个有效功能范围

前置：新建独立profile／SCODEX_HOME和受控项目，真实OAuth授权页、动态注册、令牌服务及SDK MCP端点均为两个独立回环端口；另有无DCR的预配置客户端服务。只替代外部模型回复。命令node tests/mcp-oauth-ui.cjs，续验使用SCODEX_OAUTH_FIXTURE与SCODEX_OAUTH_ONLY限定未完成或补充范围。按真实表单→授权窗口→批准／拒绝→连接→目录选择／预览，或对话→逐次审批→真实资源／工具→结果／历史执行。

| 范围 | 操作、预期与实际结果 | 状态 |
| --- | --- | --- |
| 身份／手工登录 | 实际1.3.5与隔离根目录；无token时连接明确提示授权入口，无自动窗口 | 通过 |
| 拒绝／取消／独立窗口 | 真实页面拒绝、主界面取消、关授权窗均停止且无token；require／process／bridge均undefined，新会话无上次localStorage | 通过 |
| DCR／PKCE／state／加密 | 真实动态注册、授权码交换及resource校验；错误state返回400后正常批准；state／origin可见、回调关闭。Windows保存文件无access／refresh或私有头明文，renderer无token | 通过 |
| 手工预览与原生模型 | 真实目录选择／读取O8351；模型list→read→echo，3次实际审批、服务调用及返回结果正确；3成功操作保存、历史无token | 通过 |
| JSON模型 | 显式JSON协议完成同样3次审批和真实资料／工具链路，无登录弹窗；本范围没有额外模型拒绝用例，不据机器ID含denied字样声称测试过 | 通过 |
| 重启续期／轮换 | 等待真实访问token到期、完整退出再启动；配置初始disconnected，手工连接自动刷新、token轮换，无登录窗、3操作历史保留 | 通过 |
| 临时／失效续期恢复 | token服务503时提示临时失败并保留刷新凭据，恢复后重试成功；invalid_grant清除token并提示手工重登，无自动窗口 | 通过 |
| 清除与预配置客户端 | 实际清除断开并删除本机授权、可重新登录；指定公共ID／issuer／已登记回调端口在无DCR服务完成PKCE，0动态注册 | 通过 |
| 配置／项目／退出取消 | 等待授权期间保存配置、真实addProject／selectProject、完整退出均关闭窗口且无旧token写入；重启disconnected | 通过 |
| 双视口／表单／字体 | 1440×900与1080×700页面／卡片／表单无横向溢出；微软雅黑，授权辅助14px、控件有label、按钮可操作、表单纵向滚动 | 通过 |
| 同一候选最终复核 | 同SHA实际程序身份、OAuth与O8351预览、历史3成功操作、无活审批／无token、退出0与端口关闭 | 通过 |
| token交换期间取消 | 真实POST /token送达后取消；服务延迟签发不存入本机，窗口关闭、状态失败，随后手工重新授权成功 | 通过 |

[合并实际报告](../release/mcp-oauth-20261025/mcp-oauth-ui-verification.json)。12范围的SHA相同；报告check记录保留分轮结果，requests只反映最后补验轮次，不能据空数组否定此前已记录的模型验收，也不将其声称为完整原始网络日志。

## 1.3.5 最终入口、视觉和失败恢复

| 范围 | 实际结果及可定位证据 | 状态 |
| --- | --- | --- |
| 快捷方式替换 | 写前hash1B5E883D…与旧目标1.3.4一致；候选SHA核对，仅改TargetPath，写后hash25F0E399…、目录／图标／参数保持。没有额外备份旧EXE | 通过 |
| 替换后真实复核 | 解析.lnk目标，SCODEX_OAUTH_EXE指向该目标，SCODEX_OAUTH_ENTRY=1、ONLY=final-entry运行实际驱动；1.3.5、授权／O8351、3成功历史、无token、退出0和端口关闭 | 通过 |
| 最终截图 | 实际MCP OAuth界面1440×900，人工查看导航／状态／按钮／目录无可见重叠，纵向内容滚动。当前设备、页面、视口和数据状态下无可见错误；CDP renderer截图，不是Windows全屏／原生鼠标验收 | 通过 |
| 辅助前置 | fetch未真实发自定义Host，改原始HTTP；两个helper同时重建目录造成旧目录失效，改共享目录。产品安全检查保持，两项定向通过 | 已修复 |
| 夹具CSP | form-action self挡住跨端口回调，授权窗未关闭；只给受控fixture加入当前回调origin后真实拒绝／批准通过，产品未重写 | 已修复 |
| 预览驱动 | 只列目录未选择资源，无读取按钮；补真实选择与条件化刷新后续验，产品预览保持 | 已修复 |

[快捷方式](../release/mcp-oauth-20261025/shortcut-verification.json)、[替换后复核](../release/mcp-oauth-20261025/post-replacement-verification.json)、[最终界面](../release/mcp-oauth-20261025/mcp-oauth-workbench.png)、[视觉记录](../release/mcp-oauth-20261025/visual-verification.json)、[辅助首次失败](../release/mcp-oauth-20261025/initial-test-failure.json)、[实际窗口首次失败](../release/mcp-oauth-20261025/mcp-oauth-ui-verification.initial.json)、[预览前置失败](../release/mcp-oauth-20261025/mcp-oauth-ui-verification.preview-prerequisite.json)。

## 1.3.5 清理、限制和复测条件

- [清理记录](../release/mcp-oauth-20261025/runtime-cleanup.json)：递归删除被自动审批审查拒绝，只有blocked by policy、无具体解释，没有换工具重试删除。已核对绝对路径／无reparse／无owned进程并安全移动；3633项现存[待手动删除夹具](../手动删除/scodex-oauth-ui-48c653c7-323e-4118-af32-55e4f10755e3)。原C:/Users/Administrator/AppData/Local/Temp/scodex-oauth-ui-48c653c7-323e-4118-af32-55e4f10755e3不存在。首次移动前检查把当前诊断shell算入，排除自身后确认无其他占用。可在资源管理器手动删除，不运行其中程序；旧夹具未触碰，此残留不影响功能验收。
- 测试源码、脱敏证据、正式程序与包核对目录保留。没有常驻测试服务、未擅自结束用户进程、用户默认模型配置／认证／数据保持。恢复使用已有1.3.4 EXE，SHA d0f1c7fd74ef4f86fffe5e8d7e7b1865f5423f9e8825b6ef21faa28de1527e60，不额外创建旧EXE备份；入口目标可按快捷方式记录恢复。
- OAuth仅桌面公共客户端，默认交互5分钟、授权网络15秒、OAuth响应256KB、MCP响应2MB。HTTP只本机回环；公网OAuth账号、具体身份提供方、客户端密钥／mTLS等未验收，不把回环成功称为公网全面兼容。清除本机授权不撤销服务端许可。
- 整体Codex目标仍未完成；旧SSE／在线市场、任意桌面、完整跨任务和生成式图片等缺口保留。本轮没有公网模型请求，不证明Grok服务条件已解决。1.3.4资料、1.3.3图片、1.3.2表格及更早未变结果按原版本／SHA复用。
- 只有相关实现、配置、依赖、环境、输入或验收条件变化才定向复测，文档更新不触发无关程序测试；未来测试新建可用隔离夹具，不运行“手动删除”。四份文档回读、链接、UTF8无BOM验证见release/mcp-oauth-20261025/document-verification.json。

## 1.3.4 辅助、构建及增量审查

| 对象／命令 | 场景、预期与实际结果 | 状态 |
| --- | --- | --- |
| node --test tests/mcp-context.test.mjs tests/mcp-runtime.test.mjs | 9新资料范围＋6既有工具直接回归：真实SDK资源专用服务／分页／模板／提示词／角色数据、二进制与UTF8限制、审批／策略／旧代次、通知、取消／脱敏、认证HTTP、分页异常和缺少可选方法warnings；15/15、退出0 | 通过 |
| 取消提示定向复验 | 修复已aborted的SDK错误中文提示后，仅执行cancel request匹配的1项，退出0；其他14项未变化复用。有效总数仍15 | 通过 |
| 定向CJS语法及UTF8回读 | 新资料模块、runtime、main／preload及UI驱动可解析；15代码／配置／测试文件无BOM和异常替换字符，中文源文回读正常 | 通过 |
| npm run build；electron-builder portable x64 | 1810模块、294许可证；Electron45／npmRebuild=false／signAndEditExecutable=false；同版重建和最终构建退出0。既有大bundle／元数据提示保留 | 通过 |
| 最终包内对象／manifest | 4个Electron模块和3个renderer对象共7项逐字节一致；name/version/main/type/dependencies一致；锁文件仅根version和packages根version变化，无新依赖 | 通过 |
| 15文件增量差异审查 | 无Git，以ctxBase首次读取基线和新增缺失确认区分本轮；审查取消／审批／目录代次／角色数据／脱敏／边界／草稿及回归，修复中文取消和页底旧说明，最终驱动新差异补审，无范围内未解决项 | 通过 |

[辅助记录](../release/mcp-context-20261025/targeted-tests.json)、[构建记录](../release/mcp-context-20261025/build-verification.json)、[增量审查](../release/mcp-context-20261025/incremental-review.json)。辅助结果不替代下列实际程序验收。

## 1.3.4 实际EXE：14个有效功能范围

前置：独立profile／SCODEX_HOME及受控项目，真实SDK资料专用stdio服务和Bearer HTTP服务；只有模型回复替代。命令node tests/mcp-context-ui.cjs，失败恢复用SCODEX_CONTEXT_FIXTURE复用当时夹具，SCODEX_CONTEXT_ONLY限定受影响或未完成范围；资料目录在重启后重新浏览。按插件表单→连接→浏览／参数／预览→草稿显式发送，或对话→逐次审批→真实SDK结果→模型→记录与重启顺序执行。

| 范围 | 预期、实际操作及结果 | 状态 |
| --- | --- | --- |
| 实际身份 | 核对1.3.4和隔离项目根目录；最终候选身份复验 | 通过 |
| 资源专用服务连接 | 实际表单配置stdio和HTTP，仅资源／提示词能力而0工具仍连接；Bearer实际收到，环境和认证落盘加密、无明文回传 | 通过 |
| 手工分页／模板／提示词 | 两页7资源、1模板、1提示词；填写项目甲／md，读取中文及嵌入资源；提示词user／assistant为文本标签，服务日志核对真实参数 | 通过 |
| 有界／错误／取消／通知 | binary仅说明；big不超过48KB、无替换字符且显示截断；失败中文与脱敏；实际停止后SDK日志有cancelled，显示中文停止；notify使旧目录和预览消失 | 通过 |
| 草稿保留与显式发送 | 先输入原有中文草稿，读取并加入资料后原文保留、没有模型请求；点击发送后真实请求含C6142和数据说明，没有把资料放入系统消息 | 通过 |
| 原生模型资料链路 | 当前任务list→模板read→prompt，3次实际UI批准，模型收到真实C6142及中文提示词／嵌入资源，保存3成功操作 | 通过 |
| 拒绝／无效项／待批停止 | 拒绝目录或读取均无后续读取；伪造未发现项不执行；等待读取审批时停止，无活审批、无额外服务读取 | 通过 |
| 动态策略／重连 | 审批中改never或断开重连，再批准被拒，服务读取数不增加，保留中文原因 | 通过 |
| 运行中停止／通知失效 | 实际慢资源开始后停止，SDK取消日志增加；模型读取触发list_changed后旧目录结果被阻止 | 通过 |
| 规划／never | 规划3次审批完成资料读取；never不提供资料工具，伪造list也拒绝且无审批窗口 | 通过 |
| 认证HTTP模型链路 | 3次审批，真实Bearer Streamable HTTP目录→模板读取→提示词，服务参数日志及模型结果一致 | 通过 |
| JSON兼容链路 | 保存连接协议为JSON，真实list→read→prompt，3次审批、结果返回且模型完成 | 通过 |
| 卸载／布局／文字 | 离开页面取消真实慢请求；1440×900／1080×700无页面或资料区横向越界，微软雅黑、辅助至少14px、预览可键盘聚焦／表单有标签；最终规划说明和双视口复核 | 通过 |
| 重启与历史 | 完整退出后stdio PID停止，再启动3成功操作及正文保留；连接全部disconnected、不自动启动、无活审批；最终版本重复该直接受影响范围 | 通过 |

[合并报告](../release/mcp-context-20261025/mcp-context-ui-verification.json)。2范围保留初始c67ea492…，10范围保留95514ec3…，最终身份／历史和独立文案布局为当前正式SHA；最终后端与前一候选一致，只有页底文案改变renderer。报告不将全部旧结果冒充最终二进制全量重跑。

## 1.3.4 最终入口、截图和失败恢复

| 范围 | 实际结果／证据 | 状态 |
| --- | --- | --- |
| 旧入口替换 | 写前核对旧.lnk SHA674D6671…及旧目标1.3.3，候选SHA核对后只改TargetPath；写后目标1.3.4、目录／图标／参数一致，新.lnk SHA1B5E883D452D9F63854FFAF43125427527EF31BDDD2C1731D21DC115D8F5EA5D | 通过 |
| 最终入口真实复核 | node tests/mcp-context-entry-ui.cjs按解析后的快捷方式目标启动，版本1.3.4、3成功历史操作、真实stdio连接／目录／C6142预览、无活审批、退出0及端口关闭 | 通过 |
| 最终视觉 | 正式入口实际资源预览1440×900，预览top485.71875／bottom566.09375，等待绘制后截图并独立查看；当前设备、页面、视口和数据状态下无可见错误。CDP renderer截图，不是Windows全屏／原生鼠标验收 | 通过 |
| 初次取消提示失败 | 服务取消已送达，但SDK错误进入catch绕过中文提示；只在已aborted时归一停止／超时，再加强辅助断言和实际EXE复验，未删除断言或降低要求 | 已修复 |
| 续验前置遗漏 | 驱动跳过上个目录范围后，重启组件按预期为空，报Missing catalog item binary；补条件化浏览目录，不重写产品或无变化重复原测试 | 已修复 |
| 文案／截图驱动 | 审查补规划资料规则，同版重建后仅复验受影响UI及身份／历史；截图原未等待绘制，补可见预览检查和两帧等待，未改产品布局 | 通过 |

[快捷方式记录](../release/mcp-context-20261025/shortcut-verification.json)、[替换后复核](../release/mcp-context-20261025/post-replacement-verification.json)、[最终截图](../release/mcp-context-20261025/mcp-context-browser.png)、[视觉结论](../release/mcp-context-20261025/visual-verification.json)、[初次失败](../release/mcp-context-20261025/mcp-context-ui-verification.initial.json)、[驱动前置失败](../release/mcp-context-20261025/mcp-context-ui-verification.resume-prerequisite.json)、[文案修正前通过记录](../release/mcp-context-20261025/mcp-context-ui-verification.before-copy.json)。

## 1.3.4 清理、限制与复测条件

- [清理记录](../release/mcp-context-20261025/runtime-cleanup.json)：原C:/Users/Administrator/AppData/Local/Temp/scodex-context-ui-1a25a731-759e-4809-bfa6-a6ce8bbbb7c9不存在，3635项已实际移到[待手动删除夹具](../手动删除/scodex-context-ui-1a25a731-759e-4809-bfa6-a6ce8bbbb7c9)，owned主进程和stdio进程0。沿用此前递归删除被审批拒绝后的安全移动方案，本轮未重试递归删除；资源管理器可手动删除，不运行其中程序。旧夹具未触碰，此残留不影响功能。
- 测试源码、脱敏证据、正式包和包内复核目录保留；无常驻服务、未强制结束用户程序、未覆盖用户默认模型配置或数据，没有额外旧EXE备份。恢复沿用既有1.3.3程序，SHA151e0eeaef7aea24b09aa55615315830d1fee0ba584d604110d8d2e3f818006b。
- 目录每类8页、总96项／128KB；参数16项、单值4096字符／总16KB，文本48KB／40段；二进制只说明，不自动跟随链接；单请求15秒／整操作20秒。服务返回内容仅作数据，提示词角色不升级为系统／开发者指令。
- OAuth、旧SSE、在线市场、任意桌面、完整跨任务和生成式图片等尚未实现或验收，整体Codex目标仍未完成。本轮未调用公网模型，不证明Grok服务条件已解决。现有1.3.3图片／1.3.2表格及更早未变化结果按原版本、SHA和范围复用。
- 只有相关实现、配置、环境、输入或验收标准变化才定向复验，文档更新不触发无关代码测试；未来须新建可用隔离夹具。四份文档落盘回读、链接、UTF8和无BOM结果见release/mcp-context-20261025/document-verification.json。

## 1.3.3 辅助与构建

| 对象／命令 | 场景、预期及实际结果 | 状态 |
| --- | --- | --- |
| node --test tests/image-tools.test.mjs tests/browser-tools.test.mjs tests/agent-runtime.test.mjs | 26项：7图片头部／尺寸／参数、审批／消息／保存、dirty／目标未读／源冲突、拒绝／取消／策略变化、规划／never／路径／凭据与处理器失败、原生／JSON图片消息顺序；7浏览器和12执行器直接回归 | 通过 |
| node --check image-tools／image-processor／main及两个CJS驱动 | 可解析；修改源文件UTF8无BOM、可读中文和无异常替换字符另经回读核对 | 通过 |
| npm run build；electron-builder portable x64 | 1809模块、294许可证，最终renderer index-CoA5PthL.js；Electron45／npmRebuild=false／signAndEditExecutable=false，构建退出0；既有大bundle提示保留 | 通过 |
| 包内对象与manifest | 4个Electron模块及3个renderer对象共7项逐字节一致；name／version／main／type／dependencies一致。锁文件仅两处根版本变为1.3.3，无依赖升级 | 通过 |

[辅助记录](../release/image-runtime-20261025/targeted-tests.json)、[构建记录](../release/image-runtime-20261025/build-verification.json)。图片辅助采用桩processor，不替代以下真实Canvas验收。

## 1.3.3 实际EXE：17个有效范围

前置：独立profile／SCODEX_HOME、受控项目与真实RGBA PNG、4色图、透明图，回环模型提供原生／JSON动作。命令node tests/image-workflow-ui.cjs；后续用SCODEX_IMAGE_FIXTURE和SCODEX_IMAGE_ONLY只续验受影响／未完成范围。原生UI使用SCODEX_NATIVE_PWSH指向本机既有pwsh。按真实界面提交→审批→工具→模型图片证据→保存→重新读取的顺序执行。

| 范围 | 预期与实际结果 | 状态 |
| --- | --- | --- |
| 身份 | 实际启动核对1.3.3与隔离项目路径，最终包复核 | 通过 |
| 原生读改读／像素 | 逐次3审批；裁剪120×80→旋转90→缩放40×60→亮度50→文字AI，保存后磁盘PNG回读；指定像素[120,10,10,255]、120个文字变化像素，源图字节保持；模型收到3张真实image_url | 通过 |
| 记录入口／后台刷新 | 从实际记录打开图片；模型覆盖干净已打开刷新.png后，编辑器自动显示90×50且无dirty | 通过 |
| 发送前dirty／重置 | 手动亮度120后，模型读取获准但覆盖被拒，磁盘保持、手工值保留；重置后干净 | 通过 |
| 拒绝读取／保存 | 读图拒绝后不发送图片证据；编辑拒绝后无文件创建 | 通过 |
| 停止 | 读图获准后等待编辑审批时停止，无目标文件、无活审批 | 通过 |
| 源／目标外部冲突 | 审批期间外部改源或已有目标，批准后工具拒绝覆盖，外部字节保留 | 通过 |
| 审批期间dirty | 编辑审批期间在真实图片页手工改亮度130，再批准被拒，手工值保留，无输出 | 通过 |
| 审批期间策略 | 预览后改never再批准，操作被阻止，无输出；随后恢复策略 | 通过 |
| 规划／never | 规划可以逐次批准读图，没有编辑工具，伪造编辑也拒绝；never没有图片工具，伪造读取被拒 | 通过 |
| 真实处理器错误 | 越界裁剪在固定Canvas实际拒绝，中文原因可见且无文件保存 | 通过 |
| JPEG透明区 | 将透明PNG编辑保存为32×32 JPEG，真实图片页像素[255,255,255,255]，格式与尺寸正确 | 通过 |
| JSON翻转读改读 | JSON原生图片证据3张、3成功操作；水平和垂直翻转后输出上下角颜色分别[240,220,20,255]／[240,20,20,255] | 通过 |
| 手动裁剪／原生退出／导出 | 实际裁剪80×50标dirty、重置回240×160；亮度50，原生退出提示含“图片”，点继续编辑后dirty保留；实际另存为PNG，磁盘像素[120,10,10,255]，自动重载导出文件为干净基线 | 通过 |
| AI入口／双视口 | 1440×900、1080×700无页面横向越界，按钮在视口内、微软雅黑及说明至少14px；AI按钮开启执行任务并预填当前图片路径；最终截图独立视觉核对 | 通过 |
| 项目切换未完成加载 | 仅延迟真实解码后的onload回调，实际切换项目后释放；旧图不进入新项目。文件读取、解码和项目UI真实执行，不能称为未替代时序的全系统并发验收 | 通过 |
| 重启历史 | 完整退出再启动，3条操作和3个缩略图保留，无活审批，历史可打开实际图片 | 通过 |

[合并报告](../release/image-runtime-20261025/image-ui-verification.json)、[实际输出清单](../release/image-runtime-20261025/pixel-evidence.json)、[最终截图](../release/image-runtime-20261025/image-workbench.png)、[视觉结论](../release/image-runtime-20261025/visual-verification.json)。截图结论限定为：当前设备、页面、视口和数据状态下无可见错误。CDP驱动真实renderer，不能称为Windows全屏或任意桌面鼠标键盘验收。

## 1.3.3 失败恢复、审查与正式替换

| 失败及根因 | 恢复与证据 |
| --- | --- |
| brightness仅有label／id，驱动只查aria-label；Windows asar使用斜杠路径 | 只补驱动id定位和标准路径；[初始报告](../release/image-runtime-20261025/image-ui-verification.initial.json)，产品不因此重写 |
| 原生另存为／退出位于owned窗口后代；保存列表项和按钮同号；PowerShell5误读UTF8且将保存按钮报告Pane，当前pwsh报告Button | 分别核对可见状态后，助手使用后代、唯一名称／类型／id、显式UTF8及既有pwsh；[首个原生失败](../release/image-runtime-20261025/image-ui-verification.pre-native-fix.json)、[编码](../release/image-runtime-20261025/image-ui-verification.powershell-encoding.json)、[控件同号](../release/image-runtime-20261025/image-ui-verification.native-id-collision.json)、[条件](../release/image-runtime-20261025/image-ui-verification.native-condition.json)、[provider诊断](../release/image-runtime-20261025/image-ui-verification.native-provider.json)。失败实例均按owned PID确认退出，没有强制结束用户程序 |
| 空图片编辑器加载期间切项目，stamp不变且reset未使token失效，旧图串入新项目 | [真实竞态原失败](../release/image-runtime-20261025/image-ui-verification.project-load-race.json)；reset递增token后最终EXE定向通过。未修改处理器或降低断言 |

- [15文件增量审查](../release/image-runtime-20261025/incremental-review.json)：以picBase首次读取内容为基线，代码／配置／驱动的hash和新增文件可追溯；只审本轮差异和修复直接影响。主进程退出提示补图片；静态和实际UI／文件安全边界已核对，无范围内未解决项。
- [快捷方式](../release/image-runtime-20261025/shortcut-verification.json)：写前核对旧hash1F243787…及候选SHA，写后目录、图标、空参数一致，新快捷方式SHA674D6671CF5DFC15973F50AD78061BEA7D8E09DADE45D2F31E188B7A82271039；没有额外旧EXE备份。
- node tests/image-entry-ui.cjs按解析后的最终程序路径实际启动，1.3.3、3条保存操作、40×60输出图片查看、无活审批、退出0、调试端口关闭，[最终入口复核](../release/image-runtime-20261025/post-replacement-verification.json)通过。
- 恢复沿用已有release/spreadsheet-runtime-20261025/Scodex-Workbench-1.3.2-x64.exe，SHA52d81428d81b0262167d41011cd016af728e82eddd1ed7bf3c641178800d4172；不覆盖用户数据和模型配置。

## 1.3.3 清理、限制与复测条件

- [清理记录](../release/image-runtime-20261025/runtime-cleanup.json)：原C:/Users/Administrator/AppData/Local/Temp/scodex-image-ui-8c2e1f3e-71e0-4adf-ae63-284788d22e42已不存在；3641项实际移动到[待手动删除夹具](../手动删除/scodex-image-ui-8c2e1f3e-71e0-4adf-ae63-284788d22e42)，owned进程0。沿用本项目之前递归删除被审批拒绝后的安全移动方案，本轮未重新尝试删除；可在资源管理器删除，不要运行其中程序。该残留不影响已通过功能。
- 保留源码、脱敏证据、4张真实输出、正式产物与包复核目录，无常驻测试服务；没有额外旧EXE备份。后续测试必须准备可用夹具，不运行“手动删除”中的程序。
- 图片输入PNG／JPEG／静态WebP；8MB／2000万像素／单边10000，每批1–12操作，输出PNG／JPEG最多8MB。预览最长边1280、缩略图320；支持真实视觉的模型才可解释图片。本轮是确定性编辑，没有生成式重绘，也没有验证全部图片编码或公网模型。
- 整体Codex对齐仍未完成：任意桌面、部分MCP、跨任务、完整办公和生成式图片链路仍有缺口。1.3.2表格及更早未变范围按原版本／SHA复用；没有重复公网请求，不证明Grok工具服务条件已解决。
- 只有相关实现、配置、环境、输入或验收条件变化才定向复测；文档更新不触发无关程序测试。四份文档最终落盘回读、链接、UTF8无BOM结果见release/image-runtime-20261025/document-verification.json。

## 1.3.2 辅助与构建

| 检查对象／命令 | 场景、预期与实际结果 | 状态 |
| --- | --- | --- |
| node --test tests/spreadsheet-tools.test.mjs tests/csv.test.mjs | 6表格＋6CSV有效通过：真实XLSX新建／修改／读回、公式与格式／其他表保留、UTF8／BOM／quotes／newlines／原始等号值；hash／dirty／审批期间外部修改；规划／never／拒绝／取消／策略变化；路径／junction／范围／图片保护 | 通过 |
| 受影响表格测试定向复验 | 首轮10/12，ExcelJS默认styles扩展误判；精确放行后5/6，剩余为测试错误假定读取器解析重算标记；实际XML已有fullCalcOnLoad=1。改核验落盘XML，最后只复验该1项通过。有效总数12，不重复累计 | 通过 |
| node --check electron/spreadsheet-tools.cjs、electron/main.cjs及两UI驱动 | 受影响CJS语法、UTF8无BOM及中文源文回读正常；不单凭语法代替功能验收 | 通过 |
| npm run build；electron-builder portable x64 | 沿用本机Electron45／npmRebuild=false／signAndEditExecutable=false；1809模块、294许可证；最终包退出0，既有chunk-size提示保留，无新增依赖 | 通过 |
| 包内与manifest | 4个Electron模块／共享CSV及3个renderer对象，共7项逐字节一致；name／version／main／type／dependencies一致；EXE SHA与验收对象一致 | 通过 |

[辅助记录](../release/spreadsheet-runtime-20261025/targeted-tests.json)、[构建记录](../release/spreadsheet-runtime-20261025/build-verification.json)。辅助验证不替代下列实际EXE结果。

## 1.3.2 实际EXE：15个有效范围

前置：新建受控项目、独立profile及SCODEX_HOME、回环模型；seed真实XLSX含公式／字体／填充／额外工作表，CSV含中文，复杂工作簿含图片。执行node tests/spreadsheet-workflow-ui.cjs；失败后复用SCODEX_SHEET_FIXTURE且SCODEX_SHEET_ONLY只续验受影响／未完成项。模型给出真实工具动作，用户界面提交／审批后执行，保存后从磁盘重新读取核对。

| 范围 | 操作、预期与实际结果 | 状态 |
| --- | --- | --- |
| 身份 | 实际启动核对1.3.2与隔离项目；最终包身份复验通过 | 通过 |
| 原生XLSX读改读 | 读取SHA／AGENTS→预览批准→写值15、SUM公式／0.00格式／加粗／中文、新增汇总→重读；磁盘公式、填充及未改表保留；公式明确未计算 | 通过 |
| 记录入口与自动刷新 | 从实际记录打开表格看到B2=15；新对话模型修改后，原来干净的表格自动显示“后台刷新完成”，无dirty | 通过 |
| 未保存与手动保存 | 实际A1手工编辑后模型覆盖被拒；UI内容保留、磁盘不变；点击保存后磁盘再读一致 | 通过 |
| 拒绝 | 显示CSV目标和修改预览后点拒绝，原字节保持 | 通过 |
| 停止 | 等待新建表格审批时点击停止，无文件创建、无活审批 | 通过 |
| 审批期间外部变化 | 批准前从外部改CSV；工具拒绝，外部新内容保留 | 通过 |
| 审批期间dirty | 预览期间进入表格手工改A1，再批准；工具拒绝，手工编辑保留，后续手工保存可回读 | 通过 |
| 审批期间策略 | 预览期间改为never再批准，修改被阻止、原数据保留；随后恢复 | 通过 |
| 规划与never | 真实规划菜单／设置下无修改工具；受控模型伪造调用也被拒，没有越权文件 | 通过 |
| 复杂工作簿 | 读取含图片工作簿后尝试修改被拒，整个原文件字节一致 | 通过 |
| 新建工作簿 | 预览批准后创建XLSX，再由工具和磁盘重新读取中文值 | 通过 |
| JSON兼容CSV | 切完整连接协议为JSON后读→批量改→再读；中文逗号／换行／引号与=1+1原始值保存一致，3成功操作 | 通过 |
| AI入口与布局 | 1440×900／1080×700实际检查：无页面横向越界、微软雅黑／单元格和说明至少14px；AI入口打开执行任务并预填文件；24px说明间距修正后最终1440×900截图独立视觉核对 | 通过 |
| 重启及历史 | 从完整最近页选较早对话，完整退出重启，3操作及保存回答保留，无活审批，历史按钮打开实际表格 | 通过 |

[合并报告](../release/spreadsheet-runtime-20261025/spreadsheet-ui-verification.json)、[最终截图](../release/spreadsheet-runtime-20261025/spreadsheet-workbench.png)、[视觉记录](../release/spreadsheet-runtime-20261025/visual-verification.json)。截图结论仅为当前设备、页面、视口和数据状态下无可见错误，不代表整个系统绝对无错；CDP驱动真实renderer，不声称Windows全屏或原生鼠标验收。

## 1.3.2 失败恢复、审查与正式替换

- 默认样式误判与重算断言的根因、命令和修复边界记录在[辅助失败](../release/spreadsheet-runtime-20261025/initial-failure.json)，不删断言、不用模拟替代真实文件。
- [初次EXE报告](../release/spreadsheet-runtime-20261025/spreadsheet-ui-verification.initial.json)：身份和原生XLSX通过，记录入口因ChatMessage仍绑定文本回调失败；修正唯一回调后实际入口、后台刷新及其他范围通过。
- [入口修正阶段](../release/spreadsheet-runtime-20261025/spreadsheet-ui-verification.entry-fixed.json)：14项有效，历史驱动只查侧栏12条，较早对话实际已保存。改走完整最近页后通过；不重写存储。1440×900新增说明x299与标题x323不齐，修正24px边距后只复验身份、布局、历史。
- [增量审查](../release/spreadsheet-runtime-20261025/incremental-review.json)：15个代码／配置／测试文件，以读取前内容及哈希为基线，只审本次差异和后续修复。锁文件结构比较仅根版本变化；CSV共享迁移保持原实现，差异与编码可追溯；没有全仓库扫描或范围外修改。
- [快捷方式](../release/spreadsheet-runtime-20261025/shortcut-verification.json)：写前核对原hashC8418CD3…和目标EXE SHA，写后目标／目录／图标／参数一致；只更新目标，不创建旧EXE备份。
- node tests/spreadsheet-entry-ui.cjs按快捷方式解析的最终路径实际启动，仅使用隔离profile：版本1.3.2、3保存操作、B2=15、无活审批、正常退出0、调试端口关闭，[替换后最小复核](../release/spreadsheet-runtime-20261025/post-replacement-verification.json)通过。
- 恢复用既有release/conversation-layout-20261025/Scodex-Workbench-1.3.1-x64.exe，SHA40be312270ed7dbef4a966b54280750d9b8556ede5a62af6cb6ef3f9cf3eb622；不覆盖用户数据或强制结束用户原实例。

## 1.3.2 清理、边界及复测条件

- 自动审批拒绝递归删除（blocked by policy），未执行删除；按规则安全移动3638项夹具，原C:/Users/Administrator/AppData/Local/Temp/scodex-sheet-ui-5b640fe7-8ad4-4523-88c7-445afc46c414已不存在，现为[待手动删除夹具](../手动删除/scodex-sheet-ui-5b640fe7-8ad4-4523-88c7-445afc46c414)。确认隔离进程0；可在资源管理器删除此目录。详情见[清理记录](../release/spreadsheet-runtime-20261025/runtime-cleanup.json)。该残留不影响已通过功能。
- 保留源码、证据、正式产物与包复核目录；没有常驻测试服务。隔离配置只含受控凭据，用户默认连接与数据保持；未来复测需准备可用夹具，不能运行“手动删除”中的程序。
- 表格上限8MB／解压32MB／32表／20000行／256列／总20万格；每读2000格，每批50操作／1000格。没有公式计算引擎或任意复杂工作簿无损承诺；图片／图表／表对象／保护／条件格式／未知扩展拒绝覆盖。
- 本轮没有公网模型请求，Grok兼容性与全部外部服务未验证；既有deepseek真实链路按其原SHA复用。任意桌面、部分MCP、跨任务及图片AI等整体缺口未解决。
- 只有受影响代码、环境、输入或验收条件变化才复测；文档更新不触发无关代码测试。四份文档最终回读、链接、UTF8无BOM结果见release/spreadsheet-runtime-20261025/document-verification.json。
- 1.3.1及更早未变结果如下，保持各自真实版本与范围，不冒充1.3.2全量重跑。

## 1.3.1 辅助验证与构建

| 检查对象／命令 | 场景、预期和实际结果 | 状态 |
| --- | --- | --- |
| node --test tests/message-presentation.test.mjs tests/conversations.test.mjs | 19 项：10 新增／9 历史直接回归；实际计时与固定时长、7天边界／非法值、未知旧时长、列表／嵌套／表格、流式围栏、HTML文本／危险链接、历史保存及中断；实际符合预期 | 通过 |
| node --check electron/conversations.cjs | 新历史字段可解析；UTF-8 无 BOM 及中文回读另行核对 | 通过 |
| node --check tests/conversation-layout-ui.cjs | 驱动可解析；最后标题兼容修正由实际入口选择复验覆盖 | 通过 |
| npm run build | 1808 模块与 294 项许可证，renderer index-DuRI30_j.js／index-CaWBvGbG.css；既有 chunk-size 提示保留 | 通过 |
| electron-builder portable x64 | 沿用本机 Electron45、npmRebuild=false、signAndEditExecutable=false；最终 1.3.1 退出 0 | 通过 |
| 包内一致性与版本 | 6 个 Electron 模块／脚本、3 个 renderer 对象逐字节一致；运行 manifest 的 name/version/main/type/dependencies 一致；Node/Python/pip 资源大小匹配；最终 EXE SHA 与验收相同 | 通过 |

辅助检查不替代下面实际程序验收。[辅助记录](../release/conversation-layout-20261025/targeted-tests.json)、[构建记录](../release/conversation-layout-20261025/build-verification.json)。

## 1.3.1 实际 EXE：回复区 10 个范围

命令：设置 SCODEX_LAYOUT_FIXTURE 为当时的隔离夹具后执行 node tests/conversation-layout-ui.cjs。失败后通过 SCODEX_LAYOUT_ONLY 仅续验未完成／直接受影响的范围，已过结果按 SHA 复用；不是全量重复累计。启动前核对测试交接，使用受控模型、现有项目及保存历史，按真实表单和对话→审批→结果→重启顺序执行。

| 范围 | 实际操作、预期及结果 | 状态 |
| --- | --- | --- |
| 身份 | 实际 EXE 启动后核对 1.3.1 与隔离项目根目录 | 通过 |
| 工作流、计时及紧凑排版 | 计划→读→改→搜→服务列表→目录→命令→计划，共8成功操作；等待审批计时，最终1887ms；正文在记录前，编号3项、强调、行内代码、无大卡边框、计划与1文件摘要；磁盘回读匹配 | 通过 |
| 键盘、输出及差异 | 实际收到 CDP keydown/keypress/keyup，Enter 展开旧操作与命令；中文输出42和退出码0；展开差异及2步完成计划，从记录打开实际编辑器 | 通过 |
| 安全文字、代码复制与保存 | 标题／引用／表格实际标签；HTML仅文本、无危险节点、链接仅HTTPS；复制内容精确匹配并恢复原剪贴板；放入实际编辑器保存受控文件后回读，夹具恢复 | 通过 |
| 模型错误与重试 | 真实HTTP503呈现失败和时长；点击重试后成功，新的1207ms保存，旧错误消失 | 通过 |
| 命令失败 | 实际命令退出7，紧凑行明确失败，展开中文错误与真实退出码，不伪装完成 | 通过 |
| 停止 | 流式回复中实际停止；最终1513ms／stoppedAfter=1，等待后时长固定，保留停止说明与重试入口 | 通过 |
| 重启与旧历史 | 完整退出再启动后1887ms与8操作保留、不恢复活审批；既有旧历史显示有依据的“操作耗时”标签 | 通过 |
| 服务入口 | 从 service_list 记录展开“查看运行与预览”，真实面板／标签出现，再关闭；驱动标题兼容修正后仅该路径复验 | 通过 |
| 双视口与主题 | 1440×900／1080×700，深浅色；无页面或操作行横向越界，微软雅黑正文16px／辅助14px，紧凑行32.39px；最终浅色1440×900截图独立视觉核对 | 通过 |

[合并报告](../release/conversation-layout-20261025/conversation-ui-verification.json)、[最终截图](../release/conversation-layout-20261025/conversation-layout.png)、[视觉核验](../release/conversation-layout-20261025/visual-verification.json)、[替换后最小复核](../release/conversation-layout-20261025/post-replacement-verification.json)。截图结论限定为：当前设备、页面、视口和数据状态下无可见错误；不代表整个系统绝对无错。

## 服务阶段有效验证（候选 1.4.0）

- 候选：release/dev-services-20261025/Scodex-Workbench-1.4.0-x64.exe；最终服务候选 SHA b5ea2f0a541a66cb9d2a80ae953f5ac25faccdf02ae353fef72ae59db8eb17f6，首包个别项保留各自真实 SHA。
- 8 个辅助用例覆盖实际进程、项目与目录边界、端口、就绪、日志边界及清理。对应运行时代码在最终包未变且匹配，结果继续有效。
- 14 个实际 EXE 范围：脚本选择；手动启停／日志／预览；端口占用／退出7；项目／对话保护；原生模型工具；拒绝／审批期间策略变化；规划／never；取消；JSON工具；双视口；切项目；托盘保留与恢复；完整退出后停止及重启不自启；异常主进程终止后观察清理。
- 真实 catbee／deepseek-v4.1-flash 实际调用 service_start→service_logs→service_list→service_stop，两次审批，HTTP200、S93003日志及回答一致，服务确实停止；测试凭据替换，EXE退出0。仅该核心链路通过；其后的旧截图助手失败仍单列 not-verified。本版服务详情入口另行通过，不重复发公网请求。
- [14范围报告](../release/dev-services-20261025/services-ui-verification.json)、[真实链路](../release/dev-services-20261025/live-services-verification.json)、[8项辅助](../release/dev-services-20261025/targeted-tests.json)、[服务阶段补充审查](../release/dev-services-20261025/incremental-review.json)。

## 失败证据与定向恢复

| 失败及边界 | 处理与有效证据 |
| --- | --- |
| 两次源码生成工具模板解析失败，未执行写入 | JSON编码字面量写入后成功；未伪造产品结果 |
| PowerShell内联Node -e引号丢失，实际退出1 | 改受控独立.cjs脚本，真实命令0／7通过；conversation-ui-verification.initial.json |
| Enter助手无字符／焦点，details未展开 | 核对受信任键盘事件，补Enter字符／焦点与等待后通过；keyboard-initial.json保留 |
| SCODEX标识误触发code模式，活动文件上下文原生确认阻塞 | 按测试PID确认取消；旧实例完整退出确认后关闭；改标识及测试busy前置条件，保留context-prompt／startup-precondition报告 |
| 停止及选择对话后读早于debounce保存 | 磁盘终态正确，分别等待stoppedAfter及已保存activeId；cancel-save-race／selection-save-race报告保留 |
| 验收驱动旧标题常量 | 审查修为按workflowId读取标题，实际选择／服务入口定向复验通过 |
| 服务退出助手旧UIA路径未找到窗口 | 按PID枚举Win32原生确认控件后实际通过；原quit-helper报告保留 |
| 首次真实服务在REPL后台上下文启动即退出0 | 正常exec环境诊断同命令ready，具体REPL原因未完全定位；改标准exec启动后真实核心链路通过；initial／live-command-diagnostic保留 |
| 真实服务核心通过后的旧capturePanel助手入口缺失 | 历史presentationCapture仍not-verified；本版真实操作详情打开面板独立通过，不伪称历史截图成功 |

上述报告位于对应 release/conversation-layout-20261025 或 release/dev-services-20261025；未改正常产品逻辑或降低断言来补作通过。

## 审查、交付与清理

- [本轮11文件增量审查](../release/conversation-layout-20261025/incremental-review.json)：以写入前chatBase为基线，新文件审新增代码；正确性、错误状态、历史、文本安全、可访问性与直接依赖均核对。服务阶段17文件审查修正新文件基线，并补审原生退出／托盘驱动及真实中转驱动；未扩成全仓库审查。
- package和lock仅应用根版本改为1.3.1，无依赖升级；最终包NotSigned。快捷方式写前核对旧哈希、写后读取目标／目录／图标／空参数与目标SHA，[入口记录](../release/conversation-layout-20261025/shortcut-verification.json)通过。
- 替换后实际启动解析的最终目标并验证保存回复、展开命令和退出0；程序、有限验收和测试服务器均已结束，未强制退出用户原实例。
- 保留已有1.3.0正式release供恢复，无额外旧EXE备份；回滚目标与SHA见项目交接及快捷方式记录，不覆盖用户数据。
- 自动删除命令被审批拒绝，仅返回blocked by policy，未执行删除。随后安全移动通过：原 C:/Users/Administrator/AppData/Local/Temp/scodex-dev-services-ui-48660d37-0dc5-4b04-a475-bfa3482e6582 不存在；现存 [待手动删除夹具](../手动删除/scodex-dev-services-ui-48660d37-0dc5-4b04-a475-bfa3482e6582)。已确认本轮持有进程0，可在资源管理器删除；废弃便携提取目录已不存在。
- [清理记录](../release/conversation-layout-20261025/runtime-cleanup.json)记录原路径、现存路径和原因；保留测试源码／脱敏证据／交接／正式产物与包复核目录。临时残留不影响已通过功能。
- 四份说明与交接的最终回读、链接、UTF-8无BOM和格式结果写入 release/conversation-layout-20261025/document-verification.json；文档更新不触发代码重测。

## 未覆盖、限制与复测条件

- 完整Codex对齐尚未完成：任意桌面操控、部分MCP资源／提示词／OAuth、跨任务及全部办公／图片AI链路仍有缺口。
- 服务命令用当前Windows账号；进程树清理并非权限沙箱。全部网站、模型或外部账号的工具兼容性不由本轮结果保证，原Grok工具HTTP426条件保留。
- 页面工具仍限顶层文档和视口引用，原生WebContentsView不包含在主renderer截图中；不存在Windows全屏或原生鼠标输入通过结论。
- 只有相关实现、配置、依赖、输入或验收条件变化才复测直接范围；因夹具已清理／移动，后续先准备满足当前路径与版本的受控环境，不运行“手动删除”中的程序。
- 未变1.3.0浏览器、1.2.0MCP、1.1.0项目工具等结果如下，按各自真实版本复用，不冒充1.3.1全量重跑。

## 1.3.0 定向辅助验证

| 对象／命令 | 场景与预期／实际结果 | 状态 |
| --- | --- | --- |
| node --test tests/browser-tools.test.mjs | 7 项：默认关闭／never／规划目录、参数与固定脚本转义、拒绝／取消／策略变化、陈旧审批目标、原生与 JSON 图片消息顺序、缩略图边界；实际符合预期 | 通过 |
| node --test tests/agent-runtime.test.mjs | 12 项直接回归，流式完整性、原生／兼容、失败、取消和实际结果反馈仍有效 | 通过 |
| node --test tests/conversations.test.mjs | 9 项直接回归，模式／项目／附件与历史规范化符合预期 | 通过 |
| 7 个受影响 CJS 语法及两个 UI 驱动语法 | 可解析，未发现写入截断或错误转义；UTF-8 无 BOM 和可读中文另经回读核对 | 通过 |
| npm run build | 294 项许可证保持一致，Vite 1805 模块生成当前 renderer；既有 chunk-size 提示保留 | 通过 |

首轮共 28 项；修复 DOM 异常传播后复验新 7 项，不重复累计。辅助检查不能替代下面实际程序验收。

## 1.3.0 实际 EXE 验收

执行 node tests/browser-workflow-ui.cjs。首轮完成前五范围；修复 DOM 异常信息后，按 SCODEX_BROWSER_FIXTURE 复用原隔离数据，并用 SCODEX_BROWSER_ONLY 仅运行剩余或受影响范围。失败驱动步骤按证据修正后只续测未完成项。

| 范围 | 实际步骤、预期与结果 | 状态 |
| --- | --- | --- |
| 身份与默认关闭 | 启动便携 EXE 核对 1.3.0；AI 默认关闭时执行请求无 browser 工具 | 通过 |
| 设置保存 | 从真实设置 → 浏览器开关开启；API 和磁盘均回读为 true | 通过 |
| 完整网页闭环 | 打开 → 读取 → 中文填入 → 再读 → 点击 → 再读 → 发送 Enter → 截图 → 滚动 → 再读；真实 POST 和按键记录、JPEG image_url 及 scroll_y 符合预期 | 通过 |
| 拒绝 | 实际审批显示保存目标后拒绝；网页记录数不增加 | 通过 |
| 审批期间导航 | 等待点击审批时由用户导航，再批准旧操作；代次保护拒绝，无额外提交 | 通过 |
| 元素变化 | 点击审批期间修改真实页面按钮文本，再批准；目标指纹拒绝并显示具体中文原因，无额外提交 | 通过 |
| 敏感字段与所有权 | snapshot 不含密码、隐藏和 token 字段值；新对话引用前一对话 AI 标签被拒；远程页面无 scodex／require 桥，未继承手工 session cookie | 通过 |
| 停止 | 允许 slow 网页加载后点停止；实际 HTTP 连接关闭，后续网页请求未发生 | 通过 |
| 规划 | 实际计划模式不开放点击／填入／按键，仍可经审批打开与读取 | 通过 |
| 对话与 never | 普通对话和禁止审批策略请求无浏览器工具 | 通过 |
| 网络和重定向 | 外部拒绝域名在审批前被阻止；已批准页面重定向到禁止主机，目标 HTTP 请求未发生 | 通过 |
| 关闭工具 | 实际调用 browser_close，当前对话标签关闭 | 通过 |
| JSON 通道 | 完整受控模型配置切为 JSON；网页填入、提交、按键及图片反馈真实完成，再恢复原生通道 | 通过 |
| 公网搜索 | 批准 browser_search，实际加载 Bing 的编码查询 URL，最终无页面错误；不将其写成所有搜索结果均已阅读 | 通过 |
| 布局与字体 | 1440×900、1080×700，设置无页面横向越界；微软雅黑 16px，开关有可访问名称 | 通过 |
| 项目切换 | 真实创建项目表单完成切换，AI 标签全部关闭，原手工标签保留 | 通过 |
| 重启与历史 | 实际完整退出再启动，保留截图记录，不恢复活审批或 AI session | 通过 |

[合并报告](../release/browser-runtime-20261024/browser-ui-verification.json)保留每项原始构建 SHA。前五范围在功能包完成；后续仅修改 browser-dom／panel-browser 的异常传播，当前包完成其余范围及真实模型链路。没有把全部用例宣称为最终二进制重新全跑。

## 1.3.0 新密钥与真实模型

- /v1/models：HTTP 200，11 个模型，没有 Grok；deepseek-v4.1-flash 普通对话 200，原生 echo 1 操作／2 轮真实往返成功，见[密钥能力探测](../release/browser-runtime-20261024/relay-key-probe.json)。
- 实际运行 node tests/browser-relay-ui.cjs，密钥从标准输入接收，目标仍是上述 1.3.0 EXE。使用既有隔离 profile 和项目，临时配置经系统加密；结束后换回受控占位连接，磁盘无密钥明文，未替换用户现有默认连接。

| 实际链路 | 预期与实际结果 | 状态 |
| --- | --- | --- |
| 文件读改读 | 真实模型 read_file → edit_file → read_file → write_file → read_file；最终只有“中转站实际工具往返成功”一行，未运行命令 | 通过 |
| 网页表单 | 真实模型 6 次浏览器操作／6 次审批，中文填入后保存；服务器记录 1 次，模型再次读取确认已保存文字 | 通过 |
| 视觉截图 | 真实模型获准打开画布并截图；JPEG 作为 image_url 进入后续请求，回答 V75487；持久化截图独立视觉核对同为 V75487 | 通过 |

[真实模型报告](../release/browser-runtime-20261024/live-relay-verification.json)、[实际图片](../release/browser-runtime-20261024/live-webpage-visual-proof.jpg)。首次驱动在历史 debounce 保存完成前读取，最后文字为空导致视觉断言未通过；退出后回读已落盘的三个最终回答及原截图确认通过，没有重新发送公网请求。原始诊断保留 live-relay-verification.initial.json，修正了驱动的等待条件。

## 1.3.0 构建、审查与运行状态

- [包内一致性](../release/browser-runtime-20261024/build-verification.json)：7 个受影响 Electron 模块与 3 个 renderer 文件逐字节一致；运行 manifest 的 name／version／main／dependencies 等字段一致，构建脚本／开发依赖／build 由 builder 正常移除。
- [增量审查](../release/browser-runtime-20261024/incremental-review.json)：读取基线与本次 18 个代码／配置／测试文件；编码、权限、所有权、错误、图片与生命周期定向审查，未发现本轮剩余阻断问题；没有全仓库扫描。
- [快捷方式](../release/browser-runtime-20261024/shortcut-verification.json)：核对原哈希后更新并回读；未备份旧 EXE，未删除既有 release。
- EXE NotSigned；本机 Electron 45，npmRebuild=false，signAndEditExecutable=false。全部有限构建／验收完成；隔离应用及测试服务器已结束。
- 主 renderer 的 Page.captureScreenshot 不包含原生 WebContentsView，不把右侧空白判为网页已完整截图或 Windows 全屏验收；网页截图由实际 browser_screenshot 另行获取并视觉核对。未宣称原生输入通过。
- 修复与驱动失败：隔离脚本异常被 Electron 泛化，改为有界结构化错误并定向复验；CLI -c 短参数误读改用 --config；不完整模型测试配置、错误项目选择器和测试白名单恢复均只修驱动／前置条件。完整失败证据见各阶段报告。
- README、能力对齐与两份交接已更新到 1.3.0；文档回读、链接、UTF-8 与无 BOM 结果见 release/browser-runtime-20261024/document-verification.json。最终 18 个审查文件和 10 个构建对象哈希仍匹配，EXE 哈希一致；未重跑无变化的验收。运行清理记录见 release/browser-runtime-20261024/runtime-cleanup.json。

## 1.3.0 未覆盖与复测条件

- 当前真实公网结果只对应所测 key／deepseek 模型、受控文件和本地网页。Grok、全部模型、外部账号及任意第三方网站尚未完成同等验证。
- 只覆盖顶层文档，元素引用限当前视口；跨域框架、自动密码／验证码、文件上传／下载、扩展、WebMCP 和任意桌面控制不在本轮能力内。
- 浏览器网络规则是 Chromium 主机请求边界；未将其表述为操作系统级沙箱。MCP／Shell 的既有边界保留。
- MCP 资源／提示词、OAuth、旧 SSE、在线市场、完整跨任务与全部办公／图片 AI 链路尚未完成。对应实现或服务条件变化后定向验证，不无变化重发请求。
- 仍有效历史结果如下，仅复用未变部分；没有因交接更新重跑全项目。


## 1.2.0 定向辅助验证

| 对象／命令 | 场景、预期与实际 | 状态 |
| --- | --- | --- |
| node --test tests/mcp-store.test.mjs | 4 项：URL／进程／headers／env 校验、私密持久化／留空／清空、加密不可用与跨主机、串行保存／损坏保护；期望拒绝无效输入并保留数据，实际一致 | 通过 |
| node --test tests/mcp-runtime.test.mjs | 6 项：真实 stdio／HTTP、Schema／拒绝／旧连接无副作用、规划白名单／never、脱敏／取消及含引号认证；期望真实 SDK 结果和边界一致，实际一致 | 通过 |
| node --test tests/agent-runtime.test.mjs | 12 项直接回归：工具结果反馈、流式完整性、原生／JSON、失败、取消、模式及脱敏，均符合预期 | 通过 |
| 受影响 CJS 语法、npm run build | 语法可解析，294 组件许可证含 SDK；Vite 1805 模块成功生成当前 renderer；既有大 bundle 提示保留 | 通过 |

首轮 MCP 9 项，增加引号脱敏后运行 runtime 6 项及模型循环 12 项；按 10 项 MCP 加 12 项直接回归记录，不重复累计复测。单元测试使用受控加密适配器；实际 Windows 加密另由下面 EXE 范围验证。

## 1.2.0 实际 EXE 验收

命令：node tests/mcp-workflow-ui.cjs；随后以 node tests/mcp-layout-ui.cjs 在同一隔离数据中补验布局和项目切换。每轮先核对本文件。初始化已知本地服务后，通过实际导航、表单、对话、审批与停止控件执行，API／磁盘只读结果核对持久化和副作用。

| 范围 | 实际步骤与预期／结果 | 状态 |
| --- | --- | --- |
| 身份／初始状态 | 启动便携 EXE，核对 1.2.0 与隔离根目录，无初始连接 | 通过 |
| 添加 stdio | 实际表单填 Node 路径／JSON 参数／env／白名单并保存；不自动启动，磁盘无认证明文，界面不回显 | 通过 |
| stdio 握手／目录 | 点击连接，实际 SDK 服务返回 4 个工具及参数 schema；目录可展开 | 通过 |
| HTTP 配置／认证 | 实际表单保存 Bearer 和自定义头，手动连接；服务实际收到认证，磁盘值加密 | 通过 |
| 模型 MCP 闭环 | 模型依次 echo／record，实际界面检查服务器、工具与中文参数后批准 2 次；真实日志记录，结果脱敏后反馈模型 | 通过 |
| 拒绝／Schema／旧连接 | 分别拒绝、发送错误参数、审批期间断开重连；record 数量不增加 | 通过 |
| 取消 | 真实 slow 已开始后点击停止，服务实际收到协议取消；后续 record 不发生 | 通过 |
| 规划 | 实际开启计划模式，只开放用户白名单且服务声明只读的 echo；审批后返回结果 | 通过 |
| 对话／never | 普通对话以及禁止审批的执行请求均无 MCP 工具 | 通过 |
| 远程模型调用 | 模型发起 HTTP echo，真实审批后服务记录 1 次并返回中文结果 | 通过 |
| 重启／退出 | 退出后旧 stdio PID 消失；重启保留 2 配置和操作历史，不自启；再手动连接可解密使用 | 通过 |
| 弹窗／字号／键盘 | 1440×900、1080×700，遮罩 fixed、编辑器与保存栏在视口内；输入 16px／微软雅黑，初始焦点与 Escape 正常 | 通过 |
| 编辑认证 | 打开真实编辑表单，秘密输入为空；重命名并留空保存，env 名称与加密值保留 | 通过 |
| 401／删除 | 受控 HTTP 返回 401，界面和后端明确失败；删除后重新读取配置和磁盘，均无该项 | 通过 |
| 深浅色 | 从实际设置齿轮 → 外观按钮切换，再返回 MCP；主题颜色生效，无横向越界 | 通过 |
| 插件／技能双栏 | 两种尺寸下实际切换插件和技能，分类在左、内容在右且顶部对齐，无页面横向越界 | 通过 |
| 项目生命周期 | 已连接时通过真实项目表单切换项目，全部断开；点击原项目返回，不自动启动服务 | 通过 |

[完整验收报告](../release/mcp-runtime-20261024/mcp-ui-verification.json)保留每项操作与证据。前 11 项在功能包 cc5ef645... 完成；后续仅 CSS 修复保留其核心代码。最终包 e1e5106a... 的新几何／主题／双栏／项目范围和仍有效配置检查分项记录 SHA，不冒充 17 项全在同一二进制重跑。

## 构建、审查与最终运行状态

- [包内一致性](../release/mcp-runtime-20261024/build-verification.json)：9 个核心源／manifest／许可证与功能包逐字节一致，3 个当前 renderer 文件和磁盘一致；SDK 1.32.2。
- [增量审查](../release/mcp-runtime-20261024/incremental-review.json)：17 个本轮代码／配置／测试文件；已有文件只审差异，新文件审新增代码；UTF-8、无 BOM、无替换乱码；原锁定依赖版本不变。
- [快捷方式](../release/mcp-runtime-20261024/shortcut-verification.json)：写前核对哈希，写后回读新目标、工作目录、图标和最终 EXE 哈希。用户原实例未强制退出。
- 所有本轮有限构建／验收已结束；最终只读检查本轮隔离 Scodex 与 MCP 测试进程为 0。未保留测试服务器。
- 最终 EXE 未签名；构建跳过 npm rebuild 和内层资源编辑，使用本机 Electron 45。
- [最终截图](../release/mcp-runtime-20261024/mcp-connections.png)晚于 CSS 修复及项目切换，已视觉核对：当前设备、页面、视口和数据状态下无可见错误。仅该页面／状态范围，不代表系统绝对无错。

## 1.2.0 失败及恢复

| 失败 | 原因与有效处理 |
| --- | --- |
| 许可证生成两次退出 1 | SDK 的 package.json 导出为无 name 内部元数据且没有顶层 index.js；改按 Node 有序模块目录定位真实 manifest，最终 294 项生成通过 |
| 首次插件导航定位为空 | 驱动误选 activity-rail，实际入口在 workbench-primary-nav；仅修驱动后功能 11 范围通过 |
| 弹窗越界 | 新遮罩未设 fixed／inset／grid；最小样式修复后边界、焦点及键盘检查通过 |
| 分类堆叠和大空白 | extension-center 继承通用 column；显式 row 并保留窄屏规则后，插件与技能双栏通过 |
| 主题驱动等待 | 错用 theme 字段及直接 bridge 立即更新 React 的假设；确认包装器后改走实际外观按钮，通过，未改正常产品行为 |

## 1.2.0 未覆盖与复测条件

- 外部模型被本机端点替代；真实 Grok 执行、真实第三方 MCP 账号与外部副作用尚未完成验证。服务条件变化后定向验收。
- OAuth、资源／提示词浏览、旧 SSE、在线市场未实现，不列为通过。
- 没有系统级 Shell／MCP 沙箱。每次批准后已发生的副作用不能自动回滚。
- 原生输入受前台 PID 环境限制，继续使用实际 renderer 验收证据；不计为原生点击通过。
- 本轮只覆盖 MCP 直接路径，未把未改变的办公、图片、存储等全项目回归重新执行。

## 仍有效的 1.1.0 历史记录

## 1.1.0 定向辅助验证

| 对象／命令 | 场景及预期 | 实际结果 |
| --- | --- | --- |
| `node --test tests/agent-runtime.test.mjs` | 流式碎片、UTF-8、原生／JSON动作、截断拒绝、取消、循环边界和脱敏 | 12 项有效 |
| `node --test tests/agent-tools.test.mjs` | 哈希、CRLF、唯一替换、新建、并发／未保存、路径／联接、AGENTS 和只读 | 6 项通过 |
| `node --test tests/agent-command.test.mjs` | 真实中文输出、非零退出、超时及取消子进程树、凭据环境过滤 | 3 项通过 |
| `node --test tests/conversations.test.mjs` | 历史、项目、模式、附件及规范化直接回归 | 9 项通过 |
| `node --test tests/permission-policy.test.mjs` | 权限边界及重复归一化幂等性；显式关闭仍关闭 | 6 项通过；幂等性新增用例先红后绿 |
| `node --test tests/model-connection.test.mjs` | 连接、凭据、模型及执行通道持久化 | 6 项通过 |
| 受影响 CJS 语法及 Vite build | 可解析、可生成当前 renderer | 通过；1804 模块，既有大 bundle 提示保留 |

上述为 42 项不重复有效结果；最后一次 runtime＋model-connection 的 18 项属于受影响复测，不重复累计。单元测试不替代下面实际程序验收。

## 1.1.0 实际 EXE 验收

执行：`node tests/agent-workflow-ui.cjs`。前置条件为隔离 profile、临时项目和回环模型端点；停止／审批／编辑／模式按实际 React 界面顺序操作，持久化经应用接口和磁盘重新读取。

| 范围 | 实际操作、预期与结果 | 状态 |
| --- | --- | --- |
| 程序身份 | 启动便携入口，读取 1.1.0 及隔离项目；哈希见报告 | 通过 |
| 编程闭环 | 目录→读源码→真实测试退出1→精确修改→搜索→真实测试退出0→写中文结果→完成计划，共9操作；AGENTS／SKILL实际进入请求 | 通过 |
| 命令拒绝 | 显示确切命令和目录后拒绝，确认目标文件未生成 | 通过 |
| 取消 | 启动真实子进程，停止生成，核对 PID 已退出且后续文件未写入 | 通过 |
| 并发保护 | 读取后外部修改；旧哈希写入被拒，回读保留外部内容 | 通过 |
| 未保存保护 | 实际编辑器产生脏状态，再让模型覆盖同一文件；拒绝且磁盘原内容保留 | 通过 |
| 规划只读 | 实际开启计划模式，工具目录不含写入／命令；伪造写入被拒且文件不存在 | 通过 |
| 受限自动命令 | workspace-write＋never，任意 Shell 被拒；目标文件不存在 | 通过 |
| 服务拒绝 | 端点返回400；界面显示明确错误，无静默降级和副作用 | 通过 |
| 协议中断 | 工具响应未完整结束；界面报错，写入未执行 | 通过 |
| 普通对话 | 不打开执行，端点确认无工具，界面正常回答 | 通过 |
| 仅对话 | 界面执行开关禁用；伪造执行标志的真实 IPC 请求也未产生工具操作 | 通过 |
| 兼容通道 | 在实际模型设置中选择并保存 JSON 通道，模型读→改→读 compatible.txt，回读匹配 | 通过 |
| 重启 | 退出并重新启动，重新读取执行偏好、9项操作、差异和退出码0 | 通过 |
| 布局与字体 | 1440×900、1064×660；检查无水平越界、输入区可见、微软雅黑16px | 通过 |
| 新增命令入口 | 新对话原为非执行，经命令搜索“执行项目任务”后切换为执行 | 通过 |

最终补充打开成功命令记录，实际可见“实际中文验证通过”和“退出码：0”；最终截图显示精确替换和真实命令结果。当前设备、页面、视口和数据状态下无可见错误。该截图不代表全系统验收。

结果复用：前5项在构建 `4a578f2f0720854cdd0b05d4b76a6c7dc31fd679bb8a160f2fc025f7a97d4403` 完成；最终包保留其原生执行分支和工具行为，增加显式兼容分支，按增量审查复用。后11项在最终 `6edf74e...` 包完成。每项原始构建 SHA 保存在验收报告，收尾未重放已经通过的场景。

## 真实服务对照

| 对象 | 实际操作与结果 | 状态 |
| --- | --- | --- |
| 实际 EXE／聚合模组2 | 隔离 relay-input.txt 的读改读任务，未执行命令；HTTP426，文件仍待验收 | 阻塞，尚未完成验证 |
| 同一 EXE 普通对话 | 无显式回答深度和 low 各一次，均返回 OK | 通过，仅普通对话范围 |
| 同一 EXE 只读工具 | 规划只读、仅请求 read_file；仍HTTP426，未执行读取 | 阻塞，排除只由写入或低推理强度造成 |
| 服务错误正文 | Grok CLI 1.0.4 过旧，要求至少1.0.13；未在本机安装或伪装Grok CLI | 已定位服务返回信息，未擅自归因其内部实现 |
| 默认连接补充诊断 | 同主机、已有默认DPAPI，补充Node只读请求；grok-4.7 返回404；/models为200、11项、无Grok | 不具备默认组Grok验收前提 |

真实请求只通过现有加密凭据加载，不把密钥写入日志、报告或渲染器，不改用户真实连接配置。此前最小 Node 原生工具声明请求虽HTTP200，但没有tool_calls，不能计为工具兼容通过。

## 构建、审查与运行状态

- [包内一致性](../release/agent-workflow-20261024/build-verification.json)：11个相关源／构建文件逐字节一致，manifest名称、入口与版本一致；资源按 Windows ASAR 路径核对。
- [增量审查](../release/agent-workflow-20261024/incremental-review.json)：本轮22个代码／测试文件及版本字段；新文件完整审查，既有文件只查本次差异。UTF-8、无BOM和写入内容核对通过，依赖未变化。
- [快捷方式](../release/agent-workflow-20261024/shortcut-verification.json)：写前核对旧哈希，写后读取目标／工作目录／图标及最终EXE哈希，通过。
- 本轮打包和有限验收均已结束；最终只读查询未发现本轮 GUID 隔离 Scodex 进程。用户原程序未终止；无需要保留运行的测试服务器。
- 未签名；构建跳过 npm rebuild 及内层EXE资源编辑。

## 失败及恢复证据

| 失败 | 根因与已验证处理 |
| --- | --- |
| 初包白屏，SHA 3fa97774... | 新effect引用showNotice早于const初始化；调整顺序后实际启动通过 |
| 第二包无模型请求，SHA f90012b8... | 归一化把networkConfigured=false转为true；幂等性测试先失败，修复后权限测试与实际请求通过 |
| 驱动的按钮、输入、文件与规划定位 | 按真实aria-label／input类型／文件名title及可见按钮文本修正，复用已通过场景；未改正常产品行为 |
| ASAR资源比较方法 | 缓存及路径分隔符影响读取；清缓存并按真实Windows包路径比较，源与包逐字节一致 |
| 原生输入 | 文本状态没有坐标几何；取得截图后仍因前台PID不可得阻塞，未重复声称点击通过；实际界面用CDP验收 |
| 默认连接诊断脚本 | node_repl禁止node:process导入，首次未发请求；改用受支持的execFile常量路径后完成404与模型列表诊断 |

## 仍有效的历史结果

| 历史版本 | 有效范围与证据 |
| --- | --- |
| 1.0.5 | 托盘、隐藏／恢复、单实例、隐藏期间计划失败记录、技能来源／旧ID、原生手柄、字号等16个实际范围；[原报告](../release/tray-tools-20261024/tray-tools-ui-verification.json)，15+1项定向结果 |
| 1.0.5 构建 | 最终SHA 8cd28e1cef60e89104686dba83a13e68965f5a61f698f5e7867eaf74e26eed07；仅用于未变旧路径，不代替新增执行验收 |
| 1.0.4 | 设置、存储、项目与插件等专用包及56项历史测试，只作对应版本／未改路径证据；本轮未重跑全套 |

## 未覆盖与复测条件

- 真实Grok工具调用尚未通过；服务条件改变后，复测实际EXE读改读，再验收完整项目修改／运行闭环。普通对话成功不替代该项。
- 原生鼠标／键盘当前未完成验证；桌面前台PID条件恢复后，只复验操作记录的原生交互。
- MCP／插件运行时、模型网页／电脑代理、完整退出后的定时任务、AI图片生成和全部办公自动化链路尚未接通或验收；不使用模拟结果补作通过。
- 现有不变的图片、表格、存储、Git偏好等功能本轮未进行全量回归。
- 只在实现、配置、依赖、输入或验收条件影响对应结论时复验；更新文档本身不使已通过结果失效。

## 主要证据与文档核验

- [实际EXE验收](../release/agent-workflow-20261024/agent-workflow-ui-verification.json)、[最终截图](../release/agent-workflow-20261024/agent-workflow.png)。
- [真实Grok任务](../release/agent-workflow-20261024/real-relay-verification.json)、[普通对话](../release/agent-workflow-20261024/real-relay-diagnostic.json)、[只读工具](../release/agent-workflow-20261024/real-relay-read-diagnostic.json)。
- [默认连接诊断](../release/agent-workflow-20261024/default-relay-diagnostic.json)、[模型目录](../release/agent-workflow-20261024/default-model-catalog.json)。
- [项目进度交接](PROJECT_PROGRESS_HANDOFF.md)、[能力对齐](CODEX_ALIGNMENT.md)、[使用说明](../README.md)。四份文档写后回读、内容／链接／UTF-8／无BOM核验结果记录于 `release/agent-workflow-20261024/document-verification.json`。

## 2026-10-31 MCP World 浏览器抓取（新增任务）

- 来源：已登录的 ChatGPT 内置浏览器打开 https://www.mcpworld.com/?t=1793460037481，进入“可试用mcp/可托管”分类（页面计数 1322）。
- 代表性详情：认知增强MCP服务器，详情页 https://www.mcpworld.com/zh/detail/021e9842b4380b4313d992b589ed13fe；页面标记“混合部署、可托管”，显示“Server 已在百度托管”，传输类型为 sse，连接有效期界面观察到 24h可用/72h可用。
- 结果：详情页未显示可直接调用的公网 URL、认证配置或工具参数；“工具测试”标签在未建立站内连接前没有可执行的工具详情。未点击“一键部署”，未提交表单、上传文件或发送消息。
- 证据：[mcpworld-browser-scrape.json](../release/mcpworld-scrape-20261031/mcpworld-browser-scrape.json)。本轮属于目录/详情只读抓取，不能替代真实 MCP 协议往返；M10继续阻塞，固定清单保持 48/50（96%）。
## 1.3.21 默认文件打开位置下拉验证（2026-11-01）

- 实际对象：当前源码 Vite renderer 与 Electron 45 隔离实例，版本 1.3.21；入口 `http://127.0.0.1:4178/`，隔离 profile 位于 `C:\Windows\Temp\scodex-ui-file-open-profile`，不读取真实凭据。
- 场景与结果：`node --test tests/file-open.test.mjs tests/settings.test.mjs` 通过 11/11；`node --check` 通过 `electron/file-open.cjs`、`electron/preferences.cjs`、`electron/main.cjs`、`tests/settings-ui.cjs`；`npm run build` 通过，Vite 1823 modules。
- 实际 UI：设置页“默认文件打开位置”按钮显示 VS Code；展开菜单顺序为 VS Code、Visual Studio、Default app、File Explorer、Git Bash。1464×901 视口下自动向上展开，菜单边界 `left=735.8,right=955.8,top=565.4,bottom=754.4`，无可见越界。
- 持久化：实际点击 Git Bash 后隔离 `settings.json` 回读 `preferences.defaultFileOpen=git-bash`，随后恢复 VS Code；旧值 `builtin/system` 单元测试分别迁移为 `vscode/default`。
- 打开路由：文本文件经 `workspace:open-external` 使用所选固定程序；工作区目录经 `workspace:reveal`、项目目录经 `projects:open-path` 使用同一路由；默认应用、资源管理器和外部程序均继续经过 `external-open` 权限检查。未在本轮真实启动 VS Code、Visual Studio 或 Git Bash，不把程序安装状态记为通过。
- 清理状态：验证进程已停止；隔离目录已移入[手动删除/file-open-ui-cleanup-20261101](../手动删除/file-open-ui-cleanup-20261101)，源空目录因策略拒绝删除，待手动处理。
- 增量审查：见 [file-open-location-20261101/incremental-review.json](../release/file-open-location-20261101/incremental-review.json)；第三方外部程序未实际启动，不计入通过。

## 1.3.22 Supabase 应用同步验收（2026-11-01）

- 测试对象：源码 E:/GDP/Scodex/workbench，package version 1.3.22；同步模块、主进程 IPC、preload、设置页和 SQL 文件。
- 本地前置与命令：node --check electron/supabase-sync.cjs、node --check electron/main.cjs、node --check electron/preload.cjs；node --test tests/supabase-sync.test.mjs tests/model-connection.test.mjs tests/settings.test.mjs，21/21通过；npm run build，Vite 1823 modules 通过，保留既有大 chunk 警告。
- RED/GREEN：新增同步测试先因模块缺失失败；实现后配置、加密存储、首次写入、版本条件更新、冲突、网络错误和超时共6/6通过。超时修复另经无 AbortController 的旧实现复测为预期失败，再恢复实现复测通过。
- Supabase 只读诊断：表 public.scodex_sync_records 存在；RLS 已启用；策略 scodex_sync_insert、scodex_sync_select、scodex_sync_update 存在。
- 独立冲突场景：使用同步空间 scodex-acceptance-20261101 顺序执行副本A版本0→1，再执行副本B版本0→1；结果为 first_commit_count=1、stale_commit_count=0、最终 version=1、payload 为副本A。结果来自 Supabase SQL Editor 的独立测试项目。
- 未覆盖：尚未在 Scodex 实际 REST 客户端填入该项目 anon key 做公网往返；未执行自动合并、远端拉取覆盖或正式生产数据写入。不得将 SQL Editor 管理员会话结果写成应用 REST 已通过。
- 证据：[supabase-sync-20261101/verification.json](../release/supabase-sync-20261101/verification.json)、[targeted-tests.log](../release/supabase-sync-20261101/targeted-tests.log)。
- 增量代码审查：已完成同步模块、IPC、设置界面、测试和 SQL 的定向审查，未发现高置信度问题；记录见 [incremental-review.json](../release/supabase-sync-20261101/incremental-review.json)。
