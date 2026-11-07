const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { runAgentCommand } = require('./agent-command.cjs');
const { withFileCommit } = require('./file-commit.cjs');
const { readInstructionFile, MAX_TOTAL_BYTES } = require('./instruction-context.cjs');

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const IGNORED = new Set(['.git', 'node_modules', 'dist', 'release', 'target', '.next', '.cache', '__pycache__']);
const TITLES = { list_directory: '查看目录', read_file: '读取文件', search_text: '搜索内容', write_file: '写入文件', edit_file: '精确修改', run_command: '运行命令', update_plan: '更新计划' };
const field = (description, extra = {}) => ({ type: 'string', description, ...extra });
const tool = (name, description, properties, required = []) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });
const AGENT_TOOLS = [
  tool('list_directory', '列出项目目录。默认排除依赖、缓存、构建和 Git 内部目录；完整访问可用绝对路径访问项目外；不跨越符号链接。', { path: field('相对项目根目录的路径，默认 .') }),
  tool('read_file', '读取 UTF-8 文本并返回完整文件 SHA256。修改已有文件前必须读取；大文件可分页。自动附带沿途 AGENTS.md 项目规则。', { path: field('相对项目路径'), start_line: { type: 'integer', minimum: 1 }, max_lines: { type: 'integer', minimum: 1, maximum: 400 } }, ['path']),
  tool('search_text', '在指定目录或文件内搜索字面文本，返回路径、行号和片段；有明确目标时先限定 path。', { query: field('区分大小写的字面文本，最多200字符'), path: field('相对项目目录或文件，默认 .') }, ['query']),
  tool('write_file', '创建或完整替换 UTF-8 无 BOM 文本。已有文件必须先 read_file 并提供原 SHA256；新文件 expected_hash 为 new。拒绝未保存编辑或并发变化。优先小范围 edit_file。', { path: field('相对项目文件路径'), content: field('完整文件内容'), expected_hash: field('read_file 返回的完整 hash；新建文件填 new') }, ['path', 'content', 'expected_hash']),
  tool('edit_file', '在文本中做一次唯一精确替换。old_text 必须非空且只出现一次，必须提供刚读取的完整文件 hash。保留原换行风格。', { path: field('相对项目文件路径'), old_text: field('要替换的唯一原文'), new_text: field('替换后的文本'), expected_hash: field('read_file 返回的 hash') }, ['path', 'old_text', 'new_text', 'expected_hash']),
  tool('run_command', '在项目目录执行一次 PowerShell 命令（Windows）。返回真实退出码和限量输出；超时或停止会终止进程树。每次独立 shell，无持久目录状态。不得启动无人管理的后台服务。权限取决于本机设置；不要访问凭据、泄露密钥或执行未经要求的发布、删除。', { command: field('PowerShell 脚本，最多16000字符'), cwd: field('项目内相对目录，默认 .'), timeout_ms: { type: 'integer', minimum: 1000, maximum: 120000 } }, ['command']),
  tool('update_plan', '记录本次任务计划和完成状态；这只更新工作记录，不代表已经执行。最多12步，只允许一项进行中。', { steps: { type: 'array', maxItems: 12, items: { type: 'object', properties: { text: field('可验证的步骤'), status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] } }, required: ['text', 'status'], additionalProperties: false } } }, ['steps']),
];

