import { truncateUtf8 } from './text.js';
export function newChatRecord(projectId = '', mode = 'answer', now = new Date().toISOString()) {
  return { id: crypto.randomUUID(), title: '新对话', projectId, mode, draft: '', pinned: false, unreadResult: false, archivedAt: null, createdAt: now, updatedAt: now, messages: [] };
}

export function forkChatRecord(source, projectId = source.projectId || '', now = new Date().toISOString()) {
  const next = { ...structuredClone(source), id: crypto.randomUUID(), title: (source.title + ' · 分叉').slice(0, 100), projectId,
    parentId: source.id, createdAt: now, updatedAt: now, pinned: false, unreadResult: false, archivedAt: null };
  const messageIds = new Map();
  const cloneMessages = values => values.map(m => {
    if (!messageIds.has(m.id)) messageIds.set(m.id, next.id + '-m-' + messageIds.size);
    return ({ ...m, id: messageIds.get(m.id), fileChanges: undefined, pending: false, approval: null,
    ...(m.pending ? { cancelled: true, phase: '' } : {}),
    ...(m.operations ? { operations: m.operations.map(o => o.status === 'running' ? { ...o, status: 'interrupted' } : o) } : {}) }); });
  next.messages = cloneMessages(next.messages);
  if (next.revisions) next.revisions = next.revisions.map(v => ({ ...v, messages: cloneMessages(v.messages) }));
  const remapOrigin = origin => origin && ({ ...origin,
    sourceMessageId: messageIds.get(origin.sourceMessageId) || origin.sourceMessageId,
    sourceUserMessageId: messageIds.get(origin.sourceUserMessageId) || origin.sourceUserMessageId,
  });
  if (next.revisionOrigin) next.revisionOrigin = remapOrigin(next.revisionOrigin);
  if (next.revisions) next.revisions = next.revisions.map(version => version.revisionOrigin ? { ...version, revisionOrigin: remapOrigin(version.revisionOrigin) } : version);
  return next;
}

// Create a new chat from one completed assistant answer. The copied history is
// display-only: any live request/approval state is cleared and no operation is
// replayed in the new chat.
export function forkChatAtMessage(source, messageId, projectId = source.projectId || '', now = new Date().toISOString()) {
  const index = (source.messages || []).findIndex((message) => message.id === messageId);
  if (index < 0 || source.messages[index]?.role !== 'assistant') throw Error('请选择一条回答消息。');
  const next = { ...structuredClone(source), id: crypto.randomUUID(), title: (source.title + ' · 从回答分支').slice(0, 100), projectId,
    parentId: source.id, createdAt: now, updatedAt: now, pinned: false, unreadResult: false, archivedAt: null,
    revisionId: undefined, revisionLabel: undefined, revisionCreatedAt: undefined, revisions: undefined };
  const messageIds = new Map();
  next.messages = source.messages.slice(0, index + 1).map((message) => {
    const id = next.id + '-m-' + messageIds.size;
    messageIds.set(message.id, id);
    return { ...structuredClone(message), id, fileChanges: undefined, pending: false, approval: null,
      ...(message.pending ? { cancelled: true, phase: '' } : {}),
      ...(message.operations ? { operations: message.operations.map((operation) => operation.status === 'running' ? { ...operation, status: 'interrupted' } : operation) } : {}) };
  });
  return next;
}

export function applyConversationAction(library, action, { runningIds = [], projects = [], activeProjectId = '' } = {}) {
  const source = library?.conversations.find(c => c.id === action.id);
  if (!source) throw Error('聊天已变化，请重新打开菜单。');
  const structural = ['move', 'archive', 'delete'].includes(action.type);
  if (structural && runningIds.includes(source.id)) throw Error('此聊天仍在运行，请先停止对应任务。');
  const now = new Date().toISOString();
  let conversations = library.conversations, created;
  const patch = fields => { conversations = conversations.map(c => c.id === source.id ? { ...c, ...fields, updatedAt: now } : c); };
  if (action.type === 'rename') {
    const title = String(action.value || '').replace(/[\r\n\u0000-\u001f]+/g, ' ').trim().slice(0, 100);
    if (!title) throw Error('请输入聊天名称。'); patch({ title });
  } else if (action.type === 'pin') patch({ pinned: !source.pinned });
  else if (action.type === 'unread') patch({ unreadResult: !source.unreadResult });
  else if (['move', 'fork'].includes(action.type)) {
    const projectId = action.value || '';
    if (projectId && !projects.some(p => p.id === projectId && !p.archivedAt)) throw Error('目标项目不可用。');
    if (action.type === 'move') patch({ projectId });
    else { created = forkChatRecord(source, projectId, now); conversations = [created, ...conversations]; }
  } else if (action.type === 'archive') patch({ archivedAt: now });
  else if (action.type === 'restore') patch({ archivedAt: null });
  else if (action.type === 'delete') conversations = conversations.filter(c => c.id !== source.id);
  else throw Error('不支持此聊天操作。');
  let activeId = library.activeId;
  const active = conversations.find(c => c.id === activeId);
  if (!active || active.archivedAt || action.type === 'move' && activeId === source.id && action.value !== activeProjectId) {
    let fallback = conversations.find(c => !c.archivedAt && (!c.projectId || c.projectId === activeProjectId));
    if (!fallback) { fallback = newChatRecord(activeProjectId); conversations = [fallback, ...conversations]; }
    activeId = fallback.id;
  }
  if (created && (!created.projectId || created.projectId === activeProjectId)) activeId = created.id;
  return { library: { ...library, activeId, conversations }, created };
}

export function conversationText(chat, project, plain = false) {
  const lines = [plain ? chat.title : '# ' + chat.title, '', '项目：' + (project?.name || '未分组'), '聊天标识：' + chat.id,
    ...(chat.parentId ? ['分叉来源：' + chat.parentId] : []), ''];
  for (const m of chat.messages || []) {
    lines.push(plain ? (m.role === 'user' ? '用户' : '助手') + '：' : '## ' + (m.role === 'user' ? '用户' : '助手'), '', m.content || '');
    if (m.attachments?.length) lines.push('', '附件：' + m.attachments.map(a => a.name).join('、'));
    if (m.images?.length) lines.push('', '图片：' + m.images.map(i => i.name).join('、'));
    if (m.operations?.length) lines.push('', '操作记录：', ...m.operations.map(o => '- ' + [o.title || o.name, o.status, o.detail || ''].join(' · ')));
    if (m.error) lines.push('', '错误：' + m.error);
    if (m.cancelled) lines.push('', '此回复已停止。');
    lines.push('');
  }
  return truncateUtf8(lines.join('\n'), 4 * 1024 * 1024);
}
