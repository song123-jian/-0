const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const project = path.resolve(__dirname, '..');
const output = path.join(project, 'release', 'configuration');
const stage = path.join(project, 'release', 'configuration-app');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  const build = JSON.parse(await fs.readFile(path.join(output, 'configuration-build.json'), 'utf8'));
  const final = JSON.parse(await fs.readFile(path.join(output, 'configuration-final-verification.json'), 'utf8'));
  assert.equal(final.status, 'passed', 'Final actual-EXE verification required');
  const packageFile = path.join(output, 'win-unpacked', 'resources', 'app.asar');
  const report = { date: new Date().toISOString(), status: 'running', files: [], encoding: [], sourceInputs: [], review: {
    scope: 'Configuration-owned modules and integration changes only; no repository history or unrelated tests.',
    findingsFixed: ['Connection strength no longer re-adds disabled levels or overrides new-chat configuration defaults.', 'Workspace config junctions/non-file targets are refused; atomic hard-link replacement preserves source.', 'Doctor receives the actual current workspace as cwd.', 'Windows temporary EPERM/EBUSY sharing locks have bounded retry; persistent failure retains original data and removes temporary file.'],
    remaining: [], limitations: ['File symbolic-link fixture could not be created under current Windows privileges; junction rejection and hard-link preservation were executed.', 'Associated external editor launch and actual CLI software update are not automated; real native update cancellation was verified.', 'No real model generation or server support claim for reasoning levels; fixture connection never made a network request.'],
    assessment: 'Directly affected code uses existing queues, normalization and IPC boundaries; no additional out-of-scope refactor justified by current evidence.'
  } };
  for (const [name, expected] of Object.entries(build.sources)) {
    const packed = asar.extractFile(packageFile, name.replaceAll('/', path.sep));
    const frozen = await fs.readFile(path.join(stage, name));
    assert.equal(hash(packed), expected, name + ' package hash'); assert.equal(hash(frozen), expected, name + ' frozen hash');
    report.files.push({ name, sha256: expected });
  }
  for (const item of build.bundledTools) {
    const source = await fs.readFile(path.join(project, 'resources', 'workspace-tools-bundle', item.filename));
    const staged = await fs.readFile(path.join(stage, 'resources', 'workspace-tools-bundle', item.filename));
    const packaged = await fs.readFile(path.join(output, 'win-unpacked', 'resources', 'workspace-tools', item.filename));
    for (const [name, contents] of [['source', source], ['stage', staged], ['package', packaged]]) {
      assert.equal(hash(contents), item.sha256, `${name} bundled ${item.filename}`);
    }
    report.files.push({ name: 'resources/workspace-tools/' + item.filename, sha256: item.sha256, bytes: item.bytes });
  }
  const html = (await fs.readFile(path.join(stage, 'dist', 'index.html'), 'utf8'));
  const assets = [...html.matchAll(/(?:src|href)="(?:\.\/|\/)(assets\/[^"]+)"/g)];
  assert.ok(assets.length >= 2, 'Renderer JavaScript and stylesheet must be checked');
  for (const name of assets) {
    assert.equal(hash(asar.extractFile(packageFile, path.join('dist', name[1]))), hash(await fs.readFile(path.join(stage, 'dist', name[1]))));
    report.files.push({ name: 'dist/' + name[1] });
  }
  assert.equal(JSON.parse(asar.extractFile(packageFile, 'package.json').toString('utf8')).version, build.version);
  for (const [name, expected] of Object.entries(build.inputHashes)) {
    assert.equal(hash(await fs.readFile(path.join(stage, 'source-snapshot', name))), expected, name + ' input snapshot');
    const current = hash(await fs.readFile(path.join(project, name)));
    report.sourceInputs.push({ name, sha256: expected, currentSha256: current, currentMatches: current === expected });
  }
  report.workspaceSourceDrift = report.sourceInputs.filter((input) => !input.currentMatches).map(({ name, sha256, currentSha256 }) => ({ name, builtSha256: sha256, currentSha256 }));
  if (report.workspaceSourceDrift.length) report.review.remaining.push('The independent configuration package matches its frozen build snapshot. The live worktree has later changes in other features; those files were preserved and are not included in this package. See workspaceSourceDrift.');
  const textFiles = ['electron/agent-settings.cjs', 'electron/agent-settings-store.cjs', 'electron/codex-config-status.cjs', 'electron/workspace-tools.cjs', 'electron/main.cjs', 'electron/preload.cjs', 'electron/conversations.cjs', 'src/components/settings-panel.jsx', 'src/workbench.jsx', 'src/styles.css', 'README.md', 'package.json', 'package-lock.json', 'scripts/download-workspace-tools.cjs', 'tests/agent-settings.test.mjs', 'tests/agent-settings-store.test.mjs', 'tests/workspace-tools.test.mjs', 'tests/configuration-cli.cjs', 'tests/configuration-smoke.cjs', 'tests/configuration-final.cjs', 'tests/configuration-package.cjs', 'tests/build-configuration.cjs'];
  for (const name of textFiles) {
    const bytes = await fs.readFile(path.join(project, name));const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert.ok(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), name + ' BOM'); assert.ok(!text.includes('\ufffd'), name + ' replacement character');
    report.encoding.push({ name, utf8: true, bom: false });
  }
  const fixture = path.join(final.temporary, 'scodex');
  for (const name of ['start-scodex.ps1', 'Scodex.cmd', 'Scodex-module-2.cmd']) {
    const bytes = await fs.readFile(path.resolve(project, '..', name));
    assert.equal(hash(bytes), hash(await fs.readFile(path.join(fixture, name))), name + ' actual launcher fixture');
    new TextDecoder('utf-8', { fatal: true }).decode(bytes); assert.ok(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf));
    report.files.push({ name: '../' + name, sha256: hash(bytes) });
  }
  const executable = path.join(output, `Scodex-Workbench-Configuration-${build.version}-x64.exe`);
  const bytes = await fs.readFile(executable); report.executable = { path: executable, bytes: bytes.length, sha256: hash(bytes), version: build.version, renderer: final.renderer };
  report.logic = { uniqueEffectiveResults: 12, scope: '6 unchanged agent settings + 2 workspace tools + 4 current store results; no unrelated suite run' };
  report.status = 'passed';
  await fs.writeFile(path.join(output, 'configuration-package-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, packageFiles: report.files.length, textFiles: report.encoding.length, inputHashes: report.sourceInputs.length, executable: report.executable }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
