## 当前检查点：1.3.64 Codex上下文接续与模型布局（已完成）

- 目标/验收：模型语义摘要、/compact、摘要持久恢复/失效、上下文状态；模型5分类简洁布局并保持草稿/独立保存；新版入口及累计源码上传。
- 已完成：本地功能、1.3.64-final完整程序、原子根入口切换与实际启动；15文件增量审查通过，默认策略兼容及/compact失败重试问题已修复。
- 有效验证：定向59项（最终32+未变27）；候选首轮前4项、remaining6/6、最终retry2/2、布局3/3、快捷入口2/2；8包内容/9资源/PE版本一致；最终截图已查看。5轮进程/fixture均清理。
- 当前入口：EXE快捷启动.lnk→release/Scodex-Workbench-1.3.64-final/win-unpacked/Scodex工作台.exe；EXE c785cb63e5aaa535905fd897b34f50593321cef39729b728d136c8dc3f109c9b；ASAR 78cc245514ee35c1c7e4254ffb6eafb60850128804f31a91da4a4aa564c939d4；lnk 2283a4246e159c76869e55c46e9f229c4ad69a964aa94d2c7d7ff06d86a511a1。
- 证据/基线：release/codex-alignment-1.3.64/baseline.json、incremental-review.json、build-verification-final.json、delivery.json及四轮UI/shortcut报告；docs/verification/1.3.64.json是可上传摘要。原始1.3.63未变结果有效。
- 源码/交接：累计54个文件（22新增、32修改）已推送 https://github.com/song123-jian/-0 的main；源码提交0e2811ff478c71eaf693e9d7e35b0c91f164c339，git ls-remote远端回读相同，非强制推送。隔离克隆release/codex-alignment-1.3.64/source-repo，基线b18db09f7f8a66f3bae7169d6501a2423a9cb74a。最终上传状态随本次文档提交同步；无功能待办或新增阻塞。后续文档提交号见本地upload-verification.json。
- 回滚/约束：EXE快捷启动.pre-replace.lnk恢复旧1.3.63-capacity；保留完整目录、用户配置/聊天和用户进程。源码排除EXE/LNK、配置、聊天、缓存，3份远端已跟踪ZIP未变化。
- 限制/假设：loopback替代模型，公网语义质量/费用未验；无Responses远端压缩/官方云账号等价承诺。上下文估算85%为本机策略；短历史可无需摘要；源SHA变化回退原文。无新增授权阻塞。
- Skill：requirement-understanding、code-write-review、openai-docs；无Agent。下一步不重扫项目/历史、不重复有效测试。

- 上传恢复：最终文档Git HTTPS重置/超时；API确认源码0e2811f已上传且文档待传。改用GitHub REST逐对象核对原提交SHA并非强制更新main，随后API回读；详见本地upload-verification.json。无产品代码变化或测试结果失效。

## 当前检查点：1.3.63 工作流与会话能力补齐（已完成）

- 目标/验收已满足：活动队列项计入20条上限；满额新增拦截并保留草稿；失败恢复全部20条且尾项/顺序完整；重开暂停且零新增请求；根快捷入口切换及实际运行通过。
- 交付入口：EXE快捷启动.lnk 指向 release/Scodex-Workbench-1.3.63-capacity/win-unpacked/Scodex工作台.exe；版本沿用本轮1.3.63，图标保持。EXE 72dbb9250cb4e5413e4e561aa64d0a4866140afb1e7944e5c411f2a5e165bdf2；ASAR eacdbf7a756c7b2e6acd9cea9481c1cc4da7ee61d8ef292266482cc2fa057dd3；lnk 583856a3e04c1791a6b2d8ff014e4e9104d210dd2b257f0cfbde4224f422de9d。
- 有效验证：打包58332退出0；版本/9项资源/6份包内容一致；真实候选recovery67514退出0、4/4通过；最终快捷入口1176退出0、2/2通过；无未结束有限任务或常驻服务。原逻辑7/7及未变计划/分支/布局结果继续有效，不重跑全项目。
- 变更/审查：src/workbench.jsx 的 enqueueMessage 容量检查和 tests/conversation-workflow-ui.cjs 的显式EXE/recovery/满额场景；精确旧字节与上次审查SHA匹配，本次增量无剩余高置信度问题。原始 baseline.json、恢复 capacity-baseline.json 和最终 capacity-incremental-review.json 均在 release/workflow-session-1.3.63。
- 证据/双交接：build-verification.json、capacity-ui/conversation-workflow-ui.json、capacity-shortcut-ui/composer-model-modes-ui.json、capacity-delivery-verification.json；项目/测试交接与能力对照已更新，文档落盘核验见 capacity-document-verification.json。最终截图已查看，预期503状态和20条已暂停/保留草稿显示正确。
- 回滚/清理：EXE快捷启动.pre-capacity.lnk 可恢复旧1.3.63，原1.3.62备份也保留。两轮测试fixture已删除且进程退出；历史1个临时lnk仍在本轮证据目录的手动删除下，旧记录缺少确切原路径/拒绝原因，不重复删除，详见交付清单；不影响功能。
- 约束/风险：未写真实聊天或配置、未发布远端或更新其他安装目录。只用loopback模型；公网模型/云服务、原生关闭和文件选择器未验证，不能外推100%等价。
- 待办/评估：当前授权交付无功能待办或阻塞；仅历史手动清理项。轻量重构评估无足以追加的有证据候选。

## 上一检查点：1.3.62 聊天工具入口补充（已完成）

- 目标：在聊天“添加工具和上下文”菜单补齐现有程序的浏览器、集成终端、运行与预览入口；按上下文→工具→任务与创作→插件与技能排列；保留全部原功能，不将未连接的电脑控制/MCP 描述为已可用。
- 已实施：`src/components/composer-tools.jsx` 新增三个入口并接现有工具路由；`src/workbench.jsx` 传入现有 `runToolAction`；`tests/composer-checks.cjs` 增加顺序断言及三个面板的实际 UI 检查；`package.json`/`package-lock.json` 递增为1.3.62。
- 已验证：测试驱动 `node --check` 通过；package 与 lockfile 版本一致；源码回读确认入口和回调。`npm run build` 退出0，1836模块完成。Vite 仅提示生产 JS bundle 超过500kB。
- 构建恢复：首次构建中断、恢复后默认下载仍阻塞，已取消会话15843（退出1），未用于交付。改用本地完整45.0.0运行时 `--config.electronDist=node_modules/electron/dist`，同版本完整构建退出0；ASAR辅助校验的Windows路径分隔符错误修正后通过，未改产品或再加版本。
- 正式入口：根 `EXE快捷启动.lnk` 已原子切至1.3.62完整目录，SHA `E7CADA1106BB6D2D3E3F85564BA6E408258A59F18AFC725927479FF74A48A05E`，保留原图标。旧1.3.61入口备份`release/composer-menu-1.3.62/EXE快捷启动.pre-replace.lnk`，SHA `A7D8A9D4A3B6F309B3DB968F8689E076F3C254BD80695F01068848DE084EEBC1`，保留旧完整目录，复制备份回根lnk即可回滚。
- 当前进展：构建54332退出0；规范路径的包校验通过，报告`release/composer-menu-1.3.62/build-verification.json`。EXE SHA `D84083CAEE09F487E37CDE71B9393D2C2A086332C082413909898F0DD084526F`，ASAR SHA `C41A0B38D32FDA659FB7CFFC8B849CF4000D8389AC28E1DE89B1AA010A284138`。实际Composer smoke会话83434退出0，新入口与聊天保留/旧功能/排序/1064×660和20px布局通过，日志及截图已保存并查看。进程和fixture由finally清理成功。五文件基线SHA精确还原，增量审查无待修复问题。
- 最终入口验收：会话51736退出0，根快捷启动真实UI往返2/2通过，版本/profile/工作区正确。`shortcut-ui/composer-model-modes-ui.json`与`delivery-verification.json`记录进程退出、精确fixture删除和最终哈希通过。产品代码与候选未变，复用已通过Composer结果。
- 收尾：增量审查无待修复问题，测试临时文件和进程已清理，无本轮手动删除项；项目和测试交接已更新为最终实际状态，回读/链接/UTF-8无BOM核验见`release/composer-menu-1.3.62/document-verification.json`。无需再实施；轻量重构评估未发现当前范围需要追加的高收益改动。
- 限制：用户真实profile/公网模型及原生窗口关闭/关闭时草稿刷新不在本轮候选测试覆盖；无Git元数据，增量审查采用已记录读取基线及本轮直接差异。

## 上一检查点：1.3.61 聊天输入工具菜单补充（已完成）

- 目标：用户授权自行补充“+ 添加工具和上下文”菜单；调整组织并补充入口，不移除原功能。
- 实现：`src/components/composer-tools.jsx` 增加上下文/任务分组、目标运行提示和插件中心；`src/styles.css` 增加标题样式；`tests/composer-checks.cjs` 适配当前实际 UI；`tests/smoke.cjs` 增加仅 composer scope 可启用的原生关闭跳过开关，默认不变。
- 版本/产物：1.3.60→1.3.61，沿用既有补丁映射。完整目录 `release/Scodex-Workbench-1.3.61/win-unpacked`；EXE SHA-256 `B13BFE603C1CC256A6C9464CDBA338930D2F6B2D2A5A8351E35D72849B6FC3E2`，ASAR SHA-256 `7B1105E4A6290CAAE6BEDD1B62D16562793981165F92D33EC7360E405A92D1EF`。包内版本及 renderer JS/CSS 与当前 dist 匹配。
- 入口：根 `EXE快捷启动.lnk` 指向 1.3.61，工作目录正确，原图标保留；哈希 `A7D8A9D4A3B6F309B3DB968F8689E076F3C254BD80695F01068848DE084EEBC1`。1.3.60 回滚备份 `release/composer-menu-1.3.61/EXE快捷启动.pre-replace.lnk` 哈希 `566E5ADD9AFBBEC098928DA494D7EF508F83BB91039363A72FF77959005475B7`，1.3.60 完整目录保留。
- 有效验证：Composer 候选 EXE 菜单/目标/附件/技能/权限/路由/布局 smoke 通过，目标逻辑4/4；2026-11-12 将新聊天目标断言改为检查菜单实际显示“设置本次对话目标”，`node --check tests/composer-checks.cjs` 通过，候选 EXE Composer smoke 退出码0，日志 `release/composer-menu-1.3.61/composer-smoke-final-rerun-20261112.log`。实际根快捷方式启动并经 UI 收到 loopback 回复2/2。截图 `release/Scodex-Workbench-1.3.61/win-unpacked/workbench-composer.png` 已查看，当前页面及视口无可见错误。报告和哈希见 `docs/TEST_HANDOFF.md`。
- 审查/限制：无 Git 元数据；人工审查限定菜单组件、CSS、测试驱动和打包 renderer，与 1.3.60 交付包对照；本次只修改并复审测试驱动中的新聊天目标断言，未改变候选包。早期失败为测试选择器/持久化预期陈旧，修正后菜单范围全过。候选无原生窗口句柄，最终 composer scope 显式跳过原生关闭及关闭时草稿刷新，此范围尚未验证；公网模型未验证。
- 状态：快捷入口更新及真实启动验收完成；隔离测试进程/fixture 退出清理；1.3.60 回滚入口、候选和证据保留。项目与测试双交接已更新；使用 Skill：requirement-understanding、frontend-implementation、code-write-review。

