# 项目交接

<!-- formal-hello-1.3.54:start -->
## 当前增量：正式入口真实 `你好` 连通性与上限审计（已完成）

- 目标：使用正式 `1.3.54` 入口和已保存连接配置发送一次精确 `你好`，并核对模型上下文/输出是否仍被应用层固定上限截断。
- 实际结果：`E:/GDP/Scodex/App/Scodex工作台.exe` 返回完成事件，模型 `gpt-6.1-sol`、HTTP 200、输出 14 tokens、应用退出码 0；配置文件哈希保持不变，隔离副本中的加密凭据已清理。
- 非敏感证据：`release/formal-build-1.3.54-20261108/formal-hello/external-latency.json`，只含状态、模型名、HTTP 状态、耗时和用量，不含 API Key、Authorization 或响应正文。
- 上限审计：模型请求路径使用动态上下文容量和服务默认输出；`MAX_TOOL_CALLS`、`MAX_ROUNDS`、`MAX_OPERATIONS` 为无限值，讨论三路并行保留。文件大小、模型列表数量、地址数量、密钥格式、技能枚举和日志保留边界属于输入/资源防护，继续保留；讨论等待超时继续用于缩小上下文重试和真实降级，不伪造评议结果。
- 清理：递归删除本轮临时 profile 被策略拒绝且未重试；已将其移至项目根目录 `手动删除/formal-hello-1.3.54-fixture-a3a406cb-2633-4fbd-bb40-101c03d48a48`，原路径已不存在，详见报告清理字段。
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

## 当前状态

- 当前源码基线：`1.3.54`，位于 `E:/GDP/Scodex/workbench`。
- 当前正式入口：`E:/GDP/Scodex/App/Scodex工作台.exe`，包内版本 `1.3.54`；候选、正式入口和回滚证据见上方 `formal-build-1.3.54` 增量。
- 已完成基线：`.codex` 浏览器、电脑操控、SKILL 配置、键盘快捷键和三模型协作能力已在 1.3.46 正式入口完成定向验收。
- 当前目标：交付包含当前工作区实现的 `1.3.52` 正式 EXE，完成候选/正式身份核对、回滚备份、重启验收和真实连通性验证。
- 当前阶段：`1.3.54` 候选构建、模型团队 UI 8/8、候选与正式 `restart-only` 各 2/2、正式 EXE/ASAR 替换和哈希核对已完成；正式入口与候选哈希一致，报告 `release/formal-build-1.3.54-20261108/formal-replacement.json`。

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
