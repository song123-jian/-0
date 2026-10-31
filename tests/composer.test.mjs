import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { searchWorkspace } = require('../electron/workspace-search.cjs');
const { normalizePreferences, assertContextAccess } = require('../electron/preferences.cjs');
const { normalizeLibrary } = require('../electron/conversations.cjs');
const { goalInstruction } = require('../electron/chat-policy.cjs');

test('permission defaults are compatible and chat-only rejects local context before model requests', () => {
  assert.equal(normalizePreferences({ contextAccess: 'full' }).contextAccess, 'manual');
  assert.equal(normalizePreferences({ contextAccess: 'manual' }).contextAccess, 'manual');
  assert.equal(normalizePreferences({ contextAccess: 'chat-only' }).contextAccess, 'chat-only');
  assert.doesNotThrow(() => assertContextAccess({ contextAccess: 'manual' }, { fileContext: '用户选中的附件' }));
  assert.doesNotThrow(() => assertContextAccess({ contextAccess: 'chat-only' }, { prompt: '问题' }));
  const image = `data:image/jpeg;base64,${Buffer.from('image').toString('base64')}`;
  for (const payload of [{ fileContext: '文件' }, { skill: '指引' }, { images: [{ dataUrl: image }] }]) {
    assert.throws(() => assertContextAccess({ contextAccess: 'chat-only' }, payload), /仅对话/);
  }
});

test('conversation goals survive save/load, default safely and have a fixed size limit', () => {
  const input = { conversations: [{ id: 'goal-chat', goal: '完成本次任务 🚀', messages: [] }] };
  const normalized = normalizeLibrary(input);
  assert.equal(normalized.conversations[0].goal, '完成本次任务 🚀');
  assert.deepEqual(normalizeLibrary(JSON.parse(JSON.stringify(normalized))), normalized);
  assert.equal(normalizeLibrary({ conversations: [{ goal: {} }] }).conversations[0].goal, '');
  assert.equal(normalizeLibrary({ conversations: [{ goal: 'a'.repeat(2100) }] }).conversations[0].goal.length, 2000);
});

test('goals use a separate bounded instruction without consuming the message limit', () => {
  assert.equal(goalInstruction(null), '');
  assert.equal(goalInstruction({ goal: 'invalid' }), '');
  assert.equal(goalInstruction('   '), '');
  assert.match(goalInstruction('  交付目标 🚀  '), /目标：\n交付目标 🚀\n/);
  const instruction = goalInstruction('g'.repeat(2100));
  assert.ok(instruction.includes('g'.repeat(2000)));
  assert.ok(!instruction.includes('g'.repeat(2001)));
  assert.match(instruction, /不宣称在后台持续执行/);
});

test('file search includes nested names, skips hidden/generated paths and does not follow junctions', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-search-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-search-outside-'));
  try {
    for (const directory of ['sub', '.private', 'node_modules']) await fs.mkdir(path.join(root, directory));
    await fs.writeFile(path.join(root, 'sub', '中文-Search.txt'), 'not read by filename search');
    await fs.writeFile(path.join(root, '.private', 'Search.txt'), 'hidden');
    await fs.writeFile(path.join(root, 'node_modules', 'Search.txt'), 'generated');
    await fs.writeFile(path.join(outside, 'Search-secret.txt'), 'outside');
    await fs.symlink(outside, path.join(root, 'Search-link'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = await searchWorkspace(root, 'search');
    assert.deepEqual(result.items.map((item) => item.name), ['中文-Search.txt']);
    assert.equal((await searchWorkspace(root, '')).items.length, 0);
    for (let index = 0; index < 45; index++) await fs.writeFile(path.join(root, `limit-${index}.txt`), '');
    const limited = await searchWorkspace(root, 'limit-');
    assert.equal(limited.items.length, 40);
    assert.equal(limited.truncated, true);
  } finally {
    for (const target of [root, outside]) assert.equal(path.dirname(path.resolve(target)), path.resolve(os.tmpdir()), 'Cleanup remains inside the test temp directory');
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});
