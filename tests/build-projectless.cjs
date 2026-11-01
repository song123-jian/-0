const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'release/projectless-chat-20261101');
const phase = process.env.SCODEX_PROJECTLESS_BUILD_PHASE || '';
if (phase && !/^-[a-z0-9]+$/.test(phase)) throw Error('Invalid build phase');
const snapshot = path.join(output, 'source-snapshot' + phase);
const candidate = path.join(output, 'candidate' + phase);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function run(name, args, cwd) {
  const file = path.join(output, name + phase + '.log');
  const child = spawn(process.execPath, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', b => { log += b; }); child.stderr.on('data', b => { log += b; });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  await fs.writeFile(file, log); if (code !== 0) throw Error(name + ' failed: ' + code + '\n' + log.slice(-3000));
  console.log(name + ' passed');
}
async function main() {
  await fs.mkdir(snapshot); const manifest = {};
  async function copy(relative) {
    const source = path.join(root, relative), target = path.join(snapshot, relative);
    const stat = await fs.stat(source);
    if (stat.isDirectory()) { await fs.mkdir(target, { recursive: true }); for (const name of await fs.readdir(source)) await copy(path.join(relative, name)); }
    else { const bytes = await fs.readFile(source); manifest[relative.replaceAll('\\', '/')] = hash(bytes); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, bytes); }
  }
  for (const item of ['electron', 'src', 'build', 'scripts/generate-licenses.cjs', 'index.html', 'vite.config.js', 'package.json', 'package-lock.json']) await copy(item);
  await fs.symlink(path.join(root, 'node_modules'), path.join(snapshot, 'node_modules'), 'junction');
  await fs.symlink(path.join(root, 'resources'), path.join(snapshot, 'resources'), 'junction');
  await fs.writeFile(path.join(output, 'snapshot-manifest' + phase + '.json'), JSON.stringify(manifest, null, 2));
  await run('licenses', [path.join(snapshot, 'scripts/generate-licenses.cjs')], snapshot);
  await run('vite', [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], snapshot);
  await run('electron-build', [path.join(root, 'node_modules/electron-builder/out/cli/cli.js'), '--win', '--dir', '--x64', '--config.directories.output=' + candidate, '--config.electronDist=' + path.join(root, 'node_modules/electron/dist'), '--config.npmRebuild=false'], snapshot);
  const asar = require('@electron/asar');
  const archive = path.join(candidate, 'win-unpacked/resources/app.asar');
  for (const file of ['electron/main.cjs', 'electron/project-registry.cjs']) {
    if (hash(asar.extractFile(archive, file.replaceAll('/', path.sep))) !== hash(await fs.readFile(path.join(snapshot, file)))) throw Error('ASAR mismatch: ' + file);
  }
  const packed = JSON.parse(asar.extractFile(archive, 'package.json').toString());
  if (packed.version !== '1.3.31' || packed.main !== 'electron/main.cjs' || packed.name !== 'scodex-workbench') throw Error('Packaged application metadata mismatch');
  const drift = [];
  for (const [file, sha] of Object.entries(manifest)) if (hash(await fs.readFile(path.join(root, file))) !== sha) drift.push(file);
  const report = { status: 'passed', version: '1.3.31', sourceDrift: drift, sourceFiles: Object.keys(manifest).length, snapshot, archiveSha256: hash(await fs.readFile(archive)) };
  if (drift.length) throw Error('Concurrent source drift: ' + drift.join(', '));
  await fs.writeFile(path.join(output, 'build-verification' + phase + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
