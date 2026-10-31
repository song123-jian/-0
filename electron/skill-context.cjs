const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { sensitive } = require('./agent-tools.cjs');

const MAX_BYTES = 128 * 1024;
const MAX_ENTRIES = 100;
const MAX_OUTPUT = 24000;
const changed = () => new Error('所选技能已停用、卸载或更改，请重新选择技能。');
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const key = (value) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
const field = (description) => ({ type: 'string', description, maxLength: 1024 });
const tool = (name, description, properties, required = []) => ({ type: 'function', function: {
  name, description, parameters: { type: 'object', properties, required, additionalProperties: false },
} });
const DEFINITIONS = [
  tool('skill_list', '列出本轮已选技能包内的直接文件和目录，每页最多100项。路径相对SKILL.md所在目录；不扫描其他技能或执行脚本。', {
    path: field('相对技能包的目录，默认 .'), offset: { type: 'integer', minimum: 0, maximum: 10000 },
  }),
  tool('skill_read', '读取本轮已选技能包内128KB以内的UTF-8资料，返回SHA256和有界分页。路径相对SKILL.md；不能越界、读取链接或凭据，不执行文件。', {
    path: field('相对技能包的文件路径'), offset: { type: 'integer', minimum: 0, maximum: MAX_BYTES },
    max_chars: { type: 'integer', minimum: 1, maximum: MAX_OUTPUT },
  }, ['path']),
];

function relativePath(value = '.') {
  if (typeof value !== 'string' || !value.trim() || value.length > 1024 || /[\x00-\x1f\x7f:]/.test(value)
      || path.isAbsolute(value) || path.win32.isAbsolute(value)) throw new Error('技能资料必须使用包内相对路径。');
  const parts = value.split(/[\\/]/).filter((part) => part && part !== '.');
  if (parts.includes('..')) throw new Error('技能资料不能越出所选技能包。');
  const relative = parts.join(path.sep);
  if (sensitive(relative) || parts.some((part) => ['.git', 'node_modules', '.cache'].includes(part.toLowerCase()))) {
    throw new Error('技能资料不读取凭据或受保护目录。');
  }
  return relative;
}

async function safePath(target) {
  const absolute = path.resolve(target);
  let ancestor = path.parse(absolute).root;
  for (const part of absolute.slice(ancestor.length).split(path.sep).filter(Boolean)) {
    ancestor = path.join(ancestor, part);
    if ((await fs.lstat(ancestor)).isSymbolicLink()) throw new Error('技能资料不跨越符号链接或目录联接。');
  }
  if (key(await fs.realpath(absolute)) !== key(absolute)) throw new Error('技能资料路径已变化。');
  return absolute;
}

async function readText(target) {
  await safePath(target);
  const handle = await fs.open(target, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > MAX_BYTES) throw new Error('技能资料只读取128KB以内的普通文本文件。');
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    const after = await handle.stat();
    const current = await fs.stat(await safePath(target));
    if (length > MAX_BYTES) throw new Error('技能资料超过128KB限制。');
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs
        || current.dev !== after.dev || current.ino !== after.ino || current.size !== after.size || current.mtimeMs !== after.mtimeMs) {
      throw new Error('技能资料在读取期间已变化，请重新读取。');
    }
    const data = buffer.subarray(0, length);
    let content;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(data); }
    catch { throw new Error('技能资料不是有效UTF-8文本。'); }
    if (content.includes('\0')) throw new Error('技能资料不能读取二进制文件。');
    return { content, hash: hash(data), bytes: length };
  } finally { await handle.close(); }
}

function validate(name, args) {
  const rule = DEFINITIONS.find((item) => item.function.name === name)?.function.parameters;
  if (!rule || !args || typeof args !== 'object' || Array.isArray(args)
      || Object.keys(args).some((k) => !Object.hasOwn(rule.properties, k)) || rule.required.some((k) => !Object.hasOwn(args, k))) {
    throw new Error('技能工具参数缺失或包含未知字段。');
  }
  for (const [name, value] of Object.entries(args)) {
    const field = rule.properties[name];
    if (field.type === 'string' ? typeof value !== 'string' || value.length > field.maxLength
      : !Number.isInteger(value) || value < field.minimum || value > field.maximum) throw new Error('技能工具参数格式不正确。');
  }
}

