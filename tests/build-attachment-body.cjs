const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const project = path.resolve(__dirname, '..');
const revision2 = process.argv.includes('--revision-2');
const inputSource = revision2 ? path.join(project, 'release/attachment-body-source-20261024') : project;
const source = path.join(project, revision2 ? 'release/attachment-body-source-r2-20261024' : 'release/attachment-body-source-20261024');
const output = path.join(project, revision2 ? 'release/attachment-body-ready-20261024' : 'release/attachment-body-verified-20261024');
const resume = process.argv.includes('--resume');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

async function hashes(root) {
  const result = {};
  const visit = async (relative) => {
    for (const item of (await fs.readdir(path.join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.posix.join(relative, item.name);
      if (item.isDirectory()) await visit(file);
      else if (item.isFile()) result[file] = hash(await fs.readFile(path.join(root, file)));
    }
  };
  await visit('src'); await visit('electron');
  for (const file of ['package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'scripts/generate-licenses.cjs', 'build/icon.svg', 'build/icon.png', 'build/icon.ico']) result[file] = hash(await fs.readFile(path.join(root, file)));
  return result;
}

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: source, windowsHide: true, stdio: 'inherit' });
    child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(path.basename(script) + ' exited ' + code)));
  });
}

async function main() {
  if (!resume) {
  for (const directory of [source, output]) {
    try { await fs.access(directory); throw new Error('Refusing to overwrite existing stage/output: ' + directory); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const before = await hashes(inputSource);
  await fs.mkdir(source, { recursive: true }); await fs.mkdir(output, { recursive: true });
  for (const directory of ['src', 'electron']) await fs.cp(path.join(inputSource, directory), path.join(source, directory), { recursive: true, errorOnExist: true, force: false });
  for (const file of ['package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'README.md', 'scripts/generate-licenses.cjs', 'build/icon.svg', 'build/icon.png', 'build/icon.ico']) {
    await fs.mkdir(path.dirname(path.join(source, file)), { recursive: true }); await fs.copyFile(path.join(inputSource, file), path.join(source, file));
  }
  const copied = await hashes(source), afterCopy = await hashes(inputSource);
  if (JSON.stringify(before) !== JSON.stringify(copied) || JSON.stringify(before) !== JSON.stringify(afterCopy)) throw new Error('Source changed during snapshot copy.');
  await fs.symlink(path.join(project, 'node_modules'), path.join(source, 'node_modules'), 'junction');
  await fs.mkdir(path.join(source, 'resources'), { recursive: true });
  await fs.symlink(path.join(project, 'resources/workspace-tools-bundle'), path.join(source, 'resources/workspace-tools-bundle'), 'junction');
  } else {
    await fs.access(path.join(source, 'electron/document-text.cjs'));
    const target = path.join(output, `Scodex-Workbench-${require('../package.json').version}-x64.exe`);
    try { await fs.access(target); throw new Error('Refusing to overwrite an existing executable: ' + target); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.copyFile(path.join(project, 'build/icon.svg'), path.join(source, 'build/icon.svg'));
  }
  if (revision2) await fs.copyFile(path.join(project, 'electron/document-text.cjs'), path.join(source, 'electron/document-text.cjs'));
  await run(path.join(source, 'scripts/generate-licenses.cjs'));
  const sources = await hashes(source);
  await run(path.join(project, 'node_modules/vite/bin/vite.js'), ['build']);
  const renderer = (await fs.readFile(path.join(source, 'dist/index.html'), 'utf8')).match(/assets\/index-[^"\s]+\.js/)?.[0];
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'package.json')));
  const executable = path.join(output, `Scodex-Workbench-${manifest.version}-x64.exe`);
  const build = { status: 'running', sourceRoot: source, immutableSnapshot: true, frozenAt: new Date().toISOString(), version: manifest.version, electronVersion: require('electron/package.json').version, renderer, executable, sources };
  const reportFile = path.join(output, 'integration-build.json'); await fs.writeFile(reportFile, JSON.stringify(build, null, 2) + '\n');
  try {
    await run(path.join(project, 'node_modules/electron-builder/out/cli/cli.js'), ['--projectDir', source, '--win', 'portable', '--x64', `--config.directories.output=${output}`, `--config.electronDist=${path.join(project, 'node_modules/electron/dist')}`, '--config.npmRebuild=false', '--config.win.signAndEditExecutable=false']);
    const after = await hashes(source);
    if (JSON.stringify(sources) !== JSON.stringify(after)) throw new Error('Frozen sources changed during packaging.');
    build.status = 'passed'; build.sourceDrift = [];
    build.executableBytes = (await fs.stat(executable)).size; build.executableSha256 = hash(await fs.readFile(executable));
    const live = await hashes(project); build.liveSourceDrift = Object.keys(sources).filter((file) => live[file] !== sources[file]);
  } catch (error) { build.status = 'failed'; build.error = error.message; throw error; }
  finally { await fs.writeFile(reportFile, JSON.stringify(build, null, 2) + '\n'); }
  console.log('Built immutable attachment candidate: ' + executable);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
