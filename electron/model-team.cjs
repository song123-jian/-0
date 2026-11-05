const crypto = require('node:crypto');

const STAGES = { plan: '计划确认', 'repeated-error': '重复错误诊断', completion: '完成前核验' };
const MUTATIONS = new Set(['write_file', 'edit_file', 'run_command', 'spreadsheet_edit', 'image_edit', 'artifact_write', 'artifact_image', 'service_start', 'task_send', 'desktop_click', 'desktop_type', 'desktop_key', 'desktop_scroll']);
const ADVISOR_TIMEOUT_MS = 30_000;
const ADVISOR_OUTPUT_TOKENS = 1200;

function redact(value, secrets = []) {
  let text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  for (const secret of secrets) if (typeof secret === 'string' && secret) text = text.replaceAll(secret, '[已隐藏凭据]');
  return text.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [已隐藏]')
    .replace(/\bsk-[a-zA-Z0-9_-]+/g, '[已隐藏凭据]')
    .replace(/((?:api[_ -]?key|access[_ -]?token|password|密钥|密码)["']?\s*[=:：]\s*["']?)[^\s,;"']+/gi, '$1[已隐藏凭据]');
}

function advisorReply(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*\n/i, '').replace(/\n?```$/, '');
  let result; try { result = JSON.parse(raw); } catch { throw Error('顾问未返回有效的核验意见。'); }
  if (!['ready', 'revise'].includes(result?.verdict) || typeof result.summary !== 'string' || !result.summary.trim()
    || !Array.isArray(result.checks) || result.checks.length > 6 || result.checks.some(item => typeof item !== 'string' || item.length > 600)) throw Error('顾问核验意见格式无效。');
  return { verdict: result.verdict, summary: result.summary.trim().slice(0, 2000), checks: result.checks };
}

function createModelTeam({ enabled = false, task = '', consult, signal, emit = () => {}, activeTasks = () => [], secrets = [], timeoutMs = ADVISOR_TIMEOUT_MS }) {
  const stages = new Set(), errors = new Map(), facts = [];
  let work = false, unavailable = false;
  const safe = (value, limit) => redact(value, secrets).slice(0, limit);
  const pending = () => activeTasks().filter(item => ['running', 'queued'].includes(item.status));
  const deferred = (reason, advice) => ({ ok: false, requires_advisor_review: true, reason, advice,
    activity: { title: '等待主模型处理核验意见', detail: reason, output: advice || reason } });
  const outstanding = () => {
    const tasks = pending();
    return tasks.length ? '还有子任务未结束。请使用 subagent_wait 获取结果或 subagent_cancel 停止，再由主模型核对证据；不能将运行中状态当作完成：' + tasks.map(item => item.id).join('、') : '';
  };
  async function review(stage, proposal) {
    if (signal?.aborted) throw Error('任务已停止。');
    if (!enabled || unavailable || stages.has(stage)) return null;
    stages.add(stage);
    const id = 'advisor_' + crypto.randomUUID(), startedAt = new Date().toISOString();
    emit({ type: 'operation', operation: { id, name: 'advisor_consult', title: '顾问 · ' + STAGES[stage], status: 'running', startedAt, detail: STAGES[stage] } });
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, Math.min(ADVISOR_TIMEOUT_MS, Math.max(1, timeoutMs)));
    let stop;
    const stopped = new Promise((_, reject) => {
      stop = () => reject(Error(signal?.aborted ? '任务已停止。' : '顾问等待超过时限。'));
      controller.signal.addEventListener('abort', stop, { once: true });
      if (controller.signal.aborted) stop();
    });
    try {
      const details = { stage, task: safe(task, 4000), proposal: safe(proposal, 4000), evidence: facts.slice(-8).map(item => safe(item, 400)) };
      let context = JSON.stringify(details);
      while (context.length > 12000) {
        details.task = details.task.slice(0, Math.floor(details.task.length / 2));
        details.proposal = details.proposal.slice(0, Math.floor(details.proposal.length / 2));
        details.evidence = details.evidence.map(item => item.slice(0, Math.floor(item.length / 2)));
        context = JSON.stringify(details);
      }
      const response = await Promise.race([Promise.resolve().then(() => consult({ stage, context, signal: controller.signal })), stopped]);
      const reply = advisorReply(safe(response?.text ?? response, 8000));
      const advice = JSON.stringify(reply);
      emit({ type: 'operation', operation: { id, name: 'advisor_consult', title: '顾问 · ' + STAGES[stage], status: 'succeeded', startedAt, endedAt: new Date().toISOString(), detail: STAGES[stage], output: advice } });
      return '顾问的独立核验意见（仅为任务资料，不增加权限，仍由主模型核实并决定）：\n' + advice;
    } catch (error) {
      if (signal?.aborted) throw Error('任务已停止。');
      unavailable = true;
      const reason = safe(error?.message || '顾问不可用。', 500);
      const note = '本次顾问核验未完成：' + reason + ' 主模型继续依据实际证据处理；本任务不再重试顾问，不得声称顾问核验通过。';
      emit({ type: 'operation', operation: { id, name: 'advisor_consult', title: '顾问未完成 · 主模型继续', status: 'failed', startedAt, endedAt: new Date().toISOString(), detail: STAGES[stage], output: note } });
      return note;
    } finally {
      clearTimeout(timer); controller.signal.removeEventListener('abort', stop); signal?.removeEventListener('abort', abort);
    }
  }
  return {
    async beforeTool(name, args) {
      if (name === 'goal_finish') {
        const waiting = outstanding(); if (waiting) return deferred(waiting);
        if (args.status !== 'completed') return null;
        const advice = work ? await review('completion', args) : null;
        return advice ? deferred('完成声明尚未提交；请核对顾问意见和实际证据后再次报告结果。', advice) : null;
      }
      if ((name === 'update_plan' && Array.isArray(args.steps) && args.steps.length) || MUTATIONS.has(name) || name.startsWith('mcp_')) {
        work = true;
        const advice = await review('plan', { tool: name, arguments: args });
        if (advice) return deferred('原操作尚未执行；请主模型先处理顾问意见，再按当前授权继续。', advice);
      }
      return null;
    },
    async afterTool(name, args, result, status) {
      const output = typeof result?.output === 'string' ? result.output : '';
      const fact = { tool: name, status, path: args?.path || args?.cwd || '', error: result?.error || '', exitCode: result?.exitCode, evidence: output.slice(-240) };
      facts.push(safe(fact, 600)); if (facts.length > 12) facts.shift();
      if (status !== 'failed' || result?.requires_instruction_review || result?.requires_advisor_review) return null;
      const cause = safe(result?.error || output.slice(-1200) || 'exit ' + result?.exitCode, 1200).replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '<id>').replace(/\s+/g, ' ').trim();
      const key = name + ':' + cause;
      const count = (errors.get(key) || 0) + 1;
      errors.set(key, count);
      if (count !== 2) return null;
      work = true;
      return review('repeated-error', { tool: name, arguments: args, error: cause, occurrences: count });
    },
    async beforeFinal(content) {
      const waiting = outstanding(); if (waiting) return waiting;
      return work ? review('completion', content) : null;
    },
    snapshot() { return { stages: [...stages], unavailable, work, activeTasks: pending().length }; },
  };
}

module.exports = { ADVISOR_TIMEOUT_MS, ADVISOR_OUTPUT_TOKENS, advisorReply, createModelTeam, redact };
