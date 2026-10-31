const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const project = path.resolve(__dirname, '..');
const stage = path.join(project, 'release', 'configuration-app');
const output = path.join(project, 'release', 'configuration');
const { CATALOG } = require('../electron/workspace-tools.cjs');
async function run(script, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: project, stdio: 'inherit', windowsHide: true });
    child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Build exited ${code}`)));
  });
}
async function main() {
  const tracked = ['src/workbench.jsx', 'src/components/settings-panel.jsx', 'src/styles.css', 'electron/main.cjs', 'electron/preload.cjs', 'electron/agent-settings.cjs', 'electron/agent-settings-store.cjs', 'electron/codex-config-status.cjs', 'electron/workspace-tools.cjs', 'electron/conversations.cjs', 'package.json'];
  const hashes = async () => Object.fromEntries(await Promise.all(tracked.map(async (file) => [file, crypto.createHash('sha256').update(await fs.readFile(path.join(project, file))).digest('hex')])));
  const inputHashes = await hashes();
  const bundledTools = [];
  for (const [name, item] of Object.entries(CATALOG)) {
    const archive = path.join(project, 'resources', 'workspace-tools-bundle', item.filename);
    const bytes = await fs.readFile(archive);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== item.sha256) throw new Error(`Bundled ${name} archive failed SHA-256 verification.`);
    bundledTools.push({ name, filename: item.filename, version: item.version, bytes: bytes.length, sha256 });
  }
  await fs.mkdir(stage, { recursive: true }); await fs.mkdir(output, { recursive: true });
  for (const file of tracked) {
    const snapshot = path.join(stage, 'source-snapshot', file);
    await fs.mkdir(path.dirname(snapshot), { recursive: true }); await fs.copyFile(path.join(project, file), snapshot);
  }
  // Dedicated directories preserve existing releases and concurrent build output.
  if (process.argv.includes('--backend-only')) {
    const previous = JSON.parse(await fs.readFile(path.join(output, 'configuration-build.json'), 'utf8'));
    for (const file of tracked.filter(file => file.startsWith('src/'))) if (previous.inputHashes[file] !== inputHashes[file]) throw new Error('Renderer changed; a full configuration build is required.');
    await fs.access(path.join(stage, 'dist', 'index.html'));
  } else await run(path.join(project, 'node_modules', 'vite', 'bin', 'vite.js'), ['build', '--outDir', path.join(stage, 'dist')]);
  await fs.cp(path.join(project, 'electron'), path.join(stage, 'electron'), { recursive: true });
  await fs.cp(path.join(project, 'build'), path.join(stage, 'build'), { recursive: true });
  await fs.cp(path.join(project, 'resources', 'workspace-tools-bundle'), path.join(stage, 'resources', 'workspace-tools-bundle'), { recursive: true });
  const manifest = JSON.parse(await fs.readFile(path.join(project, 'package.json'), 'utf8'));
  const electronVersion = require('electron/package.json').version;
  manifest.dependencies = {}; manifest.devDependencies = {};
  manifest.build = { ...manifest.build, electronVersion, electronDist: path.join(project, 'node_modules', 'electron', 'dist'), npmRebuild: false,
    directories: { output }, portable: { artifactName: `Scodex-Workbench-Configuration-${manifest.version}-x64.exe` } };
  await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify(manifest, null, 2));
  const sources = {};
  for (const name of await fs.readdir(path.join(stage, 'electron'))) {
    if (!name.endsWith('.cjs')) continue;
    sources['electron/' + name] = crypto.createHash('sha256').update(await fs.readFile(path.join(stage, 'electron', name))).digest('hex');
  }
  sources['dist/index.html'] = crypto.createHash('sha256').update(await fs.readFile(path.join(stage, 'dist', 'index.html'))).digest('hex');
  if (JSON.stringify(await hashes()) !== JSON.stringify(inputHashes)) throw new Error('Source changed during build; review the affected inputs before rebuilding.');
  for (const item of bundledTools) {
    const staged = await fs.readFile(path.join(stage, 'resources', 'workspace-tools-bundle', item.filename));
    const stagedHash = crypto.createHash('sha256').update(staged).digest('hex');
    if (stagedHash !== item.sha256) throw new Error(`Staged ${item.filename} changed during build.`);
  }
  await fs.writeFile(path.join(output, 'configuration-build.json'), JSON.stringify({ version: manifest.version, electronVersion, inputHashes, sources, bundledTools }, null, 2));
  await run(require.resolve('electron-builder/out/cli/cli.js'), ['--projectDir', stage, '--win', 'portable', '--x64']);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
