const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const project = path.resolve(__dirname, '..');
const stage = path.join(project, 'release', 'storage-app');
const output = path.join(project, 'release', 'storage');
async function run(script, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: project, stdio: 'inherit', windowsHide: true });
    child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Build exited ${code}`)));
  });
}
async function main() {
  await fs.mkdir(stage, { recursive: true }); await fs.mkdir(output, { recursive: true });
  // Build into a dedicated directory so other in-progress dist/release files are preserved.
  await run(path.join(project, 'node_modules', 'vite', 'bin', 'vite.js'), ['build', '--outDir', path.join(stage, 'dist')]);
  await fs.cp(path.join(project, 'electron'), path.join(stage, 'electron'), { recursive: true });
  await fs.cp(path.join(project, 'build'), path.join(stage, 'build'), { recursive: true });
  const manifest = JSON.parse(await fs.readFile(path.join(project, 'package.json'), 'utf8'));
  const electronVersion = require('electron/package.json').version;
  manifest.dependencies = {}; manifest.devDependencies = {};
  manifest.build = { ...manifest.build, electronVersion, npmRebuild: false,
    directories: { output }, portable: { artifactName: 'Scodex-Workbench-Storage-x64.exe' } };
  await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify(manifest, null, 2));
  const sources = {};
  for (const name of await fs.readdir(path.join(stage, 'electron'))) {
    if (!name.endsWith('.cjs')) continue;
    const bytes = await fs.readFile(path.join(stage, 'electron', name)); sources['electron/' + name] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  sources['dist/index.html'] = crypto.createHash('sha256').update(await fs.readFile(path.join(stage, 'dist', 'index.html'))).digest('hex');
  await fs.writeFile(path.join(output, 'storage-build.json'), JSON.stringify({ version: manifest.version, electronVersion, sources }, null, 2));
  await run(require.resolve('electron-builder/out/cli/cli.js'), ['--projectDir', stage, '--win', 'portable', '--x64']);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
