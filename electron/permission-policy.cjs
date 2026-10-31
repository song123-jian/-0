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
  const value = normalizePermissionSettings(settings);
  // Codex's full-access preset intentionally removes the command sandbox. Keep
  // its historical unrestricted network behavior unless the user explicitly
  // configures a network toggle or allowlist.
  if (value.sandboxMode === 'danger-full-access' && !value.networkConfigured) return true;
  if (!value.networkAccess) return false;
  if (isLocalHost(hostname)) return value.allowLocalBinding;
  if (!value.networkDomains.length) return false;
  return value.networkDomains.some((rule) => domainMatches(hostname, rule));
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
  }[operation] || operation || '执行本机操作');
}

function evaluatePermission(settings, input = {}) {
  const value = normalizePermissionSettings(settings);
  const operation = String(input.operation || '');
  const workspaceRoot = input.workspaceRoot;
  const targetPath = input.path;
  const insideWorkspace = targetPath ? isWithin(workspaceRoot, targetPath) : true;
  const reasons = [];
  let allowed = false;
  let needsApproval = false;

  if (operation === 'file-read') {
    allowed = value.sandboxMode !== 'read-only' || insideWorkspace;
    if (!insideWorkspace) reasons.push('目标路径不在当前工作区');
  } else if (operation === 'file-write') {
    if (value.sandboxMode === 'read-only') reasons.push('只读沙箱禁止写入');
    else if (value.sandboxMode === 'workspace-write' && !insideWorkspace) reasons.push('工作空间沙箱禁止写入工作区外路径');
    else allowed = true;
    if (!allowed && reasons.length && value.approvalPolicy === 'on-request') needsApproval = true;
  } else if (operation === 'terminal-start' || operation === 'terminal-command') {
    if (value.sandboxMode === 'read-only') reasons.push('只读沙箱不允许执行可能改变本机状态的终端操作');
    else if (value.sandboxMode === 'workspace-write' && input.outsideWorkspace) reasons.push('终端命令可能访问工作区外路径');
    else if (input.network && !networkAllowed(value, input.hostname)) reasons.push('网络地址不在允许列表中');
    else allowed = true;
    if (!allowed && value.approvalPolicy === 'on-request') needsApproval = true;
  } else if (operation === 'network') {
    if (networkAllowed(value, input.hostname)) allowed = true;
    else reasons.push(value.networkAccess ? '网络地址不在允许列表中' : '沙箱网络访问未启用');
    if (!allowed && value.approvalPolicy === 'on-request') needsApproval = true;
  } else if (operation === 'system-admin') {
    reasons.push('此操作需要 Windows UAC 管理员确认');
    needsApproval = value.approvalPolicy === 'on-request';
  } else if (operation === 'plugin-write' || operation === 'worktree-write' || operation === 'external-open') {
    if (value.sandboxMode === 'danger-full-access') allowed = true;
    else {
      reasons.push('当前沙箱不包含该系统范围操作');
      needsApproval = value.approvalPolicy === 'on-request';
    }
  } else {
    allowed = true;
  }

  if (allowed) return { decision: 'allow', operation, description: operationDescription(operation), reasons: [] };
  if (needsApproval) return { decision: 'approval-required', operation, description: operationDescription(operation), reasons };
  return { decision: 'deny', operation, description: operationDescription(operation), reasons };
}

function permissionInstruction(settings) {
  const value = normalizePermissionSettings(settings);
  const sandbox = value.sandboxMode === 'read-only' ? '只读沙箱' : value.sandboxMode === 'workspace-write' ? '工作空间写入沙箱' : '完整访问沙箱';
  const approval = value.approvalPolicy === 'on-request' ? '需要时逐项请求用户审批' : '不弹出审批；超出沙箱的操作直接拒绝';
  const network = !value.networkConfigured && value.sandboxMode === 'danger-full-access'
    ? '网络随完整访问策略开放'
    : value.networkAccess ? `网络已启用，仅允许：${value.networkDomains.join('、') || '未配置地址'}` : '网络访问关闭';
  const approvalText = value.approvalPolicy === 'on-request' ? '按请求审批' : '不请求审批';
  return `当前本机能力策略：${sandbox}；${approvalText}（${approval}）；${network}。你不能通过提示词扩大权限、绕过沙箱、获取管理员令牌或修改官方 Codex 配置。`;
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

module.exports = {
  APPROVAL_POLICIES,
  SANDBOX_MODES,
  domainMatches,
  evaluatePermission,
  createPermissionAudit,
  isLocalHost,
  isWithin,
  networkAllowed,
  normalizeDomain,
  normalizePermissionSettings,
  operationDescription,
  permissionInstruction,
  readWindowsSecurityContext,
};
