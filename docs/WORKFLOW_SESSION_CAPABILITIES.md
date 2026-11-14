# 工作流与会话能力对照

适用版本：Scodex工作台 1.3.63。本次结论是本地可核验能力对照，不是 Codex 全部产品、云端服务或内部实现的等价认证。官方功能页、站点地图及手册请求均返回 HTTP 403，无法据此确认上游全部细节。

| 范围 | 补充前 | 1.3.63 状态及边界 | 直接依据 |
| --- | --- | --- | --- |
| 会话分支与回答处分支 | 已有 | 保留；新分支不复制源会话待执行队列 | [会话动作](../src/lib/conversation-actions.js)、[修订逻辑](../src/lib/conversation-revisions.js) |
| 编辑消息、重生成、历史版本 | 已有 | 保留，相关逻辑回归通过 | [修订逻辑](../src/lib/conversation-revisions.js)、[测试交接](TEST_HANDOFF.md) |
| 并行聊天、暂停、恢复、停止 | 已有 | 保留；停止或失败会暂停该会话待发送队列 | [主界面](../src/workbench.jsx)、[运行记录](../electron/chat-runs.cjs) |
| 运行中补充要求 | 已有 | 保留接收状态；已接收内容可进入后续轮次，未采用内容不会误记为已接收 | [引导状态](../src/lib/conversation-steering.js)、[实际验收](../release/workflow-session-1.3.63/final-ui/conversation-workflow-ui.json) |
| 下一轮消息队列 | 原来只有运行中引导 | 新增每会话文字队列，支持编辑、排序、移除、暂停和继续，成功后按顺序续发 | [队列组件](../src/components/conversation-queue.jsx)、[队列规则](../src/lib/conversation-workflow.js) |
| 队列持久化与中断恢复 | 缺少 | 保存模型、模式、回答深度、权限和项目范围；重开保持暂停，手动继续；保护新草稿，不跨项目执行；已派发队列项遇到错误、取消或发送异常时恢复到队首且只恢复一次；活动项计入20条上限，满额恢复不丢尾项 | [存储规则](../electron/conversations.cjs)、[主界面恢复逻辑](../src/workbench.jsx)、[重开与恢复验收](../release/workflow-session-1.3.63/capacity-ui/conversation-workflow-ui.json) |
| 计划转执行 | 需再次手工发送 | 最新成功计划增加“按此计划执行”，使用当前选定模式在同一聊天进入实施；有草稿或附件时先处理，只读权限不变 | [主界面](../src/workbench.jsx)、[计划验收](../release/workflow-session-1.3.63/final-ui/conversation-workflow-ui.json) |
| 目标与跨任务协作 | 已有 | 保留原目标、任务读取与交接能力；本轮未扩写或重新验收全部编排路径 | [任务协作](../src/lib/task-collaboration.js)、[项目交接](HANDOFF.md) |
| 草稿、置顶、归档、恢复、未读 | 已有 | 保留；本轮验证新队列与草稿、分支和后台聊天的直接关系 | [会话动作](../src/lib/conversation-actions.js)、[存储规则](../electron/conversations.cjs) |
| 动态上下文压缩 | 已有 | 保留既有实现，本轮没有修改压缩算法 | [模型运行时](../electron/agent-runtime.cjs)、[压缩模块](../electron/context-compression.cjs) |
| 云端会话、账号同步及上游专属插件 | 无法确认等价 | 不宣称补齐或100%一致，不能靠本地配置目录推定云端能力 | 本次工具范围及官方文档访问限制 |

队列当前只接收文字。原文件、图片、上下文附件和运行中引导入口均保留。每个会话最多20条（包含正在发送的队列消息），每条最多64000字符；编辑时队列暂停，保存或取消前禁止继续发送。模型配置失效或项目不匹配时保留待发送内容并提示处理。

实际验收使用完整 Windows EXE、隔离 profile/项目和本机回环模型服务，涉及真实 UI、IPC、会话文件和计划执行文件的写入回读。它验证本程序的行为，不证明公网模型质量、上游账号服务或所有原生窗口行为等价。有效结果、失败边界和证据见[测试交接](TEST_HANDOFF.md)。
