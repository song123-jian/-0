const MODE_INSTRUCTIONS = {
  answer: '当前为问答模式：先直接回答问题，再按需补充依据、示例和不确定性。不要编造实时查询结果。',
  plan: '当前为规划模式：先明确目标与必要假设，分解有顺序的执行步骤，列出交付物、验收标准、依赖和风险。仅提供计划，不宣称已执行或保存。',
  code: '当前为编程模式：根据用户意图解释代码或实际完成开发。用户要求实施时使用已开放的工具检查、修改和验证；仅解释时直接回答。没有工具结果不能宣称已经运行、测试或写入文件。',
  office: '当前为办公模式：针对文案、表格或材料给出可直接使用的结果。尊重原始数据，区分事实与推断；涉及表格时说明字段、公式和必要校验，不编造数据或计算结果。',
};
const { normalizeChatImages, modelMessageContent } = require('./chat-images.cjs');
const { chatAttachmentContext } = require('./chat-attachments.cjs');

function modeInstruction(mode) {
  return MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.answer;
}

function safeHistory(messages) {
  return (Array.isArray(messages) ? messages : []).filter((item) => ['user', 'assistant'].includes(item?.role) && typeof item.content === 'string')
    .map((item) => {
      const operations = item.role === 'assistant' && Array.isArray(item.operations) ? item.operations.map((operation) => [
        operation.name, operation.status, operation.detail || '', operation.path || '', operation.output || '', operation.diff || '',
      ].join(' · ')).join('\n') : '';
      const error = item.role === 'assistant' && item.error ? '[实际错误证据]\n' + item.error : '';
      const attachment = item.role === 'user' ? chatAttachmentContext(item.attachments) : '';
      return { role: item.role, content: modelMessageContent([item.content, error, operations ? '[本机实际操作记录]\n' + operations : '', attachment].filter(Boolean).join('\n\n'), item.role === 'user' ? normalizeChatImages(item.images) : []) };
    });
}

function goalInstruction(value) {
  const goal = typeof value === 'string' ? value.trim() : '';
  return goal ? `用户设定的本次对话目标：\n${goal}\n每次回答围绕此目标展开，不宣称在后台持续执行任务。` : '';
}

function requestToolsEnabled(payload = {}, preferences = {}) {
  if (preferences.contextAccess === 'chat-only' || ['scheduled', 'subagent'].includes(payload.requestKind)) return false;
  if (['revision', 'collaboration'].includes(payload.requestKind)) return payload.executionEnabled === true;
  return true;
}

module.exports = { modeInstruction, safeHistory, goalInstruction, requestToolsEnabled };
