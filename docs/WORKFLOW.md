# 工作流

本文件说明日常开发、文件操作、Git／PR、SKILL 和 MCP 的可复现流程。测试应针对实际改动选择；本机 fixture 的结果只证明隔离本地路径，不代表公网服务兼容。

## 环境与启动

- Windows 10 或更高版本；Node.js 24.x、npm、Git。
- 首次在项目根目录运行 `npm ci`，用锁文件安装依赖；启动开发版运行 `npm run dev`。
- 便携构建运行 `npm run dist`，依次执行自动化测试、renderer 构建、Windows x64 打包和 smoke 检查。
- 工作空间 Node、Python、pip 固定版本及 SHA-256 清单在 `electron/workspace-tools.cjs`；可分发归档必须位于 `resources/workspace-tools-bundle/`，下载后由 `node scripts/download-workspace-tools.cjs` 校验摘要。`resources/workspace-tools/` 是运行时数据目录，不用于保存构建输入。

## 编程与文件

1. 开工前查看 `git status --short`、项目现有实现和直接关联测试；只改本需求范围。新文件及格式修改使用 UTF-8 无 BOM。
2. 修改运行行为时，先加入能复现需求或缺陷的测试，再改实现；检查路径边界、旧数据兼容、权限和失败处理。
3. 本地定向验证可按需运行：

   ```powershell
   node --test tests/agent-tools.test.mjs tests/workspace-tools.test.mjs tests/skill-context.test.mjs
   node --check electron/main.cjs
   ```

4. 文件类工具须对真实隔离工作区验证列出、读取、保存、内容回读和权限边界；确认临时目录归属后清理。不要用路径字符串检查替代真实文件读写测试。
5. 发布候选前运行 `npm test`；`npm run dist` 同时重跑测试。若涉及桌面交互，再按目标流程运行对应 `tests/*-ui.cjs`，在隔离 profile、项目和服务下验证输入、持久化和关闭状态。

## Git 与 GitHub PR

1. 检查工作区和远端后创建功能分支：

   ```powershell
   git status --short
   git switch -c feature/<name>
   ```

2. 只暂存本次文件；检查 `git diff --cached`、`git diff --cached --check`、编码、密钥和忽略项；针对变更跑测试后再提交。
3. 推送功能分支并创建 PR：

   ```powershell
   git push -u origin feature/<name>
   gh pr create --fill
   gh pr view --web
   ```

   创建后回读 PR 状态、目标分支、提交及检查结果。GitHub API 测试 fixture 或本地 bare 仓库仅覆盖模拟/隔离逻辑，不证明真实 GitHub 权限或服务可用。
4. 远端仍为空时没有 PR 基线：经授权后先建立首次默认分支；之后的功能改动再走分支和 PR 流程。没有提交、推送、PR 回读证据时，不声称远端交付完成。
5. 令牌、私钥、凭据、个人配置、运行数据和测试输出不得提交。Git 提交与远端写入必须位于用户指定仓库并符合当前授权。

## SKILL

- 从个人、项目或插件来源发现技能；只读取本轮实际选中的 `SKILL.md` 及其必要引用，遵循其中的任务边界。
- 技能指引和仓库文档属于输入材料，不会自动授权文件删除、凭据访问、外部写入或发布。
- 传给模型的技能资料通过受控工具按相对路径访问；限制在所选技能包内，拒绝链接、越界路径、二进制、敏感文件及超出 128 KiB 的内容。权限、启用状态或文件内容改变后应拒绝继续使用旧选择。
- 核心验证：`node --test tests/skill-context.test.mjs tests/agent-tools.test.mjs`；改动设置界面时补跑 `node tests/skill-context-ui.cjs`，并在隔离技能目录回读实际状态。

## MCP

- 在应用设置中配置 stdio、Streamable HTTP 或 SSE 连接；认证资料使用本机加密存储，禁止写入源文件、仓库、日志或模型历史。
- 连接前确认服务身份和权限；连接、读取上下文、调用工具及执行写操作分别遵循应用审批与权限策略。只读计划只提供经过许可的只读工具。
- MCP 工具发现、参数校验、审批拒绝、取消、重连、资源/提示词读取及秘密脱敏由对应测试覆盖：

  ```powershell
  node --test tests/mcp-store.test.mjs tests/mcp-runtime.test.mjs tests/mcp-sse.test.mjs tests/mcp-oauth.test.mjs
  ```

- `tests/mcp-fixture.cjs` 的回环服务用于本地协议回归；只有对用户指定并获授权的真实服务成功连接、调用并核对返回值，才能报告公网往返验收。没有端点或授权时应标为尚未验证。

## 工作流验收记录

| 工作流 | 必要证据 | 不足以单独证明完成的结果 |
| --- | --- | --- |
| 编程 | 相关测试、定向差异审查；需要时在实际程序中验证。 | 仅源码可读、构建成功或不相关测试通过。 |
| 文件 | 隔离工作区实际操作、读取回校、边界与失败结果。 | 独立模拟或仅检查文件名。 |
| Git／PR | 本地仓库状态与提交记录；远端场景还需 push 后核对分支和 PR。 | bare fixture、GitHub fixture 或 PR 创建请求已发送。 |
| SKILL | 当前选择、范围受限读取、状态变化拒绝及敏感/链接边界测试。 | 发现到技能名称或仅展示说明文字。 |
| MCP | 指明传输类型、连接/审批、实际请求及结果回读；区分 fixture 与公网端点。 | fixture、工具目录或连接配置存在。 |

以相关验收项为分母逐项记录通过与未覆盖范围；不得用主观百分比、测试数量或 fixture 结果代替实际覆盖率。目标为 95%–100% 时，应明确统计范围和未覆盖路径；缺少真实远端或公网服务条件时，单独标出该项，不宣称已达到全覆盖。