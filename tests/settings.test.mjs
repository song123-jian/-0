import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { normalizePreferences, assertContextAccess, gitTaskInstruction, validGitBranchPrefix, FONT_FAMILIES } = require('../electron/preferences.cjs');
const { siteRuleFor, browserPermissionAllowed } = require('../electron/panel-browser.cjs');
const { createConversation, normalizeLibrary } = require('../electron/conversations.cjs');
const { readConversationLibrary, writeConversationLibrary, migrateConversationDirectory, cleanupConversationAlternate } = require('../electron/conversation-storage.cjs');
const { archiveInactiveConversations } = require('../electron/conversation-retention.cjs');
const { storageUsage } = require('../electron/storage.cjs');

async function temporary(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-settings-unit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
function libraryWithDraft(draft = '中文草稿 🚀') {
  return normalizeLibrary({ conversations: [{ ...createConversation('code'), draft }] });
}

test('settings accept supported appearance and behavior values and reject malformed input', () => {
  const defaults = normalizePreferences();
  assert.equal(defaults.fontFamily, 'Microsoft YaHei');
  assert.equal(defaults.themeMode, 'system');
  assert.equal(defaults.compressHistory, false);
  assert.equal(defaults.autoArchiveDays, 0);
  assert.equal(defaults.skillsEnabled, true);
  assert.equal(defaults.notifyOnPermissions, true);
  const saved = normalizePreferences({ themeMode: 'dark', themeStyle: 'high-contrast', accentColor: '#abcdef',
    backgroundColor: '#112233', foregroundColor: '#f1f2f3', fontFamily: 'SimSun', fontSize: 20,
    defaultFileOpen: 'system', terminalShell: 'cmd', sendShortcut: 'enter', closeConfirmation: 'always',
    defaultFullView: true, showEditorStatusBar: false, skillsEnabled: false, notifyOnPermissions: false,
    compressHistory: true, autoArchiveDays: 90, extra: 'discard' });
  assert.equal(saved.accentColor, '#ABCDEF');
  assert.equal(saved.foregroundColor, '#F1F2F3');
  assert.equal(saved.fontFamily, 'SimSun');
  assert.equal(saved.terminalShell, 'cmd');
  assert.equal(saved.sendShortcut, 'enter');
  assert.equal(saved.defaultFullView, true);
  assert.equal(saved.showEditorStatusBar, false);
  assert.equal(saved.extra, undefined);
  for (const family of FONT_FAMILIES) assert.equal(normalizePreferences({ fontFamily: family }).fontFamily, family);
  const invalid = normalizePreferences({ themeMode: 'unknown', accentColor: 'red', backgroundColor: '#123',
    foregroundColor: 'url(x)', fontFamily: 'x; color:red', fontSize: 12, autoArchiveDays: 31,
    defaultFileOpen: 'execute', terminalShell: 'arbitrary.exe', closeConfirmation: 'never', sendShortcut: 'shift' });
  assert.equal(invalid.accentColor, defaults.accentColor);
  assert.equal(invalid.backgroundColor, null);
  assert.equal(invalid.foregroundColor, null);
  assert.equal(invalid.fontFamily, defaults.fontFamily);
  assert.equal(invalid.fontSize, 16);
  assert.equal(invalid.autoArchiveDays, 0);
  assert.equal(invalid.terminalShell, 'powershell');
  assert.equal(invalid.closeConfirmation, 'busy');
  assert.equal(invalid.defaultFileOpen, 'builtin');
});

test('disabled SKILL and chat-only permissions reject attachments before execution', () => {
  assert.throws(() => assertContextAccess(normalizePreferences({ skillsEnabled: false }), { skill: 'guide' }), /停用/);
  assert.throws(() => assertContextAccess(normalizePreferences({ contextAccess: 'chat-only' }), { fileContext: 'file' }), /仅对话/);
  assert.doesNotThrow(() => assertContextAccess(normalizePreferences({ skillsEnabled: false }), { prompt: '普通问题' }));
});

test('integration preferences validate Git branches, include Chinese Git guidance, and honor disabled skill IDs', () => {
  const defaults = normalizePreferences();
  assert.equal(defaults.gitBranchPrefix, 'scodex/');
  assert.equal(defaults.gitMergeMethod, 'merge');
  assert.equal(defaults.gitForcePush, false);
  assert.equal(defaults.gitDraftPullRequest, true);
  assert.equal(defaults.gitReviewResultMode, 'inline');
  assert.equal(validGitBranchPrefix('scodex/fix-'), true);
  assert.equal(normalizePreferences({ gitBranchPrefix: 'codex/' }).gitBranchPrefix, 'codex/', 'Preserve an existing user prefix');
  assert.equal(validGitBranchPrefix('bad branch/'), false);
  assert.equal(validGitBranchPrefix('broken..name'), false);
  assert.equal(normalizePreferences({ gitBranchPrefix: 'bad branch/' }).gitBranchPrefix, 'scodex/');
  assert.throws(() => assertContextAccess(normalizePreferences({ disabledSkillIds: ['custom:abc:SKILL.md'] }), {
    skill: 'guide', skillId: 'custom:abc:SKILL.md',
  }), /停用/);
  const instruction = gitTaskInstruction(normalizePreferences({ gitCommitInstructions: '中文提交格式', gitPullRequestInstructions: '中文 PR 清单' }), {
    prompt: '请提交改动并创建 pull request',
  });
  assert.match(instruction, /中文提交格式/);
  assert.match(instruction, /中文 PR 清单/);
  assert.match(instruction, /不会因此执行 Git 命令/);
});

test('browser site rules gate navigation and device permissions per requesting host', () => {
  const preferences = normalizePreferences({ browserSiteRules: [
    { host: 'allowed.example', browse: 'allow', download: 'allow', camera: true, microphone: false },
    { host: 'blocked.example', browse: 'block', download: 'block', camera: true, microphone: true },
  ] });
  assert.equal(siteRuleFor(preferences, 'https://allowed.example/page').host, 'allowed.example');
  assert.equal(siteRuleFor(preferences, 'https://sub.allowed.example/page'), null);
  assert.equal(browserPermissionAllowed(preferences, 'camera', { requestingUrl: 'https://allowed.example/' }), true);
  assert.equal(browserPermissionAllowed(preferences, 'microphone', { requestingUrl: 'https://allowed.example/' }), false);
  assert.equal(browserPermissionAllowed(preferences, 'camera', { requestingUrl: 'https://blocked.example/' }), false);
  assert.equal(browserPermissionAllowed(preferences, 'media', { requestingUrl: 'https://allowed.example/', mediaTypes: ['video'] }), true);
  assert.equal(browserPermissionAllowed(preferences, 'media', { requestingUrl: 'https://allowed.example/', mediaTypes: ['video', 'audio'] }), false);
});

test('JSON and gzip conversions preserve Unicode and remove the alternate only after approval', async (t) => {
  const root = await temporary(t);
  const library = libraryWithDraft();
  await writeConversationLibrary(root, library);
  const original = await fs.readFile(path.join(root, 'conversations.json'));
  await writeConversationLibrary(root, library, { compressed: true });
  assert.deepEqual(await fs.readFile(path.join(root, 'conversations.json')), original);
  assert.deepEqual(await readConversationLibrary(root, { compressed: true }), library);
  assert.equal(await cleanupConversationAlternate(root, true), '');
  await assert.rejects(fs.access(path.join(root, 'conversations.json')), { code: 'ENOENT' });
  assert.deepEqual(await readConversationLibrary(root), library, 'Old preference can fall back to gzip');
  await writeConversationLibrary(root, library, { removeAlternate: true });
  await assert.rejects(fs.access(path.join(root, 'conversations.json.gz')), { code: 'ENOENT' });
  assert.deepEqual(await readConversationLibrary(root), library);
});

test('directory migration merges target chats, keeps latest source IDs and preserves source files', async (t) => {
  const root = await temporary(t); const source = path.join(root, 'source'); const target = path.join(root, 'target');
  await fs.mkdir(source); await fs.mkdir(target);
  const library = libraryWithDraft('源草稿');
  const chat = library.conversations[0];
  const targetLibrary = normalizeLibrary({ conversations: [{ ...chat, draft: '目标旧草稿' }, { ...createConversation(), draft: '目标独有' }] });
  await writeConversationLibrary(source, library);
  await writeConversationLibrary(target, targetLibrary);
  const originalSource = await fs.readFile(path.join(source, 'conversations.json'));
  const originalTarget = await fs.readFile(path.join(target, 'conversations.json'));
  const result = await migrateConversationDirectory(target, library, { compressed: true });
  assert.equal(result.library.conversations.length, 2);
  assert.equal(result.library.activeId, library.activeId);
  assert.equal(result.library.conversations.find((item) => item.id === chat.id).draft, '源草稿');
  assert.equal(result.library.conversations.some((item) => item.draft === '目标独有'), true);
  assert.deepEqual(await fs.readFile(path.join(source, 'conversations.json')), originalSource);
  assert.deepEqual(await fs.readFile(path.join(target, 'conversations.json')), originalTarget, 'Do not remove the previous format before settings commit');
  const empty = path.join(root, 'empty'); await fs.mkdir(empty);
  assert.equal((await migrateConversationDirectory(empty, library)).library.conversations.length, 1);
});

test('corrupt target and unreadable compressed records are retained and reject migration', async (t) => {
  const root = await temporary(t);
  const damaged = path.join(root, 'conversations.json');
  await fs.writeFile(damaged, '{broken');
  await assert.rejects(migrateConversationDirectory(root, libraryWithDraft()), /原文件已保留/);
  assert.equal(await fs.readFile(damaged, 'utf8'), '{broken');
  await fs.rm(damaged);
  await fs.writeFile(path.join(root, 'conversations.json.gz'), 'not gzip');
  await assert.rejects(readConversationLibrary(root, { compressed: true }), /压缩文件无法读取/);
  assert.equal(await fs.readFile(path.join(root, 'conversations.json.gz'), 'utf8'), 'not gzip');
  await assert.rejects(migrateConversationDirectory(path.join(root, 'missing'), libraryWithDraft()));
});

test('automatic retention preserves active, pinned, empty and boundary-age chats', () => {
  const now = Date.parse('2026-10-23T12:00:00Z');
  const at = (days) => new Date(now - days * 86400000).toISOString();
  const make = (days, fields = {}) => ({ ...createConversation(), draft: '内容', createdAt: at(days), updatedAt: at(days), ...fields });
  const active = make(100); const pinned = make(100, { pinned: true }); const old = make(31);
  const boundary = make(30); const empty = make(100, { draft: '' }); const recent = make(1);
  const library = normalizeLibrary({ activeId: active.id, conversations: [active, pinned, old, boundary, empty, recent] });
  const retained = archiveInactiveConversations(library, 30, now);
  assert.equal(retained.archivedCount, 1);
  assert.equal(retained.library.conversations.find((chat) => chat.id === old.id).archivedAt, new Date(now).toISOString());
  for (const chat of retained.library.conversations.filter((chat) => chat.id !== old.id)) assert.equal(chat.archivedAt, null);
  assert.equal(archiveInactiveConversations(retained.library, 30, now).archivedCount, 0);
  assert.deepEqual(archiveInactiveConversations(library, 0, now).library, library);
  assert.equal(archiveInactiveConversations(library, 90, now).archivedCount, 0);
});

test('external gzip storage counts known chat files only and categories equal physical bytes', async (t) => {
  const root = await temporary(t); const profile = path.join(root, 'profile'); const external = path.join(root, 'external');
  await fs.mkdir(profile); await fs.mkdir(external);
  const library = libraryWithDraft('活动内容'.repeat(100));
  library.conversations.push({ ...createConversation(), archivedAt: new Date().toISOString(), draft: '归档'.repeat(200) });
  await writeConversationLibrary(external, library, { compressed: true });
  await fs.writeFile(path.join(profile, 'settings.json'), '{}');
  await fs.writeFile(path.join(external, 'unrelated.bin'), Buffer.alloc(10000));
  const result = await storageUsage(profile, { conversationDirectory: external });
  const physical = (await fs.stat(path.join(external, 'conversations.json.gz'))).size;
  assert.equal(result.total, physical + 2);
  assert.equal(result.compressedAllocation, true);
  assert.ok(result.sizes.chats > 0 && result.sizes.archived > 0);
  assert.equal(Object.values(result.sizes).reduce((sum, size) => sum + size, 0), result.total);
  const same = await storageUsage(external, { conversationDirectory: external });
  assert.equal(same.total, physical + 10000, 'Known files visited through the main root are not counted twice');
});
