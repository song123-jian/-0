const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const asar = require('@electron/asar');

const project = path.resolve(__dirname, '..');
const output = path.resolve(project, process.env.SCODEX_PERMISSION_OUTPUT || 'release/permission-final-20261024');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const decoder = new TextDecoder('utf-8', { fatal: true });
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(output, file), 'utf8'));

async function main() {
  const build = await readJson('integration-build.json');
  const ui = await readJson('chat-ui-verification.json');
  assert.equal(build.status, 'passed');
  assert.equal(build.sourceDrift.length, 0);
  assert.equal(ui.status, 'passed');
  assert.equal(ui.cleanup, 'passed');
  assert.ok(ui.checks.length >= 15);
  assert.ok(ui.screenshot);
  await fs.access(ui.screenshot);

  const archive = path.join(output, 'win-unpacked', 'resources', 'app.asar');
  const report = {
    status: 'running',
    version: build.version,
    electronVersion: build.electronVersion,
    renderer: build.renderer,
    executable: build.executable,
    executableBytes: build.executableBytes,
    executableSha256: build.executableSha256,
    sourceDrift: [],
    packageFiles: [],
    textFiles: [],
    uiEvidence: 'chat-ui-verification.json',
    screenshot: ui.screenshot,
    review: {
      scope: '第一工作页输入栏“＋”与完全访问权限；偏好持久化、权限清空和主进程发送拦截。',
      result: '未发现当前范围内需要修复的高置信度产品问题。',
      coverage: '核对 ComposerTools、workbench 权限状态、preferences 规范化与 assertContextAccess，以及插件技能自动匹配和停用技能拦截。',
    },
    limitations: [
      '受控本机 SSE 仅用于验证真实 Electron 请求链路，不代表公网模型生成可用。',
      '原生文件选择器、实体鼠标拖放和原生 OS 窗口缩放未自动验收。',
      '旧 tests/smoke.cjs 的历史“新建对话”入口断言与当前“新聊天”入口不一致；该测试驱动失败不作为产品失败证据。',
    ],
  };

  for (const [file, expected] of Object.entries(build.sources)) {
    const bytes = await fs.readFile(path.join(project, file));
    const actual = hash(bytes);
    if (actual !== expected) report.sourceDrift.push({ file, expected, actual });
    if (file.startsWith('electron/')) {
      assert.equal(hash(asar.extractFile(archive, file.split('/').join(path.sep))), expected, `packaged ${file}`);
      report.packageFiles.push({ file, sha256: expected });
    }
  }
  assert.deepEqual(report.sourceDrift, []);

  const index = await fs.readFile(path.join(project, 'dist', 'index.html'), 'utf8');
  assert.ok(index.includes(build.renderer));
  for (const file of ['dist/index.html', ...[...index.matchAll(/(?:src|href)="\/([^"\s]+\.(?:js|css))"/g)].map((match) => 'dist/' + match[1])]) {
    const bytes = await fs.readFile(path.join(project, file));
    assert.equal(hash(asar.extractFile(archive, file.split('/').join(path.sep))), hash(bytes), `packaged ${file}`);
    report.packageFiles.push({ file, sha256: hash(bytes) });
  }
  const packagedManifest = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
  assert.equal(packagedManifest.version, build.version);
  assert.equal(packagedManifest.main, 'electron/main.cjs');
  assert.equal(hash(await fs.readFile(build.executable)), build.executableSha256);

  const packagedRenderer = asar.extractFile(archive, path.join('dist', build.renderer).split(path.sep).join(path.sep)).toString('utf8');
  assert.match(packagedRenderer, /完全访问/);
  assert.match(packagedRenderer, /仅对话/);
  for (const file of [
    'src/components/composer-tools.jsx', 'src/components/shell-panels.jsx', 'src/components/settings-panel.jsx',
    'src/workbench.jsx', 'electron/preferences.cjs', 'tests/composer.test.mjs', 'tests/composer-checks.cjs',
    'tests/chat-reference-smoke.cjs', 'README.md',
  ]) {
    const bytes = await fs.readFile(path.join(project, file));
    const text = decoder.decode(bytes);
    assert.ok(!(bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191), `BOM ${file}`);
    assert.ok(!text.includes('\ufffd'), `replacement character ${file}`);
    report.textFiles.push({ file, sha256: hash(bytes), encoding: 'UTF-8 without BOM' });
  }
  report.status = 'passed';
  await fs.writeFile(path.join(output, 'permission-delivery-verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, version: report.version, renderer: report.renderer, sourceDrift: report.sourceDrift, packageFiles: report.packageFiles.length, textFiles: report.textFiles.length, checks: ui.checks.length }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
