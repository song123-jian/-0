const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function startEscapeWatcher({ onCancel, onFailure }) {
  if (process.platform !== 'win32') throw new Error('电脑操控停止快捷键当前仅支持 Windows。');
  const script = fs.readFileSync(path.join(__dirname, 'desktop-escape.ps1'), 'utf8');
  const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.on('error', () => {});
  let disposed = false; let initialized = false; let failed = false; let buffer = '';
  let readyResolve; let readyReject; let exitResolve;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const exited = new Promise(resolve => { exitResolve = resolve; });
  const fail = () => {
    if (disposed || failed) return;
    failed = true;
    readyReject(new Error('电脑操控 Esc 停止监听不可用，已停止任务。'));
    onFailure();
  };
  const timer = setTimeout(() => { fail(); child.kill(); }, 10000);
  child.stdout.on('data', chunk => {
    buffer += chunk.toString('utf8');
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1);
      if (line === 'ready' && !initialized) { initialized = true; clearTimeout(timer); readyResolve(); }
      else if (line === 'cancel' && initialized && !disposed) onCancel();
    }
  });
  child.stderr.resume();
  child.once('error', fail);
  child.once('close', () => { clearTimeout(timer); fail(); exitResolve(); });
  return { ready, async close() {
    disposed = true; clearTimeout(timer);
    readyReject(new Error('电脑操控已结束。'));
    if (child.exitCode === null) child.kill();
    await exited;
  } };
}

module.exports = { startEscapeWatcher };
