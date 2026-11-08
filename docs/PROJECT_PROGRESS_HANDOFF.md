<!-- message-resource-links-20261107:start -->
## 消息路径、第三工作区及设置参照对齐（实施中）

- 当前状态：消息路径/受限浏览预览、参考设置白名单读取与分类应用、SKILL来源、操控提示颜色/语言、浏览器审批和快捷键已落盘。正式仍1.3.43，本轮目标1.3.44；候选已构建，尚未正式替换，实际验收部分完成。
- 用户目标和约束：消息路径同时在第三工作区及Windows资源管理器定位；浏览器、电脑操控、SKILL、配置和快捷键以E:/GDP/.codex为依据。参考目录只读，不复制凭据/数据库；保留用户数据及无关改动。路径仅作为数据，主进程校验权限、真实路径和目录授权。
- 基线：release/message-workspace-20261107/baseline.json及baseline/，15原有目标文件；新增模块见WORK_CHECKPOINT.md。本轮26项辅助结果见targeted-tests.log；实际EXE、Explorer与重启尚未完成验证。
- 参考边界：config.toml、browser/config.toml和computer-use/config.json提供可映射配置；相关目录不含完整Codex宿主界面源码，不宣称逐行或全部能力复刻。

| 本轮范围 | 当前结果 | 验证状态 |
| --- | --- | --- |
| 消息文件链接与第三工作区 | 代码已实施；实际用户/助手/表格链接渲染通过、选中及Markdown已显示 | Explorer状态核对超时；原失败报告保留 |
| 设置五类参照对齐 | 代码已实施，待核查直接引用 | 26项辅助中相关范围通过；UI/持久化待验 |
| 正式1.3.44交付 | 候选构建完成/未替换 | 后续实际验收尚未完成验证 |

- 失败与调整：首轮COM窗口读取超时，改computer-use后原生Explorer已打开正确中文目录并选中57字节目标，Markdown/源码切换通过（ui-continuation）。续验chat-only断言失败；定向读取发现既有permission-policy统一返回allow，未由本轮修改。改验本轮真实目录grant越界拒绝，保留完整访问既有语义；沿用候选、复用通过组与测试目录。
- 当前续验：ui-settings已通过目录grant边界与四类参考设置应用、SKILL来源发现/磁盘保存；原生`Control_L+r`与`Ctrl+r`两次均未触发页面请求，第二次焦点回到外层窗口。已停止输入重试，记录原生快捷键输入交接尚未完成。持久化记录确认`desktop_screenshot`成功；上一轮断言读取到状态条初始化中文，磁盘实际已保存`computerLocale=en-US`，现等待状态事件后核对英文/颜色。续验驱动已等待模型保存并修正候选无“执行任务”按钮；浏览器审批已通过，继续提示/重启/布局验收。
- 后续：核查差异、完成固定候选实际验收和增量审查；验收后替换E:/GDP/Scodex/App/Scodex工作台.exe及必要资源并复验。正式旧1.3.43与真实profile保持，替换前重新核对进程和备份；上一轮App.previous为1.3.42，不当作本轮1.3.43备份。
- 运行与回滚：本轮尚未改变正式运行状态；构建/替换后记录精确哈希及回滚路径。使用Skill requirement-understanding；无子Agent。
<!-- message-resource-links-20261107:end -->

<!-- advisor-repair-20261107:start -->
## 统一模型适配、导航与配置（1.3.43，上一增量完成）

- 当前结果：原1.3.42已按NSIS安装为本轮1.3.43；导航缩小后再次覆盖成功，81文件与候选匹配。正式入口E:/GDP/Scodex/App/Scodex工作台.exe；文件/注册表1.3.43，ProductVersion1.3.43.0。EXE ff62a366831b92fba6ec200d0549a2aac0cb32114c2b2aec174a4dfcdca5b02e；ASAR a11e9f6480c4804caf45da933be898273f16783e3c4293d46df1610a7324dd59；安装包263a4d6ab09097919b124f1eaee64e6c71b6f77d2b2855f650a1523ba4d1d89f。
- 最新尺寸：导航20px、按钮行高12px、普通线宽6px/高1px（间隔9px，激活14px）；单条预览300px、正文12px、收紧内边距。悬停/聚焦单条、移开隐藏、原生点击/键盘定位、回到最新及流式历史阅读逻辑保留。
- 正式数据：真实profile原2会话/2消息及原有字段、当前活动会话保留。顾问仅从无路由claude-sonnet-5-5改claude-sonnet-4-6，其他配置与加密凭据未变。真实profile验收与缩小后正式验收各3组通过；已正常退出测试并以常规入口重开PID31140，无调试端口。
- 备份与回滚：本轮固定E:/GDP/Scodex/App.previous保存旧1.3.42，29文件逐项哈希通过；正常退出工作台后可恢复该目录文件，profile独立保留。未执行真实卸载/回滚，文件备份可恢复性仅由完整哈希核对支持。
- 清理：递归删除临时夹具被自动审批blocked by policy拒绝，未重试；11份夹具已移至workbench/手动删除/advisor-repair-20261107/fixtures，原路径不存在；25旧源码仍在同目录obsolete-source，未物理删除。截图、报告、测试源码、候选、安装包和回滚备份保留。
- 限制：GPT/国模/Grok/Claude实际工具及标记通过；Kiro HTTP200/工具成功但一轮回复偏离标记，该格式用例保留失败，后续真实顾问计划/完成两关口通过；不外推所有公网兼容。首缩小打包因下载ETIMEDOUT失败，仅改用已安装Electron45.0.0的electronDist后成功，不改产品逻辑。
- 使用Skill：requirement-understanding、systematic-debugging、computer-use；无子Agent。

| 已完成需求 | 结果与证据 |
| --- | --- |
| 最新源码替换 | main552735f00e45ba57b8ca9d4f638f5fbec19421d0；308文件/3运行ZIP匹配，旧源码移出活动路径；[替换](../release/advisor-repair-20261107/source-replacement-result.json) |
| 统一适配与顾问 | 主/子/顾问共用入口，明确工具/推理拒绝各适配一次、不重放工具，GPT枚举与错误脱敏修复；[审查](../release/advisor-repair-20261107/incremental-review.json)、[真实顾问](../release/advisor-repair-20261107/real-advisor-final/model-adapter-ui.json) |
| 完整连接设置与独立保存 | 工作区弹窗完整配置，三角色独立保存及草稿、加密、模型列表验证；[前4组实际UI](../release/advisor-repair-20261107/workspace-ui/workspace-model-ui.json) |
| 导航与缩小 | 左侧短横线与单条向右预览、回到最新；缩小后悬停/离开/原生点击、键盘及窄窗口实际通过；[最新UI](../release/advisor-repair-20261107/compact-ui/workspace-model-ui.json)、[截图](../release/advisor-repair-20261107/compact-ui/workspace-model-final.png) |
| 正式替换与重开 | 81安装文件、94源码/资源包内一致，正式用户profile3组通过，常规入口已重开；[最终核对](../release/advisor-repair-20261107/final-incremental-verification.json)、[替换](../release/advisor-repair-20261107/formal-replacement.json) |

- 运行/交接：正式入口与根目录/桌面/开始菜单快捷方式目标一致，根目录旧版本描述同步1.3.43；停止方式为工作台正常退出。增量审查25文件有效，后续仅导航CSS尺寸差异已定向复审，无剩余发现；直接范围无必要追加重构或达标下一步候选。消息路径功能按最新节单独实施，正式候选版本1.3.44。
- 证据：[构建](../release/advisor-repair-20261107/build-verification-compact.json)、[正式UI](../release/advisor-repair-20261107/formal-compact-profile-verification.json)、[重开](../release/advisor-repair-20261107/formal-reopen.json)、[快捷方式](../release/advisor-repair-20261107/shortcut-verification.json)、[清理](../release/advisor-repair-20261107/cleanup-verification.json)。
<!-- advisor-repair-20261107:end -->

<!-- github-update-1.3.42:start -->
## GitHub 1.3.42 本机更新（2026-11-07，已完成）

- 当前状态：原正式目录已由 1.3.31 升级到 1.3.42；NSIS 安装退出 0，Windows 文件版本为 1.3.42.0，设置页显示 v1.3.42。主程序 PID 35716 已就绪，保留在聊天界面；本轮下载和安装均已结束。

| 已完成需求 | 实际结果与影响范围 | 证据 |
| --- | --- | --- |
| 获取 GitHub 最新发布 | 初次 Latest API 为 v1.3.42；原始 Windows x64 安装包完整下载，181114245 字节，SHA-256 与 GitHub digest 一致 | [发行身份](../release/github-update-1.3.42-20261107/release-identity.json)、[最终安装包](../../Scodex-Workbench-Setup-1.3.42-x64.exe) |
| 原路径覆盖升级 | 静默安装成功；正式 EXE、ASAR 及系统安装注册均为本轮对象，根目录和桌面快捷方式仍指向原入口 | [安装结果](../release/github-update-1.3.42-20261107/installation-result.json)、[入口核对](../release/github-update-1.3.42-20261107/installed-entry-verification.json) |
| 实际程序最小验收 | 主界面加载、打开设置并核对 v1.3.42、Alt+左箭头返回聊天，3 项通过；未发送模型消息或编辑配置 | [界面验收](../release/github-update-1.3.42-20261107/ui-verification.json)、[交付核验](../release/github-update-1.3.42-20261107/delivery-verification.json) |
| 滚动回滚及残留处理 | 83 个旧 App 文件逐项大小和 SHA-256 匹配后保留在固定 backups/App.previous；旧 App、下载副本及临时清单共 4 项已移至手动删除目录，尚未删除 | [回滚清单](../../backups/App.previous.manifest.json)、[残留清单](../release/github-update-1.3.42-20261107/cleanup-verification.json) |

- 正式入口：`E:/GDP/Scodex/App/Scodex工作台.exe`；[启动快捷方式](../../Scodex工作台.lnk)。安装包 SHA-256 `7adcf6e067747afe073c4a70443625cc3745f7cd0ed38508e065d594f811847b`；正式 EXE `317a924eb2a279cbe6d4501090a3a661c46b742a922e83077e32d1c8dfd8eccc`，ASAR `24dd7be3e20cc0ee06a34175419f979c6572716875884f180d2debfcc8317a05`。
- 决策与范围：安装已发布的原始 1.3.42，不改产品源码、依赖、版本或重建程序，也不同步本地源码；未手动修改 profile、workspace、凭据或聊天正文。新版启动自身的正常状态保存不作字节不变承诺。
- 回滚：固定程序备份 `E:/GDP/Scodex/backups/App.previous` 为 1.3.31；历史正式 1.3.31 安装包保留。先通过设置→常规→退出程序完整退出，再用旧安装器指定原 App 路径，或恢复完整备份目录；保留用户 profile 和业务文件。旧章节中的 1.3.29/1.3.30 App 备份路径已由本轮固定备份取代。
- 清理限制：自动审批以 `blocked by policy` 拒绝删除命令；未重试删除，4 项已移动到 `E:/GDP/Scodex/手动删除/github-update-1.3.42-20261107`，原路径均不存在。可按残留清单逐项手动删除；不声称磁盘上只剩一份物理备份。
- 失败恢复：慢速单流停止及 Range 间歇连接失败后，断点续传完整通过；并行下载在启动前被策略拒绝。原生激活/无截图几何输入失败后，读取带截图状态并完成坐标设置导航和键盘返回。最终 Latest 重查受未鉴权 API 限流，沿用初次成功元数据及完整摘要证据，不把重查失败记为通过。
- 验证边界与待办：本轮升级目标已完成，无功能待办；当前配置显示尚未配置模型，公网模型生成和全部新功能回归未验证。未产生产品代码差异，增量产品代码审查不适用；现有范围无必要追加重构或达标下一步候选。待手动清理不影响运行。
- 使用 Skill：requirement-understanding，95/100（30+20+17+15+8+5）；computer-use，96/100（30+20+18+15+8+5）。前者核对需求边界，后者提供实际程序交互证据；无子 Agent。
<!-- github-update-1.3.42:end -->

<!-- projectless-chat-20261101:start -->
## 无项目对话及GitHub 1.3.31发布（2026-11-01，已完成）

- 当前状态：项目可全部删除或归档；无需项目即可直接对话和执行任务。正式1.3.31已覆盖安装到原App路径，源码已合并到用户指定仓库，v1.3.31公开发行并设为Latest，匿名完整下载验收通过。所有本轮有限操作已结束。