## 当前检查点：1.3.60 绘图功能补齐（已完成）

- 目标/边界：补齐聊天交互图表、有限状态保存、确认后追问和普通/接手图表活动兼容。不承诺与Codex或其插件100%等价，不扩写其他目标/计划功能。
- 最终版本与入口：1.3.59→1.3.60（既有SemVer补丁映射），根EXE快捷启动.lnk已切至release/Scodex-Workbench-1.3.60/win-unpacked/Scodex工作台.exe。原自定义图标不变，完整目录不能只搬走EXE。
- 身份：EXE SHA256 3ffdf1b5bdd1aabbe74a18271b1866bf644d7c5fd4cfa88721ba95cc19530aa6；ASAR 543cb0c31f9d378dd5750161aafaa8f37d461b958df8aa542e0b8c8e5af73daa；lnk 566e5add9afbbec098928da494d7ef508f83bb91039363a72ff77959005475b7。
- 已实现：visualization-contract/tools/documents、main/preload接入；conversations持久化；VisualizationFrame沙箱、状态/追问桥接、nonce CSP、本地协议、请求白名单、有界恢复、稳定状态回调；workbench和标签/样式接入。
- 有效验证：44项既有逻辑有效+4项新增协议规则；最终工作流9/9、最终布局1/1、真实快捷入口2/2；构建均退出0，9份包内容字节一致，17份相关文本UTF-8无BOM。最终截图晚于末次修复且已查看。
- 证据：release/visualization-1.3.60/delivery.json；ui-state-final、ui-delivery-view、shortcut-ui下JSON报告；protocol-tests-final.log。data恢复/零网络保留ui-stable-chat前10项中有效证据，不复用其第11项假阳性布局。
- 审查：ASAR及1.3.59有效记录作为基线，workbench重构基线哈希匹配；只审查本轮增量。CSP继承、导航事件遗漏、父刷新丢待保存状态已修复，无剩余高置信度本轮缺陷。无必要范围外重构。
- 运行/回滚：所有有限会话结束，测试进程退出，无新增常驻服务；release/visualization-1.3.60/EXE快捷启动.pre-replace.lnk恢复至根可返回保留的1.3.59目录。
- 清理：删除被策略拒绝，未重试；12个自建fixture已移至手动删除/visualization-1.3.60，原路径不存在，可手动删除；映射见delivery.json。快捷测试fixture已清理。
- 限制：仅loopback模型，不验证公网连接/质量或上游专属插件；接手图表保存活动已验证，完整自动接手未新验。data导航在沙箱内发生后恢复一次，重复异常停止，不承诺同步阻止全部跳转。PE框架版本仍Electron45，应用版本由包/IPC确认。
- 约束：未读真实凭据内容、未写真实聊天/配置、未发布GitHub、未改其他安装目录，保留用户原有改动。
- 状态/待办：本轮授权范围已完成，无功能阻塞；仅可选手动清理目录。项目/测试交接已写入并完成最终落盘核验。使用Skill：code-write-review、frontend-implementation、security-best-practices。

## 当前检查点：1.3.59 所选模式执行与运行中切换（已完成）

- 目标：用户确认“两者都要”。所选模式独立提案并评议全部方案，整合讨论结果，负责文件、命令、验证和交付；执行中可以补充修改方案/文件，也可以切换执行模式，三模式保持同一聊天和上下文。
- 实现：main/model-team动态绑定真实三方配置、其余两方监督及不同完成核验者；runtime保留工具调用/结果，在当前响应和完整工具批次结束后接续新连接；preload/IPC校验聊天、配置和网络权限，workbench显示待切换及生效状态并更新消息身份/用量。不重放已成功操作，运行中引导保留。
- 版本：上次1.3.58，本轮1.3.59，沿用既有SemVer补丁映射；同轮重建未重复递增。源码和最终完整目录均包含最新切换实现。
- 最终入口：根[EXE快捷启动](../EXE快捷启动.lnk)已原子替换为release/Scodex-Workbench-1.3.59/win-unpacked/Scodex工作台.exe，工作目录及原自定义图标已回读。旧1.3.58完整目录和明确备份快捷方式保留；哈希、运行和回滚见[交付清单](../release/team-executor-1.3.59/delivery.json)。
- 构建身份：EXE SHA-256 da9a0c6ad51a8264febd79736b9fff5ba2f85a6cccff86b7f6e719fdf6bcbf7a，ASAR 245627b8a32e4bb9992f1e06bfc9317cf42b298dff736023af65eca3e4bbc932；[包身份](../release/team-executor-1.3.59/artifact-identity.json)确认4份Electron模块及renderer匹配，必要运行资源齐全。
- 有效验证：定向逻辑61/61、renderer和完整目录构建通过；最终包基础身份/三模式执行/两种降级/运行中补充7项独立通过；[连续切换与职责](../release/team-executor-1.3.59/switch-candidate-ui-r2/team-executor-ui.json)3/3和[实际快捷入口](../release/team-executor-1.3.59/shortcut-ui/team-executor-ui.json)2/2通过。连续一→二→三→一为同一chat/request，真实edit共4次、命令1次，native→JSON→native和无效配置拒绝通过。
- 审查基线：[15份原文件清单](../release/team-executor-1.3.59/baseline.json)，无Git元数据；本轮仅12份代码/测试/版本元数据的[增量审查](../release/team-executor-1.3.59/incremental-review.json)，未变化结论按哈希复用。UTF-8无BOM、变更空白和版本源一致性通过，无剩余高置信度问题；轻量重构评估无必要扩展事项。
- 失败证据：final-candidate-ui整轮failed保留，前7项独立有效。切换驱动误从持久化文件找pending，尚未发起切换即超时；改用实时运行态和稳定requestId后3/3通过，未修改正常业务代码或重建未变候选。关闭清理改为先取消已知请求并等终态。
- 清理：有限会话8447已退出1，95947/67432退出0；最终两个测试fixture已删除、进程退出，无新增常驻服务。失败轮次自建进程已精确回收；删除fixture被自动审批拒绝后，已移入项目手动删除目录，原路径不存在，待手动删除，见[精确清理记录](../release/team-executor-1.3.59/switch-recovery-cleanup.json)。
- 约束及限制：用户连接配置SHA-256仍53cc2c54bb6d2283aa5a2a059c767ff9bda8d2a740a76a2d2d2e3631d87db7c3；未读取凭据内容或修改真实聊天，未终止用户进程、发布GitHub或替换其他安装目录。模型HTTP/凭据由loopback替代，公网服务未验证。未签名目录构建的PE框架版本仍为Electron45，应用版本以包元数据和真实IPC为准。
- Skill：requirement-understanding 95（30/20/16/15/9/5，需求及角色边界）；code-write-review 94（30/20/15/15/9/5，定向差异及编码/直接回归），复用已读说明，无Agent。
- 当前需求无功能待办；[项目交接](HANDOFF.md)和[测试交接](TEST_HANDOFF.md)已同步，最终落盘回读及文档验证随本轮执行。后续仅按变化范围复测，不重新扫描历史或重复仍有效测试。

## 上一检查点：1.3.58 模式列表隔离与输入栏尺寸（已完成）

- 当前目标：模式一界面隐藏模式二默认的Grok但保留已保存模型配置；顺序改为模式→模型→回答深度，三个控件放大一档，三模式仍共享同一聊天和上下文。
- 已核实根因：`normalizeConnection`把同地址子模型默认值追加到主模型清单；本机实际列表已有Grok且主默认仍为glm-5.3。遵照用户最新选择，不直接修改用户连接配置；程序停止未来自动追加，并仅在模式一选择器隐藏同地址的模式二默认模型。旧消息仍可按原配置模型重试，明确共用其余模型仍照常可见。
- 方案更新：1.移除同地址自动回填并实现可见列表与已配置模型白名单分离；2.模式→模型→回答深度、三控件13px并扩宽/增高；3.定向测试及1.3.58候选真实EXE验收、更新根快捷入口；4.不变更用户配置并完成增量审查、双交接。目标版本1.3.57→1.3.58，沿用SemVer补丁映射。
- 修改基线：`release/composer-controls-1.3.58/baseline`及`baseline.json`，13个直接相关文件含旧快捷方式。交接、源码及版本与上轮最终哈希一致；没有Git元数据。
- 关键约束：不写用户配置/聊天/凭据，不发布GitHub、不改其他安装目录、不终止用户进程。旧1.3.57正在运行；候选验收使用隔离profile和loopback模型服务。
- 已完成：同地址停止自动回填；模式一只隐藏和模式二默认相同的Grok，配置/历史重试保留；模式选择器调到模型左侧，三控件13px/加宽加高。
- 构建状态：最终renderer重建通过、1.3.58完整运行目录打包退出0。最终EXE SHA-256 `a6b861077c70432316ce5c179aa39a2973a64f1e924a7f50d79687a140bbfea9`、ASAR `b238f9c46b41ec3bb35dd76effe745822a228e53cb8d6d7523489bff24b4dfad`，ICU/PAK/snapshot/locale和工作区工具ZIP齐全。首次打包的schema错误已通过win.signAndEditExecutable=false修正，保留失败package.log和成功package-r2.log。
- 已完成：候选实际EXE界面5/5通过（同地址已存配置保留Grok/模式一隐藏、重启、历史Grok主模式重试、三模式6条共用上下文、顺序/尺寸/键盘和600/1280px布局），报告`candidate-ui/composer-model-modes-ui.json`；截图已查看，1280×780当前状态无可见错误。候选fixture删除且进程退出。
- 快捷入口已完成：根`EXE快捷启动.lnk`已原子切至1.3.58完整目录，工作目录及原自定义图标均已回读核对；SHA-256 `42547b4155e47e3a8b73436fd82b1e44f9d0ab03594de7c4eda1e39221e22278`。实际经Windows快捷方式启动并UI发送/完成2/2通过，报告`shortcut-ui/composer-model-modes-ui.json`，命令会话55663退出0。
- 入口恢复记录：首次File.Replace因空备份路径被Windows拒绝且未发生替换；改用明确`EXE快捷启动.pre-replace.lnk`备份路径后成功。备份哈希`8a59ea43f4931d17e66065db67f40911ce7262b50f297c19ab0746520854cac1`与原基线相同，1.3.57完整目录保留。
- 验证：有效逻辑24项；9份文本UTF-8无BOM、差异空白检查通过，ASAR6份入口/模块/renderer与当前文件字节一致、版本源一致。ASAR首次辅助脚本因Windows路径分隔符失败，改原生分隔符后通过，记录`archive-verification.json`；无需重建程序。用户配置SHA-256 `53cc2c54bb6d2283aa5a2a059c767ff9bda8d2a740a76a2d2d2e3631d87db7c3`未变化。
- Skill评估：requirement-understanding 95（30/20/16/15/9/5，固定前置与增量范围核对）、frontend-implementation 91（28/20/14/15/9/5，真实页面布局/键盘检查）、code-write-review 94（30/20/15/15/9/5，基线归属与写后编码复核）；均有可定向验证的直接收益，无Agent。相关记忆查询为空。
- 最终增量审查：仅4份业务源文件、3份相关测试和2份版本元数据相对本轮基线的差异；共同默认模型保护已修正并复验，未发现其余高置信度问题。轻量重构评估无必要扩大范围事项。
- 交付及回滚：[交付清单](../release/composer-controls-1.3.58/delivery.json)、[项目交接](HANDOFF.md)、[测试交接](TEST_HANDOFF.md)。恢复备份快捷方式即可返回旧完整目录；新旧均须保留完整win-unpacked资源。应用版本1.3.58以包内元数据及实际UI/IPC为准；沿用未签名构建，Windows PE框架资源版本仍为Electron45.0.0。
- 清理及限制：本轮候选和快捷验收进程均退出，两个fixture原路径均不存在；无新增待清理项。旧1.3.57用户主进程26044及其窗口保留，先退出旧程序再打开新版快捷入口，避免单实例复用旧窗口。模型HTTP/凭据使用loopback fixture，公网连通性未验证；用户配置哈希最终核对仍未变化。
- 待办/阻塞：无功能待办；本轮最终文档回读与UTF-8无BOM、链接和交付清单验证随落盘执行，不重复运行已通过的程序测试。

