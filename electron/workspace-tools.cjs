const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

// Fixed official releases. Reinstallation never executes an unverified download.
const CATALOG = Object.freeze({
  node: { version: '24.11.0', filename: 'node.zip', directory: 'node-v24.11.0-win-x64',
    url: 'https://nodejs.org/dist/v24.11.0/node-v24.11.0-win-x64.zip',
    sha256: '1054540bce22b54ec7e50ebc078ec5d090700a77657607a58f6a64df21f49fdd' },
  python: { version: '3.13.9', filename: 'python.zip', directory: 'python',
    url: 'https://www.python.org/ftp/python/3.13.9/python-3.13.9-embed-amd64.zip',
    sha256: '91d828c2da3a029b41699e918674a0cb379c02cf20dab9c501306885f837402a' },
  pip: { version: '25.3', filename: 'pip.zip',
    url: 'https://files.pythonhosted.org/packages/44/3c/d717024885424591d5376220b5e836c2d5293ce2011523c9de23ff7bf068/pip-25.3-py3-none-any.whl',
    sha256: '9655943313a94722b7774661c21049070f6bbb0a1516bf02f7c8d5d9201514cd' },
});
const RUNTIME_DIRECTORY = /^runtime-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const within = (root, target) => { const relative = path.relative(root, target); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";

async function execute(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { ...options, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; let timedOut = false;
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8'); stream.on('data', (chunk) => { output = (output + chunk).slice(-64_000); });
    }
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 90_000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 || timedOut) reject(new Error((timedOut ? '工具执行超时。\n' : '') + (output.trim() || `工具退出代码：${code}`)));
      else resolve(output.trim());
    });
  });
}

async function downloadVerified(item, target, progress = () => {}) {
  const response = await fetch(item.url, { signal: AbortSignal.timeout(240_000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`下载失败（HTTP ${response.status}）：${new URL(item.url).hostname}`);
  const limit = 100 * 1024 * 1024;
  const expected = Number(response.headers.get('content-length'));
  if (expected > limit) throw new Error('工具下载超出大小限制。');
  const file = await fs.open(target, 'wx');
  const hash = crypto.createHash('sha256'); let received = 0; let lastProgress = 0;
  try {
    for await (const chunk of response.body) {
      received += chunk.length;
      if (received > limit) throw new Error('工具下载超出大小限制。');
      hash.update(chunk); await file.writeFile(chunk);
      if (Date.now() - lastProgress > 400) { lastProgress = Date.now(); progress({ received, total: expected || undefined }); }
    }
  } finally { await file.close(); }
  if (hash.digest('hex') !== item.sha256) throw new Error('下载校验失败，未启用新工具。');
  return received;
}

async function copyBundledVerified(item, bundleDirectory, target) {
  if (!bundleDirectory) throw new Error('应用没有内置工作空间工具包。');
  const bundleStat = await fs.lstat(bundleDirectory);
  if (bundleStat.isSymbolicLink() || !bundleStat.isDirectory()) throw new Error('应用内置工具目录无效。');
  const bundleRoot = await fs.realpath(bundleDirectory);
  const source = path.join(bundleRoot, item.filename);
  const sourceStat = await fs.lstat(source);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || sourceStat.size > 100 * 1024 * 1024
    || !within(bundleRoot, await fs.realpath(source))) throw new Error(`应用内置 ${item.filename} 无效。`);
  const contents = await fs.readFile(source);
  if (crypto.createHash('sha256').update(contents).digest('hex') !== item.sha256) {
    throw new Error(`应用内置 ${item.filename} SHA-256 校验失败。`);
  }
  await fs.writeFile(target, contents, { flag: 'wx' });
  return contents.length;
}

async function extractZip(archive, destination) {
  await fs.mkdir(destination, { recursive: true });
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = `$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem
$target = [IO.Path]::GetFullPath(${quote(destination)}).TrimEnd('\\') + '\\'
$zip = [IO.Compression.ZipFile]::OpenRead(${quote(archive)})
try {
  if ($zip.Entries.Count -gt 30000) { throw 'Too many archive entries' }
  [long]$total = 0
  foreach ($entry in $zip.Entries) {
    $total += $entry.Length
    if ($total -gt 536870912) { throw 'Archive is too large' }
    $name = $entry.FullName.Replace('/', '\\')
    if ($name.Contains(':') -or (($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw 'Unsupported archive entry' }
    $file = [IO.Path]::GetFullPath([IO.Path]::Combine($target, $name))
    if (-not $file.StartsWith($target, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escapes destination' }
    if ($name.EndsWith('\\')) { [IO.Directory]::CreateDirectory($file) | Out-Null; continue }
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($file)) | Out-Null
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $file, $false)
  }
} finally { $zip.Dispose() }`;
  await execute(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]);
}

