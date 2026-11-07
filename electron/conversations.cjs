const crypto = require('node:crypto');
const { REASONING_EFFORTS } = require('./agent-settings.cjs');
const { normalizeChatImages } = require('./chat-images.cjs');
const { normalizeAttachmentRecords } = require('./chat-attachments.cjs');

const MODES = ['answer', 'plan', 'code', 'office'];
const validMode = (mode) => MODES.includes(mode) ? mode : 'answer';
const validEffort = (effort) => REASONING_EFFORTS.includes(effort) || ['none', 'minimal'].includes(effort);
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : crypto.randomUUID();
const validProjectId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(id) ? id : '';
const validModel = (model) => typeof model === 'string' && model.trim() && model.trim().length <= 200 && !/[\x00-\x20\x7f]/.test(model) ? model.trim() : '';

function normalizeOperations(value) {
  const previewIds = new Set((Array.isArray(value) ? value : []).filter((item) => item?.screenshot).slice(-4).map((item) => item.id));
  return (Array.isArray(value) ? value : []).slice(0, 64).filter((item) => item && typeof item === 'object' && typeof item.name === 'string').map((item) => ({
    id: validId(item.id), name: item.name.slice(0, 100), title: String(item.title || '').slice(0, 160),
    status: item.status === 'running' ? 'interrupted' : ['succeeded', 'failed', 'cancelled', 'interrupted', 'deferred'].includes(item.status) ? item.status : 'interrupted',
    detail: String(item.detail || '').slice(0, 16000), path: String(item.path || '').slice(0, 4096),
    output: String(item.output || '').slice(-24000), diff: String(item.diff || '').slice(0, 24500),
    startedAt: Number.isFinite(Date.parse(item.startedAt)) ? item.startedAt : '',
    endedAt: Number.isFinite(Date.parse(item.endedAt)) ? item.endedAt : '',
    ...(Number.isInteger(item.exitCode) || item.exitCode === null ? { exitCode: item.exitCode } : {}),
    ...(item.truncated ? { truncated: true } : {}),
    ...(previewIds.has(item.id) && typeof item.screenshot?.dataUrl === 'string' && item.screenshot.dataUrl.length <= 130000 && normalizeChatImages([item.screenshot]).length ? { screenshot: normalizeChatImages([item.screenshot])[0] } : {}),
    ...(Array.isArray(item.plan) ? { plan: item.plan.slice(0, 12).filter((step) => step && typeof step.text === 'string' && ['pending', 'in_progress', 'completed'].includes(step.status)).map((step) => ({ text: step.text.slice(0, 300), status: step.status })) } : {}),
  }));
}

function normalizeElapsed(message) {
  const value = message.pending && Number.isFinite(message.startedAt) ? Math.max(0, Date.now() - message.startedAt) : message.elapsedMs;
  return Number.isFinite(value) && value >= 0 ? Math.min(604800000, Math.floor(value)) : null;
}

function normalizeMessage(message) {
  if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return null;
  const images = normalizeChatImages(message.images);
  const elapsed = normalizeElapsed(message);
  let attachments = [];
  try { attachments = normalizeAttachmentRecords(message.attachments); } catch { /* Keep the message if an old attachment is invalid. */ }
  return {
    id: validId(message.id), role: message.role, content: message.content.slice(0, 64_000),
    ...(message.role === 'user' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(message.steering?.id || '') && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(message.steering?.requestId || '') ? { steering: {
      id: message.steering.id, requestId: message.steering.requestId,
      status: ['accepted', 'expired', 'failed'].includes(message.steering.status) ? message.steering.status : 'expired',
    } } : {}),
    ...(message.role === 'assistant' && Number.isInteger(message.finalContentOffset) && message.finalContentOffset > 0 && message.finalContentOffset < Math.min(message.content.length, 64_000) ? { finalContentOffset: message.finalContentOffset } : {}),
    ...(message.executionEnabled === true ? { executionEnabled: true } : {}),
    ...(message.role === 'assistant' && Array.isArray(message.operations) && message.operations.length ? { operations: normalizeOperations(message.operations) } : {}),
    ...(message.role === 'assistant' && /^[0-9a-f-]{36}$/i.test(message.fileChanges?.id || '') ? { fileChanges: { id: message.fileChanges.id } } : {}),
    mode: validMode(message.mode), skillName: String(message.skillName || '').slice(0, 160),
    ...(typeof message.skillId === 'string' && message.skillId.length <= 1024 && !/[\x00-\x1f\x7f]/.test(message.skillId) ? { skillId: message.skillId } : {}),
    contextName: String(message.contextName || '').slice(0, 200),
    ...(images.length ? { images } : {}),
    ...(attachments.length ? { attachments } : {}),
    ...(validModel(message.model) ? { model: validModel(message.model) } : {}),
    ...(validEffort(message.reasoningEffort) ? { reasoningEffort: message.reasoningEffort } : {}),
    ...(message.error ? { error: String(message.error).slice(0, 600) } : {}),
    ...(message.cancelled || message.pending ? { cancelled: true } : {}),
    ...(message.role === 'assistant' && elapsed !== null ? { elapsedMs: elapsed } : {}),
    ...(Number.isFinite(message.stoppedAfter) ? { stoppedAfter: Math.max(0, Math.min(3600, Math.floor(message.stoppedAfter))) } : {}),
  };
}