## 上一检查点：1.3.57 输入栏模型模式（已完成）

- 目标已完成：模型/回答深度区域缩小，模型名后增加模式一/二/三，分别使用现有模型一/二/三的完整配置。三模式共用同一聊天记录和上下文，切换不拆分聊天。
- 实现：模型宽度142→110px，字号13→12px；聊天保存所选模式及各模式模型，消息保存原请求模式以支持重试；旧数据默认模式一；缺少配置或模式三默认模型时明确提示并拒发。
- 修改范围：`src/lib/model-list.js`、`src/workbench.jsx`、`src/styles.css`、`electron/model-connection.cjs`、`electron/main.cjs`、`electron/conversations.cjs`，版本源和相关测试。没有Git元数据，修改前11份文本和旧快捷方式基线位于 `release/composer-model-modes-1.3.57/baseline`。
- 版本及交付：沿用既有SemVer补丁递增映射，1.3.56→1.3.57；失败重建不另加版本。完整程序为 `release/Scodex-Workbench-1.3.57/win-unpacked/Scodex工作台.exe`，根目录 `EXE快捷启动.lnk` 已切至该路径并保留 `EXE快捷启动.ico`。
- 有效验证：逻辑36项通过，其中模型列表3项随边界修正复测通过；最终实际EXE共享上下文/缺配置/键盘/600与1280px布局4/4；实际经根目录快捷方式启动及UI发送2/2。原候选的重试、重启等未受影响结果复用，未将失败的完整UI轮次记作通过。
- 增量审查：仅11份基线文本差异与新增UI脚本；修复模式三缺默认模型提示边界，未发现其余高置信度问题。12份代码/元数据文本UTF-8无BOM、差异空白和版本一致性检查通过。
- 交付身份与证据：[交付清单](../release/composer-model-modes-1.3.57/delivery.json)，含最终EXE/ASAR/快捷方式SHA-256、测试报告、截图、回滚信息；[项目交接](HANDOFF.md)、[测试交接](TEST_HANDOFF.md) 已同步。
- 清理：7个本轮UI临时profile已删除，测试启动的进程均已退出；基线、必要日志与截图保留。旧1.3.56完整目录保留，回滚仅恢复基线快捷方式；必须保留完整运行目录，不能单独复制EXE。
- 约束及限制：没有读取真实凭据、改动用户数据或终止用户进程；模型HTTP均为loopback fixture，未验证公网服务。未发布GitHub或替换其他安装目录。
- 待办/阻塞：无；基于本次差异的轻量重构评估未发现有必要扩大范围的事项。使用Skill：requirement-understanding、frontend-implementation、code-write-review。

<!-- formal-build-1.3.55:start -->
## 当前检查点：1.3.55 模型三完成态文案、正式入口与 GitHub 发布已完成

- 当前目标：模型三独立提案返回结构化结果后，活动记录显示“正在模型三 · 独立提案已返回结构化结果”，并将改动构建替换到正式入口。
- 已完成：`src/lib/message-presentation.js` 和两个相关断言已更新；版本 `package.json`、`package-lock.json` 为 `1.3.55`；候选与正式模型团队 UI 各 8/8，候选与正式 `restart-only` 各 2/2。
- 增量审查：模型三成功态前缀仅在独立提案结构化结果分支生效；模型一/二及失败、取消、评议状态保持原行为并由 43/43 逻辑测试覆盖，未发现高置信度问题。
- 产物：候选/正式 EXE SHA-256 `7322246bf4839585af09ab6518145bd26ce9a92dc74df9a8a37c30c512889ac9`；候选/正式 ASAR SHA-256 `208e5f3d9f4f86f047661851ba34d01949187ad39b37ddf3a2be99e169b6b4c4`；正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`，ASAR `E:/GDP/Scodex/App/resources/app.asar`。
- 回滚：旧 `1.3.54` EXE/ASAR 位于 `release/formal-build-1.3.55-20261108/rollback-1.3.54`；报告 `release/formal-build-1.3.55-20261108/formal-replacement.json`。
- GitHub：[`v1.3.55`](https://github.com/song123-jian/-0/releases/tag/v1.3.55) 已正式发布；资产 ID `724365962`、大小 `249798144` 字节，GitHub SHA-256 与正式 EXE 相同，证据 `release/formal-build-1.3.55-20261108/github-asset-upload.json`。匿名 HEAD 返回 302；完整匿名下载经代理/CDN 长时间无有效进度后停止，未完成下载文件哈希核验。
- 构建恢复：默认 Electron 打包因联网检查超时，改用本机 Electron 45、`npmRebuild=false`、`signAndEditExecutable=false` 和 `electronDist=node_modules/electron/dist` 后成功；失败目录未用于替换。
- 限制：三模型完整流程使用 loopback fixture；本轮未读取、打印或落盘模型凭据，未新增公网请求。

<!-- formal-build-1.3.55:end -->

<!-- formal-hello-1.3.54:start -->
## 当前检查点：正式入口真实 `你好` 连通性与上限审计已完成

- 当前目标：在正式 `1.3.54` 入口验证保存连接、确认模型三完成态文案已交付，并核对模型上下文/输出无应用层固定上限。
- 已完成：正式 EXE 发送一次 `你好`，HTTP 200、完成事件、模型 `gpt-6.1-sol`、输出 31 tokens、退出码 0；连接配置哈希不变，隔离凭据副本已清理。响应长度 40，严格等于 `你好` 的断言为 false，已如实记录。
- 文案状态：源码和正式包中的模型三结构化成功态为“正在模型三 · 独立提案已返回结构化结果”；1.3.55 候选/正式模型团队 UI 各 8/8，候选/正式重启验收各 2/2。
- 上限结论：上下文压缩、服务默认输出、模型轮数/工具调用路径均为动态或无限；文件大小、列表/地址/密钥格式、技能与日志边界保留为资源防护；讨论等待超时保留为失败重试和诚实降级条件。
- 证据：`release/formal-build-1.3.54-20261108/formal-hello/external-latency.json`；交接同步写入 `docs/HANDOFF.md`、`docs/TEST_HANDOFF.md`。
- 遗留：本轮三个临时 profile 因策略拒绝删除，均已移入根目录 `手动删除/` 待手动删除；连通性记录已归档于项目交接，基线提交为 `0683956`。

<!-- formal-hello-1.3.54:end -->

<!-- formal-build-1.3.54:start -->
## 当前检查点：1.3.54 三模型完成态文案与正式入口替换已完成

- 当前目标：修正三模型讨论活动记录的完成态文案，使模型三独立提案完成后显示“模型三 · 独立提案已返回结构化结果”，并构建替换正式 EXE。
- 已完成：`src/lib/message-presentation.js` 和 `src/components/agent-activity.jsx` 完成状态格式与详情去重；相关单元/UI 断言已补齐；版本 `package.json`、`package-lock.json` 为 `1.3.54`。
- 有效验证：`node --test tests/message-presentation.test.mjs tests/model-team.test.mjs` 43/43；候选模型团队 UI 8/8；候选/正式 `restart-only` 各 2/2；`node --check` 与 `git diff --check` 通过。
- 产物：候选/正式 EXE SHA-256 `f77326e9b380482b4c126df5d1481921600f41e122c7788b1057e5e775767e4c`；候选/正式 ASAR SHA-256 `00b39e491f3413e054c42416fc3456d9824cf1e8b5bb52a72a054cf80a553563`；正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`，ASAR `E:/GDP/Scodex/App/resources/app.asar`。
- 回滚：旧 `1.3.53` EXE/ASAR 位于 `release/formal-build-1.3.54-20261108/rollback-1.3.53`；只恢复这两个应用文件即可回滚。
- 证据：`release/formal-build-1.3.54-20261108/formal-replacement.json`、`candidate-ui/model-team-ui.json`、`candidate-restart/cdp-ui-verification.json`、`formal-restart/cdp-ui-verification.json`。
- 限制：三模型完整流程为 loopback fixture；本轮未读取、打印或落盘凭据，未新增公网请求；正式入口最终无 Scodex 进程。

<!-- formal-build-1.3.54:end -->

<!-- formal-build-1.3.53:start -->
## 当前检查点：1.3.53 三模型提案状态修正、正式构建与 EXE 替换已完成

