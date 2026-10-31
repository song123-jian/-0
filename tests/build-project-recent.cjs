const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const releaseRoot = path.join(project, 'release');
const output = path.resolve(project, process.env.SCODEX_PROJECT_RECENT_OUTPUT || 'release/project-recent-final-20261024');
const relativeOutput = path.relative(releaseRoot, output);
const manifest = require(path.join(project, 'package.json'));
const digest = (content) => crypto.createHash('sha256').update(content).digest('hex');

async function sourceHashes() {
  const result = {};
  async function visit(relative) {
    for (const entry of (await fs.readdir(path.join(project, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) result[child.replaceAll(path.sep, '/')] = digest(await fs.readFile(path.join(project, child)));
    }
  }
  await visit('src');
  await visit('electron');
  for (const file of ['package.json', 'index.html', 'vite.config.js']) result[file] = digest(await fs.readFile(path.join(project, file)));
  return result;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: project, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${path.basename(command)} exited ${code}`)));
  });
}

async function main() {
  if (!relativeOutput || relativeOutput === '..' || relativeOutput.startsWith('..' + path.sep) || path.isAbsolute(relativeOutput)) throw new Error('Build output must be a child of release.');
  const executable = path.join(output, 'Scodex-Workbench-ProjectRecent-1.0.4-x64.exe');
  try {
    await fs.access(executable);
    throw new Error(`Refusing to overwrite an existing candidate: ${executable}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await fs.mkdir(output, { recursive: true });
  await run(process.execPath, [path.join(project, 'scripts', 'generate-licenses.cjs')]);
  const before = await sourceHashes();
  await run(process.execPath, [path.join(project, 'node_modules', 'vite', 'bin', 'vite.js'), 'build']);
  const builtSources = await sourceHashes();
  if (JSON.stringify(before) !== JSON.stringify(builtSources)) throw new Error('Sources changed during renderer build.');
  const renderer = (await fs.readFile(path.join(project, 'dist', 'index.html'), 'utf8')).match(/assets\/index-[^"\s]+\.js/)?.[0];
  if (!renderer) throw new Error('Renderer entry was not found in dist/index.html.');
  const electronVersion = require('electron/package.json').version;
  const buildFile = path.join(output, 'project-recent-build.json');
  const building = { status: 'running', version: manifest.version, electronVersion, renderer, executable, sources: before };
  await fs.writeFile(buildFile, JSON.stringify(building, null, 2) + '\n');
  await run(process.execPath, [path.join(project, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js'),
    '--win', 'portable', '--x64', `--config.directories.output=${output}`, '--config.portable.artifactName=Scodex-Workbench-ProjectRecent-1.0.4-x64.exe',
    ...(process.env.SCODEX_USE_LOCAL_ELECTRON === '1' ? [
      `--config.electronDist=${path.join(project, 'node_modules', 'electron', 'dist')}`,
      '--config.npmRebuild=false', '--config.win.signAndEditExecutable=false',
    ] : [])]);
  const after = await sourceHashes();
  building.status = 'passed';
  building.sourceDrift = JSON.stringify(before) === JSON.stringify(after) ? [] : Object.keys(before).filter((file) => before[file] !== after[file]);
  building.executableBytes = (await fs.stat(executable)).size;
  building.executableSha256 = digest(await fs.readFile(executable));
  if (building.sourceDrift.length) throw new Error('Sources changed during packaging; candidate must not be used.');
  await fs.writeFile(buildFile, JSON.stringify(building, null, 2) + '\n');
  console.log(`Built ${executable}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