function createWorkspaceTools(root, onProgress = () => {}, { bundleDirectory } = {}) {
  const managed = root && path.join(root, 'workspace-tools');
  const activeFile = managed && path.join(managed, 'active.json');
  let busy = false;
  let installError = '';
  async function checkManagedDirectory() {
    const managedStat = await fs.lstat(managed);
    if (managedStat.isSymbolicLink() || !managedStat.isDirectory()) throw new Error('工具安装目录不能使用链接，请恢复本机目录后重试。');
    const rootReal = await fs.realpath(root);
    if (!within(rootReal, await fs.realpath(managed))) throw new Error('工具安装目录超出 Scodex 范围。');
  }
  async function paths() {
    if (!managed) return null;
    try { await checkManagedDirectory(); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    let manifest;
    try { manifest = JSON.parse(await fs.readFile(activeFile, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw new Error('工作空间工具清单损坏，请重新安装。'); }
    if (manifest.version !== 1 || !RUNTIME_DIRECTORY.test(manifest.directory)) throw new Error('工作空间工具路径无效。');
    const managedReal = await fs.realpath(managed);
    const runtime = await fs.realpath(path.join(managed, manifest.directory));
    if (!within(managedReal, runtime)) throw new Error('工作空间工具不能链接到外部目录。');
    const nodeDirectory = await fs.realpath(path.join(runtime, CATALOG.node.directory));
    const pythonDirectory = await fs.realpath(path.join(runtime, 'python'));
    if (!within(runtime, nodeDirectory) || !within(runtime, pythonDirectory)) throw new Error('工具目录超出安装范围。');
    for (const directory of [path.join(managed, manifest.directory), path.join(runtime, CATALOG.node.directory), path.join(runtime, 'python')]) {
      if ((await fs.lstat(directory)).isSymbolicLink()) throw new Error('工具目录不能使用链接。');
    }
    for (const file of [path.join(nodeDirectory, 'node.exe'), path.join(pythonDirectory, 'python.exe')]) {
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || !within(runtime, await fs.realpath(file))) throw new Error('工具程序超出安装范围或不是有效文件。');
    }
    return { manifest, runtime, nodeDirectory, pythonDirectory };
  }
  async function status() {
    try {
      const active = await paths();
      return active ? { installed: true, directory: active.runtime, installedAt: active.manifest.installedAt,
        nodeVersion: CATALOG.node.version, pythonVersion: CATALOG.python.version, pipVersion: CATALOG.pip.version,
        source: active.manifest.source || '官方源' } : { installed: false, ...(installError ? { error: installError } : {}) };
    } catch (error) { return { installed: false, error: error.message }; }
  }
  async function environment(base = process.env) {
    const active = await paths();
    if (!active) return { ...base };
    const env = { ...base };
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';
    env[pathKey] = [active.nodeDirectory, active.pythonDirectory, path.join(active.pythonDirectory, 'Scripts'), env[pathKey] || ''].join(path.delimiter);
    env.SCODEX_NODE = path.join(active.nodeDirectory, 'node.exe');
    env.SCODEX_PYTHON = path.join(active.pythonDirectory, 'python.exe');
    return env;
  }
  async function inspect(active) {
    try { active ||= await paths(); } catch (error) { return { ok: false, output: error.message }; }
    if (!active) return { ok: false, output: '工作空间工具尚未安装。请点击“重新安装”。' };
    const node = path.join(active.nodeDirectory, 'node.exe');
    const python = path.join(active.pythonDirectory, 'python.exe');
    const checks = [
      ['Node.js', node, ['--version'], `v${CATALOG.node.version}`],
      ['npm', node, [path.join(active.nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js'), '--version']],
      ['Python', python, ['--version'], `Python ${CATALOG.python.version}`],
      ['pip', python, ['-m', 'pip', '--version'], `pip ${CATALOG.pip.version} `],
    ];
    const results = await Promise.allSettled(checks.map(async ([name, file, args, expected]) => {
      const result = await execute(file, args, { cwd: active.runtime });
      if (expected && !result.startsWith(expected)) throw new Error(`${name} 版本校验失败：${result}`);
      return `${name}: ${result}`;
    }));
    return { ok: results.every((result) => result.status === 'fulfilled'), output: results.map((result, index) =>
      result.status === 'fulfilled' ? result.value : `${checks[index][0]}: ${result.reason.message}`).join('\n') };
  }
  async function install(sourceKind) {
    if (!managed) throw new Error('找不到 Scodex 工具安装目录。');
    if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('当前工具包仅支持 Windows x64。');
    if (busy) throw new Error('工作空间工具正在安装。');
    busy = true; let managedValidated = false; const log = []; const directory = 'runtime-' + crypto.randomUUID();
    const runtime = path.join(managed, directory);
    const progress = (message, extra = {}) => { log.push(message); onProgress({ message, ...extra }); };
    try {
      await fs.mkdir(managed, { recursive: true });
      await checkManagedDirectory();
      managedValidated = true;
      await fs.mkdir(runtime, { recursive: true });
      for (const [name, item] of Object.entries(CATALOG)) {
        const archive = path.join(runtime, item.filename);
        let bytes;
        if (sourceKind === 'application-bundle') {
          progress(`正在校验应用内置 ${name} ${item.version}`);
          bytes = await copyBundledVerified(item, bundleDirectory, archive);
          onProgress({ message: `已载入应用内置 ${name} ${item.version}`, received: bytes, total: bytes });
        } else {
          progress(`正在下载 ${name} ${item.version}`);
          bytes = await downloadVerified(item, archive, (value) => onProgress({ message: `正在下载 ${name} ${item.version}`, ...value }));
        }
        progress(`${name} SHA-256 校验通过（${bytes} 字节）`);
        const destination = name === 'node' ? runtime : name === 'python' ? path.join(runtime, 'python') : path.join(runtime, 'python', 'Lib', 'site-packages');
        await extractZip(archive, destination);
      }
      const pythonDirectory = path.join(runtime, 'python');
      await fs.writeFile(path.join(pythonDirectory, 'python313._pth'), 'python313.zip\n.\nLib\nLib/site-packages\nimport site\n');
      await fs.writeFile(path.join(pythonDirectory, 'pip.cmd'), '@echo off\r\n"%~dp0python.exe" -m pip %*\r\n');
      progress('正在检查 Node.js、npm、Python 和 pip');
      const inspection = await inspect({ runtime, nodeDirectory: path.join(runtime, CATALOG.node.directory), pythonDirectory });
      log.push(inspection.output);
      if (!inspection.ok) throw new Error('新工具启动检查失败，已保留原有工具。');
      let previousDirectory;
      try { const previous = JSON.parse(await fs.readFile(activeFile, 'utf8')); if (RUNTIME_DIRECTORY.test(previous.directory)) previousDirectory = previous.directory; } catch {}
      const manifest = { version: 1, directory, installedAt: new Date().toISOString(), source: sourceKind,
        ...(previousDirectory ? { previousDirectory } : {}) };
      const temporary = path.join(managed, `active-${crypto.randomUUID()}.tmp`);
      await fs.writeFile(temporary, JSON.stringify(manifest, null, 2), { flag: 'wx' });
      await fs.rename(temporary, activeFile);
      installError = '';
      progress('安装完成，新开的 CLI 和终端将使用新工具。');
      return { ok: true, output: log.join('\n'), tools: await status() };
    } catch (error) {
      installError = error.message;
      log.push(`安装失败：${error.message}\n上一可用安装未替换。`);
      return { ok: false, output: log.join('\n'), tools: await status() };
    } finally {
      busy = false;
      if (managedValidated) await fs.writeFile(path.join(managed, 'install.log'), log.join('\n')).catch(() => {});
    }
  }
  async function ensureBundled() {
    const current = await status();
    if (current.installed) {
      const inspection = await inspect();
      if (inspection.ok) return { ok: true, unchanged: true, output: inspection.output, tools: current };
    }
    return install('application-bundle');
  }
  return {
    status, environment, inspect,
    reinstall: () => install('official-download'),
    reinstallBundled: () => install('application-bundle'),
    ensureBundled,
    get busy() { return busy; },
  };
}

module.exports = { CATALOG, copyBundledVerified, createWorkspaceTools, downloadVerified, extractZip };
