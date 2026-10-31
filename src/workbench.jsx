import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import ExcelJS from 'exceljs';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Braces, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleAlert, Clipboard, Columns3, Crop, FileCode2,
  FileImage, FilePlus2, FileSpreadsheet, Files, FolderOpen, Image as ImageIcon, Library,
  GitBranch, Pin, Archive, CalendarClock, LoaderCircle, MessageSquare, Paperclip, Paintbrush, PanelLeftClose,
  PanelLeftOpen, PanelRightOpen, Plus, RotateCcw, RotateCw, Save, Search, Send, Sheet,
  Sparkles, StopCircle, Sun, Table2, Target, Type, X, Puzzle, Clock3, Ellipsis, SlidersHorizontal, SquarePlus,
} from 'lucide-react';
import { parseCsv, stringifyCsv } from './lib/csv.js';
import { WORK_MODES, workMode } from './lib/modes.js';
import { truncateUtf8 } from './lib/text.js';
import { MAX_CHAT_IMAGES, prepareChatImages } from './lib/chat-images.js';
import { sameLocation, recordLocation, findLocation } from './lib/navigation.js';
import { Dashboard, ModeIcon, RecentPanel } from './components/workbench-panels.jsx';
import { PluginCenterPanel, ScheduledTasksPanel } from './components/task-panels.jsx';
import { SettingsPanel } from './components/settings-panel.jsx';
import { ComposerTools } from './components/composer-tools.jsx';
import { ToolsPanel, CommandPalette } from './components/tools-panel.jsx';
import { AgentActivity } from './components/agent-activity.jsx';
import { ChatRuns } from './components/chat-runs.jsx';
import { GitPanel } from './components/git-panel.jsx';
import { ConversationVersions, MessageRevisionDialog } from './components/conversation-revisions.jsx';
import { TaskCollaborationDialog } from './components/task-collaboration.jsx';
import { listTasks, readTask, prepareTaskHandoff } from './lib/task-collaboration.js';
import { prepareRevision, selectRevision, revisionStamp, revisionSource } from './lib/conversation-revisions.js';
import { MessageContent, MessageProgress } from './components/message-content.jsx';
import { settledTiming } from './lib/message-presentation.js';
import { applyConversationAction, conversationText, newChatRecord } from './lib/conversation-actions.js';
import { WorkspaceContextMenu, WorkspaceActionDialog } from './components/workspace-context-menu.jsx';
import { ActivityRail, BrowserPanel } from './components/shell-panels.jsx';
import workbenchLogo from '../build/icon.svg';
import FONT_FAMILIES from '../electron/font-families.json';

const NAVIGATION = [
  { id: 'assistant', label: '项目', icon: FolderOpen },
  { id: 'recent', label: '最近', icon: Clock3 },
  { id: 'tasks', label: '定时任务', icon: CalendarClock },
  { id: 'plugins', label: '插件', icon: Puzzle },
  { id: 'skills', label: '技能', icon: BookOpen },
  { id: 'tools', label: '工具与操作', icon: Braces },
  { id: 'files', label: '文件与代码', icon: FileCode2 },
  { id: 'git', label: '版本控制', icon: GitBranch },
  { id: 'tables', label: '表格', icon: FileSpreadsheet },
  { id: 'images', label: '图片', icon: ImageIcon },
];

const IMAGE_FILTERS = [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }];
const CHAT_IMAGE_FILTERS = [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp'] }];
const CHAT_ATTACHMENT_FILTERS = [{ name: '聊天附件', extensions: ['*'] }];
const TABLE_FILTERS = [{ name: 'Excel 和 CSV', extensions: ['xlsx', 'csv', 'tsv'] }];
const CODE_FILTERS = [{ name: '文本和代码', extensions: ['*'] }];
const DEFAULT_AGENT_SETTINGS = {
  approvalPolicy: 'never', sandboxMode: 'danger-full-access', webSearch: 'disabled',
  outputDetail: 'default', reasoningSummary: 'auto',
  availableReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  defaultReasoningEffort: 'max', workspaceDependencies: true,
};
const REASONING_EFFORT_LABELS = { none: 'none', minimal: 'minimal', low: '轻度', medium: '中', high: '高', xhigh: '极高', max: 'Max', ultra: 'Ultra' };
const FONT_STACKS = Object.fromEntries(FONT_FAMILIES.map(([family]) => [family, family === 'system'
  ? 'system-ui, "Microsoft YaHei", sans-serif'
  : `"${family}", "Microsoft YaHei", "微软雅黑", ${['Consolas', 'Courier New'].includes(family) ? 'monospace' : 'sans-serif'}`]));

function readableError(error) {
  return String(error?.message || error || '操作失败。').replace(/^Error invoking remote method '[^']+': /, '');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function chatAttachmentMimeType(filePath) {
  const extension = filePath.split('.').pop().toLowerCase();
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf',
    txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json',
    html: 'text/html', css: 'text/css', js: 'text/javascript', ts: 'text/typescript', py: 'text/x-python' })[extension] || 'application/octet-stream';
}

function displayPath(value) {
  return String(value || '').replaceAll('\\', '/');
}

function extensionFor(filePath) {
  const extension = String(filePath || '').split('.').pop().toLowerCase();
  const options = {
    js: javascript({ jsx: true }), jsx: javascript({ jsx: true }),
    ts: javascript({ typescript: true }), tsx: javascript({ typescript: true, jsx: true }),
    mjs: javascript(), cjs: javascript(), py: python(), json: json(),
    html: html(), htm: html(), css: css(), scss: css(), md: markdown(), markdown: markdown(),
  };
  return options[extension] || [];
}

function inferWorkMode(content, hasAttachment = false) {
  const value = String(content || '').toLocaleLowerCase();
  if (/(代码|编程|程序|脚本|函数|接口|bug|报错|重构|typescript|javascript|python|css|html|code)/i.test(value)) return 'code';
  if (/(表格|电子表格|excel|xlsx|csv|数据透视|单元格|统计|公式)/i.test(value)) return 'office';
  if (/(计划|规划|方案|步骤|排期|拆解|路线图|里程碑)/i.test(value)) return 'plan';
  return hasAttachment ? 'answer' : 'answer';
}

function findAutomaticSkill(content, skills) {
  const value = String(content || '').toLocaleLowerCase();
  if (!value || !Array.isArray(skills)) return null;
  const aliases = [
    ['pdf', /(pdf|文档阅读|页面渲染)/i],
    ['documents', /(word|docx|文档|合同|报告)/i],
    ['spreadsheets', /(表格|excel|xlsx|csv|数据)/i],
    ['presentations', /(ppt|pptx|演示文稿|幻灯片)/i],
    ['browser', /(浏览器|网页|网站|页面|链接|网址)/i],
    ['computer-use', /(电脑操控|鼠标|键盘|桌面应用)/i],
    ['visualize', /(图表|可视化|绘图|趋势图)/i],
  ];
  const alias = aliases.find(([, pattern]) => pattern.test(value))?.[0];
  if (!alias) return null;
  return skills.find((skill) => `${skill.id} ${skill.name} ${skill.description}`.toLocaleLowerCase().includes(alias)) || null;
}

