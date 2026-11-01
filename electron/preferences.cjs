const { validMode } = require('./conversations.cjs');
const path = require('node:path');
const { normalizeFileOpenMode } = require('./file-open.cjs');

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const FONT_FAMILIES = require('./font-families.json').map(([value]) => value);
const DESKTOP_APP_IDS = ['chrome', 'edge', 'excel'];

function boundedStrings(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === 'string' && item.trim() && item.length <= maxLength).map((item) => item.trim()))].slice(0, maxItems);
}

function absoluteDirectories(value) {
  return boundedStrings(value, 20, 1024).filter((item) => path.isAbsolute(item));
}

function normalizeSiteRules(value) {
  if (!Array.isArray(value)) return [];
  const rules = [];
  const seen = new Set();
  for (const item of value.slice(0, 200)) {
    if (!item || typeof item !== 'object') continue;
    let url;
    try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(String(item.host || '')) ? String(item.host) : `https://${String(item.host || '')}`); }
    catch { continue; }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) continue;
    const host = url.hostname.toLowerCase();
    if (seen.has(host)) continue;
    seen.add(host);
    rules.push({ host, browse: item.browse === 'block' ? 'block' : 'allow', download: item.download === 'block' ? 'block' : 'allow',
      camera: Boolean(item.camera), microphone: Boolean(item.microphone) });
  }
  return rules;
}

function normalizePreferences(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  return {
    defaultMode: validMode(value.defaultMode),
    railCollapsed: Boolean(value.railCollapsed),
    browserPanelOpen: value.browserPanelOpen === undefined ? true : Boolean(value.browserPanelOpen),
    browserPanelExpanded: Boolean(value.browserPanelExpanded),
    fontSize: [16, 18, 20].includes(value.fontSize) ? value.fontSize : 16,
    contextAccess: value.contextAccess === 'chat-only' ? 'chat-only' : 'manual',
    themeMode: ['system', 'light', 'dark'].includes(value.themeMode) ? value.themeMode : 'system',
    themeStyle: value.themeStyle === 'high-contrast' ? 'high-contrast' : 'standard',
    accentColor: HEX_COLOR.test(value.accentColor || '') ? value.accentColor.toUpperCase() : '#176C5B',
    backgroundColor: HEX_COLOR.test(value.backgroundColor || '') ? value.backgroundColor.toUpperCase() : null,
    foregroundColor: HEX_COLOR.test(value.foregroundColor || '') ? value.foregroundColor.toUpperCase() : null,
    fontFamily: FONT_FAMILIES.includes(value.fontFamily) ? value.fontFamily : 'Microsoft YaHei',
    defaultFileOpen: normalizeFileOpenMode(value.defaultFileOpen),
    terminalShell: value.terminalShell === 'cmd' ? 'cmd' : 'powershell',
    closeConfirmation: value.closeConfirmation === 'always' ? 'always' : 'busy',
    trayEnabled: value.trayEnabled === undefined ? true : Boolean(value.trayEnabled),
    closeToTray: value.closeToTray === undefined ? true : Boolean(value.closeToTray),
    minimizeToTray: Boolean(value.minimizeToTray),
    browserPanelWidth: Number.isFinite(value.browserPanelWidth) ? Math.min(660, Math.max(320, Math.round(value.browserPanelWidth))) : 400,
    sendShortcut: value.sendShortcut === 'enter' ? 'enter' : 'ctrl-enter',
    showEditorStatusBar: value.showEditorStatusBar === undefined ? true : Boolean(value.showEditorStatusBar),
    defaultFullView: Boolean(value.defaultFullView),
    skillsEnabled: value.skillsEnabled === undefined ? true : Boolean(value.skillsEnabled),
    disabledSkillIds: boundedStrings(value.disabledSkillIds, 1000, 512),
    skillDirectories: absoluteDirectories(value.skillDirectories),
    computerControlEnabled: Boolean(value.computerControlEnabled),
    computerAllowedApps: [...new Set(boundedStrings(value.computerAllowedApps, DESKTOP_APP_IDS.length, 20).filter((id) => DESKTOP_APP_IDS.includes(id)))],
    browserAiEnabled: Boolean(value.browserAiEnabled),
    browserCdpEnabled: Boolean(value.browserCdpEnabled),
    browserShowFullUrl: value.browserShowFullUrl === undefined ? true : Boolean(value.browserShowFullUrl),
    browserLinkOpenTarget: value.browserLinkOpenTarget === 'system' ? 'system' : 'builtin',
    browserLocalUrlTarget: value.browserLocalUrlTarget === 'system' ? 'system' : 'builtin',
    browserAskBeforeDownload: value.browserAskBeforeDownload === undefined ? true : Boolean(value.browserAskBeforeDownload),
    browserDownloadDirectory: typeof value.browserDownloadDirectory === 'string' && path.isAbsolute(value.browserDownloadDirectory.trim())
      ? value.browserDownloadDirectory.trim().slice(0, 1024) : null,
    browserSiteRules: normalizeSiteRules(value.browserSiteRules),
    gitBranchPrefix: validGitBranchPrefix(value.gitBranchPrefix) ? value.gitBranchPrefix.trim() : 'scodex/',
    gitMergeMethod: value.gitMergeMethod === 'squash' ? 'squash' : 'merge',
    gitForcePush: Boolean(value.gitForcePush),
    gitDraftPullRequest: value.gitDraftPullRequest === undefined ? true : Boolean(value.gitDraftPullRequest),
    gitReviewResultMode: value.gitReviewResultMode === 'separate' ? 'separate' : 'inline',
    gitCommitInstructions: typeof value.gitCommitInstructions === 'string' ? value.gitCommitInstructions.slice(0, 8000) : '',
    gitPullRequestInstructions: typeof value.gitPullRequestInstructions === 'string' ? value.gitPullRequestInstructions.slice(0, 8000) : '',
    notifyOnComplete: value.notifyOnComplete === undefined ? true : Boolean(value.notifyOnComplete),
    notifyOnIssues: value.notifyOnIssues === undefined ? true : Boolean(value.notifyOnIssues),
    notifyOnPermissions: value.notifyOnPermissions === undefined ? true : Boolean(value.notifyOnPermissions),
    notificationSound: value.notificationSound === 'silent' ? 'silent' : 'default',
    conversationDirectory: typeof value.conversationDirectory === 'string' && value.conversationDirectory.trim().length <= 1024 ? value.conversationDirectory.trim() || null : null,
    compressHistory: Boolean(value.compressHistory),
    autoArchiveDays: [30, 90].includes(value.autoArchiveDays) ? value.autoArchiveDays : 0,
  };
}

