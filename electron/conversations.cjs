const crypto = require('node:crypto');
const { REASONING_EFFORTS } = require('./agent-settings.cjs');
const { normalizeChatImages } = require('./chat-images.cjs');
const { normalizeAttachmentRecords } = require('./chat-attachments.cjs');
const { MAX_VISUALIZATIONS_PER_MESSAGE, normalizeVisualizationHtml, normalizeWidgetState } = require('./visualization-contract.cjs');
const { normalizeCheckpoint } = require('./context-compaction.cjs');

const MODES = ['answer', 'plan', 'code', 'office'];
const validMode = (mode) => MODES.includes(mode) ? mode : 'answer';
const validEffort = (effort) => REASONING_EFFORTS.includes(effort) || ['none', 'minimal'].includes(effort);
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : crypto.randomUUID();
const validProjectId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(id) ? id : '';
const validModel = (model) => typeof model === 'string' && model.trim() && model.trim().length <= 200 && !/[\x00-\x20\x7f]/.test(model) ? model.trim() : '';
const MODEL_MODES = ['main', 'subagent', 'advisor'];
const validModelMode = (mode) => MODEL_MODES.includes(mode) ? mode : 'main';
const normalizeModelSelections = (value) => Object.fromEntries(MODEL_MODES.filter((mode) => validModel(value?.[mode])).map((mode) => [mode, validModel(value[mode])]));

function normalizeOperations(value) {
  const previewIds = new Set((Array.isArray(value) ? value : []).filter((item) => item?.screenshot).slice(-4).map((item) => item.id));
  let visualizationCount = 0;
  return (Array.isArray(value) ? value : []).filter((item) => item && typeof item === 'object' && typeof item.name === 'string').map((item) => {
    const operation = {
      id: validId(item.id), name: item.name.slice(0, 100), title: String(item.title || '').slice(0, 160),
      status: item.status === 'running' ? 'interrupted' : ['succeeded', 'failed', 'cancelled', 'interrupted', 'deferred'].includes(item.status) ? item.status : 'interrupted',
      detail: String(item.detail || ''), path: String(item.path || ''),
      output: String(item.output || ''), diff: String(item.diff || ''),
      startedAt: Number.isFinite(Date.parse(item.startedAt)) ? item.startedAt : '',
      endedAt: Number.isFinite(Date.parse(item.endedAt)) ? item.endedAt : '',
      ...(Number.isInteger(item.exitCode) || item.exitCode === null ? { exitCode: item.exitCode } : {}),
      ...(item.truncated ? { truncated: true } : {}),
      ...(previewIds.has(item.id) && typeof item.screenshot?.dataUrl === 'string' && item.screenshot.dataUrl.length <= 130000 && normalizeChatImages([item.screenshot]).length ? { screenshot: normalizeChatImages([item.screenshot])[0] } : {}),
      ...(Array.isArray(item.plan) ? { plan: item.plan.filter((step) => step && typeof step.text === 'string' && ['pending', 'in_progress', 'completed'].includes(step.status)).map((step) => ({ text: step.text, status: step.status })) } : {}),
    };
    const value = item.visualization;
    const chartOperation = item.name === 'visualize_render' || item.name === 'takeover_visualize_render';
    const html = chartOperation && visualizationCount < MAX_VISUALIZATIONS_PER_MESSAGE ? normalizeVisualizationHtml(value?.html) : null;
    const widgetState = value?.widgetState === undefined ? null : normalizeWidgetState(value.widgetState);
    if (html && widgetState !== undefined) {
      visualizationCount += 1;
      operation.visualization = { id: validId(value.id) === value.id ? value.id : operation.id,
        title: String(value.title || item.detail || '交互图表').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120) || '交互图表', html, widgetState };
    }
    return operation;
  });
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
    id: validId(message.id), role: message.role, content: message.content,
    ...(message.contextAction === true ? { contextAction: true } : {}),
    ...(message.role === 'assistant' && normalizeCheckpoint(message.contextCheckpoint) ? { contextCheckpoint: normalizeCheckpoint(message.contextCheckpoint) } : {}),
    ...(message.role === 'assistant' && message.contextUsage && Number.isFinite(message.contextUsage.sentTokens) ? { contextUsage: {
      sentTokens: Math.max(0, Math.floor(message.contextUsage.sentTokens)),
      capacityTokens: Number.isFinite(message.contextUsage.capacityTokens) && message.contextUsage.capacityTokens > 0 ? Math.floor(message.contextUsage.capacityTokens) : null,
    } } : {}),
    ...(message.role === 'user' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(message.steering?.id || '') && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(message.steering?.requestId || '') ? { steering: {
      id: message.steering.id, requestId: message.steering.requestId,
      status: ['accepted', 'expired', 'failed'].includes(message.steering.status) ? message.steering.status : 'expired',
    } } : {}),
    ...(message.role === 'assistant' && Number.isInteger(message.finalContentOffset) && message.finalContentOffset > 0 && message.finalContentOffset < message.content.length ? { finalContentOffset: message.finalContentOffset } : {}),
    ...(message.executionEnabled === true ? { executionEnabled: true } : {}),
    ...(message.role === 'assistant' && Array.isArray(message.operations) && message.operations.length ? { operations: normalizeOperations(message.operations) } : {}),
    ...(message.role === 'assistant' && /^[0-9a-f-]{36}$/i.test(message.fileChanges?.id || '') ? { fileChanges: { id: message.fileChanges.id } } : {}),
    mode: validMode(message.mode), skillName: String(message.skillName || '').slice(0, 160),
    ...(typeof message.skillId === 'string' && message.skillId.length <= 1024 && !/[\x00-\x1f\x7f]/.test(message.skillId) ? { skillId: message.skillId } : {}),
    contextName: String(message.contextName || '').slice(0, 200),
    ...(images.length ? { images } : {}),
    ...(attachments.length ? { attachments } : {}),
    modelMode: validModelMode(message.modelMode),
    ...(validModel(message.model) ? { model: validModel(message.model) } : {}),
    ...(validEffort(message.reasoningEffort) ? { reasoningEffort: message.reasoningEffort } : {}),
    ...(message.error ? { error: String(message.error) } : {}),
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
    mode: validMode(mode), modelMode: 'main', draft: '', goal: '', pinned: false, archivedAt: null, messages: [],
    ...(validEffort(reasoningEffort) ? { reasoningEffort } : {}),
  };
}