function App() {
  const [activeView, setActiveView] = useState('assistant');
  const [commandOpen, setCommandOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState({ id: 'general' });
  const [panelRequest, setPanelRequest] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [panelWidth, setPanelWidth] = useState(null);
  const [navigation, setNavigation] = useState({ entries: [], index: -1 });
  const navigationRef = useRef(navigation);
  const pendingNavigation = useRef(null);
  const [appState, setAppState] = useState(null);
  const [library, setLibraryState] = useState(null);
  const libraryRef = useRef(null);
  const setLibrary = useCallback((update) => {
    const next = typeof update === 'function' ? update(libraryRef.current) : update;
    // Native close can arrive before React renders the last input event.
    libraryRef.current = next;
    setLibraryState(next);
  }, []);
  const [historyStatus, setHistoryStatus] = useState('loading');
  const [contextTarget, setContextTarget] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [revisionEditor, setRevisionEditor] = useState(null);
  const [collaborationSource, setCollaborationSource] = useState('');
  const collaborationActionRef = useRef(null);
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [windowSubscriptions, setWindowSubscriptions] = useState([]);
  const windowActionRef = useRef(null);
  const actionFocusRef = useRef(null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const storageBusyRef = useRef(false);
  const storageOperationRef = useRef(null);
  const [preferences, setPreferences] = useState({ defaultMode: 'answer', railCollapsed: false, browserPanelOpen: true, browserPanelExpanded: false, fontSize: 16, themeMode: 'system', themeStyle: 'standard', accentColor: '#176C5B', backgroundColor: null, foregroundColor: null, fontFamily: 'Microsoft YaHei', defaultFileOpen: 'builtin', terminalShell: 'powershell', closeConfirmation: 'busy', sendShortcut: 'ctrl-enter', showEditorStatusBar: true, defaultFullView: false, skillsEnabled: true, notifyOnComplete: true, notifyOnIssues: true, notifyOnPermissions: true, notificationSound: 'default', conversationDirectory: null, compressHistory: false, autoArchiveDays: 0 });
  const [agentSettings, setAgentSettings] = useState(DEFAULT_AGENT_SETTINGS);
  const [skills, setSkills] = useState([]);
  const [plugins, setPlugins] = useState([]);
  const [scheduledState, setScheduledState] = useState({ version: 1, tasks: [], runs: [] });
  const [scheduledBackgroundBusy, setScheduledBackgroundBusy] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [activeSkill, setActiveSkill] = useState(null);
  const [pendingModeOverride, setPendingModeOverride] = useState(null);
  const [notice, setNotice] = useState('');
  const [apiState, setApiState] = useState('configured');
  const railCollapsed = preferences.railCollapsed;
  const browserOpen = preferences.browserPanelOpen;
  const browserExpanded = browserOpen && preferences.browserPanelExpanded;
  const canShareContext = preferences.contextAccess !== 'chat-only';
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [projectPathDraft, setProjectPathDraft] = useState('');
  const [projectSaving, setProjectSaving] = useState(false);
  const projectMenuRef = useRef(null);
  const [systemTheme, setSystemTheme] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light');
  const resolvedTheme = preferences.themeMode === 'system' ? systemTheme : preferences.themeMode;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const updateTheme = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener?.('change', updateTheme);
    return () => media.removeEventListener?.('change', updateTheme);
  }, []);

  const currentChat = library?.conversations.find((item) => item.id === library.activeId);
  const activeConversations = (library?.conversations || []).filter((chat) => !chat.archivedAt);
  const recentConversations = useMemo(() => activeConversations
    .filter((chat) => !chat.projectId || chat.projectId === appState?.activeProjectId)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt))), [activeConversations, appState?.activeProjectId]);
  const messages = currentChat?.messages || [];
  const prompt = currentChat?.draft || '';
  const sendMode = currentChat?.mode || preferences.defaultMode;
  const availableReasoningEfforts = agentSettings.availableReasoningEfforts || DEFAULT_AGENT_SETTINGS.availableReasoningEfforts;
  const reasoningEffort = availableReasoningEfforts.includes(currentChat?.reasoningEffort)
    ? currentChat.reasoningEffort
    : agentSettings.defaultReasoningEffort;
  const availableModels = appState?.connection?.models?.length ? appState.connection.models : [appState?.model || 'grok-4.7'];
  const selectedModel = availableModels.includes(currentChat?.model) ? currentChat.model
    : availableModels.includes(appState?.connection?.model) ? appState.connection.model : availableModels[0];
  const composerMode = pendingModeOverride && pendingModeOverride.conversationId === currentChat?.id ? pendingModeOverride.mode : 'answer';
  const selectChatModel = (model) => { if (availableModels.includes(model)) updateChat(() => ({ model })); };
  const selectChatReasoningEffort = (effort) => { if (availableReasoningEfforts.includes(effort)) updateChat(() => ({ reasoningEffort: effort })); };
  const updateChat = useCallback((update, id) => { if (storageBusyRef.current) return; setLibrary((current) => current ? { ...current,
    conversations: current.conversations.map((chat) => chat.id === (id || current.activeId) ? { ...chat, ...update(chat), updatedAt: new Date().toISOString() } : chat),
  } : current); }, [setLibrary]);
  const setMessages = useCallback((update, id) => updateChat((chat) => {
    const next = typeof update === 'function' ? update(chat.messages) : update;
    const firstUser = next.find((item) => item.role === 'user');
    const firstContent = firstUser?.content?.trim() || firstUser?.attachments?.[0]?.name || firstUser?.images?.[0]?.name || '新对话';
    return { messages: next, title: chat.title === '新对话' ? firstContent.replace(/[\r\n]+/g, ' ').slice(0, 40) : chat.title };
  }, id), [updateChat]);
  const setPrompt = (value) => updateChat(() => ({ draft: value }));
  const setSendMode = (value) => updateChat(() => ({ mode: value }));
  const [fileContext, setFileContext] = useState(null);
  const [imageAttachments, setImageAttachments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [fileDragActive, setFileDragActive] = useState(false);
  const attachmentGeneration = useRef(0);
  const attachmentReading = useRef(false);
  const dragDepth = useRef(0);
  const attachmentInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const activeRequestsRef = useRef(new Map());
  const [liveRequests, setLiveRequests] = useState([]);
  const currentRequest = liveRequests.find((request) => request.conversationId === currentChat?.id);
  const sending = Boolean(currentRequest);
  const activeRequestId = currentRequest?.requestId;
  const anySending = liveRequests.length > 0;
  const finishRequest = useCallback((requestId) => {
    const request = activeRequestsRef.current.get(requestId);
    if (!request) return;
    activeRequestsRef.current.delete(requestId);
    setLiveRequests([...activeRequestsRef.current.values()]);
    if (libraryRef.current?.activeId !== request.conversationId) updateChat(() => ({ unreadResult: true }), request.conversationId);
  }, [updateChat]);
  const [copiedId, setCopiedId] = useState('');
  const messagesEndRef = useRef(null);

  const composerBuffersRef = useRef(new Map());
  const composerSnapshotRef = useRef(null);
  // Capture each composer before switching and restore it before the next paint.
  useLayoutEffect(() => {
    const scope = workspaceRoot + '\0' + preferences.contextAccess;
    const id = library?.activeId || '';
    const previous = composerSnapshotRef.current;
    if (!previous || previous.scope !== scope || previous.id !== id) {
      if (previous && previous.contextAccess !== preferences.contextAccess) composerBuffersRef.current.clear();
      if (previous) composerBuffersRef.current.set(previous.scope + '\0' + previous.id, previous.value);
      const saved = composerBuffersRef.current.get(scope + '\0' + id);
      const value = {
        imageAttachments: canShareContext ? saved?.imageAttachments || [] : [],
        attachments: canShareContext ? saved?.attachments || [] : [],
        fileContext: canShareContext ? saved?.fileContext || null : null,
        activeSkill: canShareContext && preferences.skillsEnabled && !preferences.disabledSkillIds?.includes(saved?.activeSkill?.id) ? saved?.activeSkill || null : null,
        pendingModeOverride: saved?.pendingModeOverride || null,
      };
      composerSnapshotRef.current = { id, scope, contextAccess: preferences.contextAccess, value };
      setImageAttachments(value.imageAttachments); setAttachments(value.attachments);
      setFileContext(value.fileContext); setActiveSkill(value.activeSkill); setPendingModeOverride(value.pendingModeOverride);
      attachmentGeneration.current++;
      setFileDragActive(false); dragDepth.current = 0;
    } else {
      previous.value = { imageAttachments, attachments, fileContext, activeSkill, pendingModeOverride };
    }
    for (const key of composerBuffersRef.current.keys()) {
      const chatId = key.slice(key.lastIndexOf('\0') + 1);
      if (!library?.conversations.some((chat) => chat.id === chatId)) composerBuffersRef.current.delete(key);
    }
  });

  useEffect(() => {
    const reset = () => { dragDepth.current = 0; setFileDragActive(false); };
    window.addEventListener('dragend', reset);
    window.addEventListener('drop', reset);
    window.addEventListener('blur', reset);
    return () => { window.removeEventListener('dragend', reset); window.removeEventListener('drop', reset); window.removeEventListener('blur', reset); };
  }, []);

  const [currentDirectory, setCurrentDirectory] = useState('');
  const [fileEntries, setFileEntries] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [editorValue, setEditorValue] = useState('');
  const [fileDirty, setFileDirty] = useState(false);
  const [loadingDirectory, setLoadingDirectory] = useState(false);

  const canvasRef = useRef(null);
  const imageSourceRef = useRef(null);
  const [imagePath, setImagePath] = useState('');
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imageRotation, setImageRotation] = useState(0);
  const [imageBrightness, setImageBrightness] = useState(100);
  const [imageCaption, setImageCaption] = useState('');
  const [imageRevision, setImageRevision] = useState(0);
  const [imageModified, setImageModified] = useState(false);
  const imageLoadTokenRef = useRef(0);
  const imageLoaderRef = useRef(null);
  const imageDirty = imageModified || imageRotation % 4 !== 0 || imageBrightness !== 100 || Boolean(imageCaption);
  const imageStamp = [imagePath, imageRevision, imageRotation, imageBrightness, imageCaption, imageModified].join('\0');
  const [cropValue, setCropValue] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const workbookRef = useRef(null);
  const tableLoaderRef = useRef(null);
  const tableLoadTokenRef = useRef(0);
  const [tablePath, setTablePath] = useState('');
  const [tableKind, setTableKind] = useState('xlsx');
  const [tableSheets, setTableSheets] = useState([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [tableSearch, setTableSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [tableDirty, setTableDirty] = useState(false);
  const editorSnapshotRef = useRef(null);
  editorSnapshotRef.current = { activeFile, editorValue, fileDirty, currentDirectory, tablePath, tableDirty, tableSheets, imagePath, imageDirty, imageStamp };
  const closeSnapshotRef = useRef(null);
  closeSnapshotRef.current = { library, unsavedFiles: fileDirty || tableDirty || imageDirty };

  useEffect(() => window.scodex.onPrepareClose(() => {
    Promise.resolve(storageOperationRef.current).catch(() => {}).then(() =>
      window.scodex.completeClose({ ...closeSnapshotRef.current, library: libraryRef.current })).catch(() => {});
  }), []);

  const showNotice = useCallback((message) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => current === message ? '' : current), 3400);
  }, []);

  useEffect(() => {
    window.scodex.updateDirtyPaths([...(fileDirty && activeFile ? [activeFile] : []), ...(tableDirty && tablePath ? [tablePath] : []), ...(imageDirty && imagePath ? [imagePath] : [])]).catch((error) => showNotice(readableError(error)));
  }, [activeFile, fileDirty, tablePath, tableDirty, imagePath, imageDirty, workspaceRoot, showNotice]);


  useEffect(() => {
    let mounted = true;
    window.scodex.getAppState().then((state) => {
      if (!mounted) return;
      setAppState(state);
      setWorkspaceRoot(state.workspaceRoot);
      setScheduledState(state.scheduledTasks || { version: 1, tasks: [], runs: [] });
      setLibrary(state.library);
      setPreferences(state.preferences);
      setAgentSettings(state.agentSettings || DEFAULT_AGENT_SETTINGS);
      if (state.historyError) { setHistoryStatus('error'); showNotice(state.historyError); }
      setApiState(state.hasCredential ? 'configured' : 'missing');
    }).catch((error) => showNotice(readableError(error)));
    Promise.all([window.scodex.listSkills(), window.scodex.listPlugins(), window.scodex.getLocalCapabilities()]).then(([items, pluginItems, capabilityItems]) => {
      if (mounted) { setSkills(items); setPlugins(pluginItems); setInventory(capabilityItems); }
    }).catch((error) => { if (mounted) showNotice(readableError(error)); });
    return () => { mounted = false; };
  }, [showNotice]);

  useEffect(() => {
    if (!projectMenuOpen) return undefined;
    const dismiss = (event) => {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !projectMenuRef.current?.contains(event.target))) setProjectMenuOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss); };
  }, [projectMenuOpen]);

  useEffect(() => {
    if (activeView !== 'tasks') return undefined;
    const refresh = () => window.scodex.listScheduledTasks().then(setScheduledState).catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [activeView]);

  useEffect(() => window.scodex.onChatEvent((event) => {
    const request = activeRequestsRef.current.get(event.requestId);
    if (!request) return;
    const updateRequestMessages = (update) => setMessages(update, request.conversationId);
    if (event.type === 'phase') {
      updateRequestMessages((items) => items.map((item) => item.id === event.requestId ? { ...item, phase: event.phase } : item));
    } else if (event.type === 'operation') {
      updateRequestMessages((items) => items.map((item) => {
        if (item.id !== event.requestId) return item;
        const operations = [...(item.operations || [])];
        const index = operations.findIndex((operation) => operation.id === event.operation.id);
        if (index < 0) operations.push(event.operation); else operations[index] = { ...operations[index], ...event.operation };
        return { ...item, phase: 'tool', operations: operations.slice(0, 64) };
      }));
    } else if (event.type === 'approval') {
      updateRequestMessages((items) => items.map((item) => item.id === event.requestId ? { ...item, approval: event.approval } : item));
    } else if (event.type === 'file-changed') {
      const snapshot = editorSnapshotRef.current;
      if (snapshot.currentDirectory) window.scodex.listDirectory(snapshot.currentDirectory).then((result) => { if (editorSnapshotRef.current.currentDirectory === result.directory) setFileEntries(result.items); }).catch(() => {});
      if (snapshot.activeFile?.toLowerCase() === event.path.toLowerCase() && !snapshot.fileDirty) window.scodex.readTextFile(event.path).then((file) => {
        const latest = editorSnapshotRef.current;
        if (latest.activeFile === snapshot.activeFile && !latest.fileDirty && latest.editorValue === snapshot.editorValue) setEditorValue(file.content);
      }).catch((error) => showNotice(readableError(error)));
      if (snapshot.tablePath?.toLowerCase() === event.path.toLowerCase() && !snapshot.tableDirty) tableLoaderRef.current?.(event.path, { background: true });
      if (snapshot.imagePath?.toLowerCase() === event.path.toLowerCase() && !snapshot.imageDirty) imageLoaderRef.current?.(event.path, { background: true });
    } else if (event.type === 'delta') {
      updateRequestMessages((items) => items.map((item) => item.id === event.requestId ? { ...item, content: item.content + event.text } : item));
      setApiState('connected');
    } else if (event.type === 'complete') {
      finishRequest(event.requestId);
      setApiState('connected');
      updateRequestMessages((items) => items.map((item) => item.id === event.requestId ? { ...item, content: event.text, pending: false, approval: null, phase: '', ...settledTiming(item) } : item));
      window.scodex.notify('complete').catch(() => {});
    } else if (event.type === 'cancelled') {
      finishRequest(event.requestId);
      updateRequestMessages((items) => items.map((item) => item.id === event.requestId
        ? { ...item, pending: false, approval: null, operations: item.operations?.map((operation) => operation.status === 'running' ? { ...operation, status: 'cancelled' } : operation), cancelled: true, stoppedAfter: Math.max(0, Math.floor((Date.now() - (item.startedAt || Date.now())) / 1000)), ...settledTiming(item) }
        : item));
    } else if (event.type === 'error') {
      finishRequest(event.requestId);
      if (/HTTP 401|HTTP 403/.test(event.message)) setApiState('invalid');
      else if (/HTTP 503/.test(event.message)) setApiState('unavailable');
      else setApiState('error');
      updateRequestMessages((items) => items.map((item) => item.id === event.requestId ? { ...item, pending: false, approval: null, operations: item.operations?.map((operation) => operation.status === 'running' ? { ...operation, status: 'interrupted' } : operation), error: event.message, ...settledTiming(item) } : item));
      window.scodex.notify('issue').catch(() => {});
    }
  }), [setMessages, finishRequest]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ block: 'end', behavior: 'instant' });
  }, [messages]);

  useEffect(() => {
    if (!library || !appState || appState.historyError || storageBusy) return;
    let current = true;
    setHistoryStatus('saving');
    const timer = window.setTimeout(() => { if (storageBusyRef.current) return; window.scodex.saveHistory(library)
      .then(() => { if (current) setHistoryStatus('saved'); })
      .catch((error) => { if (current) { setHistoryStatus('error'); showNotice(readableError(error)); } }); }, anySending ? 450 : 100);
    return () => { current = false; window.clearTimeout(timer); };
  }, [library, appState, anySending, storageBusy, showNotice]);

  const loadDirectory = useCallback(async (directory = workspaceRoot) => {
    if (!directory) return;
    setLoadingDirectory(true);
    try {
      const result = await window.scodex.listDirectory(directory);
      setCurrentDirectory(result.directory);
      setFileEntries(result.items);
      setWorkspaceRoot(result.root);
    } catch (error) {
      showNotice(readableError(error));
    } finally {
      setLoadingDirectory(false);
    }
  }, [workspaceRoot, showNotice]);

  useEffect(() => {
    if (workspaceRoot) loadDirectory(workspaceRoot);
  }, [workspaceRoot, loadDirectory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const source = imageSourceRef.current;
    if (!canvas || !source) return;
    const turns = ((imageRotation % 4) + 4) % 4;
    const swapsDimensions = turns % 2 === 1;
    canvas.width = swapsDimensions ? source.naturalHeight : source.naturalWidth;
    canvas.height = swapsDimensions ? source.naturalWidth : source.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.filter = `brightness(${imageBrightness}%)`;
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(turns * Math.PI / 2);
    context.drawImage(source, -source.naturalWidth / 2, -source.naturalHeight / 2);
    context.restore();
    if (imageCaption.trim()) {
      const fontSize = Math.max(18, Math.round(canvas.width / 34));
      context.font = `600 ${fontSize}px "Microsoft YaHei", sans-serif`;
      context.textBaseline = 'bottom';
      context.lineWidth = Math.max(2, fontSize / 9);
      context.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      context.fillStyle = '#ffffff';
      const x = Math.round(canvas.width * 0.04);
      const y = Math.round(canvas.height * 0.94);
      context.strokeText(imageCaption, x, y, canvas.width * 0.92);
      context.fillText(imageCaption, x, y, canvas.width * 0.92);
    }
    setImageDimensions({ width: canvas.width, height: canvas.height });
  }, [imageRotation, imageBrightness, imageCaption, imagePath, imageRevision, activeView]);

  const currentSheet = tableSheets[activeSheetIndex];
  useEffect(() => {
    if (!imagePath || !imageSourceRef.current) return;
    const turns = ((imageRotation % 4) + 4) % 4;
    const width = turns % 2 ? imageSourceRef.current.naturalHeight : imageSourceRef.current.naturalWidth;
    const height = turns % 2 ? imageSourceRef.current.naturalWidth : imageSourceRef.current.naturalHeight;
    setCropValue({ x: 0, y: 0, width, height });
  }, [imagePath, imageRotation, imageRevision]);

  const enabledSkills = useMemo(() => preferences.skillsEnabled ? skills.filter((skill) => !(preferences.disabledSkillIds || []).includes(skill.id)) : [], [skills, preferences.skillsEnabled, preferences.disabledSkillIds]);
  const filteredSkills = useMemo(() => enabledSkills.filter((skill) => `${skill.name} ${skill.description}`.toLowerCase().includes(skillSearch.toLowerCase())), [enabledSkills, skillSearch]);

  const savePreferences = async (update) => {
    try {
      const saved = await window.scodex.savePreferences(update);
      setPreferences(saved);
      if (update.contextAccess === 'chat-only' || !saved.skillsEnabled || saved.disabledSkillIds?.includes(activeSkill?.id)) setActiveSkill(null);
      if (update.contextAccess === 'chat-only') setFileContext(null);
      return saved;
    }
    catch (error) { showNotice(readableError(error)); return null; }
  };

  const modelConnectionSaved = (connection) => {
    setAppState((current) => ({ ...current, connection, model: connection.model, endpoint: connection.baseUrl, profile: connection.name, hasCredential: connection.hasCredential }));
    setApiState('configured');
  };

  const configureChatStorage = async (update) => {
    if (storageBusyRef.current || activeRequestsRef.current.size || !libraryRef.current || appState?.historyError) return;
    storageBusyRef.current = true;
    setStorageBusy(true);
    const operation = window.scodex.configureConversationStorage(update, libraryRef.current);
    storageOperationRef.current = operation.then((result) => {
      if (!result) return;
      setLibrary(result.library);
      setPreferences(result.preferences);
      setAppState((current) => ({ ...current, library: result.library, preferences: result.preferences, conversationDirectory: result.conversationDirectory }));
      setHistoryStatus('saved');
      showNotice(result.warning || (result.archivedCount ? `已归档 ${result.archivedCount} 个不活跃聊天，可在存储空间恢复` : '聊天存储设置已保存'));
      return result.preferences;
    });
    try { return await storageOperationRef.current; }
    catch (error) { showNotice(readableError(error)); }
    finally { storageOperationRef.current = null; storageBusyRef.current = false; setStorageBusy(false); }
  };

  const saveAgentSettings = async (update, scope = 'shared') => {
    try {
      const saved = await window.scodex.saveAgentSettings(update, scope);
      setAgentSettings(saved.agentSettings);
      setAppState((current) => current ? { ...current, ...saved } : current);
      return saved.agentSettingsScopes[scope].settings;
    } catch (error) {
      showNotice(readableError(error));
      setAppState((current) => current ? { ...current, agentSettingsError: readableError(error) } : current);
      return null;
    }
  };

  const refreshSkills = async () => {
    setInventoryBusy(true); setInventoryError('');
    try {
      const [items, pluginItems, capabilityItems] = await Promise.all([window.scodex.listSkills(), window.scodex.listPlugins(), window.scodex.getLocalCapabilities()]);
      setInventory(capabilityItems);
      setSkills(items);
      setActiveSkill(current => current ? items.find(item => item.id === current.id) || null : null);
      setPlugins(pluginItems);
      showNotice('本地能力列表已更新');
    }
    catch (error) { setInventoryError(readableError(error)); showNotice(readableError(error)); }
    finally { setInventoryBusy(false); }
  };

  const toggleSkill = async (id, enabled) => {
    const disabledSkillIds = new Set(preferences.disabledSkillIds || []);
    if (enabled) disabledSkillIds.delete(id); else disabledSkillIds.add(id);
    const saved = await savePreferences({ disabledSkillIds: [...disabledSkillIds] });
    if (saved && !enabled && activeSkill?.id === id) setActiveSkill(null);
  };

  const saveScheduledTask = async (input, id) => {
    const next = id ? await window.scodex.updateScheduledTask(id, input) : await window.scodex.createScheduledTask(input);
    setScheduledState(next);
    showNotice(id ? '定时任务已更新' : '定时任务已创建');
  };
  const refreshScheduledTasks = async () => {
    setScheduledBackgroundBusy(true);
    try { setScheduledState(await window.scodex.listScheduledTasks({ refresh: true })); }
    catch (error) { showNotice(readableError(error)); }
    finally { setScheduledBackgroundBusy(false); }
  };
  const setScheduledBackgroundEnabled = async (enabled) => {
    setScheduledBackgroundBusy(true);
    try {
      const next = await window.scodex.setScheduledBackground(enabled);
      setScheduledState(next);
      showNotice(next.background?.error || (enabled ? '退出后调度已启用' : '退出后调度已关闭'));
    } catch (error) { showNotice(readableError(error)); }
    finally { setScheduledBackgroundBusy(false); }
  };
  const removeScheduledTask = async (id) => {
    setScheduledState(await window.scodex.removeScheduledTask(id));
    showNotice('定时任务已删除，运行记录已保留');
  };
  const setScheduledTaskEnabled = async (id, enabled) => {
    setScheduledState(await window.scodex.enableScheduledTask(id, enabled));
    showNotice(enabled ? '定时任务已启用' : '定时任务已暂停');
  };
  const runScheduledTask = async (id) => {
    const run = await window.scodex.runScheduledTask(id);
    setScheduledState(await window.scodex.listScheduledTasks());
    showNotice(run.status === 'succeeded' ? '定时任务已完成' : '定时任务执行失败，请查看运行记录');
    return run;
  };

  const resetWorkspaceEditors = () => {
    imageLoadTokenRef.current += 1;
    setActiveFile(null);
    setEditorValue('');
    setFileDirty(false);
    setTableSheets([]);
    setTablePath('');
    setTableDirty(false);
    workbookRef.current = null;
    setImagePath('');
    setImageModified(false); setImageRotation(0); setImageBrightness(100); setImageCaption('');
    imageSourceRef.current = null;
    setFileContext(null);
  };
  const applyProjectState = async (state) => {
    setWorkspaceRoot(state.workspaceRoot);
    setCurrentDirectory(state.workspaceRoot);
    resetWorkspaceEditors();
    if (state.agentSettings) setAgentSettings(state.agentSettings);
    setAppState((current) => ({ ...current, ...state }));
    setLibrary((current) => {
      if (!current) return current;
      const nextChat = current.conversations.find((chat) => !chat.archivedAt && chat.projectId === state.activeProjectId);
      if (nextChat) return { ...current, activeId: nextChat.id };
      const created = newChatRecord(state.activeProjectId, preferences.defaultMode);
      return { ...current, activeId: created.id, conversations: [created, ...current.conversations] };
    });
    try {
      const [items, pluginItems] = await Promise.all([window.scodex.listSkills(), window.scodex.listPlugins()]);
      setSkills(items);
      setPlugins(pluginItems);
    } catch (error) { showNotice(readableError(error)); }
  };
  const selectProject = async (id) => {
    if ((fileDirty || tableDirty || imageDirty) && !window.confirm('当前文件、表格或图片有未保存修改。切换项目会清空编辑内容，是否继续？')) return;
    try {
      await applyProjectState(await window.scodex.selectProject(id));
      setProjectMenuOpen(false);
      showNotice('已切换项目');
    } catch (error) { showNotice(readableError(error)); }
  };
  const ensureProjectSelected = async (id) => {
    if (!id || id === appState?.activeProjectId) return;
    if ((fileDirty || tableDirty || imageDirty) && !window.confirm('当前项目有未保存编辑。切换项目会清空编辑内容，是否继续？')) throw Error('已取消项目切换。');
    const state = await window.scodex.selectProject(id);
    await applyProjectState(state);
    setProjectMenuOpen(false);
  };
  const openManagedWorktree = async (id) => {
    const state = await window.scodex.openWorktreeProject(id);
    await applyProjectState(state); navigateView('assistant'); showNotice('工作树已作为项目打开');
  };
  const chooseProjectFolder = async () => {
    try {
      const selected = await window.scodex.chooseProjectFolder();
      if (selected) {
        setProjectPathDraft(selected);
        if (!projectNameDraft.trim()) setProjectNameDraft(selected.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) || '');
      }
    } catch (error) { showNotice(readableError(error)); }
  };
  const createProject = async (event) => {
    event.preventDefault();
    if ((fileDirty || tableDirty || imageDirty) && !window.confirm('当前文件、表格或图片有未保存修改。创建项目并切换会清空编辑内容，是否继续？')) return;
    setProjectSaving(true);
    try {
      const state = await window.scodex.addProject({ name: projectNameDraft, path: projectPathDraft });
      await applyProjectState(state);
      setProjectDialogOpen(false);
      setProjectMenuOpen(false);
      setProjectNameDraft('');
      setProjectPathDraft('');
      showNotice('项目已创建并切换');
    } catch (error) { showNotice(readableError(error)); }
    finally { setProjectSaving(false); }
  };

  const navigateView = (view) => {
    setActiveView(view);
    if (preferences.browserPanelExpanded) savePreferences({ browserPanelExpanded: false });
  };
  useEffect(() => {
    if (!library?.activeId) return;
    const location = { view: activeView, ...(activeView === 'assistant' ? { chatId: library.activeId } : {}) };
    if (sameLocation(pendingNavigation.current, location)) { pendingNavigation.current = null; return; }
    pendingNavigation.current = null;
    const next = recordLocation(navigationRef.current, location);
    if (next !== navigationRef.current) { navigationRef.current = next; setNavigation(next); }
  }, [activeView, library?.activeId]);
  const canVisitLocation = (location) => location.view !== 'assistant' || libraryRef.current?.conversations.some((chat) => chat.id === location.chatId && !chat.archivedAt);
  const goHistory = async (direction) => {
    if (attachmentReading.current || storageBusyRef.current || settingsDialogOpen) return;
    const target = findLocation(navigationRef.current, direction, canVisitLocation);
    if (!target) return;
    try {
      const targetChat = target.location.view === 'assistant' ? libraryRef.current?.conversations.find((chat) => chat.id === target.location.chatId) : null;
      await ensureProjectSelected(targetChat?.projectId);
      const next = { ...navigationRef.current, index: target.index };
      navigationRef.current = next; setNavigation(next); pendingNavigation.current = target.location;
      if (targetChat && target.location.chatId !== libraryRef.current.activeId) {
        setLibrary((current) => ({ ...current, activeId: target.location.chatId, conversations: current.conversations.map((chat) => chat.id === target.location.chatId ? { ...chat, unreadResult: false } : chat) }));
      }
      navigateView(target.location.view);
    } catch (error) { showNotice(readableError(error)); }
  };
  useEffect(() => {
    const shortcut = (event) => {
      if (document.querySelector('.task-collaboration-dialog[open]')) return;
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !['ArrowLeft', 'ArrowRight'].includes(event.key) || event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault(); goHistory(event.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });
  const toggleBrowser = () => savePreferences({ browserPanelOpen: !browserOpen });
  const revealWorkspace = () => window.scodex.revealWorkspace().catch((error) => showNotice(readableError(error)));
  const openTerminal = () => window.scodex.openTerminal()
    .then(() => showNotice(`已在当前工作区打开 ${preferences.terminalShell === 'cmd' ? '命令提示符' : 'PowerShell'}`))
    .catch((error) => showNotice(readableError(error)));

  const newConversation = () => {
    if (attachmentReading.current || storageBusyRef.current || !library) return;
    const now = new Date().toISOString();
    const chat = { id: window.crypto.randomUUID(), title: '新对话', createdAt: now, updatedAt: now, projectId: appState?.activeProjectId || '', mode: preferences.defaultMode, reasoningEffort: agentSettings.defaultReasoningEffort, draft: '', pinned: false, messages: [] };
    setLibrary((current) => ({ ...current, activeId: chat.id, conversations: [chat, ...current.conversations] }));
    setActiveView('assistant');
    if (preferences.defaultFullView) savePreferences({ browserPanelOpen: false, railCollapsed: true });
  };

  const selectConversation = async (id) => {
    if (attachmentReading.current || storageBusyRef.current) return;
    const target = libraryRef.current?.conversations.find((chat) => chat.id === id && !chat.archivedAt);
    if (!target) return false;
    try {
      await ensureProjectSelected(target.projectId);
      setLibrary((current) => ({ ...current, activeId: id, conversations: current.conversations.map((chat) => chat.id === id ? { ...chat, unreadResult: false } : chat) }));
      setActiveView('assistant');
      return true;
    } catch (error) { showNotice(readableError(error)); return false; }
  };

  const manageStoredChats = async (action, ids) => {
    if (storageBusyRef.current) throw new Error('聊天存储正在更新，请稍候。');
    if (activeRequestsRef.current.size) throw new Error('请先停止所有聊天任务，再管理聊天。');
    if (appState?.historyError) throw new Error(appState.historyError);
    if (!['archive', 'restore', 'delete'].includes(action) || !Array.isArray(ids) || !ids.length) throw new Error('请选择要管理的聊天。');
    const current = libraryRef.current;
    if (!current || ids.some((id) => !current.conversations.some((chat) => chat.id === id))) throw new Error('聊天列表已变化，请刷新后重试。');
    let conversations = action === 'delete' ? current.conversations.filter((chat) => !ids.includes(chat.id))
      : current.conversations.map((chat) => ids.includes(chat.id) ? { ...chat, archivedAt: action === 'archive' ? new Date().toISOString() : null } : chat);
    if (!conversations.some((chat) => !chat.archivedAt)) {
      const now = new Date().toISOString();
      conversations = [{ id: window.crypto.randomUUID(), title: '新对话', projectId: appState?.activeProjectId || '', mode: preferences.defaultMode, reasoningEffort: agentSettings.defaultReasoningEffort, draft: '', pinned: false, createdAt: now, updatedAt: now, messages: [] }, ...conversations];
    }
    const next = { ...current, conversations, activeId: conversations.some((chat) => chat.id === current.activeId && !chat.archivedAt) ? current.activeId : conversations.find((chat) => !chat.archivedAt).id };
    setLibrary(next);
    if (next.activeId !== current.activeId) { setFileContext(null); setActiveSkill(null); }
    await window.scodex.saveHistory(next);
  };
  const deleteConversation = (id) => manageStoredChats('delete', [id]).catch((error) => showNotice(readableError(error)));

  const closeContextMenu = () => {
    setContextTarget(null);
    actionFocusRef.current?.focus?.();
  };
  const openContextMenu = (event, kind, id) => {
    if (storageBusyRef.current || actionDialog || settingsDialogOpen || attachmentReading.current) return;
    event.preventDefault(); event.stopPropagation();
    const element = event.currentTarget, rect = element.getBoundingClientRect();
    actionFocusRef.current = element;
    setProjectMenuOpen(false);
    setContextTarget({ kind, id, x: event.type === 'keydown' ? rect.left + 20 : event.clientX, y: event.type === 'keydown' ? rect.bottom : event.clientY });
  };
  const contextKeys = (event, kind, id) => {
    if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') openContextMenu(event, kind, id);
  };
  const chatAction = async (type, id, value) => {
    if (storageBusyRef.current || appState?.historyError) throw Error(appState?.historyError || '聊天存储正在更新。');
    const result = applyConversationAction(libraryRef.current, { type, id, value }, {
      runningIds: [...activeRequestsRef.current.values()].map(r => r.conversationId), projects: appState?.projects || [], activeProjectId: appState?.activeProjectId || '',
    });
    setLibrary(result.library);
    await window.scodex.saveHistory(result.library);
    if (result.created) navigateView('assistant');
    return result;
  };
  const projectAction = async (type, id, value) => {
    if (storageBusyRef.current) throw Error('项目或聊天存储正在更新。');
    const structural = ['archive', 'delete'].includes(type);
    const projectRunning = [...activeRequestsRef.current.values()].some((request) => request.projectId === id);
    if (structural && (projectRunning || fileDirty || tableDirty || imageDirty)) throw Error('请先停止此项目的任务并保存编辑，再归档或删除项目。');
    const oldRoot = workspaceRoot;
    if (structural) { storageBusyRef.current = true; setStorageBusy(true); }
    try {
      const operation = window.scodex.mutateProject(type, id, value, libraryRef.current);
      if (structural) storageOperationRef.current = operation;
      const state = await operation;
      if (state.library) setLibrary(state.library);
      if (state.workspaceRoot !== oldRoot) await applyProjectState(state);
      else setAppState(current => ({ ...current, ...state }));
      return state;
    } catch(error) {
      if (structural) { const state=await window.scodex.getAppState(); if(state.workspaceRoot!==oldRoot) await applyProjectState(state); else setAppState(current=>({...current,...state})); }
      throw error;
    } finally { if (structural) { storageOperationRef.current = null; storageBusyRef.current = false; setStorageBusy(false); } }
  };
  const exportChat = async (id, options = {}) => {
    const chat = libraryRef.current?.conversations.find(c => c.id === id);
    if (!chat) throw Error('聊天已不存在。');
    const result = await window.scodex.exportConversation({ ...options, title: chat.title,
      text: conversationText(chat, appState?.projects?.find(p => p.id === chat.projectId), options.format === 'txt') });
    showNotice('聊天已导出：' + result.path);
    return result;
  };
  const attachContextFromMenu = async (action, kind, id) => {
    const { chat, project } = await prepareContextTarget(kind, id);
    if (action === 'attach:conversation') {
      if (!chat) throw Error('请选择一条聊天记录。');
      const content = conversationText(chat, project);
      setFileContext({ path: `聊天记录/${chat.title || '未命名聊天'}.md`, kind: 'conversation', content: truncateUtf8(content, 128 * 1024) });
      showNotice('聊天记录已附加，发送时才提交给当前模型');
    } else if (action === 'attach:folder') {
      if (!project?.path) throw Error('此聊天没有所属项目文件夹。');
      await addFolderContext({ directory: project.path });
    } else if (action === 'attach:workbench') {
      const sameWorkspace = project?.path && project.path.replace(/[\\/]+$/, '').toLowerCase() === workspaceRoot.replace(/[\\/]+$/, '').toLowerCase();
      const root = project?.path || workspaceRoot;
      const content = [
        'Scodex 工作台状态快照（仅包含状态信息，不包含文件正文或其他对话）：',
        `工作区：${root}`, `当前目录：${sameWorkspace ? currentDirectory || root : root}`,
        `工作模式：${workMode(chat?.mode || preferences.defaultMode).label}`,
        `编辑文件：${sameWorkspace ? activeFile || '无' : '无'}${sameWorkspace && fileDirty ? '（尚未保存）' : ''}`,
        `表格：${sameWorkspace ? tablePath || '无已保存表格' : '无已保存表格'}${sameWorkspace && currentSheet ? `；${currentSheet.name}，${currentSheet.rowCount} 行 × ${currentSheet.columnCount} 列` : ''}`,
        `图片：${sameWorkspace ? imagePath || '无' : '无'}`,
      ].join('\n');
      setFileContext({ path: 'Scodex 工作台', kind: 'workbench', content: truncateUtf8(content, 128 * 1024) });
      showNotice('工作台状态已附加，发送时才提交给当前模型');
    } else if (action === 'attach:file') {
      await attachSelectedFile(CHAT_ATTACHMENT_FILTERS);
    } else if (action === 'attach:image') {
      await attachSelectedFile(CHAT_IMAGE_FILTERS);
    } else if (action.startsWith('attach-skill:')) {
      const skill = enabledSkills.find((item) => item.id === action.slice('attach-skill:'.length));
      if (!skill || !selectSkill(skill)) throw Error('此技能已停用或当前不可用。');
    } else {
      throw Error('不支持此附件操作。');
    }
    setActiveView('assistant');
  };
  const openTargetWindow = async (kind, id) => {
    if (storageBusyRef.current || !libraryRef.current) throw Error('工作台尚未就绪。');
    // Persist the identity before the broker resolves a just-created or renamed chat.
    await window.scodex.saveHistory(libraryRef.current);
    return window.scodex.openWorkspaceWindow(kind, id);
  };
  const performContextAction = async (action, target = contextTarget) => {
    if (!target) return;
    const { kind, id } = target;
    const record = kind === 'chat' ? libraryRef.current?.conversations.find(c => c.id === id) : appState?.projects?.find(p => p.id === id);
    if (!record) throw Error('此项目或聊天已不存在。');
    if (action.startsWith('attach:') || action.startsWith('attach-skill:')) { await attachContextFromMenu(action,kind,id); return; }
    if (['rename','delete','export'].includes(action)) {
      setActionDialog({ type: action, kind, id, value: kind === 'chat' ? record.title : record.name,
        description: action === 'rename' ? '为' + (kind === 'chat' ? '聊天' : '项目') + '设置清晰的名称。'
          : action === 'export' ? '导出“' + record.title + '”的正文与操作摘要。' : '永久删除“' + (record.title || record.name) + '”？',
        warning: kind === 'project' ? '将移除此项目登记及其聊天记录，无法撤销。磁盘项目文件夹及其中所有文件保留。' : '此聊天及其消息会从本机聊天库永久删除，无法撤销。' });
    } else if (['pin','unread','archive','restore'].includes(action)) {
      await (kind === 'chat' ? chatAction(action,id) : projectAction(action,id));
      showNotice(action === 'archive' ? '已归档，可从已归档列表恢复' : action === 'restore' ? '已恢复' : action === 'pin' ? (record.pinned ? '已取消置顶' : '已置顶') : '已更新阅读状态');
    } else if (action.startsWith('move:')) { await chatAction('move',id,action.slice(5)); showNotice('聊天已移动到所选项目'); }
    else if (action.startsWith('fork:')) { await chatAction('fork',id,action.slice(5)); showNotice('已分叉聊天，历史保留且不会重放命令'); }
    else if (action.startsWith('copy:')) {
      const part = action.slice(5), text = part === 'title' ? record.title || record.name : part === 'id' ? id : part === 'path' ? record.path
        : conversationText(record,appState?.projects?.find(p=>p.id===record.projectId),part === 'text');
      await navigator.clipboard.writeText(text); showNotice('已复制');
    } else if (action === 'window') await openTargetWindow(kind,id);
    else if (action === 'focus') {
      if (kind === 'project') { await selectProject(id); navigateView('assistant'); }
      else selectConversation(id);
    } else if (action === 'directory') await window.scodex.openProjectPath(id);
    else if (action === 'open-default') await exportChat(id,{ format:'txt', openAfter:true });
    else if (action === 'export-reveal') await exportChat(id,{ format:'md', reveal:true });
    else if (action === 'new-chat') {
      if (id !== appState.activeProjectId) { await selectProject(id); const state = await window.scodex.getAppState(); if (state.activeProjectId !== id) throw Error('项目切换未完成。'); }
      const chat = newChatRecord(id,preferences.defaultMode); chat.reasoningEffort = agentSettings.defaultReasoningEffort;
      const next = { ...libraryRef.current, activeId:chat.id, conversations:[chat,...libraryRef.current.conversations] };
      setLibrary(next); await window.scodex.saveHistory(next); navigateView('assistant');
    }
  };
  const runContextAction = (action) => {
    const target = contextTarget; closeContextMenu();
    performContextAction(action,target).catch(error=>showNotice(readableError(error)));
  };
  const contextEntries = (() => {
    if (!contextTarget) return [];
    const { kind,id } = contextTarget, record = kind === 'chat' ? library?.conversations.find(c=>c.id===id) : appState?.projects?.find(p=>p.id===id);
    if (!record) return [];
    const unavailable = storageBusy || attachmentLoading;
    const running = kind === 'chat' ? liveRequests.some(r=>r.conversationId===id) : liveRequests.some(r=>r.projectId===id);
    const structuralReason = running ? '请先停止任务' : kind === 'project' && (fileDirty||tableDirty||imageDirty) ? '请先保存编辑内容' : '';
    const row = (id,label,icon,extra={})=>({id,label,icon,disabled:unavailable,...extra});
    const sep = id=>({id,separator:true});
    const contextProject = kind === 'project' ? record : (appState?.projects||[]).find(p=>p.id===record.projectId);
    const targetArchived = Boolean(record.archivedAt || contextProject?.archivedAt);
    const attachReason = !canShareContext ? '请先将权限切换为完全访问' : targetArchived ? '请先恢复已归档的项目或聊天' : '';
    const attachDisabled = unavailable || Boolean(attachReason);
    const attachRows = [
      ...(kind === 'chat' ? [row('attach:conversation','聊天记录','chat',{disabled:attachDisabled,reason:attachReason})] : []),
      ...(contextProject?.path ? [row('attach:folder','项目目录清单','folder',{disabled:attachDisabled,reason:attachReason})] : []),
      row('attach:workbench','工作台状态快照','snapshot',{disabled:attachDisabled,reason:attachReason}),
      row('attach:file','选择文件…','file',{disabled:attachDisabled,reason:attachReason}),
      row('attach:image','选择图片…','image',{disabled:attachDisabled,reason:attachReason}),
    ];
    const skillRows = enabledSkills.map(skill=>row('attach-skill:'+skill.id,skill.name,'skill',{disabled:attachDisabled,reason:attachReason}));
    const projectChoices = (prefix,selected) => (appState?.projects||[]).filter(p=>!p.archivedAt).map(p=>row(prefix+p.id,p.name,'project',{checked:p.id===selected}));
    const entries = [row('rename','重命名','rename',{shortcut:'Alt+Ctrl+R'}),row('pin',record.pinned?'取消置顶':'置顶',record.pinned?'unpin':'pin',{shortcut:'Alt+Ctrl+P'}),
      row('unread',(kind==='chat'?record.unreadResult:record.unread)?'标记为已读':'标记为未读','unread',{shortcut:'Ctrl+Shift+U'})];
    if (kind === 'chat') entries.push(row('project','项目','project',{disabled:unavailable||Boolean(structuralReason),reason:structuralReason,children:[row('move:','未分组','project',{checked:!record.projectId}),...projectChoices('move:',record.projectId)]}),
      sep('s1'),row('fork','分叉','fork',{children:[row('fork:'+(record.projectId||''),'在当前项目中分叉','fork'),...projectChoices('fork:',null).filter(p=>p.id!=='fork:'+(record.projectId||''))]}));
    else entries.push(row('new-chat','新建聊天','new',{disabled:unavailable||Boolean(record.archivedAt)}));
    entries.push(sep('s-attach'),row('attach','附加到当前消息','attach',{disabled:attachDisabled,reason:attachReason,children:attachRows}),
      ...(skillRows.length ? [row('skills','附加技能','skill',{disabled:attachDisabled,reason:attachReason,children:skillRows})] : []),
      sep('s2'),row('copy','复制','copy',{children:kind==='chat'?[row('copy:title','复制标题','copy'),row('copy:markdown','复制 Markdown','copy'),row('copy:text','复制纯文本','copy'),row('copy:id','复制聊天标识','copy')]:[row('copy:title','复制项目名称','copy'),row('copy:path','复制项目路径','copy'),row('copy:id','复制项目标识','copy')]}),
      sep('s3'),row('window','在新窗口中打开','window'),row('open','打开方式','open',{children:kind==='chat'?[row('focus','在主工作台中打开','open',{disabled:unavailable||Boolean(record.archivedAt)}),row('open-default','使用默认应用打开文本副本','open'),row('export','导出为 Markdown / TXT…','open'),row('export-reveal','导出并在文件夹中显示','project')]:[row('focus','在主工作台中打开','open',{disabled:unavailable||Boolean(record.archivedAt)}),row('directory','在资源管理器中打开','project')]}),
      sep('s4'),row(record.archivedAt?'restore':'archive',record.archivedAt?'取消归档':'归档',record.archivedAt?'restore':'archive',{shortcut:'Ctrl+Shift+A',disabled:unavailable||Boolean(structuralReason),reason:structuralReason}),
      row('delete','永久删除','delete',{danger:true,disabled:unavailable||Boolean(structuralReason),reason:structuralReason}));
    return entries;
  })();

  const startDraft = (mode, text) => {
    if (prompt.trim() && !window.confirm('用示例替换当前草稿？')) return;
    updateChat(() => ({ mode, draft: text }));
    document.querySelector('textarea[aria-label="输入工作内容"]')?.focus();
  };

  const handleChooseWorkspace = async () => {
    if ((fileDirty || tableDirty || imageDirty) && !window.confirm('当前文件、表格或图片有未保存修改。切换工作区会清空编辑内容，是否继续？')) return;
    try {
      const selected = await window.scodex.chooseWorkspace();
      if (selected) {
        const state = await window.scodex.getAppState();
        await applyProjectState(state);
        showNotice('工作区已切换');
      }
    } catch (error) { showNotice(readableError(error)); }
  };

  const openCodeFile = async (filePath) => {
    if (fileDirty && !window.confirm('当前文件有未保存修改。放弃修改并打开另一个文件？')) return;
    try {
      const file = await window.scodex.readTextFile(filePath);
      setActiveFile(file.path);
      setEditorValue(file.content);
      setFileDirty(false);
      setActiveView('files');
    } catch (error) { showNotice(readableError(error)); }
  };

  const openWorkspaceFile = async (filePath) => {
    const extension = filePath.split('.').pop().toLowerCase();
    if (['xlsx', 'csv', 'tsv'].includes(extension)) { await loadTableFile(filePath); return; }
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(extension)) { await loadImageFile(filePath); return; }
    if (extension === 'xlsm') { showNotice('含宏的工作簿请先另存为 XLSX；不会作为文本编辑。'); return; }
    const embeddedFormats = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'xlsx', 'csv', 'tsv', 'xlsm'];
    if (preferences.defaultFileOpen === 'system' && !embeddedFormats.includes(extension)) {
      try {
        await window.scodex.openExternalFile(filePath);
        showNotice('已交给 Windows 默认程序打开');
      } catch (error) { showNotice(readableError(error)); }
      return;
    }
    await openCodeFile(filePath);
  };

  const openFileFromDialog = async () => {
    try {
      const filePath = await window.scodex.chooseFile(CODE_FILTERS);
      if (filePath) await openWorkspaceFile(filePath);
    } catch (error) { showNotice(readableError(error)); }
  };

  const createCodeFile = async () => {
    if (fileDirty && !window.confirm('当前文件有未保存修改，放弃并新建文件？')) return;
    try {
      const file = await window.scodex.createFile('untitled.js');
      if (file) {
        setActiveFile(file.path);
        setEditorValue('');
        setFileDirty(false);
        setActiveView('files');
        await loadDirectory(currentDirectory || workspaceRoot);
      }
    } catch (error) { showNotice(readableError(error)); }
  };

  const saveCodeFile = async () => {
    try {
      const target = activeFile || await window.scodex.chooseSaveFile('untitled.js', CODE_FILTERS);
      if (!target) return;
      await window.scodex.saveTextFile(target, editorValue);
      setActiveFile(target);
      setFileDirty(false);
      await loadDirectory(currentDirectory || workspaceRoot);
      showNotice('文件已保存');
    } catch (error) { showNotice(readableError(error)); }
  };

  const changeWorkspaceDirectory = async (item) => {
    if (item.directory) {
      await loadDirectory(item.path);
      return;
    }
    const extension = item.name.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(extension)) {
      await loadImageFile(item.path);
    } else if (extension === 'xlsm') {
      showNotice('含宏的 XLSM 工作簿暂不支持安全保存；请先另存为 XLSX。');
    } else if (['xlsx', 'csv', 'tsv'].includes(extension)) {
      await loadTableFile(item.path);
    } else {
      await openWorkspaceFile(item.path);
    }
  };

  const getImageDataUrl = (filePath, bytes) => {
    const extension = filePath.split('.').pop().toLowerCase();
    const type = extension === 'jpg' ? 'jpeg' : extension;
    let binary = '';
    const values = new Uint8Array(bytes);
    for (let index = 0; index < values.length; index += 0x8000) {
      binary += String.fromCharCode(...values.subarray(index, index + 0x8000));
    }
    return `data:image/${type};base64,${window.btoa(binary)}`;
  };

  const loadImageFile = async (filePath, { background = false, discard = false } = {}) => {
    const snapshot = editorSnapshotRef.current;
    if (background && (snapshot.imageDirty || snapshot.imagePath?.toLowerCase() !== filePath.toLowerCase())) return;
    if (!background && !discard && snapshot.imageDirty && !window.confirm('图片有未导出修改，放弃并打开图片？')) return;
    const token = ++imageLoadTokenRef.current;
    try {
      const file = await window.scodex.readBinaryFile(filePath);
      const image = new window.Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('无法解码这张图片。')); image.src = getImageDataUrl(file.path, file.content); });
      if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('图片尺寸超过4000万像素，暂不编辑。');
      if (token !== imageLoadTokenRef.current || editorSnapshotRef.current.imageStamp !== snapshot.imageStamp) return;
      imageSourceRef.current = image;
      setImageRevision((value) => value + 1); setImagePath(file.path); setImageModified(false);
      setImageRotation(0); setImageBrightness(100); setImageCaption('');
      if (!background) setActiveView('images');
    } catch (error) { showNotice(readableError(error)); }
  };
  imageLoaderRef.current = loadImageFile;
  const useMcpContext = (value) => {
    if (!canShareContext) { showNotice('请先允许项目上下文，再加入MCP资料'); return; }
    const block = '[MCP资料 · ' + value.serverName + ' · ' + value.name + ']\n' + value.notice + (value.truncated ? '\n[本次读取已截断]' : '') + '\n\n' + value.text;
    if ((currentChat?.draft?.length || 0) + block.length + 2 > 64000) { showNotice('当前草稿加上资料超过64000字符，请先缩短草稿或资料'); return; }
    updateChat(chat => ({ draft: [chat.draft, block].filter(Boolean).join('\n\n') }));
    navigateView('assistant');
    showNotice('资料已加入草稿，点击发送后才提交给模型');
  };
  const requestImageHelp = () => {
    if (!canShareContext) { showNotice('请先允许项目访问，再启用AI图片处理'); return; }
    if (imageDirty) { showNotice('请先导出或重置图片修改，再让AI处理'); return; }
    updateChat((chat) => ({ executionEnabled: true, draft: chat.draft || (imagePath ? '请先查看项目图片 ' + imagePath + '，然后按我的要求修改：' : '请查看并处理当前项目的图片：') }));
    navigateView('assistant');
  };

  const openImageFromDialog = async () => {
    try {
      const filePath = await window.scodex.chooseFile(IMAGE_FILTERS);
      if (filePath) await loadImageFile(filePath);
    } catch (error) { showNotice(readableError(error)); }
  };

  const cropImage = () => {
    const canvas = canvasRef.current;
    const { x, y, width, height } = cropValue;
    if (!canvas || ![x, y, width, height].every(Number.isSafeInteger) || width < 1 || height < 1 || x < 0 || y < 0 || x + width > canvas.width || y + height > canvas.height) {
      showNotice('裁剪区域超出图片范围。');
      return;
    }
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    source.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, width, height);
    const stamp = editorSnapshotRef.current.imageStamp;
    const image = new window.Image();
    image.onload = () => {
      if (editorSnapshotRef.current.imageStamp !== stamp) return;
      imageSourceRef.current = image;
      setImageModified(true);
      setImageRevision((value) => value + 1);
      setImageRotation(0);
      setImageBrightness(100);
      setImageCaption('');
      showNotice('裁剪已应用');
    };
    image.src = source.toDataURL('image/png');
  };

  const saveImageAs = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const snapshot = editorSnapshotRef.current;
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('无法导出图片。');
      const target = await window.scodex.chooseSaveFile(pathBase(imagePath) + '-edited.png', [{ name: 'PNG 图片', extensions: ['png'] }]);
      if (!target) return;
      if (!/\.png$/i.test(target)) throw new Error('导出PNG需要.png扩展名。');
      await window.scodex.saveBinaryFile(target, new Uint8Array(await blob.arrayBuffer()));
      if (editorSnapshotRef.current.imageStamp === snapshot.imageStamp) await loadImageFile(target, { discard: true });
      showNotice('图片已导出为PNG');
    } catch (error) { showNotice(readableError(error)); }
  };

  const openTableFromDialog = async () => {
    try {
      const filePath = await window.scodex.chooseFile(TABLE_FILTERS);
      if (filePath) await loadTableFile(filePath);
    } catch (error) { showNotice(readableError(error)); }
  };

  const normalizeCellValue = (cell) => {
    if (cell.formula) return `=${cell.formula}`;
    if (cell.value && typeof cell.value === 'object') {
      if ('text' in cell.value) return String(cell.value.text ?? '');
      if ('richText' in cell.value) return cell.value.richText.map((part) => part.text).join('');
      if ('hyperlink' in cell.value) return String(cell.value.text || cell.value.hyperlink);
      return '';
    }
    return cell.value == null ? '' : String(cell.value);
  };

  const loadTableFile = async (filePath, { background = false } = {}) => {
    const snapshot = editorSnapshotRef.current;
    if (background && (snapshot.tableDirty || snapshot.tablePath?.toLowerCase() !== filePath.toLowerCase())) return;
    if (!background && tableDirty && !window.confirm('表格有未保存修改，放弃并打开另一个表格？')) return;
    const token = ++tableLoadTokenRef.current;
    try {
      const file = await window.scodex.readBinaryFile(filePath);
      const kind = filePath.toLowerCase().endsWith('.csv') || filePath.toLowerCase().endsWith('.tsv') ? 'csv' : 'xlsx';
      let sheets, loadedWorkbook = null;
      if (kind === 'csv') {
        const text = new TextDecoder('utf-8').decode(file.content);
        const rows = parseCsv(text, file.path.toLowerCase().endsWith('.tsv') ? '\t' : ',');
        sheets = [{ name: pathBase(filePath), rows, rowCount: rows.length, columnCount: Math.max(1, ...rows.map((row) => row.length)) }];
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(new Uint8Array(file.content));
        loadedWorkbook = workbook;
        sheets = workbook.worksheets.map((sheet) => {
          const rowCount = Math.max(sheet.rowCount, 1);
          const columnCount = Math.max(sheet.columnCount, 1);
          const rows = [];
          for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
            const values = [];
            for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) values.push(normalizeCellValue(sheet.getCell(rowIndex, columnIndex)));
            rows.push(values);
          }
          return { name: sheet.name, rows, rowCount, columnCount };
        });
      }
      const latest = editorSnapshotRef.current;
      if (tableLoadTokenRef.current !== token || latest.tablePath !== snapshot.tablePath || latest.tableSheets !== snapshot.tableSheets || latest.tableDirty !== snapshot.tableDirty) return;
      workbookRef.current = loadedWorkbook;
      setTablePath(file.path);
      setTableKind(kind);
      setTableSheets(sheets);
      setActiveSheetIndex(0);
      setTableDirty(false);
      if (!background) setActiveView('tables');
    } catch (error) { showNotice(readableError(error)); }
  };

  tableLoaderRef.current = loadTableFile;

  const requestTableHelp = () => {
    if (!canShareContext) { showNotice('请先允许项目访问，再启用 AI 表格处理'); return; }
    if (tableDirty) { showNotice('请先保存表格，再让 AI 读取和修改'); return; }
    updateChat((chat) => ({ executionEnabled: true, draft: chat.draft || (tablePath ? '请先读取项目表格 ' + tablePath + '，然后按我的要求修改：' : '请在当前项目中新建一个 Excel 表格：') }));
    navigateView('assistant');
  };

  const setCellValue = (rowIndex, columnIndex, value) => {
    if (!currentSheet) return;
    setTableSheets((sheets) => sheets.map((sheet, sheetIndex) => {
      if (sheetIndex !== activeSheetIndex) return sheet;
      const rows = sheet.rows.map((row) => [...row]);
      while (rows.length <= rowIndex) rows.push(Array(sheet.columnCount).fill(''));
      while (rows[rowIndex].length <= columnIndex) rows[rowIndex].push('');
      rows[rowIndex][columnIndex] = value;
      return { ...sheet, rows, rowCount: Math.max(sheet.rowCount, rows.length), columnCount: Math.max(sheet.columnCount, columnIndex + 1) };
    }));
    if (workbookRef.current && tableKind === 'xlsx') {
      const cell = workbookRef.current.worksheets[activeSheetIndex].getCell(rowIndex + 1, columnIndex + 1);
      if (typeof value === 'string' && value.startsWith('=')) cell.value = { formula: value.slice(1) };
      else if (value === '') cell.value = null;
      else if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())) cell.value = Number(value);
      else cell.value = value;
    }
    setTableDirty(true);
  };

  const saveTable = async () => {
    if (!currentSheet) return;
    try {
      const target = tablePath || await window.scodex.chooseSaveFile(tableKind === 'xlsx' ? 'table.xlsx' : 'table.csv', tableKind === 'xlsx' ? [{ name: 'Excel 工作簿', extensions: ['xlsx'] }] : [{ name: 'CSV / TSV', extensions: ['csv', 'tsv'] }]);
      if (!target) return;
      if (tableKind === 'xlsx' ? !/\.xlsx$/i.test(target) : !/\.(csv|tsv)$/i.test(target)) throw new Error('文件扩展名需要与当前表格格式一致。');
      if (tableKind === 'csv') {
        const delimiter = target.toLowerCase().endsWith('.tsv') ? '\t' : ',';
        await window.scodex.saveTextFile(target, stringifyCsv(currentSheet.rows, delimiter));
      } else {
        const buffer = await workbookRef.current.xlsx.writeBuffer();
        await window.scodex.saveBinaryFile(target, new Uint8Array(buffer));
      }
      setTablePath(target);
      setTableDirty(false);
      showNotice('表格已保存');
    } catch (error) { showNotice(readableError(error)); }
  };

  const addTableRow = () => {
    if (!currentSheet) return;
    const rows = [...currentSheet.rows, Array(currentSheet.columnCount).fill('')];
    setTableSheets((sheets) => sheets.map((sheet, index) => index === activeSheetIndex ? { ...sheet, rows, rowCount: rows.length } : sheet));
    if (workbookRef.current && tableKind === 'xlsx') workbookRef.current.worksheets[activeSheetIndex].addRow(Array(currentSheet.columnCount).fill(''));
    setTableDirty(true);
  };

  const addTableColumn = () => {
    if (!currentSheet) return;
    const rows = currentSheet.rows.map((row) => [...row, '']);
    setTableSheets((sheets) => sheets.map((sheet, index) => index === activeSheetIndex ? { ...sheet, rows, columnCount: sheet.columnCount + 1 } : sheet));
    if (workbookRef.current && tableKind === 'xlsx') workbookRef.current.worksheets[activeSheetIndex].getColumn(currentSheet.columnCount + 1).values = [];
    setTableDirty(true);
  };

  const addTableSheet = () => {
    if (!workbookRef.current) {
      showNotice('CSV 只有一个工作表；可新建 XLSX 工作簿使用多工作表。');
      return;
    }
    const name = `Sheet ${workbookRef.current.worksheets.length + 1}`;
    const sheet = workbookRef.current.addWorksheet(name);
    sheet.addRow(['']);
    const rows = workbookRef.current.worksheets.map((item) => {
      const rowCount = Math.max(item.rowCount, 1);
      const columnCount = Math.max(item.columnCount, 1);
      return { name: item.name, rowCount, columnCount, rows: Array.from({ length: rowCount }, (_, r) => Array.from({ length: columnCount }, (_, c) => normalizeCellValue(item.getCell(r + 1, c + 1)))) };
    });
    setTableSheets(rows);
    setActiveSheetIndex(rows.length - 1);
    setTableDirty(true);
  };

  const selectSkill = (skill) => {
    if (!enabledSkills.some((item) => item.id === skill?.id)) { showNotice('此技能已停用，请在插件设置中启用'); return false; }
    if (!canShareContext) { showNotice('当前为仅对话权限，请先通过输入框左下角更改权限'); return false; }
    setActiveSkill((current) => current?.id === skill.id ? null : skill);
    showNotice(activeSkill?.id === skill.id ? '已取消本轮技能' : `本轮已选择：${skill.name}`);
    return true;
  };

  const attachFilePath = async (requestedPath) => {
    if (!canShareContext) { showNotice('仅对话权限下不能附加本机内容'); return false; }
    const filePath = requestedPath || await window.scodex.chooseFile(CODE_FILTERS);
    if (!filePath) return false;
    if (/\.(png|jpe?g|webp|bmp|gif|ico|pdf|docx?|xlsx?|pptx?|zip|7z|rar|exe|dll)$/i.test(filePath)) throw new Error('此处附加文本或代码文件；图片和表格请使用对应工具，PDF 等二进制文件暂不支持作为文本附件。');
    const file = activeFile === filePath ? { path: activeFile, content: editorValue } : await window.scodex.readTextFile(filePath);
    if (file.content.includes('\u0000')) throw new Error('该文件不是可直接附加的 UTF-8 文本。');
    setFileContext({ path: file.path, content: truncateUtf8(file.content, 128 * 1024) });
    setActiveView('assistant');
    showNotice('文件内容仅在发送时提交给当前模型');
    return true;
  };

  const addFileContext = async () => {
    try {
      await attachFilePath(activeFile);
    } catch (error) { showNotice(readableError(error)); }
  };

  const addTableContext = () => {
    if (!canShareContext) { showNotice('仅对话权限下不能附加表格内容'); return; }
    if (!currentSheet) return;
    const rows = currentSheet.rows.slice(0, 200).map((row) => row.slice(0, 50));
    const content = `工作表：${currentSheet.name}；原表 ${currentSheet.rowCount} 行 × ${currentSheet.columnCount} 列。\n以下为当前编辑状态的快照（最多 200 行 × 50 列，超出部分未附加）：\n${stringifyCsv(rows)}`;
    setFileContext({ path: tablePath || '未保存表格.csv', content: truncateUtf8(content, 128 * 1024), kind: 'table' });
    setActiveView('assistant');
    setSendMode('office');
    showNotice('表格快照已附加，发送消息时才提交给模型');
  };

  const addFolderContext = async (folder) => {
    if (!canShareContext) return false;
    const current = await window.scodex.listDirectory(folder.directory);
    const items = current.items.slice(0, 300);
    const content = `文件夹：${current.directory}\n仅附加当前层级的目录清单，不包含文件正文；最多 300 项。\n${items.map((item) => `${item.directory ? '[文件夹]' : '[文件]'} ${item.name}`).join('\n')}`;
    setFileContext({ path: current.directory, kind: 'folder', content: truncateUtf8(content, 128 * 1024) });
    setActiveView('assistant');
    showNotice('文件夹目录清单已附加，未读取文件正文');
    return true;
  };

  const addWorkbenchContext = () => {
    if (!canShareContext) return false;
    const content = [
      'Scodex 工作台状态快照（仅包含状态信息，不包含文件正文或其他对话）：',
      `工作区：${workspaceRoot}`, `当前目录：${currentDirectory || workspaceRoot}`,
      `工作模式：${workMode(sendMode).label}`, `编辑文件：${activeFile || '无'}${fileDirty ? '（尚未保存）' : ''}`,
      `表格：${tablePath || '无已保存表格'}${currentSheet ? `；${currentSheet.name}，${currentSheet.rowCount} 行 × ${currentSheet.columnCount} 列` : ''}`,
      `图片：${imagePath || '无'}`,
    ].join('\n');
    setFileContext({ path: 'Scodex 工作台', kind: 'workbench', content: truncateUtf8(content, 128 * 1024) });
    setActiveView('assistant');
    showNotice('工作台状态已附加，发送消息时才提交给模型');
    return true;
  };

  const prepareContextTarget = async (kind, id) => {
    if (!canShareContext) throw Error('当前为仅对话权限，请先更改权限。');
    if (storageBusyRef.current || attachmentLoading || attachmentReading.current) throw Error('请等待当前附件或存储操作完成。');
    const current = libraryRef.current;
    const chat = kind === 'chat' ? current?.conversations.find((item) => item.id === id) : null;
    const project = kind === 'project' ? appState?.projects?.find((item) => item.id === id)
      : appState?.projects?.find((item) => item.id === chat?.projectId);
    if (kind === 'chat' && (!chat || chat.archivedAt)) throw Error('请先恢复已归档或已删除的聊天。');
    if (kind === 'project' && (!project || project.archivedAt)) throw Error('请先恢复已归档或已删除的项目。');
    if (project?.archivedAt) throw Error('请先恢复聊天所属项目。');
    if (chat && [...activeRequestsRef.current.values()].some((request) => request.conversationId === chat.id)) throw Error('请先停止此聊天任务，再附加内容。');

    let selectedProjectId = appState?.activeProjectId;
    if (project && project.id !== appState?.activeProjectId) {
      if ((fileDirty || tableDirty || imageDirty) && !window.confirm('当前项目有未保存编辑。切换项目会清空编辑内容，是否继续？')) throw Error('已取消项目切换。');
      const state = await window.scodex.selectProject(project.id);
      if (state.activeProjectId !== project.id) throw Error('目标项目切换未完成。');
      selectedProjectId = state.activeProjectId;
      await applyProjectState(state);
    }
    if (chat && libraryRef.current?.activeId !== chat.id) {
      setLibrary((currentLibrary) => currentLibrary ? ({ ...currentLibrary, activeId: chat.id,
        conversations: currentLibrary.conversations.map((item) => item.id === chat.id ? { ...item, unreadResult: false } : item) }) : currentLibrary);
    }
    setActiveView('assistant');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const activeChat = libraryRef.current?.conversations.find((item) => item.id === libraryRef.current.activeId);
    const targetProjectId = chat?.projectId || project?.id || '';
    if (kind === 'chat' && activeChat?.id !== id) throw Error('目标聊天切换未完成。');
    if (project && selectedProjectId !== project.id) throw Error('目标项目切换未完成。');
    return { chat: kind === 'chat' ? chat : activeChat, project: appState?.projects?.find((item) => item.id === targetProjectId) || project || null };
  };

  const attachSelectedFile = async (filters) => {
    const filePath = await window.scodex.chooseFile(filters);
    if (!filePath) return false;
    const selected = await window.scodex.readBinaryFile(filePath);
    const name = filePath.split(/[\\/]/).pop() || 'attachment';
    const file = new File([selected.content], name, { type: chatAttachmentMimeType(name) });
    await attachChatFiles([file]);
    return true;
  };

  const changeContextPermission = async (value) => {
    const saved = await savePreferences({ contextAccess: value });
    if (!saved) return false;
    if (saved.contextAccess === 'chat-only') { setFileContext(null); setImageAttachments([]); setActiveSkill(null); }
    showNotice(saved.contextAccess === 'chat-only' ? '已切换为仅对话，不提交本机附件或技能' : '已切换为完全访问，可选择本机内容');
  };

  const attachChatImages = async (files) => {
    return attachChatFiles(files);
  };

  const attachChatFiles = async (files) => {
    if (!canShareContext) { showNotice('当前为仅对话权限，请先更改权限'); return; }
    const targetId = libraryRef.current?.activeId;
    if (storageBusyRef.current || attachmentReading.current || [...activeRequestsRef.current.values()].some((request) => request.conversationId === targetId)) { showNotice('请等待当前操作完成后再添加文件'); return; }
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const composer = composerSnapshotRef.current?.id === libraryRef.current?.activeId ? composerSnapshotRef.current.value : null;
    const currentAttachments = composer?.attachments || attachments;
    const currentImages = composer?.imageAttachments || imageAttachments;
    const generation = attachmentGeneration.current;
    attachmentReading.current = true; setAttachmentLoading(true);
    try {
      const imageFiles = selected.filter((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type));
      const otherFiles = selected.filter((file) => !imageFiles.includes(file));
      if (currentAttachments.length + otherFiles.length > 10) throw new Error('每条消息最多附加 10 个文件和 4 张图片。');
      if (currentImages.length + imageFiles.length > MAX_CHAT_IMAGES) throw new Error('每条消息最多附加 4 张图片。');
      if (otherFiles.some((file) => file.size > 8 * 1024 * 1024)) throw new Error('单个文件不能超过 8 MB。');
      if (currentAttachments.reduce((sum, item) => sum + item.size, 0) + otherFiles.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024) throw new Error('本条消息的附件总量不能超过 20 MB。');
      const preparedImages = await prepareChatImages(imageFiles, currentImages);
      const buffers = await Promise.all(otherFiles.map(async (file) => ({ name: file.name, mimeType: file.type, data: new Uint8Array(await file.arrayBuffer()) })));
      const preparedFiles = buffers.length ? await window.scodex.prepareChatAttachments(buffers, currentAttachments) : [];
      if (generation !== attachmentGeneration.current) return;
      setImageAttachments((current) => [...current, ...preparedImages]);
      setAttachments((current) => [...current, ...preparedFiles]);
      const unparsed = preparedFiles.filter((item) => !item.parsed);
      if (unparsed.length) showNotice(`${unparsed.length} 个附件未能提取正文：${unparsed[0].parseMessage || '请查看附件提示'}`);
      else if (preparedFiles.some((item) => item.truncated)) showNotice('正文已提取；超出 128 KiB 的部分将在发送时截断');
    } catch (error) { if (generation === attachmentGeneration.current) showNotice(readableError(error)); }
    finally { attachmentReading.current = false; setAttachmentLoading(false); }
  };

  const fileDrag = (event, type) => {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault(); event.stopPropagation();
    if (type === 'enter') { dragDepth.current++; setFileDragActive(true); }
    if (type === 'over') event.dataTransfer.dropEffect = canShareContext && !sending && !attachmentLoading ? 'copy' : 'none';
    if (type === 'leave') { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setFileDragActive(false); }
    if (type === 'drop') { dragDepth.current = 0; setFileDragActive(false); attachChatFiles(event.dataTransfer.files); }
  };

  const sendMessage = async (message = prompt, retryContent = null, targetId = null, revisionAction = null, handoff = null) => {
    const detached = Boolean(targetId);
    const targetChat = libraryRef.current?.conversations.find(c=>c.id === (targetId || libraryRef.current.activeId));
    if (!targetChat || targetChat.archivedAt) throw Error('聊天不可用，请先恢复归档。');
    if (handoff) {
      const prepared = prepareTaskHandoff(libraryRef.current, appState?.projects || [], [...activeRequestsRef.current.values()].map(r => r.conversationId), handoff);
      if (prepared.target.id !== targetId) throw Error('交接目标不匹配。');
      if (handoff.executionEnabled && !canShareContext) throw Error('当前权限不允许目标使用项目工具。');
      const activeBufferKey = targetId === libraryRef.current.activeId ? composerSnapshotRef.current?.scope + '\0' + targetId : '';
      const buffers = [...composerBuffersRef.current.entries()].filter(([key]) => key.endsWith('\0' + targetId) && key !== activeBufferKey).map(([, value]) => value);
      if (targetId === libraryRef.current.activeId) buffers.push({ imageAttachments, attachments, fileContext });
      if (buffers.some(value => value.imageAttachments?.length || value.attachments?.length || value.fileContext)) throw Error('目标输入栏有待发送附件或文件上下文，请先处理。');
      if (handoff.settings.projectId !== targetChat.projectId) throw Error('目标项目已变化，请重新确认。');
      message = prepared.prompt;
    }
    const revisionPlan = revisionAction ? prepareRevision(targetChat, revisionAction) : null;
    if (revisionAction?.executionEnabled && !canShareContext) throw Error('请先启用项目访问权限。');
    if (revisionPlan) retryContent = revisionPlan.user;
    const targetMessages = revisionPlan ? revisionPlan.chat.messages : targetChat.messages || [];
    const text = revisionPlan ? revisionPlan.user.content : String(message || '').trim();
    const outgoingImages = retryContent?.images || (detached ? [] : imageAttachments);
    const outgoingAttachments = retryContent?.attachments || (detached ? [] : attachments);
    const requestModel = retryContent?.model && availableModels.includes(retryContent.model) ? retryContent.model : availableModels.includes(targetChat.model) ? targetChat.model : appState?.connection?.model || availableModels[0];
    const requestEffort = handoff ? (handoff.settings.availableReasoningEfforts.includes(targetChat.reasoningEffort) ? targetChat.reasoningEffort : handoff.settings.defaultReasoningEffort)
      : retryContent?.reasoningEffort && availableReasoningEfforts.includes(retryContent.reasoningEffort)
      ? retryContent.reasoningEffort : availableReasoningEfforts.includes(targetChat.reasoningEffort) ? targetChat.reasoningEffort : agentSettings.defaultReasoningEffort;
    if ((!text && !outgoingImages.length && !outgoingAttachments.length) || attachmentReading.current || storageBusyRef.current || !targetChat) { if (detached) throw Error('工作台正在处理附件或聊天存储，请稍候。'); return; }
    if ([...activeRequestsRef.current.values()].some((request) => request.conversationId === targetChat.id)) { if (detached) throw Error('此聊天仍在运行。'); return; }
    if (activeRequestsRef.current.size >= 3) { if (detached) throw Error('最多同时运行 3 个聊天任务，请等待或停止其中一项。'); showNotice('最多同时运行 3 个聊天任务，请等待或停止其中一项。'); return; }
    if (!canShareContext && (outgoingImages.length || outgoingAttachments.length)) { if (revisionAction) throw Error('当前为仅对话权限，请先更改权限再重试附件'); showNotice('当前为仅对话权限，请先更改权限再重试附件'); return; }
    // Infer each message mode unless the composer menu sets a one-shot override.
    const requestMode = retryContent?.mode || (!detached && pendingModeOverride?.conversationId === targetChat?.id ? pendingModeOverride.mode : inferWorkMode(text, Boolean(!detached && fileContext || outgoingImages.length || outgoingAttachments.length)));
    const automaticSkill = findAutomaticSkill(text, enabledSkills);
    let context = canShareContext && !detached ? fileContext : null;
    if (!detached && canShareContext && requestMode === 'code' && activeFile && !context && !targetChat.executionEnabled) {
      window.scodex.notify('permission').catch(() => {});
      if (window.confirm(`将当前文件“${activeFile.split(/[\\/]/).pop()}”的内容发送给 Grok，作为修改上下文？`)) {
        context = { path: activeFile, content: truncateUtf8(editorValue, 128 * 1024) };
      }
    }
    const executionEnabled = canShareContext && (handoff ? handoff.executionEnabled === true : (retryContent?.executionEnabled ?? targetChat.executionEnabled) === true);
    const requestId = window.crypto.randomUUID();
    const retrySkill = retryContent?.skillId ? enabledSkills.find((item) => item.id === retryContent.skillId) : null;
    const outgoingSkill = canShareContext ? retrySkill || (!detached ? activeSkill : null) || automaticSkill : null;
    if (!retryContent) {
      if (!detached) setPendingModeOverride(null);
      if (targetChat.mode !== requestMode) updateChat(() => ({ mode: requestMode }), targetChat.id);
    }
    const userEntry = { id: `${requestId}-user`, role: 'user', content: text, executionEnabled, model: requestModel, reasoningEffort: requestEffort, ...(outgoingImages.length ? { images: outgoingImages } : {}), ...(outgoingAttachments.length ? { attachments: outgoingAttachments } : {}), skillName: outgoingSkill?.name || '', skillId: outgoingSkill?.id || '', mode: requestMode, contextName: context?.path.split(/[\\/]/).pop() || '' };
    const assistantEntry = { id: requestId, role: 'assistant', executionEnabled, model: requestModel, content: '', pending: true, startedAt: Date.now() };
    if (revisionPlan) updateChat(() => ({ ...revisionPlan.chat, messages: [...targetMessages, userEntry, assistantEntry] }), targetChat.id);
    else setMessages((current) => retryContent ? [...current.filter((item) => item.id !== retryContent.userId && item.id !== retryContent.assistantId), userEntry, assistantEntry] : [...current, userEntry, assistantEntry], targetChat.id);
    if (!revisionPlan) updateChat(() => ({ draft: '' }), targetChat.id);
    if (!detached) { setImageAttachments([]); setAttachments([]); setFileContext(null); }
    const requestProjectId = targetChat.projectId || appState?.activeProjectId || '';
    activeRequestsRef.current.set(requestId, { requestId, conversationId: targetChat.id, projectId: requestProjectId });
    setLiveRequests([...activeRequestsRef.current.values()]);
    const dispatch = async () => { try {
      const retryIndex = revisionPlan ? targetMessages.length : retryContent ? targetMessages.findIndex((item) => item.id === retryContent.userId) : targetMessages.length;
      const history = targetMessages.slice(0, retryIndex).filter((item) => (item.role === 'user' || item.role === 'assistant') && (item.content || item.images?.length || item.attachments?.length || item.operations?.length) && ((!item.error && !item.cancelled) || item.operations?.length))
        .slice(-20).map((item) => ({ role: item.role, content: item.content + (executionEnabled && item.operations?.length ? '\n\n[本机实际操作记录]\n' + item.operations.map((operation) => [operation.name, operation.status, operation.detail || '', operation.output?.slice(-1000) || ''].join(' · ')).join('\n').slice(-6000) : ''), ...(canShareContext ? { images: item.images, attachments: item.attachments } : {}) }));
      await window.scodex.updateDirtyPaths([...(fileDirty && activeFile ? [activeFile] : []), ...(tableDirty && tablePath ? [tablePath] : []), ...(imageDirty && imagePath ? [imagePath] : [])]);
      await window.scodex.sendMessage({
        requestId,
        conversationId: targetChat.id,
        projectId: requestProjectId,
        executionEnabled,
        ...(handoff ? { requestKind: 'collaboration' } : {}),
        mode: requestMode,
        goal: targetChat.goal || '',
        reasoningEffort: requestEffort,
        model: requestModel,
        prompt: [text || (outgoingImages.length ? '请描述这些图片。' : outgoingAttachments.length ? '请查看这些附件。' : ''), requestMode === 'code' ? `${executionEnabled ? '请直接在项目中完成文件修改并验证。' : '请在代码围栏中提供完整内容。'}${canShareContext && !detached ? `当前编辑文件：${activeFile || '无'}。` : ''}` : ''].filter(Boolean).join('\n\n'),
        messages: history,
        skill: outgoingSkill?.content || '',
        skillId: outgoingSkill?.id || '',
        fileContext: context ? `文件：${context.path}\n（最多附加 128 KB UTF-8 内容）\n${context.content}` : '',
        images: outgoingImages,
        attachments: outgoingAttachments,
      });
    } catch (error) {
      if (activeRequestsRef.current.has(requestId)) {
        finishRequest(requestId);
        setMessages((items) => items.map((item) => item.id === requestId ? { ...item, pending: false, approval: null, error: readableError(error), ...settledTiming(item) } : item), targetChat.id);
      }
    } };
    if (handoff) {
      try {
        await window.scodex.saveHistory(libraryRef.current);
        if (handoff.authorize && !await handoff.authorize()) throw Error('来源请求已停止，交接未运行。');
      } catch (error) {
        finishRequest(requestId);
        setMessages(items => items.map(item => item.id === requestId ? { ...item, pending: false, error: readableError(error), ...settledTiming(item) } : item), targetChat.id);
        throw error;
      }
      dispatch();
      return { submitted: true, requestId, conversationId: targetChat.id, note: '交接已保存并提交，运行结果须读取目标任务确认；停止来源不会撤回已提交的交接。' };
    }
    const completion = dispatch();
    if (revisionPlan) return { started: true, revisionId: revisionPlan.chat.revisionId };
    await completion;
  };

  collaborationActionRef.current = async ({ action, input, id }, fromModel = false) => {
    if (!libraryRef.current || storageBusyRef.current || appState?.historyError) throw Error('聊天存储尚未就绪。');
    if (fromModel && !canShareContext) throw Error('当前为仅对话权限，跨任务工具访问已停止。');
    const source = libraryRef.current.conversations.find(c => c.id === input.sourceId);
    const project = appState?.projects?.find(p => p.id === source?.projectId);
    if (!source || source.archivedAt || source.projectId && (!project || project.archivedAt)) throw Error('来源任务或项目不可用。');
    const runningIds = [...activeRequestsRef.current.values()].map(r => r.conversationId);
    if (action === 'list') return listTasks(libraryRef.current, appState.projects, runningIds, input);
    if (action === 'read') return readTask(libraryRef.current, appState.projects, runningIds, input);
    if (action !== 'send') throw Error('不支持此协作操作。');
    if (settingsDialogOpen || actionDialog || projectDialogOpen || revisionEditor || attachmentReading.current) throw Error('请先完成设置、编辑或附件处理后再发送交接。');
    const settings = await window.scodex.getCollaborationSettings(input.conversationId);
    return sendMessage(input.text, null, input.conversationId, null, { ...input, settings, ...(fromModel ? { authorize: () => window.scodex.claimCollaboration(id) } : {}) });
  };
  useEffect(() => window.scodex.onCollaborationRequest(async request => {
    try { const result = await collaborationActionRef.current(request, true); await window.scodex.completeCollaboration({ id: request.id, ok: true, result }); }
    catch (error) { window.scodex.completeCollaboration({ id: request.id, ok: false, error: readableError(error) }).catch(() => {}); }
  }), []);

  const chooseConversationVersion = (versionId, stamp, id = libraryRef.current.activeId) => {
    if (storageBusyRef.current) throw Error('聊天存储正在处理，请稍候。');
    if ([...activeRequestsRef.current.values()].some(r => r.conversationId === id)) throw Error('请先停止此聊天任务。');
    const chat = libraryRef.current.conversations.find(c => c.id === id);
    if (!chat) throw Error('聊天已不存在。');
    updateChat(() => selectRevision(chat, versionId, stamp), id); return true;
  };
  const openMessageRevision = (kind, messageId) => {
    try { const chat = libraryRef.current.conversations.find(c => c.id === libraryRef.current.activeId);
      if ([...activeRequestsRef.current.values()].some(r => r.conversationId === chat?.id)) throw Error('请先停止此聊天任务。');
      setRevisionEditor({ kind, messageId, conversationId: chat.id, stamp: revisionStamp(chat), source: structuredClone(revisionSource(chat, kind, messageId).user) });
    } catch (e) { showNotice(readableError(e)); }
  };
  useEffect(() => { setRevisionEditor(null); }, [currentChat?.id, appState?.activeProjectId]);

  const cancelRequest = async (requestId = activeRequestId) => {
    if (!activeRequestsRef.current.has(requestId)) return;
    await window.scodex.cancelMessage(requestId).catch((error) => showNotice(readableError(error)));
  };

  useEffect(() => {
    const off = window.scodex.onWorkspaceWindowSubscriptions(setWindowSubscriptions);
    window.scodex.getWorkspaceWindowSubscriptions().then(setWindowSubscriptions).catch(error=>showNotice(readableError(error)));
    const offAction = window.scodex.onWorkspaceWindowAction(async request => {
      try { const value = await windowActionRef.current(request); await window.scodex.completeWorkspaceWindowAction({ requestId:request.requestId, value }); }
      catch(error) { await window.scodex.completeWorkspaceWindowAction({ requestId:request.requestId, error:readableError(error) }).catch(()=>{}); }
    });
    return () => { off(); offAction(); };
  }, [showNotice]);
  useEffect(() => {
    if (!library || !appState || !windowSubscriptions.length) return;
    const snapshots = windowSubscriptions.map(subscription => {
      const record = subscription.kind === 'chat' ? library.conversations.find(c=>c.id===subscription.id) : appState.projects?.find(p=>p.id===subscription.id);
      const project = subscription.kind === 'project' ? record : appState.projects?.find(p=>p.id===record?.projectId);
      return { windowId:subscription.windowId, snapshot:{ kind:subscription.kind,id:subscription.id,available:Boolean(record), title:record?.title||record?.name||'已删除',
        project:project?{id:project.id,name:project.name,path:project.path,archivedAt:project.archivedAt}:null,
        ...(subscription.kind==='chat'?{chat:record||null}:{chats:library.conversations.filter(c=>c.projectId===subscription.id).map(c=>({id:c.id,title:c.title,archivedAt:c.archivedAt,unreadResult:c.unreadResult,running:liveRequests.some(r=>r.conversationId===c.id)}))}),
        model:appState.model, preferences:{fontSize:Math.max(16,preferences.fontSize||16),themeMode:resolvedTheme}, canExecute:canShareContext } };
    });
    window.scodex.publishWorkspaceWindows(snapshots).catch(error=>showNotice(readableError(error)));
  }, [library, appState, windowSubscriptions, liveRequests, preferences.fontSize, resolvedTheme, canShareContext, showNotice]);
  windowActionRef.current = async ({kind,id,action}) => {
    if (storageBusyRef.current || settingsDialogOpen || actionDialog || projectDialogOpen) throw Error('主工作台正在处理设置或存储，请稍候。');
    const chat = kind==='chat' ? libraryRef.current?.conversations.find(c=>c.id===id) : null;
    const project = appState?.projects?.find(p=>p.id===(kind==='project'?id:chat?.projectId));
    if (kind==='chat'&&!chat || kind==='project'&&!project) throw Error('项目或聊天已不存在。');
    if (['send','draft','execution','new-chat','revise','revision'].includes(action.type) && (chat?.archivedAt||project?.archivedAt)) throw Error('请先恢复已归档的项目或聊天。');
    const switchProject = async () => {
      if (!project || project.id===appState.activeProjectId) return;
      if ((fileDirty||tableDirty||imageDirty) && !window.confirm('有未保存编辑。切换到此项目会清空编辑内容，是否继续？')) throw Error('已取消项目切换。');
      await applyProjectState(await window.scodex.selectProject(project.id));
    };
    if (action.type==='send') return sendMessage(action.text,null,id);
    if (action.type==='revise') return sendMessage('',null,id,action);
    if (action.type==='revision') return chooseConversationVersion(action.versionId,action.stamp,id);
    if (action.type==='draft') { updateChat(()=>({draft:action.text}),id); return true; }
    if (action.type==='execution') {
      if (!canShareContext) throw Error('请先在主工作台启用项目访问权限。');
      if ([...activeRequestsRef.current.values()].some(r=>r.conversationId===id)) throw Error('请先停止此聊天任务。');
      updateChat(c=>({executionEnabled:!c.executionEnabled}),id); return true;
    }
    if (action.type==='stop') {
      const request=[...activeRequestsRef.current.values()].find(r=>r.conversationId===id);
      if (!request) throw Error('此任务已结束。');
      return window.scodex.cancelMessage(request.requestId);
    }
    if (action.type==='approval') {
      const message=chat?.messages.find(m=>m.approval?.id===action.approvalId);
      if (!message||!activeRequestsRef.current.has(message.id)) throw Error('此审批已结束或变化。');
      return window.scodex.approveAgentCommand(action.approvalId,action.allowed);
    }
    if (action.type==='focus'||action.type==='file') {
      await switchProject();
      if (chat&&!chat.archivedAt) selectConversation(id); else navigateView('assistant');
      if(action.type==='file') {
        if(!chat?.messages.some(m=>m.operations?.some(o=>o.path===action.path))) throw Error('此文件不在操作记录中。');
        await openWorkspaceFile(action.path);
      }
      return true;
    }
    if(action.type==='new-chat') {
      await switchProject();
      const nextChat=newChatRecord(id,preferences.defaultMode);nextChat.reasoningEffort=agentSettings.defaultReasoningEffort;
      const next={...libraryRef.current,conversations:[nextChat,...libraryRef.current.conversations]};
      setLibrary(next);await window.scodex.saveHistory(next);return window.scodex.openWorkspaceWindow('chat',nextChat.id);
    }
    throw Error('此窗口操作不受支持。');
  };
  useEffect(() => {
    const shortcut = event => {
      if (document.querySelector('.task-collaboration-dialog[open]')) return;
      if (!(event.ctrlKey||event.metaKey)||event.isComposing||storageBusyRef.current||actionDialog||settingsDialogOpen||projectDialogOpen||commandOpen||event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      const key=event.key.toLowerCase(), action=event.altKey&&!event.shiftKey&&key==='r'?'rename':event.altKey&&!event.shiftKey&&key==='p'?'pin':!event.altKey&&event.shiftKey&&key==='u'?'unread':!event.altKey&&event.shiftKey&&key==='a'?'archive':null;
      if(!action)return;event.preventDefault();
      const focused=event.target?.closest?.('[data-project-id],[data-chat-id]');
      const target=contextTarget||(focused?.dataset.projectId?{kind:'project',id:focused.dataset.projectId}:{kind:'chat',id:focused?.dataset.chatId||libraryRef.current?.activeId});
      const record=target.kind==='chat'?libraryRef.current?.conversations.find(c=>c.id===target.id):appState?.projects?.find(p=>p.id===target.id);
      if(!record)return;setContextTarget(null);if(focused)actionFocusRef.current=focused;
      performContextAction(action==='archive'&&record.archivedAt?'restore':action,target).catch(error=>showNotice(readableError(error)));
    };
    window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);
  });

  const retryFailed = (assistantMessage) => {
    if (assistantMessage.executionEnabled && assistantMessage.operations?.length) {
      const index = messages.findIndex((item) => item.id === assistantMessage.id);
      const original = messages[index - 1]?.content || '上一个任务';
      sendMessage(`继续未完成的任务：${original}\n先检查已有改动和失败原因，保留已经完成的操作，不要盲目重放命令。`); return;
    }
    const index = messages.findIndex((item) => item.id === assistantMessage.id);
    const userMessage = messages[index - 1];
    if (userMessage?.role === 'user') openMessageRevision('regenerate', assistantMessage.id);
  };

  const applyCodeToEditor = (code) => {
    if (fileDirty && !window.confirm('替换编辑器中的未保存内容？')) return;
    setEditorValue(code);
    setFileDirty(true);
    setActiveView('files');
    showNotice('代码已放入编辑器，保存后写入本机文件');
  };

  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(''), 1200);
    } catch { showNotice('复制失败。'); }
  };

  useEffect(() => {
    const onKey = (event) => {
      if (document.querySelector('.task-collaboration-dialog[open]')) return;
      if (storageBusyRef.current) { if (event.ctrlKey || event.metaKey) event.preventDefault(); return; }
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.isComposing || projectDialogOpen || settingsDialogOpen || actionDialog || contextTarget) return;
      if (event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); setCommandOpen((value) => !value); return; }
      if (commandOpen) return;
      if (event.key === ',') { event.preventDefault(); setSettingsSection({ id: 'general' }); navigateView('settings'); return; }
      if (event.key.toLowerCase() === 'p' && !event.shiftKey) { event.preventDefault(); navigateView('files'); return; }
      if (event.key.toLowerCase() === 'j' && !event.shiftKey) { event.preventDefault(); runToolAction('terminal'); return; }
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); newConversation(); }
      if (event.shiftKey && event.key.toLowerCase() === 'b') { event.preventDefault(); toggleBrowser(); }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (activeView === 'files') saveCodeFile();
        if (activeView === 'tables') saveTable();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const runToolAction = (id) => {
    if (storageBusyRef.current || settingsDialogOpen) return;
    if (id === 'agent-task') {
      navigateView('assistant');
      if (!canShareContext) { showNotice('请先将权限切换为完全访问，再启用执行任务'); return; }
      updateChat(() => ({ executionEnabled: true }));
      document.querySelector('[aria-label=输入工作内容]')?.focus(); return;
    }
    if (id === 'new-chat') { newConversation(); return; }
    if (id === 'reveal-project') { revealWorkspace(); return; }
    if (id.startsWith('setting:')) { setSettingsSection({ id: id.slice(8) }); navigateView('settings'); return; }
    if (id === 'terminal' || id === 'browser' || id === 'services') {
      setPanelRequest({ kind: id, id: window.crypto.randomUUID() });
      savePreferences({ browserPanelOpen: true, browserPanelExpanded: false }); return;
    }
    navigateView(id);
  };
  useEffect(() => window.scodex.onAppCommand((action) => {
    if (action?.error) { showNotice(action.error); return; }
    if (action === 'settings') { setSettingsSection({ id: 'general' }); navigateView('settings'); }
    else if (typeof action === 'string') runToolAction(action);
  }));

  const currentTitle = activeView === 'settings' ? '设置' : NAVIGATION.find((item) => item.id === activeView)?.label || '助手';
  const currentProjectName = appState?.projects?.find((project) => project.id === appState.activeProjectId)?.name
    || displayPath(workspaceRoot).split('/').filter(Boolean).at(-1) || '默认项目';

  return (
    <React.Fragment>
    <div inert={storageBusy || Boolean(actionDialog)} className={'app-shell ' + (railCollapsed ? 'rail-collapsed ' : '') + (browserOpen ? 'has-browser ' : '') + (browserExpanded ? 'browser-expanded ' : '') + (activeView === 'settings' ? 'settings-open ' : '') + (!preferences.showEditorStatusBar ? 'hide-editor-statusbar' : '')} data-theme={resolvedTheme} data-theme-style={preferences.themeStyle} data-custom-background={preferences.backgroundColor ? 'true' : 'false'} data-custom-foreground={preferences.foregroundColor ? 'true' : 'false'} style={{
      '--ui-font-size': preferences.fontSize + 'px',
      '--browser-panel-width': (panelWidth ?? preferences.browserPanelWidth ?? 400) + 'px',
      '--font-step': (preferences.fontSize - 16) + 'px',
      '--ui-font-family': FONT_STACKS[preferences.fontFamily] || FONT_STACKS['Microsoft YaHei'],
      '--accent': preferences.accentColor,
      '--green': preferences.accentColor,
      '--green-hover': `color-mix(in srgb, ${preferences.accentColor} 82%, #000)`,
      '--green-wash': `color-mix(in srgb, ${preferences.accentColor} 12%, ${resolvedTheme === 'dark' ? '#202526' : '#FFFFFF'})`,
      '--ink': preferences.foregroundColor || (resolvedTheme === 'dark' ? '#E5EBE8' : '#1B2825'),
      '--paper': resolvedTheme === 'dark' ? '#202526' : '#FFFFFF',
      '--surface': preferences.backgroundColor || (resolvedTheme === 'dark' ? '#15191A' : '#F5F7F6'),
      '--surface-strong': resolvedTheme === 'dark' ? '#292F30' : '#EDF2EF',
      '--muted': resolvedTheme === 'dark' ? '#B2BDB8' : '#607267',
      '--line': preferences.themeStyle === 'high-contrast' ? (resolvedTheme === 'dark' ? '#7C8883' : '#8B9690') : (resolvedTheme === 'dark' ? '#3B4444' : '#DFE6E3'),
      '--line-strong': preferences.themeStyle === 'high-contrast' ? (resolvedTheme === 'dark' ? '#A4AEA9' : '#65716A') : (resolvedTheme === 'dark' ? '#515B5A' : '#CDD8D3'),
    }}>
      <ActivityRail onCommand={() => setCommandOpen(true)} activeView={activeView} onView={navigateView} browserOpen={browserOpen} onBrowser={toggleBrowser} onReveal={revealWorkspace} canGoBack={!attachmentLoading && !storageBusy && !settingsDialogOpen && Boolean(findLocation(navigation, -1, canVisitLocation))} canGoForward={!attachmentLoading && !storageBusy && !settingsDialogOpen && Boolean(findLocation(navigation, 1, canVisitLocation))} onBack={() => goHistory(-1)} onForward={() => goHistory(1)} />
      <aside className="rail">
        <div className="brand-row">
          <img className="brand-logo" src={workbenchLogo} alt="" />
          {!railCollapsed && <div className="brand-copy"><strong>Scodex</strong><span>工作台</span></div>}
          <button className="icon-button rail-toggle" title={railCollapsed ? '展开侧栏' : '收起侧栏'} aria-label={railCollapsed ? '展开侧栏' : '收起侧栏'} onClick={() => savePreferences({ railCollapsed: !railCollapsed })}>
            {railCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <button className="rail-command-search shell-secondary-entry" title="搜索工具与操作（Ctrl Shift P）" aria-label="搜索工具与操作" onClick={() => setCommandOpen(true)}><Search size={17} /><span>搜索工具与操作</span><kbd>⇧ P</kbd></button>
        <nav className="workbench-primary-nav shell-secondary-entry" aria-label="工作台功能">{NAVIGATION.filter((item) => ['tasks', 'plugins', 'skills', 'tools'].includes(item.id)).map(({ id, label, icon: Icon }) => <button key={id} className={'nav-item ' + (activeView === id ? 'active' : '')} title={label} aria-label={label} aria-current={activeView === id ? 'page' : undefined} onClick={() => navigateView(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
        <div className="rail-section-head project-section-heading"><span>项目</span><button className="icon-button small" aria-label="创建项目" title="创建项目" onClick={() => { setProjectNameDraft(''); setProjectPathDraft(''); setProjectDialogOpen(true); }}><Plus size={15} /></button></div>
        <div className="recent-list project-list" aria-label="项目列表">
          {(appState?.projects || []).filter(p=>Boolean(p.archivedAt)===showArchivedProjects).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||a.name.localeCompare(b.name,'zh-CN')).map((project) => <button key={project.id} data-project-id={project.id} className={'recent-item project-item '+(project.id===appState?.activeProjectId?'active ':'')+(project.archivedAt?'archived':'')}
            onClick={() => { if(project.archivedAt) { showNotice('右键点击可恢复已归档项目'); return; } selectProject(project.id); navigateView('assistant'); }} onContextMenu={e=>openContextMenu(e,'project',project.id)} onKeyDown={e=>contextKeys(e,'project',project.id)} title={project.path} aria-current={project.id===appState?.activeProjectId?'true':undefined}>
            <FolderOpen size={16}/><span>{project.name}</span>{project.pinned&&<Pin size={14}/>} {project.unread&&<i className="chat-unread-dot" aria-label="未读项目"/>}{project.id===appState?.activeProjectId&&<Check size={14}/>}
          </button>)}
          {!(appState?.projects||[]).some(p=>Boolean(p.archivedAt)===showArchivedProjects)&&<div className="rail-empty">{showArchivedProjects?'没有已归档项目':'暂无项目'}</div>}
          {(showArchivedProjects || (appState?.projects || []).some(p => Boolean(p.archivedAt))) && <button className="project-archive-toggle" aria-label={showArchivedProjects?'返回项目列表':'查看已归档项目'} onClick={()=>setShowArchivedProjects(v=>!v)}><Archive size={14}/>{showArchivedProjects?'返回项目':'已归档项目'}</button>}
        </div>

        <ChatRuns requests={liveRequests} conversations={library?.conversations || []} projects={appState?.projects || []} activeId={library?.activeId} collapsed={railCollapsed} onSelect={selectConversation} onStop={cancelRequest} />
        <div className="rail-section-head recent-section-heading"><span>最近</span><button className="icon-button small" aria-label="新建对话" title="新建对话" onClick={newConversation} disabled={attachmentLoading || storageBusy || !library}><Plus size={15} /></button></div>
        <div className="recent-list" aria-label="最近对话">
          {recentConversations.slice(0,12).map(chat=><button key={chat.id} data-chat-id={chat.id} className={'recent-item '+(chat.id===library?.activeId?'active':'')} onClick={()=>selectConversation(chat.id)} onContextMenu={e=>openContextMenu(e,'chat',chat.id)} onKeyDown={e=>contextKeys(e,'chat',chat.id)} title={chat.title} aria-current={chat.id===library?.activeId?'true':undefined}><MessageSquare size={15}/><span>{chat.title}</span>{chat.pinned&&<Pin size={14}/>} {chat.unreadResult&&<i className="chat-unread-dot" title="未读聊天" aria-label="未读聊天"/>}</button>)}
          {!recentConversations.length && <div className="rail-empty">暂无最近对话</div>}
        </div>
        <div className="rail-spacer" />
      </aside>

      <main className="main-panel">
        <header className={'topbar' + (activeView === 'assistant' ? ' task-topbar' : '')}>
          <div className="breadcrumb">{activeView === 'assistant' ? <><FolderOpen size={16} /><strong title={currentChat?.title || currentProjectName}>{messages.length ? currentChat?.title : currentProjectName}</strong></> : <><span>工作台</span><ChevronRight size={14} /><strong>{currentTitle}</strong>{activeFile && activeView === 'files' && <><ChevronRight size={14} /><span className="breadcrumb-file">{activeFile.split(/[\\/]/).pop()}</span>{fileDirty && <i className="dirty-dot" />}</>}</>}</div>
          <div className="topbar-actions">
            <span className={`top-status ${apiState === 'connected' ? 'is-online' : apiState === 'unavailable' ? 'is-warning' : ''}`}><span className="status-dot" />{apiStateLabel(apiState, appState?.hasCredential)}</span>
            <span className={`history-save-state ${historyStatus === 'error' ? 'error' : ''}`} role="status">{historyStatus === 'saved' ? '已保存到本机' : historyStatus === 'error' ? '对话保存异常' : historyStatus === 'saving' ? '正在保存…' : '正在读取…'}</span>
            {activeView === 'assistant' && <><details className="task-more-menu"><summary className="icon-button" aria-label="聊天选项" title="聊天选项"><Ellipsis size={18} /></summary><div><button type="button" onClick={() => navigateView('recent')}><MessageSquare size={15} />最近聊天</button><button type="button" onClick={e => { e.currentTarget.closest('details').open = false; setCollaborationSource(currentChat.id); }} disabled={storageBusy || !currentChat}>任务协作</button><button type="button" onClick={() => navigator.clipboard.writeText(currentChat?.title || '').then(() => showNotice('聊天标题已复制')).catch(() => showNotice('复制失败'))}><Clipboard size={15} />复制聊天标题</button></div></details><button type="button" className="icon-button" aria-label="聊天设置" title="模型与工作台设置" onClick={() => navigateView('settings')}><SlidersHorizontal size={17} /></button><button type="button" className="icon-button" aria-label="新聊天" title="新聊天" disabled={attachmentLoading || storageBusy || !library} onClick={newConversation}><SquarePlus size={17} /></button></>}
            <button className="icon-button browser-toggle" title={browserOpen ? '隐藏标签工作台' : '展开标签工作台'} aria-label={browserOpen ? '隐藏第三工作台' : '打开第三工作台'} aria-pressed={browserOpen} onClick={toggleBrowser}><PanelRightOpen size={20} /></button>
          </div>
        </header>

        {activeView === 'assistant' && (
          <section className={`assistant-view task-chat-view ${messages.length === 0 ? 'assistant-view-empty' : ''}`} onDragEnter={(event) => fileDrag(event, 'enter')} onDragOver={(event) => fileDrag(event, 'over')} onDragLeave={(event) => fileDrag(event, 'leave')} onDrop={(event) => fileDrag(event, 'drop')}>
            {fileDragActive && <div className="chat-file-drop-overlay" role="status"><div><Files size={36} /><strong>{!canShareContext ? '请先更改权限' : sending || attachmentLoading ? '请等待当前操作完成' : '松开即可添加'}</strong><span>文件将添加到当前消息</span></div></div>}
            <ConversationVersions chat={currentChat} disabled={sending || storageBusy || attachmentLoading} onSelect={(id, stamp) => { try { chooseConversationVersion(id, stamp); } catch (e) { showNotice(readableError(e)); } }}/>
            {revisionEditor && revisionEditor.conversationId === currentChat?.id && <MessageRevisionDialog chat={currentChat} request={revisionEditor} canExecute={canShareContext} onClose={() => setRevisionEditor(null)} onSubmit={action => sendMessage('',null,currentChat.id,action)}/>}
            <div className="conversation-scroll">
              {messages.length === 0 ? (
                <Dashboard projectName={currentProjectName} />
              ) : (
                <div className="message-list">
                  {messages.map((message, index) => (
                    <MessageBubble
                      key={message.id || index}
                      message={message}
                      copied={copiedId === message.id}
                      onCopy={() => copyMessage(message)}
                      onRetry={() => retryFailed(message)}
                      onEdit={() => openMessageRevision('edit', message.id)}
                      onRegenerate={() => openMessageRevision('regenerate', message.id)}
                      actionsDisabled={sending || storageBusy || attachmentLoading}
                      onApplyCode={applyCodeToEditor}
                      onApproval={(id, allowed) => window.scodex.approveAgentCommand(id, allowed)}
                      onOpenFile={openWorkspaceFile}
                      onBrowser={() => runToolAction('browser')}
                      onServices={() => runToolAction('services')}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            <div className="composer-area">
              <div className="composer-box">
                <input ref={attachmentInputRef} type="file" multiple className="visually-hidden" aria-label="选择聊天附件" disabled={!canShareContext || sending || attachmentLoading} onChange={(event) => { attachChatFiles(event.target.files); event.target.value = ''; }} />
                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="visually-hidden" aria-label="选择聊天图片" disabled={!canShareContext || sending || attachmentLoading} onChange={(event) => { attachChatImages(event.target.files); event.target.value = ''; }} />
                {(attachments.length > 0 || imageAttachments.length > 0 || fileContext) && <ComposerAttachmentDisclosure
                  key={currentChat?.id || 'composer'}
                  attachments={attachments}
                  images={imageAttachments}
                  fileContext={fileContext}
                  onRemoveAttachment={(index) => setAttachments((items) => items.filter((_, i) => i !== index))}
                  onRemoveImage={(index) => setImageAttachments((items) => items.filter((_, i) => i !== index))}
                  onRemoveContext={() => setFileContext(null)}
                />}
                {attachmentLoading && <div className="attachment-loading" role="status"><LoaderCircle size={14} className="spin" />正在添加文件并解析正文…</div>}
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing || event.keyCode === 229 || event.shiftKey) return;
                    const sendWithEnter = preferences.sendShortcut === 'enter' && event.key === 'Enter' && !event.ctrlKey && !event.metaKey;
                    const sendWithControl = preferences.sendShortcut !== 'enter' && event.key === 'Enter' && (event.ctrlKey || event.metaKey);
                    if (sendWithEnter || sendWithControl) { event.preventDefault(); sendMessage(); }
                  }}
                  placeholder={currentChat?.executionEnabled && canShareContext ? "描述目标，Scodex 将在当前项目中执行…" : "和 Scodex 一起工作"}
                  disabled={!library}
                  maxLength={64_000}
                  rows={2}
                  aria-label="输入工作内容"
                />
                <div className="composer-toolbar">
                  <div className="composer-tools">
                    <button className={"agent-execution-toggle " + (currentChat?.executionEnabled && canShareContext ? "active" : "")} aria-label="执行任务" aria-pressed={Boolean(currentChat?.executionEnabled && canShareContext)} disabled={!currentChat || sending || storageBusy || !canShareContext} title="启用后允许模型使用项目文件与命令工具；具体权限遵循设置" onClick={() => updateChat(() => ({ executionEnabled: !currentChat.executionEnabled }))}><Braces size={17} /><span>{currentChat?.executionEnabled && canShareContext ? "执行任务" : "对话模式"}</span></button>
                    <ComposerTools
                      workspaceRoot={workspaceRoot}
                      directory={currentDirectory}
                      skills={enabledSkills}
                      conversations={activeConversations}
                      activeId={currentChat?.id}
                      activeSkill={activeSkill}
                      mode={composerMode}
                      goal={currentChat?.goal || ''}
                      contextAccess={preferences.contextAccess}
                      busy={!currentChat || sending || storageBusy || attachmentLoading}
                      onFile={(filePath) => filePath ? attachFilePath(filePath) : attachmentInputRef.current?.click()}
                      onImage={() => imageInputRef.current?.click()}
                      onFolder={addFolderContext}
                      onWorkbench={addWorkbenchContext}
                      onMode={(mode) => {
                        setPendingModeOverride({ conversationId: currentChat?.id, mode });
                      }}
                      onGoal={(goal) => updateChat(() => ({ goal }))}
                      onSkill={selectSkill}
                      onChat={selectConversation}
                      onView={navigateView}
                      onPermission={changeContextPermission}
                    />
                  </div>
                  <div className="composer-submit">
                    <select className="composer-model-button" aria-label="选择模型" title="选择模型" value={selectedModel || ''} disabled={!availableModels.length || sending || storageBusy} onChange={(event) => selectChatModel(event.target.value)}>
                      {availableModels.map((model) => <option key={model} value={model}>{model}</option>)}
                    </select>
                    <label className="composer-effort">
                      <span className="visually-hidden">回答深度</span>
                      <select aria-label="回答深度" title="回答深度" value={reasoningEffort || ''} disabled={sending || storageBusy} onChange={(event) => selectChatReasoningEffort(event.target.value)}>
                        {availableReasoningEfforts.map((effort) => <option key={effort} value={effort}>{REASONING_EFFORT_LABELS[effort] || effort}</option>)}
                      </select>
                    </label>
                    {sending ? <button className="send-button stop-button" aria-label="停止生成" title="停止生成" onClick={() => cancelRequest()}><span className="stop-square" /></button> : <button className="send-button" aria-label="发送消息" title={preferences.sendShortcut === 'enter' ? 'Enter 发送 · Shift Enter 换行' : 'Ctrl Enter 发送'} disabled={storageBusy || liveRequests.length >= 3 || attachmentLoading || (!prompt.trim() && imageAttachments.length === 0 && attachments.length === 0)} onClick={() => sendMessage()}><ArrowUp size={18} /></button>}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeView === 'recent' && <RecentPanel conversations={showArchivedChats ? (library?.conversations || []).filter(c=>c.archivedAt&&(!c.projectId||c.projectId===appState?.activeProjectId)) : recentConversations} archived={showArchivedChats} onToggleArchived={()=>setShowArchivedChats(v=>!v)} onContextMenu={(event,id)=>openContextMenu(event,'chat',id)} onContextKey={(event,id)=>contextKeys(event,'chat',id)} activeId={library?.activeId} busy={attachmentLoading || storageBusy} runningIds={liveRequests.map((request) => request.conversationId)} onSelect={selectConversation} onNew={newConversation} projectName={currentProjectName} />}

        {activeView === 'files' && (
          <section className="tool-view file-view">
            <div className="tool-heading"><div><h1>文件与代码</h1><p>{displayPath(workspaceRoot)}</p></div><div className="heading-actions"><button className="secondary-button" onClick={openFileFromDialog}><FolderOpen size={16} />打开文件</button><button className="primary-button" onClick={createCodeFile}><FilePlus2 size={16} />新建文件</button></div></div>
            <div className="file-workspace">
              <aside className="file-browser">
                <div className="pane-toolbar"><span>文件</span><div><button className="icon-button small" title="向上一级" aria-label="向上一级" onClick={() => { const parent = currentDirectory.replace(/[\\/][^\\/]+[\\/]?$/, ''); if (parent && parent.length >= workspaceRoot.length) loadDirectory(parent); }}><ArrowUp size={15} /></button><button className="icon-button small" title="刷新" aria-label="刷新" onClick={() => loadDirectory(currentDirectory)}><RotateCw size={15} /></button></div></div>
                <div className="file-list-path">{displayPath(currentDirectory).split('/').slice(-2).join('/')}</div>
                <div className="file-tree" role="tree" aria-label="工作区文件">
                  {loadingDirectory && <div className="file-empty"><LoaderCircle className="spin" size={17} />读取中</div>}
                  {!loadingDirectory && fileEntries.length === 0 && <div className="file-empty">文件夹为空</div>}
                  {!loadingDirectory && fileEntries.map((item) => {
                    const ext = item.name.split('.').pop().toLowerCase();
                    const isActive = activeFile === item.path;
                    return <button key={item.path} className={`file-tree-item ${isActive ? 'selected' : ''}`} role="treeitem" onClick={() => changeWorkspaceDirectory(item)} title={item.name}>
                      {item.directory ? <FolderOpen size={15} /> : fileTypeIcon(ext)}<span>{item.name}</span>{item.directory ? <ChevronRight size={13} className="tree-chevron" /> : <small>{item.size ? formatSize(item.size) : ''}</small>}
                    </button>;
                  })}
                </div>
                <button className="workspace-root-button" onClick={handleChooseWorkspace}><FolderOpen size={14} />切换工作区</button>
              </aside>
              <div className="code-editor-pane">
                <div className="editor-toolbar"><div className="editor-file-label">{activeFile ? <><FileCode2 size={15} /><span>{activeFile.split(/[\\/]/).pop()}</span>{fileDirty && <i className="dirty-dot" />}</> : <span className="muted">选择或新建一个文本文件</span>}</div><div className="editor-actions">{activeFile && <button className="icon-button" title="将文件内容附加到对话" aria-label="将文件内容附加到对话" onClick={addFileContext}><Paperclip size={16} /></button>}<button className="primary-button save-button" onClick={saveCodeFile} disabled={!activeFile && !editorValue}><Save size={15} />保存</button></div></div>
                {activeFile || editorValue ? <CodeMirror value={editorValue} height="100%" extensions={extensionFor(activeFile)} theme={oneDark} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, bracketMatching: true, autocompletion: true }} onChange={(value) => { setEditorValue(value); setFileDirty(true); }} /> : <div className="editor-placeholder"><FileCode2 size={30} /><p>打开工作区中的代码或文本文件</p><button className="secondary-button" onClick={createCodeFile}><Plus size={15} />新建文件</button></div>}
                <div className="editor-statusbar"><span>{activeFile ? displayPath(activeFile).replace(displayPath(workspaceRoot), '').replace(/^\//, '') : '无活动文件'}</span><span>{activeFile || editorValue ? `${editorValue.split('\n').length} 行  ·  UTF-8` : '本机文件'}</span></div>
              </div>
            </div>
          </section>
        )}

        {activeView === 'images' && (
          <section className="tool-view image-view">
            <div className="tool-heading"><div><h1>图片</h1><p>{imagePath ? `${imagePath.split(/[\\/]/).pop()}  ·  ${imageDimensions.width} × ${imageDimensions.height}${imageDirty ? ' · 未导出' : ''}` : '编辑图片并导出到本地工作区'}</p></div><div className="heading-actions"><button className="secondary-button" disabled={sending || storageBusy} onClick={requestImageHelp}><Braces size={16} />让 AI 处理图片</button><button className="secondary-button" disabled={!imageDirty} onClick={() => loadImageFile(imagePath, { discard: true })}>重置修改</button><button className="secondary-button" onClick={openImageFromDialog}><ImageIcon size={16} />打开图片</button><button className="primary-button" disabled={!imagePath} onClick={saveImageAs}><ArrowDownToLine size={16} />导出 PNG</button></div></div>
            <div className="image-workspace">
              <aside className="image-controls">
                <div className="control-section"><div className="control-title"><RotateCw size={15} />方向</div><div className="control-row"><button className="secondary-button control-button" disabled={!imagePath} onClick={() => setImageRotation((value) => value - 1)}><RotateCcw size={15} />左转</button><button className="secondary-button control-button" disabled={!imagePath} onClick={() => setImageRotation((value) => value + 1)}><RotateCw size={15} />右转</button></div></div>
                <div className="control-section"><label className="control-title" htmlFor="brightness"><Sun size={15} />亮度 <strong>{imageBrightness}%</strong></label><input id="brightness" type="range" min="40" max="160" step="1" value={imageBrightness} disabled={!imagePath} onChange={(event) => setImageBrightness(Number(event.target.value))} /></div>
                <div className="control-section"><div className="control-title"><Crop size={15} />裁剪范围</div><div className="crop-grid">{[['x', 'X'], ['y', 'Y'], ['width', '宽'], ['height', '高']].map(([field, label]) => <label key={field}><span>{label}</span><input type="number" min="0" max={field === 'x' || field === 'width' ? imageDimensions.width : imageDimensions.height} value={cropValue[field]} disabled={!imagePath} onChange={(event) => setCropValue((value) => ({ ...value, [field]: Number(event.target.value) }))} /></label>)}</div><button className="secondary-button full-button" disabled={!imagePath} onClick={cropImage}><Crop size={15} />应用裁剪</button></div>
                <div className="control-section"><label className="control-title" htmlFor="caption"><Type size={15} />文字叠加</label><input id="caption" className="text-input" placeholder="添加图片文字" value={imageCaption} disabled={!imagePath} onChange={(event) => setImageCaption(event.target.value)} maxLength={80} /></div>
                <div className="image-note"><Paintbrush size={15} /><span>可让AI查看图片并裁剪、旋转、缩放、调整亮度或添加文字，保存前需批准。手工修改请导出或重置；生成式重绘需图像模型。</span></div>
              </aside>
              <div className="canvas-stage">{imagePath ? <canvas ref={canvasRef} className="image-canvas" aria-label="图片编辑画布" /> : <div className="canvas-empty"><div className="empty-icon"><ImageIcon size={27} /></div><strong>打开一张本地图片</strong><button className="secondary-button" onClick={openImageFromDialog}><FolderOpen size={15} />选择图片</button></div>}</div>
            </div>
          </section>
        )}

        {activeView === 'tables' && (
          <section className="tool-view table-view">
            <div className="tool-heading"><div><h1>表格</h1><p>{tablePath ? `${tablePath.split(/[\\/]/).pop()}  ·  ${tableKind.toUpperCase()}` : tableSheets.length ? `未保存工作簿 · ${tableKind.toUpperCase()}` : '编辑 CSV 与 Excel 工作簿'}</p></div><div className="heading-actions"><button className="secondary-button" disabled={sending || storageBusy} onClick={requestTableHelp}><Braces size={16} />让 AI 处理表格</button><button className="secondary-button" onClick={openTableFromDialog}><FileSpreadsheet size={16} />打开表格</button><button className="secondary-button" onClick={() => createBlankTable('xlsx')}><Plus size={16} />新建 XLSX</button>{currentSheet && <button className="secondary-button attach-table" onClick={addTableContext}><Paperclip size={15} />附加到对话</button>}<button className="primary-button" onClick={saveTable} disabled={!tableDirty}><Save size={15} />保存</button></div></div>
            <p className="table-ai-help">在对话中启用执行任务，AI 可读取、批量修改并经你批准后保存。支持常用 XLSX、UTF-8 CSV／TSV；公式需在 Excel 等软件重算，复杂图表等文件会停止覆盖。</p>
            {tableSheets.length ? <>
              <div className="table-toolbar"><div className="sheet-tabs">{tableSheets.map((sheet, index) => <button key={`${sheet.name}-${index}`} className={`sheet-tab ${activeSheetIndex === index ? 'active' : ''}`} onClick={() => setActiveSheetIndex(index)}>{sheet.name}</button>)}{tableKind === 'xlsx' && <button className="icon-button sheet-add" title="添加工作表" aria-label="添加工作表" onClick={addTableSheet}><Plus size={15} /></button>}</div><div className="table-actions"><button className="secondary-button compact" onClick={addTableRow}><Plus size={14} />行</button><button className="secondary-button compact" onClick={addTableColumn}><Plus size={14} />列</button><label className="table-search"><Search size={15} /><input aria-label="查找单元格" value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} placeholder="查找单元格" /></label><span className="table-dimensions">{currentSheet?.rowCount || 0} × {currentSheet?.columnCount || 0}{tableDirty && <i className="dirty-dot" />}</span></div></div>
              <div className="spreadsheet-shell"><div className="spreadsheet-scroll"><table className="spreadsheet"><thead><tr><th className="row-header corner">#</th>{Array.from({ length: currentSheet?.columnCount || 0 }, (_, index) => <th key={index}>{columnLabel(index + 1)}</th>)}</tr></thead><tbody>{Array.from({ length: Math.max(currentSheet?.rowCount || 0, 1) }, (_, rowIndex) => <tr key={rowIndex}><th className="row-header">{rowIndex + 1}</th>{Array.from({ length: currentSheet?.columnCount || 0 }, (_, columnIndex) => {
                const cell = currentSheet?.rows?.[rowIndex]?.[columnIndex] ?? '';
                const matched = tableSearch && String(cell).toLowerCase().includes(tableSearch.toLowerCase());
                return <td key={columnIndex} className={matched ? 'search-match' : ''}><input aria-label={`${columnLabel(columnIndex + 1)}${rowIndex + 1}`} value={cell} onChange={(event) => setCellValue(rowIndex, columnIndex, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></td>;
              })}</tr>)}</tbody></table></div></div>
            </> : <div className="table-empty"><div className="empty-icon"><Table2 size={27} /></div><strong>打开一个表格文件</strong><p>支持编辑 CSV 和常用 XLSX 工作簿。</p><div className="empty-actions"><button className="secondary-button" onClick={openTableFromDialog}><FolderOpen size={15} />选择文件</button><button className="secondary-button" onClick={() => createBlankTable()}><Plus size={15} />新建 CSV</button></div></div>}
          </section>
        )}

        {activeView === 'git' && <GitPanel workspaceRoot={workspaceRoot} blocked={anySending || storageBusy || fileDirty || tableDirty || imageDirty} branchPrefix={preferences.gitBranchPrefix} draftPullRequest={preferences.gitDraftPullRequest} mergeMethod={preferences.gitMergeMethod} onOpenFile={openWorkspaceFile} onOpenWorktree={openManagedWorktree} />}
        {activeView === 'tools' && <ToolsPanel inventory={inventory} loading={inventoryBusy} error={inventoryError} onRefresh={refreshSkills} onAction={runToolAction} onRevealSource={(id) => window.scodex.revealCapabilitySource(id).catch((error) => showNotice(readableError(error)))} />}
        {activeView === 'tasks' && <ScheduledTasksPanel state={scheduledState} projects={appState?.projects || []} activeProjectId={appState?.activeProjectId || ''} backgroundBusy={scheduledBackgroundBusy} onBackground={setScheduledBackgroundEnabled} onRefresh={refreshScheduledTasks} onCreate={(input) => saveScheduledTask(input)} onUpdate={(id, input) => saveScheduledTask(input, id)} onRemove={removeScheduledTask} onEnable={setScheduledTaskEnabled} onRun={runScheduledTask} />}
        {(activeView === 'plugins' || activeView === 'skills') && <PluginCenterPanel section={activeView} skills={skills} plugins={plugins} preferences={preferences} selectedSkill={selectedSkill} activeSkill={activeSkill} onSelectSkill={setSelectedSkill} onToggleSkill={toggleSkill} onRefresh={refreshSkills} onInstallSkill={() => window.scodex.installSkill().then((installed) => installed && refreshSkills()).catch((error) => showNotice(readableError(error)))} onOpenConfig={() => window.scodex.openPluginConfig().catch((error) => showNotice(readableError(error)))} onUseSkill={selectSkill} onUseMcpContext={useMcpContext} />}
        {activeView === 'settings' && <SettingsPanel onOpenWorktree={openManagedWorktree} initialCategory={settingsSection} onModelConnectionSaved={modelConnectionSaved} onModalChange={setSettingsDialogOpen} library={library} chatBusy={anySending || storageBusy} onManageChats={manageStoredChats} appState={appState} workspaceRoot={workspaceRoot} preferences={preferences} resolvedTheme={resolvedTheme} agentSettings={agentSettings} onPreference={savePreferences} onAgentSetting={saveAgentSettings} onConfigureConversationStorage={configureChatStorage} onOpenCodexConfig={(scope) => window.scodex.openCodexConfig(scope).catch((error) => showNotice(readableError(error)))} onDiagnoseCodex={() => window.scodex.diagnoseCodex()} onOpenCodexDiagnostic={() => window.scodex.openCodexDiagnostic().catch((error) => showNotice(readableError(error)))} onUpdateCodex={() => window.scodex.updateCodex()} onReinstallTools={() => window.scodex.reinstallWorkspaceTools()} onChooseWorkspace={handleChooseWorkspace} onReveal={revealWorkspace} onCopyPath={() => navigator.clipboard.writeText(workspaceRoot).then(() => showNotice('工作区路径已复制')).catch(() => showNotice('复制失败'))} onRefreshSkills={refreshSkills} skills={skills} connectionLabel={apiStateLabel(apiState, appState?.hasCredential)} onView={navigateView} />}
      </main>
      <BrowserPanel requestedTool={panelRequest} panelWidth={panelWidth ?? preferences.browserPanelWidth ?? 400} onWidthChange={setPanelWidth} onWidthCommit={(width) => { setPanelWidth(null); savePreferences({ browserPanelWidth: width }); }} preferences={preferences} onAiOpen={() => runToolAction('browser')} suspended={storageBusy || settingsDialogOpen || commandOpen || projectDialogOpen || Boolean(collaborationSource) || Boolean(library?.conversations.some((chat) => chat.messages.some((message) => message.approval)))} open={browserOpen} expanded={browserExpanded} workspaceRoot={workspaceRoot} model={appState?.model || 'grok-4.7'} reasoningOptions={availableReasoningEfforts.map((effort) => ({ value: effort, label: REASONING_EFFORT_LABELS[effort] || effort }))} defaultReasoningEffort={reasoningEffort} contextAccess={preferences.contextAccess} onContextPermission={changeContextPermission} onOpenFile={openWorkspaceFile} onReveal={revealWorkspace} onToggle={toggleBrowser} onExpand={() => savePreferences({ browserPanelExpanded: !browserExpanded })} onView={navigateView} onTerminal={openTerminal} onError={(error) => showNotice(readableError(error))} />
      {commandOpen && <CommandPalette onAction={runToolAction} onClose={() => setCommandOpen(false)} />}
      {collaborationSource && library && <TaskCollaborationDialog library={library} projects={appState?.projects || []} runningIds={liveRequests.map(r => r.conversationId)} sourceId={collaborationSource} canExecute={canShareContext} onClose={() => setCollaborationSource('')}
        onSubmit={input => collaborationActionRef.current({ action: 'send', input: { ...input, sourceId: collaborationSource } })}
        onReference={target => {
          const source = libraryRef.current.conversations.find(c => c.id === collaborationSource);
          if (!source || source.archivedAt || storageBusyRef.current) throw Error('来源任务已不可用。');
          const message = target.messages.findLast(m => m.role === 'assistant' && m.content) || target.messages.findLast(m => m.content);
          if (!message) throw Error('没有可引用的文本。');
          const draft = [source.draft, `【引用任务“${target.title}”（${target.id}）】\n${message.content}${message.truncated ? '\n（引用文本已截断）' : ''}`].filter(Boolean).join('\n\n');
          if (draft.length > 64000) throw Error('引用后超出草稿长度，请先缩短草稿。');
          updateChat(() => ({ draft }), source.id); showNotice('已追加到当前任务草稿');
        }}/ >}
      {projectDialogOpen && <div className="modal-backdrop project-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !projectSaving) setProjectDialogOpen(false); }}>
        <form className="project-editor" role="dialog" aria-modal="true" aria-labelledby="project-editor-title" onSubmit={createProject}>
          <div className="project-editor-heading"><h2 id="project-editor-title">创建项目</h2><button className="icon-button" type="button" title="关闭" aria-label="关闭" disabled={projectSaving} onClick={() => setProjectDialogOpen(false)}><X size={17} /></button></div>
          <label className="project-name-field"><FolderOpen size={17} /><input autoFocus required maxLength={80} aria-label="项目名称" placeholder="项目名称" value={projectNameDraft} onChange={(event) => setProjectNameDraft(event.target.value)} /></label>
          <div className="project-folder-field"><label htmlFor="project-folder-path">源文件夹</label><div className="project-folder-picker"><FolderOpen size={19} /><input id="project-folder-path" required aria-label="项目文件夹" placeholder="在此电脑上添加文件夹" value={projectPathDraft} onChange={(event) => setProjectPathDraft(event.target.value)} /><button className="secondary-button" type="button" onClick={chooseProjectFolder}><Plus size={14} />添加</button></div><small>项目文件会保存在你选择的本地文件夹中。</small></div>
          <div className="project-editor-actions"><button className="text-tool" type="button" disabled={projectSaving} onClick={() => setProjectDialogOpen(false)}>取消</button><button className="primary-button" disabled={projectSaving || !projectNameDraft.trim() || !projectPathDraft.trim()}>{projectSaving && <LoaderCircle size={15} className="spin" />}创建项目</button></div>
        </form>
      </div>}
      {notice && <div className="toast" role="status"><Check size={15} />{notice}<button className="icon-button small" aria-label="关闭提示" onClick={() => setNotice('')}><X size={14} /></button></div>}
    </div>
      {contextTarget && <WorkspaceContextMenu key={contextTarget.kind+contextTarget.id} target={contextTarget} entries={contextEntries} theme={resolvedTheme} onAction={runContextAction} onClose={closeContextMenu}/ >}
      {actionDialog && <WorkspaceActionDialog key={actionDialog.kind+actionDialog.id+actionDialog.type} state={actionDialog} theme={resolvedTheme} onClose={()=>{setActionDialog(null);requestAnimationFrame(()=>actionFocusRef.current?.focus?.());}} onChooseDirectory={()=>window.scodex.chooseExportDirectory()}
        onConfirm={async input=>{ if(actionDialog.type==='export') await exportChat(actionDialog.id,{directory:input.directory.trim(),format:input.format});
          else { await (actionDialog.kind==='chat'?chatAction(actionDialog.type,actionDialog.id,input.value):projectAction(actionDialog.type,actionDialog.id,input.value)); showNotice(actionDialog.type==='delete'?'已永久删除':'名称已更新'); } }}/ >}
      {storageBusy && <div className="storage-operation-overlay" role="status" aria-live="polite"><div><LoaderCircle size={23} className="spin" /><strong>正在更新聊天存储</strong><p>正在保存并核对聊天数据，请稍候…</p></div></div>}
    </React.Fragment>
  );

  function createBlankTable(kind = 'csv') {
    if (tableDirty && !window.confirm('表格有未保存修改，放弃并新建表格？')) return;
    const rows = [['']];
    workbookRef.current = kind === 'xlsx' ? new ExcelJS.Workbook() : null;
    if (workbookRef.current) workbookRef.current.addWorksheet('Sheet 1');
    setTablePath('');
    setTableKind(kind);
    setTableSheets([{ name: kind === 'xlsx' ? 'Sheet 1' : 'table', rows, rowCount: 1, columnCount: 1 }]);
    setActiveSheetIndex(0);
    setTableDirty(true);
    setActiveView('tables');
  }
}

export default App;

function apiStateLabel(state, hasKey) {
  if (state === 'connected') return '模型已连接';
  if (state === 'unavailable') return '中转站暂不可用';
  if (state === 'invalid') return '密钥认证失败';
  if (state === 'error') return '模型连接异常';
  return hasKey ? '密钥已配置' : '未找到模型密钥';
}

function pathBase(filePath) {
  const name = String(filePath || '').split(/[\\/]/).pop() || 'table';
  return name.replace(/\.[^.]+$/, '');
}

function fileTypeIcon(extension) {
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(extension)) return <ImageIcon size={15} />;
  if (['xlsx', 'xlsm', 'csv', 'tsv'].includes(extension)) return <FileSpreadsheet size={15} />;
  return <FileCode2 size={15} />;
}

function columnLabel(number) {
  let current = number;
  let label = '';
  while (current > 0) {
    current -= 1;
    label = String.fromCharCode(65 + current % 26) + label;
    current = Math.floor(current / 26);
  }
  return label;
}

function ChatFileCard({ file, onRemove }) {
  const statusLabels = { empty: '无正文', invalid: '解析失败', encrypted: '需要密码', scanned: '需要 OCR', unsupported: '格式不支持', 'encoding-error': '编码不支持', timeout: '解析超时', 'resource-limit': '超出解析限制', failed: '解析失败' };
  const status = file.parsed ? file.truncated ? '正文已截断' : file.parseStatus === 'empty' ? '无正文' : '正文已解析' : statusLabels[file.parseStatus] || '正文未提取';
  const description = file.truncated ? '正文已提取；超出本条消息 128 KiB 总量限制的部分不提交。' : file.parseMessage || (file.parsed ? '正文将在发送时提交。' : '请重新添加文件以提取正文。');
  return <div className="chat-file-card" title={description}><div className="chat-file-icon"><Files size={20} /></div><div><strong>{file.name}</strong><small>{formatSize(file.size)} · {status}</small></div>{onRemove && <button type="button" aria-label={`移除附件 ${file.name}`} title="移除附件" onClick={onRemove}><X size={14} /></button>}</div>;
}

function MessageAttachmentDisclosure({ attachments = [], images = [] }) {
  const count = attachments.length + images.length;
  if (!count) return null;
  const names = [...attachments, ...images].map((item) => item.name).filter(Boolean);
  const preview = names.length > 1 ? `${names[0]} 等 ${count} 项` : names[0] || `${count} 项附件`;
  const label = `消息附件 ${count} 项：${preview}`;
  return <details className="message-attachment-disclosure" aria-label="已发送附件">
    <summary aria-label={label} title={label}>
      <Paperclip size={16} aria-hidden="true" />
      <span className="message-attachment-name">{preview}</span>
      <small>{count} 项</small>
      <ChevronRight size={15} className="message-attachment-chevron" aria-hidden="true" />
    </summary>
    <div className="message-attachment-details" aria-label="附件详情">
      {attachments.length > 0 && <div className="message-file-list" aria-label="已发送文件">{attachments.map((file, index) => <ChatFileCard key={`${file.name}-${index}`} file={file} />)}</div>}
      {images.length > 0 && <div className="message-image-list" aria-label="已发送图片">{images.map((image, index) => <img key={`${image.name}-${index}`} src={image.dataUrl} alt={image.name} title={image.name} />)}</div>}
    </div>
  </details>;
}

function ComposerAttachmentDisclosure({ attachments = [], images = [], fileContext, onRemoveAttachment, onRemoveImage, onRemoveContext }) {
  const contextFile = fileContext ? { name: fileContext.path.split(/[\\/]/).pop(), parsed: true, size: new TextEncoder().encode(fileContext.content).length } : null;
  const count = attachments.length + images.length + (contextFile ? 1 : 0);
  const names = [...attachments, ...images, ...(contextFile ? [contextFile] : [])].map((item) => item.name).filter(Boolean);
  const preview = names.length > 1 ? `${names[0]} 等 ${count} 项` : names[0] || `${count} 项附件`;
  const label = `待发送附件 ${count} 项：${preview}`;
  return <details className="message-attachment-disclosure composer-attachment-disclosure" aria-label="待发送附件">
    <summary aria-label={label} title={label}>
      <Paperclip size={16} aria-hidden="true" />
      <span className="message-attachment-name">{preview}</span>
      <small>{count} 项</small>
      <ChevronRight size={15} className="message-attachment-chevron" aria-hidden="true" />
    </summary>
    <div className="message-attachment-details composer-attachment-list" aria-label="待发送附件详情">
      {images.length > 0 && <div className="chat-image-preview-list" aria-label="待发送图片">{images.map((image, index) => <div className="chat-image-preview" key={`${image.name}-${index}`}><img src={image.dataUrl} alt={image.name} /><button type="button" aria-label={`移除图片 ${image.name}`} onClick={() => onRemoveImage(index)}><X size={13} /></button><span title={image.name}>{image.name}</span></div>)}</div>}
      {(attachments.length > 0 || contextFile) && <div className="message-file-list" aria-label="待发送文件">{attachments.map((item, index) => <ChatFileCard key={`${item.name}-${index}`} file={item} onRemove={() => onRemoveAttachment(index)} />)}{contextFile && <ChatFileCard file={contextFile} onRemove={onRemoveContext} />}</div>}
    </div>
  </details>;
}

export function MessageBubble({ message, copied, onCopy, onRetry, onApplyCode, onApproval, onOpenFile, onBrowser, onServices, onEdit, onRegenerate, actionsDisabled }) {
  if (message.role === 'user') return <article data-message-id={message.id} className={'user-message' + (message.images?.length ? ' user-message-with-images' : '')}>
    <MessageAttachmentDisclosure attachments={message.attachments} images={message.images} />
    {message.content && <div className="user-message-content">{message.content}</div>}
    {(message.skillName || message.contextName) && <div className="user-message-meta">{message.skillName && <span className="message-context"><BookOpen size={12} />{message.skillName}</span>}{message.contextName && <span className="message-context"><Paperclip size={12} />{message.contextName}</span>}</div>}
    {onEdit && <div className="user-message-actions"><button className="text-tool" aria-label="编辑此消息" disabled={actionsDisabled} onClick={onEdit}>编辑消息</button></div>}
  </article>;

  return <article data-message-id={message.id} className="assistant-message"><div className="assistant-message-mark"><Sparkles size={15} /></div><div className="assistant-message-main"><div className="assistant-message-label">{message.model || '助手'}</div>
    <MessageProgress message={message} />
    {message.content && <MessageContent content={message.content} onApplyCode={!message.pending && !message.error ? onApplyCode : undefined} />}
    <AgentActivity operations={message.operations} approval={message.approval} onApproval={onApproval} onOpenFile={onOpenFile} onBrowser={onBrowser} onServices={onServices} />
    {message.error && <div className="message-error"><CircleAlert size={16} /><span>{message.error}</span></div>}
    {message.cancelled && <div className="cancelled-label">已停止生成，已完成的操作保留在上方记录中。</div>}
    <div className="message-actions">{onRegenerate && !message.pending && !message.error && !message.cancelled && <button className="text-tool" aria-label="重新生成此回答" disabled={actionsDisabled} onClick={onRegenerate}><RotateCw size={15}/>重新生成</button>}{message.content && <button className="icon-button small" title="复制回答" aria-label="复制回答" onClick={onCopy}>{copied ? <Check size={15} /> : <Clipboard size={15} />}</button>}{(message.error || message.cancelled) && <button className="text-tool retry-message" onClick={onRetry}><RotateCw size={14} />{message.operations?.length ? '继续任务' : '重试'}</button>}</div></div></article>;
}
