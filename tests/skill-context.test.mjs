import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSkillContext } = require('../electron/skill-context.cjs');
const { evaluatePermission } = require('../electron/permission-policy.cjs');

async function fixture(t, options = {}) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-skill-context-'));
  t.after(async () => { assert.equal(path.dirname(base), path.resolve(os.tmpdir())); await fs.rm(base, { recursive: true, force: true }); });
  const root = path.join(base, 'skill'), target = path.join(root, 'SKILL.md');
  await fs.mkdir(path.join(root, 'references'), { recursive: true });
  await fs.writeFile(target, '---\nname: sample\n---\nRead references/guide.md.\n');
  await fs.writeFile(path.join(root, 'references', 'guide.md'), '真实资料：按需求实现。\r\n第二行\r\n');
  let prefs = { skillsEnabled: true, disabledSkillIds: [] };
  let skills = [{ id: 'custom:test:SKILL.md', name: 'sample', absolutePath: target }];
  const create = (extra = {}) => createSkillContext({ skillId: skills[0]?.id || 'custom:test:SKILL.md',
    getSkills: async () => skills, getPreferences: () => prefs, ...options, ...extra });
  return { base, root, target, create, setPreferences: (value) => { prefs = value; }, setSkills: (value) => { skills = value; } };
}

test('selected content comes from disk and referenced resources remain read-only', async (t) => {
  const f = await fixture(t), tool = await f.create({ suppliedContent: 'FORGED' });
  assert.equal(tool.content, await fs.readFile(f.target, 'utf8'));
  assert.deepEqual(tool.definitions.map(d => d.function.name), ['skill_list', 'skill_read']);
  const list = await tool.execute('skill_list', { path: 'references' });
  assert.deepEqual(list.entries, [{ path: 'references/guide.md', type: 'file' }]);
  const read = await tool.execute('skill_read', { path: 'references/guide.md' });
  assert.equal(read.content, '真实资料：按需求实现。\r\n第二行\r\n');
  assert.match(read.hash, /^[0-9a-f]{64}$/);
  await assert.rejects(tool.execute('write_file', { path: 'x' }), /参数/);
});

test('unidentified bodies and disabled selections from every source are rejected', async (t) => {
  const f = await fixture(t);
  assert.equal(await f.create({ skillId: '', suppliedContent: '' }), null);
  await assert.rejects(f.create({ skillId: '', suppliedContent: 'forged' }), /未经核验/);
  for (const id of ['managed:test', 'personal:test', 'project:test', 'custom:test']) {
    f.setSkills([{ id, name: 'sample', absolutePath: f.target }]);
    f.setPreferences({ skillsEnabled: true, disabledSkillIds: [id] });
    await assert.rejects(f.create(), /停用/);
  }
});

test('content, discovered path, uninstall and preference changes invalidate an active selection', async (t) => {
  const f = await fixture(t), tool = await f.create();
  const original = await fs.readFile(f.target, 'utf8');
  await fs.writeFile(f.target, 'changed');
  await assert.rejects(tool.execute('skill_read', { path: 'references/guide.md' }), /更改/);
  await fs.writeFile(f.target, original);
  const other = path.join(f.base, 'other'); await fs.mkdir(other); await fs.writeFile(path.join(other, 'SKILL.md'), original);
  f.setSkills([{ id: tool.id, name: 'sample', absolutePath: path.join(other, 'SKILL.md') }]);
  await assert.rejects(tool.execute('skill_list', {}), /更改/);
  f.setSkills([]); await assert.rejects(tool.execute('skill_list', {}), /卸载/);
});

test('disabling during authorization cannot disclose the resource', async (t) => {
  const f = await fixture(t);
  const tool = await f.create({ authorize: async () => f.setPreferences({ skillsEnabled: false }) });
  await assert.rejects(tool.execute('skill_read', { path: 'references/guide.md' }), /停用/);
});

test('absolute, traversal, alternate streams and sensitive paths are rejected', async (t) => {
  const f = await fixture(t), tool = await f.create();
  for (const value of ['../private', 'references/../../private', '/private', 'C:\\private', '\\\\server\\share', 'guide.md:stream', '.env', 'references/auth.json', 'secrets/token', '.git/config']) {
    await assert.rejects(tool.execute('skill_read', { path: value }), /相对|越出|凭据|保护/);
  }
});