async function createSkillContext({ skillId = '', suppliedContent = '', getSkills, getPreferences,
  guard = async () => {}, authorize = async () => {}, signal }) {
  if (!skillId) {
    if (suppliedContent) throw new Error('请选择当前可用技能，不能仅提交未经核验的技能正文。');
    return null;
  }
  if (typeof skillId !== 'string' || skillId.length > 1024 || /[\x00-\x1f\x7f]/.test(skillId)) throw changed();
  async function live(contextSignal = signal) {
    await guard();
    if (signal?.aborted || contextSignal?.aborted) throw new Error('任务已停止。');
    const prefs = getPreferences();
    if (!prefs.skillsEnabled || prefs.disabledSkillIds?.includes(skillId)) throw changed();
    const skill = (await getSkills()).find((item) => item.id === skillId);
    if (!skill?.absolutePath) throw changed();
    const target = await safePath(skill.absolutePath);
    const text = await readText(target);
    await guard();
    if (signal?.aborted || contextSignal?.aborted) throw new Error('任务已停止。');
    const current = getPreferences();
    if (!current.skillsEnabled || current.disabledSkillIds?.includes(skillId)) throw changed();
    return { id: skillId, name: skill.name, target, root: path.dirname(target), ...text };
  }
  const selected = await live();
  async function check(contextSignal) {
    const current = await live(contextSignal);
    if (key(current.target) !== key(selected.target) || current.hash !== selected.hash) throw changed();
  }
  return {
    id: selected.id, name: selected.name, content: selected.content, hash: selected.hash,
    definitions: DEFINITIONS,
    async execute(name, args, context = {}) {
      validate(name, args);
      await check(context.signal);
      const relative = relativePath(args.path);
      const target = path.join(selected.root, relative);
      await safePath(target);
      await authorize('file-read', { path: target }, context);
      await check(context.signal);
      await safePath(target);
      let result;
      if (name === 'skill_list') {
        if (!(await fs.stat(target)).isDirectory()) throw new Error('请使用skill_read读取文件。');
        const listed = [];
        for await (const entry of await fs.opendir(target)) {
          if (listed.length >= 10000) throw new Error('技能资料目录超过10000项，请限定子目录。');
          listed.push(entry);
        }
        const entries = listed.filter((entry) => {
          if (entry.isSymbolicLink() || !entry.isFile() && !entry.isDirectory()) return false;
          try { relativePath(entry.name); return true; } catch { return false; }
        }).sort((a, b) => a.name.localeCompare(b.name, 'en'));
        const offset = args.offset || 0;
        result = { entries: entries.slice(offset, offset + MAX_ENTRIES).map((entry) => ({
          path: path.join(relative, entry.name).replaceAll(path.sep, '/'), type: entry.isDirectory() ? 'directory' : 'file',
        })), total: entries.length, next_offset: offset + MAX_ENTRIES < entries.length ? offset + MAX_ENTRIES : null };
      } else {
        const text = await readText(target);
        const offset = args.offset || 0, count = args.max_chars || MAX_OUTPUT;
        const next = offset + count < text.content.length ? offset + count : null;
        result = { ...text, content: text.content.slice(offset, offset + count), offset, total_chars: text.content.length,
          truncated: next !== null, next_offset: next };
      }
      await safePath(target);
      await check(context.signal);
      return { ok: true, skill_id: skillId, path: relative.replaceAll(path.sep, '/') || '.', ...result,
        activity: { title: name === 'skill_list' ? '查看技能资料目录' : '读取技能资料', detail: selected.name,
          path: relative.replaceAll(path.sep, '/') || '.', output: JSON.stringify(result).slice(0, MAX_OUTPUT) } };
    },
  };
}

module.exports = { createSkillContext, MAX_BYTES, DEFINITIONS };
