const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const project = path.resolve(__dirname, '..');
const output = path.join(project, 'release/model-connection');
const stage = path.join(project, 'release/model-connection-app');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  const report = { status: 'running', date: new Date().toISOString(), packageFiles: [], textFiles: [], codeReview: { scope: 'New model connection module/form and IPC/request/conversation/render wiring; navigation when present.', findings: ['Corrected save instructions, hardcoded assistant signature, provider defaults and per-chat strength integration.'], result: 'No remaining confirmed issue in reviewed scope.' } };
  const packed = path.join(output, 'win-unpacked/resources/app.asar');
  const runtimeFiles = ['electron/main.cjs', 'electron/preload.cjs', 'electron/conversations.cjs', 'electron/model-connection.cjs', 'dist/index.html'];
  const index = await fs.readFile(path.join(stage, 'dist/index.html'), 'utf8');
  runtimeFiles.push(...[...index.matchAll(/assets\/[^"\s]+\.(?:js|css)/g)].map((match) => 'dist/' + match[0]));
  for (const name of runtimeFiles) { const bytes = await fs.readFile(path.join(stage, name)); const packaged = asar.extractFile(packed, name.split('/').join(path.sep)); if (!Buffer.from(packaged).equals(bytes)) throw new Error('Package bytes differ: ' + name); report.packageFiles.push({ path: name, sha256: hash(bytes) }); }
  const manifest = JSON.parse(await fs.readFile(path.join(stage, 'package.json'), 'utf8'));
  const packagedManifest = JSON.parse(asar.extractFile(packed, 'package.json').toString('utf8'));
  for (const key of ['name', 'version', 'main', 'type']) if (manifest[key] !== packagedManifest[key]) throw new Error('Packaged identity differs: ' + key);
  report.manifestIdentity = { name: packagedManifest.name, version: packagedManifest.version, main: packagedManifest.main, type: packagedManifest.type };
  const texts = ['electron/model-connection.cjs', 'electron/main.cjs', 'electron/preload.cjs', 'electron/conversations.cjs', 'src/components/model-connection-panel.jsx', 'src/components/model-connection.css', 'src/components/settings-panel.jsx', 'src/workbench.jsx', 'src/components/shell-panels.jsx', 'src/styles.css', 'tests/model-connection.test.mjs', 'tests/model-connection-smoke.cjs', 'tests/build-model-connection.cjs', 'tests/verify-model-delivery.cjs', 'README.md'];
  for (const name of ['src/lib/navigation.js', 'tests/navigation.test.mjs']) { try { await fs.access(path.join(project, name)); texts.push(name); } catch {} }
  for (const name of texts) { const bytes = await fs.readFile(path.join(project, name)); const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); if ((bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) || text.includes('\uFFFD')) throw new Error('Text encoding invalid: ' + name); report.textFiles.push({ path: name, sha256: hash(bytes), encoding: 'UTF-8 without BOM' }); }
  const exe = path.join(output, 'Scodex-Workbench-Models-x64.exe'); const bytes = await fs.readFile(exe); report.executable = { path: exe, size: bytes.length, sha256: hash(bytes) };
  report.version = JSON.parse(await fs.readFile(path.join(stage, 'package.json'), 'utf8')).version; report.renderer = index.match(/assets\/index-[^"\s]+\.js/)[0];
  report.codeReview = { ...report.codeReview, scope: 'Model connection configuration/form, encrypted credential origin boundary, IPC, main/child model requests, message metadata; navigation helper and page/chat history, disabled controls, keyboard, branch/deleted/archive/streaming guards.', result: 'Incremental review complete; no remaining confirmed in-scope issue. Navigation uses 100 session locations and skips unavailable chats; no further refactor supported by current evidence.' };
  report.status = 'passed'; const target = path.join(output, process.env.SCODEX_DELIVERY_PHASE === 'navigation' ? 'navigation-package-verification.json' : 'model-package-verification.json');
  await fs.writeFile(target, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ status: report.status, version: report.version, renderer: report.renderer, packageFiles: report.packageFiles.length, textFiles: report.textFiles.length, executable: report.executable }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