- 当前目标：三模型独立提案在结构化响应完成后显示“已模型一/二/三 · 独立提案”和“独立提案已返回结构化结果”，并交付正式 `1.3.53` 入口。
- 已完成：候选模型团队 UI 8/8；三路提案的实际保存操作记录均为 `succeeded`；候选与正式 `restart-only` 各 2/2；正式 EXE/ASAR 已替换。
- 产物：候选/正式 EXE SHA-256 `4ef974adec0feaa30543fa0defafdb0216d6411d385adf2c58f941810f04cddf`；候选/正式 ASAR SHA-256 `946b13e32740401bf29d1d065a815af6acdf74a3d2ad71bff7ecb6f6e80c4c63`。正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe`，ASAR `E:/GDP/Scodex/App/resources/app.asar`。
- 回滚：`release/formal-build-1.3.53-20261108/rollback-1.3.52`，仅含正式替换前的 EXE/ASAR。
- 有效证据：三模型 UI `release/formal-build-1.3.53-20261108/candidate-ui-r7/model-team-ui.json`；候选重启 `release/formal-build-1.3.53-20261108/candidate-restart/cdp-ui-verification.json`；正式重启 `release/formal-build-1.3.53-20261108/formal-restart/cdp-ui-verification.json`；替换报告 `release/formal-build-1.3.53-20261108/formal-replacement.json`。
- 限制：本轮未新增业务源代码，未重复发送公网模型请求；完整三模型 UI 证据使用 loopback fixture，不能代表公网模型质量、速度或费用。

<!-- formal-build-1.3.53:end -->

<!-- formal-build-1.3.52:start -->
## 当前检查点：1.3.52 正式构建、EXE 替换与真实连通性已完成

- 当前目标：将当前工作区源码构建为 `1.3.52` 正式 EXE 并替换正式入口，只替换 EXE/ASAR，保留用户数据、配置和凭据。
- 已完成：候选构建、候选/正式 `restart-only` 各 2/2、回滚备份、正式入口替换和包版本核对；候选与正式哈希一致，最终无 Scodex 进程。
- 产物：候选/正式 EXE SHA-256 `361b5fbbc081f7c35708def6fbc5a46ffed885690606060622ada4011b009bce`；候选/正式 ASAR SHA-256 `a16c3aaad20d0df0d98ce25e95c414a3f13d2c0fd1df44d19687451198042473`。候选目录 `release/formal-build-1.3.52-20261108/candidate/win-unpacked`。
- 回滚：`release/formal-build-1.3.52-20261108/rollback-1.3.51`，仅含正式替换前的 EXE/ASAR。
- 有效证据：替换报告 `release/formal-build-1.3.52-20261108/formal-replacement.json`；候选 UI `release/formal-build-1.3.52-20261108/candidate-ui/cdp-ui-verification.json`；正式 UI `release/formal-build-1.3.52-20261108/formal-restart/cdp-ui-verification.json`；真实 `你好` HTTP 200 记录 `release/formal-build-1.3.52-20261108/formal-hello/hello-verification.json`。
- 附件路径状态：消息路径隐藏、预览和原生 Explorer 选择相关三场景通过；完整重跑在无关旧快捷键断言处停止，保留报告但不扩大为整体通过。
- 清理与限制：正式入口已退出且无残留 Scodex 进程；构建沿用本地未签名路径，真实请求仅验证一次已保存默认配置的 `你好`。
- 最终增量审查：正式构建阶段未新增源代码；版本元数据、候选/正式产物身份、回滚范围和交付报告已定向核对，未发现高置信度问题。`src/workbench.jsx` 的两处既有尾随空白提示保留，未纳入本轮清理。

<!-- formal-build-1.3.52:end -->

<!-- formal-build-1.3.51:start -->
## 当前检查点：1.3.51 正式构建与 EXE 替换已完成

- 当前目标：将当前工作区源码构建为 `1.3.51` 正式 EXE 并替换正式入口，只替换 EXE/ASAR，保留用户数据、配置和凭据。
- 已完成：版本元数据递增；`npm run build` 退出0；本机 Electron 45 本地打包候选退出0；候选与正式 `restart-only` 验收各2/2通过；候选包内版本和关键模块逐字节核对通过。
- 产物：候选/正式 EXE SHA-256 `1067e12eabcdc93ce3068db79e01443119c41192451393d8ae2274aa71b559c0`；ASAR SHA-256 `4683aa2607333ba40cd1ea212869b1169f168efb721acc6438177aee4ffb93b9`。候选目录 `release/formal-build-1.3.51-20261108/candidate/win-unpacked`。
- 回滚：`release/formal-build-1.3.51-20261108/rollback-1.3.50`，仅含正式替换前的 EXE/ASAR。
- 有效证据：正式替换报告 `release/formal-build-1.3.51-20261108/formal-replacement.json`；候选 UI `release/formal-build-1.3.51-20261108/candidate-ui/cdp-ui-verification.json`；正式 UI `release/formal-build-1.3.51-20261108/formal-restart/cdp-ui-verification.json`。
- 限制：公网模型、真实凭据发送和完整团队 UI 未在本轮正式重启验收；最终无 Scodex 进程，临时 profile 已清理。

<!-- formal-build-1.3.51:end -->

<!-- formal-build-1.3.50:start -->
## 当前检查点：1.3.50 正式构建与 EXE 替换已完成

- 当前目标：将当前工作区源码构建为 `1.3.50` 正式 EXE 并替换正式入口，只替换 EXE/ASAR，保留用户数据、配置和凭据。
- 已完成：版本元数据递增；`npm run build` 退出0；本机 Electron 45 本地打包候选退出0；候选与正式 `restart-only` 验收各2/2通过；模型连接、上下文压缩和模型团队定向测试67/67通过。
- 产物：候选/正式 EXE SHA-256 `f2a665a8206981f1bcc276f39ba32b55875311c865ebf8e8d07e33cade2f2b5a`；ASAR SHA-256 `7ece575c96621e827eff01771f8f5049e3da609177698ce651b2f5cda2b6aaea`。候选目录 `release/formal-build-1.3.50-20261108/candidate-r2/win-unpacked`。
- 回滚：`release/formal-build-1.3.50-20261108/rollback-1.3.49`，仅含正式替换前的 EXE/ASAR。
- 有效证据：正式替换报告 `release/formal-build-1.3.50-20261108/formal-replacement.json`；候选 UI `release/formal-build-1.3.50-20261108/candidate-ui/cdp-ui-verification.json`；正式 UI `release/formal-build-1.3.50-20261108/formal-restart/cdp-ui-verification.json`。
- 限制：公网模型、真实凭据发送和完整团队 UI 未在本轮正式重启验收；最终无 Scodex 进程，临时 profile 已清理。

<!-- formal-build-1.3.50:end -->

<!-- formal-build-1.3.49:start -->
## 当前检查点：1.3.49 模型二命令通道正式构建与 EXE 替换已完成

- 当前目标：把包含模型二编辑型子任务命令通道修复的 `workbench` 源码构建并替换到正式入口，只替换 EXE/ASAR，保留用户数据、配置和凭据。
- 版本与候选：`package.json`、`package-lock.json` 为 `1.3.49`；构建和候选目录打包已成功。候选 `release/formal-build-1.3.49-20261108/candidate-local/win-unpacked/Scodex工作台.exe`，EXE SHA-256 `9a8f469de0869fc563a1e99dadf51d4179a47c61818a9ad2f750940f99bf4ed2`，ASAR SHA-256 `4ae6b35c38b53dd2e6376186d2dec7d23e75b74acec49dfb91165436180ce83d`；包内版本 `1.3.49`。
- 正式替换：`E:/GDP/Scodex/App/Scodex工作台.exe` 与 `resources/app.asar` 已同步候选哈希；替换前 `1.3.48` 已保存到 `release/formal-build-1.3.49-20261108/rollback-1.3.48`。正式替换报告为 `release/formal-build-1.3.49-20261108/formal-replacement.json`。
- 定向验收：候选和正式入口 `restart-only` 各 2/2 通过，报告分别位于 `release/formal-build-1.3.49-20261108/candidate-local-ui/cdp-ui-verification.json` 和 `release/formal-build-1.3.49-20261108/formal-restart/cdp-ui-verification.json`；临时 profile 已清理，最终检查无 Scodex 进程。
- 增量审查：本轮覆盖模型二 `run_command` 通道、编辑任务自身命令例外、其他编辑任务互斥、规划任务只读边界和对应测试；未发现高置信度问题。公网模型与真实凭据未在正式重启验收中验证。

<!-- formal-build-1.3.49:end -->

<!-- formal-build-20261108:start -->
## 当前检查点：动态上下文压缩 1.3.48 正式构建与 EXE 替换已完成

- 当前目标：将 `E:/GDP/Scodex/workbench` 当前源码构建为正式 EXE，并替换正式入口；只替换应用 EXE/ASAR，保留用户数据、配置和凭据。
- 版本与候选：`package.json`、`package-lock.json` 为 `1.3.48`；`npm run build` 与 `npx electron-builder --win dir --x64 --config.directories.output=release/formal-build-1.3.48-20261108/candidate` 均退出 0。候选 `release/formal-build-1.3.48-20261108/candidate/win-unpacked/Scodex工作台.exe`，EXE SHA-256 `36272dad0f5ca6a702776c97e45c53cfd4624b500ff70a6eb5c82b6b4ff4b2d9`，ASAR SHA-256 `fb2c7d0be870fd56330c1dc81611d3e8abf01842b89b7d91daa5abf58897d464`；包内版本 `1.3.48`，关键模块与源码哈希一致。
- 正式替换：`E:/GDP/Scodex/App/Scodex工作台.exe` 与 `E:/GDP/Scodex/App/resources/app.asar` 已同步候选哈希；替换前版本 `1.3.47` 备份于 `release/formal-build-1.3.48-20261108/rollback-1.3.47`，回滚只恢复这两个应用文件。
- 验证：候选和正式入口 `SCODEX_CDP_SCOPE=restart-only` 均 2/2 通过，报告分别为 `release/formal-build-1.3.48-20261108/candidate-ui/cdp-ui-verification.json` 和 `release/formal-build-1.3.48-20261108/formal-restart/cdp-ui-verification.json`；覆盖启动、版本、设置保存、退出重启、状态恢复和进程清理。
- 清理与限制：候选、正式验收的临时 profile 已清理。公网模型请求、真实凭据发送和完整团队 UI 不在本轮正式 EXE 重启验收范围。

<!-- formal-build-20261108:end -->

<!-- model-role-labels-20261108:start -->
## 当前检查点：模型角色显示名称、三模型协作与正式入口替换已完成

- 目标：设置界面将主模型、探索子模型、顾问模型统一显示为模型一、模型二、模型三；内部字段、DOM ID、配置结构和调度逻辑保持不变。
- 已修改：`src/components/model-team-settings.jsx`、`src/components/model-connection-panel.jsx`、`src/components/model-connection-dialog.jsx` 的角色文案；对应更新 `tests/workspace-model-ui.cjs`、`tests/model-team-ui.cjs`。
- 已完成：角色文案；候选工作区模型 UI 5/5；模型团队 UI 8/8。报告 `release/model-role-labels-20261108/team-ui-retest-2/model-team-ui.json`，同一 1.3.45 候选 SHA-256 `ea7e51b8e2f2457e49a0d9ed077a0a6af448d2dbda425a1f62774dc3be2d8677`；真实 loopback/UI 中验证三个顾问阶段、两个并行只读子任务、运行中任务ID完成门禁、主模型写入回读、失败与取消、模型一/二/三文案、窄屏布局和设置最终截图。
- 已修正测试夹具：模型二请求允许省略 `max_tokens`（沿用服务默认值），运行中任务检查以 coordinator 返回的 status 和 task ID 为依据，不匹配固定中文自然语言。`node --test tests/model-team.test.mjs` 20/20通过，含 `running/queued/complete/error/cancelled` 状态检查。
- 当前目标：模型一、二、三分别独立提出同一任务方案，再各自交叉评议全部方案；按正确性25%、证据20%、任务适配20%、约束15%、可验证性10%、风险10%计算中位分。低于60分或约束低于5/10的方案淘汰；明确胜者需得分至少70且领先至少10分才获100%，否则按合格方案评分归一并以最大余数法分配100%。模型一独占实际写入和命令执行。
- 已实施：`electron/model-team.cjs` 提案/评议解析、评分和份额算法；`electron/main.cjs` 三服务独立调用与执行边界；`src/components/model-team-settings.jsx` 团队说明；`tests/model-team.test.mjs` 定向覆盖；`tests/model-team-ui.cjs` loopback UI 场景。
- 已修复并验证：用量账本 `electron/model-usage.cjs` 白名单增加 `debate-proposal`/`debate-review`；持久化测试在关闭并重开账本后确认两个阶段均保留。`node --test tests/model-observability.test.mjs tests/model-team.test.mjs` 31/31通过，`node --check electron/model-usage.cjs`通过。
- 最终候选：隔离快照构建的1.3.45候选 `release/model-debate-20261108-r2/candidate/win-unpacked/Scodex工作台.exe`；EXE SHA-256 `ed74dd3b022399c290f71ab906131642367a25e3d96592a3684c84c3f1b01e9d`，ASAR SHA-256 `293d0951c33c4c409c1399057ba111d3d5f6b7958e387a402bc8de0a0fdb35a8`，包内目标模块与快照一致。Vite 1836 modules、305项许可清单及 Electron `--win --dir --x64`候选构建通过。
- 候选实际UI 8/8通过，覆盖独立提案、交叉评议、34/33/33份额、模型一写入所有权、失败/取消、用量历史及窄屏设置；阶段历史含 `debate-proposal`、`debate-review`、`repeated-error`、`completion`。报告 `release/model-debate-20261108-r2/team-ui/model-team-ui.json`，截图 `release/model-debate-20261108-r2/team-ui/model-team-settings.png`。
- fixture清理：删除被自动审批策略拒绝，未重试；本轮唯一fixture已移到 `手动删除/model-debate-20261108-r2-fixture-02c7e326-1426-4c50-b319-54de5246c9c8`，原测试路径不存在，待手动删除。报告和截图保留。
- 正式版本递增：`package.json` 与 `package-lock.json` 已同步为1.3.46；从隔离快照构建的最终候选位于 `release/model-debate-20261108-r3/candidate/win-unpacked/Scodex工作台.exe`，EXE SHA-256 `3a8d995b98a21ecdf41950cec47ace1266c0669d2bf678c5688afc9075afa6d9`，ASAR SHA-256 `e0d6ae586c54af920b731ca5317e80d5fa2b5f3a9a5daadd9140f1690e20db10`。
- 正式入口已替换：`E:/GDP/Scodex/App/Scodex工作台.exe` 与 `E:/GDP/Scodex/App/resources/app.asar` 已同步1.3.46候选；旧1.3.45备份于 `release/model-debate-20261108-r3/rollback-1.3.45`。正式包内版本、入口、哈希核对通过；报告 `release/model-debate-20261108-r3/formal-replacement.json`。
- 正式验证：正式工作区模型 UI 5/5通过；正式profile最小回归读取标题、版本1.3.46、2条会话、模型一/二/三和模型二/三服务标签，进程正常退出，`conversations.json`、`model-connection.json`、`settings.json` 前后哈希不变。完整团队UI正式复跑在第5项附近出现CDP超时，报告保留为失败证据，不标为通过。
- 正式UI验证fixture已移入根目录 `手动删除/` 对应 `model-debate-20261108-r3-formal-ui-fixture-*` 和 `model-debate-20261108-r3-formal-workspace-fixture-*`，原测试路径不存在；真实公网模型质量不属于 loopback 验收。
<!-- model-role-labels-20261108:end -->

<!-- message-resource-links-20261107:start -->
## 上一检查点：消息路径、第三工作区与 1.3.45 设置参照对齐（已完成）

- 目标：消息中的本地文件/目录点击后在第三工作区定位、预览，并在资源管理器打开/定位；设置内浏览器、电脑操控、SKILL、配置及快捷键参照 E:/GDP/.codex 可核实字段和代码。
- 版本：正式1.3.45；候选目标1.3.45，沿用已确认SemVer末位递增映射。正式入口 `E:/GDP/Scodex/App/Scodex工作台.exe` 已替换并重开，候选与正式文件哈希一致。
- 已实施：新增 message-files.cjs、message-paths.js、message-files-panel.jsx；参考设置白名单读取/应用与SKILL来源；电脑操控颜色/语言；浏览器审批与快捷键。15个原有文件基线在release/message-workspace-20261107/baseline.json及baseline/，其他既有修改保留。
- 模型适配：自动工具通道、推理强度回退和顾问请求适配已保留保存配置不变；仅在服务明确拒绝当前参数时按请求切换，已用隔离响应完成定向复测。
- 有效验证：1.3.44 的消息路径/第三工作区结果继续有效；1.3.45 配置、快捷键、插件和托盘定向测试10/10通过。`npm run build` 与 portable 构建退出0。候选真实 UI 6/6通过，正式入口重开 UI 核验通过；覆盖浏览器 TOML、电脑操控 JSON 未知字段、插件开关、SKILL 参考目录重启恢复与列表刷新、快捷键触发/恢复。候选/正式 EXE SHA-256 均为 `3A8B8E88B55DEEF3AB6CB633688852E56B3F99BF7A1CEDDC63E3A09DC38AC096`，ASAR 均为 `16511D44521536E9FCEBA8384EE6942E76853E06BC7BD2F40527FDA796FA9393`；候选报告 `workbench/release/workbench-settings-20261108-r3/integration-settings-ui-verification.json`，正式报告 `release/settings-reference-20261108/formal-replacement.json`。
- 模型适配复测：`node --test tests/model-adapter.test.mjs tests/model-compatibility.test.mjs tests/model-team.test.mjs tests/model-connection.test.mjs` 共68/68通过；覆盖原生/兼容JSON通道、推理强度、顾问模型、取消和错误边界。
- 参考证据：只读读取config.toml、browser/config.toml、computer-use/config.json；browser与computer-use目录只有配置/运行数据，没有完整Codex宿主源码；不复制凭据、会话、数据库。
- 当前步骤：配置目录写队列已实施并通过10/10定向测试；模型适配复测68/68通过；候选实际 UI 6/6通过；正式入口已备份旧1.3.44、替换为1.3.45并重开，正式 UI/哈希/用户数据保留核验通过。PID 29240 保持运行。
- 约束：参考目录只读；保留真实聊天、凭据与无关源码；路径仅作为数据；无子Agent；使用Skill requirement-understanding（95：30/20/16/15/9/5）。
- 待办：本轮实施与验证已完成；保留正式 PID 29240、回滚备份和验证报告。模型公网请求仍不属于本轮隔离验收范围；并发丢更新已修复并验证。
<!-- message-resource-links-20261107:end -->

<!-- advisor-repair-20261107:start -->
## 上一增量检查点：1.3.43导航缩小及正式替换完成

- 实际结果：正式入口已更新到缩小版1.3.43，EXE ff62a366831b92fba6ec200d0549a2aac0cb32114c2b2aec174a4dfcdca5b02e，ASAR a11e9f6480c4804caf45da933be898273f16783e3c4293d46df1610a7324dd59；81正式文件及94包内源码资源一致。实际候选悬停/点击/键盘/窄窗口通过，正式真实profile3组通过，PID31140常规重开。
- 保留与限制：2会话/2消息、原字段、活动会话及配置凭据均保留，仅顾问5-5→4-6；App.previous旧1.3.42的29文件核验。11夹具已移手动删除fixtures，25旧源码在obsolete-source；自动删除被blocked by policy拒绝，不重试。
- 有效结果：原适配/三角色保存/真实五模型和顾问结果见双交接同标记节；Kiro单次格式用例失败保留，后续双关口通过；没有必要追加重构。25文件审查及最新CSS尺寸差异复审通过。
- 证据：release/advisor-repair-20261107/final-incremental-verification.json、formal-compact-profile-verification.json、compact-ui/workspace-model-ui.json、cleanup-verification.json。本节范围无剩余功能待办；用户新文件访问需求在最新检查点继续。
<!-- advisor-repair-20261107:end -->

<!-- repo-sync-1.3.30-20261101:start -->
## GitHub 同步与发布 1.3.30（2026-11-01，已完成）

- 目标和状态：song123-jian/-0源码同步、PR合并、v1.3.30安装包正式发布及完整匿名下载验证全部完成；无本轮运行中有限任务或待实施事项。
- 发布检出：E:/GDP/Scodex/-0-import-candidate-20261031；feature/release-1.3.30；提交447927139ed12cf8bf1eb58ecea689bf76b86428；工作区干净。PR #1已合并，main和v1.3.30均ba3e6f3ff5e28a7dc350269bff00854adba32323，与发布分支文件树相同。
- 范围：本轮12文件增量，相对原main共116文件（53新增/63修改），原1.3.29提交范围核实为112文件。136桌面快照输入135字节相同，package仅省略3未完成手机脚本，其他字段一致。不上传手机、1.3.31并发、本机交接、用户数据、凭据或运行ZIP。
- 验证：完整串行403项首轮402通过/1个Windows清理EBUSY；仅测试cleanup等待自身helper退出后定向7/7，无剩余失败，去重覆盖403项。正式1.3.30逻辑21/21、候选UI6/6、正式UI3/3及安装身份复用。
- 发布：https://github.com/song123-jian/-0/releases/tag/v1.3.30；下载https://github.com/song123-jian/-0/releases/download/v1.3.30/Scodex-Workbench-Setup-1.3.30-x64.exe。匿名完整流式下载HTTP200、189909290字节、SHA256 0eded7ad986368d264070805ea3045545365282aafb6f0172e86431be503f39f，与GitHub digest及本机正式安装包一致。
- 本机产物：E:/GDP/Scodex/Scodex-Workbench-Setup-1.3.30-x64.exe；沿用已验收1.3.30，不重复递增、重建或替换本机当前程序；原1.3.29分支/安装包及App/profile备份保留。后续并发版本独立管理。
- 清理：3个失败测试残留已从Temp/scodex-session-中文 space-iXh1Xg移至workbench/手动删除/repo-sync-1.3.30-20261101/scodex-session-iXh1Xg，原址不存在、无运行依赖，待手动删除。删除曾被自动审批blocked by policy拒绝，未执行；未创建依赖联接或下载副本。
- 限制：内置浏览器控制失败后只读确认一次，不重复UI；未取得最终网页截图，采用真实GitHub API、Git回读和完整匿名下载验收。公网模型、第二台实体电脑/克隆MachineGuid、高级浏览器、真实卸载和手机未纳入。
- 证据：[最终核验](../release/repo-sync-1.3.30-20261101/final-delivery-verification.json)、[匿名下载](../release/repo-sync-1.3.30-20261101/public-download-verification.json)、[审查](../release/repo-sync-1.3.30-20261101/incremental-review.json)、[测试](../release/repo-sync-1.3.30-20261101/test-summary.json)、[清理](../release/repo-sync-1.3.30-20261101/cleanup-verification.json)。双交接最终回读见handoff-final-verification.json。
- 洞悉评估：直接发布范围无达标追加重构/下一步候选。使用Skill：computer-use（96）；无Agent。
<!-- repo-sync-1.3.30-20261101:end -->

## 电脑操控提示与 Esc 停止（2026-11-01，1.3.29已交付）

- 当前目标与状态：非激活置顶提示、停止按钮、跨应用Esc已实现，正式1.3.28→1.3.29构建、安装及实际入口验收完成；无待实施功能或运行中的有限任务。
- 约束：保留并发源码和用户数据；不新增依赖、不写真实凭据、不做公网集成及高级浏览器自动化交付。使用Skill：无；无子Agent。
- 实现范围：desktop-control独立提示窗和受限停止IPC、desktop-escape原生WH_KEYBOARD_LL、main/desktop-tools生命周期、helper自有按键标记；桌面owner共享提示，Esc/停止取消桌面任务，普通聊天继续，finally/退出/EOF释放。
- 正式入口：[Scodex工作台.exe](../../App/Scodex工作台.exe)，FileVersion1.3.29、ProductVersion1.3.29.0；EXE SHA256 b0ae1303ece73ebf2d7c4e96f0d28f31fdf69bc97926887aa5d55837e58a751a；ASAR SHA256 e4554953159d73f45ff9763ea4e50bf328631500d3a155f628221e1824f2d5e9。
- 安装包：[1.3.29 Setup](../../Scodex-Workbench-Setup-1.3.29-x64.exe)，SHA256 a2cdd94f8f08fd39223a48ebe80d06bfad24dedec0bbb19fed662d0e43318fa9；固定快照Vite与electron-builder dir成功，已验收候选执行prepackaged NSIS及安装均退出0。
- 有效验证：辅助8/8、候选6/6、正式5/5分别通过（范围重叠，不相加）；提示不抢焦点、模型Esc、外部焦点全局Esc、按钮、无后续输入、普通聊天继续、错误/正常/重启清理均有实际EXE证据。500×66最终提示截图在当前设备、页面、视口和数据状态下无可见错误。
- 审查与最终核对：无Git，使用implementation-baseline.json及baseline；17个本轮文件增量审查完成，最终17项哈希未漂移，版本/正式EXE/ASAR/Setup身份一致。直接范围无必要追加重构或达标下一步候选。
- 恢复记录：首快照缺icon补齐后构建成功；首轮前台夹具失败仅修新驱动为原生点击后6/6通过；最终元数据断言将开始菜单默认图标误判为路径异常，改按有效图标解析后记录通过，未修改产品或降低功能断言。失败证据均保留。
- 运行与回滚：桌面/开始菜单/根目录快捷方式均指向正式App；根目录描述已同步1.3.29。正常关闭程序后用保留的[1.3.28 Setup](../../Scodex-Workbench-Setup-1.3.28-x64.exe)安装回原App目录，保留用户数据；详见正式替换记录。
- 清理：三个UUID夹具目录均删除、相关测试进程退出。三份构建中间目录移至[手动删除](../手动删除/desktop-stop-20261101)，无运行依赖；source-snapshot/node_modules为项目依赖junction，目标未改，不应递归处理链接目标。最终Setup、旧Setup、基线、测试源码和必要证据保留。
- 限制：仅外部模型HTTP使用loopback；实际EXE/React/IPC/Windows窗口输入/hook真实。公网模型、高级浏览器、真实卸载和未变化业务路径未纳入通过结论。
- 恢复与证据：[项目进度交接](PROJECT_PROGRESS_HANDOFF.md)、[成功流程交接](SUCCESS_WORKFLOW_HANDOFF.md)、[正式替换](../release/desktop-stop-20261101/formal-replacement.json)、[正式5组](../release/desktop-stop-20261101/formal-ui/desktop-stop-ui-verification.json)、[最终增量核对](../release/desktop-stop-20261101/final-incremental-verification.json)、[清理](../release/desktop-stop-20261101/cleanup-verification.json)。后续只读取本节和双交接相关章节，不重跑有效结果。

<!-- desktop-stop-20261101:end -->

## 主/子模型协同 1.3.28（2026-11-01，当前正式版本）

- 当前目标与状态：主模型分派、并发写入保护、独立子模型连接及正式安装交付已完成；Grok按用户指令排除出本轮上线验收。
- 交付入口：`E:/GDP/Scodex/App/Scodex工作台.exe`（SHA256 `ee178876e4e7516dc81b7816a2bd520795efd33811955b9637a9c197bd04fa1c`）；安装包`E:/GDP/Scodex/Scodex-Workbench-Setup-1.3.28-x64.exe`（SHA256 `5d862a1754662ecb0092155b6ddc629dcaed979421914fa2cdb825541b457aa2`）。1.3.27安装包保留回滚。
- 关键约束：不同API地址使用独立密钥，子模型只在授权路径内操作；真实密钥不写入项目文件。Grok生成返回HTTP 426，作为排除项记录，不宣称通过；真实卸载和未变化业务路径未验收。
- 有效验证：定向测试41/41、Vite构建、portable／安装候选解包／正式入口各4/4实际验收通过；GPT、Claude Kiro、聚合国模各发送“您好测试”均HTTP 200且有回复；本轮增量审查无剩余高置信度问题。
- 直接文档与证据：[项目进度交接](PROJECT_PROGRESS_HANDOFF.md)、[成功流程交接](SUCCESS_WORKFLOW_HANDOFF.md)、[正式替换](../release/subagent-release-20261101/formal-replacement.json)、[正式入口验收](../release/subagent-release-20261101/formal-ui/subagent-ui-verification.json)、[增量审查](../release/subagent-release-20261101/incremental-review.json)。本次仅调整交接文档的当前章节位置及排除项表达，未改程序。
- 待办与风险：无本轮程序实施事项；三模型公网结果是单次观测。两份已无运行依赖的构建中间目录移至项目“手动删除”，待人工清理，不影响正式程序。

## 工作台四项补齐（2026-11-01，已交付）

- 当前目标：四项本地能力补齐与指定模型单项实测；均完成本轮授权范围。
- 范围边界：排除公网Git/MCP及高级浏览器自动化；保留并发源码和用户数据，不写入凭据。
- 最终1.3.25：原快捷方式可用；正式SHA256 155689a53cb088503d1c840aeff62938dd007e070ad179ff344b0189a74bd403；固定快照77项包一致。
- 有效证据：ui11组、final-ui7组、real-model3组、portable-ui3组、formal-ui3组均通过；最后10项辅助通过。各范围存在重叠，不相加冒充去重用例数。
- 真实模型：catbee.online/v1，deepseek-v4-flash，HTTP200，回复SCODEX_REAL_MODEL_OK，81 tokens。旧401已因更换凭据解决。
- 主要文件：agent-runtime/model-usage、supabase-sync/sync-snapshot/sync-crypto、artifact-tools/office-artifacts、main/preload/conversations、workbench/model-connection/settings/composer/document-preview；审查清单见incremental-review.json。
- 完成：源码与测试、固定快照构建、实际功能补验、正式原子替换/重启、23文件定向审查、双交接更新。无运行中的有限任务。
- 限制：Supabase公网与真实生图未配置；Office预览为内容排版。并发source-snapshot后的一行模型归一化仍保留在工作源码，非本轮写入。
- 清理：5轮fixture已清除；构建中间目录删除被自动审批拒绝，已移手动删除；依赖junction原位保留。清单见release/workbench-completion-20261101/cleanup-verification.json。
- 交接：docs/PROJECT_PROGRESS_HANDOFF.md与docs/SUCCESS_WORKFLOW_HANDOFF.md本节；回滚见formal-replacement.json。恢复时只读本节与交接相关章节。
- Skill：systematic-debugging 92、test-driven-development 93；无子Agent。没有达标的必要追加重构候选。
<!-- workbench-completion-20261101:end -->

## 1.3.23 默认模型完整下拉选择（2026-11-01）

- 当前状态：修复、实际候选验收、正式替换及入口复验完成；当前正式版本以本节为准，后续为既有需求记录。原快捷方式仍可使用；正式文件名沿用1.3.20，FileVersion/ProductVersion和应用实际版本均1.3.23。
- 目标与结果：获取的模型全部保留为默认模型及子代理下拉选项；子代理可选“跟随主模型”，手动添加/删除及原有配置保存逻辑沿用。
- 根因与主要变更：原input+datalist按当前完整模型ID过滤候选，导致只见当前项；model-connection-panel.jsx改用完整form.models生成原生select，CSS补齐对应焦点、布局和窄视口样式。package和lock根版本1.3.22→1.3.23，仅一次递增，无新增依赖；README同步当前版本。
- 验证：8/8项模型逻辑通过，实际候选7/7组通过，替换后的正式portable入口4/4组通过；均核对实际版本/隔离目录、选择、保存/磁盘和退出重启。候选另验137项、手动维护、失败保持与1064×660布局；相关代码一次增量审查通过。
- 程序：[正式入口](../release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe)；[候选1.3.23](../release/model-picker-20261101/candidate/Scodex-Workbench-1.3.23-x64.exe)。两者SHA256 4f706e591b4da8196b95a8f29a7858252451a965f4aba13c51b46e546a2f2052、167376120字节；renderer assets/index-B9Mp2aJX.js。构建输入无漂移，69项electron/dist包内资源与本次构建源码一致。
- 替换与回滚：同卷File.Replace原子替换，快捷方式目标保持，描述已回读为1.3.23。旧1.3.22已保存为[回滚程序](../release/model-picker-20261101/Scodex-Workbench-1.3.22-rollback.exe)，哈希7cead37da042916ac7cdbaa83eeb4c10fe2dde20886c30f6a2b80cdfebbacf6c。需回滚时先关闭应用，再以此文件恢复正式路径；勿同时启动多个版本写同一profile。真实用户配置、模型凭据与业务数据未修改。
- 失败恢复：首个File.Replace调用的null备份参数被PowerShell转为空路径而拒绝，旧正式未变化；改用明确备份路径后完成替换，并取得正式路径4组新验收。旧RED失败是预期缺陷证据，不记为通过。
- 清理：所有本轮测试进程退出、三个UUID夹具目录删除、替换暂存文件已消费。自动审批拒绝递归删除解包构建目录，已从candidate/win-unpacked移至[手动删除目录](../手动删除/model-picker-20261101-unpacked)；该目录可手动删除，正式portable不依赖它。必要源码基线、证据、候选和回滚程序保留，无运行中的有限任务。
- 限制：只有外部模型列表HTTP由loopback夹具替代；实际EXE/React/IPC/磁盘链路真实。不证明公网模型生成或未变化的其他功能。既有Supabase等用户修改保留，本轮不扩展其验收结论。
- 轻量重构评估：直接差异范围未发现需追加重构的高置信度问题，无达标下一步候选。使用Skill：systematic-debugging 92（30/20/14/15/8/5）、test-driven-development 93（30/20/15/15/8/5）；无子Agent。
- 证据：[候选验收](../release/model-picker-20261101/full/model-picker-ui.json)、[正式入口验收](../release/model-picker-20261101/formal/model-picker-ui.json)、[构建](../release/model-picker-20261101/build-verification.json)、[替换](../release/model-picker-20261101/formal-replacement.json)、[增量审查](../release/model-picker-20261101/incremental-review.json)、[清理](../release/model-picker-20261101/cleanup-verification.json)。

| 已完成需求 | 状态 | 验收依据 |
| --- | --- | --- |
| 默认/子代理完整模型选择 | 完成 | 实际四模型、137模型、键盘、手动维护与错误保持 |
| 保存、磁盘与重启恢复 | 完成 | 候选及正式路径实际验收 |
| 1.3.23构建、替换和快捷方式 | 完成 | 包一致、最终哈希/版本、正式入口4组 |
| 增量审查与双交接 | 完成 | 本次差异与文档落盘核验；手动清理项已记录 |

<!-- model-picker-20261101:end -->

## 1.3.22 最高权限与模型列表修复（当前任务）

- 当前状态：两项修复已完成并通过实际程序验收；正式入口为1.3.22。文件名沿用旧名，实际FileVersion/ProductVersion均1.3.22。
- 目标与范围：模型获取替换旧项、137项标签及选择/保存/重启一致；完整访问支持项目外文件、本机命令和真实Windows桌面截图、点击、Unicode输入、组合键、滚动。
- 版本与程序：1.3.21 → 本轮1.3.22；同轮失败重建未重复递增。正式入口 release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe；候选 release/auto-interaction-20261031/candidate/Scodex-Workbench-1.3.22-x64.exe。
- 身份：最终候选和正式EXE SHA256均为 7cead37da042916ac7cdbaa83eeb4c10fe2dde20886c30f6a2b80cdfebbacf6c；70项electron/renderer包内容与核验时当前源码一致。
- 替换与约束：并发任务已覆盖相同候选，本任务核对后复用，不重复覆盖；快捷方式E:/GDP/Scodex/Scodex工作台.lnk仍指向约定入口，描述已更新1.3.22。按用户要求无旧EXE备份；用户数据配置保留，未结束用户进程、未推送远端。当前仓库仍仅认可song123-jian/-0。
- 有效验证：11项去重验收范围全部通过；原38项辅助结果保留为当时源码证据。实际EXE/React/IPC/文件/命令/Windows桌面真实，仅模型服务由loopback替代，不外推公网模型结论。
- 失败恢复：保留源码并发变化，改用最新统一候选；驱动分别修正保存等待、read_file行号契约、窗口显隐/前台、控件全选与菜单状态。原生桌面8步结果均成功，取消场景已从正式入口单独补验；未把失败报告整体标为通过。
- 清理与运行：本轮独立profile/项目/测试窗口均退出并清理，具体fixture清单见清理核验；构建基线与必要诊断保留。旧EXE无备份可回滚，可用相同已验收1.3.22候选重新安装；不触碰用户配置。
- 限制：使用当前Windows账号，不能绕过UAC或受保护桌面；明确网络限制、规划只读、取消保护继续生效。用户已清除持续goal，未重建goal或后台自动任务。
- 使用 Skill：systematic-debugging（既有96分）、test-driven-development（既有94分）；无子Agent。
- 证据：[聚合验收](../release/permission-models-20261031/acceptance-verification.json)、[包身份](../release/permission-models-20261031/build-verification.json)、[正式路径](../release/permission-models-20261031/formal-verification.json)、[增量审查](../release/permission-models-20261031/incremental-review.json)、[清理](../release/permission-models-20261031/cleanup-verification.json)。

| 已完成需求 | 状态 | 验收依据 |
| --- | --- | --- |
| 模型列表替换与全部标签、选择、重启 | 完成 | 最新候选137项实际UI与持久化 |
| 完整访问与真实桌面能力 | 完成 | 项目外写读/命令、8步桌面、禁用/规划/取消 |
| 正式EXE与快捷方式 | 完成 | 相同SHA、1.3.22、正式路径实际复验 |
| 增量审查、清理、双交接 | 完成 | 本轮定位证据及文档回读核验 |

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

| 当前任务 | 状态 | 阻塞/证据 |
| --- | --- | --- |
| 实现及定向GREEN | 完成 | 19产品文件；92项辅助覆盖通过 |
| 候选验收与正式替换 | 完成 | 1.3.22正式入口与候选同SHA；最终正式6/6 |
| 增量审查 | 完成 | 30文件，最新驱动已复审；69项包内文件一致 |
| 清理 | 完成记录 | fixture清除；两个staging移至精确手动删除目录 |
| 双交接 | 完成 | HANDOFF和TEST_HANDOFF均已落盘回读，内容/链接/UTF8无BOM通过 |

- 实际证据：[正式入口6/6](../release/auto-interaction-20261031/formal-entry-recheck/auto-interaction-ui-verification.json)、[unpacked16项](../release/auto-interaction-20261031/green-unpacked/auto-interaction-ui-verification.json)、[审查](../release/auto-interaction-20261031/incremental-review.json)、[清理](../release/auto-interaction-20261031/cleanup-verification.json)。
- 后续恢复只读本节与双交接对应章节；本轮无待实施功能，不重新扫描项目或重复有效测试。

- 失败恢复：ASAR校验的Windows路径已改path.normalize并通过；协作初次目标未绑定项目，改为真实UI创建绑定目标；增强操作断言后发现磁盘pending归一化的中间态误判，完成判据改为非cancelled、非error且有最终持久化回复后再核对操作。只改驱动，不降低断言、不改产品，不重复构建。
- 清理：所有本轮UI fixture已退出并清理；自动审批拒绝递归删除构建目录（blocked by policy），两个归属明确的中间目录已移至E:/GDP/Scodex/workbench/手动删除/auto-interaction-20261031/package-staging和candidate-unpacked，原路径不存在，待用户手动删除，不影响正式程序。[清理清单](../release/auto-interaction-20261031/cleanup-verification.json)。保留候选、基线、测试源码及必要证据。
- 轻量重构评估：共享toolPolicyAllowed已消除本轮工具权限门槛重复；现有证据未发现需追加重构的高置信度问题，不扩大范围。其他权限/模型列表、Supabase及公网独立待办仍依其原章节记录，不因本轮交付自动记为通过。


## 定时任务烟测诊断检查点（2026-10-31）

- 隔离EXE已通过renderer、旧历史迁移、Dashboard视口和定时任务创建/暂停；手动运行检查等待缺失凭据failed/output记录超时。
- 测试结束已清理profile，直接运行持久化证据未留存。下一步只读追踪IPC→服务→记录字段，按证据更新方案。

## Dashboard smoke恢复检查点（2026-10-31）

- 当前隔离EXE烟测已通过旧历史迁移、新建聊天和ActivityRail入口；失败于旧Dashboard标题/副标题断言，与现源码文案不符。
- 当前方案：对照真实Dashboard只更新 smoke 驱动文案及项目名预期，保留几何验收；写后定向检查并复测烟测。

## 候选烟测方案更新检查点（2026-10-31）

- 新建对话按aria-label定位后，烟测显露下一处旧`工作台首页`标签失败；当前真实按钮为`项目`。继续定位确认设置/侧栏/历史导航也存在陈旧UI标签。
- 当前方案已更新为仅修改候选 `tests/smoke.cjs` 的 UI标签与入口，并只复测隔离 smoke；产品代码不改。

## 候选烟测失败恢复检查点（2026-10-31）

- 全量候选验证：315/315 Node通过，构建和portable包已生成；烟测失败于旧`.new-task-button`选择器，真实EXE已加载且迁移历史可见。
- 当前方案：仅更新候选smoke驱动以匹配可访问名称/title，再复测隔离`workbench-changes`烟测；产品代码不变。

## 候选验证失败恢复检查点（2026-10-31）

- 首轮候选验证：依赖安装成功；`npm run dist`测试阶段305通过、2失败，未形成构建或烟测完成证据。
- 已定位：`storage.test.mjs`为`createConversation()`默认字段与`normalizeLibrary()`输出不一致；`settings.test.mjs`并发失败为Electron安装器/Windows文件竞争，单独运行通过。
- 当前方案：最小补齐`unreadResult:false`默认字段；定向复测storage/settings，随后构建与隔离`workbench-changes`烟测。无远端写入、无真实凭据。

# 执行检查点

## 目标与约束

- 当前目标：继续推进“完整运行能力与生态集成”，按 `docs/WORKFLOW_ACCEPTANCE.md` 的50项等权清单取得95%–100%的可追溯验收；当前已达到清单目标，但未完成或阻塞项仍计0，结论不外推为整个Codex或所有公网服务兼容。
- 项目：源码 `E:/GDP/Scodex/workbench`；目标远端 `https://github.com/song123-jian/-0.git` 为公开空仓库且无refs。源目录无Git元数据；准备单独的本地导入候选，排除父目录私有运行数据，未获发布授权前不推送、不建PR。
- 版本：本轮候选1.3.21已完成后台助手真实验收；正式版本formal entry is covered by 1.3.21; old 1.3.20 backup was not retained. Configuration and user data remain unchanged.
- 安全与范围：候选验收使用独立profile、fake home、隔离项目和loopback模型；不使用对话中粘贴的服务凭据，不把本机模拟作为真实公网验收。
- 双交接：项目 `docs/PROJECT_PROGRESS_HANDOFF.md`，成功流程 `docs/SUCCESS_WORKFLOW_HANDOFF.md`；本轮实施与测试前已读取相关章节，最终变更和验证已写入两份文档，回读核验见`release/workflow-completion-20261031/document-verification.json`。

