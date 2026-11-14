const crypto = require('node:crypto');

const MODES = ['main', 'subagent', 'advisor'];
const LABELS = { main: '模式一', subagent: '模式二', advisor: '模式三' };
function normalizeAutoHandoff(input = {}) {
  if (input.autoHandoffEnabled !== undefined && typeof input.autoHandoffEnabled !== 'boolean') throw Error('自动接力开关无效。');
  const levels = input.modelCapabilityLevels ?? {};
  if (!levels || typeof levels !== 'object' || Array.isArray(levels)) throw Error('模型能力等级无效。');
  const modelCapabilityLevels = {};
  for (const mode of MODES) {
    const level = levels[mode] ?? 0;
    if (!Number.isInteger(level) || level < 0 || level > 3) throw Error('模型能力等级须为未分级或1至3级。');
    modelCapabilityLevels[mode] = level;
  }
  return { autoHandoffEnabled: input.autoHandoffEnabled === true, modelCapabilityLevels };
}
const identity = candidate => candidate.endpoint + '\0' + candidate.model;
function configuredModels(config) {
  return MODES.flatMap(mode => {
    const prefix = mode === 'main' ? '' : mode;
    const model = config[prefix ? prefix + 'Model' : 'model'];
    const models = config[prefix ? prefix + 'Models' : 'models'];
    const baseUrl = config[prefix ? prefix + 'BaseUrl' : 'baseUrl'];
    const ready = config[prefix ? 'has' + prefix[0].toUpperCase() + prefix.slice(1) + 'Credential' : 'hasCredential'];
    return ready === true && baseUrl && model && models?.includes(model)
      ? [{ mode, model, endpoint: baseUrl + '/chat/completions' }] : [];
  });
}
// Permission, service and environment failures do not establish model weakness.
const EXTERNAL_FAILURE = /(?:401|403|429|502|503|504|api.?key|authentication|unauthori[sz]ed|rate.?limit|ECONN|ENOTFOUND|EACCES|EPERM|ENOENT|ETIMEDOUT|permission|denied|approval|network|timeout|credential|鉴权|密钥|凭据|权限|拒绝|审批|未授权|只读|网络|连接|超时|不存在|找不到|文件已变化|哈希|未保存|hash|cancel|停止|取消)/i;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function createAutoHandoff({ config, mode = 'main', connection, emit = () => {} }) {
  const settings = normalizeAutoHandoff(config);
  const candidates = configuredModels(config);
  if (mode === 'main') {
    const main = candidates.find(item => item.mode === 'main');
    if (main) { main.model = connection.model; main.endpoint = connection.endpoint; }
  }
  let currentMode = mode, currentIdentity = identity(connection);
  let phase = settings.autoHandoffEnabled ? 'monitoring' : 'disabled';
  let pending = null, failureKey = '', failureCount = 0, handoffs = 0;
  const handledIssues = new Set(), rejectedModels = new Set();
  const episodeModels = new Set([currentIdentity]);
  const active = () => !['disabled', 'manual', 'cancelled', 'failed', 'completed'].includes(phase);
  function event(next, detail, extra = {}) {
    phase = next;
    emit({ type: 'auto-handoff-state', phase, modelMode: currentMode, detail, handoffs, ...extra });
  }
  function operation(name, title, detail, status = 'succeeded') {
    const now = new Date().toISOString();
    emit({ type: 'operation', operation: { id: crypto.randomUUID(), name, title, detail, status, startedAt: now, endedAt: now } });
  }
  function choose() {
    const level = settings.modelCapabilityLevels[currentMode];
    if (!level) return null;
    return candidates.filter(item => settings.modelCapabilityLevels[item.mode] > level
      && identity(item) !== currentIdentity && !episodeModels.has(identity(item)) && !rejectedModels.has(identity(item)))
      .sort((a, b) => settings.modelCapabilityLevels[b.mode] - settings.modelCapabilityLevels[a.mode])[0] || null;
  }
  function request(issue, reason) {
    if (!active()) return { ok: false, error: '本轮自动接力未启用或已由手动选择接管。' };
    if (pending) return { ok: true, queued: true, mode: pending.candidate.mode };
    if (handledIssues.has(issue)) return { ok: false, error: '同一未解决问题已处理，请改变方法或提供新的实际证据。' };
    handledIssues.add(issue);
    const candidate = choose();
    if (!candidate) {
      operation('auto_handoff_unavailable', '本次未自动接力', '没有已配置、分级更高且可用的不同模型；继续保留当前任务与证据。', 'failed');
      return { ok: false, error: '没有已配置且能力等级更高的可用模型；请核对等级、模型和凭据。' };
    }
    pending = { kind: 'upgrade', candidate, reason };
    event('queued', reason + '，等待当前工具批次结束后接力。');
    return { ok: true, queued: true, mode: candidate.mode };
  }
  return {
    enabled: settings.autoHandoffEnabled,
    snapshot: () => ({ phase, currentMode, handoffs, pending: pending?.kind || null }),
    hasPending: () => Boolean(pending),
    requestAssistance(args) {
      if (typeof args?.reason !== 'string' || !args.reason.trim() || args.reason.length > 2000
        || typeof args.evidence !== 'string' || !args.evidence.trim() || args.evidence.length > 4000) throw Error('请求接力须提供简短原因和实际证据。');
      if (EXTERNAL_FAILURE.test(args.reason + '\n' + args.evidence)) return { ok: false, error: '服务、环境或权限问题不能作为能力不足自动升级，请先处理对应原因。' };
      return request('request:' + digest(args.reason.trim() + '\0' + args.evidence.trim()), '当前模型明确请求较高等级模型协助');
    },
    afterTool(name, args, result, status) {
      if (!active() || name === 'request_model_assistance') return;
      if (status !== 'failed') { failureKey = ''; failureCount = 0; return; }
      const evidence = [result?.error, result?.reason, result?.output].filter(value => typeof value === 'string').join('\n');
      if (EXTERNAL_FAILURE.test(evidence)) { failureKey = ''; failureCount = 0; return; }
      const text = (evidence || '执行失败').replace(/\s+/g, ' ').trim().slice(0, 2000);
      const key = name + '\0' + text;
      failureCount = key === failureKey ? failureCount + 1 : 1;
      failureKey = key;
      if (failureCount >= 2) request('tool:' + digest(key + '\0' + JSON.stringify(args || {})), '同类工具执行连续失败');
    },
    beforeFinal() {
      if (!active() || phase !== 'takeover' || pending) return Boolean(pending);
      const main = candidates.find(item => item.mode === 'main');
      if (!main) throw Error('接手答复已返回，但模式一配置不可用，尚未完成回交核验。');
      pending = { kind: 'return', candidate: main, reason: '接手答复已返回，交回模式一核验和完善，再继续原任务' };
      event('returning', pending.reason);
      return true;
    },
    takeDecision() { const decision = pending; pending = null; return active() ? decision : null; },
    commit(decision) {
      if (!active()) return false;
      currentMode = decision.candidate.mode; currentIdentity = identity(decision.candidate);
      failureKey = ''; failureCount = 0;
      if (decision.kind === 'upgrade') {
        handoffs++;
        episodeModels.add(currentIdentity);
        operation('auto_handoff_started', '较高等级模型已接手', LABELS[currentMode] + '接续同一任务；成功操作和工具证据保留。');
        event('takeover', LABELS[currentMode] + '正在接手处理');
      } else {
        episodeModels.clear(); episodeModels.add(currentIdentity);
        operation('auto_handoff_returned', '已交回模式一核验完善', '保留接手答复及实际工具结果，核验后继续原任务；不重放成功操作。');
        event('refining', '模式一正在核验、完善并继续原任务');
      }
      return true;
    },
    reject(decision) {
      if (!active()) return;
      rejectedModels.add(identity(decision.candidate));
      operation('auto_handoff_failed', decision.kind === 'return' ? '模式一回交未完成' : '自动接力连接未能建立', LABELS[decision.candidate.mode] + '连接或现有权限检查未通过，未增加模型请求。', 'failed');
      if (decision.kind === 'return') { event('failed', '模式一回交未完成'); return; }
      const candidate = choose();
      if (candidate) pending = { ...decision, candidate };
      else event(handoffs ? 'takeover' : 'monitoring', '没有其他可用的更高等级模型，保留当前任务');
    },
    manualOverride() {
      if (!active()) return;
      pending = null;
      operation('auto_handoff_manual', '手动模式选择优先', '本轮停止自动切换，按用户选择继续当前任务。');
      event('manual', '已改为手动接续，本轮不再自动切换');
    },
    close(status) {
      if (!active()) return;
      pending = null;
      if (status === 'complete') { if (handoffs) event('completed', '模式一接续已结束'); return; }
      const main = candidates.find(item => item.mode === 'main');
      event(status === 'cancelled' ? 'cancelled' : 'failed', '接力已停止，已完成操作和证据保留',
        handoffs && main ? { restoreMode: 'main', restoreModel: main.model } : {});
    },
  };
}
module.exports = { normalizeAutoHandoff, configuredModels, createAutoHandoff };
