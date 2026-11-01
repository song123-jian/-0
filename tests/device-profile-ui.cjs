// The EXE, React, IPC, device identity and Windows credential storage are real.
// Another-computer ownership is represented by a controlled marker, not a second physical computer.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const { prepareDeviceProfile } = require('../electron/device-profile.cjs');
const root = path.resolve(__dirname, '..');
const executable = process.env.SCODEX_DEVICE_EXE || path.join(root, 'release/device-initialization-20261101/candidate/win-unpacked/Scodex工作台.exe');
const output = process.env.SCODEX_DEVICE_OUTPUT || path.join(root, 'release/device-initialization-20261101/candidate-ui');
const scope = process.env.SCODEX_DEVICE_SCOPE || 'full';
const report = { status: 'running', version: '1.3.30', executable, scope, checks: [], limitations: ['Another computer is represented by a foreign ownership marker on this Windows device.', 'Only model discovery uses loopback; no public model generation is claimed.'] };
let temporary, app, socket, cdp, server, serviceUrl, activeProfile;
const key = 'controlled-test-only-' + crypto.randomUUID();
const json = JSON.stringify;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function persist() { await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'device-profile-ui-verification.json'), json(report, null, 2)); }
async function check(name, action) { const evidence = await action(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); }
async function state() {
  return cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,profile:s.userDataPath,codexConfigPath:s.codexConfigPath,workspace:s.workspaceRoot,model:s.model,baseUrl:s.connection.baseUrl,name:s.connection.name,hasCredential:s.connection.hasCredential,models:s.connection.models,projects:s.projects.length,conversations:s.library.conversations.length,messages:s.library.conversations.reduce((n,c)=>n+c.messages.length,0),drafts:s.library.conversations.filter(c=>c.draft).length}))');
}
async function launch(profile, home) {
  const port = await freePort();
  const args = ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'];
  if (home) args.push('--scodex-home=' + home);
  app = spawn(executable, args, { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; app.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-3000); });
  app.on('error', error => { stderr = error.message; });
  const target = await wait(async () => {
    if (app.exitCode !== null) throw Error('EXE exited: ' + stderr);
    const items = await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json());
    return items.find(item => item.type === 'page' && item.url.startsWith('file:') && !item.url.endsWith('desktop-control.html'));
  }, 'Actual desktop EXE ready', 60000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex && document.querySelector("[aria-label=输入工作内容]"))'), 'React ready', 45000);
  const current = await state(); assert.equal(current.version, report.version); activeProfile = current.profile;
  return current;
}
async function stop() {
  if (!app || app.exitCode !== null) return;
  await cdp.evaluate('window.scodex.quitApp()').catch(() => {});
  await wait(() => app.exitCode !== null, 'Clean desktop exit', 25000);
  socket?.close(); app = null; cdp = null;
}
async function textClick(text) {
  await wait(() => cdp.evaluate('(()=>{const e=[...document.querySelectorAll("button")].find(e=>e.textContent.trim()===' + json(text) + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Button: ' + text);
}
async function fill(selector, value) {
  await cdp.evaluate('(()=>{const e=document.querySelector(' + json(selector) + ');if(!e)throw Error("Input missing");e.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}));})()');
}
async function openConnection() {
  await cdp.evaluate('document.querySelector("[aria-label=聊天设置]").click()');
  await textClick('模型与连接');
  await wait(() => cdp.evaluate('Boolean(document.querySelector("#model-service-name"))'), 'Model form');
}
async function assertClean(current) {
  assert.equal(current.model, ''); assert.equal(current.baseUrl, ''); assert.equal(current.name, '');
  assert.equal(current.hasCredential, false); assert.deepEqual(current.models, []);
  assert.equal(current.conversations, 1); assert.equal(current.messages, 0); assert.equal(current.drafts, 0);
  const composer = await cdp.evaluate('(()=>{const e=document.querySelector("[aria-label=选择模型]");return {disabled:e.disabled,text:e.textContent}})()');
  assert.equal(composer.disabled, true); assert.equal(composer.text, '请先配置模型');
  await openConnection();
  const values = await cdp.evaluate('({name:document.querySelector("#model-service-name").value,url:document.querySelector("#model-base-url").value,key:document.querySelector("#model-api-key").value})');
  assert.deepEqual(values, { name: '', url: '', key: '' });
}
async function configure() {
  await fill('#model-service-name', '设备初始化验收');
  await fill('#model-base-url', serviceUrl);
  await fill('#model-api-key', key);
  await textClick('获取模型列表');
  const discovery = await wait(() => cdp.evaluate('document.querySelector(".model-message[role=alert]")?.textContent || (document.querySelector("#model-default")?.value === "device-configured" ? "device-configured" : false)'), 'Discovered model selected');
  assert.equal(discovery, 'device-configured', 'Actual model discovery result: ' + discovery);
  await wait(() => cdp.evaluate('(()=>{const e=[...document.querySelectorAll("button")].find(e=>e.type==="submit"&&e.textContent.includes("保存"));if(!e||e.disabled)return false;e.click();return true})()'), 'Save connection through form');
  await wait(async () => (await state()).hasCredential, 'Encrypted connection saved');
  const current = await state(); assert.equal(current.model, 'device-configured'); assert.equal(current.baseUrl, serviceUrl);
  const saved = await fs.readFile(path.join(activeProfile, 'model-connection.json'), 'utf8');
  assert.equal(saved.includes(key), false); return current;
}
async function main() {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-device-ui-')); report.temporary = temporary;
  server = http.createServer((req, res) => {
    if (req.url !== '/v1/models' || req.headers.authorization !== 'Bearer ' + key) { res.writeHead(400); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(json({ data: [{ id: 'device-configured' }] }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); serviceUrl = 'http://127.0.0.1:' + server.address().port + '/v1';
  const profile = path.join(temporary, 'profile'); let configuredBytes;
  await check('fresh EXE opens an isolated blank model form', async () => {
    const current = await launch(profile); assert.equal(path.resolve(current.profile), profile); assert.equal(current.codexConfigPath.startsWith(profile), true);
    await assertClean(current); return current;
  });
  await check('real form saves a new encrypted connection without inheriting credentials', async () => {
    const current = await configure(); await stop(); configuredBytes = await fs.readFile(path.join(profile, 'model-connection.json')); return { model: current.model, hasCredential: current.hasCredential, encryptedOnDisk: true };
  });
  await check('same computer restart retains the saved configuration', async () => {
    const current = await launch(profile); assert.equal(current.model, 'device-configured'); assert.equal(current.hasCredential, true); assert.equal(current.baseUrl, serviceUrl);
    assert.deepEqual(await fs.readFile(path.join(profile, 'model-connection.json')), configuredBytes); await stop(); return { profile: current.profile, model: current.model, credentialRetained: true };
  });
  if (scope === 'full') {
    const foreign = path.join(temporary, 'foreign-profile');
    prepareDeviceProfile(foreign, { machineId: 'controlled-other-computer' });
    await fs.writeFile(path.join(foreign, 'model-connection.json'), configuredBytes);
    let otherProfile;
    await check('a foreign ownership marker selects a clean profile in the actual EXE', async () => {
      const current = await launch(foreign); assert.notEqual(path.resolve(current.profile), foreign); otherProfile = current.profile;
      await assertClean(current); await configure(); await stop();
      assert.equal(hash(await fs.readFile(path.join(foreign, 'model-connection.json'))), hash(configuredBytes));
      return { originalProfileUntouched: true, selectedProfile: otherProfile, machineIdentity: 'actual Windows identity; foreign ownership marker simulated' };
    });
    await check('returning to the new computer profile retains its configuration', async () => {
      const current = await launch(foreign); assert.equal(current.profile, otherProfile); assert.equal(current.model, 'device-configured'); assert.equal(current.hasCredential, true); await stop(); return { selectedProfile: current.profile, retained: true };
    });
    await check('an existing unmarked installation migrates without resetting configured data', async () => {
      const legacy = path.join(temporary, 'legacy-profile'), home = path.join(temporary, 'legacy-home');
      await fs.mkdir(legacy); await fs.mkdir(home); await fs.writeFile(path.join(legacy, 'model-connection.json'), configuredBytes);
      const current = await launch(legacy, home); assert.equal(current.profile, legacy); assert.equal(current.model, 'device-configured'); assert.equal(current.hasCredential, true); await stop();
      const marker = JSON.parse(await fs.readFile(path.join(legacy, 'device-profile.json'), 'utf8')); assert.equal(marker.isolatedHome, false);
      return { migrated: true, configPreserved: true };
    });
  }
  report.status = 'passed';
}
main().catch(error => { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; console.error(error.stack); }).finally(async () => {
  if (app && app.exitCode === null) await stop().catch(() => { app.kill(); });
  socket?.close(); if (server) await new Promise(resolve => server.close(resolve));
  if (report.status === 'passed') { await fs.rm(temporary, { recursive: true, force: true }); report.temporaryRemoved = true; }
  await persist(); console.log('RESULT ' + report.status);
});
