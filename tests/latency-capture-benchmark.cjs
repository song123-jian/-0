const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'release/delivery-1.3.36');
const encryption = { isEncryptionAvailable: () => true, encryptString: text => Buffer.from(text), decryptString: bytes => bytes.toString() };
function original(baseline, name) {
  const file = baseline.files.find(item => item.path === name);
  const module = new Module(path.join(root, name), moduleParent);
  module.filename = path.join(root, name); module.paths = Module._nodeModulePaths(path.dirname(module.filename));
  module._compile(file.content, module.filename); return module.exports;
}
const moduleParent = module;
async function main() {
  const baseline = JSON.parse(await fs.readFile(path.join(output, 'source-baseline.json'), 'utf8'));
  const directory = await fs.mkdtemp(path.join(output, 'benchmark-'));
  const workspace = path.join(directory, 'workspace'); await fs.mkdir(workspace);
  const report = { environment: { node: process.version, platform: process.platform }, scope: 'Same disk files and delayed loopback stream; Node encryption stub, not a remote-model or Windows-encryption benchmark.' };
  try {
    for (let i = 0; i < 320; i++) await fs.writeFile(path.join(workspace, String(i).padStart(3, '0') + '.txt'), Buffer.alloc(64 * 1024, 97));
    const target = path.join(workspace, 'z-edited.txt');
    const oldCapture = original(baseline, 'electron/task-file-changes.cjs'), currentCapture = require('../electron/task-file-changes.cjs');
    report.capture = [];
    for (const [name, implementation] of [['1.3.35', oldCapture], ['1.3.36', currentCapture]]) {
      await fs.writeFile(target, 'original\n');
      const service = implementation.createTaskFileChanges(path.join(directory, name), { encryption });
      const tracker = service.begin(crypto.randomUUID(), workspace, 'benchmark'), started = performance.now(); const commands = [];
      for (let index = 0; index < 4; index++) { const start = performance.now(); await tracker.command(() => fs.writeFile(target, 'round-' + index + '\n')); commands.push(Math.round(performance.now() - start)); }
      const record = await tracker.finish();
      report.capture.push({ version: name, totalMs: Math.round(performance.now() - started), commandMs: commands, files: record?.files.map(file => file.path) || [], warning: record?.warning || '', coverage: record?.coverage });
    }
    assert.deepEqual(report.capture[1].files, ['z-edited.txt']); assert.equal(report.capture[1].warning, '');
    report.stream = [];
    for (const [name, implementation] of [['1.3.35', original(baseline, 'electron/agent-runtime.cjs')], ['1.3.36', require('../electron/agent-runtime.cjs')]]) {
      let requests = 0, firstToolMs = null, timer;
      const started = performance.now();
      await implementation.runModelTask({ connection: { endpoint: 'http://127.0.0.1/fixture', model: 'fixture', apiKey: 'fixture' }, messages: [],
        tools: [{ type: 'function', function: { name: 'read_file', parameters: { type: 'object' } } }],
        executeTool: async () => { firstToolMs = Math.round(performance.now() - started); return { ok: true }; },
        fetchImpl: async () => {
          const first = requests++ === 0;
          return new Response(new ReadableStream({ start(controller) {
            const message = first ? { tool_calls: [{ index: 0, id: 'fixture', function: { name: 'read_file', arguments: '{}' } }] } : { content: 'done' };
            controller.enqueue(Buffer.from('data: ' + JSON.stringify({ choices: [{ delta: message, finish_reason: first ? 'tool_calls' : 'stop' }] }) + '\n\n'));
            timer = setTimeout(() => { controller.enqueue(Buffer.from('data: [DONE]\n\n')); controller.close(); }, 500);
          }, cancel() { clearTimeout(timer); } }), { headers: { 'content-type': 'text/event-stream' } });
        } });
      report.stream.push({ version: name, firstToolMs, totalMs: Math.round(performance.now() - started), deliberateGatewayTailMs: 500 });
    }
    report.status = 'passed'; await fs.writeFile(path.join(output, 'performance-benchmark.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally {
    if (path.dirname(directory) !== output || !path.basename(directory).startsWith('benchmark-')) throw Error('Unsafe fixture cleanup');
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
