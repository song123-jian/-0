import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const { createAgentSettingsStore } = createRequire(import.meta.url)('../electron/agent-settings-store.cjs');

test('workspace settings inherit, override, survive restart and restore shared defaults', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-settings-store-'));
  try {
    const workspace = path.join(root, 'project'); await fs.mkdir(workspace);
    const store = createAgentSettingsStore(root);
    assert.equal((await store.load(workspace)).agentSettingsScopes.workspace.inherited, true);
    await store.update({ webSearch: 'cached' });
    let state = await store.update({ outputDetail: 'high' }, 'workspace');
    assert.equal(state.agentSettings.webSearch, 'cached'); assert.equal(state.agentSettings.outputDetail, 'high');
    assert.deepEqual(JSON.parse(await fs.readFile(state.agentSettingsScopes.workspace.path, 'utf8')), { outputDetail: 'high' });
    await Promise.all([store.update({ approvalPolicy: 'on-request' }), store.update({ webSearch: 'live' })]);
    const nested = path.join(workspace, 'nested'); await fs.mkdir(nested);
    const reloaded = createAgentSettingsStore(root); state = await reloaded.load(nested);
    assert.equal(state.agentSettings.approvalPolicy, 'on-request'); assert.equal(state.agentSettings.webSearch, 'live');
    assert.equal(state.agentSettings.outputDetail, 'high');
    state = await reloaded.update(null, 'workspace');
    assert.equal(state.agentSettingsScopes.workspace.inherited, true); assert.equal(state.agentSettings.outputDetail, 'default');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('disabled inherited efforts fall back coherently and corrupt settings can be repaired', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-settings-store-'));
  try {
    const workspace = path.join(root, 'project'); await fs.mkdir(workspace);
    const store = createAgentSettingsStore(root); await store.load(workspace);
    await store.update({ defaultReasoningEffort: 'high' }, 'workspace');
    let state = await store.update({ availableReasoningEfforts: ['low'] });
    assert.equal(state.agentSettings.defaultReasoningEffort, 'low');
    state = await store.update({ availableReasoningEfforts: ['medium'] }, 'workspace');
    assert.equal(state.agentSettings.defaultReasoningEffort, 'medium');
    await fs.writeFile(path.join(root, 'codex-settings.json'), '{');
    state = await store.load(workspace); assert.match(state.agentSettingsError, /无法读取/);
    state = await store.update({ outputDetail: 'low' }); assert.equal(state.agentSettingsError, '');
    assert.throws(() => store.update({}, 'invalid'), /范围无效/);
    assert.throws(() => store.update([], 'workspace'), /格式无效/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('configuration writes reject linked workspace directories and replace hard links without changing their source', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-settings-links-'));
  try {
    const workspace = path.join(root, 'project'); const outside = path.join(root, 'outside');
    await fs.mkdir(workspace); await fs.mkdir(outside);
    const target = path.join(outside, 'codex-settings.json');
    await fs.writeFile(target, '{}');
    const link = path.join(workspace, '.scodex');
    await fs.symlink(outside, link, 'junction');
    const store = createAgentSettingsStore(root); await store.load(workspace);
    await assert.rejects(store.update({ webSearch: 'live' }, 'workspace'), /不能使用链接/);
    assert.equal(await fs.readFile(target, 'utf8'), '{}');
    await fs.unlink(link);
    await fs.link(target, path.join(root, 'codex-settings.json'));
    await store.update({ webSearch: 'live' });
    assert.equal(JSON.parse(await fs.readFile(path.join(root, 'codex-settings.json'), 'utf8')).webSearch, 'live');
    assert.equal(await fs.readFile(target, 'utf8'), '{}');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('Windows temporary rename locks recover and persistent errors preserve saved settings', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-settings-lock-'));
  const original = fs.rename;
  try {
    const store = createAgentSettingsStore(root); await store.load(root);
    await store.update({ webSearch: 'cached' });
    let attempts = 0;
    fs.rename = async (...args) => { if (++attempts <= 2) throw Object.assign(new Error('controlled sharing lock'), { code: 'EPERM' }); return original(...args); };
    await store.update({ webSearch: 'live' }); assert.equal(attempts, 3);
    fs.rename = async () => { throw Object.assign(new Error('persistent controlled lock'), { code: 'EBUSY' }); };
    await assert.rejects(store.update({ webSearch: 'disabled' }), /persistent controlled lock/);
    assert.equal(store.snapshot().agentSettings.webSearch, 'live');
    assert.equal(JSON.parse(await fs.readFile(path.join(root, 'codex-settings.json'), 'utf8')).webSearch, 'live');
    assert.deepEqual((await fs.readdir(root)).filter(file => file.endsWith('.tmp')), []);
  } finally { fs.rename = original; await fs.rm(root, { recursive: true, force: true }); }
});
