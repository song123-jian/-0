const path = require('node:path');
const crypto = require('node:crypto');

const MAX_TASK_BYTES = 16_000;
const MAX_PATHS = 20;
const MAX_WAIT_MS = 30_000;

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function cleanTask(value) {
  if (typeof value !== 'string') throw new Error('子任务必须是文本。');
  const task = value.trim();
  if (!task || task.length > MAX_TASK_BYTES) throw new Error('子任务必须为 1–16000 个字符。');
  return task;
}

function normalizePaths(workspaceRoot, values) {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.length > MAX_PATHS) throw new Error('子任务路径最多 20 项。');
  const root = path.resolve(workspaceRoot);
  const result = [];
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim() || value.includes('\0') || path.isAbsolute(value)) throw new Error('子任务路径必须是工作区内的相对路径。');
    const target = path.resolve(root, value);
    if (!inside(root, target)) throw new Error('子任务路径不能超出当前工作区。');
    const key = process.platform === 'win32' ? target.toLowerCase() : target;
    if (!result.some((item) => item.key === key)) result.push({ path: value.replaceAll(path.sep, '/'), target, key });
  }
  return result;
}

function overlapping(left, right) {
  return left.some((a) => right.some((b) => inside(a.target, b.target) || inside(b.target, a.target)));
}

function createSubagentCoordinator({ workspaceRoot, run }) {
  if (typeof run !== 'function') throw new Error('子任务执行器未配置。');
  const root = path.resolve(workspaceRoot);
  const tasks = new Map();
  const active = new Set();

  const snapshot = (task) => ({ id: task.id, parentRequestId: task.parentRequestId, title: task.title, task: task.task,
    mode: task.mode, paths: task.paths.map((item) => item.path), status: task.status, result: task.result, error: task.error,
    createdAt: task.createdAt, updatedAt: task.updatedAt });
  const release = (task) => { active.delete(task.id); };
  const finish = (task, status, patch = {}) => { task.status = status; Object.assign(task, patch); task.updatedAt = new Date().toISOString(); release(task); task.resolve?.(snapshot(task)); };
  const launch = (task, signal) => {
    task.promise = (async () => {
      try {
        const result = await run({ id: task.id, task: task.task, mode: task.mode, paths: task.paths.map((item) => item.path), pathTargets: task.paths.map((item) => item.target), parentRequestId: task.parentRequestId, signal });
        if (signal.aborted) finish(task, 'cancelled', { error: '任务已停止。' });
        else finish(task, 'complete', { result: String(result?.text || result || '').slice(0, 256_000), error: '' });
      } catch (error) {
        finish(task, signal.aborted ? 'cancelled' : 'error', { error: String(error?.message || error).slice(0, 1000) });
      }
    })();
    task.promise.catch(() => {});
  };

  return {
    async start(input = {}) {
      const task = cleanTask(input.task);
      const mode = input.mode === 'edit' ? 'edit' : input.mode === 'analysis' ? 'analysis' : '';
      if (!mode) throw new Error('子任务模式必须是 analysis 或 edit。');
      let paths = normalizePaths(root, input.paths);
      if (mode === 'analysis' && !paths.length) paths = normalizePaths(root, ['.']);
      if (mode === 'edit' && !paths.length) throw new Error('写入型子任务至少指定一个路径。');
      const duplicate = [...active].map(id => tasks.get(id)).find(other => other.parentRequestId === String(input.parentRequestId || '').slice(0, 160) && other.mode === mode && other.task === task && JSON.stringify(other.paths.map(item => item.key).sort()) === JSON.stringify(paths.map(item => item.key).sort()));
      if (duplicate) return { ...snapshot(duplicate), reused: true };
      if ([...active].some((id) => {
        const other = tasks.get(id);
        return (mode === 'edit' || other.mode === 'edit') && overlapping(other.paths, paths);
      })) throw new Error('路径正在由另一个子任务处理，请拆分任务或等待完成。');
      const id = 'sub_' + crypto.randomUUID();
      const controller = new AbortController();
      const taskState = { id, parentRequestId: String(input.parentRequestId || '').slice(0, 160), title: String(input.title || task).replace(/[\r\n]+/g, ' ').slice(0, 100), task, mode, paths,
        status: 'running', result: '', error: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), controller };
      taskState.done = new Promise((resolve) => { taskState.resolve = resolve; });
      tasks.set(id, taskState); active.add(id);
      const parentSignal = input.signal;
      const abortParent = () => controller.abort();
      if (parentSignal) {
        if (parentSignal.aborted) controller.abort();
        else parentSignal.addEventListener('abort', abortParent, { once: true });
      }
      launch(taskState, controller.signal);
      taskState.promise.finally(() => parentSignal?.removeEventListener('abort', abortParent)).catch(() => {});
      return snapshot(taskState);
    },
    async read(id, parentRequestId) {
      const task = tasks.get(String(id || ''));
      if (!task || task.parentRequestId !== String(parentRequestId || '')) throw new Error('子任务不存在或不属于当前主任务。');
      return snapshot(task);
    },
    async wait(id, waitMs = MAX_WAIT_MS, parentRequestId = '') {
      const task = tasks.get(String(id || ''));
      if (!task || task.parentRequestId !== String(parentRequestId || '')) throw new Error('子任务不存在或不属于当前主任务。');
      if (!['running', 'queued'].includes(task.status)) return snapshot(task);
      const timeout = Math.min(MAX_WAIT_MS, Math.max(0, Number(waitMs) || 0));
      if (!timeout) return snapshot(task);
      let timer;
      await Promise.race([task.done, new Promise((resolve) => { timer = setTimeout(resolve, timeout); })]);
      clearTimeout(timer);
      return { ...snapshot(task), timedOut: ['running', 'queued'].includes(task.status), settled: !['running', 'queued'].includes(task.status) };
    },
    async cancel(id, parentRequestId = '') {
      const task = tasks.get(String(id || ''));
      if (!task || task.parentRequestId !== String(parentRequestId || '')) throw new Error('子任务不存在或不属于当前主任务。');
      if (['running', 'queued'].includes(task.status)) task.controller.abort();
      await task.done;
      return snapshot(task);
    },
    async cancelParent(parentRequestId) {
      const ids = [...tasks.values()].filter((task) => task.parentRequestId === String(parentRequestId || '') && ['running', 'queued'].includes(task.status)).map((task) => task.id);
      await Promise.all(ids.map((id) => this.cancel(id, parentRequestId)));
    },
    assertWritable(target, ownerId = '') {
      const absolute = path.resolve(target);
      const owner = String(ownerId || '');
      for (const id of active) {
        if (id === owner) continue;
        const task = tasks.get(id);
        if (task.mode !== 'edit') continue;
        if (task.paths.some((item) => inside(item.target, absolute) || inside(absolute, item.target))) throw new Error('此路径正由子任务修改，请等待该任务完成后再写入。');
      }
      return true;
    },
    assertNoActiveTasks({ writesOnly = false, ownerId = '' } = {}) {
      const owner = String(ownerId || '');
      if ([...active].some(id => id !== owner && (!writesOnly || tasks.get(id).mode === 'edit'))) throw new Error('子任务仍在运行，请等待或停止后再执行可能修改任意路径的命令。');
      return true;
    },
    async stopAll() { await Promise.all([...active].map((id) => this.cancel(tasks.get(id).id, tasks.get(id).parentRequestId))); },
    snapshot() { return [...tasks.values()].map(snapshot); },
  };
}

module.exports = { MAX_TASK_BYTES, MAX_PATHS, MAX_WAIT_MS, createSubagentCoordinator };
