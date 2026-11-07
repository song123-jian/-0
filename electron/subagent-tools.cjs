const field = (description, extra = {}) => ({ type: 'string', description, ...extra });
const tool = (name, description, properties, required = []) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });

const DEFINITIONS = [
  tool('subagent_start', '由主模型分配一个受控子任务。analysis 只返回分析；edit 可在 paths 指定的互不重叠路径内读写文件。可先启动多个不重叠任务，再继续主任务。', {
    title: field('任务短标题，最多100字符'), task: field('子任务说明，最多16000字符'), mode: { type: 'string', enum: ['analysis', 'edit'], description: 'analysis只分析；edit允许指定路径内写入' },
    paths: { type: 'array', maxItems: 20, items: field('工作区内相对文件或目录路径'), description: 'edit必填；analysis可选，填写后限制读取范围' },
  }, ['task', 'mode']),
  tool('subagent_wait', '等待一个已启动的子任务，返回真实完成状态和结果；超时仍运行时不能当作完成。', {
    task_id: field('subagent_start返回的任务ID'), wait_ms: { type: 'integer', minimum: 1000, maximum: 30000, description: '最多等待毫秒数' },
  }, ['task_id']),
  tool('subagent_read', '读取已启动子任务的当前状态、结果和错误，不读取其他主任务的子任务。', { task_id: field('subagent_start返回的任务ID') }, ['task_id']),
  tool('subagent_cancel', '停止一个仍在运行的子任务，并返回停止后的真实状态。', { task_id: field('subagent_start返回的任务ID') }, ['task_id']),
];

function createSubagentTools({ coordinator, parentRequestId, guard = async () => {}, readOnly = false, allowEdits = true, prepare = async () => {} }) {
  if (!coordinator) return null;
  const definitions = readOnly ? [] : DEFINITIONS.map(item => item.function.name !== 'subagent_start' || allowEdits ? item : { ...item, function: { ...item.function, description: '委派一个只读探索子任务，查找文件、文档、接口或验证依据。仅 analysis，不运行命令或写文件；返回路径、读取哈希、结论及未确定项。避免重复探索。', parameters: { ...item.function.parameters, properties: { ...item.function.parameters.properties, mode: { type: 'string', enum: ['analysis'], description: '只读探索' } } } } });
  const check = async (context) => { await guard(); if (context?.signal?.aborted) throw new Error('任务已停止。'); };
  return { definitions, async execute(name, args = {}, context = {}) {
    if (!definitions.some((item) => item.function.name === name)) throw new Error('当前模式不允许子模型委派。');
    await check(context);
    if (name === 'subagent_start') {
      if (!allowEdits && args.mode !== 'analysis') throw new Error('探索子模型默认只读；需在模型分工设置中明确允许指定路径修改。');
      await prepare(args, context);
      return { ok: true, ...(await coordinator.start({ ...args, parentRequestId, signal: context.signal })), activity: { title: '分配子模型任务', detail: args.title || args.task.slice(0, 100) } };
    }
    if (name === 'subagent_wait') return { ok: true, ...(await coordinator.wait(args.task_id, args.wait_ms, parentRequestId)), activity: { title: '等待子模型任务', detail: args.task_id } };
    if (name === 'subagent_read') return { ok: true, ...(await coordinator.read(args.task_id, parentRequestId)), activity: { title: '读取子模型任务', detail: args.task_id } };
    if (name === 'subagent_cancel') return { ok: true, ...(await coordinator.cancel(args.task_id, parentRequestId)), activity: { title: '停止子模型任务', detail: args.task_id } };
    throw new Error('未知子模型工具。');
  } };
}

module.exports = { DEFINITIONS, createSubagentTools };
