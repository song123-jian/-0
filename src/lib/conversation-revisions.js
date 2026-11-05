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
export function compareRevisionText(currentMessages = [], versionMessages = []) {
  const differences = [];
  const count = Math.max(currentMessages.length, versionMessages.length);
  for (let index = 0; index < count; index++) {
    const current = currentMessages[index] || null;
    const version = versionMessages[index] || null;
    const currentText = typeof current?.content === 'string' ? current.content : '';
    const versionText = typeof version?.content === 'string' ? version.content : '';
    if (currentText === versionText) continue;
    differences.push({ index, role: current?.role || version?.role || 'assistant', currentText, versionText });
  }
  return differences;
}
export function assertRevisionIdle(chat) {
  if (!chat || chat.archivedAt) throw Error('请先恢复此聊天。');
  if (chat.messages.some(m => m.pending || m.approval || m.operations?.some(o => o.status === 'running'))) throw Error('请先停止此聊天任务，再编辑或切换版本。');
}
export function revisionSource(chat, type, messageId) {
  const at = chat.messages.findIndex(m => m.id === messageId);
  if (at < 0 || !['edit', 'regenerate', 'retry'].includes(type)) throw Error('原消息已变化，请重新打开。');
  const index = type === 'regenerate' ? at - 1 : at;
  const user = chat.messages[index];
  if (!user || user.role !== 'user' || (type === 'regenerate' && chat.messages[at].role !== 'assistant')) throw Error('找不到对应的用户消息。');
  return { index, user };
}
function snapshot(chat) {
  return { id: revisionId(chat), label: label(chat.revisionLabel), createdAt: chat.revisionCreatedAt || chat.createdAt,
    messages: structuredClone(chat.messages), ...(chat.revisionOrigin ? { revisionOrigin: structuredClone(chat.revisionOrigin) } : {}) };
}
export function prepareRevision(chat, action, now = new Date().toISOString()) {
  assertRevisionIdle(chat);
  if (action.stamp !== revisionStamp(chat)) throw Error('对话版本已变化，请关闭后重新编辑。');
  const { index, user } = revisionSource(chat, action.kind, action.messageId);
  const retry = action.kind === 'retry';
  const text = action.kind === 'edit' ? action.text : user.content;
  if (typeof text !== 'string' || text.length > 64000 || text.includes('\0') || (!text.trim() && !user.images?.length && !user.attachments?.length)) throw Error('请输入64000字符以内的有效消息。');
  if (retry && chat.messages.slice(index + 1).some(message => message.role === 'user') && action.discardFollowing !== true) throw Error('重试较早的消息会移除后续对话，请先确认。');
  if (retry && chat.messages.slice(index + 1).some(message => message.fileChanges || message.operations?.some(operation => operation.status === 'succeeded')) && action.discardEffects !== true) throw Error('重试会移除原回答的操作记录和撤销入口，请先确认。');
  const revisions = chat.revisions || [];
  if (!retry && revisions.length >= MAX_CONVERSATION_VERSIONS - 1) throw Error('此聊天已达到20个版本，请导出需要的内容并新建聊天后继续；已有版本保持。');
  const next = retry ? { ...chat, revisionOrigin: undefined, messages: structuredClone(chat.messages.slice(0, index)) }
    : { ...chat, revisionId: crypto.randomUUID(), revisionLabel: label((action.kind === 'edit' ? '编辑：' : '重新生成：') + (text || user.attachments?.[0]?.name || '图片消息')),
    revisionCreatedAt: now, revisionOrigin: { kind: action.kind, parentId: revisionId(chat), sourceMessageId: action.messageId, sourceUserMessageId: user.id },
    revisions: [...revisions, snapshot(chat)], messages: structuredClone(chat.messages.slice(0, index)) };
  return { chat: next, user: { ...structuredClone(user), content: text.trim(), executionEnabled: !retry && action.executionEnabled === true } };
}
export function selectRevision(chat, id, stamp, now = new Date().toISOString()) {
  assertRevisionIdle(chat);
  if (stamp !== revisionStamp(chat)) throw Error('对话版本已变化，请刷新后选择。');
  if (id === revisionId(chat)) return chat;
  const selected = chat.revisions?.find(v => v.id === id);
  if (!selected) throw Error('此版本已不存在。');
  return { ...chat, revisionId: selected.id, revisionLabel: selected.label, revisionCreatedAt: selected.createdAt,
    revisionOrigin: selected.revisionOrigin ? structuredClone(selected.revisionOrigin) : undefined,
    messages: structuredClone(selected.messages), revisions: [...chat.revisions.filter(v => v.id !== id), snapshot(chat)], updatedAt: now };
}

function sameRecordFields(left, right, fields) {
  const first = left == null ? [] : left, second = right == null ? [] : right;
  if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) return false;
  return first.every((item, index) => item && second[index] && fields.every(field => item[field] === second[index][field]));
}

function sameRegenerationInput(left, right) {
  if (left?.role !== 'user' || right?.role !== 'user' || left.content !== right.content
    || (left.mode || 'answer') !== (right.mode || 'answer')) return false;
  return sameRecordFields(left.images, right.images, ['name', 'mimeType', 'dataUrl'])
    && sameRecordFields(left.attachments, right.attachments, ['name', 'mimeType', 'size', 'parsed', 'text', 'truncated', 'format', 'parseStatus', 'parseMessage']);
}

export function discardFailedRegeneration(chat, assistantMessageId, now = new Date().toISOString()) {
  assertRevisionIdle(chat);
  let origin = chat.revisionOrigin;
  if (!origin && chat.revisionLabel?.startsWith('重新生成：')) {
    const failedIndex = chat.messages.findIndex(message => message.id === assistantMessageId);
    const activeUser = chat.messages[failedIndex - 1];
    const candidates = (chat.revisions || []).filter(version => version.messages[failedIndex]?.role === 'assistant'
      && sameRegenerationInput(version.messages[failedIndex - 1], activeUser));
    if (candidates.length === 1) {
      const parent = candidates[0], source = parent.messages[failedIndex];
      origin = { kind: 'regenerate', parentId: parent.id, sourceMessageId: source.id, sourceUserMessageId: parent.messages[failedIndex - 1].id };
    }
  }
  if (origin?.kind !== 'regenerate') return null;
  const parent = chat.revisions?.find(version => version.id === origin.parentId);
  if (!parent) return null;
  const sourceIndex = parent.messages.findIndex(message => message.id === origin.sourceMessageId);
  const failedIndex = chat.messages.findIndex(message => message.id === assistantMessageId);
  const failed = chat.messages[failedIndex];
  if (sourceIndex < 1 || parent.messages[sourceIndex].role !== 'assistant' || parent.messages[sourceIndex - 1]?.role !== 'user'
    || parent.messages[sourceIndex - 1].id !== origin.sourceUserMessageId
    || failedIndex !== sourceIndex || failed?.role !== 'assistant' || (!failed.error && !failed.cancelled)
    || !sameRegenerationInput(chat.messages[failedIndex - 1], parent.messages[sourceIndex - 1])) return null;
  return {
    sourceMessageId: origin.sourceMessageId,
    chat: { ...chat, revisionId: parent.id, revisionLabel: label(parent.label), revisionCreatedAt: parent.createdAt,
      revisionOrigin: parent.revisionOrigin ? structuredClone(parent.revisionOrigin) : undefined,
      revisions: chat.revisions.filter(version => version.id !== parent.id), messages: structuredClone(parent.messages), updatedAt: now },
  };
}
