const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');

const project = path.resolve(__dirname, '..');
const output = path.join(project, 'release', 'plugin-computer-browser-git-20261023');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(output, name), 'utf8'));
const decoder = new TextDecoder('utf-8', { fatal: true });

async function main() {
  const build = await readJson('integration-build.json');
  const ui = await readJson('integration-settings-extended-verification.json');
  const guards = await readJson('integration-guards-verification.json');
  const native = await readJson('integration-clear-close-verification.json');
  assert.equal(build.status, 'passed');
  assert.equal(ui.status, 'passed');
  assert.equal(native.status, 'passed');
  assert.equal(ui.cleanup, 'passed');
  assert.equal(guards.cleanup, 'passed');
  assert.equal(native.cleanup, 'passed');
  const skillGuard = guards.checks.find((item) => item.name === '已停用技能在发送 IPC 前被拒绝');
  assert.equal(skillGuard?.status, 'passed');
  assert.ok(skillGuard.evidence.reason.includes('所选技能已在插件设置中停用'));

  const report = { status: 'running', version: build.version, renderer: build.renderer,
    executable: build.executable, executableBytes: build.executableBytes, executableSha256: build.executableSha256,
    sourceDrift: [], packageFiles: [], textFiles: [],
    evidence: ['integration-settings-extended-verification.json', 'integration-guards-verification.json', 'integration-clear-close-verification.json'],
    review: { scope: '本轮偏好、IPC、技能筛选、原生应用启动、浏览器策略和四页设置及布局增量', result: '未发现本轮范围内待修的高置信度产品问题；无新增依赖。',
      coverage: '核对权限默认拒绝、主frame桥接、偏好校验及队列、停用ID发送拦截、下载冲突处理、规则匹配与清理、文本即时保存和窄视口。' },
    testDriverRecovery: 'guard原始报告整体failed，失败点为CDP处理Electron原生确认后未恢复窗口可用；功能guard原文通过。仅复测清理原生确认，改为在隔离测试PID按实际确定按钮操作，最终窗口可用、退出0，见独立报告。未把原始失败改为通过。',
    uncovered: [...ui.uncovered, '系统浏览器链接跳转、真实摄像头/麦克风硬件仍尚未完成验证。'],
  };
  const archive = path.join(output, 'win-unpacked', 'resources', 'app.asar');
  for (const [file, expected] of Object.entries(build.sources)) {
    const bytes = await fs.readFile(path.join(project, file));
    if (hash(bytes) !== expected) report.sourceDrift.push(file);
    if (file.startsWith('electron/')) {
      const packaged = asar.extractFile(archive, file.split('/').join(path.sep));
      assert.equal(hash(packaged), expected, `packaged ${file}`);
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
  const manifest = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
  assert.equal(manifest.version, build.version);
  assert.equal(manifest.main, 'electron/main.cjs');
  assert.equal(hash(await fs.readFile(build.executable)), build.executableSha256);
  for (const file of ['electron/preferences.cjs', 'electron/main.cjs', 'electron/preload.cjs', 'electron/panel-browser.cjs',
    'src/components/integration-settings.jsx', 'src/components/settings-panel.jsx', 'src/components/shell-panels.jsx', 'src/workbench.jsx', 'src/styles.css',
    'tests/settings.test.mjs', 'tests/integration-settings-smoke.cjs', 'tests/build-integration-settings.cjs', 'tests/verify-integration-delivery.cjs', 'README.md']) {
    const bytes = await fs.readFile(path.join(project, file));
    const text = decoder.decode(bytes);
    assert.ok(!(bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191), `BOM ${file}`);
    assert.ok(!text.includes('\ufffd'), `replacement character ${file}`);
    report.textFiles.push({ file, sha256: hash(bytes), encoding: 'UTF-8 without BOM' });
  }
  assert.ok(decoder.decode(await fs.readFile(path.join(project, 'src/components/integration-settings.jsx'))).includes('Pull Request 指令'));
  report.sourceCount = Object.keys(build.sources).length;
  report.status = 'passed';
  await fs.writeFile(path.join(output, 'integration-delivery-verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, sourceCount: report.sourceCount, sourceDrift: report.sourceDrift,
    packageFiles: report.packageFiles.length, textFiles: report.textFiles.length, version: report.version, renderer: report.renderer }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
