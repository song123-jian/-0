const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const asar = require('@electron/asar');

const project = path.resolve(__dirname, '..');
const output = path.resolve(project, process.env.SCODEX_PROJECT_RECENT_OUTPUT || 'release/project-recent-final2-20261024');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const decoder = new TextDecoder('utf-8', { fatal: true });
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(output, name), 'utf8'));

async function main() {
  const build = await readJson('project-recent-build.json');
  const ui = await readJson('project-recent-ui-verification.json');
  assert.equal(build.status, 'passed');
  assert.equal(ui.status, 'passed');
  assert.equal(ui.checks.length, 9);
  const report = {
    status: 'running', version: build.version, electronVersion: build.electronVersion,
    renderer: build.renderer, executable: build.executable, executableBytes: build.executableBytes,
    executableSha256: build.executableSha256, sourceDrift: [], packageFiles: [], textFiles: [],
    uiEvidence: 'project-recent-ui-verification.json', screenshot: ui.screenshot,
    review: {
      scope: '第一工作页项目/最近结构、projectId持久化、项目切换隔离、自动输入区和SKILL设置入口',
      result: '未发现当前范围内需要修复的高置信度产品问题；保留自动模式、自动SKILL与底层附件发送逻辑。',
      coverage: '检查了旧聊天兼容、非法projectId过滤、项目切换后的active chat、手动模型/深度/工具入口隐藏，以及设置中的唯一SKILL自动调用入口。',
    },
    constraints: ['未读取或依赖 E:\\GDP\\.codex 元数据', '未修改官方 Codex CLI、codex.exe、CODEX_HOME 或真实用户配置', '未切换正式快捷方式'],
  };
  const archive = path.join(output, 'win-unpacked', 'resources', 'app.asar');
  await fs.access(archive);
  for (const [file, expected] of Object.entries(build.sources)) {
    const bytes = await fs.readFile(path.join(project, file));
    assert.equal(hash(bytes), expected, `source ${file}`);
    if (file.startsWith('electron/')) {
      const packaged = asar.extractFile(archive, file.split('/').join(path.sep));
      assert.equal(hash(packaged), expected, `packaged ${file}`);
      report.packageFiles.push({ file, sha256: expected });
    }
  }
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
  const executable = await fs.readFile(build.executable);
  assert.equal(hash(executable), build.executableSha256);
  for (const file of ['src/workbench.jsx', 'src/components/workbench-panels.jsx', 'src/components/shell-panels.jsx', 'src/components/settings-panel.jsx', 'src/components/integration-settings.jsx', 'src/styles.css', 'electron/conversations.cjs', 'electron/project-registry.cjs', 'tests/project-recent-smoke.cjs', 'tests/build-project-recent.cjs', 'tests/verify-project-recent-delivery.cjs']) {
    const bytes = await fs.readFile(path.join(project, file));
    const text = decoder.decode(bytes);
    assert.ok(!(bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191), `BOM ${file}`);
    assert.ok(!text.includes('\ufffd'), `replacement character ${file}`);
    report.textFiles.push({ file, sha256: hash(bytes), encoding: 'UTF-8 without BOM' });
  }
  const screenshot = await fs.stat(ui.screenshot);
  assert.ok(screenshot.size > 0);
  report.status = 'passed';
  await fs.writeFile(path.join(output, 'project-recent-delivery-verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, version: report.version, renderer: report.renderer, sourceCount: Object.keys(build.sources).length, packageFiles: report.packageFiles.length, textFiles: report.textFiles.length, screenshotBytes: screenshot.size }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
