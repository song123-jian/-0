const { spawn } = require('node:child_process');
const readline = require('node:readline');

// Read-only app-server handshake: discard config values and return warnings only.
function readCodexConfiguration(executable, cwd, env, overrides = []) {
  return new Promise((resolve) => {
    const child = spawn(executable, ['app-server', ...overrides], { cwd, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const warnings = []; let result; let finished = false;
    const end = (value) => { if (finished) return; finished = true; result = value; clearTimeout(timer); child.kill(); };
    const timer = setTimeout(() => end({ ok: false, warnings, error: '读取配置超时，请稍后刷新或运行诊断。' }), 25_000);
    const send = (value) => { if (!finished && !child.stdin.destroyed) child.stdin.write(JSON.stringify(value) + '\n'); };
    child.stdin.on('error', () => {});
    child.stderr.resume();
    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', (line) => {
      if (finished || line.length > 2_000_000) return;
      let message; try { message = JSON.parse(line); } catch { return; }
      if (['configWarning', 'config/warning'].includes(message.method) && typeof message.params?.summary === 'string') {
        const { summary, details, path, range } = message.params;
        if (warnings.length < 30) warnings.push({ summary, details, path, range });
      }
      if (message.id === 1) {
        if (message.error) return end({ ok: false, warnings, error: 'Codex CLI 配置初始化失败，请运行诊断查看详情。' });
        send({ method: 'initialized' });
        send({ id: 2, method: 'config/read', params: { cwd, includeLayers: false } });
      }
      if (message.id === 2) end(message.error
        ? { ok: false, warnings, error: 'Codex CLI 无法读取当前配置，请运行诊断查看详情。' }
        : { ok: true, warnings });
    });
    child.once('error', () => { clearTimeout(timer); lines.close(); resolve({ ok: false, warnings, error: '无法启动 Codex CLI，请检查安装。' }); });
    child.once('close', () => { clearTimeout(timer); lines.close(); resolve(result || { ok: false, warnings, error: 'Codex CLI 提前退出，请运行诊断查看详情。' }); });
    send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'scodex-configuration', version: '1.0.0' } } });
  });
}
module.exports = { readCodexConfiguration };
