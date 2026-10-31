const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const { readCodexConfiguration } = require('../electron/codex-config-status.cjs');
const { toCodexConfigArguments } = require('../electron/agent-settings.cjs');
const { createAgentSettingsStore } = require('../electron/agent-settings-store.cjs');
const project = path.resolve(__dirname, '..');
const report = { date: new Date().toISOString(), checks: [], status: 'running', substitution: 'Native capture EXE replaces CLI only for launcher argument/environment assertions; real CLI separately reads config and lists features.' };
async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-config-cli-'));
  report.temporary = temporary;
  try {
    const workspace = path.join(temporary, 'workspace'); const nested = path.join(workspace, 'nested');
    await fs.mkdir(nested, { recursive: true }); await fs.mkdir(path.join(temporary, 'bin'));
    await fs.writeFile(path.join(temporary, 'config.toml'), 'disable_response_storage = true\n');
    const realCli = path.resolve(project, '..', 'bin', 'codex.exe');
    const env = { ...process.env, CODEX_HOME: temporary };
    const status = await readCodexConfiguration(realCli, workspace, env, toCodexConfigArguments({}));
    report.configuration = status;
    assert.equal(status.ok, true, status.error);
    assert.ok(status.warnings.some((warning) => /disable_response_storage|unrecognized/i.test(warning.summary + warning.details)), 'Actual CLI should report the controlled unrecognized key');
    report.checks.push('Real app-server config/read completes and returns a genuine unknown-setting warning');
    const compiler = path.join(process.env.SystemRoot, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
    const capture = path.join(temporary, 'capture.json');
    const source = path.join(temporary, 'capture.cs');
    await fs.writeFile(source, 'using System; using System.IO; using System.Text; using System.Web.Script.Serialization; class Capture { static void Main(string[] args) { var value = new { args=args, node=Environment.GetEnvironmentVariable("SCODEX_NODE"), python=Environment.GetEnvironmentVariable("SCODEX_PYTHON"), searchPath=Environment.GetEnvironmentVariable("PATH") }; File.WriteAllText(Environment.GetEnvironmentVariable("SCODEX_CONFIG_CAPTURE"), new JavaScriptSerializer().Serialize(value), new UTF8Encoding(false)); } }');
    await execute(compiler, ['/nologo', '/target:exe', '/r:System.Web.Extensions.dll', '/out:' + path.join(temporary, 'bin', 'codex.exe'), source], { windowsHide: true });
    for (const file of ['start-scodex.ps1', 'Scodex.cmd', 'Scodex-module-2.cmd']) await fs.copyFile(path.resolve(project, '..', file), path.join(temporary, file));
    const store = createAgentSettingsStore(temporary); await store.load(workspace);
    await store.update({ webSearch: 'cached', outputDetail: 'low' });
    await store.update({ webSearch: 'indexed', availableReasoningEfforts: ['medium'], workspaceDependencies: false }, 'workspace');
    for (const file of ['Scodex.cmd', 'Scodex-module-2.cmd']) {
      await execute('cmd.exe', ['/d', '/c', path.join(temporary, file), 'features', 'list'], { cwd: nested, env: { ...env, SCODEX_CONFIG_CAPTURE: capture, SCODEX_NODE: '', SCODEX_PYTHON: '' }, windowsHide: true });
      const value = JSON.parse(await fs.readFile(capture, 'utf8')); const args = value.args.map((arg) => arg.replaceAll('"', ''));
      for (const expected of ['web_search=indexed', 'model_reasoning_effort=medium', 'model_verbosity=low', '--disable', 'workspace_dependencies', 'features', 'list']) assert.ok(args.includes(expected), `${file}: ${expected}`);
      assert.ok(!args.includes('--profile')); assert.ok(!value.node); assert.ok(!value.python);
    }
    report.checks.push('Both actual .cmd launchers merge nearest workspace overrides, accept disabled dependencies, and skip credential decryption for utility commands');
    await fs.copyFile(realCli, path.join(temporary, 'bin', 'codex.exe'));
    for (const file of ['Scodex.cmd', 'Scodex-module-2.cmd']) {
      const result = await execute('cmd.exe', ['/d', '/c', path.join(temporary, file), 'features', 'list'], { cwd: nested, env, windowsHide: true, maxBuffer: 2_000_000 });
      assert.match(result.stdout, /workspace_dependencies/);
    }
    report.checks.push('Both launchers invoke the real installed CLI successfully with merged indexed-search and reasoning settings');
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.message; process.exitCode = 1; }
  finally {
    await fs.mkdir(path.join(project, 'release', 'configuration'), { recursive: true });
    await fs.writeFile(path.join(project, 'release', 'configuration', 'configuration-cli-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
