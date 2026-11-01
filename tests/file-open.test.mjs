import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { FILE_OPEN_MODES, fileOpenDefinitions, locateFileOpenExecutable, normalizeFileOpenMode } = require('../electron/file-open.cjs');

test('file open mode normalization migrates legacy preferences', () => {
  assert.deepEqual(FILE_OPEN_MODES, ['vscode', 'visual-studio', 'default', 'explorer', 'git-bash']);
  assert.equal(normalizeFileOpenMode(), 'vscode');
  assert.equal(normalizeFileOpenMode('system'), 'default');
  assert.equal(normalizeFileOpenMode('builtin'), 'vscode');
  assert.equal(normalizeFileOpenMode('visual-studio'), 'visual-studio');
  assert.equal(normalizeFileOpenMode('unknown'), 'vscode');
});

test('file open definitions use fixed Windows application candidates', async () => {
  const env = { ProgramFiles: 'C:\\PF', 'ProgramFiles(x86)': 'C:\\PF86', LOCALAPPDATA: 'C:\\Local' };
  const definitions = fileOpenDefinitions(env);
  assert.ok(definitions.vscode.some((item) => item.endsWith('Microsoft VS Code\\Code.exe')));
  assert.ok(definitions['visual-studio'].some((item) => item.endsWith('Common7\\IDE\\devenv.exe')));
  assert.ok(definitions['git-bash'].some((item) => item.endsWith('Git\\git-bash.exe')));
  const stats = new Map([[definitions.vscode[0], { isFile: () => true }]]);
  const resolved = await locateFileOpenExecutable('vscode', { stat: async (item) => stats.get(item) || Promise.reject(new Error('missing')) }, env);
  assert.equal(resolved, definitions.vscode[0]);
  await assert.rejects(() => locateFileOpenExecutable('git-bash', { stat: async () => { throw new Error('missing'); } }, env), /Git Bash/);
});
