const { createSkillContext, DEFINITIONS, MAX_BYTES } = require('./skill-context.cjs');
const crypto = require('node:crypto');
const tool = (name, description, properties, required = []) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });
const idField = { type: 'string', maxLength: 1024, description: 'skill_search 返回的真实技能 ID' };
const CATALOG_TOOLS = [
  tool('skill_search', '自动发现当前可用 Skill；只返回名称、用途和 ID，不加载或执行正文。先按任务搜索，再读取最相关指引；可空查询分页。', { query: { type: 'string', maxLength: 200 }, offset: { type: 'integer', minimum: 0, maximum: 10000 } }),
  tool('skill_open', '读取真实 Skill 的 SKILL.md；不同职责不设数量上限，功能重复或已读内容复用已有指引。按 next_offset 读完必要内容；引用资料用 skill_read，不执行脚本。', { skill_id: idField, offset: { type: 'integer', minimum: 0, maximum: MAX_BYTES }, max_chars: { type: 'integer', minimum: 1, maximum: 24000 } }, ['skill_id']),
  ...DEFINITIONS.map(def => ({ ...def, function: { ...def.function, description: def.function.description.replace('本轮已选', '本轮已加载') + ' 多个技能时用 skill_id 指定；未指定则使用最近加载的技能。', parameters: { ...def.function.parameters, properties: { ...def.function.parameters.properties, skill_id: idField } } } })),
];
function validate(name, args) {
  const schema = CATALOG_TOOLS.find(t => t.function.name === name)?.function.parameters;
  if (!schema || !args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(k => !Object.hasOwn(schema.properties, k)) || schema.required.some(k => !Object.hasOwn(args, k))) throw new Error('技能目录工具参数无效。');
  for (const [name, value] of Object.entries(args)) { const f = schema.properties[name]; if (f.type === 'string' ? typeof value !== 'string' || value.length > f.maxLength : !Number.isInteger(value) || value < f.minimum || value > f.maximum) throw new Error('技能目录参数格式无效。'); }
}
const normalized = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const skillName = value => normalized(value).split(':').filter(Boolean).at(-1) || '';
function bodyHash(content) {
  const body = String(content || '').replace(/\r\n?/g, '\n').replace(/^\uFEFF?---\n[\s\S]*?\n---(?:\n|$)/, '').trim();
  return body ? crypto.createHash('sha256').update(body).digest('hex') : '';
}
async function createSkillCatalog({ selected = null, getSkills, getPreferences, guard, authorize, signal }) {
  if (!getPreferences().skillsEnabled) return null;
  const loaded = new Map(), pages = new Map(); let recent = selected?.id || '';
  if (selected) loaded.set(selected.id, selected);
  async function available() {
    await guard(); if (signal?.aborted) throw new Error('任务已停止。');
    const prefs = getPreferences(); if (!prefs.skillsEnabled) throw new Error('技能已停用。');
    const list = (await getSkills()).filter(s => s.absolutePath && !prefs.disabledSkillIds?.includes(s.id));
    if (!getPreferences().skillsEnabled) throw new Error('技能已停用。');
    return list;
  }
  const initial = await available();
  const loadedMetadata = new Map(initial.map(item => [item.id, item]));
  // This installed preference skill explicitly applies before every new task.
  // Other skills remain model-selected from metadata, never guessed from filenames.
  const defaultSkill = initial.find(s => s.name === 'requirement-understanding');
  if (defaultSkill && !loaded.has(defaultSkill.id)) {
    const prerequisite = await createSkillContext({ skillId: defaultSkill.id, getSkills, getPreferences, guard, authorize, signal });
    const duplicate = [...loaded.values()].some(item => (bodyHash(item.content) && bodyHash(item.content) === bodyHash(prerequisite.content))
      || (skillName(item.name) === skillName(prerequisite.name) && normalized(loadedMetadata.get(item.id)?.description) && normalized(loadedMetadata.get(item.id)?.description) === normalized(defaultSkill.description)));
    if (!duplicate) loaded.set(defaultSkill.id, prerequisite);
  }
  recent ||= defaultSkill?.id || '';
  // Initial packages are already included in the system context, not pending pages.
  for (const item of loaded.values()) pages.set(item.id + '\0SKILL.md', { hash: item.hash, ranges: [[0, item.content.length]] });
  const loadedSkills = () => [...loaded.values()].map(item => ({ id: item.id, name: item.name }));
  return { definitions: CATALOG_TOOLS,
    initialActivities: loadedSkills().map(item => ({ name: 'skill_use', title: '使用 Skill', detail: item.name, output: '已核验并加载到本轮上下文；后续复用，不重复加载。' })),
    instruction: '技能自动发现已启用，可用技能 ' + initial.length + ' 个。用户无需手选。本程序不设 Skill 数量上限；仅选择任务需要且职责互补的 Skill，不调用功能重复的 Skill。先 skill_search 查看名称、用途和 loaded_skills，比较已加载职责；功能已覆盖则复用，不能因名称不同再次加载。不同职责按需 skill_open 读取必要完整指引；引用资料只用该包内 skill_read/skill_list。already_loaded 表示正文已在本轮上下文，不要重复打开或重读；需要后续分页则使用 next_offset。遵守生效 AGENTS、停用设置、授权和权限。首次使用应说明名称与用途，结束时如实列出使用的 Skill，不声称未调用的能力。\n\n' + [...loaded.values()].map(s => '已从本机核验加载的 SKILL.md（' + s.name + '，ID ' + s.id + '，SHA256 ' + s.hash + '）：\n' + s.content).join('\n\n'),
    async execute(name, args, context = {}) {
      validate(name, args); const list = await available();
      if (name === 'skill_search') {
        const text = (args.query || '').toLowerCase();
        const words = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(text)].filter(s => s.isWordLike).map(s => s.segment);
        const matches = list.map(s => ({ s, score: words.reduce((n,w) => n + (s.name.toLowerCase().includes(w) ? 3 : 0) + (s.description?.toLowerCase().includes(w) ? 1 : 0), 0) })).filter(v => !words.length || v.score > 0).sort((a,b) => b.score - a.score || a.s.name.localeCompare(b.s.name));
        const offset = args.offset || 0, entries = matches.slice(offset, offset + 20).map(({s}) => ({ id:s.id, name:s.name, description:s.description || '', source:s.sourceLabel || '', requiredMcp:s.requiredMcp || '' }));
        return { ok:true, entries, loaded_skills:loadedSkills(), total:matches.length, next_offset:offset + 20 < matches.length ? offset + 20 : null, activity:{title:'发现 Skill',detail:args.query || '技能目录',output:JSON.stringify(entries)} };
      }
      const skillId = args.skill_id || recent;
      if (name === 'skill_open') context.onProgress?.({ title: '加载 Skill', detail: list.find(s => s.id === skillId)?.name || skillId });
      if (!skillId || !list.some(s => s.id === skillId)) throw new Error('请先 skill_search 选择当前可用、未停用的技能。');
      const metadata = list.find(s => s.id === skillId);
      context.onProgress?.({ title: name === 'skill_open' ? '加载 Skill' : '读取技能资料', detail: metadata.name });
      if (!loaded.has(skillId)) {
        if (name !== 'skill_open') throw new Error('请先 skill_open 加载该技能指引。');
        const candidate = await createSkillContext({ skillId, getSkills, getPreferences, guard, authorize, signal });
        const duplicate = [...loaded.values()].find(item => (bodyHash(item.content) && bodyHash(item.content) === bodyHash(candidate.content))
          || (skillName(item.name) === skillName(candidate.name) && normalized(loadedMetadata.get(item.id)?.description) && normalized(loadedMetadata.get(item.id)?.description) === normalized(metadata.description)));
        if (duplicate) {
          // Validate the original package too; reuse must never bypass live policy.
          if (!list.some(item => item.id === duplicate.id)) throw new Error('原技能已停用或卸载，请在新任务中重新选择。');
          await duplicate.execute('skill_read', { path: 'SKILL.md', max_chars: 1 }, context);
          recent = duplicate.id;
          let unread = 0;
          for (const [start, end] of pages.get(duplicate.id + '\0SKILL.md')?.ranges || []) { if (start > unread) break; unread = Math.max(unread, end); }
          return { ok: true, already_loaded: true, reused: true, skill_id: duplicate.id, requested_skill_id: skillId, skill_name: duplicate.name,
            next_offset: unread < duplicate.content.length ? unread : null,
            loaded_skills: loadedSkills(), reason: '职责或正文与已加载 Skill 重复，请复用原指引；未读分页和补充资料使用返回的 skill_id。',
            activity: { title: '复用 Skill', detail: duplicate.name, output: metadata.name + ' 与已加载技能重复，未再次加载正文。' } };
        }
        loaded.set(skillId, candidate);
        loadedMetadata.set(skillId, metadata);
      }
      const selected = loaded.get(skillId), { skill_id: _id, ...fields } = args; recent = skillId;
      const result = await selected.execute(name === 'skill_open' ? 'skill_read' : name, name === 'skill_open' ? { ...fields, path:'SKILL.md' } : fields, context);
      if (name === 'skill_list') return result;
      const pageKey = skillId + '\0' + result.path, prior = pages.get(pageKey), start = result.offset, end = start + result.content.length;
      const reused = prior?.hash === result.hash && prior.ranges.some(([a, b]) => a <= start && b >= end);
      if (!reused) {
        const ranges = prior?.hash === result.hash ? [...prior.ranges, [start, end]] : [[start, end]];
        const merged = [];
        for (const range of ranges.sort((a, b) => a[0] - b[0])) { const last = merged.at(-1); if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]); else merged.push(range); }
        pages.set(pageKey, { hash: result.hash, ranges: merged });
      }
      return { ...result, ...(reused ? { content: '', already_loaded: true, reused: true, reason: '该内容已在本轮上下文，直接复用；如需未读部分请使用 next_offset。' } : {}), skill_name: selected.name, loaded_skills: loadedSkills(),
        activity: { ...result.activity, title: reused ? '复用 Skill' : name === 'skill_open' ? '使用 Skill' : '读取技能资料', detail: selected.name,
          ...(reused ? { output: '已读取 ' + result.path + '，复用本轮已有内容，未重复加载正文。' } : {}) } };
    },
  };
}
module.exports = { createSkillCatalog, CATALOG_TOOLS };
