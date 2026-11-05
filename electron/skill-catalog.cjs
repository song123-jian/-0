const { createSkillContext, DEFINITIONS, MAX_BYTES } = require('./skill-context.cjs');
const tool = (name, description, properties, required = []) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });
const idField = { type: 'string', maxLength: 1024, description: 'skill_search 返回的真实技能 ID' };
const CATALOG_TOOLS = [
  tool('skill_search', '自动发现当前可用 Skill；只返回名称、用途和 ID，不加载或执行正文。先按任务搜索，再读取最相关指引；可空查询分页。', { query: { type: 'string', maxLength: 200 }, offset: { type: 'integer', minimum: 0, maximum: 10000 } }),
  tool('skill_open', '读取一个真实可用 Skill 的 SKILL.md，按 next_offset 读完整指引后使用；每轮最多三个技能，引用资料用 skill_read；不会执行脚本。', { skill_id: idField, offset: { type: 'integer', minimum: 0, maximum: MAX_BYTES }, max_chars: { type: 'integer', minimum: 1, maximum: 24000 } }, ['skill_id']),
  ...DEFINITIONS.map(def => ({ ...def, function: { ...def.function, description: def.function.description.replace('本轮已选', '本轮已加载') + ' 多个技能时用 skill_id 指定；未指定则使用最近加载的技能。', parameters: { ...def.function.parameters, properties: { ...def.function.parameters.properties, skill_id: idField } } } })),
];
function validate(name, args) {
  const schema = CATALOG_TOOLS.find(t => t.function.name === name)?.function.parameters;
  if (!schema || !args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(k => !Object.hasOwn(schema.properties, k)) || schema.required.some(k => !Object.hasOwn(args, k))) throw new Error('技能目录工具参数无效。');
  for (const [name, value] of Object.entries(args)) { const f = schema.properties[name]; if (f.type === 'string' ? typeof value !== 'string' || value.length > f.maxLength : !Number.isInteger(value) || value < f.minimum || value > f.maximum) throw new Error('技能目录参数格式无效。'); }
}
async function createSkillCatalog({ selected = null, getSkills, getPreferences, guard, authorize, signal }) {
  if (!getPreferences().skillsEnabled) return null;
  const loaded = new Map(); let recent = selected?.id || '';
  if (selected) loaded.set(selected.id, selected);
  async function available() {
    await guard(); if (signal?.aborted) throw new Error('任务已停止。');
    const prefs = getPreferences(); if (!prefs.skillsEnabled) throw new Error('技能已停用。');
    const list = (await getSkills()).filter(s => s.absolutePath && !prefs.disabledSkillIds?.includes(s.id));
    if (!getPreferences().skillsEnabled) throw new Error('技能已停用。');
    return list;
  }
  const initial = await available();
  // This installed preference skill explicitly applies before every new task.
  // Other skills remain model-selected from metadata, never guessed from filenames.
  const defaultSkill = initial.find(s => s.name === 'requirement-understanding');
  if (defaultSkill && !loaded.has(defaultSkill.id) && loaded.size < 3) loaded.set(defaultSkill.id, await createSkillContext({ skillId: defaultSkill.id, getSkills, getPreferences, guard, authorize, signal }));
  recent ||= defaultSkill?.id || '';
  return { definitions: CATALOG_TOOLS,
    instruction: '技能自动发现已启用，可用技能 ' + initial.length + ' 个。用户无需手选。专业任务先 skill_search 查看名称和描述，按 AGENTS 评估最相关零至三个技能，再 skill_open 读取必要完整指引；引用资料只用该包内 skill_read/skill_list。不要用无关技能凑数；遵守停用设置、现有授权和权限。结束时如实列出使用的 Skill，不声称未调用的能力。\n\n' + [...loaded.values()].map(s => '已从本机核验加载的 SKILL.md（' + s.name + '，ID ' + s.id + '，SHA256 ' + s.hash + '）：\n' + s.content).join('\n\n'),
    async execute(name, args, context = {}) {
      validate(name, args); const list = await available();
      if (name === 'skill_search') {
        const text = (args.query || '').toLowerCase();
        const words = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(text)].filter(s => s.isWordLike).map(s => s.segment);
        const matches = list.map(s => ({ s, score: words.reduce((n,w) => n + (s.name.toLowerCase().includes(w) ? 3 : 0) + (s.description?.toLowerCase().includes(w) ? 1 : 0), 0) })).filter(v => !words.length || v.score > 0).sort((a,b) => b.score - a.score || a.s.name.localeCompare(b.s.name));
        const offset = args.offset || 0, entries = matches.slice(offset, offset + 20).map(({s}) => ({ id:s.id, name:s.name, description:s.description || '', source:s.sourceLabel || '', requiredMcp:s.requiredMcp || '' }));
        return { ok:true, entries, total:matches.length, next_offset:offset + 20 < matches.length ? offset + 20 : null, activity:{title:'发现可用技能',detail:args.query || '技能目录',output:JSON.stringify(entries)} };
      }
      const skillId = args.skill_id || recent;
      if (!skillId || !list.some(s => s.id === skillId)) throw new Error('请先 skill_search 选择当前可用、未停用的技能。');
      if (!loaded.has(skillId)) {
        if (name !== 'skill_open') throw new Error('请先 skill_open 加载该技能指引。');
        if (loaded.size >= 3) throw new Error('本轮最多使用三个相关技能；不要继续加载无关技能。');
        loaded.set(skillId, await createSkillContext({ skillId, getSkills, getPreferences, guard, authorize, signal }));
      }
      const selected = loaded.get(skillId), { skill_id: _id, ...fields } = args; recent = skillId;
      return selected.execute(name === 'skill_open' ? 'skill_read' : name, name === 'skill_open' ? { ...fields, path:'SKILL.md' } : fields, context);
    },
  };
}
module.exports = { createSkillCatalog, CATALOG_TOOLS };
