// Read-only startup/normal-exit check against the existing user profile.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');

const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const executable = process.env.SCODEX_PROFILE_EXE || 'C:/Program Files/scodex-workbench/Scodex工作台.exe';
const output = path.join(root, 'release', 'delivery-' + version, 'installed-profile-final.json');
const profile = path.join(process.env.APPDATA, 'scodex-workbench');
const names = ['conversations.json', 'settings.json', 'model-connection.json', 'device-profile.json'];
const memoryPath = path.join(profile, 'learning-memory.json');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const hashes = async () => Object.fromEntries(await Promise.all(names.map(async name => [name, sha(await fs.readFile(path.join(profile, name)))])));

async function main() {
  const before = await hashes(), memoryBefore = sha(await fs.readFile(memoryPath)), port = await freePort();
  const child = spawn(executable, ['--remote-debugging-port=' + port, '--disable-gpu'], { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '', socket;
  child.stderr.on('data', data => { stderr = (stderr + data).slice(-2000); });
  let result = { status: 'running', version, executable };
  try {
    const target = await wait(async () => {
      if (child.exitCode !== null) throw Error('程序提前退出：' + child.exitCode + ' ' + stderr);
      const pages = await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json());
      return pages.find(page => page.type === 'page' && page.url.startsWith('file:') && !page.url.includes('workspaceWindow='));
    }, '已安装程序启动', 45000);
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    const page = connect(socket);
    await wait(() => page.evaluate('Boolean(window.scodex && document.querySelector("[aria-label=输入工作内容]"))'), '主界面就绪');
    const state = await page.evaluate('window.scodex.getAppState().then(s=>({version:s.version,conversations:s.library.conversations.length,messages:s.library.conversations.reduce((n,c)=>n+c.messages.length,0),historyError:s.historyError||null}))');
    assert.equal(state.version, version);
    assert.equal(state.historyError, null);
    await page.evaluate('window.scodex.quitApp()');
    await wait(() => child.exitCode !== null, '正常退出', 30000);
    assert.equal(child.exitCode, 0);
    const after = await hashes();
    assert.deepEqual(after, before);
    const memoryBytes = await fs.readFile(memoryPath), memory = JSON.parse(memoryBytes.toString('utf8'));
    assert.equal(typeof memory.encrypted, 'string');
    result = { status: 'passed', version, executable, conversations: state.conversations, messages: state.messages, exitCode: child.exitCode, unchangedProfileFiles: names, validEncryptedMemory: true, memoryUpdatedOnExit: sha(memoryBytes) !== memoryBefore };
  } catch (error) {
    result = { status: 'failed', version, executable, error: error.stack, exitCode: child.exitCode };
    process.exitCode = 1;
  } finally {
    socket?.close();
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(result, null, 2));
    process.stdout.write(JSON.stringify({ status: result.status, report: output, conversations: result.conversations, messages: result.messages }) + '\n');
  }
}
main();
