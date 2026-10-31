const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { commandEnvironment, stopProcessTree } = require('./agent-command.cjs');
const { sensitive } = require('./agent-tools.cjs');

const LOG_LIMIT = 64_000;
const ACTIVE_LIMIT = 4;
const HISTORY_LIMIT = 16;
const LIVE = new Set(['starting', 'running', 'stopping']);
const inside = (root, target) => { const r = path.relative(root, target); return !r || r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r); };
const key = (root) => process.platform === 'win32' ? path.resolve(root).toLowerCase() : path.resolve(root);
function cleanText(value) {
  return String(value || '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/sk-[a-z0-9_-]{8,}/gi, '[密钥已隐藏]')
    .replace(/(Bearer\s+)[a-z0-9._~+\/-]{8,}/gi, '$1[已隐藏]')
    .replace(/((?:api[_-]?key|access[_-]?token|password|secret|token)["']?\s*[:=]\s*["']?)[^\s"',;}{]{4,}/gi, '$1[已隐藏]');
}
function previewAddress(input = '') {
  if (!input) return '';
  if (typeof input !== 'string' || input.length > 2048) throw new Error('预览地址无效。');
  let url; try { url = new URL(input); } catch { throw new Error('请输入完整的本机 HTTP 或 HTTPS 预览地址。'); }
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.hash || url.search) throw new Error('预览仅支持 localhost、127.0.0.1 或 [::1]，不能包含凭据、查询或片段。');
  return url.href;
}
function targetFor(url) {
  const parsed = new URL(url);
  return { protocol: parsed.protocol, hostname: parsed.hostname === '[::1]' ? '::1' : '127.0.0.1', port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)), path: parsed.pathname };
}
function loopbackHosts(url) { return new URL(url).hostname === 'localhost' ? ['127.0.0.1', '::1'] : [targetFor(url).hostname]; }
function portBusy(url) {
  const target = targetFor(url);
  return Promise.all(loopbackHosts(url).map((host) => new Promise((resolve) => {
    const socket = net.createConnection({ host, port: target.port });
    let done = false; const finish = (value) => { if (done) return; done = true; socket.destroy(); resolve(value); };
    socket.setTimeout(800, () => finish(true));
    socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
  }))).then((values) => values.some(Boolean));
}
function probeHttp(url) {
  const target = targetFor(url);
  return Promise.all(loopbackHosts(url).map((hostname) => new Promise((resolve) => {
    let done = false;
    const finish = (result) => { if (done) return; done = true; resolve(result); };
    const req = (target.protocol === 'https:' ? https : http).request({ ...target, hostname, method: 'GET', headers: { host: new URL(url).host }, agent: false }, (res) => {
      const status = res.statusCode || 0; res.destroy();
      finish({ ready: status >= 200 && status < 300, detail: 'HTTP ' + status });
    });
    req.setTimeout(1200, () => { req.destroy(); finish({ ready: false, detail: '等待预览响应' }); });
    req.once('error', () => finish({ ready: false, detail: '预览尚未连接' })); req.end();
  }))).then((values) => values.find((v) => v.ready) || values.find((v) => v.detail.startsWith('HTTP ')) || values[0]);
}

