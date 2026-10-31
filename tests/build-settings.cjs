const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const project = path.resolve(__dirname, '..');
const stage = path.join(project, 'release', 'settings-app');
const releaseRoot = path.join(project, 'release');
const output = path.resolve(process.env.SCODEX_SETTINGS_OUTPUT || path.join(releaseRoot, 'settings'));
const outputRelative = path.relative(releaseRoot, output);
if (!outputRelative || outputRelative === '..' || outputRelative.startsWith('..' + path.sep) || path.isAbsolute(outputRelative)) {
  throw new Error('Settings build output must be a child of release.');
}
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
async function run(script, args = []) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: project, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Build exited ${code}`)));
  });
}
async function sourceHashes() {
  const result = {};
  async function visit(relative) {
    for (const entry of (await fs.readdir(path.join(project, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) result[child.replaceAll(path.sep, '/')] = digest(await fs.readFile(path.join(project, child)));
    }
  }
  await visit('src'); await visit('electron');
  for (const relative of ['package.json', 'index.html', 'vite.config.js']) result[relative] = digest(await fs.readFile(path.join(project, relative)));
  return result;
}
async function main() {
  await fs.mkdir(stage, { recursive: true }); await fs.mkdir(output, { recursive: true });
  await run(path.join(project, 'scripts', 'generate-licenses.cjs'));
  const before = await sourceHashes();
  await run(path.join(project, 'node_modules', 'vite', 'bin', 'vite.js'), ['build', '--outDir', path.join(stage, 'dist')]);
  await fs.cp(path.join(project, 'electron'), path.join(stage, 'electron'), { recursive: true });
  await fs.cp(path.join(project, 'build'), path.join(stage, 'build'), { recursive: true });
  const manifest = JSON.parse(await fs.readFile(path.join(project, 'package.json'), 'utf8'));
  if (manifest.version !== '1.0.3') throw new Error('Settings build version changed during the task');
  const after = await sourceHashes();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Shared sources changed while building; do not validate this inconsistent build');
  const electronVersion = require('electron/package.json').version;
  manifest.dependencies = {}; manifest.devDependencies = {};
  manifest.build = { ...manifest.build, electronVersion, electronDist: path.join(project, 'node_modules', 'electron', 'dist'), npmRebuild: false,
    directories: { output }, portable: { artifactName: 'Scodex-Workbench-1.0.3-x64.exe' } };
  await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  const renderer = (await fs.readFile(path.join(stage, 'dist', 'index.html'), 'utf8')).match(/assets\/index-[^"\s]+\.js/)?.[0];
  await fs.writeFile(path.join(output, 'settings-build.json'), JSON.stringify({ version: manifest.version, electronVersion, renderer, sources: before }, null, 2) + '\n');
  await run(require.resolve('electron-builder/out/cli/cli.js'), ['--projectDir', stage, '--win', 'portable', '--x64']);
  const packagedSources = await sourceHashes();
  if (JSON.stringify(before) !== JSON.stringify(packagedSources)) throw new Error('Shared sources changed while packaging; do not promote this candidate.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
