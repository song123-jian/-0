const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizeAgentSettings } = require('./agent-settings.cjs');

const KEYS = [...new Set([...Object.keys(normalizeAgentSettings()), 'networkAccess', 'networkDomains', 'allowLocalBinding'])];
async function findWorkspaceSettings(start) {
  let directory = path.resolve(start);
  while (true) {
    const candidate = path.join(directory, '.scodex', 'codex-settings.json');
    try { await fs.access(candidate); return candidate; } catch (error) { if (error.code !== 'ENOENT') return candidate; }
    const parent = path.dirname(directory);
    if (parent === directory) return path.join(path.resolve(start), '.scodex', 'codex-settings.json');
    directory = parent;
  }
}

function createAgentSettingsStore(root) {
  let shared = normalizeAgentSettings(); let overrides = {}; let sharedError = ''; let workspaceError = '';
  let sharedPath = root && path.join(root, 'codex-settings.json'); let workspacePath; let queue = Promise.resolve();
  const snapshot = () => {
    const effective = normalizeAgentSettings({ ...shared, ...overrides });
    return { agentSettings: effective, agentSettingsError: [sharedError, workspaceError].filter(Boolean).join('\n'),
      agentSettingsScopes: {
        shared: { settings: shared, path: sharedPath || '', error: sharedError },
        workspace: { settings: effective, path: workspacePath || '', error: workspaceError, inherited: !Object.keys(overrides).length },
      } };
  };
  async function read(file, label) {
    try {
      const value = JSON.parse(await fs.readFile(file, 'utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object');
      return { value: Object.fromEntries(Object.entries(value).filter(([key]) => KEYS.includes(key))), error: '' };
    } catch (error) {
      return { value: {}, error: error.code === 'ENOENT' ? '' : `${label}配置无法读取；请修正文件或重新保存设置。` };
    }
  }
  async function load(workspace) {
    await queue;
    const global = sharedPath ? await read(sharedPath, 'Scodex 默认') : { value: {}, error: '' };
    shared = normalizeAgentSettings(global.value); sharedError = global.error;
    workspacePath = await findWorkspaceSettings(workspace);
    const project = await read(workspacePath, '工作空间');
    overrides = project.value; workspaceError = project.error;
    return snapshot();
  }
  function update(value, scope = 'shared') {
    if (!['shared', 'workspace'].includes(scope)) throw new Error('配置范围无效。');
    if ((value === null && scope !== 'workspace') || (value !== null && (!value || typeof value !== 'object' || Array.isArray(value)))) throw new Error('Scodex 设置格式无效。');
    const file = scope === 'shared' ? sharedPath : workspacePath;
    if (!file) throw new Error('找不到 Scodex 配置目录。');
    const operation = queue.then(async () => {
      const patch = value === null ? {} : Object.fromEntries(Object.entries(value).filter(([key]) => KEYS.includes(key)));
      const merged = normalizeAgentSettings({ ...shared, ...(scope === 'workspace' ? overrides : {}), ...patch });
      let saved = merged;
      if (scope === 'workspace') {
        saved = value === null ? {} : { ...overrides, ...Object.fromEntries(Object.keys(patch).map((key) => [key, merged[key]])) };
        if (value !== null && 'availableReasoningEfforts' in patch && merged.defaultReasoningEffort !== (saved.defaultReasoningEffort || shared.defaultReasoningEffort)) saved.defaultReasoningEffort = merged.defaultReasoningEffort;
      }
      await fs.mkdir(path.dirname(file), { recursive: true });
      if (scope === 'workspace' && (await fs.lstat(path.dirname(file))).isSymbolicLink()) throw new Error('工作空间配置目录不能使用链接，请恢复本机目录后重试。');
      try {
        const stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('配置保存目标必须是本机普通文件。');
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const temporary = file + '.scodex-' + crypto.randomUUID() + '.tmp';
      try {
        await fs.writeFile(temporary, JSON.stringify(saved, null, 2), { flag: 'wx' });
        for (let attempt = 0; ; attempt++) {
          try { await fs.rename(temporary, file); break; }
          catch (error) {
            // Windows readers can briefly hold a sharing lock during replacement.
            if (process.platform !== 'win32' || !['EPERM', 'EBUSY'].includes(error.code) || attempt >= 3) throw error;
            await new Promise((resolve) => setTimeout(resolve, [30, 100, 250][attempt]));
          }
        }
      }
      catch (error) { await fs.rm(temporary, { force: true }).catch(() => {}); throw error; }
      if (scope === 'shared') { shared = saved; sharedError = ''; } else { overrides = saved; workspaceError = ''; }
      return snapshot();
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return { load, update, snapshot, flush: () => queue };
}
module.exports = { createAgentSettingsStore, findWorkspaceSettings };