function assertContextAccess(preferences, payload) {
  if (preferences.contextAccess === 'chat-only' && (payload?.fileContext || payload?.skill || payload?.images?.length || payload?.attachments?.length)) {
    throw new Error('当前为仅对话权限，请先更改权限再附加本机内容或技能。');
  }
  if (!preferences.skillsEnabled && payload?.skill) throw new Error('本地 SKILL 指引已停用，请先在设置中启用。');
  if (payload?.skill && (preferences.disabledSkillIds || []).includes(payload.skillId)) throw new Error('所选技能已在插件设置中停用，请刷新技能列表后重试。');
}

function validGitBranchPrefix(value) {
  if (typeof value !== 'string' || value.length > 80) return false;
  const prefix = value.trim();
  return !prefix || (!/[\s~^:?*\[\\\x00-\x1f\x7f]/.test(prefix) && !prefix.includes('..') && !prefix.includes('@{')
    && !prefix.startsWith('/') && !prefix.startsWith('-') && !prefix.includes('//') && !prefix.endsWith('.')
    && !prefix.split('/').some((part) => part.startsWith('.') || part.endsWith('.lock')));
}

function gitTaskInstruction(preferences, payload = {}) {
  const taskText = [payload.prompt, payload.goal, ...(Array.isArray(payload.messages) ? payload.messages.filter((item) => item?.role === 'user').map((item) => item.content) : [])]
    .filter((item) => typeof item === 'string').join('\n').toLowerCase();
  if (!/(\bgit\b|\bbranch\b|\bcommit\b|\bpush\b|\bpull request\b|\bmerge request\b|\bpr\b|分支|提交|推送|合并请求)/i.test(taskText)) return '';
  const values = [
    `新分支前缀：${preferences.gitBranchPrefix || '（不指定）'}`,
    `Pull Request 合并方式：${preferences.gitMergeMethod === 'squash' ? '压缩合并' : '合并提交'}`,
    `强制推送：${preferences.gitForcePush ? '允许时优先使用 --force-with-lease，避免无条件覆盖远端提交' : '不要强制推送'}`,
    `草稿 Pull Request：${preferences.gitDraftPullRequest ? '默认创建草稿' : '默认创建正式 PR'}`,
    `审查结果：${preferences.gitReviewResultMode === 'separate' ? '在单独的审查报告中呈现' : '尽量贴近对应代码位置呈现'}`,
  ];
  if (/\bcommit\b|提交/i.test(taskText) && preferences.gitCommitInstructions) values.push(`提交指令：${preferences.gitCommitInstructions}`);
  if (/\b(pull request|merge request|pr)\b|合并请求/i.test(taskText) && preferences.gitPullRequestInstructions) values.push(`Pull Request 指令：${preferences.gitPullRequestInstructions}`);
  return `Git 任务偏好（只作为回答指引；Scodex 不会因此执行 Git 命令或创建远端 Pull Request）：\n${values.join('\n')}`;
}

module.exports = { normalizePreferences, assertContextAccess, gitTaskInstruction, validGitBranchPrefix, normalizeSiteRules, DESKTOP_APP_IDS, FONT_FAMILIES };