function normalizeRevisionOrigin(value) {
  if (!value || !['edit', 'regenerate'].includes(value.kind)) return null;
  const parentId = validProjectId(value.parentId), sourceMessageId = validProjectId(value.sourceMessageId), sourceUserMessageId = validProjectId(value.sourceUserMessageId);
  return parentId && sourceMessageId && sourceUserMessageId ? { kind: value.kind, parentId, sourceMessageId, sourceUserMessageId } : null;
}

function createConversation(mode = 'answer', now = new Date().toISOString(), reasoningEffort) {
  return {
    id: crypto.randomUUID(), title: '新对话', createdAt: now, updatedAt: now,
    mode: validMode(mode), draft: '', goal: '', pinned: false, archivedAt: null, messages: [],
    ...(validEffort(reasoningEffort) ? { reasoningEffort } : {}),
  };
}

function normalizeLibrary(value, now = new Date().toISOString()) {
  const legacy = Array.isArray(value);
  const input = legacy ? [{ ...createConversation('answer', now), title: '导入的历史对话', messages: value }] : value?.conversations;
  const seen = new Set();
  const conversations = (Array.isArray(input) ? input : []).filter((entry) => entry && typeof entry === 'object').map((entry) => {
    let id = validId(entry.id);
    if (seen.has(id)) id = crypto.randomUUID();
    seen.add(id);
    const messages = (Array.isArray(entry.messages) ? entry.messages : []).map(normalizeMessage).filter(Boolean);
    const revisionId = validProjectId(entry.revisionId) || "initial", versionIds = new Set([revisionId]);
    const revisionOrigin = normalizeRevisionOrigin(entry.revisionOrigin);
    const revisions = (Array.isArray(entry.revisions) ? entry.revisions : []).slice(0, 19).filter(item => {
      if (!item || !validProjectId(item.id) || versionIds.has(item.id)) return false; versionIds.add(item.id); return true;
    }).map(item => {
      const origin = normalizeRevisionOrigin(item.revisionOrigin);
      return { id: item.id, label: String(item.label || "历史版本").replace(/[\r\n\x00-\x1f]+/g, " ").slice(0, 100),
        createdAt: Number.isFinite(Date.parse(item.createdAt)) ? item.createdAt : now,
        messages: (Array.isArray(item.messages) ? item.messages : []).map(normalizeMessage).filter(Boolean), ...(origin ? { revisionOrigin: origin } : {}) };
    });
    return {
      id, title: String(entry.title || messages.find((item) => item.role === 'user')?.content || '新对话').replace(/[\r\n]+/g, ' ').slice(0, 100),
      createdAt: Number.isFinite(Date.parse(entry.createdAt)) ? entry.createdAt : now,
      updatedAt: Number.isFinite(Date.parse(entry.updatedAt)) ? entry.updatedAt : now,
      mode: validMode(entry.mode), draft: String(entry.draft || '').slice(0, 64_000),
      ...(entry.executionEnabled === true ? { executionEnabled: true } : {}),
      goal: typeof entry.goal === 'string' ? entry.goal.slice(0, 2000) : '',
      ...(entry.goalRun && typeof entry.goalRun === 'object' ? { goalRun: { status: ['completed','blocked','paused'].includes(entry.goalRun.status) ? entry.goalRun.status : 'paused', rounds: Math.max(0, Math.floor(Number(entry.goalRun.rounds) || 0)), summary: String(entry.goalRun.summary || '').slice(0, 4000) } } : {}),
      ...(validEffort(entry.reasoningEffort) ? { reasoningEffort: entry.reasoningEffort } : {}),
      ...(validModel(entry.model) ? { model: validModel(entry.model) } : {}),
      ...(validProjectId(entry.projectId) ? { projectId: entry.projectId } : {}),
      ...(validProjectId(entry.parentId) && entry.parentId !== id ? { parentId: entry.parentId } : {}),
      pinned: Boolean(entry.pinned), unreadResult: entry.unreadResult === true, messages,
      ...(entry.revisionId || revisions.length ? { revisionId, revisionLabel: String(entry.revisionLabel || '初始版本').replace(/[\r\n\x00-\x1f]+/g, ' ').slice(0, 100),
        revisionCreatedAt: Number.isFinite(Date.parse(entry.revisionCreatedAt)) ? entry.revisionCreatedAt : now, revisions, ...(revisionOrigin ? { revisionOrigin } : {}) } : {}),
      archivedAt: Number.isFinite(Date.parse(entry.archivedAt)) ? entry.archivedAt : null,
    };
  });
  if (!conversations.some((entry) => !entry.archivedAt)) conversations.unshift(createConversation('answer', now));
  return { version: 2, activeId: conversations.some((entry) => entry.id === value?.activeId && !entry.archivedAt) ? value.activeId : conversations.find((entry) => !entry.archivedAt).id, conversations };
}

module.exports = { createConversation, normalizeLibrary, normalizeOperations, validMode };
