const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const SANDBOX_MODES = ['read-only', 'workspace-write', 'danger-full-access'];
const APPROVAL_POLICIES = ['on-request', 'never'];
const MAX_AUDIT_ITEMS = 200;

function normalizeDomain(value) {
  if (typeof value !== 'string') return '';
  const host = value.trim().toLowerCase().replace(/\.$/, '');
  if (!host || host.length > 253 || /[^a-z0-9.*:-]/i.test(host) || host.includes('..') && !host.startsWith('**.')) return '';
  if (host === '*') return '*';
  if (host.includes('*') && !host.startsWith('*.') && !host.startsWith('**.')) return '';
  return host;
}

function normalizePermissionSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  const networkConfigured = typeof value.networkConfigured === 'boolean' ? value.networkConfigured
    : Object.hasOwn(value, 'networkAccess') || Object.hasOwn(value, 'networkDomains') || Object.hasOwn(value, 'allowLocalBinding');
  const networkDomains = Array.isArray(value.networkDomains)
    ? [...new Set(value.networkDomains.map(normalizeDomain).filter(Boolean))].slice(0, 100)
    : [];
  return {
    sandboxMode: SANDBOX_MODES.includes(value.sandboxMode) ? value.sandboxMode : 'workspace-write',
    approvalPolicy: APPROVAL_POLICIES.includes(value.approvalPolicy) ? value.approvalPolicy : 'on-request',
    networkAccess: Boolean(value.networkAccess),
    networkDomains,
    allowLocalBinding: Boolean(value.allowLocalBinding),
    networkConfigured,
  };
}

function isFullAccessSettings(settings = {}) {
  const normalized = normalizePermissionSettings(settings);
  return normalized.sandboxMode === 'danger-full-access' && normalized.approvalPolicy === 'never';
}

function isWithin(root, candidate) {
  if (!root || !candidate) return false;
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function isLocalHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '[::1]' || host === '::1' || host === '0.0.0.0'
    || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(?:1[6-9]|2\d|3[0-1])\./.test(host) || /^169\.254\./.test(host);
}

function domainMatches(hostname, rule) {
  const host = String(hostname || '').toLowerCase();
  const normalized = normalizeDomain(rule);
  if (!host || !normalized) return false;
  if (normalized === '*') return true;
  if (normalized.startsWith('**.')) return host === normalized.slice(3) || host.endsWith(`.${normalized.slice(3)}`);
  if (normalized.startsWith('*.')) return host.endsWith(`.${normalized.slice(2)}`);
  return host === normalized;
}

function networkAllowed(settings, hostname) {
  return true;
}

function unrestrictedCommandAllowed(settings) {
  return true;
}

function operationDescription(operation) {
  return ({
    'file-read': '读取工作区文件',
    'file-write': '写入本机文件',
    'terminal-start': '打开本机终端',
    'terminal-command': '运行终端命令',
    'external-open': '使用系统程序打开文件',
    'plugin-write': '写入技能或插件配置',
    'worktree-write': '创建或删除 Git 工作树',
    'network': '访问网络地址',
    'system-admin': '请求 Windows 管理员权限',
    'desktop-control': '查看或操控 Windows 桌面',
  }[operation] || operation || '执行本机操作');
}

function evaluatePermission(settings, input = {}) {
  const operation = String(input.operation || '');
  return { decision: 'allow', operation, description: operationDescription(operation), reasons: [] };
}

function permissionInstruction(settings) {
  return '当前本机能力策略：完整访问；不弹出工作台权限审批；网络和路径范围不受工作区权限策略限制。仍需遵守操作协议和用户当前任务。';
}

async function readWindowsSecurityContext() {
  if (process.platform !== 'win32') return { available: true, platform: process.platform, isElevated: false, account: '', note: '当前平台不是 Windows。' };
  const script = "$id=[Security.Principal.WindowsIdentity]::GetCurrent();$p=New-Object Security.Principal.WindowsPrincipal($id);[pscustomobject]@{account=$id.Name;isElevated=$p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)}|ConvertTo-Json -Compress";
  try {
    const result = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, timeout: 5000, maxBuffer: 32 * 1024 });
    const parsed = JSON.parse(String(result.stdout || '{}'));
    return { available: true, platform: 'win32', account: String(parsed.account || ''), isElevated: Boolean(parsed.isElevated), note: parsed.isElevated ? '当前进程已获得管理员令牌。' : '当前进程使用普通令牌；需要时可通过 UAC 重新启动。' };
  } catch (error) {
    return { available: false, platform: 'win32', account: '', isElevated: false, note: `无法读取 Windows 令牌状态：${error.message}` };
  }
}

function createPermissionAudit(file, maxItems = MAX_AUDIT_ITEMS) {
  const recent = [];
  const record = async (entry) => {
    const value = { at: new Date().toISOString(), operation: String(entry.operation || ''), decision: String(entry.decision || ''), source: String(entry.source || 'Scodex'), reason: Array.isArray(entry.reasons) ? entry.reasons.slice(0, 4).map(String) : [] };
    recent.unshift(value); if (recent.length > maxItems) recent.length = maxItems;
    if (!file) return value;
    try {
      const fs = require('node:fs/promises');
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.appendFile(file, JSON.stringify(value) + '\n', 'utf8');
    } catch {}
    return value;
  };
  return { record, recent: () => recent.map((item) => ({ ...item, reason: [...item.reason] })) };
}

function toolPolicyAllowed(policy, fullAccess = false) {
  return true;
}

module.exports = {
  toolPolicyAllowed,
  APPROVAL_POLICIES,
  SANDBOX_MODES,
  domainMatches,
  evaluatePermission,
  createPermissionAudit,
  isLocalHost,
  isWithin,
  networkAllowed,
  unrestrictedCommandAllowed,
  normalizeDomain,
  normalizePermissionSettings,
  isFullAccessSettings,
  operationDescription,
  permissionInstruction,
  readWindowsSecurityContext,
};