## 当前阶段结果

| 项目 | 状态 | 证据或限制 |
| --- | --- | --- |
| 有效辅助测试 | 通过 | `node --test tests/agent-tools.test.mjs tests/skill-context.test.mjs` 19/19通过；记录见 `release/workflow-completion-20261031/targeted-tests.log` |
| 前端构建与候选包 | 可复用 | Vite 1822 modules通过；portable候选版本1.3.21，SHA256 `fe29cf99ab7719e12deb1667cc1749e55b6b46f7546f9da25057a5eb1b2368a4`；包身份/资源报告见 `prepackaged-build-verification.json` |
| 最新真实候选验收 | 通过 | 1.3.21实际候选四项检查通过；F10二进制／超量拒绝、错误与哈希回读可定位，驱动退出0；报告见 `skill-context-ui-verification.json` |
| 固定50项评分 | 48/50（96%） | 历史与本轮可定位证据已映射；F10通过，G10、M10因真实公网目标和授权缺失计0 |
| 新仓库导入 | 本地候选已建、待验证 | 空仓库克隆；218个选中文件逐项SHA一致。静态敏感格式/路径检查通过；依赖、定向测试、Windows构建/烟测和差异审查待做。未提交/推送 |
| 驱动差异审查 | 已完成 | 已复审F10会话ID和唯一提示词双重筛选、执行开关及错误断言；node --check通过，无高置信度问题 |
| 后台助手实际候选 | 通过 | WMI session 候选7/7通过；报告 `release/session-scheduler-20261031/candidate-wmi-ui-4/scheduled-background-ui-verification.json` |
| Formal version replacement and formal-entry recheck | complete | Target SHA 1B38F22036B0D62F673DB414188A8B283E123F6126BDD3EB2B70ACEBA1B0334D; File/ProductVersion 1.3.21; old 1.3.20 backup not retained; six session checks and independent dual-viewport recheck passed |

