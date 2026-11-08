const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_BROWSER = Object.freeze({ approvalMode: 'ask', downloadApprovalMode: 'ask', fullCdpAccessEnabled: false });
const DEFAULT_COMPUTER = Object.freeze({
  accentColor: '#339CFF', direction: 'ltr', locale: 'zh-CN',
  strings: { usingComputer: 'Scodex 正在使用你的电脑', escToCancel: '按 Esc 可停止' },
});
const integrationWriteQueues = new Map();

const normalizeApprovalMode = value => value === 'never_ask' ? 'never_ask' : 'ask';
const normalizeColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toUpperCase() : DEFAULT_COMPUTER.accentColor;
const normalizeText = (value, fallback) => typeof value === 'string' && value.trim() ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 240) : fallback;

function normalizeBrowserConfig(value = {}) {
  return {
    approvalMode: normalizeApprovalMode(value.approvalMode),
    downloadApprovalMode: normalizeApprovalMode(value.downloadApprovalMode),
    fullCdpAccessEnabled: Boolean(value.fullCdpAccessEnabled),
  };
}

function normalizeComputerConfig(value = {}) {
  const strings = value.strings && typeof value.strings === 'object' ? value.strings : {};
  return {
    accentColor: normalizeColor(value.accentColor),
    direction: value.direction === 'rtl' ? 'rtl' : 'ltr',
    locale: /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*$/.test(String(value.locale || '')) ? String(value.locale) : DEFAULT_COMPUTER.locale,
    strings: {
      usingComputer: normalizeText(strings.usingComputer, DEFAULT_COMPUTER.strings.usingComputer),
      escToCancel: normalizeText(strings.escToCancel, DEFAULT_COMPUTER.strings.escToCancel),
    },
  };
}

