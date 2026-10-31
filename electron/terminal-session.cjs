const crypto = require('node:crypto');
const path = require('node:path');
const { spawn } = require('node:child_process');

const MAX_COMMAND_LENGTH = 8_192;
const PROMPT_END = '\u001f';
const OUTPUT_START = '\u001e';

function buildPowerShellServerScript(markerText) {
  return [
    "$ErrorActionPreference = 'Continue'",
    '$encoding = New-Object System.Text.UTF8Encoding($false)',
    '$OutputEncoding = $encoding',
    '[Console]::OutputEncoding = $encoding',
    '[Console]::InputEncoding = $encoding',
    'function Write-ScodexPrompt {',
    '  $location = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Location).Path))',
    '  [Console]::Out.Write([char]30)',
    `  [Console]::Out.Write('${markerText}')`,
    '  [Console]::Out.Write($location)',
    '  [Console]::Out.WriteLine([char]31)',
    '  [Console]::Out.Flush()',
    '}',
    'Write-ScodexPrompt',
    'while ($null -ne ($commandText = [Console]::In.ReadLine())) {',
    '  try {',
    '    $result = Invoke-Expression $commandText 2>&1 | Out-String -Width 160',
    '    if ($result) { [Console]::Out.Write($result); [Console]::Out.Flush() }',
    '  } catch { [Console]::Error.WriteLine($_.Exception.Message); [Console]::Error.Flush() }',
    '  Write-ScodexPrompt',
    '}',
  ].join('\r\n');
}

function createTerminalSessions({ getWorkspaceRoot, getEnvironment = () => process.env, spawnProcess = spawn, shellPath } = {}) {
  const sessions = new Map();

  const send = (session, payload) => {
    if (!session.webContents.isDestroyed()) session.webContents.send('terminal-session:event', { sessionId: session.id, ...payload });
  };

  const finish = (session, error) => {
    if (sessions.get(session.id) === session) sessions.delete(session.id);
    if (error) send(session, { type: 'error', message: error });
  };

  const start = async (webContents) => {
    const existing = [...sessions.values()].find((session) => session.webContents === webContents);
    if (existing) return { sessionId: existing.id, directory: existing.directory };
    const directory = getWorkspaceRoot();
    if (!directory) throw new Error('当前工作区不可用。');
    const markerText = `SCODEX_${crypto.randomBytes(18).toString('hex')}:`;
    const marker = `${OUTPUT_START}${markerText}`;
    const executable = shellPath || path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const script = buildPowerShellServerScript(markerText);
    const child = spawnProcess(executable, ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
      cwd: directory,
      env: { ...process.env, ...(await getEnvironment()), SCODEX_TERMINAL_PROMPT_MARKER: markerText },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const session = { id: crypto.randomUUID(), webContents, child, directory, marker, output: '' };
    sessions.set(session.id, session);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    return new Promise((resolve, reject) => {
      let ready = false;
      let settled = false;
      const timeout = setTimeout(() => fail('PowerShell 启动超时。'), 8_000);
      const fail = (message) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        finish(session);
        child.kill();
        reject(new Error(message));
      };
      const emitOutput = (text) => { if (text) send(session, { type: 'output', text }); };
      const parseOutput = () => {
        while (session.output) {
          const markerIndex = session.output.indexOf(session.marker);
          if (markerIndex < 0) {
            const partialMarker = session.output.lastIndexOf(OUTPUT_START);
            const flushLength = partialMarker < 0 ? session.output.length : partialMarker;
            emitOutput(session.output.slice(0, flushLength));
            session.output = session.output.slice(flushLength);
            return;
          }
          emitOutput(session.output.slice(0, markerIndex));
          const endIndex = session.output.indexOf(PROMPT_END, markerIndex + session.marker.length);
          if (endIndex < 0) {
            session.output = session.output.slice(markerIndex);
            return;
          }
          const encodedDirectory = session.output.slice(markerIndex + session.marker.length, endIndex);
          let promptDirectory = session.directory;
          try { promptDirectory = Buffer.from(encodedDirectory, 'base64').toString('utf8') || session.directory; } catch {}
          send(session, { type: 'prompt', directory: promptDirectory });
          session.output = session.output.slice(endIndex + 1);
          if (!ready) {
            ready = true;
            settled = true;
            clearTimeout(timeout);
            resolve({ sessionId: session.id, directory: promptDirectory });
          }
        }
      };
      child.stdout.on('data', (chunk) => { session.output += chunk; parseOutput(); });
      child.stderr.on('data', (chunk) => send(session, { type: 'output', text: chunk }));
      child.once('error', (error) => fail(`无法启动 PowerShell：${error.message}`));
      child.once('close', (code) => {
        finish(session);
        if (!ready) fail('PowerShell 未能启动。');
        else send(session, { type: 'exit', code });
      });
      child.stdin.on('error', () => finish(session));
    });
  };

  const write = (webContents, sessionId, command) => {
    const session = sessions.get(sessionId);
    if (!session || session.webContents !== webContents) throw new Error('终端会话已关闭。');
    if (typeof command !== 'string' || command.length > MAX_COMMAND_LENGTH || /[\r\n\x00]/.test(command)) {
      throw new Error(`每次只能输入一行命令，最多 ${MAX_COMMAND_LENGTH} 个字符。`);
    }
    session.child.stdin.write(`${command}\r\n`);
    return true;
  };

  const close = (webContents, sessionId) => {
    const session = sessions.get(sessionId);
    if (!session || session.webContents !== webContents) return false;
    sessions.delete(sessionId);
    session.child.kill();
    return true;
  };

  const closeFor = (webContents) => {
    for (const session of sessions.values()) if (session.webContents === webContents) close(webContents, session.id);
  };

  const closeAll = () => {
    for (const session of sessions.values()) {
      sessions.delete(session.id);
      session.child.kill();
    }
  };

  return { start, write, close, closeFor, closeAll };
}

module.exports = { MAX_COMMAND_LENGTH, buildPowerShellServerScript, createTerminalSessions };
