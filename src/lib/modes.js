export const WORK_MODES = [
  { id: 'answer', label: '问答', title: '想清楚，再开始', description: '解答问题、解释概念、整理信息', placeholder: '提问、解释，或把想法交给我整理…', example: '帮我梳理这个问题的关键点、可行选择和需要确认的信息。' },
  { id: 'plan', label: '规划', title: '把目标变成行动', description: '拆解任务、设计方案、明确验收', placeholder: '描述目标、约束和期望交付物…', example: '请把我的目标拆解为可执行计划，列出步骤、依赖、交付物和验收标准。' },
  { id: 'code', label: '编程', title: '让想法成为代码', description: '启用执行任务后，读取项目、修改文件并运行验证', placeholder: '描述要创建或修改的程序，可附加当前文件…', example: '帮我创建一个可以运行的程序，提供完整代码、文件名、运行方法和验证步骤。' },
  { id: 'office', label: '办公', title: '让日常工作更轻松', description: '起草文案、整理材料、分析表格', placeholder: '起草内容、整理材料，或附加当前表格…', example: '请帮我整理一份结构清晰的工作报告，先列出需要的事实材料，再给出可直接填写的正文。' },
];
export const workMode = (id) => WORK_MODES.find((mode) => mode.id === id) || WORK_MODES[0];