const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const inside = (root, target) => { const rel = path.relative(root, target); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };
function sensitive(relative) {
  return relative.split(/[\\/]/).some((part) => /^(?:secrets|\.ssh|\.aws|\.azure|\.codex|\.scodex)$/i.test(part)
    || /^(?:\.env(?:\..*)?|auth\.json|credentials(?:\..*)?|.*\.(?:dpapi|pem|pfx|p12|key))$/i.test(part));
}
function textContent(buffer) {
  let value; try { value = new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { throw new Error('文件不是有效 UTF-8 文本，请先在编辑器转换编码。'); }
  if (value.includes('\0')) throw new Error('二进制文件不能通过文本工具读写。');
  return value;
}
function fileDiff(relative, before, after) {
  const a = before.replace(/\r\n/g, '\n').split('\n'); const b = after.replace(/\r\n/g, '\n').split('\n');
  let start = 0; while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  if (start === a.length && start === b.length) return '';
  let ai = a.length; let bi = b.length; while (ai > start && bi > start && a[ai - 1] === b[bi - 1]) { ai -= 1; bi -= 1; }
  const first = Math.max(0, start - 3); const tail = Math.min(3, a.length - ai, b.length - bi);
  const lines = [`--- a/${relative}`, `+++ b/${relative}`, `@@ -${first + 1},${ai - first + tail} +${first + 1},${bi - first + tail} @@`,
    ...a.slice(first, start).map((s) => ' ' + s), ...a.slice(start, ai).map((s) => '-' + s), ...b.slice(start, bi).map((s) => '+' + s), ...a.slice(ai, ai + tail).map((s) => ' ' + s)];
  const value = lines.join('\n'); return value.length > 24_000 ? value.slice(0, 24_000) + '\n[差异显示已截断；请打开文件检查完整内容]' : value;
}

function createAgentTools({ workspaceRoot, readOnly = false, fullAccess = false, allowedPaths = [], allowedTools = null, guard = async () => {}, authorize = async () => {},
  isDirty = () => false, protectedPaths = [], environment = async () => process.env, onFileChanged = () => {}, commandCapture = action => action(), instructionsPreloaded = [] }) {
  const observed = new Map();
  const ruleKey = p => process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p);
  const deliveredRules = new Map(instructionsPreloaded.map(rule => [ruleKey(rule.path), rule.hash]));
  const rootPromise = fs.realpath(workspaceRoot);
  const scopes = allowedPaths.map((value) => path.resolve(workspaceRoot, value));
  const scoped = (target) => !scopes.length || scopes.some((scope) => inside(scope, target));
  async function resolve(value = '.', allowMissing = false, inheritedRule = false) {
    const root = await rootPromise;
    if (typeof value !== 'string' || !value.trim() || value.length > 4096 || /[\x00-\x1f]/.test(value)) throw new Error('项目路径无效。');
    const absolute = path.resolve(root, value); const rel = path.relative(root, absolute);
    const inWorkspace = inside(root, absolute);
    if (!inWorkspace && !fullAccess) throw new Error('模型工具只能访问当前项目内的路径。');
    if (!fullAccess && !inheritedRule && !scoped(absolute)) throw new Error('目标路径不在主模型分配范围内。');
    if (!fullAccess && (sensitive(inWorkspace ? rel : absolute) || protectedPaths.some((value) => value && inside(path.resolve(value), absolute)))) throw new Error('模型工具不读取或修改凭据、应用配置及受保护目录。');
    if (!fullAccess && rel.split(path.sep).some((s) => s.toLowerCase() === '.git')) throw new Error('不直接读写 Git 内部数据；请使用经过权限检查的 Git 命令。');
    let ancestor = inWorkspace ? root : path.parse(absolute).root;
    const suffix = path.relative(ancestor, absolute);
    const parts = suffix ? suffix.split(path.sep) : [];
    for (let i = 0; i < parts.length; i += 1) {
      ancestor = path.join(ancestor, parts[i]);
      try { const info = await fs.lstat(ancestor); if (!fullAccess && info.isSymbolicLink()) throw new Error('模型工具不跨越符号链接或目录联接。'); }
      catch (error) { if (error.code === 'ENOENT' && allowMissing) break; throw error; }
    }
    return { root, target: absolute, relative: (inWorkspace ? rel : absolute).replaceAll(path.sep, '/') || '.' };
  }
  async function read(target) {
    const info = await fs.stat(target); if (!info.isFile() || info.size > MAX_FILE_BYTES) throw new Error('文本工具只处理 2 MB 以内的普通文件。');
    const data = await fs.readFile(target); if (data.length > MAX_FILE_BYTES) throw new Error('文件在读取期间超过大小限制。');
    return { data, content: textContent(data), hash: hash(data) };
  }
  async function instructions(target) {
    const root = await rootPromise; const result = [];
    let directory = path.dirname(target); const dirs = [];
    const boundary = inside(root, target) ? root : fullAccess ? path.parse(target).root : root;
    while (inside(boundary, directory)) { dirs.unshift(directory); if (directory === boundary) break; directory = path.dirname(directory); }
    let bytes = 0;
    for (const dir of dirs) {
      const file = path.join(dir, 'AGENTS.md');
      if (file === target) continue;
      try {
        const item = await resolve(file, false, true); const value = await readInstructionFile(item.target); bytes += value.bytes;
        if (bytes > MAX_TOTAL_BYTES) throw new Error('沿途 AGENTS.md 超过 256 KiB，未截断规则；操作已停止。');
        if (deliveredRules.get(ruleKey(item.target)) !== value.hash) result.push({ path: item.relative, content: value.content, hash: value.hash, truncated: false });
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const rule of result) deliveredRules.set(ruleKey(path.resolve(root, rule.path)), rule.hash);
    return result;
  }
  function rulesFirst(rules) { return { ok: false, requires_instruction_review: true, instructions: rules, error: '发现新的或已变化的目录 AGENTS.md，尚未执行此操作。先按这些指引核对当前方案，再提交操作。', activity: { title: '已加载目录规则 · 原操作未执行', detail: rules.map(rule => rule.path).join('、') } }; }
  async function save(args, edit, context) {
    if (readOnly) throw new Error('规划模式只读，不能写文件。');
    const item = await resolve(args.path, !edit);
    const rules = await instructions(item.target); if (rules.length) return rulesFirst(rules);
    await authorize('file-write', { path: item.target }, context);
    await guard(); if (context.signal?.aborted) throw new Error('任务已停止。');
    if (isDirty(item.target)) throw new Error('此文件在工作台中有未保存修改，请先保存或取消编辑。');
    let original;
    try { original = await read(item.target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (original ? observed.get(item.target) !== args.expected_hash || original.hash !== args.expected_hash : args.expected_hash !== 'new') throw new Error('文件基线已变化或尚未读取。请重新 read_file 后再修改；新文件使用 expected_hash=new。');
    let content = args.content;
    if (edit) {
      if (!original) throw new Error('修改的文件不存在。');
      if (typeof args.old_text !== 'string' || !args.old_text || typeof args.new_text !== 'string') throw new Error('精确替换需要非空原文和替换文本。');
      const oldText = args.old_text.replace(/\r\n/g, '\n'); const normalized = original.content.replace(/\r\n/g, '\n');
      if (normalized.split(oldText).length !== 2) throw new Error('原文未匹配或出现多次，请读取正确范围并提供唯一上下文。');
      content = normalized.replace(oldText, () => args.new_text.replace(/\r\n/g, '\n'));
      if (original.content.includes('\r\n')) content = content.replace(/\n/g, '\r\n');
    }
    if (typeof content !== 'string' || content.includes('\0') || Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw new Error('写入内容必须是 2 MB 以内的文本。');
    content = content.replace(/^\uFEFF/, '');
    const data = Buffer.from(content, 'utf8'); const temporary = item.target + '.scodex-' + crypto.randomUUID() + '.tmp';
    await fs.mkdir(path.dirname(item.target), { recursive: true });
    return withFileCommit(item.target, async () => {
    try {
      await fs.writeFile(temporary, data, { flag: 'wx' });
      await guard(); if (context.signal?.aborted) throw new Error('任务已停止。');
      const fresh = await resolve(args.path, true);
      if (fresh.target !== item.target || isDirty(item.target)) throw new Error('编辑状态或路径已变化，未覆盖文件。');
      let current; try { current = await fs.readFile(item.target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (original ? !current || hash(current) !== original.hash : Boolean(current)) throw new Error('写入前文件被其他程序修改，未覆盖原文件。');
      if (original) await fs.rename(temporary, item.target);
      else { await fs.link(temporary, item.target); await fs.unlink(temporary); }
      const savedHash = hash(await fs.readFile(item.target));
      if (savedHash !== hash(data)) throw new Error('写入后文件发生变化，请重新读取检查。');
      observed.set(item.target, savedHash); onFileChanged(item.target);
      return { ok: true, path: item.relative, hash: savedHash, bytes: data.length,
        activity: { title: TITLES[edit ? 'edit_file' : 'write_file'], path: item.target, detail: item.relative, diff: fileDiff(item.relative, original?.content || '', content), output: `${data.length} 字节 · 已写入并回读校验` } };
    } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
    });
  }
  async function execute(name, args, context = {}) {
    if (Array.isArray(allowedTools) && !allowedTools.includes(name)) throw new Error('当前子任务未开放此工具。');
    await guard(); if (context.signal?.aborted) throw new Error('任务已停止。');
    context.onProgress?.({ title: TITLES[name] || name, detail: typeof args.path === 'string' ? args.path : '' });
    if (name === 'write_file' || name === 'edit_file') return save(args, name === 'edit_file', context);
    if (name === 'update_plan') {
      if (!Array.isArray(args.steps) || !args.steps.length || args.steps.length > 12 || args.steps.filter((s) => s?.status === 'in_progress').length > 1
        || args.steps.some((s) => !s || typeof s.text !== 'string' || !s.text.trim() || s.text.length > 300 || !['pending', 'in_progress', 'completed'].includes(s.status))) throw new Error('计划应为 1–12 个有效步骤，且最多一个进行中。');
      const plan = args.steps.map((s) => ({ text: s.text, status: s.status }));
      return { ok: true, plan, activity: { title: TITLES[name], plan } };
    }
    const item = await resolve(name === 'run_command' ? args.cwd || '.' : args.path || '.');
    if (name === 'run_command') {
      if (readOnly) throw new Error('规划模式不能执行命令。');
      if (!(await fs.stat(item.target)).isDirectory()) throw new Error('命令目录不是文件夹。');
      const rules = await instructions(path.join(item.target, '__scodex_command__')); if (rules.length) return rulesFirst(rules);
      await authorize('agent-command', { path: item.target, command: args.command }, context);
      await guard(); if (context.signal?.aborted) throw new Error('任务已停止。');
      context.onProgress?.({ title: TITLES[name], detail: args.command, path: item.target });
      const commandEnvironment = await environment();
      const result = await commandCapture(async () => {
        await guard(); if (context.signal?.aborted) throw new Error('任务已停止。');
        context.onProgress?.({ title: TITLES[name], detail: args.command, path: item.target });
        return runAgentCommand({ command: args.command, cwd: item.target, timeoutMs: args.timeout_ms, signal: context.signal, environment: commandEnvironment, onOutput: context.onProgress });
      }, context);
      return { ...result, activity: { title: TITLES[name], detail: args.command, path: item.target, output: result.output, exitCode: result.exitCode, truncated: result.truncated } };
    }
    await authorize('file-read', { path: item.target }, context);
    if (name === 'list_directory') {
      const entries = await fs.readdir(item.target, { withFileTypes: true });
      const visible = entries.filter((entry) => !IGNORED.has(entry.name) && (fullAccess || !entry.isSymbolicLink() && !sensitive(entry.name)));
      const items = visible.slice(0, 250).map((e) => ({ name: e.name, directory: e.isDirectory() }));
      return { ok: true, path: item.relative, items, truncated: visible.length > items.length, activity: { title: TITLES[name], detail: item.relative, output: items.map((i) => (i.directory ? '📁 ' : '') + i.name).join('\n') } };
    }
    if (name === 'read_file') {
      const value = await read(item.target); observed.set(item.target, value.hash);
      const lines = value.content.split(/\r?\n/); const start = Math.max(1, Math.floor(Number(args.start_line) || 1)); const count = Math.min(400, Math.max(1, Math.floor(Number(args.max_lines) || 240)));
      let excerpt = lines.slice(start - 1, start - 1 + count).map((line, i) => `${start + i}: ${line}`).join('\n'); const cut = excerpt.length > 32_000; excerpt = excerpt.slice(0, 32_000);
      return { ok: true, path: item.relative, hash: value.hash, total_lines: lines.length, start_line: start, content: excerpt,
        truncated: cut || start > 1 || start - 1 + count < lines.length, instructions: await instructions(item.target),
        activity: { title: TITLES[name], path: item.target, detail: `${item.relative} · 从第 ${start} 行`, output: excerpt.slice(0, 12_000) } };
    }
    if (name === 'search_text') {
      if (typeof args.query !== 'string' || !args.query || args.query.length > 200) throw new Error('搜索内容应为 1–200 个字符。');
      const queue = [{ target: item.target, depth: 0 }]; const matches = []; let visited = 0; let truncated = false;
      for (let i = 0; i < queue.length; i += 1) {
        await guard(); if (context.signal?.aborted) throw new Error('任务已停止。');
        if (++visited > 6000 || matches.length >= 60) { truncated = true; break; }
        const entry = queue[i]; let info; try { info = await fs.lstat(entry.target); } catch { continue; }
        if (!fullAccess && (info.isSymbolicLink() || sensitive(path.relative(item.root, entry.target)))) continue;
        if (info.isDirectory()) {
          if (entry.depth >= 8) { truncated = true; continue; }
          let children; try { children = await fs.readdir(entry.target, { withFileTypes: true }); } catch { continue; }
          for (const child of children) if (!IGNORED.has(child.name) && (fullAccess || !child.isSymbolicLink() && !sensitive(child.name))) queue.push({ target: path.join(entry.target, child.name), depth: entry.depth + 1 });
        } else if (info.isFile() && info.size <= 512 * 1024) {
          try {
            const fresh = await resolve(entry.target); const value = await read(fresh.target); const lines = value.content.split(/\r?\n/);
            for (const [index, line] of lines.entries()) if (line.includes(args.query)) { matches.push({ path: fresh.relative, line: index + 1, text: line.slice(0, 500) }); if (matches.length >= 60) { truncated = true; break; } }
          } catch {}
        }
      }
      return { ok: true, matches, truncated, activity: { title: TITLES[name], detail: `${args.query} · ${item.relative}`, output: matches.map((m) => `${m.path}:${m.line} ${m.text}`).join('\n').slice(0, 12_000) } };
    }
    throw new Error('未知工具。');
  }
  return { execute, projectFiles: { resolve, instructions }, definitions: AGENT_TOOLS.filter((t) => (!readOnly || !['write_file', 'edit_file', 'run_command'].includes(t.function.name)) && (!Array.isArray(allowedTools) || allowedTools.includes(t.function.name))).map((definition) => fullAccess ? { ...definition, function: { ...definition.function, description: definition.function.description + ' 完整访问已启用，可按当前 Windows 账号权限使用项目外绝对路径。' } } : definition),
    async projectInstructions() { try { const item = await resolve('AGENTS.md'); return (await readInstructionFile(item.target)).content; } catch (error) { if (error.code === 'ENOENT') return ''; throw error; } } };
}

module.exports = { AGENT_TOOLS, MAX_FILE_BYTES, TITLES, createAgentTools, fileDiff, sensitive };