async function projectDirectory(rootInput, relative = '.', protectedPaths = []) {
  const root = await fs.realpath(rootInput);
  if (typeof relative !== 'string' || !relative.trim() || relative.length > 4096 || /[\x00-\x1f]/.test(relative)) throw new Error('服务目录无效。');
  const target = path.resolve(root, relative); const rel = path.relative(root, target);
  if (!inside(root, target) || sensitive(rel) || rel.split(path.sep).some((p) => p.toLowerCase() === '.git') || protectedPaths.some((p) => p && inside(path.resolve(p), target))) throw new Error('服务目录必须位于当前项目，且不能使用凭据或应用配置目录。');
  let part = root;
  for (const segment of rel.split(path.sep).filter(Boolean)) { part = path.join(part, segment); if ((await fs.lstat(part)).isSymbolicLink()) throw new Error('服务目录不能跨越符号链接或联接。'); }
  if (!(await fs.stat(target)).isDirectory()) throw new Error('服务工作目录不是文件夹。');
  return { root, target, relative: rel.replaceAll(path.sep, '/') || '.' };
}
function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((p) => !['name', 'command', 'cwd', 'previewUrl'].includes(p))) throw new Error('服务参数无效。');
  const command = input.command;
  if (typeof command !== 'string' || !command.trim() || command.length > 16000 || command.includes('\0')) throw new Error('启动命令应为 1–16000 个字符。');
  if (cleanText(command) !== command) throw new Error('启动命令包含秘密值或控制字符。请改用项目环境文件，不要在命令中填写凭据。');
  const name = input.name === undefined || input.name === '' ? '开发服务' : input.name;
  if (typeof name !== 'string' || !name.trim() || name.length > 80 || /[\x00-\x1f]/.test(name)) throw new Error('服务名称应为 1–80 个字符。');
  return { name: cleanText(name.trim()), command, cwd: input.cwd || '.', previewUrl: previewAddress(input.previewUrl || '') };
}
function createDevServices({ environment = async () => process.env, protectedPaths = [], onChanged = () => {} } = {}) {
  const resolveDirectory = async (root, cwd) => projectDirectory(root, cwd, typeof protectedPaths === 'function' ? await protectedPaths(root) : protectedPaths);
  const entries = new Map(); const epochs = new Map(); let changeTimer; let shuttingDown = false;
  const notify = () => { if (!changeTimer) changeTimer = setTimeout(() => { changeTimer = null; onChanged(); }, 60); };
  const activeCount = () => [...entries.values()].filter((e) => LIVE.has(e.status)).length;
  function view(entry) {
    return { id: entry.id, name: entry.name, command: entry.command, cwd: entry.cwd, relativeCwd: entry.relativeCwd, previewUrl: entry.previewUrl,
      status: entry.status, health: entry.health, healthDetail: entry.healthDetail, pid: entry.child?.pid || null, exitCode: entry.exitCode,
      startedAt: entry.startedAt, endedAt: entry.endedAt, source: entry.source, error: entry.error, truncated: entry.omitted || entry.total > LOG_LIMIT };
  }
  function get(root, id) {
    const entry = entries.get(id);
    if (!entry || key(entry.root) !== key(root)) throw new Error('当前项目没有这个托管服务。');
    return entry;
  }
  function append(entry, chunk, final = false) {
    // Only completed lines leave the process buffer. Secrets split over chunks
    // cannot leak through an earlier update; excessively long lines are omitted.
    entry.pending += String(chunk).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const last = final ? entry.pending.length : entry.pending.lastIndexOf('\n') + 1;
    let complete = entry.pending.slice(0, last); entry.pending = entry.pending.slice(last);
    if (entry.dropping) { const end = complete.indexOf('\n'); complete = end < 0 ? '' : complete.slice(end + 1); if (end >= 0 || final) entry.dropping = false; }
    if (entry.pending.length > LOG_LIMIT) { entry.omitted = true; entry.pending = ''; entry.dropping = true; complete += '\n[过长的单行输出已省略]\n'; }
    if (complete) { const clean = cleanText(complete); entry.total += clean.length; entry.output = (entry.output + clean).slice(-LOG_LIMIT); notify(); }
  }
  async function health(entry) {
    if (!entry.previewUrl || !LIVE.has(entry.status) || entry.status === 'stopping' || entry.probing) return;
    entry.probing = true;
    try {
      const result = await probeHttp(entry.previewUrl);
      if (!LIVE.has(entry.status) || entry.status === 'stopping') return;
      entry.health = result.ready ? 'ready' : 'waiting'; entry.healthDetail = result.detail; notify();
    } finally { entry.probing = false; }
  }
  async function waitFor(entry, signal, waitMs) {
    const deadline = Date.now() + waitMs;
    while (LIVE.has(entry.status) && entry.health !== 'ready' && Date.now() < deadline) {
      if (signal?.aborted) throw new Error('任务已停止。');
      await new Promise((r) => setTimeout(r, 80));
      if (!entry.previewUrl && Date.now() - entry.createdMs > 450) break;
    }
  }
  async function stop(root, id) {
    const entry = get(root, id);
    if (!LIVE.has(entry.status)) return view(entry);
    if (entry.stopPromise) return entry.stopPromise;
    entry.status = 'stopping'; entry.requestedStop = true; clearInterval(entry.healthTimer); notify();
    entry.stopPromise = (async () => {
      await stopProcessTree(entry.child);
      let timer;
      try { await Promise.race([entry.closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('尚未确认服务进程退出，请保留工作台并再次停止。')), 7000); })]); }
      finally { clearTimeout(timer); }
      return view(entry);
    })();
    try { return await entry.stopPromise; } finally { entry.stopPromise = null; }
  }
  async function start(rootInput, input, { signal, guard = async () => {}, source = '手动', waitMs = 8000 } = {}) {
    if (shuttingDown) throw new Error('工作台正在退出，不能启动服务。');
    const epochKey = key(rootInput), epoch = epochs.get(epochKey) || 0;
    const normalized = normalizeInput(input);
    const first = await resolveDirectory(rootInput, normalized.cwd);
    await guard(); if (signal?.aborted) throw new Error('任务已停止，未启动服务。');
    if (normalized.previewUrl && await portBusy(normalized.previewUrl)) throw new Error('预览端口已被占用。请更换端口，或先停止占用它的服务；不会终止其他进程。');
    const env = commandEnvironment(await environment());
    const fresh = await resolveDirectory(rootInput, normalized.cwd);
    await guard(); if (signal?.aborted || shuttingDown) throw new Error('启动已取消。');
    if (fresh.root !== first.root || fresh.target !== first.target) throw new Error('服务工作目录在启动前已变化。');
    if (activeCount() >= ACTIVE_LIMIT) throw new Error('最多同时托管 4 个开发服务，请先停止不再使用的服务。');
    if ([...entries.values()].some((e) => LIVE.has(e.status) && key(e.root) === key(fresh.root) && e.command === normalized.command && e.cwd === fresh.target)) throw new Error('相同目录和命令的服务正在运行，请查看现有服务。');
    let executable, args;
    if (process.platform === 'win32') {
      executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const host = await fs.readFile(path.join(__dirname, 'dev-service-host.ps1'), 'utf8');
      const script = '$scodexOwnerPid = ' + process.pid + '\r\n' + host + '\r\n$scodexServiceCommand = [Console]::In.ReadToEnd()\r\n$global:LASTEXITCODE = 0\r\ntry { & ([ScriptBlock]::Create($scodexServiceCommand)); if ($global:LASTEXITCODE -ne 0) { exit $global:LASTEXITCODE }; exit 0 } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }';
      args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
    } else { executable = '/bin/sh'; args = ['-c', normalized.command]; }
    // Recheck after every asynchronous preparation step, directly before spawn.
    await guard(); if (signal?.aborted || shuttingDown || activeCount() >= ACTIVE_LIMIT || epoch !== (epochs.get(epochKey) || 0)) throw new Error('启动条件已经变化，请重新检查服务列表。');
    if ([...entries.values()].some((e) => LIVE.has(e.status) && key(e.root) === key(fresh.root) && e.command === normalized.command && e.cwd === fresh.target)) throw new Error('相同目录和命令的服务正在运行。');
    for (const old of entries.values()) if (entries.size >= HISTORY_LIMIT && !LIVE.has(old.status)) entries.delete(old.id);
    const entry = { id: crypto.randomUUID(), ...normalized, root: fresh.root, cwd: fresh.target, relativeCwd: fresh.relative, source,
      createdMs: Date.now(), startedAt: new Date().toISOString(), endedAt: null, exitCode: null, status: 'starting', health: normalized.previewUrl ? 'waiting' : 'none', healthDetail: '', output: '', pending: '', total: 0, omitted: false, error: '' };
    const child = spawn(executable, args, { cwd: fresh.target, env, windowsHide: true, detached: process.platform !== 'win32', stdio: [process.platform === 'win32' ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    entry.child = child; entries.set(entry.id, entry);
    if (child.stdin) { child.stdin.on('error', () => {}); child.stdin.end(normalized.command, 'utf8'); }
    entry.closed = new Promise((resolve) => {
      child.once('error', (error) => { entry.error = cleanText('无法启动服务：' + error.message).slice(0, 1200); });
      child.once('close', (code) => { append(entry, '', true); entry.exitCode = code; entry.endedAt = new Date().toISOString(); entry.status = entry.requestedStop ? 'stopped' : code === 0 && !entry.error ? 'exited' : 'failed'; entry.health = 'off'; clearInterval(entry.healthTimer); notify(); resolve(); });
    });
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => append(entry, chunk)); child.stderr.on('data', (chunk) => append(entry, chunk));
    child.once('spawn', () => { if (entry.status === 'starting') entry.status = 'running'; notify(); });
    if (entry.previewUrl) { entry.healthTimer = setInterval(() => void health(entry), 1000); void health(entry); }
    notify();
    const abort = () => { void stop(fresh.root, entry.id).catch(() => {}); };
    signal?.addEventListener('abort', abort, { once: true });
    try { await waitFor(entry, signal, Math.min(15000, Math.max(300, waitMs))); await guard(); if (signal?.aborted) throw new Error('任务已停止。'); return view(entry); }
    catch (error) { await stop(fresh.root, entry.id); throw error; }
    finally { signal?.removeEventListener('abort', abort); }
  }
  async function scripts(root) {
    const directory = await resolveDirectory(root, '.'); const file = path.join(directory.target, 'package.json');
    try {
      if ((await fs.lstat(file)).isSymbolicLink()) throw new Error('不读取联接的 package.json。');
      const stat = await fs.stat(file); if (!stat.isFile() || stat.size > 512 * 1024) throw new Error('package.json 超过读取范围。');
      const value = JSON.parse(await fs.readFile(file, 'utf8'));
      return Object.entries(value.scripts || {}).filter(([name, command]) => /^[a-z0-9_:.\/-]{1,100}$/i.test(name) && typeof command === 'string').slice(0, 80).map(([name, command]) => ({ name, description: cleanText(command).slice(0, 400), command: "npm run '" + name + "'" }));
    } catch (error) { if (error.code === 'ENOENT') return []; throw new Error('读取项目脚本失败：' + error.message); }
  }
  return { start, stop, scripts, activeCount,
    normalize: normalizeInput, resolve: resolveDirectory,
    snapshot(root) { return { workspaceRoot: root, maxActive: ACTIVE_LIMIT, logLimit: LOG_LIMIT, services: [...entries.values()].filter((e) => key(e.root) === key(root)).reverse().map(view) }; },
    describe(root, id) { return view(get(root, id)); },
    logs(root, id, limit = 12000) { const entry = get(root, id); const count = Math.max(100, Math.min(24000, Number(limit) || 12000)); return { service: view(entry), output: entry.output.slice(-count), truncated: entry.omitted || entry.total > count, pendingLine: Boolean(entry.pending || entry.dropping) }; },
    async preview(root, id) { const entry = get(root, id); if (!LIVE.has(entry.status) || !entry.previewUrl) throw new Error('服务未运行或没有预览地址。'); await health(entry); if (entry.health !== 'ready') throw new Error('预览尚未就绪：' + entry.healthDetail); return entry.previewUrl; },
    async stopAll(root) { if (root) epochs.set(key(root), (epochs.get(key(root)) || 0) + 1); else for (const entry of entries.values()) epochs.set(key(entry.root), (epochs.get(key(entry.root)) || 0) + 1); const targets = [...entries.values()].filter((e) => LIVE.has(e.status) && (!root || key(e.root) === key(root))); await Promise.all(targets.map((e) => stop(e.root, e.id))); },
    async shutdown() { shuttingDown = true; await this.stopAll(); clearTimeout(changeTimer); },
  };
}
module.exports = { createDevServices, previewAddress, projectDirectory, normalizeInput, cleanText, LOG_LIMIT, ACTIVE_LIMIT };
