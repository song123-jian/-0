const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const executable = path.resolve(process.env.SCODEX_SETTINGS_EXE || path.join(root, 'release', 'win-unpacked', 'Scodex工作台.exe'));
const output = path.resolve(process.env.SCODEX_SETTINGS_OUTPUT || path.join(root, 'release', 'workbench-settings-20261107'));
const reportPath = path.join(output, 'integration-settings-ui-verification.json');
let temporaryRoot;
let profile;
let codexHome;
let referenceRoot;
let pluginPath;
const report = { status: 'running', version: '1.3.45', executable, output: reportPath, checks: [], limitations: ['No model request or credential is used; settings persistence is tested in an isolated Electron profile and temporary .codex directory.'] };
let child;
let socket;
let page;
let port;
const diagnostics = {};

const waitFor = async (predicate, label, timeoutMs = 25000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { const value = await predicate(); if (value) return value; }
    catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
};

function createCdp(ws) {
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    let message;
    try { message = JSON.parse(data); } catch { return; }
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  });
  ws.addEventListener('close', () => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('CDP connection closed.')); }
    pending.clear();
  });
  return {
    command(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 10000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    async evaluate(expression) {
      const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result?.value;
    },
  };
}

async function openPage() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  child = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu'], {
    cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore',
    env: { ...process.env, SCODEX_HOME: codexHome, SCODEX_REFERENCE_HOME: referenceRoot, SCODEX_REFERENCE_AGENTS_HOME: path.join(temporaryRoot, 'agents-home') },
  });
  const target = await waitFor(async () => {
    if (child.exitCode !== null) throw new Error(`Candidate exited with ${child.exitCode}.`);
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    return (await response.json()).find((item) => item.type === 'page' && item.url.startsWith('file:') && !item.url.endsWith('/desktop-control.html'));
  }, 'candidate renderer', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  page = createCdp(socket);
  await waitFor(() => page.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'workbench ready');
  const state = await page.evaluate('window.scodex.getAppState()');
  assert.equal(state.version, report.version);
  assert.equal(state.integrationConfig.root, referenceRoot);
}

async function click(selector, text) {
  await waitFor(() => page.evaluate(`(() => { const list = [...document.querySelectorAll(${JSON.stringify(selector)})]; const item = list.find((element) => ${text === undefined ? 'true' : `element.textContent.trim() === ${JSON.stringify(text)}`}); if (!item || item.disabled) return false; item.click(); return true; })()`), `click ${text || selector}`);
}

async function setField(label, value) {
  const expression = `(() => { const element = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)}); if (!element) throw new Error('Missing field: ' + ${JSON.stringify(label)}); const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); return true; })()`;
  await page.evaluate(expression);
}

async function category(label) {
  if (!await page.evaluate('Boolean(document.querySelector(".settings-view"))')) await click('[aria-label="设置"]');
  await click('.settings-category', label);
  await waitFor(() => page.evaluate(`document.querySelector('.settings-detail-heading h1')?.textContent === ${JSON.stringify(label)}`), `settings category ${label}`);
}

async function sendKey(key, code, modifiers) {
  const details = { key, code, modifiers, windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0), nativeVirtualKeyCode: key.toUpperCase().charCodeAt(0) };
  await page.command('Input.dispatchKeyEvent', { ...details, type: 'keyDown' });
  await page.command('Input.dispatchKeyEvent', { ...details, type: 'keyUp' });
}

