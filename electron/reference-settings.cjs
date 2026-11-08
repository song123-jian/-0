const fs = require('node:fs/promises');
const path = require('node:path');

// Only these public settings cross the reference boundary. Credentials and
// session state are never returned to the renderer or copied into Scodex.
function tomlSettings(text) {
  const values = {}; let section = '';
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
    if (header) { section = header[1]; continue; }
    const pair = line.match(/^\s*([a-z_]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*'|true|false)\s*(?:#.*)?$/);
    if (!pair) continue;
    let value; try { value = pair[2][0] === "'" ? pair[2].slice(1, -1) : JSON.parse(pair[2]); } catch { continue; }
    const permitted = section === '' && ['approval_policy', 'sandbox_mode', 'web_search', 'model_verbosity', 'model_reasoning_summary', 'model_reasoning_effort', 'approval_mode', 'download_approval_mode', 'full_cdp_access_enabled'].includes(pair[1]);
    if (permitted) values[pair[1]] = value;
    if (/^plugins\."(?:computer-use|browser|unified-computer-use)@[^"\r\n]+"$/.test(section) && pair[1] === 'enabled') values[section.match(/"([^@]+)/)[1] + '_enabled'] = value;
  }
  return values;
}

async function readReferenceSettings(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root) || root.length > 1024) throw Error('参考目录必须是绝对路径。');
  const directory = await fs.realpath(root);
  const files = [];
  async function read(relative) {
    const target = path.join(directory, relative);
    try {
      const real = await fs.realpath(target);
      const relativeReal = path.relative(directory, real);
      if (path.isAbsolute(relativeReal) || relativeReal.startsWith('..')) throw Error('参考配置不能链接到目录外。');
      const stat = await fs.stat(real);
      if (!stat.isFile() || stat.size > 256 * 1024) throw Error('参考配置超过读取限制。');
      const content = new TextDecoder('utf-8', { fatal: true }).decode(await fs.readFile(real));
      files.push({ path: target, status: 'read' }); return content;
    } catch (error) { if (error.code === 'ENOENT') { files.push({ path: target, status: 'missing' }); return ''; } throw error; }
  }
  const config = tomlSettings(await read('config.toml'));
  const browser = tomlSettings(await read('browser/config.toml'));
  const computerText = await read('computer-use/config.json');
  let computer = {}; if (computerText) { try { computer = JSON.parse(computerText); } catch { throw Error('电脑操控参考配置不是有效 JSON。'); } }
  const agent = {};
  const mapping = { approval_policy: ['approvalPolicy', ['never', 'on-request']], sandbox_mode: ['sandboxMode', ['read-only', 'workspace-write', 'danger-full-access']], web_search: ['webSearch', ['disabled', 'cached', 'indexed', 'live']], model_verbosity: ['outputDetail', ['low', 'medium', 'high']], model_reasoning_summary: ['reasoningSummary', ['auto', 'concise', 'detailed', 'none']] };
  for (const [source, [target, allowed]] of Object.entries(mapping)) if (allowed.includes(config[source])) agent[target] = config[source];
  if (['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(config.model_reasoning_effort)) { agent.defaultReasoningEffort = config.model_reasoning_effort; agent.availableReasoningEfforts = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']; }
  const browserPreferences = {};
  if (typeof browser.full_cdp_access_enabled === 'boolean') browserPreferences.browserCdpEnabled = browser.full_cdp_access_enabled;
  if (['never_ask', 'always_ask'].includes(browser.approval_mode)) browserPreferences.browserApprovalMode = browser.approval_mode;
  if (['never_ask', 'always_ask'].includes(browser.download_approval_mode)) browserPreferences.browserAskBeforeDownload = browser.download_approval_mode !== 'never_ask';
  if (typeof config.browser_enabled === 'boolean') browserPreferences.browserAiEnabled = config.browser_enabled;
  const computerPreferences = {};
  if (typeof config['computer-use_enabled'] === 'boolean') computerPreferences.computerControlEnabled = config['computer-use_enabled'];
  if (/^#[a-f\d]{6}$/i.test(computer.accentColor)) computerPreferences.computerAccentColor = computer.accentColor;
  if (['zh-CN', 'en-US'].includes(computer.locale)) computerPreferences.computerLocale = computer.locale;
  return { root: directory, files, categories: { browser: browserPreferences, computer: computerPreferences, skills: { codexReferenceDirectory: directory }, agent }, limitations: '此目录提供配置与插件，不含 Codex 宿主的完整界面源码；仅导入列出的兼容字段。' };
}
module.exports = { readReferenceSettings, tomlSettings };