async function readFile(file) {
  try { return await fs.readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}

function tomlValue(text, key, fallback) {
  const match = String(text).match(new RegExp(`^\\s*${key}\\s*=\\s*([^#\\r\\n]+)`, 'mi'));
  if (!match) return fallback;
  const value = match[1].trim().replace(/^['"]|['"]$/g, '');
  return value || fallback;
}

function tomlBoolean(text, key, fallback) {
  const value = tomlValue(text, key, '');
  return value === 'true' ? true : value === 'false' ? false : fallback;
}

function replaceTomlKey(text, key, value) {
  const serialized = typeof value === 'boolean' ? String(value) : JSON.stringify(String(value));
  const expression = new RegExp(`^([ \\t]*)${key}\\s*=.*$`, 'mi');
  if (expression.test(text)) return String(text).replace(expression, `$1${key} = ${serialized}`);
  const suffix = String(text).trimEnd();
  return (suffix ? suffix + '\n' : '') + `${key} = ${serialized}\n`;
}

function pluginHeader(name, provider) {
  const safeName = String(name || '').replace(/["\\\r\n]/g, '');
  const safeProvider = String(provider || '').replace(/["\\\r\n]/g, '');
  return `plugins."${safeName}@${safeProvider}"`;
}

function replacePluginEnabled(text, name, provider, enabled) {
  const header = pluginHeader(name, provider);
  const lines = String(text).split(/\r?\n/);
  const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headerIndex = lines.findIndex(line => new RegExp(`^\\s*\\[${escapedHeader}\\]\\s*$`).test(line));
  if (headerIndex < 0) return `${String(text).trimEnd()}\n\n[${header}]\nenabled = ${Boolean(enabled)}\n`;
  let end = lines.length;
  for (let index = headerIndex + 1; index < lines.length; index += 1) if (/^\s*\[/.test(lines[index])) { end = index; break; }
  const enabledIndex = lines.slice(headerIndex + 1, end).findIndex(line => /^\s*enabled\s*=/.test(line));
  if (enabledIndex >= 0) lines[headerIndex + 1 + enabledIndex] = `enabled = ${Boolean(enabled)}`;
  else lines.splice(end, 0, `enabled = ${Boolean(enabled)}`);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

async function atomicWrite(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, content, 'utf8');
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function readIntegrationConfig(root) {
  if (!root) return { root: '', browser: { ...normalizeBrowserConfig(DEFAULT_BROWSER), path: '', exists: false }, computer: { ...normalizeComputerConfig(DEFAULT_COMPUTER), path: '', exists: false } };
  const resolvedRoot = path.resolve(root);
  const browserPath = path.join(resolvedRoot, 'browser', 'config.toml');
  const computerPath = path.join(resolvedRoot, 'computer-use', 'config.json');
  const browserText = await readFile(browserPath);
  const computerText = await readFile(computerPath);
  let computer = {};
  if (computerText) { try { computer = JSON.parse(computerText); } catch { computer = {}; } }
  return {
    root: resolvedRoot,
    browser: {
      ...normalizeBrowserConfig({
        approvalMode: tomlValue(browserText, 'approval_mode', DEFAULT_BROWSER.approvalMode),
        downloadApprovalMode: tomlValue(browserText, 'download_approval_mode', DEFAULT_BROWSER.downloadApprovalMode),
        fullCdpAccessEnabled: tomlBoolean(browserText, 'full_cdp_access_enabled', DEFAULT_BROWSER.fullCdpAccessEnabled),
      }), path: browserPath, exists: Boolean(browserText),
    },
    computer: { ...normalizeComputerConfig(computer), path: computerPath, exists: Boolean(computerText) },
  };
}

function enqueueIntegrationWrite(key, operation) {
  const previous = integrationWriteQueues.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  integrationWriteQueues.set(key, current);
  return current.finally(() => {
    if (integrationWriteQueues.get(key) === current) integrationWriteQueues.delete(key);
  });
}

async function writeIntegrationConfigNow(root, update = {}) {
  if (!root) throw new Error('找不到本机 .codex 配置目录。');
  const current = await readIntegrationConfig(root);
  const browserUpdate = update.browser && typeof update.browser === 'object' ? update.browser : {};
  const computerUpdate = update.computer && typeof update.computer === 'object' ? update.computer : {};
  const browser = normalizeBrowserConfig({ ...current.browser, ...browserUpdate });
  let rawComputer = {};
  if (Object.keys(computerUpdate).length) {
    try {
      const parsed = JSON.parse(await readFile(current.computer.path));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) rawComputer = parsed;
    } catch {}
  }
  const normalizedComputer = normalizeComputerConfig({ ...rawComputer, ...computerUpdate, strings: { ...rawComputer.strings, ...(computerUpdate.strings || {}) } });
  const rawStrings = rawComputer.strings && typeof rawComputer.strings === 'object' && !Array.isArray(rawComputer.strings) ? rawComputer.strings : {};
  const computer = { ...rawComputer, ...normalizedComputer, strings: { ...rawStrings, ...normalizedComputer.strings } };
  if (Object.keys(browserUpdate).length) {
    let text = await readFile(current.browser.path);
    text = replaceTomlKey(text, 'approval_mode', browser.approvalMode);
    text = replaceTomlKey(text, 'download_approval_mode', browser.downloadApprovalMode);
    text = replaceTomlKey(text, 'full_cdp_access_enabled', browser.fullCdpAccessEnabled);
    await atomicWrite(current.browser.path, text);
  }
  if (Object.keys(computerUpdate).length) await atomicWrite(current.computer.path, JSON.stringify({ ...rawComputer, ...computer }, null, 2) + '\n');
  return readIntegrationConfig(root);
}

async function writeIntegrationConfig(root, update = {}) {
  if (!root) throw new Error('找不到本机 .codex 配置目录。');
  const key = path.resolve(root);
  return enqueueIntegrationWrite(key, () => writeIntegrationConfigNow(key, update));
}

async function setPluginEnabled(configPath, name, provider, enabled) {
  const key = path.resolve(path.dirname(configPath));
  return enqueueIntegrationWrite(key, async () => {
    const original = await readFile(configPath);
    const updated = replacePluginEnabled(original, name, provider, enabled);
    await atomicWrite(configPath, updated);
    return updated;
  });
}

module.exports = { DEFAULT_BROWSER, DEFAULT_COMPUTER, normalizeBrowserConfig, normalizeComputerConfig, readIntegrationConfig, writeIntegrationConfig, setPluginEnabled };
