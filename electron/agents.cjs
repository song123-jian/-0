const crypto = require('node:crypto');
const path = require('node:path');
const { createJsonStore } = require('./storage.cjs');

function createAgentService(root, execute) {
  const store = createJsonStore(path.join(root, 'agent-runs.json'), { version: 1, tasks: [] });
  const running = new Map();
  const tasksOf = (state) => { if (!Array.isArray(state.tasks)) throw new Error('子智能体记录格式无效，原文件已保留。'); return state.tasks; };
  const mutate = (change) => store.update((state) => ({ ...state, tasks: change(tasksOf(state)) }));
  const update = (id, fields) => mutate((tasks) => tasks.map((task) => task.id === id ? { ...task, ...fields, updatedAt: new Date().toISOString() } : task));
  return {
    async initialize() { await mutate((tasks) => tasks.map((task) => ['queued', 'running'].includes(task.status) ? { ...task, status: 'interrupted', error: '上次程序退出时任务尚未完成，可重新运行。' } : task)); },
    async list() { return tasksOf(await store.read()); },
    async start(input) {
      const prompt = typeof input?.prompt === 'string' ? input.prompt.trim() : '';
      if (!prompt || prompt.length > 16_000) throw new Error('请填写 1–16000 字的子任务。');
      if (running.size >= 3) throw new Error('最多同时运行 3 个子智能体，请等待或停止现有任务。');
      const task = { id: crypto.randomUUID(), parentId: String(input.parentId || '').slice(0, 100), prompt,
        title: prompt.replace(/[\r\n]+/g, ' ').slice(0, 80), result: '', status: 'queued', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const controller = new AbortController();
      running.set(task.id, controller);
      try { await mutate((tasks) => { if (tasks.length >= 500) throw new Error('最多保存 500 个子任务，请先清理旧记录。'); return [task, ...tasks]; }); }
      catch (error) { running.delete(task.id); throw error; }
      const completion = (async () => {
        try {
          await update(task.id, { status: 'running' });
          if (controller.signal.aborted) throw new Error('任务已停止。');
          const result = await execute(task, controller);
          await update(task.id, { status: controller.signal.aborted ? 'cancelled' : 'complete', result: String(result || '').slice(0, 256_000), error: '' });
        } catch (error) {
          await update(task.id, { status: controller.signal.aborted ? 'cancelled' : 'error', error: String(error.message || error).slice(0, 600) });
        } finally { running.delete(task.id); }
      })();
      // Keep a rejection handler even if a final persistence write fails.
      controller.completion = completion.catch(() => {});
      return task;
    },
    cancel(id) { const controller = running.get(id); if (controller) controller.abort(); return Boolean(controller); },
    async remove(ids) {
      if (!Array.isArray(ids) || ids.length > 500) throw new Error('请选择要删除的子任务。');
      if (ids.some((id) => running.has(id))) throw new Error('请先停止正在运行的子智能体，再删除记录。');
      await mutate((tasks) => tasks.filter((task) => !ids.includes(task.id)));
      return true;
    },
    async stopAll() { const controllers = [...running.values()]; controllers.forEach((controller) => controller.abort()); await Promise.all(controllers.map((controller) => controller.completion)); await store.flush(); },
  };
}

module.exports = { createAgentService };