## 风险与待办

- F10恢复过程保留两份失败诊断：`skill-context-ui-f10-initial-failure.json`（新对话未开启执行）和`skill-context-ui-f10-persistence-failure.json`（历史记录误取）。最终候选四项检查通过；驱动已按新会话ID和唯一提示词共同筛选记录并退出0。
- 已完成评分更新、增量审查与双交接；最终盘点发现并安全移动4份遗漏的同类fixture，现8份fixture均位于精确手动删除目录，原Temp路径不存在、归属进程为0，未物理删除。清理清单见`release/workflow-completion-20261031/workflow-f10-runtime-cleanup.json`；最新文档验证已重生成并通过。
- 真实公网模型、Git认证/Push/PR、指定公网MCP及独立云冲突验收仍未覆盖；缺少可安全使用的目标和凭据，loopback不代替公网结论。Windows原生计划任务登记受当前用户权限限制，本轮通过的是登录期间会话助手。
- 新仓库导入不能直接复制整个 `E:/GDP/Scodex`：父目录含Codex私有状态；`workbench/` 还包含本地 `workspace/`、手动删除夹具、发布产物和长篇本机交接。隔离候选只从经过审查的源目录选取文件。
- 真实公网模型、Git认证/Push/PR、指定公网MCP及独立云冲突验收仍未覆盖；缺少目标与安全配置，不以loopback结果替代。
- 既有用户目录副作用：`C:\Users\Administrator\workspace-tools` 曾由错误候选启动触发安装且仍保留；删除命令曾被自动审批拒绝，未绕过。只记录并在最终答复说明，不再试删。
- Formal entry verification: six session checks passed; independent 1064x660 and 1440x900 layout recheck passed; evidence: release/session-scheduler-20261031/formal-entry-session/layout-only/formal-layout-verification.json.
- 清理：本轮后台/正式入口 fixture 已移动至 `C:/Users/Administrator/AppData/Local/Temp/手动删除/session-scheduler-20261031/`，原 Temp 路径不存在；保留证据，不物理删除。
- 聊天中曾粘贴服务凭据；未使用、未写入测试。最终仅提醒用户撤销或轮换，不复述凭据。
- 前次遗留隔离目录 `release/native-input-20261031` 仍按既有清理边界保留；本轮F10失败及通过fixture已逐项核实并移动，不按名称批量删除。 Formal layout recheck fixture was removed and no formal-entry process remains.