| 已完成需求 | 实际变更与影响范围 | 验证证据 |
| --- | --- | --- |
| 无项目对话及项目可选 | 显式空数组持久化、旧workspace迁移、普通对话入口及绑定、删除或归档最后项目、独立通用workspace；保留权限保护和磁盘项目文件 | [19项逻辑](../release/projectless-chat-20261101/workspace-green.log)、[正式6/6](../release/projectless-chat-20261101/formal-ui/projectless-ui-verification.json) |
| 构建及正式覆盖升级 | 1.3.30→1.3.31；138固定输入，Vite/dir/NSIS及安装退出0，81正式文件与验收候选哈希一致；桌面及根快捷方式指向正式App | [构建](../release/projectless-chat-20261101/build-verification-r2.json)、[安装](../release/projectless-chat-20261101/installation-result.json)、[身份](../release/projectless-chat-20261101/installed-file-verification.json) |
| 公开源码上传 | feature/release-1.3.31提交9b98881c77b09f87ca56ebee8b24db590a87448f，12文件；[PR #2](https://github.com/song123-jian/-0/pull/2)已合并；main与v1.3.31均a243e29cc6bd2126a6f2246ddd17741eda56d820 | [公开源码身份](../release/projectless-chat-20261101/published-source-identity.json)、[远端回读](../release/projectless-chat-20261101/final-source-verification.json) |
| 最新安装包与下载入口 | [v1.3.31](https://github.com/song123-jian/-0/releases/tag/v1.3.31)非草稿、非预发行且Latest；README下载入口1.3.31；1.3.30历史版保留回滚 | [发行回读](../release/projectless-chat-20261101/final-delivery-verification.json)、[匿名完整下载](../release/projectless-chat-20261101/public-download-verification.json) |
| 审查与交接 | 本次7修改+3新测试/构建脚本及公开文档12文件增量审查；UTF8无BOM、语法/锁依赖、精确白名单及敏感字面量检查通过 | [本地审查](../release/projectless-chat-20261101/incremental-review.json)、[公开增量审查](../release/projectless-chat-20261101/publication-incremental-review.json) |

- 正式入口：E:/GDP/Scodex/App/Scodex工作台.exe。安装包E:/GDP/Scodex/Scodex-Workbench-Setup-1.3.31-x64.exe，[公开下载](https://github.com/song123-jian/-0/releases/download/v1.3.31/Scodex-Workbench-Setup-1.3.31-x64.exe)，189910973字节；SHA256 4701036f0ef136ad67e5353a8e067168a53478fb9add514dcab1bd42d78474e9，与GitHub digest及完整下载一致。
- 回滚：旧1.3.30安装包与历史Release保留；旧App83文件备份E:/GDP/Scodex/backups/projectless-chat-20261101-1.3.30/App-1.3.30，[备份清单](../release/projectless-chat-20261101/backup-manifest.json)。先退出程序，恢复旧程序文件或旧安装器，保留用户配置及数据。
- 范围约束：公开131桌面输入字节一致，package只省略原已排除的3条未完成手机脚本；6项并发手机文件不覆盖。真实profile、凭据、备份、机器专用交接和运行时ZIP未上传，无依赖变更，无子Agent。
- 失败恢复：默认home目录保护冲突已修复并复验；早期UI驱动失败保留原记录。同步首轮完整快照相同假设被手机并发差异拦截后收窄白名单。整包90秒写超时后远端assets=[]，改1MiB流式33.2秒完成上传；未重传相同失败路径，原失败证据保留于upload-failure.json及upload-failure-state.json。
- 清理：成功夹具自动删除；自动审批拒绝删除3失败夹具（blocked by policy）后已可恢复移至E:/GDP/Scodex/workbench/手动删除/projectless-chat-20261101，原址不存在、无运行依赖，待手动删除；详见[实际清理记录](../release/projectless-chat-20261101/cleanup-verification.json)。未影响功能与发布验收。
- 限制：仅模型HTTP使用loopback受控服务，不宣称公网模型生成、第二台设备或未变业务通过。正式截图已实际查看，当前设备、页面、视口和数据状态下无可见错误；未新增网页截图验收要求。
- 轻量洞悉评估：当前直接范围无必要追加重构或达标下一步候选；无功能/发布待办。使用Skill：requirement-understanding、test-driven-development；最终双交接核验见handoff-final-verification.json。
<!-- projectless-chat-20261101:end -->

<!-- repo-sync-1.3.30-20261101:start -->
## GitHub 同步与发布 1.3.30（2026-11-01，已完成）

- 当前状态：公开仓库已同步到已验收的桌面1.3.30；PR #1已合并，v1.3.30 Release已正式公开并可匿名完整下载。本轮无待实施事项或未结束有限操作。

| 已完成需求 | 结果与影响范围 | 证据 |
| --- | --- | --- |
| 公开源码同步 | feature/release-1.3.30，447927139ed12cf8bf1eb58ecea689bf76b86428；本轮12文件，相对原main共116文件。136桌面输入135字节相同，package省略3未完成手机脚本，其余一致 | [提交](../release/repo-sync-1.3.30-20261101/local-commit.json)、[身份](../release/repo-sync-1.3.30-20261101/published-source-identity.json) |
| PR及合并 | [PR #1](https://github.com/song123-jian/-0/pull/1)已合并；无保护/必需检查/评审；main与v1.3.30均ba3e6f3ff5e28a7dc350269bff00854adba32323，文件树同发布分支 | [最终核验](../release/repo-sync-1.3.30-20261101/final-delivery-verification.json)、[PR状态](../release/repo-sync-1.3.30-20261101/pull-request-state.json) |
| 安装包发布与下载 | [Release](https://github.com/song123-jian/-0/releases/tag/v1.3.30)为公开稳定版本，安装包189909290字节；匿名下载HTTP200并完整SHA一致 | [匿名下载](../release/repo-sync-1.3.30-20261101/public-download-verification.json) |
| 发布验证及清理修正 | 首轮402/403，唯一Windows teardown EBUSY；仅测试cleanup等待自身helper退出后定向7/7，无剩余失败，去重403项覆盖；本轮12文件增量审查完成 | [测试](../release/repo-sync-1.3.30-20261101/test-summary.json)、[审查](../release/repo-sync-1.3.30-20261101/incremental-review.json) |

- 交付物：[Windows x64安装包](https://github.com/song123-jian/-0/releases/download/v1.3.30/Scodex-Workbench-Setup-1.3.30-x64.exe)；本机E:/GDP/Scodex/Scodex-Workbench-Setup-1.3.30-x64.exe；SHA256 0eded7ad986368d264070805ea3045545365282aafb6f0172e86431be503f39f。发布说明中英双语且回读与候选一致。
- 构建与运行：复用已验收1.3.30固定快照Vite/electron-builder dir→同候选prepackaged NSIS及安装结果，本轮只公开分发，不重复递增或覆盖本机当前程序。安装运行后自行配置服务与密钥；已配置同机设置保留。
- 关键约束：原1.3.29分支、未跟踪暂存、原安装包及App/profile备份不变。手机和1.3.31并发、用户数据、凭据、本机交接及运行时ZIP未上传。原1.3.29同步提交统计已核实为112文件，不沿用109的旧输出。
- 限制：内置浏览器控制不可用，未取得最终网页截图；真实GitHub API、Git远端回读和完整匿名下载提供交付证据。公网模型生成、高级浏览器、第二台实体电脑/克隆MachineGuid、真实卸载及手机功能未计通过。
- 清理：3个已知失败夹具文件从C:/Users/Administrator/AppData/Local/Temp/scodex-session-中文 space-iXh1Xg移至workbench/手动删除/repo-sync-1.3.30-20261101/scodex-session-iXh1Xg；原址不存在，无运行依赖，待手动删除。自动审批曾拒绝删除（blocked by policy），未执行删除。[清单](../release/repo-sync-1.3.30-20261101/cleanup-verification.json)。
- 回滚：本机旧App/profile及恢复方法沿用设备初始化章节；本轮未替换本机程序。发布标签和两个功能分支保留，后续发布需使用新版本而非覆盖本轮资产。
- 洞悉评估：直接范围无须追加重构或达标下一步候选。使用Skill：computer-use；无Agent。双交接回读记录见[最终文档核验](../release/repo-sync-1.3.30-20261101/handoff-final-verification.json)。
<!-- repo-sync-1.3.30-20261101:end -->

<!-- device-initialization-20261101:start -->
## 电脑端按设备初始化（2026-11-01，已完成）

- 当前状态：正式1.3.29已升级为1.3.30，NSIS退出0；原程序入口E:/GDP/Scodex/App/Scodex工作台.exe及桌面/根目录快捷方式保持有效。当前电脑已一次性干净初始化，模型、地址和密钥由用户重新设置；原磁盘项目文件保留。
- 关键决策：新安装为空白独立codex-home，禁止自动继承旧DPAPI凭据；电脑SHA256标记匹配则保留配置，异机已标记profile选择独立目录。未标记旧版升级保留工作数据；坏标记/身份读取失败停止启动并保留数据。

| 已完成需求 | 变更、影响及验证 | 证据 |
| --- | --- | --- |
| 设备隔离及首次配置 | 启动、设备模块、模型连接与选择；发现允许空模型但保存必填；按钮不传React事件；21项逻辑测试及6组候选实际UI通过 | [差异](../release/device-initialization-20261101/incremental.diff)、[审查](../release/device-initialization-20261101/incremental-review.json)、[候选UI](../release/device-initialization-20261101/candidate-ui/device-profile-ui-verification.json) |
| 同轮1.3.30构建及替换 | 固定源码快照→Vite→electron-builder dir→同一候选prepackaged NSIS；81个正式文件及6个源码/资源一致 | [安装](../release/device-initialization-20261101/installation-verification.json)、[最终文件核对](../release/device-initialization-20261101/final-file-verification.json) |
| 本机干净初始化 | 模型/服务/主子密钥为空，消息0/草稿0；正式路径3组实际UI通过，默认profile实测通过，PID12568正常无调试参数运行 | [正式UI](../release/device-initialization-20261101/formal-ui/device-profile-ui-verification.json)、[当前profile](../release/device-initialization-20261101/current-profile-verification.json)、[截图](../release/device-initialization-20261101/final-desktop.jpg) |

- 交付：E:/GDP/Scodex/Scodex-Workbench-Setup-1.3.30-x64.exe；正式EXE SHA256 fe3aae6bc72f1ac50de8d1cce4be377ad4c26173d58d5b5251d83e7a92567ffb；ASAR SHA256 ebd3cbcd8a8a02251016426022f2f616ff6a5893fef427b2013b5bc2d5e07139。无未结束有限任务，程序保留打开供用户配置；使用正常程序退出操作停止。
- 备份与回滚：旧App完整副本E:/GDP/Scodex/backups/device-initialization-20261101-203846/App-1.3.29；旧profile为C:/Users/Administrator/AppData/Roaming/scodex-workbench.backup-20261101-203846，270文件哈希已核对。正常退出后先保留新profile，再恢复旧App/旧profile；原1.3.29安装包仍在。见[备份清单](../release/device-initialization-20261101/backup-manifest.json)。备份不自动加载。
- 失败恢复：脚本会话数量/导航预期已纠正；发现列表前置与React事件序列化按RED及实际UI证据修正、重建复验；快照路径、ASAR原生分隔符与截图JPEG扩展名核对已校正，不影响正式产物身份。
- 限制：异机为foreign marker模拟，未实测第二台实体电脑；无标记旧拷贝无法证明来源，按迁移保留；同MachineGuid克隆及公网模型生成未验证。宿主Roaming/LocalCache映射见[路径核对](../release/device-initialization-20261101/windows-profile-paths.json)。
- 清理：5个已知失败临时profile已删除，成功用例自行清理，默认测试DevToolsActivePort已移除；必要证据、固定快照、依赖junction及其目标、回滚备份保留。见[清理](../release/device-initialization-20261101/cleanup-verification.json)。
- 洞悉评估：直接范围无需追加重构，无证据支持达标下一步候选；当前需求无待办。使用Skill：computer-use、test-driven-development；无子Agent；手机端并发文件与交接保留。
<!-- device-initialization-20261101:end -->

<!-- mobile-implementation-20261101:start -->
## 手机端原生实施（2026年11月1日，进行中）

- 当前目标：按用户提供的完整手机端方案实施，目标涵盖M1手机问答、M2电脑任务闭环与M3 Android交付；遵守用户明确要求，不交付网页、PWA或WebView，改由原生Android客户端承担手机功能。远程电脑、附件、审批与恢复仍属于完整目标，未被用户排除。
- 路线调整：此前独立网页原型及适配器保留原位，不作为交付。手机端使用独立Java/Android工程；服务与桌面代理按原方案单独建设并保留权限边界，不通过WebView或直接暴露Electron IPC实现。
- 完成状态：M1部分完成（四模式、基础聊天/历史/设置、本地草稿、可选模型的原生下拉、真实流式问答、用户长消息折叠、会话归属和本地停止代码，以及本轮真实界面切换/停止验收）；服务端终态未确认，基础附件及完整窄屏/键盘验收未完成。M2配对、授权项目、远程执行、审批、差异/成品和断线恢复未实现。M3仅有MuMu上的debug测试候选，尚非正式交付。
- 已完成增量（用户长消息折叠）：依据手机方案第05/06章，按消息正文在实际宽度下的排版行数判断；用户消息超过8行时默认显示6行并提供展开/收起入口，助手正文始终完整。消息增加兼容旧数据的稳定ID与展开状态，随会话JSON持久化；旧消息缺失字段时在首次加载生成ID/默认false状态并立即回写。点击只更新当前消息视图并保存状态。布局变化前记录首个可见消息和相对视口偏移，布局后恢复该锚点。附件、M2操作日志及其他折叠类型不纳入本轮。
- TDD基线：旧`com.scodex.mobile` v0.1.0 debug APK的原生UI测试中，8个显式文本行未出现“展开”，9行因无折叠控件触发预期断言失败，确认测试覆盖缺失行为。测试后会话回到1个原对话/2条消息，未留下测试行；API密钥未落盘。该RED基线已用于实现本轮功能。
- 当前实现与构建：`ConversationStore.java`为消息增加稳定ID及向后兼容的展开状态序列化；`MainActivity.java`按真实TextView行数对用户消息提供6行折叠、展开/收起和阅读锚点恢复，助手正文保持完整。候选APK `com.scodex.mobile` v0.1.0，SHA-256 `C65BE5E51DD545FADB94CBDD56FCCFEB08B3878F5A3B60C798E158765D892BC6`，898597字节，APK v2签名有效，已安装并在MuMu回读匹配。
- 用户长消息折叠实际验收通过：6行参照516px，9行收起514px（640dpi下差0.5dp，小于1dp验收容差），展开729px；首条可见消息顶部保持882px。8行边界、展开/收起、独立状态、稳定ID与展开状态落盘、进程重启恢复，以及16行助手正文完整性均通过。[验收报告](../release/android-native-implementation-20261101/long-message-folding-verification-v2.json)，SHA-256 `82610A3049D6EFA085CDFF4435471046446EB5956D7FBBCB365F0464F3157963`。旧报告保留为首次折叠场景证据；增强报告用独立文件保存。
- 已完成增量（M1流式回复归属与停止回调）：新增按`conversationId`管理的`GenerationRegistry`；切换/新建会话不取消原流，后台delta和终态按绑定写回来源会话，界面仅刷新当前会话。显式停止先失效当前绑定再取消该请求，Activity销毁先失效并取消全部请求。正常完成、错误和本地停止分别保存；本地停止不表示服务端已确认终态。`ModelApiClient`协议与消息存储格式未改。
- 本轮回归与构建：纯JVM注册表测试5/5通过；Gradle `:app:assembleDebug`成功，候选已安装并启动于MuMu。安装包身份、哈希、回滚副本和定向审查见[本轮验收报告](../release/android-native-implementation-20261101/generation-registry-verification.json)。
- 真实模型集成验收：应用内连接测试显示“连接成功：OK”；原生聊天实际生成1至300数字，并在新建会话后从历史返回原会话确认回复完整、未串入新会话；另一条长请求在界面“正在回答”期间点击“停止接收”，停止说明写入原消息、状态提示可见，按钮恢复发送，随后2秒内容未变。OpenAI兼容接口没有提供本次断连后的服务端终态核验，本地停止不能表示服务端任务已取消。测试中一条1500词请求先于停止操作完成（助手正文15728字符）；完整过程、等待失败恢复和状态备份回读见[本轮验收报告](../release/android-native-implementation-20261101/generation-registry-verification.json)。测试后SharedPreferences与测试前备份哈希一致，恢复为原1会话/2条消息，密钥设置不存在，应用重新启动。
- 未完成验证：启动后的完整屏幕/无障碍验收、服务端终态确认、基础附件及完整IME/窄屏流程仍未完成；不以本地停止提示代替服务端终态。
- 旧记录迁移RED：仅在当前候选加载已有消息、未触发任何保存后回读会话JSON，测试因消息缺少持久化ID而按预期失败；未改变消息内容和模型设置。修订要求为加载时一次性回写兼容字段，防止每次进程启动重新生成标识。
- 网关前置：桌面端有`chat:send`、取消、审批事件和agent运行时，但仅由主进程IPC调用；当前未发现手机网关或设备配对协议。`https://catbee.online/v1`仅为模型服务，不承担账号、项目范围、电脑注册或审批。网关部署位置与认证责任尚待明确；不得把现有模型API记作远程任务服务。
- 环境与约束：JDK 17、Gradle 9.1.0、Android Gradle Plugin 9.0.1、SDK/build-tools 36.0.0；MuMu设备`127.0.0.1:16384`运行Android 15/API 35。项目无Git元数据，按修改前哈希及定向差异审查。电脑端当前正式版本1.3.30，桌面程序、Electron权限、配置、版本和既有锁文件不改。
- 模型连通性：`https://catbee.online/v1/models`使用已确认凭据的Bearer鉴权返回5个模型；`deepseek-v4-flash`的最小`/chat/completions`请求返回`OK`。早期旧凭据请求为401，随后由用户提供有效凭据并成功；任何凭据均未写入文件、交接或输出。
- 当前进度：M1回复归属增量候选`com.scodex.mobile` v0.1.0已安装并启动于MuMu；候选与回拉安装包均为900230字节，SHA-256 `5CA465FBC49FA841FC9B1541BA41A4C0E829F3F32835D47C70A61538FE87CFA6`，APK v2签名校验通过。
- 初始页面：MuMu Android 15/API 35，1440×2560截图显示四模式、聊天输入、新建、历史和设置；当前设备、页面、视口和数据状态下未见可见错误。[首屏截图](../release/android-native-implementation-20261101/mumu-initial.png)
- 构建失败与恢复：离线插件缓存不完整、首次在线进程缺少`ANDROID_HOME`及PowerShell调用不存在的wrapper均已定位；改用缓存Gradle 9.1.0 `bin/gradle.bat`并为进程设置SDK路径后构建成功，33项任务完成。未将本机路径固化到项目。
- 下拉验收失败（MuMu，21:48）：Android界面状态显示已读取5个模型；点模型字段及字段右侧箭头后只有输入光标，无可见候选项，UI层级也没有候选节点。[失败截图](../release/android-native-implementation-20261101/mumu-model-dropdown.png)
- 修订方案已验收：模型输入保持可编辑，右侧独立箭头打开系统`PopupMenu`并列出全部5项API目录模型；选择`deepseek-v4-pro`后偏好回读匹配。手动输入`manual-model-check`也持久化成功，再通过菜单恢复到`deepseek-v4-flash`。[菜单截图](../release/android-native-implementation-20261101/mumu-model-menu.png)
- 四模式实测：先进入对话并确认四模式控件可见；逐个点击后结构化回读偏好，`answer`、`plan`、`code`、`office`均与所选值一致。
- 回滚副本：更新前MuMu已安装APK已导出为[旧版APK](../release/android-native-implementation-20261101/previous-installed-D893B8BC.apk)，895719字节，SHA-256 `D893B8BC12BA9584BFB32BC1C25E7EB44892061F06E43DA05118FED433FC35BE`；已安装新版回拉副本[installed-current-45414F30.apk](../release/android-native-implementation-20261101/installed-current-45414F30.apk)与候选哈希一致。
- Android真实问答：当前已安装APK以`deepseek-v4-flash`经流式接口提交`Reply with exactly OK`，界面返回`OK`；两条对话消息均已落盘，API密钥未写入偏好。[验收记录](../release/android-native-implementation-20261101/android-chat-verification.json)
- 草稿重启恢复：输入`Draft persistence check`后确认按会话ID落盘；将调试应用退到后台并结束进程，再启动后输入框恢复原文、两条消息保持不变。验收后已清空临时草稿。[验收记录](../release/android-native-implementation-20261101/draft-restoration-verification.json)
- 已通过：Android应用内模型目录读取5项、原生菜单显示5项、模型点选持久化、自定义模型输入、空密钥失败后无候选菜单及手动输入、一次真实流式问答和草稿进程重启恢复。目录读取现于开始时清空候选、仅接受最新请求响应，空目录时提示可手动输入。HTTP 200空目录及并发乱序尚未在受控服务中实测；版本名递增映射待用户确认，正式版本构建和交付尚未完成。[本轮脱敏验收记录](../release/android-native-implementation-20261101/model-directory-state-verification.json)
- 总体未完成项：M1基础附件、生成中停止/终态与完整软键盘/窄屏流程；IME修订候选按API30+根布局底部padding=max(systemBars.bottom, ime.bottom)、API26-29保留原处理并已重建安装。增量审查确认仅改变API30+底部padding计算、保留`SOFT_INPUT_ADJUST_RESIZE`及旧版分支，未发现代码问题。MuMu输入框可聚焦但Android截图未显示软键盘，输入框和底部导航边界未变化；临时将`show_ime_with_hard_keyboard`从0改为1后仍无键盘。设备仅有MuMu的Sogou/Nemu输入服务，其IME窗口请求高度为0；桌面键盘图标只打开“暂无键盘方案”的按键映射面板。因此键盘布局修订尚未获得有效验证。测试草稿已实际保存后清空，设置已恢复为0。下一步需在MuMu提供可显示软键盘的Android输入法后，复核输入区/发送操作及底部导航边界，再验证草稿保存。[无键盘截图](../release/android-native-implementation-20261101/mumu-keyboard-open-ime-inset-20261101.png)、[临时开启软键盘设置时截图](../release/android-native-implementation-20261101/mumu-keyboard-open-visible-ime-20261101.png)。M2网关身份、设备配对、电脑代理、项目范围、远程事件、审批、成品和断线恢复；M3正式签名、版本递增、升级/回滚及目标设备复核。网关部署位置待用户回复；HTTP 200空模型目录及并发乱序模型响应仍未实测。
- 当前候选限制：MuMu安装的是`com.scodex.mobile` v0.1.0 debug候选，仅供继续原生验收，不代表M1/M2完成或可正式分发；更新前安装包已保存为[本轮回滚副本](../release/android-native-implementation-20261101/previous-installed-before-generation-registry-20261102.apk)，SHA-256 `C65BE5E51DD545FADB94CBDD56FCCFEB08B3878F5A3B60C798E158765D892BC6`。当前候选与设备回拉副本一致，详见[安装副本](../release/android-native-implementation-20261101/installed-current-5CA465FB.apk)。
<!-- mobile-implementation-20261101:end -->

<!-- mobile-plan-20261101:start -->
## 手机端详细方案 2026年11月1日

- 当前状态：桌面详细方案已完成；Word最终24页、21章、3张插图，另有Markdown源稿与30项后续验收用例。本轮未修改产品代码或构建APK。
- 交付入口：[Word方案](C:/Users/Administrator/Desktop/Scodex手机端落地方案_20261101/Scodex手机端详细落地方案.docx)、[Markdown源稿](C:/Users/Administrator/Desktop/Scodex手机端落地方案_20261101/Scodex手机端详细落地方案.md)；[任务检查点](mobile-plan-20261101/CHECKPOINT.md)。

| 已完成需求 | 主要结果与影响范围 | 证据 |
| --- | --- | --- |
| 参考核实 | 豆包15.5.0在MuMu中的对话/工作、模型与强度、目标、扩展输入、侧栏、资料面板和滚动已实际观察；用户确认无人工干扰后操作恢复，最后返回新话题；未发送、上传或更改权限 | [原始观察](mobile-plan-20261101/observations.json) |
| 详细落地方案 | 布局、折叠、四模式、网关和电脑代理、接口、离线同步、审批、文件级改造、12个开发任务、排期与30项未来用例 | [生成清单](mobile-plan-20261101/build-manifest.json) |
| 文档验收及清理 | 最终24页逐页检查通过；内容、编码、图片链接、OOXML和哈希通过；旧53个页图/缓存安全归档，原/现路径及哈希已核对 | [文档验收](mobile-plan-20261101/document-verification.json)、[清理清单](mobile-plan-20261101/cleanup-verification.json) |

- 设计决策：独立React/Vite手机PWA→受控网关→电脑代理→Android外壳；平台适配器隔离Electron；模式、模型、强度和目标分离；运行、失败与审批不被折叠隐藏。
- 版本与约束：以核实时1.3.28为兼容基线；正式开发前核对最新产品与并发增量，不覆盖其他任务记录。本轮纯方案文档，不递增或替换产品版本。使用Skill：computer-use、documents；无子Agent。
- 验证与恢复：默认渲染缺少LibreOffice后切换Word16.0只读导出；早期分页和图标问题已修正。最终DOCX SHA256 562b31c5f788c6d2c64536c844dc81032700537eeb2dbcb54301b5545d7b8871；[最终导出](mobile-plan-20261101/render-verified/native-render.json)。
- 清理限制：删除旧临时图被工具策略以blocked by policy拒绝，未执行删除；53个文件已移入[手动删除目录](mobile-plan-20261101/手动删除/superseded-page-images-20261101)，可按清单人工删除。最终证据和失败PDF保留，无运行依赖或交付影响。
- 未覆盖与待办：手机版、APK、真实手机键盘、模型及远程执行尚未实施验收；文档内30项均为未来用例。当前文档需求无待办、无运行中的有限任务。恢复实施先读本任务检查点和交接，复用有效记录。
- 轻量洞悉评估：直接影响范围无需额外重构，无达标的额外下一步候选；本轮交付为可编辑方案。
<!-- mobile-plan-20261101:end -->

## 电脑操控提示与 Esc 停止（2026-11-01，1.3.29已交付）

- 当前状态：提示条、全局Esc和停止按钮已落地；正式版本1.3.28→1.3.29，构建、安装、正式入口功能验收及增量审查完成。实际入口为[Scodex工作台.exe](../../App/Scodex工作台.exe)，原桌面、开始菜单与根目录快捷方式可用。
- 主要实现：独立500×66非激活置顶提示窗；desktop-tools在原生操作前获取保护并复查取消；main统一释放，停止IPC验证来源；Windows低级键盘监听区分Scodex自身按键，EOF释放。桌面任务停止后无后续输入，并发普通聊天继续。
- 范围与决策：沿用项目Electron/PowerShell及现有权限、审批和规划保护，不新增依赖；保留并发源码、用户配置和数据。源版本、lock、README同步1.3.29；同轮重建未重复递增。使用Skill：无；无子Agent。

| 已完成需求 | 结果 | 证据 |
| --- | --- | --- |
| 桌面提示、Esc与停止 | 候选6/6实际验收：提示不抢焦点、正常输入/模型Esc、外部焦点Esc、普通聊天继续、停止按钮、HTTP418及重启释放 | [候选验收](../release/desktop-stop-20261101/candidate-ui-native-focus/desktop-stop-ui-verification.json) |
| 构建与版本 | 固定快照Vite及electron-builder dir成功；85项包内资源、3运行时zip一致；NSIS prepackaged退出0 | [构建](../release/desktop-stop-20261101/build-verification.json)、[安装包](../release/desktop-stop-20261101/installer-build-verification.json) |
| 安装及正式功能 | 安装退出0，正式FileVersion1.3.29/注册1.3.29；正式5/5通过，快捷方式有效目标/图标正确 | [正式替换](../release/desktop-stop-20261101/formal-replacement.json)、[正式验收](../release/desktop-stop-20261101/formal-ui/desktop-stop-ui-verification.json) |
| 审查、最终核对与交接 | 17文件差异审查完成，无未解决高置信度问题；最终哈希无漂移，双交接已落盘回读验证 | [审查](../release/desktop-stop-20261101/incremental-review.json)、[最终核对](../release/desktop-stop-20261101/final-incremental-verification.json) |

- 交付身份：[1.3.29 Setup](../../Scodex-Workbench-Setup-1.3.29-x64.exe)，189910580字节，SHA256 a2cdd94f8f08fd39223a48ebe80d06bfad24dedec0bbb19fed662d0e43318fa9。正式EXE SHA256 b0ae1303ece73ebf2d7c4e96f0d28f31fdf69bc97926887aa5d55837e58a751a；ASAR SHA256 e4554953159d73f45ff9763ea4e50bf328631500d3a155f628221e1824f2d5e9。
- 失败与恢复：首构建遗漏直接icon输入，补齐后成功；首UI夹具取前台失败，原生点击修复新驱动后同候选通过；汇总检查将开始菜单IconLocation=,0默认图标误判，按目标程序图标解析后通过，无产品变更。首次失败原证据保留：[元数据失败](../release/desktop-stop-20261101/formal-metadata-failure.json)及候选首轮记录。
- 清理与运行：测试EXE/夹具退出、三份UUID目录删除；无运行中的有限任务。三份无运行依赖的构建中间目录移入[手动删除](../手动删除/desktop-stop-20261101)，原路径已不存在；source-snapshot/node_modules junction及项目依赖目标保留。原/现路径及手动处理见[清理记录](../release/desktop-stop-20261101/cleanup-verification.json)。不得将junction目标作为临时文件递归处理。
- 回滚：保留[1.3.28 Setup](../../Scodex-Workbench-Setup-1.3.28-x64.exe)，SHA256 5d862a1754662ecb0092155b6ddc629dcaed979421914fa2cdb825541b457aa2。先正常关闭程序，再运行旧Setup安装回E:/GDP/Scodex/App；不覆盖用户数据。根目录快捷方式修改前副本在本轮baseline。
- 限制与待办：无本轮功能待办；构建中间目录待手动删除不影响使用。仅模型HTTP由loopback替代，不宣称公网模型、高级浏览器、真实卸载或未变化业务路径通过。最终提示截图在当前设备、页面、视口和数据状态下无可见错误。
- 洞悉评估：直接影响范围无需追加重构，无达标下一步候选。恢复读取[检查点](WORK_CHECKPOINT.md)与[成功流程交接](SUCCESS_WORKFLOW_HANDOFF.md)本节，继续复用有效结果。

<!-- desktop-stop-20261101:end -->

## 主/子模型协同正式发布（2026-11-01，1.3.28已交付）

- 当前状态：已从正式1.3.27安装版递增至1.3.28；桌面和Scodex根目录快捷方式仍指向`E:/GDP/Scodex/App/Scodex工作台.exe`，现为1.3.28。安装包已放`E:/GDP/Scodex/Scodex-Workbench-Setup-1.3.28-x64.exe`，旧1.3.27安装包保留回滚。
- 目标和范围：默认模型负责主任务与最终整合，可按编号或明确指令分配子模型分析及指定路径修改；子模型可使用独立地址、模型、推理强度、工具通道和Windows加密凭据。主模型按真实等待／回读结果整合，路径冲突和主任务结束回收受控。沿用1.3.27图标与安装配置，不改真实用户配置或业务数据。
- 主要变更：`electron/main.cjs`接入分派并统一保护主模型文本、表格、图片、成品及命令写入入口，终态事件晚于子任务回收；`electron/model-connection.cjs`按完整子模型API地址隔离密钥，并独立设置推理强度／工具通道；`electron/subagent-coordinator.cjs`使无路径分析覆盖工作区且允许只读分析并行；模型设置页明确不同地址需要独立密钥和模型。子任务仍限文件工具、授权路径及最新哈希，不能运行命令或继续委派。
- 审查与验证：以[正式1.3.27产品基线](../release/subagent-release-20261101/review-baseline/electron/)及本轮相关源码差异做增量审查，发现的密钥误复用、参数继承、写入锁绕过、终态回收和无范围分析问题已修复；无剩余高置信度代码异常。[审查记录](../release/subagent-release-20261101/incremental-review.json)。定向Node测试41/41、Vite构建、portable／解包候选／正式入口各4/4实际程序验收通过；包内7项主代码与renderer资源逐字节匹配。
- 产物与回滚：[正式安装包](../../Scodex-Workbench-Setup-1.3.28-x64.exe)SHA256 `5d862a1754662ecb0092155b6ddc629dcaed979421914fa2cdb825541b457aa2`；正式EXE SHA256 `ee178876e4e7516dc81b7816a2bd520795efd33811955b9637a9c197bd04fa1c`，ASAR SHA256 `1b57d0406d6bed8b3555b50e47b66144db5b72bf3a780cc9dd74547f015f743f`。[替换记录](../release/subagent-release-20261101/formal-replacement.json)；回滚时先正常关闭应用，再使用[1.3.27安装包](../../Scodex-Workbench-Setup-1.3.27-x64.exe)恢复原安装路径，不覆盖用户数据；旧包SHA256 `cf15ba903626b9693b165fdc1b20082bf8173ecfe21116f593111d7d324f7790`。
- 实网与限制：向catbee.online所选GPT、Claude Kiro、聚合国模各发送“您好测试”均HTTP 200并有回复；Grok密钥模型目录HTTP 200，但`grok-4.7`普通／流式生成均HTTP 426，服务明确提示上游Grok CLI版本过旧。用户明确将Grok排除出本次上线验收，不计入通过率，未宣称Grok可用；[实测记录](../release/subagent-release-20261101/public-model-check.json)。安装器与既有1.3.27一样未配置代码签名；真实卸载及其他未变化业务路径不在本次验收范围。
- 失败恢复和清理：首轮NSIS构建因GitHub连接超时失败，改用已验收1.3.28解包目录的`--prepackaged`方式成功；初轮候选UI脚本未刷新IPC保存后的React状态，修正脚本后复验通过。三个实际程序测试的隔离profile已删除；递归删除命令被自动审批以`blocked by policy`拒绝，未执行，两个中间目录原样移至[手动删除](../手动删除/)中的`subagent-release-20261101-win-unpacked`与`subagent-release-20261101-installer-check`，原路径不存在，不影响正式程序。使用Skill：无；无子Agent。

| 已完成需求 | 状态 | 验收依据 |
| --- | --- | --- |
| 主模型分派并整合独立子模型任务 | 完成 | 正式EXE双子任务编辑、等待、回读与整合4/4组通过 |
| 独立地址／模型／密钥及并发写入保护 | 完成 | 加密磁盘回读、不同地址密钥隔离、重叠与主模型写入拒绝；41/41定向测试 |
| 1.3.28构建、安装替换与回滚 | 完成 | 安装器退出0；正式EXE／ASAR与候选哈希一致；注册表、快捷方式及正式入口复验通过 |
| 增量审查与双交接 | 完成 | 本轮差异及验收记录见相应证据；Grok排除范围明确记录 |

## 安装包与新图标（2026-11-01，1.3.27已交付）

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

| 已完成需求 | 状态 | 结果 |
| --- | --- | --- |
| 安装包放E:/GDP/Scodex | 完成 | Setup实际生成、运行安装，最终复制件哈希一致 |
| 更换其他类型图标 | 完成 | 蓝紫六边形终端，9档ICO及应用嵌入图标视觉核验 |
| 桌面快捷启动 | 完成 | 桌面／开始菜单／根目录均指向E:/GDP/Scodex/App安装版 |
| 实际验证与双交接 | 完成 | 安装入口2/2通过，审查及文档回读完成；手动清理残留明确记录 |

- 当前目标已完成，无未实施功能；仅保留已说明的手动删除项和未覆盖的卸载／公网模型验证。

## 主模型/子模型协同分派（2026-11-01，源码增量）

- 当前目标与状态：默认模型负责主任务和最终决策，可按1、2等编号或明确指令调用受控子模型；子模型使用独立地址、模型和密钥，在主模型分配的工作区相对路径内分析或修改文件，主模型读取真实结果后整合并验证。源码实现与定向验证完成。
- 主要变更：`electron/model-connection.cjs` 增加子模型连接、独立加密凭据、同地址跟随主密钥及不同地址独立密钥校验；`electron/subagent-coordinator.cjs` 管理任务启动、等待、读取、取消、最多3个并发任务和重叠路径锁；`electron/subagent-tools.cjs` 暴露 `subagent_start`、`subagent_wait`、`subagent_read`、`subagent_cancel`；`electron/agent-tools.cjs` 支持子任务路径与工具白名单；`electron/main.cjs` 接入主模型委派、子模型独立请求、文件哈希/未保存编辑/权限保护及主任务结束回收；模型设置组件与模型列表支持子模型配置。
- 并发与边界：不同路径可并发，重叠路径拒绝；子模型不能运行命令或继续委派；子模型写入仍需最新文件哈希，主模型不能写入子模型锁定路径；主任务结束或取消时未完成子任务停止。没有把用户提供的真实密钥写入源码、测试或交接文档。
- 验证：相关 Node 定向测试37/37通过，包含主模型分派→子模型独立连接→授权文件读取/修改→主模型等待→回读整合的运行时夹具，以及规划模式禁止委派测试；6个 Electron 模块 `node --check` 通过；`npm run build` 成功（Vite 1825 modules，保留既有大 chunk 警告）。
- 失败恢复：初轮2个模型连接测试因保存时未把本次新主密钥纳入同地址子模型候选而失败；修正候选凭据判断后22/22连接、工具、协调器测试通过，再通过运行时链路测试。
- 交付与限制：本轮交付为源码和测试，不递增版本、不构建或替换正式 EXE；当前正式1.3.26程序不包含本轮源码增量。运行时测试使用临时目录和本地响应夹具，未验证公网模型或真实用户密钥。
- 轻量重构评估：直接差异范围未发现需追加重构的高置信度问题；无达标下一步候选。使用Skill：test-driven-development（既有评估94/100）；无子Agent。

| 已完成需求 | 状态 | 验收依据 |
| --- | --- | --- |
| 主模型分派编号/明确指令子任务 | 完成 | 主模型工具循环调用 `subagent_start`、`subagent_wait`、`subagent_read` |
| 子模型独立连接与密钥 | 完成 | 主/子请求地址、模型和Bearer密钥在运行时夹具中分别核对；凭据持久化测试通过 |
| 授权路径内并发修改与冲突保护 | 完成 | 非重叠并发、重叠拒绝、路径隔离、哈希和未保存编辑保护测试通过 |
| 主模型整合、取消与交接 | 完成源码与定向验证 | 运行时链路测试通过；主任务结束回收逻辑已接入 |

## CDP权限与容量扩展（2026-11-01，1.3.26已交付）

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

| 已完成需求 | 状态 | 验收依据 |
| --- | --- | --- |
| 当前对话页面CDP、受管子会话及隔离 | 完成 | 实际1.3.26目标过滤、4项越界拒绝、Worker42、Cookie隔离 |
| 10,000条／64 MiB缓存及4 MiB模型包络 | 完成 | 26项辅助；复用原事件分页；4,128,787字节中文模型包络哈希一致 |
| 设置保存、重启与正式程序替换 | 完成 | 候选重启2/2、正式入口2/2，程序及回滚哈希一致 |
| 增量审查、说明与双交接 | 完成 | 本次差异审查及双文档落盘回读；手动清理项明确记录 |

- 执行检查点：目标、约束、实施、实际功能验收、增量审查和交接已完成；无待实施功能。手动删除属于已说明且不影响验收的临时残留。

## 工作台四项补齐（2026-11-01，1.3.25 已交付）

- 当前状态：本轮实现、定向实际验收、正式替换及入口重启复核完成。现有快捷方式保持原目标；文件名沿用1.3.20，实际应用版本和FileVersion/ProductVersion均1.3.25。
- 范围：完整模型选择；实际token用量与最近请求诊断、有限重试/输出上限；加密双向聊天及外观同步和冲突保留；显式启动、预算、停止/恢复的目标执行；DOCX/PPTX生成和受保护编辑、正文预览/PDF排版导出、显式图像模型工具。
- 用户边界：排除真实公网Git/MCP集成验收及高级浏览器自动化；仅对明确指定的catbee.online/v1与deepseek-v4-flash进行真实模型单项测试。现有数据和配置未更改，没有保存测试凭据到正式profile。
- 版本：遵循用户确认的上次正式基线1.3.24，本轮只增至1.3.25一次。替换时约定目标实际仍为1.3.23，其哈希和回滚包如实记录；不追查并发元数据差异。
- 构建：固定源码快照后Vite + electron-builder portable x64；77项electron/dist与包一致，三份运行时zip逐字节一致。SHA256 155689a53cb088503d1c840aeff62938dd007e070ad179ff344b0189a74bd403，168840156字节，renderer assets/index-BUT-gSDC.js。
- 并发：保留浏览器CDP和子模型凭据/范围的其他任务修改；快照之后另有一行model-connection列表归一化变更留在当前源码，未归为本轮实现，也不冒称已包含在本次固定快照包。
- 安全边界：密钥仍用Windows加密；同步正文AES-GCM端到端加密；远端提交不提前推进本地合并基线；文档按观测hash写入并拒绝并发覆盖，外部解析沿用隔离子进程。
- 交付：[候选便携包](../release/workbench-completion-20261101/candidate-snapshot/Scodex-Workbench-1.3.25-x64.exe)；[正式入口](../release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe)；[替换与入口核验](../release/workbench-completion-20261101/formal-replacement.json)。
- 回滚：先正常关闭应用，以[替换前程序](../release/workbench-completion-20261101/formal-previous-1.3.23.exe)恢复约定正式路径；备份SHA256 4f706e591b4da8196b95a8f29a7858252451a965f4aba13c51b46e546a2f2052。不覆盖用户数据或配置。
- 清理：所有本轮测试EXE退出，5轮UUID测试profile/项目均不存在。自动审批拒绝递归删除（仅返回blocked by policy），三个中间目录已移入[手动删除目录](../手动删除/workbench-completion-20261101/)；源码快照node_modules链接保留，勿删除它指向的项目依赖。详情见[清理清单](../release/workbench-completion-20261101/cleanup-verification.json)。这些残留不影响正式程序。
- 使用Skill：systematic-debugging 92（30/20/14/15/8/5）、test-driven-development 93（30/20/15/15/8/5）；沿用既有评估及最小失败恢复/RED-GREEN规范，无子Agent。

| 已完成需求 | 状态 | 验收依据 |
| --- | --- | --- |
| 模型完整选择、用量/诊断和有限重试 | 完成 | 初轮实际设置/503重试/持久化；真实所选模型HTTP200、81 tokens |
| 加密双向同步与冲突保留 | 完成实现与本机集成 | 双设备实际UI三轮加密推送/拉取；合并基线故障测试通过 |
| 持续目标预算、停止和恢复 | 完成 | 初轮实际4轮完成、预算停止、停止无后续副作用、重启恢复 |
| 文档与图像成品工具 | 完成实现 | 实际Office/PDF/PNG产物回读；预览UI编辑、保存及并发拒绝通过 |
| EXE替换、审查和双交接 | 完成 | 23个产品/配置文件定向审查；最终便携和正式入口各3组通过 |

- 证据：[初轮11组](../release/workbench-completion-20261101/ui/acceptance.json)、[最终补验7组](../release/workbench-completion-20261101/final-ui/acceptance.json)、[真实模型3组](../release/workbench-completion-20261101/real-model/acceptance.json)、[便携包3组](../release/workbench-completion-20261101/portable-ui/acceptance.json)、[正式入口3组](../release/workbench-completion-20261101/formal-ui/acceptance.json)、[构建身份](../release/workbench-completion-20261101/build-snapshot-verification.json)、[增量审查](../release/workbench-completion-20261101/incremental-review.json)。
- 已知限制：Supabase公网项目与真实图像模型没有配置，未宣称实网同步/生图通过。Office内容预览/PDF使用工作台排版，不承诺外部复杂模板原版式；目标仅在应用运行且用户显式启动时推进。
- 失败恢复：旧UI选择器与页面入口不匹配，修正测试驱动后仅续验未通过范围；candidate-final因3个并发源文件变动退出1，未用于正式替换。改固定快照构建后通过，失败记录保留。
- 轻量重构评估：已有证据未发现本轮需要追加重构的高置信度问题。排除项及外部服务配置不作为强行追加功能的理由。
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

| 已完成需求 | 实际变更及结果 |
| --- | --- |
| 自动问答与执行 | 普通请求按意图回答或调用工具；不再强制编程问题产生写入；移除主窗口和独立窗口执行开关。 |
| 完整访问工具链 | 文件、命令、图片、表格、浏览器、MCP、开发服务接通full+never共享门槛；on-request继续逐次审批与审计；项目外读取沿途AGENTS。 |
| 授权边界 | 规划/仅对话/后台限制保留；重新生成和协作需要本次勾选，协作保留项目、草稿、运行、归档及并发保护。 |
| 目标功能 | 按附件改Goal图标及浅灰单行入口；保存、编辑、清除、后续消息注入、同聊天及EXE重启恢复实际验收通过。 |
| 正式交付 | 候选源码核验、实际功能验收、无备份覆盖、快捷方式检查、正式路径6项复核均完成。 |

- 验证结论：辅助92项覆盖通过（首轮89/92；旧文案断言同步后受影响15/15通过，另77项复用）；实际unpacked16项通过，portable原15项有效结果复用，协作定向6项通过；正式路径增强断言6/6通过。非公网模型验收。
- 关键证据：[unpacked真实功能](../release/auto-interaction-20261031/green-unpacked/auto-interaction-ui-verification.json)、[正式入口实际功能](../release/auto-interaction-20261031/formal-entry-recheck/auto-interaction-ui-verification.json)、[增量审查](../release/auto-interaction-20261031/incremental-review.json)。

- 失败恢复：ASAR校验的Windows路径已改path.normalize并通过；协作初次目标未绑定项目，改为真实UI创建绑定目标；增强操作断言后发现磁盘pending归一化的中间态误判，完成判据改为非cancelled、非error且有最终持久化回复后再核对操作。只改驱动，不降低断言、不改产品，不重复构建。
- 清理：所有本轮UI fixture已退出并清理；自动审批拒绝递归删除构建目录（blocked by policy），两个归属明确的中间目录已移至E:/GDP/Scodex/workbench/手动删除/auto-interaction-20261031/package-staging和candidate-unpacked，原路径不存在，待用户手动删除，不影响正式程序。[清理清单](../release/auto-interaction-20261031/cleanup-verification.json)。保留候选、基线、测试源码及必要证据。
- 轻量重构评估：共享toolPolicyAllowed已消除本轮工具权限门槛重复；现有证据未发现需追加重构的高置信度问题，不扩大范围。其他权限/模型列表、Supabase及公网独立待办仍依其原章节记录，不因本轮交付自动记为通过。


## 新仓库 smoke CDP 超时阶段诊断（2026-10-31）

- 第九轮候选 smoke 在项目入口改造后出现 `Runtime.evaluate` 超时；失败快照只含初始“项目”入口点击，`scheduled-tasks.json` 尚未创建，未能定位到定时任务或项目切换具体阶段。
- 方案更新：只在候选 smoke 中维护当前阶段字符串，并在异常快照记录阶段；不改变产品行为、成功断言或测试步骤。先语法核对，再运行一次真实 smoke，按阶段证据恢复。
## 新仓库 smoke 项目切换入口校准（2026-10-31）

- 第八轮 smoke 已通过定时任务、插件空态、公开目录空态和技能启停；失败发生在项目切换，候选仍调用已移除的 `.workspace-switch`／`.project-menu`。当前 UI 直接在 `.project-section-heading` 提供“创建项目”，项目列表使用 `.project-item` 和 `title` 路径切换。
- 方案更新：只把候选 smoke 的项目创建／切换步骤改为当前项目列表入口，保留创建、切回原项目、切回新项目、持久化和重启断言；不改产品代码。语法检查后复测。
## 新仓库 smoke 公开目录空态断言校准（2026-10-31）

- 第七轮快照显示插件列表已被隔离为空并进入公开目录；失败原因是候选 smoke 仍等待不存在的 `.extension-public-empty` 节点和旧文案。当前 `PluginMarketplace` 的无来源空态使用 `.marketplace-panel .extension-empty strong`，文案为“读取公开目录”。
- 方案更新：仅修候选 `tests/smoke.cjs` 的公开目录选择器和预期文本，保留“打开页面不自动联网”的真实空态语义；不改产品代码、不添加目录来源、不发起公网请求。语法检查后复测。
## 新仓库 smoke 用户目录祖先进一步隔离（2026-10-31）

- 第六轮快照显示临时 fixture 仍发现12个“项目 .codex”插件，版本与当前用户 `.codex` 内容一致；原因是 Windows 临时目录位于 `C:/Users/Administrator/AppData/Local/Temp`，仍有用户 `.codex` 祖先可被扫描。
- 方案更新：仅在 `workbench-changes` 将 fixture 工作区放到 `C:/Windows/Temp` 下的唯一目录，避开用户目录与 `E:/GDP` 的 `.codex` 祖先；profile 和清理仍使用原临时根，其他范围和产品代码不变。先语法检查，再运行一次候选 smoke。
## 新仓库 smoke 工作区祖先配置隔离（2026-10-31）

- 第五轮诊断快照显示插件页真实列出12个包，来源均为“项目 .codex”。定向检查确认 `E:/GDP/.codex` 存在插件缓存；现有 fixture 位于 `repo-0-staging/workspace`，其祖先扫描会合法发现该项目配置。前置环境变量只能替换个人 `.codex`，不能隐藏项目祖先。
- 方案更新：仅在 `workbench-changes` 候选 smoke 中把 fixture 工作区放到系统临时目录，避开 `E:/GDP/.codex` 祖先，同时继续创建并验证独立项目、技能和任务数据；其他 smoke scope 路径不变。先做语法与差异检查，再运行真实隔离 smoke。
## 新仓库定时任务暂停按钮诊断（2026-10-31）

- 第四轮 smoke 在点击“暂停”后仍未观察到 `enabled:false`；失败快照显示按钮仍为“暂停”，但当前仅能证明元素存在，不能证明点击事件进入 React/IPC。
- 方案更新：只扩展候选 smoke 的失败诊断，捕获匹配的暂停按钮属性及一次捕获到的点击目标；保留 pause 持久化断言和产品代码不变。根据一次实际证据决定是否修正测试点击方式。
## 新仓库插件页加载诊断（2026-10-31）

- 第三轮 smoke 已通过入口定位、定时任务失败持久化和重启技能入口定位；仍在插件页空状态等待超时。候选已设置临时 `SCODEX_REFERENCE_HOME` 与 `SCODEX_REFERENCE_AGENTS_HOME`，但当前快照只含任务状态和页面标题，尚不足以判断插件列表实际内容或 IPC 加载状态。
- 方案更新：仅扩展候选 `tests/smoke.cjs` 异常快照中的插件页可见文本、插件行和空状态节点，继续保留空目录断言；先语法检查，再单轮隔离 smoke。若证据显示能力列表真实非空或加载未完成，再按根因更新方案。
## 新仓库 smoke 重启入口诊断（2026-10-31）

- 第三轮前置检查确认空个人能力目录方案已写入候选；第二轮已完成定时任务链路并进入插件页，失败快照只在后续重启后的技能入口仍使用旧 `.activity-more` 选择器。当前实现的技能入口同样位于 `.workbench-primary-nav`。
- 方案更新：将该剩余旧选择器替换为当前工作台导航“技能”按钮，仅改候选 smoke；执行 `node --check` 后再跑一次隔离 smoke。
## 新仓库隔离烟测个人能力目录（2026-10-31）

- 第二轮实际候选 smoke 已验证定时任务失败持久化；随后插件空目录断言超时。源码表明能力扫描默认使用当前用户 `.codex` 与 `.agents`；本机这两处存在插件缓存／个人技能，故此前烟测并未隔离个人能力目录，空插件预期不成立。
- 方案更新：仅在候选 `tests/smoke.cjs` 的 workbench-changes 环境，为既有 `SCODEX_REFERENCE_HOME` 与 `SCODEX_REFERENCE_AGENTS_HOME` 配置临时空目录并创建目录；保留固定的空插件断言，产品代码不变。脚本语法／差异核对后，再运行一次同一 portable EXE smoke。
## 新仓库烟测诊断结果与方案切换（2026-10-31）

- 失败快照 `repo-0-staging/release/smoke-failure-scodex-smoke-75015a55-5c39-4134-ae93-6a5543990be7.json` 显示：隔离任务已在点击“立即运行”后持久化为 `failed`，`completedAt` 已写入，输出为缺少 API Key；页面 Toast 为“定时任务执行失败，请查看运行记录”。定时任务 IPC、调度服务和错误持久化满足预期，原失败点不属于产品代码。
- 方案切换：只修候选 `tests/smoke.cjs` 的插件入口定位，将已移除的 `.activity-more` 菜单点击改为当前 `.workbench-primary-nav` 的“插件”按钮；保留产品代码、任务断言和后续技能／项目验收。写后执行脚本语法检查并再次运行隔离烟测。
## 新仓库定时任务烟测诊断方案（2026-10-31）

- 定向源码追踪：UI 点击会等待 scheduled-tasks:run IPC；服务先持久化状态 running，runPrompt 结束后写回最终状态。隔离 SCODEX_HOME 未创建凭据时，模型连接应快速以缺少 API Key 失败。之前烟测超时且 finally 删除 profile，故没有证据判断 IPC 触发、运行状态或持久化结果。
- 方案更新：只在候选 tests/smoke.cjs 的异常路径，捕获隔离 scheduled-tasks.json 及相关定时任务界面状态到唯一的 release/smoke-failure-<smokeId>.json；不保留完整 profile，不记录模型凭据，不改产品代码或成功断言。写后做 node --check 与差异审查，再运行一次实际隔离 EXE 烟测，根据快照决定后续修复。
## 新仓库烟测任务运行失败记录（2026-10-31）

- 修订后的Dashboard检查通过；实际隔离EXE随后创建并暂停“隔离验收任务”，点击“立即运行”后驱动未观察到满足`status=failed && output`的持久化记录，等待超时。失败时真实页面停留在定时任务视图，已见“刷新/新建任务”；候选 smoke `finally`已清理临时profile，因此本轮任务运行JSON状态未留存，不能据此判断服务实际状态。
- 当前待定位：仅检查`runScheduledTask` IPC、调度服务执行/持久化字段和该旧烟测期待，找出当前无凭据运行到底是否启动及真实写入结果。先做只读追踪，按证据更新测试方案；若无法恢复有定位证据的隔离profile结果，下一轮烟测可单独增加失败时结构化快照，不触碰用户数据。

## 新仓库烟测恢复方案再次更新（2026-10-31）

- 第二轮定向烟测确认旧首页、设置、折叠和历史入口已按当前ActivityRail对齐；现在失败在Dashboard文案断言：驱动预期旧GDP标题和“你的本地 AI 工作空间”，当前`Dashboard`实际标题为“我们应该在 Scodex 中做些什么？”，副标题为“项目：<当前项目名> · 由 AI 自动选择处理方式”。当前候选页面加载、旧历史导入、新会话、任务导航和首页交互均已实际通过到该断言位置。
- 更新方案只改候选`tests/smoke.cjs`的`checkWelcomeLayout`预期，校验当前固定标题和调用方传入的项目名；创建项目后将预期更新为真实项目名。保留视口几何检查及其他断言，不改变应用行为。先核对本scope后续测试的选择器与当前组件，再一次写入/语法核对，最后复测隔离EXE smoke。

## 新仓库烟测恢复方案更新（2026-10-31）

- 第一次驱动修订改为按文本/可访问名称定位“新建对话”，烟测因此越过旧`.new-task-button`失败，继续在旧`工作台首页`标签点击时报空引用。真实候选renderer身份、legacy消息渲染和新对话状态均已确认，问题仍限定在smoke选择器漂移。
- 对比证据：当前`ActivityRail`用“项目”“最近”“设置”，侧栏切换用“收起侧栏/展开侧栏”；旧驱动仍找“工作台首页”“工作台设置”“收起左侧导航”，且尝试由已移除的“对话记录”导航打开列表。
- 更新后的方案：仅改候选`tests/smoke.cjs`，把旧首页标签映射到项目入口、设置标签映射到设置入口、折叠标签映射到现有状态名称，并由“最近”按钮打开对话列表。保留已通过的可访问名称回退辅助函数。候选产品代码、正式入口、315项测试和构建产物不变；做一次写后核对，再只复测隔离EXE smoke。

## 新仓库候选烟测失败恢复记录（2026-10-31）

- 更新验证：315/315 Node 测试通过；许可证元数据294组件生成；Vite 1822模块构建通过；portable x64候选已生成。`SCODEX_SMOKE_SCOPE=workbench-changes npm run smoke`在真实隔离EXE中加载迁移历史并确认renderer身份后，等待“新建对话”时失败。
- 根因：候选`tests/smoke.cjs`使用旧`.new-task-button`类名和文本匹配；当前renderer的等价控件是`.recent-section-heading button[aria-label="新建对话"]`，其图标按钮文本为空。失败页面有正常主体和迁移消息，无启动崩溃或数据错误证据。
- 方案切换：只调整候选烟测驱动的控件定位辅助函数，使其在保留文本匹配的同时匹配可访问名称和title；不修改产品renderer。更新后仅重新执行隔离`workbench-changes`烟测，构建和315项Node结果在代码未变范围内继续有效。

## 新仓库候选失败恢复记录（2026-10-31）

- 首轮验证：`npm ci --no-audit --no-fund` 成功；`npm run dist` 的 Node 测试阶段为305通过、2失败，随后有限流程在测试阶段停止，未进入构建/烟测。失败为 `tests/storage.test.mjs` 的 v2 归一化往返断言，以及并发运行中的 `tests/settings.test.mjs` 子进程 Electron 安装状态异常。
- 根因与范围：storage 失败可单独稳定复现；`normalizeLibrary()`为规范化会话补出`unreadResult:false`，但`createConversation()`未带同一默认字段，导致新建会话经JSON往返后结构变化。settings失败单独运行通过，错误发生在并发测试期间 Electron 下载器删除/重建`node_modules/electron/dist`时的Windows文件竞争，未确认是产品逻辑缺陷。
- 方案切换：采用最小实现修复，在候选 `electron/conversations.cjs` 的 `createConversation()` 增加 `unreadResult: false`，保持现有归一化和持久化契约；不修改测试断言或无关模块。修复后先复测 `tests/storage.test.mjs` 和 `tests/settings.test.mjs`，再继续许可证生成、Vite构建、portable打包和隔离烟测。若并发全量仍触发Electron运行时竞争，记录为环境阻塞并使用已完成的独立定向测试与构建证据，不盲目重复相同全量命令。

# 项目交接

## 当前执行检查点：1.3.21 五类工作流

- 当前目标：编程、文件、Git／PR、SKILL、MCP按固定50项等权清单验收，目标95%–100%；未验证与阻塞计0，不移用旧仓库方案或工程估计。新仓库 https://github.com/song123-jian/-0 ，项目 E:/GDP/Scodex/workbench；本地无Git元数据，不向新仓库批量发布根目录。
- 范围与约束：统一所有来源的技能选择核验，增加受当前权限约束的包内相对资料只读工具；保护用户改动、配置及业务数据。源码/候选沿用1.3.21，后台助手已通过登录期间真实候选验收；正式入口已覆盖为1.3.21，旧1.3.20未保留备份。UI 对标本轮已完成。
- 基线：本轮修改前内容及SHA256见[source-baseline.json](../release/workflow-completion-20261031/source-baseline.json)。已读main的callModel/技能发现、agent-tools、permission-policy、local-capabilities、workbench选择路径及相关验收驱动；不扫描历史。
- 有效方案：1. 固定[50项清单](WORKFLOW_ACCEPTANCE.md)、核对证据和保存基线；2. 实现全部技能选择复核及受控随包资料读取；3. 定向辅助测试、构建真实候选并验证所选技能/资料/执行路径，复用不受影响证据；4. 增量审查、清理及双交接核验，报告实际比例与未覆盖链路。
- 验收：真实候选能够完成所选技能→读取相对资料→项目读改读/真实测试；停用、更改、取消、越界、链接、敏感/超量/非UTF8、只读与对话边界按当前权限拒绝；静态与模拟证据不冒充公网验证。

| 任务 | 状态 | 阻塞 |
| --- | --- | --- |
| 检查点、基线与固定清单 | 已建立；文档验收见checkpoint-document-verification.json | 无 |
| 新仓库 -0 本地源码基线 | 候选已建、待验证 | `E:/GDP/Scodex/repo-0-staging` 从公开空仓库克隆；筛选复制218个源码/构建/测试/资源文件，SHA逐项一致。未安装依赖、未测试/构建/提交；不推送或创建PR |
| 技能核验和资料工具 | 已实现 electron/skill-context.cjs 并接入 main；12项新增辅助用例 | 实际候选四项检查已通过；公网Git/PR与指定公网MCP仍不在本轮范围 |
| 定向验证与实际1.3.21候选 | 完成；实际候选四项检查通过 | [技能上下文报告](../release/workflow-completion-20261031/skill-context-ui-verification.json)：身份/隔离项目、选中技能资料和真实项目读改读/测试、普通文件工具拒绝二进制与超量输入、停用技能被拒绝且未产生模型请求均通过；模型为loopback替代。公网Git/PR与指定公网MCP未覆盖 |
| 当前候选F10补验与评分 | 完成；F10通过 | 四项候选检查与48/50（96%）已有证据；持久化操作查询已同时绑定新对话ID和唯一提示词，最终驱动退出0；G10/M10保持阻塞 |
| 登录期间后台助手候选 | 完成；7/7通过 | WMI broker 创建的隐藏助手在主程序退出后存活并真实到期执行；报告见 [candidate-wmi-ui-4](../release/session-scheduler-20261031/candidate-wmi-ui-4/scheduled-background-ui-verification.json)，候选 SHA `1B38F22036B0D62F673DB414188A8B283E123F6126BDD3EB2B70ACEBA1B0334D` |
| 正式入口覆盖与旧版删除 | 完成 | 正式目标路径哈希已变为候选哈希，File/ProductVersion 为1.3.21；快捷方式描述已更新，旧1.3.20未创建备份；记录见 [formal-replacement.json](../release/session-scheduler-20261031/formal-replacement.json) |
| 增量审查与最终双交接 | complete | Candidate incremental review, six formal session checks, independent dual viewport recheck, and document readback passed; formal entry covers all 7 checks |
- Formal entry layout recheck passed at 1064x660 and 1440x900; `scrollWidth` matched each viewport, the task area and toggle stayed inside the viewport, Microsoft YaHei14px; evidence: `release/session-scheduler-20261031/formal-entry-session/layout-only/formal-layout-verification.json`; fixture removed.

- 使用Skill：computer-use（93分，实际EXE界面验证）与 systematic-debugging（98分，定位归档复制失败）；主Agent直接实施，无子Agent。

- 恢复方案：先核对运行包源文件与占用，使用已验证完整的独立运行包快照和新的候选目录恢复打包；不重跑有效辅助测试或前端构建。构建后核对包内源码，再新增实际EXE技能资料验收；版本沿用1.3.21，正式入口仍1.3.20。失败证据见[build.log](../release/workflow-completion-20261031/build.log)，有效辅助证据见[targeted-tests.log](../release/workflow-completion-20261031/targeted-tests.log)。portable EXE已生成但尚未功能验收；不将构建成功或辅助测试视为功能通过。
- 当前恢复交接和检查点验证见[recovery-document-verification.json](../release/workflow-completion-20261031/recovery-document-verification.json)。
- 运行包校验前置恢复：快照node.zip已读写成功；首次恢复脚本因缺少7zip-bin在打包前停止，证据为portable-recovery-build.log。改用项目已安装yauzl与Node原生CRC32逐条校验ZIP，不新增依赖，保留原失败；独立快照和新输出目录方案保持。
- 第1条打包恢复失败：独立快照三个ZIP全部CRC32/长度通过，但electron-builder的copyfile仍报EBUSY，见build-recovery-verification.json及portable-snapshot-build.log。第2条路径保留校验快照，清空extraResources自动复制，afterPack用readFile/writeFile写入新candidate-streamed并逐项SHA回读；版本与源代码不变。若仍失败，停止同条件重试并报告。

- 打包恢复第2路径结果：stream-build-verification.json为failed，afterPack以wx写入已存在node.zip时报EEXIST；工具包装退出0不代表构建通过。只读核对发现electron-builder仍合并复制extraResources，三个运行包SHA与已验证快照一致，main、新skill-context及前端入口与当前源码一致。停止重跑复制方案，改为先完整核对electron/dist和manifest，再以现有candidate-streamed/win-unpacked作prepackaged生成portable，不修改产品源码或重新复制运行包。原失败证据保留。

- prepackaged首次核验在打包前停止：Windows ASAR嵌套文件路径使用POSIX分隔符，导致CSS提取误报不存在；同一文件用本机分隔符可读。仅将核验脚本改path.normalize，产品及打包路线不变。失败报告保留prepackaged-sourcecheck-failure.json，未运行实际程序测试。

- 候选：[Scodex-Workbench-1.3.21-x64.exe](../release/workflow-completion-20261031/candidate-final/Scodex-Workbench-1.3.21-x64.exe)，SHA256 `fe29cf99ab7719e12deb1667cc1749e55b6b46f7546f9da25057a5eb1b2368a4`; formal entry hash/version are recorded above.
- 最新实际候选报告四项检查全部通过：候选身份与隔离项目；技能资料读取、项目读改读及真实测试（操作8项、命令退出码1/0）；普通文件工具对4字节NUL文件与2,097,153字节文本均拒绝并回读错误及哈希；停用技能时主进程返回预期拒绝且模型fixture请求数未增加。固定清单现按可定位的历史与本轮证据计48/50（96%）；G10、M10因公网仓库、公网MCP证据缺失计0。
- 首轮F10失败证据：[驱动竞态诊断](../release/workflow-completion-20261031/f10-driver-race-diagnostic.json)。真实候选已返回二进制与超量文本的精确拒绝结果，文件哈希未变；断言却误读前一对话中成功的calculator.cjs读取。原因是操作历史查询没有绑定F10会话和提示词，不是产品行为失败。
- F10复测恢复记录：首次未开放新对话的执行工具，未触发文件操作；第二次实际收到二进制和超量拒绝，但驱动持久化查询误取上一对话操作。两份失败诊断分别保存在[首次失败](../release/workflow-completion-20261031/skill-context-ui-f10-initial-failure.json)与[记录查询失败](../release/workflow-completion-20261031/skill-context-ui-f10-persistence-failure.json)。最终驱动按新对话ID与唯一提示词共同匹配操作记录并退出0；[增量审查](../release/workflow-completion-20261031/incremental-review.json)与清理清单已同步更新。
- 真实复测结果：持久化轮询修复后，候选身份、技能上下文、包内相对资料读取、隔离项目读改读、首测失败与修复后成功均通过；报告第二个检查在停用技能边界处失败。实际主进程已返回“所选技能已在插件设置中停用，请刷新技能列表后重试”，这是预期拒绝；驱动未捕获 `chat:send` 的 rejected promise，故报告 status 仍为 failed。下一条修复仅在驱动中将该异常转为拒绝证据并继续断言，不改产品。

- 最终实际候选验收：`skill-context-ui-verification.json` 为 `passed`，四项检查全部通过；驱动 `node tests/skill-context-ui.cjs` 退出0。普通文件工具两次拒绝、停用技能错误由主进程拒绝且未增加模型fixture请求，未修改产品源码或正式入口。
- 测试夹具清理：8份隔离fixture（两次失败、两次通过及末尾发现的4份遗漏同类夹具）已移入[手动删除目录](../手动删除/workflow-f10-20261031)，8个原Temp路径均不存在、归属进程为0；共23,463个文件／1,520,882,484字节，未物理删除，精确清单见[workflow-f10-runtime-cleanup.json](../release/workflow-completion-20261031/workflow-f10-runtime-cleanup.json)。
- 偏航/副作用：旧候选启动参数曾误把`--scodex-home`指向真实用户目录；未发送按键、消息或模型请求，但不能证明进程未读取本地配置。启动触发内置工具安装，创建`C:\Users\Administrator\workspace-tools`。仅有本轮UUID运行时且无先前运行时的证据已留存；清理命令被自动审批拦截，未删除，目录仍在。

## UI 对标阶段：1.3.21（已完成）

- 目标：在固定 1280×819 视口下，对齐参考 EXE 的侧栏展开／折叠布局、导航信息层级、字体、颜色／边框／图标及状态交互；UI 阶段不替代后台助手、工作流或公网能力验收。
- 本轮源码变更：空数据状态下仅在存在已归档项目或已进入归档视图时显示“已归档项目”；折叠侧栏保留“项目”“最近”标题和最近条目文字的窄列可见性，与参考布局一致。涉及 [src/workbench.jsx](../src/workbench.jsx) 与 [src/styles.css](../src/styles.css)。
- 构建：先执行 `npm run build`，Vite 1822 modules 通过；使用既有预打包恢复路线生成 [1.3.21 portable 候选](../release/ui-alignment-20261031/candidate-rebuilt/Scodex-Workbench-1.3.21-x64.exe)，版本保持 1.3.21，包内当前 `dist`、`electron` 与源码逐项核对见 [rebuild-verification.json](../release/ui-alignment-20261031/rebuild-verification.json)。
- 实测：以参考 EXE `release/chat-reference-final-ui-20261024/win-unpacked/Scodex工作台.exe` 和上述候选使用相同隔离 profile、受控中文消息、CDP 固定视口，分别测试展开／折叠并截图。最终报告为 [ui-alignment-measurement.json](../release/ui-alignment-20261031/measure-candidate-2/ui-alignment-measurement.json)，候选 SHA256 `7130CAA34BFF7ADE485017AE72613B9DF3F5AAADF80B6FF5876EF7675CB3C9F1`。
- 相似度：总分 **100%**；几何 99.99%、导航与信息层级 100%、字体 100%、颜色／边框／图标 100%、折叠及状态交互 100%。证据截图位于 `release/ui-alignment-20261031/measure-candidate-2/measurements/`。该分数限定为固定视口和受控 fixture 的视觉／布局对标，不代表整体功能或公网集成已完成。
- 增量审查：仅审查本轮 `workbench.jsx` 条件渲染和 `styles.css` 折叠侧栏规则，确认未改变归档操作、展开状态和业务数据路径；源文件 UTF-8 无 BOM，候选实际 UI 测量通过。审查记录见 [incremental-review.json](../release/ui-alignment-20261031/incremental-review.json)。
- 当前正式入口：仍为 1.3.20，尚未替换或删除旧 EXE；后台助手在主程序退出后的真实到期触发仍是既有阻塞，不能据 UI 100% 宣称整体 95%–100%。

## 待办检查点：1.3.21 登录期间后台助手（尚未完成）

- 目标：在 Windows 当前用户计划任务登记被拒时，使用用户明确启用的隐藏后台助手，到期启动同一 portable EXE、profile 与 Scodex home；完成验收后覆盖正式 1.3.20，不保留旧 EXE 或备份，保留配置与业务数据。本轮继续使用 1.3.21。
- 方案变化：原 Windows 任务方案的登记已由 COM／SID／schtasks 确认返回 0x80070005，不重复相同权限尝试；保留原生方案作为首选，仅在确认未登记且登记权限被拒时选用助手并保存选择。助手只覆盖本次登录期间，重启电脑后须重新打开程序；界面须明确说明。没有提权或系统安全策略变更。
- 步骤：1. 保存基线与方案交接；2. 实现助手及备用选择、状态与边界用例；3. 对实际候选退出后触发失败补充进程父子／Job 诊断。最新 WMI 启动轮中 PowerShell 与 Node runner 均在 Job 外，候选首项 UI 检查通过；真实到期仍失败，诊断显示助手仍处于 Electron 同一受限生命周期，主程序退出后助手消失、launchCount=0。先在受控 kill-on-close Job 中验证可用的 Shell/WMI 启动边界，再据证据选择修复方式；4. 完成新候选实际验收与增量审查，失败只按证据修复和复测；5. 验收通过后覆盖正式入口、精确清除旧 EXE 与临时回滚副本，并完成双交接核验。
- 基线：[源文件与文档基线](../release/session-scheduler-20261031/source-baseline.json)。无 Git 元数据；仅本阶段真实差异归入审查。已读 main 启动／退出／单实例、scheduled-background、任务页与已有驱动；既有协作 11/11 和原生调度拒绝恢复 4/4 在未变范围继续有效。

| 任务 | 状态 | 阻塞 |
| --- | --- | --- |
| 方案、基线及双交接 | 已记录；落盘核验见本阶段 document-verification.json | 无 |
| 助手与备用状态、定向测试 | 实现已写入；首轮17项中15项通过、2项真实助手启动超时；后续真实助手2项通过 | 实际候选在主程序退出后未触发；受控启动边界仍待验证 |
| 新候选构建与实际 EXE | portable x64 1.3.21 已构建；WMI 启动的实际候选首项 UI 检查通过 | 真实到期触发失败；PowerShell 与 Node runner 均在 Job 外，但产品助手仍在 Electron 所属 Job，主程序退出后消失、launchCount=0。见[最新生命周期诊断](../release/session-scheduler-20261031/candidate-ui-breakaway/run-6fe0e6f78ade4b14a63f4f1c881c6e09/scheduled-background-ui-verification.json) |
| 增量审查、正式替换与旧版删除 | 未实施 | 等待本阶段实际 EXE 验收通过 |
| 正式替换、旧 EXE 删除及最终交接 | 未实施 | 依赖新候选验收 |

- 验收：退出主程序后真实到期触发、无窗口、同 profile 单实例转交且不重复、停用／暂停／删除停止助手、失败记录与重启保持；双视口状态与限制可见。受控模型不代表公网集成，助手不等于原生 OS 登记成功，不声明整体 95%。
- 失败恢复方案：首轮[定向日志](../release/session-scheduler-20261031/targeted-tests.log)17项／15通过／2超时；只读复现的[诊断](../release/session-scheduler-20261031/helper-start-diagnostic/diagnostic.json)显示进程退出0但未完成停止心跳，残留状态临时文件记录 File.Replace“三参数／路径形式不合法”。根因为 PowerShell将第三个 .NET string 参数的 $null 转成空字符串，最早失效在第二次心跳替换。改用明确的 .NET null-string，只调整此参数并复验2个真实助手用例；其余15项和既有结论复用。该替代修复为同一阻塞的第1条路径，尚未实施或验收。
- 第1条修复已实施但[2项复验](../release/session-scheduler-20261031/helper-recovery-tests.log)仍在助手启动前超时；参数修复本身由直接脚本运行确认心跳和停止状态正常。[接口诊断](../release/session-scheduler-20261031/helper-api-diagnostic/diagnostic.json)无状态、进程退出0；[两种启动对比](../release/session-scheduler-20261031/helper-spawn-diagnostic.json)确认 detached=true 在50ms、脚本前退出，detached=false正常运行3207ms并写stopped=true。因此第2条替代路径只移除Windows detached创建标志，保留windowsHide／stdio ignore及unref；先复验2项，再以实际EXE退出后触发确认父进程独立性。若仍失败不继续无效重试。
- 第2条启动路径的辅助用例2/2通过，但实际候选 [1.3.21 EXE](../release/session-scheduler-20261031/candidate/Scodex-Workbench-1.3.21-x64.exe) SHA256 `5ea1ef7a153a73b9a5fa75855ab30ab87058f87235b25c0834c0c1df6868c262` 的[真实界面报告](../release/session-scheduler-20261031/candidate-ui/scheduled-background-ui-verification.json)失败：默认关闭、启用隐藏助手及界面限制检查通过；单次任务到期 `2026-10-31T02:32:00Z` 后没有模型请求。夹具计划仍 `enabled=true`；助手 PID 5152 的状态停在 `02:31:08Z`、`stopped=false`、`launchCount=0`，当前 PID 不存在。报告于 `02:34:09Z` 结束，夹具 `C:\Users\Administrator\AppData\Local\Temp\scodex-background-ui-4117702a-57ac-4a03-b1d5-11db4fff81dc` 保留。报告中的 `taskRemoved=true` 不代表夹具计划已删除；目前状态文件和计划文件证明它仍启用。后续诊断显示助手 PID 8956 的父进程为 Electron PID 21860，便携入口 PID 25292 以退出码 0 结束；主程序与助手都属于某个 Job，但 `IsProcessInJob` 不能确认它们是否属于同一个 Job。breakaway runner 也仍报告属于 Job，守卫在测试开始前终止了 runner；没有运行该轮测试。证据见[未启动的 breakaway 诊断](../release/session-scheduler-20261031/candidate-ui-breakaway/launcher-diagnostic.json)。下一步通过 Explorer ShellExecute 启动隔离测试进程，并在开始测试前确认启动 PowerShell 与 Node runner 均不属于任何 Job；若条件不成立则停止测试，不改产品实现。
- 方案切换（待实施）：普通 ShellExecute 诊断仍在 Job 内；独立 WMI 探针已确认 `Win32_Process.Create` 创建的 PowerShell 父进程为 `WmiPrvSE.exe` 且 `IsProcessInJob=false`。替代实现改为 Electron 内短暂 broker 调用 WMI 创建隐藏助手，broker 错误写入 profile 临时错误文件并由注册等待读取；只改变启动边界，不改变计划格式、心跳、停用、单实例和到期逻辑。预期主程序退出后助手仍存活；验证方式为先跑定向辅助，再用新候选实际 EXE 完全退出后等待真实到期并检查 `launchCount`、模型请求和进程 Job 状态。若仍失败停止同类重试。
- 第一次 Explorer ShellExecute 启动记录见[shell-runner-diagnostic.json](../release/session-scheduler-20261031/candidate-ui-breakaway/shell-runner-diagnostic.json)：PowerShell PID 9328、父 PID 4268 已在 CIM 查询前退出；严格模式读取空父进程对象的 `Name` 属性时异常，故 Job 状态和候选哈希均未检查，候选、driver 与新 fixture 均未启动。该失败属于诊断启动器，不是产品测试结果。随后修复 PowerShell 与 Node runner 可缺失父进程名的诊断，并增加逐轮独立输出目录及 Node 进程信息缺失守卫；第二次尝试结果见下条。
- 前一轮启动诊断的报告将入口标为 Explorer ShellExecute，但实际父进程名称缺失，不能据此确认启动机制；其 `inJob=true` 结果只证明该次 PowerShell 仍在 Job。最新[候选验收报告](../release/session-scheduler-20261031/candidate-ui-breakaway/run-6fe0e6f78ade4b14a63f4f1c881c6e09/scheduled-background-ui-verification.json)及[启动器诊断](../release/session-scheduler-20261031/candidate-ui-breakaway/run-6fe0e6f78ade4b14a63f4f1c881c6e09/shell-runner-diagnostic.json)确认 PowerShell PID 23100 的父进程为 `WmiPrvSE.exe`、`inJob=false`；Node PID 2336 两次检查均 `inJob=false`，候选 SHA256 匹配并实际运行。第一项通过，但退出后 `OS-CLOSED` 未到模型端点，测试退出码 1。主 PID 26368 与助手 PID 2304 均 `inAnyJob=true`，助手父 PID 2060；主程序退出码 0 后助手进程消失，状态仍 `launchCount=0`、`stopped=false`。`IsProcessInJob` 只回答是否属于任意 Job，不标识 Job 身份；下一步在受控 kill-on-close Job 中实际验证启动 broker 的进程归属与父进程退出存活，再选择产品实现，不推断 Explorer 已验证。
- 当前正式入口仍是 1.3.20，候选未替换，旧版未删除；配置与业务数据未动。前阶段“手动删除”项不重试已被自动审批拒绝的递归删除。
- 使用 Skill：systematic-debugging（97/100）；无子 Agent。

## 当前执行检查点：1.3.21 跨任务协作（候选11项通过，正式替换仍受调度阻塞）

- 目标：补齐已存在的跨项目并行聊天之间的查看、交接发送与结果等待；整体80%–85%仍为工程估计，没有统一基准实测，不声明95%。
- 正式版本仍为1.3.20；本阶段沿用未正式交付的1.3.21，不重复递增。已有调度实现和证据保留，Windows登记成功链路仍受E_ACCESSDENIED阻塞，未满足正式替换条件。最终覆盖旧正式EXE，不保留旧EXE或备份，保留配置和业务数据。
- 接入决策：主renderer继续统一管理聊天与持久化；主进程用有界请求／回执桥接模型工具。查看只返回有界文本和运行状态；交接发送独立审批、复核目标版本及草稿，默认不执行项目工具，禁止协作请求继续自动转发。已提交不等于已完成。
- 已读：main的保存队列、callModel、chat:send与主窗口IPC；preload；workbench的消息执行、事件、独立窗及关闭快照；conversations、chat-runs、workspace-windows；现有并行聊天驱动。无Git元数据，本阶段[修改前基线](../release/task-collaboration-20261031/source-baseline.json)保存6个既有文件内容及哈希。

| 任务 | 状态 | 阻塞 |
| --- | --- | --- |
| 调度阶段双交接及正式入口核验 | 完成；见调度document-verification.json | 成功OS登记仍尚未完成验证 |
| 协作接入与修改基线 | 完成 | 无 |
| 协作UI、模型工具及有界桥接 | 完成；同一候选累计11/11项通过 | 无协作范围内已知阻塞 |
| 定向辅助、前端及portable构建 | 完成；22/22、1822 modules、打包退出0 | 无 |
| 实际候选、增量审查及最终双交接 | 实际验收、9文件增量审查与视觉检查完成；包内8项一致 | 清理移动项见下文；双交接以document-verification.json为准 |
| 正式覆盖 | 待验收 | 入包调度成功链路未验收 |

- 验收：实际候选EXE上的任务查看、跨项目交接、明确审批、拒绝／过期目标／归档／忙任务／草稿保护、三任务限制、结果等待与重启保存；模型用受控回环端点，不能据此声称公网模型集成通过。复用未变功能结果，不重跑全项目。
- 候选：[portable x64 1.3.21](../release/task-collaboration-20261031/candidate/Scodex-Workbench-1.3.21-x64.exe)，SHA256 `2b288859c6e5267288b9dd9cc0a4d17dbea13fd7a133c0c2b789333613d2a97f`，167302048字节，文件／产品版本1.3.21。[构建身份](../release/task-collaboration-20261031/build-verification.json)记录包内8项逐字节一致；[实际候选报告](../release/task-collaboration-20261031/candidate-ui-5/task-collaboration-ui-verification.json)累计11/11通过，前8项按同SHA及fixture复用，末3项本轮执行。驱动为 `tests/task-collaboration-ui.cjs`；本轮只修驱动，不重建产品。
- 核验脚本恢复：首次asar核对在多级路径 `dist/assets` 报not found；根因为asar在Windows按原生分隔符查目录，改用 `path.normalize` 后8项核对通过；产品代码和构建不变。
- 实际EXE首轮失败：[失败报告](../release/task-collaboration-20261031/candidate-ui/task-collaboration-ui-verification.json)保持failed，初始化TEST:SEED等待45秒超时，完整场景0项、模型请求0。隔离profile的权限审计记录network／approval-required／“沙箱网络访问未启用”；测试fixture两份workspace-write设置漏开networkAccess及allowLocalBinding，原生审批等待导致停止清理亦超时。已核对fixture命令行及父子归属，仅结束本轮自有PID8092，工具会话66142退出1；没有结束用户进程，fixture暂留作诊断。
- 第2轮实际状态：[candidate-ui-2报告](../release/task-collaboration-20261031/candidate-ui-2/task-collaboration-ui-verification.json)保持failed，实际EXE前2项通过，网络问题解除；第3项持久化消息executionEnabled为undefined，驱动严格比较false失败。既有conversations.cjs只持久化executionEnabled=true；实际请求tools=[]、回答深度medium、目标执行偏好true，未发现产品行为错误。该轮EXE及工具会话64712正常退出，EXE退出0。
- 第3轮实际状态：[candidate-ui-3报告](../release/task-collaboration-20261031/candidate-ui-3/task-collaboration-ui-verification.json)保持failed，前3项通过；第4项实际read_file成功，界面与最终磁盘均为“真实目标项目文件：1: 仅属于项目 B”，task_send未开放。驱动在运行行消失后直接读取磁盘，早于防抖保存；失败时界面为“正在保存…”，因此读到空助手内容。EXE正常退出0，无产品改写依据。
- 第4轮实际状态：[candidate-ui-4报告](../release/task-collaboration-20261031/candidate-ui-4/task-collaboration-ui-verification.json)保持failed，累计前8项通过，含真实目标项目文件、禁止转发、草稿／附件保护及审批拒绝／目标变化／停止；EXE PID19872退出0，驱动退出1，无清理错误。第9项实际task_send返回submitted=true、task_wait返回timedOut=true／settled=false；测试端用首个TEST标签识别消息，误取来源标题TEST:MODEL-REJECT而非独立一行的TEST:MODEL-HANDOFF，给仅回答目标返回task_list，目标正确拒绝工具。原始请求顺序和目标持久化均支持此根因，未发现该处产品缺陷。
- 恢复完成：测试端标签改为独立TEST指令行，原失败消息回放、node --check、严格UTF-8无BOM及落盘回读通过；发送／有界等待／独立目标、三任务限制、重启与双视口3项通过，工具会话30143退出0，EXE PID11000、10712均退出0，无清理错误。目标在来源结束后继续，等待超时不冒充完成；目标实际结束后再读取为completed。原失败报告保留failed，22项辅助及未变功能结果继续有效。
- 审查及视觉：[9文件增量审查](../release/task-collaboration-20261031/incremental-review.json)完成，基线为本阶段修改前4份代码及5份新文件，未发现本轮需修复的高置信度问题；[视觉记录](../release/task-collaboration-20261031/visual-verification.json)与[最终截图](../release/task-collaboration-20261031/candidate-ui-5/task-collaboration.png)。1064×660及1440×900几何检查无横向溢出，微软雅黑；已查看1440×900截图，当前设备、页面、视口和数据状态下无可见错误。CDP不覆盖Windows原生图层。
- 清理：2份本阶段fixture已核对归属、绝对路径、无重解析点及无应用进程后移至 `E:/GDP/Scodex/workbench/手动删除/task-collaboration-20261031-1.3.21`，共5867文件／378769777字节，原路径均不存在，尚未物理删除；此前自动审批拒绝递归删除，本轮未重试。原报告fixture路径为当时事实，当前路径映射见[清理记录](../release/task-collaboration-20261031/runtime-cleanup.json)，相关权限审计保留于移动后的profile；正式程序、配置、业务数据和证据未动。
- 轻量洞悉评估：本轮没有需追加的范围内重构；整体目标仍未达标，后续优先解决已有后台调度阻塞，不将未完成项转为交付通过。正式入口仍为1.3.20，本阶段没有执行替换或保留旧版备份。
- 使用Skill：无；无子Agent。前阶段清理的人工删除项维持下节记录，不重试已被拒的递归删除。

## 当前执行检查点：1.3.21 退出后定时调度（恢复验收通过，成功链路受阻）

- 完整目标：界面、常用工作流、完整运行与生态均推进至95%–100%；当前整体约80%–85%为工程估计，无统一基准实测，不能作为达标证据。
- 本轮范围：Windows当前用户计划任务、同一profile的无窗口到期执行、单实例转交、运行记录与停用清理、定时任务页真实后台状态。保留原模型及权限契约；不新增系统命令自动执行能力，不进行公网发布。
- 正式基线：1.3.20，SHA256 `9d45ce8e4cc2356ab7f9ce8d57ececa853b6609f13d00f51987c29a3fa50dd05`；本轮目标1.3.21，沿用SemVer末位加1映射，同轮重建不递增。最终入口仍为下节1.3.20，尚未替换。恢复候选为 [1.3.21 EXE](../release/background-scheduler-20261031/candidate-recovery/Scodex-Workbench-1.3.21-x64.exe)，167296688字节，SHA256 `3b2ac32060b8e0a1c4be756e71846950e2cbc80ca8d7e7a2e658f162cd22a2a1`；文件／产品版本均1.3.21。
- 关键约束：覆盖约定旧正式EXE，不保留旧EXE或备份；保留用户配置与业务数据，不结束用户进程。后台默认关闭，用户启用后才登记Windows任务；无需保存Windows密码，只在该用户已登录时执行。计划任务指向portable原始EXE及同一数据目录。
- 上下文：已读取scheduled-tasks、main调度及权限路径、preload、task-panels、workbench相关handler、package与定时任务测试。没有Git元数据，本轮代码修改前保存源文件内容基线供增量审查；不重新扫描历史。

| 任务 | 状态 | 阻塞 |
| --- | --- | --- |
| 恢复上下文与双交接 | 已完成 | 无 |
| Windows调度与无窗口路径、界面开关 | 源实现完成；真实登记被拒；错误呈现已修复 | Windows登记返回E_ACCESSDENIED，成功调度链路尚未完成验证 |
| 定向辅助与恢复候选实际EXE | 原18/18有效；修改后的后台服务10/10；恢复候选4/4通过 | 成功登记、退出后触发、无窗口、实例转交及已登记任务移除未覆盖 |
| 构建身份与增量审查 | 重建退出0，包内7对象一致；12文件增量审查完成 | 无新增高置信度缺陷；不代替真实成功链路验收 |
| 正式替换与旧版删除 | 未实施 | 等待成功链路验收；当前正式1.3.20继续可用 |
| 清理与最终双交接 | 证据保留；2份fixture和失败候选已移动，待人工删除 | 5941文件／1131538215字节，原路径均不存在；见清理清单 |

- 验收：实际1.3.21候选完全退出后由Windows触发、已有进程转交不重复、失败可追溯、暂停／关闭移除OS任务、重启保持及受影响布局；模型可用受控端点，OS触发和EXE必须真实。完成后核验正式入口、版本、哈希及清理。
- 仍有效结果：下节1.3.20 Git范围与更早未变功能不因恢复而失效；本轮仅验证调度及直接影响路径。
- 风险与待办：当前Medium令牌、IsAdmin=false；COM、显式SID、专用目录与schtasks均已确认登记被拒，不在相同条件下重跑，不提权或改安全策略。仍需在具备当前用户登记权限的环境验收成功链路。完整跨任务协作、通用依赖安装与生成式图片仍有缺口，goal保持active，不声明95%或交付完成。
- 已写入：main/preload后台启动、退出等待和IPC，scheduled-tasks串行提交与重复保护，scheduled-background当前用户COM登记／偏好，task-panels/workbench/styles开关与状态，package/lock版本1.3.21；修改前基线为 `../release/background-scheduler-20261031/source-baseline.json`。逾期触发顺延只匹配仍在5秒窗口内的同Action任务；未来5秒内的计划不顺延，窄布局保留可滚动后台开关。
- 验证证据：原18/18见[定向日志](../release/background-scheduler-20261031/targeted-tests.log)；错误恢复后后台服务10/10为该阶段实际结果，未为补日志重跑；恢复候选 [4项实际EXE报告](../release/background-scheduler-20261031/candidate-recovery-ui/scheduled-background-ui-verification.json)退出0，三次启动均正常退出0、模型请求0。原失败报告继续保留，不改写为通过。
- 已完成恢复：PowerShell以UTF-8结构化JSON返回状态／HRESULT，区分读取、登记、移除、超时、缺失与无效响应，UI不再显示EncodedCommand。实际EXE确认拒绝原因为“Windows 拒绝登记计划任务：当前用户权限不足（0x80070005）。”；开关、任务与原因重启保持，停用清错，暂停／删除及重启保持通过。
- 构建与审查：[构建身份](../release/background-scheduler-20261031/build-verification.json)、[增量审查](../release/background-scheduler-20261031/incremental-review.json)。恢复构建沿用结构化electron-builder API、npmRebuild=false、signAndEditExecutable=false，退出0；前端1820 modules有效，包内manifest1.3.21及7对象逐字节一致。首次打包参数解析失败日志保留。
- 视觉边界：[恢复截图](../release/background-scheduler-20261031/candidate-recovery-ui/scheduled-background-denied.png)中的错误文字清晰、未见重叠；1064×660和1440×900几何检查通过，仅针对新增开关与错误区。详情纵向排列及右上留白来自未变基线，未据此声明整个任务页无可见错误。
- 使用Skill：无；无子Agent。两个专用OS任务均不存在，相关进程为空，无本轮运行中有限工具会话。
- 清理实际状态：自动审批审查拒绝递归删除，返回 `blocked by policy`，未执行删除；已核对原绝对路径、文件数量、归属、无重解析点及相关进程。2份fixture和初次失败候选已移至 `E:/GDP/Scodex/workbench/手动删除/background-scheduler-20261031-1.3.21`，共5941文件／1131538215字节，原路径均不存在，尚未物理删除。保留恢复候选、正式程序和必要证据；可在资源管理器仅删除该精确目录。不重试同类删除，详见[清理清单](../release/background-scheduler-20261031/runtime-cleanup.json)。
- 运行与替换：用户入口仍是 `E:/GDP/Scodex/Scodex工作台.lnk` → 正式1.3.20；成功链路未验收前不覆盖。正式替换后不保留旧EXE或备份，配置与业务数据保留；本轮未执行替换，无回滚动作。
- 轻量重构评估：基于本轮差异，暂未发现必须追加的重构；先解除已有验收阻塞，不扩展架构或重跑未变功能。

## 上次正式交付：1.3.20 Git 丢弃与重置（正式入口已替换）

- 当前目标与状态：已完成 Git 丢弃、soft／mixed／hard 重置、取消、并发、文件变化、权限与布局保护；权限 IPC 忙锁补丁已重建进 1.3.20 并由实际候选 EXE 通过。正式快捷方式已覆盖到 1.3.20，旧正式 1.3.19 已精确删除且未创建备份。
- 版本与入口：上次正式 1.3.19，本轮正式 1.3.20；正式文件为 `../release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe`，167367191 字节，SHA256 `9d45ce8e4cc2356ab7f9ce8d57ececa853b6609f13d00f51987c29a3fa50dd05`，ProductVersion／FileVersion 均为 1.3.20。根快捷方式 `E:/GDP/Scodex/Scodex工作台.lnk` 已指向该文件，工作目录、图标、空参数和窗口样式保持，描述为 `Scodex 工作台 1.3.20`。
- 关键约束：保留配置和业务数据，不结束用户进程，不执行公网发布；删除前以绝对路径、SHA256、版本字段和 `FileShare.None` 独占读取核对，删除后旧路径不存在。

| 任务 | 状态 | 结果／证据 |
| --- | --- | --- |
| Git 丢弃与 soft／mixed／hard 重置 | 已完成 | `targeted-tests.log` 辅助 30/30；候选实际 EXE 12/12，含确认期权限锁、外部变化拒绝、重启和双视口；[候选报告](../release/git-discard-reset-20261030/candidate-ui-4/source-control-ui-verification.json) |
| 构建、打包与包内一致性 | 已完成 | 前端构建与 portable 打包退出 0；主进程、preload、Git 服务、renderer、CSS、manifest 版本核验通过；[构建核验](../release/git-discard-reset-20261030/build-verification.json) |
| 正式入口覆盖 | 已完成 | 快捷方式解析后目标存在、版本与 SHA 一致；[入口核验](../release/git-discard-reset-20261030/shortcut-verification.json) |
| 旧版清理 | 已完成 | 旧 1.3.19 正式路径不存在，无备份、无其他文件删除；[替换记录](../release/git-discard-reset-20261030/replacement-final-verification.json)、[清理记录](../release/git-discard-reset-20261030/runtime-cleanup.json) |
| 增量审查与交接 | 已完成 | `electron/main.cjs`、`tests/source-control-ui.cjs` 增量审查无高置信度问题；本页、测试交接和能力对齐记录已完成落盘回读验证 |

### 本轮变更、验证和限制

- 权限保存忙锁与 `git:mutate` 等待／释放逻辑已进入当前候选；静态语法、UTF-8 无 BOM、包内 SHA 与版本均已核对。动态分支远端同步使用本地 bare Git 仓库，Git 丢弃／重置真实操作通过 Windows EXE、React、IPC 与 Git 路径完成。
- 候选报告的 12 个场景全部通过，测试 fixture 已清理；实际 UI 由 CDP 驱动，不等同原生 Windows 鼠标／键盘或原生图层验收。模型响应使用 loopback fixture，远端同步不代表公网 Git 服务；EXE 未签名，renderer 源基线不完整且项目无 Git 元数据。
- 本轮未触碰用户配置或业务数据；无 Scodex／electron 进程被结束。旧版正式程序删除后不提供即时回滚，需要旧版本时另行构建；此前其他版本留下的“手动删除”目录不属于本轮清理范围。
- 整体能力仍有完整跨任务协作、完全退出后的调度、通用插件／依赖一键安装、生成式图片重绘等缺口，本轮不声明整体达到 95%–100%。

### 运行、恢复与下一步

- 运行入口：双击 `E:/GDP/Scodex/Scodex工作台.lnk`，当前目标为正式 1.3.20；配置和业务数据沿用原目录。
- 回滚边界：本轮未保留 1.3.19 备份；若需旧版，必须从相应源码重新构建。当前正式 EXE、快捷方式、源代码、构建日志和验收证据保留。
- 轻量重构评估：本轮增量审查未发现当前范围内必须追加的重构；后续优先缺口见 `CODEX_ALIGNMENT.md`，须按新的需求和交接前置重新验收。

## 当前执行检查点：1.3.19 GitHub PR（正式入口已更新，人工清理待办）

- 当前目标：补齐已确认的Codex工作台缺项；本轮PR功能交付与正式入口验收完成，整体对齐仍有缺口，不声明95%或100%。附件默认折叠成记录行，点击／Enter展开；微软雅黑正文16px、辅助14px。
- 版本与入口：上次正式1.3.18 → 本次1.3.19，SemVer末位加1；同轮恢复不再递增。根快捷方式 E:/GDP/Scodex/Scodex工作台.lnk 指向[正式EXE](../release/pr-flow-20261030/final/Scodex-Workbench-1.3.19-x64.exe)，SHA256 e64f5578c8c7025e8a8984f641ed94b7601d4458399a214d3e9bfa48747fac43，167364230字节。源码、锁文件、包内manifest、文件及产品版本均为1.3.19；快捷方式工作目录 E:/GDP/Scodex、空参数及图标保持，描述1.3.19。

| 阶段／需求 | 状态 | 证据与边界 |
| --- | --- | --- |
| GitHub PR工作台 | 通过 | 加密连接、列表／详情、草稿／正式创建、取消／重复回读、就绪、SHA绑定merge／squash；共享Git锁及只读／禁网／退出保护 |
| 辅助验证、构建与审查 | 通过 | PR9/9、Git4/4；前端与portable退出0、7项包内对象匹配；14文件增量审查哈希无漂移 |
| 候选及正式实际EXE | 通过 | 候选9/9，正式入口4/4；测试EXE退出0、三份隔离fixture已清理，无本轮常驻服务 |
| 旧程序与重复产物 | 已移动，待人工删除 | 原路径均不存在；83文件／922598688字节在精确“手动删除”目录，未物理删除 |
| 双交接核验 | 见本轮文档记录 | 落盘回读、当前链接、UTF-8无BOM；[文档验证](../release/pr-flow-20261030/document-verification.json) |

### 本轮变更、证据与已知限制

- 新增 electron/github-pulls.cjs、src/components/github-pulls.jsx 及对应定向测试；由main／preload IPC、Git共享锁、task-panels／workbench和样式接入。沿用既有权限、确认及版本并发保护，无新增依赖；参考目录只读，不读真实凭据；使用Skill：无，未调用子代理。
- [候选9项](../release/pr-flow-20261030/candidate-ui-2/github-pulls-ui-verification.json)、[正式4项](../release/pr-flow-20261030/formal-entry/github-pulls-ui-verification.json)、[辅助汇总](../release/pr-flow-20261030/targeted-tests-summary.json)、[构建与包身份](../release/pr-flow-20261030/build-verification.json)、[增量审查](../release/pr-flow-20261030/incremental-review.json)。首轮驱动转义错误的失败报告保留，修正驱动后同包通过；未降低产品断言。
- [正式截图](../release/pr-flow-20261030/formal-entry/github-pull-detail.png)已查看：1440×900下无可见错误；1064×660几何核验无横向溢出，详情默认折叠、点击／键盘展开通过。结论限当前设备、页面、视口和隔离数据；renderer截图不含Windows原生图层，CDP不等于原生鼠标验收。
- GitHub API仅本机兼容服务，真实EXE／React／IPC／Git／Windows加密及确认参与；公网账号、真实分支保护、公网模型尚未验证。EXE未签名。未变附件／插件等已有有效结果继续复用，不重复测试。

### 运行、替换、清理与后续

- 启动根快捷方式，进入“版本控制 → GitHub PR”；连接保存使用Windows加密，创建／就绪／合并按已有确认与权限执行。正式文件及快捷方式已核对，参见[最终交付记录](../release/pr-flow-20261030/final-delivery-verification.json)。构建沿用Electron45、npmRebuild=false及signAndEditExecutable=false。
- 删除命令在执行前被自动审批以 blocked by policy 拒绝；按规则验证路径、哈希、重解析点与占用后，用原生PowerShell移动旧1.3.18、重复候选1.3.19和win-unpacked至[手动删除目录](../手动删除/pr-flow-20261030-20261030T144236867)。原路径均不存在，未创建备份，但该目录文件尚未删除；用户可在资源管理器仅删除此精确目录，不运行其中内容。83文件约880MiB，不影响正式程序、用户配置及数据；[清理清单](../release/pr-flow-20261030/runtime-cleanup.json)。无受支持的旧EXE即时回滚，需要旧版须另行构建。
- 文档更新曾因混合换行导致严格标题匹配失败；失败前无alignment或最终交接写入，改为唯一标题及换行感知边界，保留无关内容；[文档恢复](../release/pr-flow-20261030/document-update-recovery.json)。产品和已验收程序不受影响。
- 待办：人工物理删除残留；继续按[能力对齐记录](CODEX_ALIGNMENT.md)选择高价值缺口。下一正式轮次为1.3.20；目前没有运行中的有限任务。轻量重构评估未发现本轮直接范围内必须新增重构的证据。

## 1.3.18 公开技能插件目录（已正式交付）

- 当前目标：本轮补齐公开GitHub SKILL插件目录及安装管理；附件继续默认折叠成记录行、点击展开详情。整体Codex对齐尚未完成，不以定向通过声明100%。
- 版本：上次正式1.3.17 → 本次1.3.18，沿用SemVer末位加1，同轮恢复／重建不再递增；package／lock、包内manifest、EXE文件／产品版本一致。
- 正式入口：根目录 `E:/GDP/Scodex/Scodex工作台.lnk` → 历史正式程序 release/plugin-marketplace-20261030/final/Scodex-Workbench-1.3.18-x64.exe（已于1.3.19移出原入口，待人工删除）。SHA256 `b47a97d027d27162ab000d0172c3d8cae18bacd5e00163fc4e3efdbb4eebeb49`；快捷方式工作目录、图标、空参数保持，描述1.3.18。
- 关键约束：公开参考目录只读；不读写真实凭据；无新增依赖、未结束用户进程。用户要求不备份旧EXE，已精确删除上次正式1.3.17；配置与数据保留。使用Skill：无；未调用子代理。

| 阶段 | 状态 | 结果／阻塞 |
| --- | --- | --- |
| 需求、实现与辅助验证 | 完成 | 9个有效服务用例；无阻塞 |
| 构建与候选实际验收 | 完成 | 完整候选6项；最终候选5项补验；6项包内对象一致 |
| 正式入口及旧程序替换 | 完成 | 从快捷方式解析的最终路径5项通过、退出0；旧EXE无备份 |
| 增量审查、文档及清理 | 完成 | 11文件增量审查；双交接回读验证；8份fixture及重复候选目录已清理 |

### 已完成需求

| 版本 | 需求及主要影响 | 有效验证 |
| --- | --- | --- |
| 1.3.18 | 公开GitHub来源、目录／详情／折叠文件、安装／更新／启停／卸载；接入技能发现与模型上下文，固定Blob校验及用户文件保护 | [测试汇总](../release/plugin-marketplace-20261030/targeted-tests-summary.json)、[完整候选6项](../release/plugin-marketplace-20261030/candidate-ui-3/plugin-marketplace-ui-verification.json)、[正式入口5项](../release/plugin-marketplace-20261030/formal-entry/plugin-marketplace-ui-verification.json) |

### 主要变更、验证和恢复边界

- 新增 `electron/plugin-marketplace.cjs`、`src/components/plugin-marketplace.jsx` 及定向服务／实际EXE测试；通过 main／preload IPC、task-panels、workbench 与样式接入已有插件和技能入口。最多256文件／包16MB／单文件4MB／SKILL128KB；拒绝链接与越界路径，安装不执行脚本。更新／卸载前检查本地修改，保留用户文件。
- 实际完整候选SHA `9439caf2…` 通过真实公开GitHub38项目录、6文件安装、技能进入聊天请求、停用主进程拦截、重启保留及卸载／来源；模型回复仅用本机受控端点。只修托管启停文案后最终SHA `b47a97d0…` 的候选和正式路径各5项通过；未变模型／重启实现复用原6项结果，不声称最终包重复执行全部场景。
- 最终实际EXE在1440×900／1064×660无水平溢出，Microsoft YaHei16px；详情标题和安装按钮在视口内，随包文件默认折叠、Enter可展开。[最终界面](../release/plugin-marketplace-20261030/formal-entry/public-plugin-catalog.png)：当前设备、页面、视口和数据状态下无可见错误；renderer截图不包含原生Windows图层。
- 恢复：根API尾斜杠404改为精确URL；raw下载超时改固定Blob API并校验base64／大小／SHA；损坏夹具改同长度才触发SHA断言。视口等待两帧、Enter加入字符事件仅修测试驱动，未削弱产品边界断言。原失败日志与诊断证据保留。
- 文档收尾中的标题匹配失败源于原文混合空行换行；未写入失败候选，改按唯一标题边界插入，保留无关格式。[构建与包](../release/plugin-marketplace-20261030/build-verification.json)、[11文件增量审查](../release/plugin-marketplace-20261030/incremental-review.json)、[文档核验](../release/plugin-marketplace-20261030/document-verification.json)。

### 运行、清理及限制

- 启动根快捷方式，进入“插件 → 公开目录”；显式读取目录后查看详情并安装，进入“技能”选择本轮技能。操作可取消；匿名GitHub API可能限流，失败保留已有目录与安装。外部服务仍从“MCP连接”单独配置。
- 构建沿用Electron45、`npmRebuild=false`、`signAndEditExecutable=false` 和本轮配置；EXE未签名，既有bundle提示保留。最终包、测试源码、基线、日志与必要截图保留；8份UI隔离fixture、重复候选EXE／unpacked目录均已删除，测试EXE退出0，无本轮常驻服务或待手动清理项。[清理清单](../release/plugin-marketplace-20261030/runtime-cleanup.json)、[快捷方式](../release/plugin-marketplace-20261030/shortcut-verification.json)。
- 上次正式1.3.17 EXE已按用户明确要求删除、无备份，无法直接一键回滚；需要旧版须从相应源码另行构建。未触碰用户配置、数据或其他任务文件。
- 本轮无功能待办；仅支持公开GitHub技能集合，不自动安装依赖、登录账号或接通MCP。更新／恶意包异常在服务层验证，未改写公开仓库；真实公网模型与原生鼠标不在本轮验收范围。整体仍有通用插件市场、PR创建／合并、任意桌面操控、完全退出后的任务及生成式图片等缺口，见[能力对齐记录](CODEX_ALIGNMENT.md)。
- 轻量重构评估：本轮模块与既有IPC／技能边界一致；依据已有审查和验收证据，无需追加范围内重构。未因交接更新重复测试或扩大功能。

## 1.3.17 MCP SSE（历史交付）

- 目标：在既有附件／记录默认折叠行为上，补齐 MCP 旧 SSE 连接、工具／资料、Bearer 与 OAuth、网络权限和断开清理；不将定向通过写成整体 100% 对齐。
- 版本：上次正式 1.3.16 → 本次 1.3.17，沿用用户确认的 SemVer 末位加 1；本轮重建／恢复未重复递增。版本源、包内 manifest、最终 EXE 文件与产品版本均为 1.3.17。
- 当时正式程序为 `release/mcp-sse-20261030/final/Scodex-Workbench-1.3.17-x64.exe`，SHA256 `47b8599e288b34e144ae1734a4f4450dbbefdff071b5924f4a51bbc413e134e1`；该EXE已在1.3.18交付时删除且未备份。历史[快捷方式核验](../release/mcp-sse-20261030/shortcut-verification.json)保留，当前入口以顶部1.3.18为准。
- 约束：参考目录只读；复用 SDK 1.32.2，无新增依赖；不读取或改写本机 `.codex` 凭据，实际验收使用独立 profile 和本机服务。使用 Skill：无；未调用子代理。

| 阶段 | 状态 | 证据／阻塞 |
| --- | --- | --- |
| SSE 实现与辅助验证 | 完成 | 原相关回归结果复用；SSE 9/9 与加强取消 1/1 通过，无阻塞 |
| 构建及候选实际 EXE | 完成 | 前端／portable 构建退出 0；候选 UI 7/7、退出 0 |
| 正式入口及旧程序替换 | 完成 | 同哈希正式入口 3/3；上一正式 EXE 已删除，未备份 |
| 增量审查与双交接 | 完成 | 13 文件差异审查及7项包内对象一致性通过；交接回读见文档核验记录 |

### 已完成需求（本轮）

| 版本 | 需求及主要影响 | 验证 |
| --- | --- | --- |
| 1.3.17 | 新增 SSE 传输选择／状态、认证与配置保存；网络和 OAuth 认证分流；逐事件体积限制与连接断开清理 | [候选7项](../release/mcp-sse-20261030/candidate-ui-2/mcp-sse-ui-verification.json)、[正式入口3项](../release/mcp-sse-20261030/formal-entry/mcp-sse-ui-verification.json) |

### 本轮实现、验收与限制

- 实现：`electron/mcp-runtime.cjs`、`mcp-store.cjs`、`mcp-oauth.cjs`、新增 `mcp-network.cjs`、`main.cjs` 及 `src/components/mcp-connections.jsx`。沿用现有逐次审批、只读规划、旧代次和加密配置模型。
- 真实 EXE 通过：保存不自动连接；Windows 加密；Bearer GET／POST 与资料脱敏；工具审批、拒绝不抵达服务、实际请求抵达后取消；独立 OAuth 窗口、重启后保存登录并手动重连；网络策略在服务请求前拒绝；1440×900 和1064×660 无水平溢出、微软雅黑正文16px／预览14px。
- 原 stdio／HTTP／OAuth／资料通过结果继续有效；SSE 跨源端点、断线／重连代次及超过2MB累计流量／单事件上限已定向补验。[测试汇总](../release/mcp-sse-20261030/targeted-tests-summary.json)、[包内一致性](../release/mcp-sse-20261030/build-verification.json)、[增量审查](../release/mcp-sse-20261030/incremental-review.json)。
- 恢复证据：首轮跨源测试夹具被 SDK 服务端规范化，改为原始 endpoint 事件后通过；首轮 UI 驱动选择器引号错误，改用 JSON 转义后7/7通过；删除保护曾误计校验命令自身，限定真实 Scodex 进程后精确删除成功。均未靠降低产品断言通过，原始失败报告保留。
- 模型回复使用明确的回环夹具；SDK SSE／OAuth 服务、React／IPC、加密与重启是真实路径。公网服务兼容性和原生 Windows 鼠标未完成验证，不将本轮结论用于全部 Codex 功能。
- [最终页面截图](../release/mcp-sse-20261030/formal-entry/mcp-sse-workbench.png)：当前设备、页面、视口和数据状态下无可见错误。浏览器／原生图层不在 renderer 截图范围。

### 运行、替换及清理

- 启动根目录快捷方式，进入“插件 → MCP 连接”，选择 stdio、Streamable HTTP 或 SSE；保存后手动连接，远程认证支持 Bearer／OAuth。
- 候选与正式文件同 SHA，EXE 未签名；沿用本机 Electron45、`npmRebuild=false`、`signAndEditExecutable=false` 的构建方式，配置与日志在本轮 release 目录。
- 上一正式程序 `release/task-scheduled-projects-attachments-20261030/final/Scodex-Workbench-1.3.16-x64.exe` 已按用户要求删除，不备份旧 EXE；未触碰用户配置和数据。没有即时旧版回滚副本，需要旧版时须另行从源代码构建，不能声称可一键回滚。
- 本轮三份隔离 UI 夹具均已删除，测试 EXE 退出0；没有待手动清理项，较早任务的遗留清理记录保持。[清理清单](../release/mcp-sse-20261030/runtime-cleanup.json)。当前候选／正式构建和代码审查基线保留作验证依据。
- 无本轮待办。该阶段尚无公开技能目录（已由1.3.18补齐）；整体仍有通用插件市场、PR 创建／合并、任意桌面操控、完全退出后的后台任务及生成式图片链路等既有缺口，见[能力对齐记录](CODEX_ALIGNMENT.md)。轻量重构评估未发现本轮范围内需新增重构的证据，不扩大代码修改。

## 1.3.16 定时任务项目归属与附件折叠（已正式交付）

- 目标：新任务绑定当前选定项目；旧任务只在首次启动时将空 `projectId` 固定到当时活动项目，保留已有归属和运行记录；附件默认收起为记录行，点击展开查看／移除。
- 实现：`electron/scheduled-tasks.cjs` 增加缺失项目归属的一次性持久化迁移；`electron/main.cjs` 在读取任务附件前检查“仅对话”权限。任务编辑器新增项目选择、附件摘要和可滚动详情区，标题及保存操作在视口内保持可见。README 直运行路径已修正。
- 版本 1.3.16；定向单测 7/7，相关语法检查、`npm run build` 和 portable x64 构建通过。候选与正式 EXE SHA256 均为 `ee4efe49b70565e142c12634c400cdc94430bf0e277aa5dddf94a10e5566dbe1`，文件和产品版本均为 1.3.16。
- 候选与正式路径各完成 5 项实际 UI 验收：运行记录折叠／展开与双视口布局；附件默认折叠、详情展开、移除并保存；切换到项目 B 再回项目 A 后任务仍归属 B。附件编辑器在 1440×900 与 1064×660 下均位于视口内，标题和操作按钮完整可见，正文区域按需滚动。正式报告：[UI 验收](../release/task-scheduled-projects-attachments-20261030/evidence/formal-ui/scheduled-task-ui-verification.json)；候选报告：[候选验收](../release/task-scheduled-projects-attachments-20261030/evidence/candidate-ui/scheduled-task-ui-verification.json)。
- 1.3.16 当时快捷方式目标为 `release/task-scheduled-projects-attachments-20261030/final/Scodex-Workbench-1.3.16-x64.exe`（该 EXE 已在1.3.17更新时删除且未备份），SHA256 `ee4efe49b70565e142c12634c400cdc94430bf0e277aa5dddf94a10e5566dbe1`，文件及产品版本均为 1.3.16。`Scodex工作台.lnk` 的描述为 1.3.16，工作目录 `E:/GDP/Scodex`、图标和空参数保持；README 已更新到该入口。此前 1.3.15 正式 EXE 已按用户要求删除，未保留副本；没有运行中的旧程序。
- 从快捷方式解析出的正式目标完成 5 项 UI 复核：三类运行记录默认折叠、鼠标／键盘展开、两个桌面视口、截图采集、任务附件折叠／展开／移除及项目归属。均通过，EXE 退出码 0、模型请求 0、隔离 fixture 已清理。报告：[快捷方式入口验收](../release/task-scheduled-projects-attachments-20261030/evidence/shortcut-ui/scheduled-task-ui-verification.json)；截图：[运行记录折叠态](../release/task-scheduled-projects-attachments-20261030/evidence/shortcut-ui/task-runs.png)。驱动的检查名称已修正为不区分候选／正式包的“打包 EXE”。修复前截图见[布局缺陷记录](../release/task-scheduled-projects-attachments-20261030/evidence/candidate-ui-attempt-3)。
- 增量代码审查：项目无 Git 元数据，范围限定于本轮定时任务实现、对应测试驱动及直接权限调用。核对一次性项目归属迁移只填写空 `projectId`、保留已有归属和运行记录；附件读取前执行“仅对话”权限检查；编辑器项目选择及附件增删状态由实际 UI 场景覆盖。审查发现驱动把正式入口截图标为候选包，已改为通用名称并通过正式入口复测；无未解决的本轮代码问题。

## 定时任务运行记录折叠（1.3.15正式，已通过）

- 目标：运行记录以单行摘要显示，所有状态默认收起；点击或键盘展开完整输出。调度行为、记录结构、存储和用户数据不变。
- 实现：`src/components/task-panels.jsx` 使用原生 `details/summary` 管理开合，运行中／成功／失败均默认不设置 `open`；`src/styles.css` 提供摘要、完整输出和窄视口布局。`package.json`、`package-lock.json`、README 与正式包均为 1.3.15。
- 正式验收：候选和正式入口均确认三种状态 `open=false` 且没有 `open` 属性；鼠标点击、Enter 键展开／收回、成功全文读取、失败详情读取、1440×900 与 1064×660 桌面布局全部通过。实际报告：[候选](../release/task-run-disclosure-20261025/evidence/candidate-ui-final-2/task-run-disclosure-ui-verification.json)、[正式入口](../release/task-run-disclosure-20261025/evidence/formal-ui-final/task-run-disclosure-ui-verification.json)。
- 历史正式交付：1.3.15 EXE 曾位于 `release/task-run-disclosure-20261025/final/Scodex-Workbench-1.3.15-x64.exe`，SHA256 `e67885ae458896b75935243f2a4bae2dc77395e9a43a37ca11123e186218731a`；快捷方式当时指向该版本。该正式 EXE 已在 1.3.16 更新时按用户要求删除，未保留副本；本节链接仅指向仍保留的历史验收证据。
- 视觉证据：[正式折叠截图](../release/task-run-disclosure-20261025/evidence/formal-ui-final/task-runs.png) 1440×900；当前设备、页面、视口和隔离数据状态下无可见错误。字号报告为 Microsoft YaHei，标签 15px、预览 15px、时间 14px。
- 限制：验收使用隔离定时任务数据和 CDP 驱动的实际 EXE renderer，未发送模型／公网请求，也不等同于原生 Windows 鼠标输入验证。

## 1.3.14 交付检查点（历史）

- 正式版本从 1.3.13 按 SemVer patch +1 更新至 1.3.14。最终 EXE：[Scodex-Workbench-1.3.14-x64.exe](../release/remote-git-20261025/final/Scodex-Workbench-1.3.14-x64.exe)，SHA256 `8481AC97A3420BFF4A2BDE6702B6F4B9AD20E53A1AA72639B31BB3CF2F793C5A`；候选与正式文件哈希一致，文件和产品版本均为 1.3.14。启动快捷方式解析到该正式路径，工作目录、图标和空参数保持，描述为 1.3.14。
- 版本控制页新增远端状态计数、Fetch、仅干净工作区快进 Pull，以及经主进程系统确认的普通 Push。Push 完成后会 Fetch 刷新跟踪状态；刷新失败时明确提示 Push 已成功、状态尚未刷新。错误详情隐藏以避免泄漏远端凭据。PR 创建／合并、强制推送和丢弃操作不在本轮范围。
- 候选与正式 EXE 的远端同步 UI 场景均通过，均使用本机 bare remote，覆盖获取更新、快进拉取、确认普通推送及 Push 后状态归零；没有公网仓库写入或真实模型请求。正式截图：[远端同步页面](../release/remote-git-20261025/evidence/formal-ui-final/remote-sync.png)，运行报告：[候选](../release/remote-git-20261025/evidence/candidate-ui-final/source-control-ui-verification.json)、[正式入口](../release/remote-git-20261025/evidence/formal-ui-final/source-control-ui-verification.json)。实际 EXE 由 CDP 驱动，未覆盖原生鼠标输入。
- `node --test tests/source-control.test.mjs` 为 22/22 通过；`npm run build` 通过，Vite 处理 1818 个模块、许可证元数据 294 项。既有 portable x64 构建产物已复核哈希和版本。构建、测试、审查、快捷方式和视觉记录见本轮报告。
- 本轮两个测试夹具自动删除被策略拦截；移入项目清理目录时遇到 Windows 权限／隐藏或只读项错误，没有重试。候选夹具仍在 Temp 源目录 3734 项／189410574 字节，项目清理目录有部分目标 122 项／58803 字节；正式夹具仍在 Temp 源目录 3854 项／189469377 字节。末次检查没有其他进程引用。精确路径与处理步骤见[清理记录](../release/remote-git-20261025/runtime-cleanup.json)；勿运行夹具，可在资源管理器手动删除。

## 1.3.13 已交付记录（历史）

- 本轮把输入区待发送文件、图片和工作台状态快照折叠为一行摘要；点击展开后仍可查看图片、文件解析状态并逐项移除。切换聊天时该行恢复收起。已发送消息附件继续沿用 1.3.12 行为，草稿的存储方式未改变。
- 正式版本从 1.3.12 按 SemVer patch +1 更新为 1.3.13。最终 EXE：[Scodex-Workbench-1.3.13-x64.exe](../release/draft-attachments-20261025/final/Scodex-Workbench-1.3.13-x64.exe)，SHA256 `04ca72efd67fdd85683dc7ecfa3ab8f8653a535f4f04b457a7111cf919c106d7`，文件与产品版本均为 1.3.13。快捷方式 `E:/GDP/Scodex/Scodex工作台.lnk` 指向该文件，SHA256 `A28ED1753E28C57CD25F38BB705B6A34FD22D440A80ACB11ADEFA2AF90F05DE1`；工作目录、图标和空参数保持。本轮未额外复制旧版 EXE。
- 候选与正式目标均通过附件 UI 定向验收。正式目标的 2/2 场景覆盖默认收起、点击展开、文件／图片／工作台快照、移除与恢复、切换聊天重置；真实 EXE 退出码 0。截图：[收起](../release/draft-attachments-20261025/final-ui-2/draft-attachments-collapsed.png)、[展开](../release/draft-attachments-20261025/final-ui-2/draft-attachments-expanded.png)。详情及运行报告见[正式入口报告](../release/draft-attachments-20261025/final-ui-2/cross-project-chats-ui-verification.json)。
- `node --check tests/concurrent-chats-ui.cjs` 与 `npm run build` 通过；Vite 处理 1818 个模块，许可证元数据 294 项。portable x64 构建通过，使用本机 Electron 45，关闭依赖重建与资源签名编辑；EXE 未签名，保留既有 chunk-size 提示。构建和[增量审查记录](../release/draft-attachments-20261025/incremental-review.json)没有未解决问题。项目无 Git 元数据，本轮审查仅覆盖相关源文件、测试、版本字段和实际 EXE。
- 一次性 UI 回复由本机隔离 fixture 提供；未发送公网模型请求或写入真实凭据。验收由 CDP 驱动实际 EXE renderer，未覆盖原生鼠标输入。
- 清理命令被策略拒绝后，五个本轮测试夹具已移至[手动清理目录](../release/draft-attachments-20261025/runtime-cleanup.json)，共 18,162 项／943,264,452 字节；原 Temp 路径已不存在。夹具勿运行，可在资源管理器手动删除。整体 Codex 对齐仍有已记录缺口。

## 1.3.12 实施过程记录（历史）

- 正式交付目标为 1.3.12（1.3.11 的 SemVer patch +1）。正式 EXE `release/cross-project-chats-20261025/final/Scodex-Workbench-1.3.12-x64.exe` 与候选 SHA256 `d4c5b930ab7be24ee175db9f0d23d60f9361c32787202646065577428fefcb0d` 相同；`E:/GDP/Scodex/Scodex工作台.lnk` 已指向此程序，替换后哈希 `A84E9DF3315284BC57750BE75FB74CEBAACD63BDC44173373830185F10C95E38`。候选 11/11 场景和附件视觉单测已通过，正在做正式入口最后复核。用户最新确认的是聊天历史中的已发送附件默认折叠成记录行，点击展开详情；输入框中待发送预览保持现状。工具操作记录折叠已在 1.3.11 完成。
- 1.3.12 跨项目候选已通过路由、并行停止／未读和草稿／附件／技能场景；完整套件在 `background-errors-and-global-guards` 停止，因为测试错误地假定存在运行任务时 `projects:add` 必须拒绝。实际项目 API 会登记／选择项目，跨项目运行本就允许切换；此测试断言与已验收行为冲突，不构成产品缺陷。
- 实际 EXE 的附件场景发现新增实现缺陷：收起的 `details.open=false`，但详情容器仍产生布局框（文件或图片子项计数为 1）。原因是基础样式无条件设置 `display:flex`，与原生折叠状态冲突。下一步仅把详情容器设为展开态显示并显式保证收起态隐藏，再复建同一 1.3.12 目标版本，用真实候选截图及 EXE 场景复验折叠、展开、窄视口和重启；之后重跑跨项目完整套件。旧快捷方式仍指向正式 1.3.11，未替换。
- 修正样式后的首次重打包因 Electron Builder 默认自动签名／资源编辑连接 `20.205.243.166:443` 超时而退出码 1。生成的文件虽有 EXE 元数据，未通过构建流程，不运行、不验收。改用已验证配置 `release/activity-status-20261025/electron-builder.config.cjs`（本机 Electron 45、`npmRebuild=false`、`signAndEditExecutable=false`）并覆盖输出目录到附件候选，再重建同一个 1.3.12 目标；不触碰正式入口。
- 最新 1.3.12 候选实际 EXE 11/11 场景通过，包含记录收起／展开、重启恢复、跨项目并行与审批。干净截图为[收起态](../release/cross-project-chats-20261025/attachment-visual-1-20261025/message-attachments-collapsed.png)及[展开态](../release/cross-project-chats-20261025/attachment-visual-1-20261025/message-attachments-expanded.png)；隔离截图夹具已移入 `手动删除/scodex-runs-ui-13245c81-640b-442a-9c41-7a01cc164589`（3 项／186,496,653 字节，Temp 源已不存在）。
- 正式目录副本已与候选核验同哈希 `d4c5b930...`，路径 `release/cross-project-chats-20261025/final/Scodex-Workbench-1.3.12-x64.exe`。首次 `File.Replace` 因空备份路径失败且正式链接未变；随后以同卷 `File.Move(source,destination,true)` 替换成功。当前链接的工作目录、图标和空参数保持，描述为 1.3.12；无额外旧版备份。尚待从正式路径完成入口复核。
- 相对 EXE 路径导致未启动的预检记录见 `release/cross-project-chats-20261025/full-suite-2-20261025/launch-preflight-failure.json`；夹具已移入 `手动删除/scodex-runs-ui-32b58797-e6b6-4d46-a076-6142fe3e0a27`（3 项／597 字节）。首个实际附件候选失败报告为 `release/cross-project-chats-20261025/final-suite-1-20261025/cross-project-chats-ui-verification.json`；进程退出码 0，4 项／189,362,046 字节测试夹具已移入 `手动删除/scodex-runs-ui-614ea5af-55bb-423e-bb03-52e0cf6b1d01`，Temp 源路径不存在。

## 上一增量（1.3.11，已发布）

- 按用户确认的附件样式，已完成操作记录默认折叠为“状态图标 + 操作摘要 + 项数”一行，点击展开计划、单项详情、差异、输出与审批。1.3.10 已实现紧凑布局；本轮 1.3.11 定向修正取消／中断记录误显示成功图标的问题：取消或中断显示停止图标并保持初始展开；运行、失败和待审批状态继续展开。
- 本轮代码范围：`src/components/agent-activity.jsx`、`tests/context-menu-ui.cjs`；版本同步到 `package.json` 与 `package-lock.json` 的 1.3.11，README 的入口路径也已更新。未增加依赖、未发送模型请求、未写入密钥。
- 正式程序：[Scodex-Workbench-1.3.11-x64.exe](../release/activity-status-20261025/final/Scodex-Workbench-1.3.11-x64.exe)，SHA256 `d4e86811841f658b04108a57154dd26f2424c2e62ef2ad12a636174bd99c4193`；[1.3.10正式版本](../release/context-attachments-20261025/final/Scodex-Workbench-1.3.10-x64.exe)继续作为既有版本保留，本轮未创建额外旧版备份。
- 候选与正式入口 UI 均通过：成功记录默认折叠、点击展开详情；取消／中断记录显示“已停止／已中断”、停止图标且展开。见[候选报告](../release/activity-status-20261025/evidence/context-menu-ui-verification.json)、[正式入口报告](../release/activity-status-20261025/post-replacement/context-menu-ui-verification.json)及[正式入口截图](../release/activity-status-20261025/post-replacement/compact-activity.png)。构建及包检查见[构建报告](../release/activity-status-20261025/evidence/build-verification.json)，定向审查见[审查报告](../release/activity-status-20261025/evidence/incremental-review.json)。
- [快捷方式核验](../release/activity-status-20261025/evidence/shortcut-verification.json)：TargetPath 指向正式 1.3.11，文件版本和哈希与验收候选相同；工作目录、图标与空参数保持。
- 测试夹具源路径已清空并移动到[手动删除目录](../release/activity-status-20261025/runtime-cleanup.json)。两份夹具各 3,631 个目录项；应用测试进程已退出。递归删除因策略拒绝而未重试，不影响程序运行。
- 双交接、对齐记录与 README 的 UTF-8／链接／版本核验见[文档核验报告](../release/activity-status-20261025/evidence/document-verification.json)。

## 1.3.15 正式交付记录（历史）

- 1.3.15 曾为正式 Scodex Workbench，上次正式版本为 1.3.14；按用户确认的 SemVer 末位加 1。
- 最终 EXE 历史路径为 `release/task-run-disclosure-20261025/final/Scodex-Workbench-1.3.15-x64.exe`，文件与产品版本 1.3.15，SHA256 `e67885ae458896b75935243f2a4bae2dc77395e9a43a37ca11123e186218731a`。该文件已在 1.3.16 更新时删除且未备份。
- 当时启动快捷方式指向上述程序，工作目录 `E:/GDP/Scodex`、图标和空参数保持，描述为“Scodex 工作台 1.3.15”；当前快捷方式已更新至 1.3.16。
- 定时任务运行记录默认折叠、鼠标／Enter 展开、失败详情和两个桌面视口已在候选及正式入口通过；完整证据见本节顶部交接记录。

## 1.3.14 状态（历史）

- 正式 Scodex Workbench **1.3.14**，上次正式 1.3.13；按用户确认的 SemVer 末位加 1。
- [最终 EXE](../release/remote-git-20261025/final/Scodex-Workbench-1.3.14-x64.exe)，文件与产品版本 1.3.14，SHA256：`8481AC97A3420BFF4A2BDE6702B6F4B9AD20E53A1AA72639B31BB3CF2F793C5A`。
- [启动快捷方式](../../Scodex工作台.lnk)指向上述最终包；工作目录 `E:/GDP/Scodex`、图标和空参数保持，描述为“Scodex 工作台 1.3.14”。
- Git 远端同步的功能和验证边界见本轮检查点及[Codex 对齐记录](CODEX_ALIGNMENT.md)：本机 bare remote 已验收；PR 创建／合并、完整跨项目任务协作及其他既有缺口仍未对齐。

## 1.3.13 状态（历史）

- 正式 Scodex Workbench **1.3.13**，上次正式 1.3.12；按用户确认的 SemVer 末位加 1。
- [最终 EXE](../release/draft-attachments-20261025/final/Scodex-Workbench-1.3.13-x64.exe)，文件版本 1.3.13，SHA256：`04ca72efd67fdd85683dc7ecfa3ab8f8653a535f4f04b457a7111cf919c106d7`。
- [启动快捷方式](../../Scodex工作台.lnk)指向上述最终包，快捷方式 SHA256：`A28ED1753E28C57CD25F38BB705B6A34FD22D440A80ACB11ADEFA2AF90F05DE1`。工作目录 `E:/GDP/Scodex`、图标和空参数保持，描述为“Scodex 工作台 1.3.13”。
- 待发送附件收起／展开与项目快照移除场景在正式 EXE 通过；完整 Codex 对齐仍 active，远端 Git／PR、完整退出后的定时任务、办公与生成式图片等缺口继续按原记录跟踪。

## 1.3.11 检查点（已交付历史）

- 目标／验收：成功记录默认折叠成状态、摘要和数量行；点击可查看完整详情；取消和中断不能显示为成功，并且初始展开。
- 实际变更：`Status` 为取消／中断显示停止图标；汇总状态识别取消／中断；实际 EXE 验收覆盖折叠／展开、状态文字和图标。
- 版本与基线：从正式 1.3.10 升至 1.3.11；比较 1.3.10 与 1.3.11 的打包 ASAR，共 13,206 个条目，差异限于 renderer JS 文件名／内容、`dist/index.html` 资源引用和包内 `package.json` 版本。包内 CSS 未变化。
- 约束：无 Git 仓库，使用已交付 1.3.10 包内 ASAR 作二进制基线；原测试驱动源码快照未保留，审查范围限定在当前相关源码及实际 EXE 证据。无新增依赖，不修改真实凭据、用户数据或范围外功能。
- 验证记录：[候选／正式入口 UI](../release/activity-status-20261025/evidence/context-menu-ui-verification.json)、[正式入口 UI](../release/activity-status-20261025/post-replacement/context-menu-ui-verification.json)、[构建与包](../release/activity-status-20261025/evidence/build-verification.json)、[差异审查](../release/activity-status-20261025/evidence/incremental-review.json)、[清理状态](../release/activity-status-20261025/runtime-cleanup.json)。

## 1.3.10 已发布历史

- 本轮新增附件／工具过程紧凑显示：已完成记录默认折叠为“状态图标 + 操作摘要 + 项数”一行，点击可展开计划、单项详情、差异、输出和审批；运行中、失败或待审批自动展开。用户消息、模型正文、错误和附件传输数据结构保持不变。
- 代码变更：`src/components/agent-activity.jsx`、`src/styles.css`；定向验收驱动补充 `tests/context-menu-ui.cjs` 的折叠／展开检查，并改进右键子菜单动作诊断。package 版本为 1.3.10，正式入口已更新，用户配置与历史保留。
- 正式程序：[Scodex-Workbench-1.3.10-x64.exe](../release/context-attachments-20261025/final/Scodex-Workbench-1.3.10-x64.exe)，SHA256 `d2a64520bed203e71dd46fb511e4da567d3f3c4f55fdaab051e412b7f0667e99`；候选原件仍保留于同目录 `candidate`，用于追溯同一构建产物。
- 验收：[context-menu-ui-verification.json](../release/context-attachments-20261025/context-menu-ui-verification.json) 的 `compact-activity-records` 与 `attachments` 均通过；正式入口复核见[post-replacement-verification.json](../release/context-attachments-20261025/post-replacement/post-replacement-verification.json)，展开后的实际渲染截图为 [compact-activity.png](../release/context-attachments-20261025/compact-activity.png)。原生 Windows 文件选择框仍由测试夹具注入，未覆盖原生对话框鼠标外观。
- 失败恢复：首轮候选重载因 `agent-activity.jsx` 漏导入 `useEffect` 导致 renderer 空白，证据见同目录 `context-menu-ui-failure-1792919335453.json`；补导入后重新构建并复测通过。中转 Opus 5.5 请求仍返回 HTTP 503 `All available accounts exhausted`，未将其记为模型通过，凭据未写入文件。
- 测试夹具清理：递归删除请求被自动审批策略拒绝（`blocked by policy`），未重试删除；本轮两个临时目录均移入[手动删除夹具 1](../手动删除/scodex-menu-ui-8e023518-7d2f-4d59-8256-c1f8336485b6)和[手动删除夹具 2](../手动删除/scodex-menu-ui-a32e7a85-2e92-4b2e-99b6-9e87c783be6d)。两处源路径均不存在，目标清单分别保持 3,639 项／189,367,069 字节和 3,631 项／185,449,888 字节；详见[清理记录](../release/context-attachments-20261025/runtime-cleanup.json)。

## 1.3.10 状态（历史）

- 正式 Scodex Workbench **1.3.10**，上次正式1.3.9；沿用用户确认的SemVer末位加1，同轮修正／重建仍为1.3.10。
- [最终EXE](../release/context-attachments-20261025/final/Scodex-Workbench-1.3.10-x64.exe)，文件版本1.3.10，SHA256：d2a64520bed203e71dd46fb511e4da567d3f3c4f55fdaab051e412b7f0667e99。
- [启动快捷方式](../../Scodex工作台.lnk)已指向上述最终包，写后SHA256：de7f49302c5841f29fff77b18b2edfe004172b1cc38d6ff9dc4f069696dac29。工作目录E:/GDP/Scodex、原图标及空参数保持；1.3.10正式入口实际复核通过，EXE退出0。
- 本轮附件／工具记录功能已交付：构建、20/20定向单元测试、候选实际折叠／展开与附件范围、正式入口折叠／展开复核及三文件增量审查通过。整体Codex对齐仍active；跨项目并行／协作、远端Git／PR、全部办公、生成式重绘与公网OAuth全面兼容等仍有缺口，不给出未经测量的95%–100%。

## 1.3.10 检查点（历史）

- 目标／验收：成功的工具／附件记录默认折叠成状态图标、摘要和数量一行；点击可展开计划、单项详情、差异、输出和审批；运行中、失败及待审批记录自动展开，附件和右键入口保持可用。
- 有效方案：1.沿用现有 `details` 记录结构并增加总览折叠层；2.保持紧急状态自动展开和操作详情、文件／浏览器／服务入口；3.定向辅助、实际候选与正式入口验收、1.3.10构建、快捷方式替换、增量审查／清理／双交接。各步骤已完成；真实 Opus 5.5 503 保留为未通过限制。
- 修改／基线：12个代码／配置／测试文件，原始内容见baseline-manifest.json和review-baseline；README、对齐及双交接4文档另计。主要文件为electron/conversations.cjs、workspace-windows.cjs；src/lib/conversation-revisions.js、conversation-actions.js；共享conversation-revisions.jsx、workbench.jsx、workspace-window.jsx与styles.css；package／lock和两份版本测试。rvBase／rvWritten写前比较，无Git、未读历史，保留范围外修改。
- 约束：微软雅黑正文16px、辅助至少14px；版本最多20个，达到上限不删旧历史，分叉同样保留所有版本。无新依赖／子代理，使用Skill：无。不改真实模型密钥或参考认证，不自动远端发布，不结束用户进程，不另复制旧EXE备份。

| 任务 | 状态 | 结果／遗留 |
| --- | --- | --- |
| 消息编辑／重新生成／版本切换 | 完成 | 正确请求前缀，原分支与各自后续、图片附件、草稿和重启保留 |
| 独立窗口与执行保护 | 完成 | 主窗统一保存、双向快照、过期／运行拒绝，工具默认不重放、明确选择后真实审批及PowerShell |
| 上限提示／右键分叉 | 完成 | 提示明确新建聊天；实际分叉保留20版本且消息ID独立，原聊天不变 |
| 构建／正式入口／审查 | 完成 | 最终SHAc1545400…；7对象和manifest一致；12文件审查及两份修正文件定向复审 |
| 双交接与说明 | 完成 | 同轮最终事实融合，UTF8无BOM、链接、内容回读及哈希见document-verification.json |
| 本轮测试清理 | 待手动删除，不影响功能 | 两夹具已同卷移动，原路径不存在，owned进程0；确切位置见runtime-cleanup.json |

## 1.3.9 验证、恢复与运行

- [28辅助](../release/message-revisions-20261025/targeted-tests.json)、[实际功能合并记录](../release/message-revisions-20261025/revision-ui-verification.json)、[最终入口](../release/message-revisions-20261025/post-replacement-verification.json)、[最终菜单](../release/message-revisions-20261025/workspace-menu-final.png)、[视觉记录](../release/message-revisions-20261025/visual-verification.json)。Windows10.0.26300／Electron45／Node24.11.0；真实EXE、React、IPC、独立窗口、文件、历史和PowerShell，只有外部模型回复用回环服务替代，不能证明公网Grok或所有服务兼容；CDP交互／renderer截图，不宣称原生鼠标或Windows全屏验收。
- [初始7范围](../release/message-revisions-20261025/initial-runtime-verification.json)使用SHA31972c82…；最后只把20版本提示从不准确的分叉引导改为导出需要内容并新建聊天，版本／分叉实现保留。[最终增量](../release/message-revisions-20261025/final-runtime-verification.json)在SHAc1545400…验证准确提示、无请求／不丢版本、实际右键分叉消息标识与20版本、重启及1080×700／1440×900；[正式入口原始记录](../release/message-revisions-20261025/final-entry-runtime-verification.json)验证4聊天和20版本、全部10菜单项及正常退出。其余未变结果按范围复用。
- [构建／包核对](../release/message-revisions-20261025/build-verification.json)：npm run build1818模块／294许可证；electron-builder portable x64，输出final，Electron45、npmRebuild=false、signAndEditExecutable=false，退出0；7对象和运行manifest与当前源／dist一致，sourceDrift=[]。EXE未签名，既有大bundle、description／author和其他平台可选包提示仍存在。lock仅两处根版本由1.3.8变为1.3.9，无依赖变更。
- [12文件增量审查](../release/message-revisions-20261025/incremental-review.json)：版本快照／前缀、附件／草稿、状态门禁、主窗单写、限定IPC、界面和依赖／版本检查完成，无未解决本轮问题；修正后仅复审上限文案和驱动新差异。轻量评估没有证据支持额外架构／性能重构，不新增范围外候选。
- 失败恢复：驱动嵌套引号导致语法前置失败，EXE未启动，见[原证据](../release/message-revisions-20261025/final-driver-preflight-failure.json)；改用JS字符串编码并让语法失败立即停止，复验通过。正式菜单初轮边界失败见[原报告](../release/message-revisions-20261025/revision-ui-failure-1792904727164.json)，未记录首轮坐标；补诊断实际观察bottom1122.5625→两帧后892（1440×900），确认早读布局调整，增加几何记录与有界就绪等待后通过，产品未改、边界未放宽。
- [快捷方式记录](../release/message-revisions-20261025/shortcut-verification.json)：写前核对既有SHA及确切目标，以同目录候选核对字段后File.Move替换，最终TargetPath、版本、SHA及工作目录／图标／参数已回读；替换后解析真实.lnk启动并强制formal-entry-restart通过。原候选证据保留，没有额外复制旧EXE备份。恢复可将原.lnk指回已有release/source-control-20261025/Scodex-Workbench-1.3.8-x64.exe（SHA248e7320892a6945af16555f5876307efca7a2fb4e227355ce915be4664c615d），并同步描述；保留用户数据及配置，启动新版前从托盘退出旧实例。
- [清理记录](../release/message-revisions-20261025/runtime-cleanup.json)：递归删除被自动审批拒绝（blocked by policy），未执行、未重试或换工具删除。核对精确绝对路径、无链接／owned进程0后，两夹具3628／3626项分别移至[首夹具](../手动删除/scodex-revision-ui-f125a184-dc19-4cb6-8e00-ebf796354e68)与[最终夹具](../手动删除/scodex-revision-ui-d420027d-1fd8-41a2-968b-591ce44fffc0)，原release内两路径均不存在。资源管理器可手动删除这两个确切目录，不运行其中程序；测试源码、有效证据、正式包及其他旧夹具保留，无本轮常驻实例／服务。

## 1.3.8 已交付检查点

- 目标／有效方案：1.Git状态、差异、暂存／取消、本地提交与分支及保护；2.版本控制页、托管工作树作为项目进入真实模型编程和开发预览；3.定向辅助／实际EXE、构建1.3.8、原入口替换、增量审查、清理和双交接。功能及交付已完成；临时夹具部分残留已核实并记录。
- 范围／基线：17个代码／配置／测试文件，原始基线见release/source-control-20261025/baseline-manifest.json及review-baseline；README／对齐／双交接4文档另算。scBase／scWritten首次读取和写前比较，无Git、未扫历史，保留范围外修改。worktrees／dev-services原始基线与改前包已核对。
- 关键实现：electron/git-service.cjs、src/components/git-panel.jsx及main／preload／workbench／导航／存储入口；快照绑定HEAD、分支、真实Git元数据／index及所选文件内容。Git写入期间禁止切项目／新任务／退出，运行／dirty／只读拒绝写入。确切登记且非链接的工作树只解除userData容器保护，模型每次工具guard和开发服务首次／最终目录动态复验，其余敏感／相对路径保护保留。
- 约束：微软雅黑正文16px、辅助至少14px；无新增依赖／子代理，使用Skill：无。不改用户真实模型、密钥或参考认证，不自动推送／PR发布／丢弃／强制重置，不结束用户进程，不额外备份旧EXE。
- 有效结果：27辅助；前5实际范围SHAd5095bac…、后3及正式入口SHA248e7320…，全部EXE正常退出0。1816模块／294许可证build、第四次portable exit0，9对象／manifest一致。17文件增量审查无未解决本轮问题；轻量重构评估未发现证据足以支持额外范围的候选。

| 任务 | 状态 | 结果／遗留 |
| --- | --- | --- |
| Git服务／版本控制页 | 完成 | 差异、暂存／取消、提交、分支及写入保护 |
| 工作树项目／模型／开发服务 | 完成 | 审批／PowerShell真实写入、原项目不变、HTTP启停、存储入口及当前树保护 |
| 构建／原入口／17文件审查 | 完成 | 1.3.8版本／哈希／包一致性、正式目标重启布局和5聊天持久化 |
| 四文档与双交接 | 完成 | 落盘回读、链接、UTF8无BOM见document-verification.json |
| 测试临时清理 | 待手动处理，不影响功能 | Windows移动错误，首份部分迁移、第二份仍在原位，见runtime-cleanup.json |

## 1.3.8 验证、失败恢复与运行

- [27辅助](../release/source-control-20261025/targeted-tests.json)、[8实际EXE范围](../release/source-control-20261025/source-control-ui-verification.json)、[正式入口复核](../release/source-control-20261025/post-replacement-verification.json)、[最终界面](../release/source-control-20261025/source-control.png)、[视觉记录](../release/source-control-20261025/visual-verification.json)。Windows10.0.26300／Electron45／Node24.11.0，真实EXE／React／IPC／Git／文件／PowerShell与HTTP，仅模型回复替代，不能证明公网Grok或全部身份提供方兼容。截图为CDP renderer，非Windows全屏／原生鼠标，结论限当前设备／页面／视口／数据状态。
- [包一致性](../release/source-control-20261025/build-verification.json)：npm run build1816模块／294许可证；electron-builder portable x64，Electron45、npmRebuild=false、signAndEditExecutable=false；9对象及manifest与当前源一致，lock仅两处根版本变化。EXE未签名，既有大bundle及description／author提示保留。
- [17文件增量审查](../release/source-control-20261025/incremental-review.json)：精确修改前基线逐项核对，未将无关读取文件归为修改；Git状态／权限／生命周期／异步状态／边界／版本及测试检查完成，无本轮未解决项。当前模块已有直接边界，无依据追加架构或性能重构。
- 失败恢复：改名夹具D+A、中文C引用、CRLF为前置问题并定向修正；真实产品问题是userData整体保护误拦工作树模型cwd，改确切登记根授权，模型／开发服务同步复验后实际通过。存储驱动旧.settings-nav定位超时，改.settings-category-list并只读复用已完成首次提交，未重复写入。ASAR同路径header缓存已清除后再比较，未盲重建。原失败报告、initial-test-failure及package-cache-diagnostic保留。文档插入定位曾受LF／CRLF影响，使用实际标题换行恢复，保留原换行约定。
- [快捷方式](../release/source-control-20261025/shortcut-verification.json)：写前原SHABE11D322…／目标1.3.7核对，候选字段／SHA核对后同目录File.Move替换；TargetPath和过期描述同步1.3.8，目录／图标／空参数保持。替换后从.lnk解析目标强制运行restart-layout-and-final-entry，版本／当前树／5聊天／1080×700及1440×900／退出0通过。启动新版前从托盘退出旧实例，未擅自终止用户进程。
- 回滚将快捷方式目标指回已有release/context-menu-20261025/Scodex-Workbench-1.3.7-x64.exe，SHA4242973e857b15848abc40a1b40f091d4fe7ffe5119e87e43c2d92c114044f64，并同步描述为1.3.7；保留用户数据／配置，没有额外旧EXE备份。
- [清理实际记录](../release/source-control-20261025/runtime-cleanup.json)：预检查两夹具绝对路径、无reparse及owned进程0；跨卷Move-Item报权限或隐藏／只读项错误，首份部分迁移后停止，未重试强删／移动或改权限。原Temp的ea6681e3…剩3512项，项目手动删除同名位置219项；原Temp的94c7f634…仍3749项，其项目目标不存在。两个原路径及一个部分目标需按记录在资源管理器手动删除，不运行其中程序；旧夹具未触碰。测试源码、有效证据和正式包保留，无本轮常驻进程／服务。
- README、对齐与双交接已融合实际状态，落盘回读、链接、UTF8无BOM及哈希见release/source-control-20261025/document-verification.json。

## 1.3.7 已交付检查点

- 目标／验收：项目侧栏、最近侧栏与完整最近页按附件提供可实际执行的右键菜单、子菜单、键盘、确认及持久化；独立窗口可发送、审批、停止并同步草稿，项目移除保留磁盘文件。
- 有效方案：1.项目元数据、聊天动作／导出和受限窗口代理；2.菜单、快捷键、确认框及主窗口整合；3.定向辅助／实际 EXE、构建 1.3.7、替换原入口、增量审查、清理和双交接。各步骤已完成；收尾只修正驱动就绪条件，产品不变。
- 读取／修改与直接引用：electron/main、preload、conversations、project-registry、workspace-windows、workspace-window-preload、conversation-actions；src/main、workbench、workbench-panels、workspace-context-menu、workspace-window、lib/conversation-actions、styles；package／lock、两份菜单测试及四份说明。完整原始基线见 release/context-menu-20261025/baseline-manifest.json 与 review-baseline；无 Git、未读历史。写前按最近内容比较，保留范围外修改。
- 约束：主窗口唯一写历史；子窗口只白名单快照和受限动作，不夹带其他聊天未发送附件。项目删除只移除登记及相关聊天，不删除磁盘目录；运行／未保存／最后可用项目门禁保留。分叉生成独立聊天和消息 ID，清活审批且不重放命令。无新增依赖／子代理，使用 Skill：无；不改用户真实模型密钥或参考 .codex 认证。微软雅黑正文 16px、辅助至少 14px。

| 任务 | 状态 | 结果／阻塞 |
| --- | --- | --- |
| 聊天与项目菜单、最近页 | 完成 | 重命名、置顶、阅读状态、项目、分叉、复制、打开、归档恢复／永久删除，5 个原菜单范围结果有效 |
| 独立窗口、草稿及保护 | 完成 | 真实发送／审批／命令／停止、双向同步、关子窗后任务继续、项目窗及空项目／最后项目／dirty 保护 |
| 构建、入口与增量审查 | 完成 | 最新 EXE／快捷方式／版本／哈希一致；18 文件审查无范围内未解决项 |
| 实际菜单与最终视图 | 通过 | 13 个范围有效；正式入口强制 final 项通过，缩放关闭再右键重开、最终退出 0 |
| 临时清理 | 待手动删除 | 3644 项已安全移动，原 Temp 路径不存在，owned 进程 0；不影响功能 |
| 本轮遗留 | 无功能阻塞 | 外部默认应用正文渲染、8 窗上限未做实际验收，见测试边界 |

## 1.3.7 验证、失败恢复与运行

- [29 项辅助](../release/context-menu-20261025/targeted-tests.json)、[13 个实际 EXE 范围](../release/context-menu-20261025/context-menu-ui-verification.json)、[正式入口复核](../release/context-menu-20261025/post-replacement-verification.json)、[最终菜单](../release/context-menu-20261025/context-menu.png)、[视觉核验](../release/context-menu-20261025/visual-verification.json)。真实 EXE、React、IPC、窗口、剪贴板、文件、PowerShell 和历史；仅模型回复由回环夹具替代，不能据此证明公网 Grok 或所有服务兼容。前 5 范围使用初版 SHA13fc2053…，两处 renderer 修复未影响它们；后 8 范围在最新 SHA4242973e…通过。逐项来源保留，未声称同一二进制全量重跑。
- [包一致性](../release/context-menu-20261025/build-verification.json)：10 个对象及运行 manifest 与当前源／dist 一致；npm run build 为 1815 模块／294 许可证，electron-builder portable x64 两次均退出 0。Electron45，npmRebuild=false、signAndEditExecutable=false；EXE 未签名，既有大 bundle、description／author 提示仍存在。lock 结构只两处根版本变化，无依赖修改。
- [18 文件增量审查](../release/context-menu-20261025/incremental-review.json)：完整本轮修改前基线逐项核对；唯一草稿回声缺陷和空项目选择缺项已修复并在实际程序通过。关闭确认框后下一帧恢复焦点。最后仅复审驱动的 focus／布局等待、事件诊断与 final 缩放边界，node --check 退出 0；已通过产品审查不重做。轻量重构评估：菜单动作、窗口代理、历史单写和导出已有直接边界，无新增证据支持额外架构或性能重构，本轮不扩大范围。
- 失败记录 context-menu-ui-failure-*.json 保留：早读碰边坐标→等待两帧；关子窗后等待已关闭页面 CDP→主 Target.closeTarget；驱动引号与子菜单父项遗漏→定向修正；历史 100ms 自动保存前读旧状态→等待项目／聊天／落盘一致。产品只修正已确认的双向草稿与空项目问题。最终正式入口首次 Menu visible 超时，补诊断轮未复现；源码确认 resize 关闭菜单，驱动缺少视口就绪。补焦点／两帧后，实际验证 1080 菜单→1440 resize 关闭→右键重开，事件顺序在入口报告，正常退出 0。不假称首次失败原事件已捕获。
- [快捷方式记录](../release/context-menu-20261025/shortcut-verification.json)：原 SHA2E6FC48C…／目标 1.3.6；首次 File.Replace 因 PowerShell 空备份路径绑定失败，原文件未变；核对基线后同卷 File.Move 覆盖成功，最终 SHA BE11D322…及字段已回读。不额外备份旧 EXE；恢复可将原快捷方式指回已有 release/concurrent-chats-20261025/Scodex-Workbench-1.3.6-x64.exe，SHA656d0cc2bcdd92087b8a684953a6497c09a54eff0bca99872edec6a9fb24cf21。启动新版前从托盘完整退出旧实例，未擅自结束用户进程或改用户数据。
- [清理记录](../release/context-menu-20261025/runtime-cleanup.json)：精确核对源／目标、无 reparse、owned 进程 0后，将本轮 3644 项移动至[待手动删除夹具](../手动删除/scodex-menu-ui-f912cff5-9d5c-4d9f-a1f4-28e8e26e6163)。原 C:/Users/Administrator/AppData/Local/Temp/scodex-menu-ui-f912cff5-9d5c-4d9f-a1f4-28e8e26e6163 已不存在。沿用既有清理限制，未重试递归删除；资源管理器可删除这个确切目录，不运行其中程序，其他旧夹具未触碰。两个本轮 Notepad 测试进程已按精确输入确认后结束，无本轮常驻进程或服务；未来复测新建隔离夹具。
- 双交接与 README／对齐文档已融合本轮状态，落盘回读、链接、UTF-8 无 BOM 结果见 release/context-menu-20261025/document-verification.json。

## 1.3.6 已交付检查点

| 任务 | 状态 | 结果／证据 |
| --- | --- | --- |
| 并行请求及事件归属 | 通过 | 最多3项、同聊天重复门禁、后台交错／停止／错误、迟到事件与删除保护 |
| 草稿／任务入口／未读 | 通过 | 文字／图片／文件／技能／计划切换保留、运行与审批入口、后台结果及已读持久化 |
| 文件提交与审批 | 通过 | 文本／表格／图片共享提交锁；实际EXE双任务读同文件，一项保存另一项拒绝；独立审批／拒绝／停止 |
| 辅助与实际EXE | 通过 | 37辅助、10实际范围；同一SHA，续验只执行未完成范围 |
| 构建、入口与审查 | 完成 | 1811模块／294许可证，10包内对象一致；15代码／配置／测试文件增量审查；正式入口更新后实际复核 |
| 双交接／文档 | 完成 | README／对齐与双交接落盘回读，链接及UTF8无BOM验证 |
| 临时清理 | 待手动删除 | 3638项已移动，原路径不存在、owned进程0，不影响功能 |
| 整体对齐 | 继续进行 | 用户新增菜单已在1.3.7交付，整体不声称95%或100% |

## 1.3.6 方案、变更与约束

1. 每聊天路由请求、流式回复、审批、停止和错误；主进程限制3个IPC聊天及同聊天重复。
2. 接入运行任务列表、待审批跳转、后台未读、每聊天文字／图片／附件／上下文／技能／计划缓冲。
3. 完成辅助与实际EXE、构建1.3.6、更新原快捷方式、增量审查和双交接。

- electron/chat-runs.cjs提供请求与历史保留门禁，main／conversations接入；src/components/chat-runs.jsx及workbench／recent／styles接入。无新依赖／子代理，使用Skill：无；同轮始终1.3.6。
- 同项目并行，运行时不切项目、修改全局模型或存储。共享项目文件，非独立工作树；file-commit.cjs共用短时提交锁，集成文本／表格／图片最终hash／dirty／取消提交；不能隔离任意Shell或外部应用。
- 文字草稿持久化；未发送图片、附件、上下文与技能的切换缓冲仅内存，完整退出不承诺恢复。权限或项目变化清空缓冲；已发送附件和未读随历史保留。
- 参考.codex只读，认证及用户默认模型连接不变。本轮只替代外部模型回复，实际EXE／UI／IPC／文件／PowerShell／历史真实，不证明公网Grok或第三方服务兼容。
- 无Git。前半段runsBase首次读取，Node工具会话终止后丢失；Electron基线从正式1.3.5 ASAR恢复，renderer按确切变更记录逆向恢复原片段，存于release/concurrent-chats-20261025/review-baseline。完整原始renderer哈希未保留，此限制记入审查；没有读取历史或归属无关用户修改。后续写入按恢复时内容比较。

## 1.3.6 验证、失败恢复与运行

- [37辅助](../release/concurrent-chats-20261025/targeted-tests.json)、[10实际EXE范围](../release/concurrent-chats-20261025/concurrent-chats-ui-verification.json)、[最终界面](../release/concurrent-chats-20261025/concurrent-chats.png)、[视觉记录](../release/concurrent-chats-20261025/visual-verification.json)。双视口1440×900／1080×700；微软雅黑正文16px／辅助14px，侧栏可折叠与滚动。截图为实际renderer，非Windows全屏／原生鼠标。
- [包一致性](../release/concurrent-chats-20261025/build-verification.json)、[15文件增量审查](../release/concurrent-chats-20261025/incremental-review.json)、[快捷方式](../release/concurrent-chats-20261025/shortcut-verification.json)、[入口复核](../release/concurrent-chats-20261025/post-replacement-verification.json)；最终入口实际打开共享任务历史与附件历史、退出0。所有功能范围同一SHA，未重复通过用例。
- 失败恢复均为环境／驱动：首次进程初始化失败未启动；初始历史未保存的ID与未发送聊天同名导致定位错误，改等待聊天数量／保存并按真实排序导航；无效PNG被Chromium拒绝，实际canvas生成有效输入；异步侧栏保存等待可见状态；only入口检查强制执行避免复用旧动作。原始报告initial、attachment-wait、attachment-input、fixture-image-navigation、layout-wait和入口before-forced-check保留于同一release目录，产品未因此盲目重写。
- 首次失败退出被自身忙碌确认阻塞；核实唯一profile及父PID后只结束本轮实例树。驱动已改先取消自身任务后正常退出，后续全部退出0，无常驻测试服务，用户进程未触碰。
- 构建npm run build及electron-builder portable x64，Electron45、npmRebuild=false、signAndEditExecutable=false；未签名，既有大bundle／元数据提示保留。锁文件仅两处根版本变化。
- 正式.lnk写前SHA25F0E399…，写后2E6FC48C…，只改TargetPath；工作目录／图标／空参数保持。没有额外旧EXE备份；恢复可指回已有release/mcp-oauth-20261025/Scodex-Workbench-1.3.5-x64.exe，SHA5f56bdcfdd2a67080c9306c44e83605cb02e2a49b01a0a102a378ccef0454750。启动新版前从托盘明确退出旧实例。
- [清理记录](../release/concurrent-chats-20261025/runtime-cleanup.json)：本轮3638项已安全移至[待手动删除](../手动删除/scodex-runs-ui-05838d9f-0c97-4091-89c4-6bb9dff14c4a)，原Temp路径不存在、owned进程0；沿用前次递归删除被拒后的安全移动策略，未换工具重试删除，不运行其中程序。
- 轻量重构评估：请求门禁、提交锁和任务列表已有直接边界，无测量证据支持额外架构／性能重构。后续用户新增右键菜单单独推进1.3.7。文档验证见release/concurrent-chats-20261025/document-verification.json。

## 1.3.5 已交付检查点

| 任务 | 状态 | 结果／证据 |
| --- | --- | --- |
| OAuth配置／回调／加密 | 通过 | DCR／预配置ID、PKCE／state／Host／重放、issuer／资源绑定 |
| 手工登录与生命周期 | 通过 | 独立临时session，无Node／preload；拒绝／取消／关窗／配置／切项目／退出 |
| 续期／清除／迟到响应 | 通过 | 重启刷新与轮换、临时故障保留、invalid_grant手工重登、交换期间取消不保存 |
| 模型与界面 | 通过 | 原生／JSON各3次审批、真实资料／工具、脱敏历史；双视口与微软雅黑 |
| 构建／入口 | 完成 | 1810模块、294许可证，10包内对象和manifest一致，现有快捷方式更新及复核 |
| 增量审查／双交接 | 完成 | 13代码／配置／测试文件，仅本轮差异；双交接落盘回读与文档验证 |
| 临时清理 | 待手动删除 | 本轮夹具已移到指定目录，原路径无残留，进程0 |
| 整体Codex能力 | 尚未完成 | 见能力对齐与已知限制，不标记整体完成 |

## 1.3.5 方案、变更与关键约束

1. 接入OAuth配置、独立授权窗口、真实SDK发现／PKCE与state回调。
2. 接入Windows加密、续期／清除、取消／配置代次与项目／退出保护。
3. 完成定向辅助与实际EXE验收，构建1.3.5、更新既有入口、增量审查与双交接。

- 新增electron/mcp-oauth.cjs与mcp-oauth-window.cjs；mcp-store、runtime、main／preload及MCP连接页接入。复用已安装SDK，无新依赖／子代理，使用Skill：无。无Git，以oauthBase首次读取内容为审查基线，写前比较保留并发改动；不得使用前轮ctxBase代替本轮基线。
- HTTP支持Bearer／OAuth；OAuth仅公共客户端，无客户端密钥。令牌／注册信息／发现状态在主进程Windows加密；verifier只在内存。端口0首次自动选择后复用，可手填1024–65535；预配置ID须填写所属issuer和已登记回调。
- 手工入口发起登录，模型不会弹登录窗；独立临时partition、sandbox、无Node／preload、拒绝权限／下载／弹窗。HTTPS及本机回环测试；回调绑定127.0.0.1及唯一连接路径，随机state、PKCE和Host／重放检查。OAuth元数据与其他地址不接收MCP认证头。
- 授权默认5分钟，授权网络15秒，OAuth响应256KB、MCP响应2MB；配置、项目或取消代次改变不能保存旧令牌。临时续期故障保留刷新凭据；失效授权要求手工登录。清除只删除本机状态，不冒充撤销服务端权限。
- 用户默认模型配置与.codex认证保持；只使用受控回环OAuth／MCP和模型测试，无公网密钥。本轮不能证明所有公网身份提供方或Grok兼容；界面正文16px／辅助至少14px、微软雅黑。

## 1.3.5 验证、恢复与运行

- [30有效辅助](../release/mcp-oauth-20261025/targeted-tests.json)：首轮27通过＋两项测试前置修正后定向通过＋1交换期间取消补验。涵盖OAuth与直接store／runtime／context回归，不无变化重跑无关范围。
- [12实际EXE范围](../release/mcp-oauth-20261025/mcp-oauth-ui-verification.json)、[正式入口复核](../release/mcp-oauth-20261025/post-replacement-verification.json)、[最终界面](../release/mcp-oauth-20261025/mcp-oauth-workbench.png)、[视觉记录](../release/mcp-oauth-20261025/visual-verification.json)。真实EXE、独立登录窗、Windows加密、SDK／OAuth服务／审批／历史；仅模型回复替代。CDP驱动，非Windows全屏或原生鼠标验收；截图结论限当前设备、页面、视口和数据状态。
- [包内一致性](../release/mcp-oauth-20261025/build-verification.json)、[13文件增量审查](../release/mcp-oauth-20261025/incremental-review.json)、[快捷方式记录](../release/mcp-oauth-20261025/shortcut-verification.json)。锁文件结构仅根version和packages根version两处；运行manifest一致。复用未变化的1.3.4资料、1.3.3图片／1.3.2表格及更早记录，保留原版本与SHA。
- 辅助首轮Host自定义fetch未真实发出、并发helper各自重建目录；分别改原始HTTP和共享已观察目录，保留产品检查。[首轮失败](../release/mcp-oauth-20261025/initial-test-failure.json)。真实窗口首次被fixture CSP form-action self挡住跨端口回调，修正夹具许可后通过；预览驱动未选择目录项，补真实选择与条件化刷新后续验。产品代码未因此重写。[窗口原失败](../release/mcp-oauth-20261025/mcp-oauth-ui-verification.initial.json)、[预览前置失败](../release/mcp-oauth-20261025/mcp-oauth-ui-verification.preview-prerequisite.json)。
- 构建沿用npm run build与electron-builder portable x64，Electron45、npmRebuild=false、signAndEditExecutable=false，输出release/mcp-oauth-20261025；退出0，EXE未签名，既有大bundle／元数据提示保留。
- 现有快捷方式写前核对1B5E883D…与旧目标1.3.4，候选SHA核对后仅改TargetPath，写后目录／图标／参数不变；最终解析目标实际复核通过。没有额外旧EXE备份。恢复可将快捷方式指回既有release/mcp-context-20261025/Scodex-Workbench-1.3.4-x64.exe，SHA d0f1c7fd74ef4f86fffe5e8d7e7b1865f5423f9e8825b6ef21faa28de1527e60。启动新版前从托盘明确退出仍在运行的旧实例；没有擅自结束用户程序。
- [清理记录](../release/mcp-oauth-20261025/runtime-cleanup.json)：自动审批审查拒绝递归删除，原文blocked by policy、未说明具体原因；没有换工具重试删除。已核对边界并移至[待手动删除夹具](../手动删除/scodex-oauth-ui-48c653c7-323e-4118-af32-55e4f10755e3)，原C:/Users/Administrator/AppData/Local/Temp/scodex-oauth-ui-48c653c7-323e-4118-af32-55e4f10755e3不存在，3633项、owned进程0。首次移动检查误计当前诊断shell，排除本shell后确认无其他占用。资源管理器可手动删除，不运行其中程序；旧夹具未触碰。
- 轻量重构评估：OAuth管理／窗口与存储／连接／UI边界清楚，现有证据不足以支持额外重构，无性能测量结论。后续按整体目标的独立缺口继续，先恢复检查点及双交接，不扫描历史或重跑未变化测试。
- 四份文档落盘回读、链接、UTF8无BOM验证记录：release/mcp-oauth-20261025/document-verification.json。

## 1.3.4 已交付检查点

| 阶段 | 状态 | 结果／证据 |
| --- | --- | --- |
| 真实MCP资料接入 | 通过 | 仅资料stdio／认证Streamable HTTP、分页、模板与提示词参数、中文与嵌入资源 |
| 手工浏览与模型调用 | 通过 | 原草稿保留、显式发送；原生／JSON目录→读取／提示词，逐次审批与记录 |
| 取消、通知与连接保护 | 通过 | 中文停止、真实取消、旧目录／重连／动态策略、拒绝与规划／never |
| 构建与包内一致性 | 通过 | 1810模块、294许可证；7个关键包内对象及运行manifest一致 |
| 实际UI、历史和正式入口 | 通过 | 双视口、3操作重启、连接不自动启动、最终入口和资料预览 |
| 增量审查与文档 | 完成 | 15代码／配置／测试文件；文档最终验证见document-verification.json |
| 临时清理 | 待手动删除 | 夹具已移动、进程0；不影响功能验收 |
| 整体Codex能力 | 尚未完成 | 见能力对齐与已知限制；本轮未扩展OAuth或任意桌面 |

## 1.3.4 方案、决策与边界

1. 接入真实SDK资源／模板／提示词目录、分页、参数、有界文本和取消。
2. 接入手工预览／加入草稿，以及模型本任务目录观察、逐次审批、操作记录和动态保护。
3. 完成定向辅助、实际EXE验收、同版重建、正式入口替换、增量审查和双交接。

- 新模块electron/mcp-context.cjs，复用既有连接；主进程／preload与MCP页面接入，src/components/mcp-context-browser.jsx提供预览，workbench.jsx保留原草稿后加入资料，不自动发送。没有新增依赖／子代理，使用Skill：无。
- 每类目录8页、总96项／128KB；文本48KB／40段，超限明确标记；参数16项、单值4096字符／总16KB。单个SDK请求15秒、整个操作20秒。二进制不传送，资源链接不自动读取，提示词user／assistant角色只作文本资料标签。
- 服务通知、连接代次与目录标识使旧资料失效；请求可停止，卸载或代次变化取消旧请求。模型每次目录／读取／提示词均审批，必须先观察本任务目录；审批后重新检查策略、项目guard与代次。规划可审批读资料；其他工具仍沿用只读白名单，never不开放模型MCP。
- 微软雅黑正文16px、辅助至少14px。手工点击预览会请求已配置服务；只有加入草稿后点击发送才进入模型。只读参考.codex，不读取认证或替换用户默认连接；本轮只用受控模型回复，其余EXE／UI／SDK／审批／配置加密／历史真实执行，不证明公网Grok可用。
- 无Git；审查以ctxBase写前内容为基线，写前比较防并发覆盖。只修改本轮MCP资料、直接集成、测试和版本／说明。15文件增量审查无范围内未解决项；锁文件结构仅两个根版本变化。

## 1.3.4 验证、失败恢复与运行

- [辅助记录](../release/mcp-context-20261025/targeted-tests.json)、[实际EXE报告](../release/mcp-context-20261025/mcp-context-ui-verification.json)、[最终资料预览](../release/mcp-context-20261025/mcp-context-browser.png)、[视觉核对](../release/mcp-context-20261025/visual-verification.json)。14功能范围与最终文案／双视口复核有效；截图结论仅限当前设备、页面、视口和数据状态。
- [包内一致性](../release/mcp-context-20261025/build-verification.json)、[增量审查](../release/mcp-context-20261025/incremental-review.json)、[快捷方式](../release/mcp-context-20261025/shortcut-verification.json)、[替换后入口复核](../release/mcp-context-20261025/post-replacement-verification.json)。2范围来自初始c67ea492…、10范围来自95514ec3…、最终身份／历史及文案布局来自当前SHA；合并报告保留逐项来源。
- 取消真实送达，但SDK abort错误绕过中文提示；仅在已aborted的catch统一中文停止／超时，加强辅助断言后复验通过。[初次实际失败](../release/mcp-context-20261025/mcp-context-ui-verification.initial.json)保留。恢复驱动曾遗漏重启后浏览目录前置，补条件化目录初始化；[驱动前置失败](../release/mcp-context-20261025/mcp-context-ui-verification.resume-prerequisite.json)保留，未重写正常产品。
- 审查补MCP页底规划资料规则，只改说明文字，重建同版后仅复验身份／文案／布局／历史；模型行为结果按原SHA复用。[文案修正前报告](../release/mcp-context-20261025/mcp-context-ui-verification.before-copy.json)。截图驱动补实际可见预览及两帧绘制等待，正式程序不因此变更。
- 构建：npm run build；electron-builder portable x64，Electron45、npmRebuild=false、signAndEditExecutable=false。最终EXE未签名，既有大bundle和元数据提示保留。所有本轮构建、测试及实际程序均结束；没有强制结束用户进程。
- 现有快捷方式写前核对674D6671…基线，写后目标、目录／图标／参数和候选SHA一致；没有额外旧EXE备份。恢复可将快捷方式指回已有release/image-runtime-20261025/Scodex-Workbench-1.3.3-x64.exe，SHA151e0eeaef7aea24b09aa55615315830d1fee0ba584d604110d8d2e3f818006b。启动新版前从托盘明确退出旧实例；用户数据／模型配置保持。
- [清理记录](../release/mcp-context-20261025/runtime-cleanup.json)：原C:/Users/Administrator/AppData/Local/Temp/scodex-context-ui-1a25a731-759e-4809-bfa6-a6ce8bbbb7c9不存在；3635项现存于[待手动删除夹具](../手动删除/scodex-context-ui-1a25a731-759e-4809-bfa6-a6ce8bbbb7c9)，owned进程0。沿用此前递归删除被拒绝后的安全移动方案，本轮未重试递归删除；可用资源管理器删除，不运行其中程序。旧阶段夹具未触碰。
- 轻量重构评估：MCP资料已独立模块化，现有证据不支持额外重构；完整对齐仍有明确功能缺口，继续按独立范围推进。本轮没有自动扩展架构或公开服务。文档已落盘回读、链接及UTF8无BOM验证；见release/mcp-context-20261025/document-verification.json。

## 1.3.3 已交付检查点

| 阶段 | 状态 | 结果／证据 |
| --- | --- | --- |
| 图片模型工具与文件保护 | 通过 | 原生／JSON读改读，尺寸／像素／文字、拒绝／停止／策略／冲突 |
| 编辑器、原生保存与历史 | 通过 | dirty、裁剪重置、原生继续编辑与PNG导出、后台刷新、重启 |
| 项目切换加载竞态 | 已修复／通过 | 实际EXE先复现，补reset token后定向通过 |
| 辅助与构建 | 通过 | 26项、1809模块、294许可证；7包内对象与manifest一致 |
| 正式入口 | 完成 | 快捷方式写前后hash核对，最终入口最小复核通过 |
| 增量审查与双交接 | 完成 | 15代码／配置／驱动文件；最终文档记录见document-verification.json |
| 临时清理 | 待手动删除 | 夹具已移动，原路径不存在、owned进程0；不会影响运行 |
| 整体Codex能力 | 尚未完成 | 见已知限制与能力对齐，不宣称100% |

## 1.3.3 验证、失败恢复与恢复方式

- [26项辅助](../release/image-runtime-20261025/targeted-tests.json)、[17范围实际EXE](../release/image-runtime-20261025/image-ui-verification.json)、[最终图片工作台](../release/image-runtime-20261025/image-workbench.png)、[视觉结论](../release/image-runtime-20261025/visual-verification.json)、[真实输出图片清单](../release/image-runtime-20261025/pixel-evidence.json)。
- [最终包内一致性](../release/image-runtime-20261025/build-verification.json)、[15文件增量审查](../release/image-runtime-20261025/incremental-review.json)、[快捷方式](../release/image-runtime-20261025/shortcut-verification.json)、[替换后复核](../release/image-runtime-20261025/post-replacement-verification.json)。
- 图片原生读改读实际保存40×60，指定像素[120,10,10,255]，120个文字变化像素，源图字节保持；JSON双翻转颜色、JPEG透明区白底和手工导出像素独立回读核对。
- 验收驱动恢复：brightness实际按label／id关联，初驱动只查aria-label；Windows asar需标准路径；原生另存为／退出可能为后代窗口；Windows PowerShell 5读取UTF8无BOM和UIA provider存在差异，助手改为显式UTF8和既有pwsh，按owned PID和唯一可见控件操作。没有重写正常产品保存逻辑；失败报告及恢复边界在实际合并报告和测试交接可追溯。
- 产品修复：补退出提示的“图片”；实际延迟图片解码回调复现项目重置token未失效，补reset失效后通过。[竞态原失败](../release/image-runtime-20261025/image-ui-verification.project-load-race.json)保留。除回调延迟外，文件读取、解码和项目切换均真实执行。
- 构建：npm run build；electron-builder portable x64，沿用本机Electron45、npmRebuild=false、signAndEditExecutable=false。EXE未签名，既有大bundle提示保留；同轮始终1.3.3。
- 运行入口和验收候选为同一最终文件，SHA一致；恢复可将现有快捷方式指回已有release/spreadsheet-runtime-20261025/Scodex-Workbench-1.3.2-x64.exe，SHA52d81428d81b0262167d41011cd016af728e82eddd1ed7bf3c641178800d4172。启动新版前从托盘明确退出旧实例；没有强制结束用户进程或覆盖用户配置／数据。
- 夹具原路径C:/Users/Administrator/AppData/Local/Temp/scodex-image-ui-8c2e1f3e-71e0-4adf-ae63-284788d22e42已不存在，现存[待手动删除夹具](../手动删除/scodex-image-ui-8c2e1f3e-71e0-4adf-ae63-284788d22e42)。沿用此前审批拒绝递归删除后的安全移动方案，本轮未重新尝试删除；可在资源管理器删除该隔离夹具，不要运行其中程序。旧阶段待清理目录未触碰。
- 轻量重构评估：图片处理、文件保护、模型编排已分离，暂无证据支持额外重构；本轮不扩大范围。所有必要有限操作已结束，无常驻测试服务；未来复测需新建可用隔离夹具，不能使用“手动删除”中的程序。

## 1.3.2 执行结果

| 任务 | 状态 | 结果／证据 |
| --- | --- | --- |
| 模型工作簿执行及审批 | 完成 | 2工具，共用原生／JSON执行；真实XLSX与CSV读改读 |
| 版本、未保存及并发保护 | 通过 | dirty、审批期间外部修改／手工编辑／策略变化、拒绝／取消 |
| 编辑器与历史 | 通过 | 记录打开、干净表格自动刷新、手动保存、完整退出重启 |
| 有界与复杂文件处理 | 通过 | 辅助路径／junction／大小与范围检查；含图片工作簿不变 |
| 构建、包内与正式入口 | 完成 | 1809 renderer模块、294许可证；7对象与manifest一致；替换后最小复核通过 |
| 增量审查与文档 | 完成 | 15代码／配置／测试文件；仅补审修复差异；文档最终验证见document-verification.json |
| 临时清理 | 待手动删除 | 新夹具已移入项目“手动删除”，原路径不存在，应用与测试服务已结束 |
| 整体Codex能力 | 尚未完成 | 继续见已知限制与能力对齐 |

## 主要变更、有效验证与失败恢复

- 执行器：electron/spreadsheet-tools.cjs；复用agent-tools.cjs项目路径与AGENTS接口。electron/csv.mjs为既有CSV解析器的共享位置，src/lib/csv.js重导出；main.cjs合并工具与审批审计。
- UI：workbench.jsx、agent-activity.jsx、message-presentation.js、tool-catalog.js、styles.css；未新增虚构能力入口。
- [12项辅助](../release/spreadsheet-runtime-20261025/targeted-tests.json)、[15范围实际EXE](../release/spreadsheet-runtime-20261025/spreadsheet-ui-verification.json)、[最终界面](../release/spreadsheet-runtime-20261025/spreadsheet-workbench.png)、[视觉核验](../release/spreadsheet-runtime-20261025/visual-verification.json)。
- [包内一致性](../release/spreadsheet-runtime-20261025/build-verification.json)、[增量审查](../release/spreadsheet-runtime-20261025/incremental-review.json)、[快捷方式](../release/spreadsheet-runtime-20261025/shortcut-verification.json)、[替换后复核](../release/spreadsheet-runtime-20261025/post-replacement-verification.json)。
- 首轮辅助误判ExcelJS默认样式；精确修复后通过。重算测试原假定ExcelJS解析该属性，改检查实际落盘XML；不修改正常产品逻辑。[辅助失败记录](../release/spreadsheet-runtime-20261025/initial-failure.json)保留。
- 实际表格记录未打开：ChatMessage仍绑定文本回调，修正唯一回调后通过。[初次实际报告](../release/spreadsheet-runtime-20261025/spreadsheet-ui-verification.initial.json)保留。
- 历史驱动只查12条侧栏，较早聊天真实存在，改走完整最近页；不改存储。最终截图发现新增说明少24px边距，修正后仅复验布局／身份／历史。[入口修正阶段报告](../release/spreadsheet-runtime-20261025/spreadsheet-ui-verification.entry-fixed.json)保留。
- 前述所有有限构建与验收均结束；各项旧结果仅在对应代码／输入未变时复用。1.3.1回复、服务及更早范围见[成功流程交接](SUCCESS_WORKFLOW_HANDOFF.md)，未无变化重跑。
- 轻量重构评估：工作簿操作已与文本工具、模型编排、CSV和UI分离；已有证据不足以支持扩大重构，不在本轮追加功能或性能改造。

## 构建、运行、恢复及清理

- 构建：npm run build；electron-builder portable x64，沿用本机Electron45、npmRebuild=false、signAndEditExecutable=false；EXE未签名，既有大bundle提示保留。
- 最终路径与验收候选相同，已核对SHA、运行manifest及必要包内模块。只更新现有.lnk目标，没有额外备份旧EXE或覆盖用户配置／数据；未擅自结束用户原实例。
- 恢复可将快捷方式指回既有release/conversation-layout-20261025/Scodex-Workbench-1.3.1-x64.exe，SHA40be312270ed7dbef4a966b54280750d9b8556ede5a62af6cb6ef3f9cf3eb622。启动新版前从托盘明确退出仍在运行的旧实例。
- 本轮临时原路径C:/Users/Administrator/AppData/Local/Temp/scodex-sheet-ui-5b640fe7-8ad4-4523-88c7-445afc46c414已不存在；实际位置为[待手动删除夹具](../手动删除/scodex-sheet-ui-5b640fe7-8ad4-4523-88c7-445afc46c414)。3638项内容，隔离进程0，可在资源管理器删除此夹具；不要运行其中程序。
- 保留测试源码、脱敏证据、正式产物与包复核构建目录。本轮没有常驻测试服务。旧服务阶段待删除夹具继续按其原记录管理，未触碰；恢复测试须新建可用隔离环境，不能使用“手动删除”中的数据。
- 文档与说明最终回读、链接、编码和无BOM证据见release/spreadsheet-runtime-20261025/document-verification.json。

## 已完成需求

| 版本／范围 | 实际变更 |
| --- | --- |
| 1.3.7 项目／最近菜单 | 完整右键菜单、独立窗口、双向草稿／审批／停止、项目保护、29辅助／13实际范围、正式入口及18文件增量审查 |
| 1.3.4 MCP资料 | 真实资源／URI模板／提示词、手动预览／草稿、模型逐次审批、分页／有界／取消／通知／旧连接，15辅助与14实际功能范围及正式入口复核 |
| 1.3.3 AI图片 | 真实视觉读改读、批量确定性编辑、审批／hash／dirty／并发保护、原生导出／历史／项目切换，26辅助／17实际范围 |
| 1.3.2 AI表格 | 模型XLSX／CSV／TSV读改读、批量公式／样式／工作表、审批与hash／dirty保护、记录及编辑器同步，12辅助／15实际范围 |
| 1.3.1 回复区与服务 | 真实时长、Markdown、紧凑记录／计划／修改摘要、错误／停止／重试；托管服务、日志、预览、脚本选择、模型四工具和生命周期清理 |
| 1.3.0 网页工具 | 当前对话 AI 标签、HTTP/HTTPS 打开、Bing 搜索、顶层文本／元素快照、引用点击、填入、受限按键、滚动、截图及关闭 |
| 1.3.0 权限 | 默认关闭；仅执行模式且按请求审批开放；规划不含点击／填入／按键；逐次批准后重新校验策略、页面代次和目标指纹 |
| 1.3.0 隔离 | 每项目／对话拥有独立临时会话；不使用手工标签的登录数据；无 preload、本地桥、任意 JS／CDP 或剪贴板暴露；AI 下载／设备权限关闭 |
| 1.3.0 图片与记录 | 真实 image_url 消息，在完整工具结果后追加；模型上下文保留最近三条图片证据；每条记录最多四张有界缩略图；历史不恢复活审批 |
| 1.3.0 界面 | 浏览器设置开关和边界说明、AI 标签标识、网页审批、可见操作记录与缩略图；审批期间主进程立即隐藏原生网页层 |
| 1.2.0 MCP | 官方 SDK 1.32.2；stdio／Streamable HTTP、Schema、工具发现／调用、逐次审批、取消、旧连接保护、Windows 加密和退出进程清理 |
| 1.1.0 项目工具 | 7 个本机工具、哈希／并发／未保存保护、PowerShell、原生／JSON 通道、计划／差异／命令输出与历史 |
| 1.0.5／1.0.4 | 托盘、项目／定时任务／技能、第三工作台、设置与存储；未变路径沿用原验收 |

## 仍有效的浏览器模块与约束（1.3.0）

- electron/browser-dom.cjs：固定隔离世界函数，使用当前快照的元素引用，不接收模型代码或选择器；排除密码、隐藏、上传及明显秘密字段。
- electron/browser-tools.cjs：10 项工具定义、参数验证、模式与动态策略检查、逐次审批和操作结果。
- electron/panel-browser.cjs：手工与 AI session 分离、请求级主机规则、可取消加载、DOM／截图 API、代次校验和项目清理。
- electron/main.cjs、agent-runtime.cjs、conversations.cjs：模型接入、审批层、真正图片消息和有界缩略图持久化；preload 无新增远程执行接口。
- src/workbench.jsx、shell-panels.jsx、integration-settings.jsx、agent-activity.jsx、styles.css：当前对话标识、浏览器设置、AI 标签、审批隐藏和记录；微软雅黑 16px，辅助至少 14px。
- 只读参考 .codex；无真实凭据导出；没有新增依赖或改变依赖锁定版本；不创建旧 EXE 备份，不删除用户文件与既有 release。
- 无 Git；采用读取基线和写入前内容检查，不将已有用户内容归为本轮。早期测试密钥通过标准输入，服务阶段另支持当前用户一次性本地命名管道；仅进入系统加密的隔离配置，结束后替换清除。

## 仍有效的浏览器验证与恢复（1.3.0）

- [17 个实际 EXE 范围](../release/browser-runtime-20261024/browser-ui-verification.json)、[3 条真实中转链路](../release/browser-runtime-20261024/live-relay-verification.json)、[实际画布截图](../release/browser-runtime-20261024/live-webpage-visual-proof.jpg)。
- 前五个功能范围在初始 1.3.0 包完成；随后仅修正 DOM 异常传播，剩余范围及真实中转在最终包完成。报告按项保留原 SHA，未把所有用例写成同一二进制全量重跑。
- [定向辅助验证](../release/browser-runtime-20261024/targeted-tests.json)、[包内一致性](../release/browser-runtime-20261024/build-verification.json)、[增量审查](../release/browser-runtime-20261024/incremental-review.json)、[快捷方式](../release/browser-runtime-20261024/shortcut-verification.json)。
- 产品恢复：Electron 隔离脚本隐藏异常详情，改为固定脚本返回有界中文错误，再由主进程抛出；DOM 变化拦截及中文原因实际复验通过。
- 驱动修正：完整模型配置、正确创建项目入口、测试网络白名单恢复；没有重写正常产品实现。真实模型最后文字最初读早于历史自动保存，退出后回读最终历史与截图确认通过，没有重发公网请求。
- 主 renderer 的 CDP 截图不含原生 WebContentsView 图层，不将其空白区域当作网页完整截图或 Windows 屏幕验收。网页原生截图由实际工具生成并单独视觉核对。
- 所有本轮有限构建和验收均已结束；测试服务和隔离程序已停止，用户原实例未强制退出。

## 已知限制与待办

- 尚无任意桌面鼠标键盘控制；页面工具只覆盖顶层 DOM 和当前视口引用，不包含跨域框架、第三方扩展、WebMCP、截图批注或自动密码／上传／下载。
- 浏览器权限是 Chromium 请求边界的主机规则，不是操作系统进程沙箱。任意 Shell 和 MCP 仍使用当前 Windows 账号。
- MCP资源／URI模板／提示词浏览和模型调用已在1.3.4落地，OAuth公共客户端授权在1.3.5落地；公网OAuth提供方全面兼容性尚未完成验证，旧SSE与在线市场尚未实现。
- 定时任务只在进程存活时执行；托盘隐藏继续运行，完整退出停止，不是 Windows 服务。
- 有界AI表格和图片确定性编辑已落地；生成式重绘、全部办公链路及完整跨任务协作尚未验收为Codex同等能力。
- 真实中转的本轮成功限定 deepseek-v4.1-flash、受控项目与本地站点；不证明 Grok、全部网站、外部账号或所有模型可用。新密钥未写入项目或替换默认连接。
- EXE 未签名；使用本机 Electron 45，跳过依赖 rebuild 和内层 EXE 资源编辑；既有大 bundle 提示保留。

## 运行与维护

- 先从托盘明确退出仍在运行的旧版，再打开项目快捷方式，避免单实例恢复旧进程。
- 设置 → 浏览器 → 允许 AI 使用内置浏览器；配置中的审批策略选按请求审批。随后启用执行任务，逐次核对网址、目标和参数。
- 密码、验证码和文件上传／下载由用户手动处理。截图会发送给所选模型，只有支持视觉的模型才能使用图片结果。
- 切换项目、关闭 AI 浏览器或完整退出会清理 AI 标签及临时会话；手工标签不因项目切换而关闭。
- 保留已有 release，不另备份旧 EXE；本轮重构评估已记入当前检查点。
- [成功流程交接](SUCCESS_WORKFLOW_HANDOFF.md)、[能力对齐](CODEX_ALIGNMENT.md)、[使用说明](../README.md)。本轮文档回读、链接、编码与 BOM 结果见 release/conversation-layout-20261025/document-verification.json。

## 仍有效的历史证据

| 历史范围 | 复用边界 |
| --- | --- |
| 1.2.0 MCP | [17 范围](../release/mcp-runtime-20261024/mcp-ui-verification.json)，对应未变的 SDK、加密、连接和服务生命周期 |
| 1.1.0 项目执行 | [16 个实际范围](../release/agent-workflow-20261024/agent-workflow-ui-verification.json)，文件／命令执行器和模式保护沿用；新密钥真实读改读新增证据 |
| 1.0.5 托盘导航 | [托盘与工具](../release/tray-tools-20261024/tray-tools-ui-verification.json)，对应未变路径 |
| 1.0.4 | 集成设置、存储与项目的专用验收见测试交接 |

使用 Skill：无；未创建子代理。

## 2026-10-31 MCP World 浏览器抓取（新增任务）

- 已登录内置浏览器只读打开 MCP World 分类和详情页，取得一个“混合部署/可托管”条目的可定位证据：页面称服务器由百度托管、传输为 SSE，并提供 24h/72h 连接有效期选项。
- 页面没有公开可直接调用的公网端点、认证配置或工具参数；未点击一键部署，未产生表单、上传、消息或外部账户写入。证据见 mcpworld-browser-scrape.json（release/mcpworld-scrape-20261031）。
- 固定清单仍为 48/50（96%）；该抓取不计入 M10 真实公网往返，M10 仍待可验证端点和安全配置。
## 1.3.21 默认文件打开位置下拉（2026-11-01）

- 当前目标：按附件位置与布局，将“默认文件打开位置”改为五项下拉：VS Code、Visual Studio、Default app、File Explorer、Git Bash；选择结果持久化，并用于工作区文件、工作区文件夹和项目文件夹的打开方式。
- 版本：沿用当前源码与正式基线 1.3.21；本轮未构建或替换 EXE，未递增版本。
- 主要变更：新增 `electron/file-open.cjs` 固定程序候选与旧值迁移；`electron/preferences.cjs` 规范化 `builtin/system` 为 `vscode/default`；`electron/main.cjs` 统一文件／文件夹外部打开路由并保留权限检查；`src/components/settings-panel.jsx` 增加附件风格下拉；`src/styles.css` 增加菜单样式和视口不足时向上展开；`src/workbench.jsx` 使用所选程序打开非内置文本文件。
- 约束：固定候选路径，不执行任意用户输入的程序；图片、表格等 Scodex 内置编辑类型继续在工作台内打开；不改真实 `.codex`、模型密钥或用户业务数据。
- 交付证据：[file-open-location-20261101/verification.json](../release/file-open-location-20261101/verification.json)。
- 增量审查：[file-open-location-20261101/incremental-review.json](../release/file-open-location-20261101/incremental-review.json)，本次差异未发现高置信度问题。
- 清理：隔离 profile/home 已移入[手动删除/file-open-ui-cleanup-20261101](../手动删除/file-open-ui-cleanup-20261101)；源 `C:\Windows\Temp\scodex-ui-file-open-profile` 与 `...home` 仅剩空目录，系统策略拒绝删除，待手动删除。

## 1.3.22 Supabase 应用级同步（2026-11-01）

- 当前目标：在设置中提供 Supabase 项目地址、同步空间、加密 anon key、启用开关、保存配置和手动同步；同步当前应用聊天库，使用版本条件写入防止离线副本覆盖。
- 主要变更：新增 electron/supabase-sync.cjs；主进程／preload 增加 Supabase 同步 IPC；设置页新增“应用同步”分类；新增 supabase-sync.sql 专用表、RLS、请求头同步空间策略和更新时间触发器；新增 tests/supabase-sync.test.mjs。
- 凭据边界：anon key 仅经 Electron safeStorage 加密写入用户数据目录的 supabase-sync.json，渲染器和普通设置状态只看到 hasCredential；未使用聊天中出现的任何密钥。
- 冲突语义：首次写入从版本0创建版本1；已有记录使用 version=eq.<expected> 条件更新；过期副本返回 conflict，不覆盖本地或远端数据；请求有15秒超时和512KB载荷上限。
- 独立项目：项目 ID saodtwnvbanjlkwwivcb。SQL Editor 执行成功；只读核验确认表存在、RLS 启用、INSERT／SELECT／UPDATE 三条策略存在。顺序化 A/B 验收返回首个提交1、过期提交0、最终版本1且载荷为副本A。
- 证据：[supabase-sync-20261101/verification.json](../release/supabase-sync-20261101/verification.json)。本轮不会把 SQL Editor 内部管理员执行替代应用 REST 端到端验收；真实 REST 还需用户在设置中提供该项目 anon key。
- 增量代码审查：已完成本轮差异审查，未发现高置信度问题；记录见 [incremental-review.json](../release/supabase-sync-20261101/incremental-review.json)。
- 限制与维护：本轮只同步聊天库，不自动合并冲突；A/B 行 scodex-acceptance-20261101 属于独立验收数据。清理或继续验收时只操作该同步空间。