async function saveReport() { await fs.mkdir(output, { recursive: true }); await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8'); }

async function quitCandidate() {
  if (child?.exitCode === null) {
    try { await page?.evaluate('window.scodex.quitApp()'); } catch {}
    try { await waitFor(() => child.exitCode !== null, 'candidate exit', 15000); }
    catch {
      await new Promise((resolve, reject) => {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('close', () => resolve()); killer.once('error', reject);
      });
      await waitFor(() => child.exitCode !== null, 'candidate process-tree exit', 10000);
    }
  }
  socket?.close();
  socket = null; page = null; child = null;
}

async function main() {
  temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-integration-settings-'));
  profile = path.join(temporaryRoot, 'profile');
  codexHome = path.join(temporaryRoot, 'codex-home');
  referenceRoot = path.join(temporaryRoot, 'reference-codex');
  pluginPath = path.join(referenceRoot, 'plugins', 'cache', 'provider', 'sample-plugin', '1.0.0');

  await fs.mkdir(path.join(referenceRoot, 'browser'), { recursive: true });
  await fs.mkdir(path.join(referenceRoot, 'computer-use'), { recursive: true });
  await fs.mkdir(path.join(referenceRoot, 'skills', 'reference-skill'), { recursive: true });
  await fs.mkdir(pluginPath, { recursive: true });
  await fs.mkdir(codexHome, { recursive: true });
  await fs.writeFile(path.join(referenceRoot, 'browser', 'config.toml'), 'approval_mode = "ask"\ndownload_approval_mode = "ask"\nfull_cdp_access_enabled = false\n', 'utf8');
  await fs.writeFile(path.join(referenceRoot, 'computer-use', 'config.json'), JSON.stringify({ retainTopLevel: 'unchanged', accentColor: '#123456', direction: 'ltr', locale: 'zh-CN', strings: { usingComputer: 'Original', escToCancel: 'Stop', retainNested: 'unchanged' } }, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(referenceRoot, 'config.toml'), '[plugins."sample-plugin@provider"]\nenabled = false\ncustom_option = "keep"\n', 'utf8');
  await fs.writeFile(path.join(referenceRoot, 'skills', 'reference-skill', 'SKILL.md'), '---\nname: reference-skill\ndescription: Isolated settings UI skill refresh check.\n---\n\n# Reference skill\n', 'utf8');

  await openPage();
  const initial = await page.evaluate('window.scodex.getAppState()');
  report.program = { name: 'Scodex工作台', version: initial.version, executable, profile, codexRoot: codexHome, integrationRoot: referenceRoot };

  await category('浏览器');
  await click('.integration-segments[aria-label="浏览器操作审批"] button', '不询问');
  const captureBrowserSettings = async () => {
    const current = await page.evaluate('window.scodex.getIntegrationConfig()');
    const ui = await page.evaluate(`({ alerts: [...document.querySelectorAll('[role="alert"], .integration-error')].map((item) => item.innerText), controls: [...document.querySelectorAll('.integration-segments')].map((group) => ({ label: group.getAttribute('aria-label'), selected: [...group.querySelectorAll('button')].map((button) => ({ text: button.innerText.trim(), pressed: button.getAttribute('aria-pressed'), disabled: button.disabled })) })) })`);
    let contents;
    try { contents = await fs.readFile(path.join(referenceRoot, 'browser', 'config.toml'), 'utf8'); }
    catch (error) { contents = `Read failed: ${error.message}`; }
    diagnostics.browserSettings = { state: current.browser, ui, toml: contents };
    return diagnostics.browserSettings;
  };
  await waitFor(async () => {
    const current = await captureBrowserSettings();
    return current.state.approvalMode === 'never_ask' && /approval_mode = "never_ask"/.test(current.toml);
  }, 'browser operation approval persisted');
  await click('.integration-segments[aria-label="浏览器下载审批"] button', '不询问');
  await waitFor(async () => {
    const current = await captureBrowserSettings();
    return current.state.downloadApprovalMode === 'never_ask' && /download_approval_mode = "never_ask"/.test(current.toml) && /full_cdp_access_enabled = false/.test(current.toml);
  }, 'browser download approval persisted');

  await category('电脑操控');
  await setField('电脑操控强调色', '#6A45B3');
  await setField('电脑操控文字方向', 'rtl');
  await setField('电脑操控语言区域', 'en-GB');
  await setField('使用电脑提示', 'Using computer');
  await setField('停止提示', 'Press Escape');
  await click('.settings-row-control button', '保存电脑操控配置');
  await waitFor(async () => {
    const saved = JSON.parse(await fs.readFile(path.join(referenceRoot, 'computer-use', 'config.json'), 'utf8'));
    return saved.accentColor === '#6A45B3' && saved.locale === 'en-GB' && saved.strings.usingComputer === 'Using computer';
  }, 'computer config persisted');
  const computer = JSON.parse(await fs.readFile(path.join(referenceRoot, 'computer-use', 'config.json'), 'utf8'));
  assert.equal(computer.retainTopLevel, 'unchanged');
  assert.equal(computer.strings.retainNested, 'unchanged');

  await category('SKILL 技能');
  await setField('Codex 参考目录', referenceRoot);
  await click('.reference-settings button', '应用此项配置');
  await waitFor(async () => {
    const state = await page.evaluate('window.scodex.getAppState()');
    const saved = JSON.parse(await fs.readFile(path.join(profile, 'settings.json'), 'utf8'));
    return state.preferences.codexReferenceDirectory === referenceRoot && saved.preferences.codexReferenceDirectory === referenceRoot;
  }, 'SKILL reference directory persisted');
  const skills = await waitFor(async () => {
    const items = await page.evaluate('window.scodex.listSkills()');
    return items.some((item) => item.name === 'reference-skill') ? items : false;
  }, 'SKILL list refresh');
  const pluginSwitch = '[aria-label="启用插件 sample-plugin"]';
  await waitFor(() => page.evaluate(`document.querySelector(${JSON.stringify(pluginSwitch)})?.getAttribute('aria-checked') === 'false'`), 'plugin toggle visible');
  await click(pluginSwitch);
  await waitFor(async () => /\[plugins\."sample-plugin@provider"\][\s\S]*?enabled = true/.test(await fs.readFile(path.join(referenceRoot, 'config.toml'), 'utf8')) && await page.evaluate(`document.querySelector(${JSON.stringify(pluginSwitch)})?.getAttribute('aria-checked') === 'true'`), 'plugin config enabled');
  assert.match(await fs.readFile(path.join(referenceRoot, 'config.toml'), 'utf8'), /custom_option = "keep"/);

  await category('键盘快捷键');
  const shortcutButton = '.settings-row';
  await click(shortcutButton, undefined);
  await page.evaluate(`(() => { const row = [...document.querySelectorAll('.settings-row')].find((element) => element.querySelector('.settings-row-copy strong')?.textContent.trim() === '新建对话'); const button = row?.querySelector('.shortcut-field button'); if (!button) throw new Error('New chat shortcut control is missing.'); button.click(); return true; })()`);
  await waitFor(() => page.evaluate(`(() => { const row = [...document.querySelectorAll('.settings-row')].find((element) => element.querySelector('.settings-row-copy strong')?.textContent.trim() === '新建对话'); return row?.querySelector('.shortcut-field kbd')?.textContent === '请按组合键'; })()`), 'shortcut capture');
  await sendKey('n', 'KeyN', 10);
  await waitFor(() => page.evaluate('window.scodex.getAppState().then((state) => state.preferences.shortcuts.newChat === "Ctrl+Shift+N")'), 'shortcut saved');

  await click('[aria-label="项目"]');
  await waitFor(() => page.evaluate('!document.querySelector(".settings-view")'), 'assistant view');
  const before = await page.evaluate('window.scodex.getAppState()');
  await sendKey('n', 'KeyN', 10);
  await waitFor(async () => {
    const current = await page.evaluate('window.scodex.getAppState()');
    return current.library.activeId !== before.library.activeId || current.library.conversations.length > before.library.conversations.length;
  }, 'custom shortcut action');
  await quitCandidate();
  await openPage();
  const restored = await page.evaluate('window.scodex.getAppState()');
  assert.equal(restored.preferences.shortcuts.newChat, 'Ctrl+Shift+N');
  assert.equal(restored.integrationConfig.browser.approvalMode, 'never_ask');
  assert.equal(restored.integrationConfig.browser.downloadApprovalMode, 'never_ask');
  assert.equal(restored.integrationConfig.computer.accentColor, '#6A45B3');
  assert.equal(restored.integrationConfig.computer.direction, 'rtl');
  assert.equal(restored.integrationConfig.computer.locale, 'en-GB');
  assert.equal(restored.preferences.codexReferenceDirectory, referenceRoot);
  report.checks = [
    { name: 'browser TOML settings save through UI', status: 'passed', evidence: { approvalMode: restored.integrationConfig.browser.approvalMode, downloadApprovalMode: restored.integrationConfig.browser.downloadApprovalMode } },
    { name: 'computer-use JSON settings save and preserve unknown fields', status: 'passed', evidence: { accentColor: computer.accentColor, direction: computer.direction, locale: computer.locale, unknownFieldsPreserved: true } },
    { name: 'Codex plugin can be toggled from Skills settings', status: 'passed', evidence: { pluginId: 'sample-plugin@provider', enabled: true } },
    { name: 'SKILL reference directory persists after restart', status: 'passed', evidence: { directory: restored.preferences.codexReferenceDirectory, persistedBeforeRestart: true, restarted: true } },
    { name: 'SKILL list refresh discovers reference directory content', status: 'passed', evidence: { skillName: 'reference-skill', count: skills.length } },
    { name: 'recorded shortcut activates and persists after restart', status: 'passed', evidence: { shortcut: restored.preferences.shortcuts.newChat, restarted: true } },
  ];
  report.status = 'passed';
}

async function run() {
  try { await main(); }
  catch (error) { report.status = 'failed'; report.error = error.stack || String(error); report.diagnostics = diagnostics; throw error; }
  finally {
    await quitCandidate();
    if (temporaryRoot) {
      const normalizedTemporaryRoot = path.resolve(temporaryRoot);
      if (normalizedTemporaryRoot.startsWith(path.resolve(os.tmpdir()) + path.sep) && normalizedTemporaryRoot.includes('scodex-integration-settings-')) {
        await fs.rm(normalizedTemporaryRoot, { recursive: true, force: true });
      }
    }
    await saveReport();
  }
}

run().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