## 2026-10-31 MCP World 浏览器抓取（新增任务）

- 已登录内置浏览器只读打开 MCP World 分类和详情页，取得一个“混合部署/可托管”条目的可定位证据：页面称服务器由百度托管、传输为 SSE，并提供 24h/72h 连接有效期选项。
- 页面没有公开可直接调用的公网端点、认证配置或工具参数；未点击一键部署，未产生表单、上传、消息或外部账户写入。证据见 mcpworld-browser-scrape.json（release/mcpworld-scrape-20261031）。
- 固定清单仍为 48/50（96%）；该抓取不计入 M10 真实公网往返，M10 仍待可验证端点和安全配置。
## 2026-11-01 Supabase 应用级同步检查点

- 当前目标：完成设置内 Supabase 写入与应用级聊天库同步，并在独立项目验证专用表、RLS 和离线版本冲突。
- 已完成：新增 electron/supabase-sync.cjs、同步测试、主进程／preload IPC、设置页“应用同步”分类、专用 SQL；版本为1.3.22。
- 有效验证：同步相关6/6；模型连接和设置回归合计21/21；三份 CJS 语法检查通过；Vite 1823模块构建通过；Supabase 表/RLS/三策略只读核验通过；A/B 冲突首提交1、过期提交0、最终版本1且保留副本A。
- 证据：[verification.json](../release/supabase-sync-20261101/verification.json)、[targeted-tests.log](../release/supabase-sync-20261101/targeted-tests.log)。
- 增量代码审查已完成，未发现高置信度问题；应用 REST 端到端仍待 anon key 配置。
- 未完成：真实 REST 端到端仍缺该 Supabase 项目的 anon key 配置；应用尚未在真实设置页提交密钥或执行 REST 写入。当前固定50项清单仍为48/50（96%），本轮不将 G10/M10 或其他公网缺口自动计为通过。
- 风险与约束：不使用聊天中出现的服务密钥；不自动合并冲突；A/B 行仅为独立测试数据；同步请求15秒超时、载荷512KB上限；继续验收前需从本检查点和测试交接恢复。

