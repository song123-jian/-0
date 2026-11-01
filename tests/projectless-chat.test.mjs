import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeProjects, resolveChatProject, conversationWorkspacePath } = require('../electron/project-registry.cjs');
const project = { id: 'project-one', name: '项目一', path: 'C:\\Work\\one' };

test('general task workspace stays outside protected app data while honoring an external home', () => {
  assert.equal(conversationWorkspacePath('C:\\Data\\app\\codex-home', 'C:\\Data\\app'), 'C:\\Data\\app-workspace');
  assert.equal(conversationWorkspacePath('C:\\Tasks', 'C:\\Data\\app'), 'C:\\Tasks\\workbench\\workspace');
  assert.equal(conversationWorkspacePath('c:\\DATA\\APP\\home', 'C:\\Data\\app'), 'C:\\Data\\app-workspace');
});

test('explicit empty project registry survives restart without recreating a project', () => {
  assert.deepEqual(normalizeProjects([], 'C:\\Work\\one'), []);
});

test('saved projects do not register the general conversation workspace', () => {
  assert.deepEqual(normalizeProjects([project], 'C:\\Work\\general').map(item => item.id), ['project-one']);
});

test('legacy workspace without a project registry remains discoverable', () => {
  assert.equal(normalizeProjects(undefined, 'C:\\Work\\legacy').length, 1);
  assert.deepEqual(normalizeProjects(undefined), []);
});

test('projectless chat resolves without a project and never inherits the selected project', () => {
  assert.equal(resolveChatProject([], { projectId: '' }, undefined, ''), null);
  assert.equal(resolveChatProject([project], {}, { id: 'chat' }, project.id), null);
  assert.equal(resolveChatProject([project], { projectId: '' }, undefined, project.id), null);
});

test('project chat keeps its binding and rejects missing or archived projects', () => {
  assert.equal(resolveChatProject([project], { projectId: project.id }, { projectId: project.id }, ''), project);
  assert.throws(() => resolveChatProject([], { projectId: project.id }, undefined, ''), /不存在或已归档/);
  assert.throws(() => resolveChatProject([{ ...project, archivedAt: '2026-11-01' }], {}, { projectId: project.id }, ''), /不存在或已归档/);
  assert.throws(() => resolveChatProject([project], { projectId: '' }, { projectId: project.id }, ''), /所属项目已变化/);
});
