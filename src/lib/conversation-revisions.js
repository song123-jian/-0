export const MAX_CONVERSATION_VERSIONS = 20;
export const revisionId = chat => chat.revisionId || 'initial';
export const revisionStamp = chat => JSON.stringify([revisionId(chat), chat.messages.map(m => m.id)]);
const label = value => String(value || '初始版本').replace(/[\r\n\x00-\x1f]+/g, ' ').slice(0, 100);
export function revisionOptionLabel(value) {
  const text = label(value);
  if (text.startsWith('编辑：')) return '编辑消息';
  if (text.startsWith('重新生成：')) return '重新生成';
  return text;
}
export function assertRevisionIdle(chat) {
  if (!chat || chat.archivedAt) throw Error('请先恢复此聊天。');
  if (chat.messages.some(m => m.pending || m.approval || m.operations?.some(o => o.status === 'running'))) throw Error('请先停止此聊天任务，再编辑或切换版本。');
}
export function revisionSource(chat, type, messageId) {
  const at = chat.messages.findIndex(m => m.id === messageId);
  if (at < 0 || !['edit', 'regenerate'].includes(type)) throw Error('原消息已变化，请重新打开。');
  const index = type === 'edit' ? at : at - 1;
  const user = chat.messages[index];
  if (!user || user.role !== 'user' || (type === 'regenerate' && chat.messages[at].role !== 'assistant')) throw Error('找不到对应的用户消息。');
  return { index, user };
}
function snapshot(chat) {
  return { id: revisionId(chat), label: label(chat.revisionLabel), createdAt: chat.revisionCreatedAt || chat.createdAt,
    messages: structuredClone(chat.messages) };
}
export function prepareRevision(chat, action, now = new Date().toISOString()) {
  assertRevisionIdle(chat);
  if (action.stamp !== revisionStamp(chat)) throw Error('对话版本已变化，请关闭后重新编辑。');
  const { index, user } = revisionSource(chat, action.kind, action.messageId);
  const text = action.kind === 'edit' ? action.text : user.content;
  if (typeof text !== 'string' || text.length > 64000 || text.includes('\0') || (!text.trim() && !user.images?.length && !user.attachments?.length)) throw Error('请输入64000字符以内的有效消息。');
  const revisions = chat.revisions || [];
  if (revisions.length >= MAX_CONVERSATION_VERSIONS - 1) throw Error('此聊天已达到20个版本，请导出需要的内容并新建聊天后继续；已有版本保持。');
  const next = { ...chat, revisionId: crypto.randomUUID(), revisionLabel: label((action.kind === 'edit' ? '编辑：' : '重新生成：') + (text || user.attachments?.[0]?.name || '图片消息')),
    revisionCreatedAt: now, revisions: [...revisions, snapshot(chat)], messages: structuredClone(chat.messages.slice(0, index)) };
  return { chat: next, user: { ...structuredClone(user), content: text.trim(), executionEnabled: action.executionEnabled === true } };
}
export function selectRevision(chat, id, stamp, now = new Date().toISOString()) {
  assertRevisionIdle(chat);
  if (stamp !== revisionStamp(chat)) throw Error('对话版本已变化，请刷新后选择。');
  if (id === revisionId(chat)) return chat;
  const selected = chat.revisions?.find(v => v.id === id);
  if (!selected) throw Error('此版本已不存在。');
  return { ...chat, revisionId: selected.id, revisionLabel: selected.label, revisionCreatedAt: selected.createdAt,
    messages: structuredClone(selected.messages), revisions: [...chat.revisions.filter(v => v.id !== id), snapshot(chat)], updatedAt: now };
}
