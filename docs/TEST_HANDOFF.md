# 测试交接

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

## 当前测试对象

- 源码：`E:/GDP/Scodex/workbench`，当前版本 `1.3.54`。
- 正式入口：`E:/GDP/Scodex/App/Scodex工作台.exe`，包内版本1.3.54。
- 本轮最终候选：`E:/GDP/Scodex/workbench/release/formal-build-1.3.54-20261108/candidate/win-unpacked/Scodex工作台.exe`，版本1.3.54；EXE SHA-256 `f77326e9b380482b4c126df5d1481921600f41e122c7788b1057e5e775767e4c`，ASAR SHA-256 `00b39e491f3413e054c42416fc3456d9824cf1e8b5bb52a72a054cf80a553563`。
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
