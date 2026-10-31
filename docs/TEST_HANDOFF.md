# 测试交接

## 当前验证检查点（2026-11-01）

- 被测项目：Scodex Workbench，`package.json` 版本 1.3.21；目标仓库初始化候选，分支 `main`，尚无 Git 提交。
- 目标运行环境：Windows x64；实际 Node.js v24.11.0、npm 11.6.1。npm ci 已按锁文件安装 681 个包；已构建 release/Scodex-Workbench-1.3.21-x64.exe（Electron 45.0.0 / x64）。npm 报告锁定依赖树有 24 项 audit 告警（22 moderate、2 high），本轮未升级依赖。
- 测试入口：代码/文件工作流及包构建均从项目根目录执行；实际 UI 验收在本机 Windows x64 便携 EXE 上操作隔离项目并回读文件。
- 先前结果：上轮摘要提到 19/19 定向测试通过，但本地候选没有对应日志或报告；作为背景记录，不计入本轮通过数。
- 本轮归档回归：新增 `tests/workspace-tools.test.mjs` 对照 package extraResources 和固定清单摘要。修复前按预期因 `resources/workspace-tools-bundle/node.zip` 缺失失败；将三个摘要已匹配的归档移动到该目录后，回归通过（1/1）。原字节内容及 SHA-256 未变化。
- 本轮定向逻辑验证：`node --test tests/agent-command.test.mjs tests/agent-runtime.test.mjs tests/agent-tools.test.mjs tests/workspace-tools.test.mjs tests/source-control.test.mjs tests/github-pulls.test.mjs tests/skill-context.test.mjs tests/mcp-store.test.mjs tests/mcp-runtime.test.mjs tests/mcp-sse.test.mjs tests/mcp-oauth.test.mjs tests/mcp-context.test.mjs`，116/116 通过，0 失败，耗时约 171 秒。覆盖命令/文件、Git 临时仓库和本地远端、GitHub API fixture、SKILL 隔离读取以及 MCP stdio、Streamable HTTP、SSE、OAuth、审批、取消和凭据脱敏；不证明公网 GitHub PR 或公网 MCP 服务已验收。
- 全套回归：`npm run dist` 的第二轮 `npm test` 为 316/316；`npm run build` 成功，Vite 产出 renderer `assets/index-Ce5CyD9f.js`。Electron Builder 生成 `release/Scodex-Workbench-1.3.21-x64.exe`（Electron 45.0.0 / x64）。首轮失败背景保留：`tests/shell.test.mjs` 单独 2/2 通过，`tests/storage.test.mjs` 修复后 17/17。
- 实际程序 smoke 结果：最终 `SCODEX_SMOKE_SCOPE=programming-files npm run smoke` 退出码 0。实际目标程序为 `release/Scodex-Workbench-1.3.21-x64.exe`，renderer `assets/index-Ce5CyD9f.js`；通过代码文件编辑保存回读、CSV 单元格保存回读、表格上下文附件及附件详情、XLSX 单元格保存回读、图片旋转后画布尺寸回读、PNG 导出尺寸回读、工作区边界拒绝和设置偏好持久化。输出截图为 `release/workbench-smoke.png`。本范围跳过 SKILL 页面和原生窗口关闭生命周期段；默认 `full` smoke 的 SKILL/原生关闭失败仍保留为范围外限制。

| 范围 | 操作 / 预期 | 当前结果 | 证据或限制 |
| --- | --- | --- | --- |
| 归档和构建输入 | 对照 `electron/workspace-tools.cjs` 固定 SHA-256，确认 package extraResources 读取目录及三项归档。 | 逻辑回归通过 | `tests/workspace-tools.test.mjs` 新增打包输入核验；待执行正式构建确认包内资源。 |
| 编程和文件工作流 | 相关 Node 测试及实际便携 EXE 中的代码编辑、文件保存与回读。 | 自动化测试 316/316；范围化实际 UI smoke 通过。 | `SCODEX_SMOKE_SCOPE=programming-files npm run smoke` 退出码 0；Electron 45.0.0 / x64；fixture 不代替实际 UI 验收。 |
| 全项目自动化测试 | `npm test`（由 `npm run dist` 调用） | 修复后 316/316 通过。 | 包含新增归档路径回归。首轮两个失败已分别核实并记录。 |
| 对话与存储修复 | `node --test tests/storage.test.mjs tests/conversations.test.mjs` | 17/17 通过。 | 覆盖存档往返、规范化幂等、存储量、旧消息兼容和对话字段持久化。 |
| Renderer / Windows 包 | `npm run build`、`electron-builder --win portable --x64`（来自 `npm run dist`） | 通过，renderer `assets/index-Ce5CyD9f.js`，EXE `release/Scodex-Workbench-1.3.21-x64.exe`。 | Electron 45.0.0；仍需包内核验与 smoke 复验。 |
| 实际 EXE smoke | `SCODEX_SMOKE_SCOPE=programming-files npm run smoke`（1.3.21 x64 EXE） | 通过，退出码 0。 | 代码/文件功能真实 UI 操作与文件回读通过；跳过范围外 SKILL/原生关闭段。 |
| 工作流文档 | 内容和引用、UTF-8 无 BOM、Git 差异检查通过。 | 通过 | `docs/WORKFLOW.md`、两份交接文档均已回读；相对链接存在、无 BOM、无尾随空白。 |
| 远端 Git 交付 | 核对远端为空；创建首次提交并推送后读取远端状态。 | 尚未完成验证 | 远端无分支；本地作者仍为占位身份 `Scodex Workflow <scodex-workflow@example.invalid>`，等待有效身份。 |

## 复用条件

源文件、依赖、归档、测试输入及目标环境未变化的结果可复用；本轮资源路径、工作流文档和 Git 状态发生变化后，只重测其直接影响范围。任何实际程序验收须记录入口、版本/构建标识、隔离环境及可定位结果。
