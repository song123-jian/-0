// Optimistic concurrency token, not an authentication credential.
export function taskStamp(chat) {
  const value = JSON.stringify([chat.id, chat.title, chat.projectId, chat.archivedAt, chat.draft,
    chat.executionEnabled, chat.model, chat.reasoningEffort, chat.mode, chat.revisionId, chat.updatedAt,
    (chat.messages || []).map(m => [m.id, m.content, m.pending, m.error, m.cancelled])]);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ value.charCodeAt(i); }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

function summary(chat, projects, runningIds) {
  const project = projects.find(p => p.id === chat.projectId);
  const last = (chat.messages || []).findLast(m => m.role === 'assistant');
  const running = runningIds.includes(chat.id);
  return { id: chat.id, title: chat.title, projectId: chat.projectId, projectName: project?.name || (chat.projectId ? '项目不可用' : '未绑定项目'),
    archived: Boolean(chat.archivedAt || project?.archivedAt), available: Boolean(project && !project.archivedAt && !chat.archivedAt),
    running, hasDraft: Boolean(chat.draft), executionEnabled: chat.executionEnabled === true,
    status: running ? 'running' : last?.error ? 'error' : last?.cancelled ? 'cancelled' : last ? 'completed' : 'idle', updatedAt: chat.updatedAt };
}

export function listTasks(library, projects, runningIds, { sourceId = '', query = '', limit = 50, includeArchived = false } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  const tasks = (library?.conversations || []).filter(c => c.id !== sourceId).map(c => summary(c, projects, runningIds))
    .filter(c => (includeArchived || !c.archived) && (!needle || `${c.title} ${c.projectName} ${c.id}`.toLocaleLowerCase().includes(needle)))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return { tasks: tasks.slice(0, limit), total: tasks.length, truncated: tasks.length > limit };
}

export function readTask(library, projects, runningIds, { conversationId, limit = 20, before = '' }) {
  const chat = library?.conversations.find(c => c.id === conversationId);
  if (!chat) throw Error('目标任务已不存在。');
  const all = (chat.messages || []).filter(m => ['user', 'assistant'].includes(m.role));
  const end = before ? all.findIndex(m => m.id === before) : all.length;
  if (end < 0) throw Error('消息位置已变化，请重新读取目标任务。');
  const selected = all.slice(Math.max(0, end - limit), end);
  let budget = 24000;
  const messages = [];
  for (const m of [...selected].reverse()) {
    const content = String(m.content || '').slice(0, Math.min(8000, budget)); budget -= content.length;
    messages.unshift({ id: m.id, role: m.role, content, pending: Boolean(m.pending), error: String(m.error || '').slice(0, 1000),
      cancelled: Boolean(m.cancelled), truncated: content.length < String(m.content || '').length,
      attachmentCount: (m.attachments?.length || 0) + (m.images?.length || 0) });
  }
  return { ...summary(chat, projects, runningIds), stamp: taskStamp(chat), messages,
    nextBefore: end > selected.length ? selected[0]?.id || '' : '',
    textOnly: true, note: '仅包含有界消息文本；附件、图片及工具完整输出未展开。' };
}

export function prepareTaskHandoff(library, projects, runningIds, input) {
  const { sourceId, conversationId, text, expectedStamp, executionEnabled = false } = input;
  const source = library?.conversations.find(c => c.id === sourceId);
  if (!source || source.archivedAt || source.projectId && !summary(source, projects, runningIds).available) throw Error('来源任务或项目不可用。');
  if (sourceId === conversationId) throw Error('请选择其他任务接收交接。');
  const target = library.conversations.find(c => c.id === conversationId);
  if (target && !target.projectId) throw Error('目标未绑定项目，请先通过聊天菜单选择项目。');
  if (!target || !summary(target, projects, runningIds).available) throw Error('目标任务或项目已归档或不可用。');
  if (taskStamp(target) !== expectedStamp) throw Error('目标任务已变化，请重新读取并确认后发送。');
  if (typeof text !== 'string' || !text.trim() || text.length > 16000) throw Error('交接内容须为1至16000个字符。');
  if (runningIds.includes(target.id)) throw Error('目标任务仍在运行，请等待结束。');
  if (target.draft) throw Error('目标任务有未发送草稿，请先处理草稿。');
  if (runningIds.length >= 3) throw Error('最多同时运行3个聊天任务，请等待其中一项结束。');
  return { target, prompt: `【任务交接】来自“${source.title}”（${source.id}）\n以下是用户确认发送的交接内容；仍须遵守目标任务现有权限与审批。\n\n${text.trim()}` };
}
