export const MAX_QUEUED_MESSAGES = 20;

export function queueText(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 64000 || value.includes('\0')) throw Error('请输入64000字符以内的有效消息。');
  return value.trim();
}

export function createQueuedMessage(text, selection) {
  return { id: crypto.randomUUID(), text: queueText(text), createdAt: new Date().toISOString(),
    mode: selection.mode, modelMode: selection.modelMode, model: selection.model,
    reasoningEffort: selection.reasoningEffort, executionEnabled: selection.executionEnabled === true,
    scopeProjectId: selection.scopeProjectId || '', workspaceRoot: selection.workspaceRoot || '' };
}

export function changeQueuedMessages(queue = [], id, action, value) {
  const index = queue.findIndex(item => item.id === id);
  if (index < 0) throw Error('待发送消息已变化，请重新操作。');
  if (action === 'remove') return queue.filter(item => item.id !== id);
  if (action === 'edit') return queue.map(item => item.id === id ? { ...item, text: queueText(value) } : item);
  if (action !== 'up' && action !== 'down') throw Error('不支持此队列操作。');
  const target = index + (action === 'up' ? -1 : 1);
  if (target < 0 || target >= queue.length) return queue;
  const next = [...queue];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function canImplementPlan(chat, messageId) {
  const messages = chat?.messages || [];
  const index = messages.findIndex(message => message.id === messageId);
  const message = messages[index];
  if (!message || message.role !== 'assistant' || message.pending || message.error || message.cancelled || !message.content?.trim()
    || messages.slice(index + 1).some(item => item.role === 'user' || item.role === 'assistant')) return false;
  const user = messages.slice(0, index).findLast(item => item.role === 'user' && !item.steering);
  return message.mode === 'plan' || user?.mode === 'plan';
}

export const IMPLEMENT_PLAN_PROMPT = '按上面的计划执行。先核对当前项目、已完成结果和最新文件，保留已有修改；在当前授权范围内实施，完成实际验证后报告结果与未完成项。';