function normalizeQueuedMessages(value, now) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).filter(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || seen.has(item.id)
      || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 64000 || item.text.includes('\0') || !validModel(item.model)) return false;
    seen.add(item.id); return true;
  }).slice(0, 20).map(item => ({ id: item.id, text: item.text.trim(), mode: validMode(item.mode),
    modelMode: validModelMode(item.modelMode), model: validModel(item.model), executionEnabled: item.executionEnabled === true,
    scopeProjectId: validProjectId(item.scopeProjectId), workspaceRoot: typeof item.workspaceRoot === 'string' && item.workspaceRoot.length <= 32768 && !item.workspaceRoot.includes('\0') ? item.workspaceRoot : '',
    createdAt: Number.isFinite(Date.parse(item.createdAt)) ? item.createdAt : now,
    ...(validEffort(item.reasoningEffort) ? { reasoningEffort: item.reasoningEffort } : {}) }));
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
    const queuedMessages = normalizeQueuedMessages(entry.queuedMessages, now);
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
      mode: validMode(entry.mode), draft: String(entry.draft || ''),
      ...(queuedMessages.length ? { queuedMessages, queuePaused: true } : {}),
      ...(entry.executionEnabled === true ? { executionEnabled: true } : {}),
      goal: typeof entry.goal === 'string' ? entry.goal : '',
      ...(entry.goalRun && typeof entry.goalRun === 'object' ? { goalRun: { status: ['completed','blocked','paused'].includes(entry.goalRun.status) ? entry.goalRun.status : 'paused', rounds: Math.max(0, Math.floor(Number(entry.goalRun.rounds) || 0)), summary: String(entry.goalRun.summary || '') } } : {}),
      ...(validEffort(entry.reasoningEffort) ? { reasoningEffort: entry.reasoningEffort } : {}),
      modelMode: validModelMode(entry.modelMode),
      ...(entry.modelSelections && typeof entry.modelSelections === 'object' ? { modelSelections: normalizeModelSelections(entry.modelSelections) } : {}),
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
