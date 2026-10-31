import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
const require = createRequire(import.meta.url);
const { buildPowerShellServerScript, createTerminalSessions } = require('../electron/terminal-session.cjs');

test('terminal server keeps commands in a workspace-scoped PowerShell process and rejects cross-window writes', async () => {
  const events = [];
  const writes = [];
  let spawnArgs;
  let spawnOptions;
  let child;
  const webContents = { isDestroyed: () => false, send: (_channel, event) => events.push(event) };
  const otherWebContents = { isDestroyed: () => false, send() {} };
  const sessions = createTerminalSessions({
    getWorkspaceRoot: () => 'E:\\GDP\\Scodex',
    getEnvironment: () => ({ PATH: 'controlled-path' }),
    shellPath: 'powershell.exe',
    spawnProcess: (_command, args, options) => {
      spawnArgs = args;
      spawnOptions = options;
      child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new EventEmitter();
      child.stdin.write = (value) => { writes.push(value); return true; };
      child.kill = () => { child.killed = true; child.emit('close', 0); return true; };
      queueMicrotask(() => {
        const markerText = options.env.SCODEX_TERMINAL_PROMPT_MARKER;
        child.stdout.write(`${String.fromCharCode(30)}${markerText}${Buffer.from('E:\\GDP\\Scodex').toString('base64')}${String.fromCharCode(31)}`);
      });
      return child;
    },
  });
  const started = await sessions.start(webContents);
  assert.equal(spawnOptions.cwd, 'E:\\GDP\\Scodex');
  assert.deepEqual(spawnOptions.stdio, ['pipe', 'pipe', 'pipe']);
  assert.equal(spawnOptions.env.PATH, 'controlled-path');
  const script = Buffer.from(spawnArgs.at(-1), 'base64').toString('utf16le');
  assert.match(script, /Invoke-Expression \$commandText/);
  assert.match(script, /Get-Location/);
  assert.equal(events.find((event) => event.type === 'prompt')?.directory, 'E:\\GDP\\Scodex');
  assert.equal(await sessions.write(webContents, started.sessionId, 'Get-Location'), true);
  assert.deepEqual(writes, ['Get-Location\r\n']);
  assert.throws(() => sessions.write(webContents, started.sessionId, 'Get-Location\nGet-ChildItem'), /一行命令/);
  assert.throws(() => sessions.write(otherWebContents, started.sessionId, 'Get-Location'), /已关闭/);
  assert.equal(sessions.close(otherWebContents, started.sessionId), false);
  assert.equal(sessions.close(webContents, started.sessionId), true);
  assert.equal(child.killed, true);
});

test('terminal prompt framing script uses UTF-8 and a private marker', () => {
  const script = buildPowerShellServerScript('SCODEX_TEST:');
  assert.match(script, /System\.Text\.UTF8Encoding/);
  assert.match(script, /ReadLine\(\)/);
  assert.ok(script.includes("[Console]::Out.Write('SCODEX_TEST:')"));
});
