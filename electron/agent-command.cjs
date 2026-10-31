const path = require('node:path');
const { spawn } = require('node:child_process');

const OUTPUT_LIMIT = 24_000;

function commandEnvironment(source) {
  return Object.fromEntries(Object.entries(source || process.env).filter(([name]) =>
    !/(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|ACCESS_KEY|PRIVATE_KEY)/i.test(name)
    && !['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'SCODEX_DPAPI_FILE', 'SCODEX_DPAPI_SCRIPT'].includes(name)));
}

async function stopProcessTree(child) {
  if (!child.pid) return;
  if (process.platform !== 'win32') { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } return; }
  await new Promise((resolve) => {
    const killer = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
      ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { killer.kill(); child.kill(); resolve(); }, 5000);
    const finish = () => { clearTimeout(timer); resolve(); };
    killer.once('error', () => { child.kill(); finish(); }); killer.once('close', finish);
  });
}

async function runAgentCommand({ command, cwd, signal, timeoutMs = 60_000, environment = process.env, onOutput = () => {} }) {
  if (typeof command !== 'string' || !command.trim() || command.length > 16_000 || command.includes('\0')) throw new Error('命令必须为 1–16000 个字符。');
  if (signal?.aborted) throw new Error('任务已停止，未启动命令。');
  const duration = Math.max(1000, Math.min(120_000, Number(timeoutMs) || 60_000));
  let executable; let args;
  if (process.platform === 'win32') {
    executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const script = [
      "$ErrorActionPreference = 'Stop'", '$ProgressPreference = \'SilentlyContinue\'',
      '$e = New-Object System.Text.UTF8Encoding($false)', '$OutputEncoding = $e', '[Console]::OutputEncoding = $e',
      '$global:LASTEXITCODE = 0', 'try {', command,
      '$scodexCommandSucceeded = $?', 'if ($global:LASTEXITCODE -ne 0) { exit $global:LASTEXITCODE }', 'if (-not $scodexCommandSucceeded) { exit 1 }', 'exit 0',
      '} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }',
    ].join('\r\n');
    args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
  } else { executable = '/bin/sh'; args = ['-c', command]; }
  const child = spawn(executable, args, { cwd, env: commandEnvironment(environment), windowsHide: true,
    detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; let total = 0; let timedOut = false; let cancelled = false; let stopping;
  let updateTimer;
  const send = () => { updateTimer = null; onOutput({ output, truncated: total > OUTPUT_LIMIT }); };
  const collect = (chunk) => { total += chunk.length; output = (output + chunk).slice(-OUTPUT_LIMIT); if (!updateTimer) updateTimer = setTimeout(send, 80); };
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  const stop = (timeout) => { timedOut ||= timeout; cancelled ||= !timeout; stopping ||= stopProcessTree(child); };
  const timer = setTimeout(() => stop(true), duration);
  const abort = () => stop(false);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  try {
    const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code) => resolve(code)); });
    if (stopping) await stopping;
    return { ok: exitCode === 0 && !timedOut && !cancelled, exitCode, timedOut, cancelled,
      output, truncated: total > OUTPUT_LIMIT,
      ...(timedOut ? { error: `命令超过 ${duration / 1000} 秒，已终止进程树。` }
        : cancelled ? { error: '命令已停止。已完成的文件修改仍然保留。' }
        : exitCode !== 0 ? { error: `命令退出码：${exitCode}。` } : {}) };
  } catch (error) { throw new Error(`无法启动命令：${error.message}`); }
  finally { clearTimeout(timer); clearTimeout(updateTimer); signal?.removeEventListener('abort', abort); send(); }
}

module.exports = { OUTPUT_LIMIT, commandEnvironment, runAgentCommand, stopProcessTree };
