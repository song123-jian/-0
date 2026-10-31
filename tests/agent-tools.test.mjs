import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createAgentTools, MAX_FILE_BYTES } = require('../electron/agent-tools.cjs');
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-agent-tools-'));
  t.after(async () => { assert.equal(path.dirname(root), path.resolve(os.tmpdir())); await fs.rm(root, { recursive: true, force: true }); });
  return { root, tools: createAgentTools({ workspaceRoot: root, ...options }) };
}

test('precise edits preserve CRLF, read back and emit a file difference', async (t) => {
  const changed = []; const { root, tools } = await fixture(t, { onFileChanged: (p) => changed.push(p) });
  await fs.writeFile(path.join(root, 'a.js'), 'const 中文 = 1;\r\nconsole.log(中文);\r\n');
  const before = await tools.execute('read_file', { path: 'a.js' });
  const result = await tools.execute('edit_file', { path: 'a.js', expected_hash: before.hash, old_text: 'const 中文 = 1;\nconsole.log(中文);', new_text: 'const 中文 = 2;\nconsole.log(中文);' });
  assert.equal(await fs.readFile(path.join(root, 'a.js'), 'utf8'), 'const 中文 = 2;\r\nconsole.log(中文);\r\n');
  assert.notEqual(result.hash, before.hash); assert.match(result.activity.diff, /-const 中文 = 1;\n\+const 中文 = 2;/); assert.equal(changed.length, 1);
});

test('stale, unobserved or ambiguous edits cannot replace user changes', async (t) => {
  const { root, tools } = await fixture(t); const file = path.join(root, 'file.txt');
  await fs.writeFile(file, 'repeat repeat'); const before = await tools.execute('read_file', { path: 'file.txt' });
  await assert.rejects(tools.execute('edit_file', { path: 'file.txt', expected_hash: before.hash, old_text: 'repeat', new_text: 'x' }), /多次/);
  await fs.writeFile(file, '用户的新内容');
  await assert.rejects(tools.execute('write_file', { path: 'file.txt', expected_hash: before.hash, content: '旧候选' }), /基线/);
  await assert.rejects(tools.execute('write_file', { path: 'file.txt', expected_hash: 'new', content: '覆盖' }), /基线/);
  assert.equal(await fs.readFile(file, 'utf8'), '用户的新内容');
});

test('new files are UTF8 without BOM; dirty files and cancel guard remain protected', async (t) => {
  let dirty = false; const { root, tools } = await fixture(t, { isDirty: () => dirty });
  const result = await tools.execute('write_file', { path: '子目录/新文件.txt', expected_hash: 'new', content: '\uFEFF新建中文\n' });
  assert.equal((await fs.readFile(path.join(root, '子目录', '新文件.txt'))).toString('hex').startsWith('efbbbf'), false);
  dirty = true;
  await assert.rejects(tools.execute('write_file', { path: result.path, expected_hash: result.hash, content: '覆盖' }), /未保存/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(tools.execute('write_file', { path: 'cancel.txt', expected_hash: 'new', content: '' }, { signal: controller.signal }), /停止/);
  await assert.rejects(fs.access(path.join(root, 'cancel.txt')));
});

test('ordinary text tools reject binary and oversized files for reads and writes', async (t) => {
  const { root, tools } = await fixture(t);
  await fs.writeFile(path.join(root, 'binary.bin'), Buffer.from([0, 1, 2, 3]));
  await fs.writeFile(path.join(root, 'oversized.txt'), Buffer.alloc(MAX_FILE_BYTES + 1, 65));
  await assert.rejects(tools.execute('read_file', { path: 'binary.bin' }), /二进制/);
  await assert.rejects(tools.execute('read_file', { path: 'oversized.txt' }), /2 MB|大小限制/);
  await assert.rejects(tools.execute('write_file', { path: 'binary-output.txt', expected_hash: 'new', content: '可见文本\u0000不可见二进制' }), /2 MB|二进制/);
  await assert.rejects(tools.execute('write_file', { path: 'oversized-output.txt', expected_hash: 'new', content: 'A'.repeat(MAX_FILE_BYTES + 1) }), /2 MB/);
  await assert.rejects(fs.access(path.join(root, 'binary-output.txt')));
  await assert.rejects(fs.access(path.join(root, 'oversized-output.txt')));
});

test('path traversal, secrets, reference configuration and directory junctions are blocked', async (t) => {
  const { root, tools } = await fixture(t);
  for (const file of ['../outside', '.env', 'secrets/key.dpapi', '.codex/config.toml', '.scodex/codex-settings.json', '.git/config']) await assert.rejects(tools.execute('read_file', { path: file }), /项目|保护|Git/);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-agent-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.symlink(outside, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(tools.execute('write_file', { path: 'link/out.txt', expected_hash: 'new', content: 'no' }), /符号链接|联接/);
  await assert.rejects(fs.access(path.join(outside, 'out.txt')));
});

test('planning tools inspect project instructions and search while rejecting writes and commands', async (t) => {
  const { root, tools } = await fixture(t, { readOnly: true });
  await fs.writeFile(path.join(root, 'AGENTS.md'), '请保留中文。'); await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'src', 'AGENTS.md'), '本目录需要验证。'); await fs.writeFile(path.join(root, 'src', 'app.js'), '查找目标\n');
  await fs.mkdir(path.join(root, 'node_modules')); await fs.writeFile(path.join(root, 'node_modules', 'hidden'), '查找目标'); await fs.writeFile(path.join(root, '.env'), '查找目标');
  const result = await tools.execute('read_file', { path: 'src/app.js' }); assert.equal(result.instructions.length, 2);
  const found = await tools.execute('search_text', { path: '.', query: '查找目标' }); assert.equal(found.matches.length, 1); assert.equal(found.matches[0].path, 'src/app.js');
  assert.equal(tools.definitions.some((tool) => tool.function.name === 'run_command'), false);
  await assert.rejects(tools.execute('write_file', { path: 'no.txt', content: '', expected_hash: 'new' }), /只读/);
  await assert.rejects(tools.execute('run_command', { command: 'echo no' }), /规划/);
  await assert.rejects(fs.access(path.join(root, 'no.txt')));
});

test('user changes occurring during permission approval remain intact', async (t) => {
  let root; const fixtureData = await fixture(t, { authorize: async (op) => { if (op === 'file-write') await fs.writeFile(path.join(root, 'a.txt'), 'concurrent'); } });
  root = fixtureData.root; await fs.writeFile(path.join(root, 'a.txt'), 'baseline');
  const before = await fixtureData.tools.execute('read_file', { path: 'a.txt' });
  await assert.rejects(fixtureData.tools.execute('write_file', { path: 'a.txt', expected_hash: before.hash, content: 'candidate' }), /基线/);
  assert.equal(await fs.readFile(path.join(root, 'a.txt'), 'utf8'), 'concurrent');
});