## 2026-11-07 完整访问正式入口替换检查点

- 当前目标：让用户实际启动的 `E:/GDP/Scodex/App/Scodex工作台.exe` 使用已验证的完整访问实现，并在正式入口上确认不弹逐项审批。
- 已完成：正式入口由 `1.3.43` 替换为 `1.3.44`；同步 `Scodex工作台.exe` 与 `resources/app.asar`；旧 EXE/ASAR 已校验保存于 `release/full-access-20261107/rollback-1.3.43`；用户数据、配置和凭据保留。
- 有效验证：正式入口真实回归 6/6 通过；文件写入、读取、`node calculator.cjs` 输出5、协作授权边界通过；`approvals=[]`、`processExited=true`、`fixtureRemoved=true`。证据：`release/full-access-20261107/ui/formal-auto-collaboration/auto-interaction-ui-verification.json`。
- 当前身份：EXE SHA-256 `08abc011e1864b9dcd2f6657155a3f2f56c8be226dc555aeaf6b5bd7cce19c68`；ASAR SHA-256 `b5b058958fa62c2997ccd31210acbdcd257d4b49b16fc239a5432bb9ab7d21ce`；当前无 Scodex 进程。
- 未完成与限制：更广泛回归在目标保存测试驱动处停止，未作为通过依据；loopback 模型服务不能证明公网模型，完整访问仍受 Windows 账号、ACL、UAC 和操作系统边界约束。根目录 `HANDOFF.md` 与 `TEST_HANDOFF.md` 已更新并完成 UTF-8 无 BOM 回读验证。
<!-- context-compression-20261108:start -->
## 当前检查点：发送前动态上下文压缩与活动证据保留

- 当前目标：取消模型请求前的通用固定字符/消息截断，按上下文容量和重要性压缩；保护系统指令、当前需求、工具调用与结果配对、最近消息、路径和错误证据。
- 已完成：`context-compression.cjs` 动态压缩；`agent-runtime.cjs` 请求前压缩与上下文长度自适应重试；附件、Skill、MCP 正文移除请求前固定裁剪；8 个工具模块的活动输出移除额外固定预览裁剪；新增 MCP 活动尾部证据回归断言。
- 已验证：核心 37/37；浏览器 11/11；MCP 运行时 6/6；服务/表格 14/14；任务协作 22/22；相关语法检查和差异检查通过。
- 当前状态：源码和测试已完成，正式入口未重建/替换；正式版本仍为 1.3.46。混合 119 项回归有 5 个旧权限断言失败，均与完整访问放行策略的既有变更不一致；不影响本轮压缩路径通过结果。
- 关键约束：保留文件大小、附件数量、表格/命令/服务/CDP/MCP 资源边界；不读取、打印或落盘密钥；保留工作区既有未提交改动；公网模型未验证。
- 待办：如需正式入口包含本轮源码，需另行执行版本递增、候选构建、实际程序验收和正式替换闭环；先处理或明确更新 5 个旧权限断言的测试基线。

<!-- context-compression-20261108:end -->