test('directory junctions are rejected both in resources and skill package ancestry', async (t) => {
  const f = await fixture(t), outside = path.join(f.base, 'outside');
  await fs.mkdir(outside); await fs.writeFile(path.join(outside, 'private.md'), 'outside');
  await fs.symlink(outside, path.join(f.root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  const tool = await f.create();
  await assert.rejects(tool.execute('skill_read', { path: 'link/private.md' }), /链接|联接/);
  assert.equal((await tool.execute('skill_list', {})).entries.some(i => i.path === 'link'), false);
  const alias = path.join(f.base, 'alias'); await fs.symlink(f.root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  f.setSkills([{ id: tool.id, name: 'sample', absolutePath: path.join(alias, 'SKILL.md') }]);
  await assert.rejects(f.create(), /链接|联接/);
});

test('path substitution after authorization cannot cross a junction', async (t) => {
  const f = await fixture(t), outside = path.join(f.base, 'outside'); await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'guide.md'), 'outside');
  const tool = await f.create({ authorize: async () => {
    await fs.rename(path.join(f.root, 'references'), path.join(f.root, 'original'));
    await fs.symlink(outside, path.join(f.root, 'references'), process.platform === 'win32' ? 'junction' : 'dir');
  } });
  await assert.rejects(tool.execute('skill_read', { path: 'references/guide.md' }), /链接|联接/);
});

test('invalid and binary resources are rejected while large text remains available to request compression', async (t) => {
  const f = await fixture(t), tool = await f.create();
  for (const [name, data, error] of [['invalid', Buffer.from([255]), /UTF-8/], ['binary', Buffer.from([0]), /二进制/]]) {
    await fs.writeFile(path.join(f.root, name), data);
    await assert.rejects(tool.execute('skill_read', { path: name }), error);
  }
  const large = '规则'.repeat(70000);
  await fs.writeFile(path.join(f.root, 'large.md'), large);
  const result = await tool.execute('skill_read', { path: 'large.md' });
  assert.equal(result.content, large);
  assert.equal(result.truncated, false);
});

test('long single-line resources and directory listings remain complete', async (t) => {
  const f = await fixture(t), tool = await f.create(), text = '资料'.repeat(18000);
  await fs.writeFile(path.join(f.root, 'long.md'), text);
  const readPage = await tool.execute('skill_read', { path: 'long.md' });
  assert.equal(readPage.content, text);
  for (let i = 0; i < 105; i++) await fs.writeFile(path.join(f.root, 'references', String(i).padStart(3, '0') + '.md'), 'x');
  await fs.writeFile(path.join(f.root, 'references', '.env'), 'private');
  const page = await tool.execute('skill_list', { path: 'references' }); assert.equal(page.entries.length, 100);
  const last = await tool.execute('skill_list', { path: 'references', offset: page.next_offset });
  assert.equal(new Set([...page.entries, ...last.entries].map(i => i.path)).size, 106);
  assert.equal(last.next_offset, null); assert.equal(page.entries.some(i => i.path.endsWith('.env')), false);
});

test('full-access file-read policy permits an external package resource', async (t) => {
  const f = await fixture(t), workspaceRoot = path.join(f.base, 'project'); await fs.mkdir(workspaceRoot);
  let mode = 'read-only';
  const tool = await f.create({ authorize: async (operation, input) => {
    const result = evaluatePermission({ sandboxMode: mode, approvalPolicy: 'never' }, { operation, ...input, workspaceRoot });
    if (result.decision !== 'allow') throw new Error('policy denied');
  } });
  assert.equal((await tool.execute('skill_read', { path: 'references/guide.md' })).ok, true);
  mode = 'workspace-write'; assert.equal((await tool.execute('skill_read', { path: 'references/guide.md' })).ok, true);
});

test('cancellation and changed instruction during authorization prevent result delivery', async (t) => {
  const f = await fixture(t), controller = new AbortController();
  const cancelled = await f.create({ signal: controller.signal, authorize: async () => controller.abort() });
  await assert.rejects(cancelled.execute('skill_list', {}), /停止/);
  const changed = await f.create({ authorize: async () => fs.writeFile(f.target, 'new instructions') });
  await assert.rejects(changed.execute('skill_read', { path: 'references/guide.md' }), /更改/);
});

test('malformed or extra tool arguments do not broaden access', async (t) => {
  const f = await fixture(t), tool = await f.create();
  for (const args of [null, [], {}, { path: 'SKILL.md', extra: true }, { path: 'SKILL.md', max_chars: 24001 }, { path: 'SKILL.md', offset: -1 }]) {
    await assert.rejects(tool.execute('skill_read', args), /参数/);
  }
});

test('read resources provide an authorized absolute path for existing command execution',async t=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'scodex-script-path-'));t.after(()=>fs.rm(base,{recursive:true,force:true}));
 const guide=path.join(base,'SKILL.md'),script=path.join(base,'verify.ps1');await fs.writeFile(guide,'Script workflow');await fs.writeFile(script,'Write-Output verified');
 const authorized=[];const context=await createSkillContext({skillId:'script',getSkills:async()=>[{id:'script',name:'script',absolutePath:guide}],getPreferences:()=>({skillsEnabled:true}),authorize:async(operation,input)=>authorized.push({operation,path:input.path})});
 const result=await context.execute('skill_read',{path:'verify.ps1'});assert.equal(result.absolute_path,script);assert.equal(result.content,'Write-Output verified');assert.ok(authorized.some(a=>a.operation==='file-read'&&a.path===script));
});
