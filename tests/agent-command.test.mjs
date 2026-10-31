import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runAgentCommand, commandEnvironment } = require('../electron/agent-command.cjs');

test('commands return actual Unicode output and native nonzero exit codes', async () => {
  const result = await runAgentCommand({ cwd: os.tmpdir(), command: process.platform === 'win32' ? "[Console]::Out.WriteLine('实际中文输出'); cmd /c exit 7" : "printf '实际中文输出'; exit 7" });
  assert.equal(result.ok, false); assert.equal(result.exitCode, 7); assert.match(result.output, /实际中文输出/);
});

test('cancellation terminates the command process tree and waits for completion', { timeout: 15_000 }, async () => {
  const controller = new AbortController(); let descendant;
  const command = process.platform === 'win32'
    ? "$p=Start-Process powershell.exe -ArgumentList '-NoProfile -Command Start-Sleep 30' -PassThru -WindowStyle Hidden; [Console]::Out.WriteLine('CHILD:'+$p.Id); Start-Sleep 30"
    : "sleep 30 & echo CHILD:$!; wait";
  const result = await runAgentCommand({ cwd: os.tmpdir(), command, signal: controller.signal, onOutput: ({ output }) => {
    const matched = output.match(/CHILD:(\d+)/); if (matched && !descendant) { descendant = Number(matched[1]); controller.abort(); }
  } });
  assert.ok(descendant); assert.equal(result.cancelled, true); assert.equal(result.ok, false);
  assert.throws(() => process.kill(descendant, 0), /ESRCH|not found|不存在/);
});

test('timeout stops finite commands and private environment values are omitted', { timeout: 10_000 }, async () => {
  const environment = commandEnvironment({ PATH: 'path', OPENAI_API_KEY: 'do-not-pass', AUTH_TOKEN: 'secret', NODE_OPTIONS: 'bad', SCODEX_DPAPI_FILE: 'private' });
  assert.deepEqual(environment, { PATH: 'path' });
  const result = await runAgentCommand({ cwd: os.tmpdir(), command: process.platform === 'win32' ? 'Start-Sleep 30' : 'sleep 30', timeoutMs: 1000 });
  assert.equal(result.timedOut, true); assert.equal(result.ok, false);
});
