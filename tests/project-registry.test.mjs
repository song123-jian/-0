import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createProject, normalizeProjects, projectPathKey, upsertProject } = require('../electron/project-registry.cjs');

test('project registry preserves a legacy workspace and deduplicates paths', () => {
  const existing = [{ id: 'one', name: '项目 A', path: 'C:\\Work\\A', createdAt: '2026-01-01T00:00:00.000Z' }];
  const normalized = normalizeProjects([...existing, { ...existing[0], id: 'duplicate', name: '重复' }], 'C:\\Work\\B');
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].id.startsWith('project-'), true);
  assert.equal(projectPathKey('C:\\Work\\A'), projectPathKey('c:\\work\\a'));
});

test('project creation validates names and upsert keeps identity for a known folder', () => {
  assert.throws(() => createProject('', 'C:\\Work\\A'), /项目名称/);
  assert.throws(() => createProject('Bad', 'relative-folder'), /本地项目文件夹/);
  const current = [{ id: 'one', name: '旧名称', path: 'C:\\Work\\A', createdAt: '2026-01-01T00:00:00.000Z' }];
  const updated = upsertProject(current, { name: '新名称', path: 'c:\\work\\a' }, { now: () => new Date('2026-10-23T00:00:00.000Z') });
  assert.equal(updated.projects.length, 1);
  assert.equal(updated.project.id, 'one');
  assert.equal(updated.project.name, '新名称');
});
