const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scodex', {
  claimCollaboration: id => ipcRenderer.invoke('collaboration:claim', id),
  getCollaborationSettings: id => ipcRenderer.invoke('collaboration:settings', id),
  completeCollaboration: value => ipcRenderer.invoke('collaboration:complete', value),
  onCollaborationRequest: listener => { const handler = (_event, value) => listener(value); ipcRenderer.on('collaboration:request', handler); return () => ipcRenderer.removeListener('collaboration:request', handler); },
  prepareChatAttachments: (files, existing) => ipcRenderer.invoke('chat:prepare-attachments', files, existing),
  getAppState: () => ipcRenderer.invoke('app:get-state'),
  mutateProject: (action, id, value, library) => ipcRenderer.invoke('projects:mutate', action, id, value, library),
  openProjectPath: id => ipcRenderer.invoke('projects:open-path', id),
  exportConversation: input => ipcRenderer.invoke('chat:export', input),
  chooseExportDirectory: () => ipcRenderer.invoke('chat:choose-export-directory'),
  openWorkspaceWindow: (kind, id) => ipcRenderer.invoke('workspace-window:open', kind, id),
  getWorkspaceWindowSubscriptions: () => ipcRenderer.invoke('workspace-window:subscriptions-get'),
  publishWorkspaceWindows: values => ipcRenderer.invoke('workspace-window:publish', values),
  completeWorkspaceWindowAction: result => ipcRenderer.invoke('workspace-window:action-complete', result),
  onWorkspaceWindowSubscriptions: listener => { const handler = (_event, value) => listener(value); ipcRenderer.on('workspace-window:subscriptions', handler); return () => ipcRenderer.removeListener('workspace-window:subscriptions', handler); },
  onWorkspaceWindowAction: listener => { const handler = (_event, value) => listener(value); ipcRenderer.on('workspace-window:action-request', handler); return () => ipcRenderer.removeListener('workspace-window:action-request', handler); },
  getDesktopState: () => ipcRenderer.invoke('app:desktop-state'),
  hideToTray: () => ipcRenderer.invoke('app:hide-to-tray'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  getLocalCapabilities: () => ipcRenderer.invoke('capabilities:list'),
  revealCapabilitySource: (id) => ipcRenderer.invoke('capabilities:reveal', id),
  onAppCommand: (listener) => {
    const handler = (_event, action) => listener(action);
    ipcRenderer.on('app:command', handler);
    return () => ipcRenderer.removeListener('app:command', handler);
  },
  getPermissionAudit: () => ipcRenderer.invoke('permissions:get-audit'),
  refreshPermissionSecurity: () => ipcRenderer.invoke('permissions:refresh-security'),
  previewOffice: (path) => ipcRenderer.invoke('office:preview', path),
  saveOffice: (path, hash, spec) => ipcRenderer.invoke('office:save', path, hash, spec),
  exportOfficePdf: (path, hash, destination, spec) => ipcRenderer.invoke('office:export-pdf', path, hash, destination, spec),
  getModelUsage: () => ipcRenderer.invoke('models:usage'),
  getModelConnection: () => ipcRenderer.invoke('models:get'),
  saveModelConnection: (input) => ipcRenderer.invoke('models:save', input),
  fetchModels: (input) => ipcRenderer.invoke('models:list', input),
  getSupabaseSync: () => ipcRenderer.invoke('supabase-sync:get'),
  saveSupabaseSync: (input) => ipcRenderer.invoke('supabase-sync:save', input),
  syncSupabase: (input) => ipcRenderer.invoke('supabase-sync:sync', input),

  getLicenses: () => ipcRenderer.invoke('app:licenses'),
  storageUsage: () => ipcRenderer.invoke('storage:usage'),
  revealData: () => ipcRenderer.invoke('storage:reveal'),
  listAgents: () => ipcRenderer.invoke('agents:list'),
  startAgent: (input) => ipcRenderer.invoke('agents:start', input),
  cancelAgent: (id) => ipcRenderer.invoke('agents:cancel', id),
  removeAgents: (ids) => ipcRenderer.invoke('agents:remove', ids),
  gitSnapshot: root => ipcRenderer.invoke('git:snapshot', root),
  gitDiff: (root, input) => ipcRenderer.invoke('git:diff', root, input),
  gitMutate: (root, input) => ipcRenderer.invoke('git:mutate', root, input),
  gitRemote: (root, input) => ipcRenderer.invoke('git:remote', root, input),
  githubStatus: () => ipcRenderer.invoke('github:status'),
  githubConnect: token => ipcRenderer.invoke('github:connect', token),
  githubDisconnect: () => ipcRenderer.invoke('github:disconnect'),
  githubList: (root, input) => ipcRenderer.invoke('github:list', root, input),
  githubDetail: (root, input) => ipcRenderer.invoke('github:detail', root, input),
  githubAction: (root, input) => ipcRenderer.invoke('github:action', root, input),
  githubOpen: (root, input) => ipcRenderer.invoke('github:open', root, input),
  openWorktreeProject: id => ipcRenderer.invoke('worktrees:open-project', id),
  listWorktrees: () => ipcRenderer.invoke('worktrees:list'),
  createWorktree: (useCurrent = false) => ipcRenderer.invoke('worktrees:create', useCurrent),
  setWorktreeRetention: (count) => ipcRenderer.invoke('worktrees:retention', count),
  removeWorktree: (id) => ipcRenderer.invoke('worktrees:remove', id),
  cleanupWorktrees: (ids) => ipcRenderer.invoke('worktrees:cleanup', ids),
  revealWorktree: (id) => ipcRenderer.invoke('worktrees:reveal', id),
  savePreferences: (update) => ipcRenderer.invoke('app:preferences', update),
  openDesktopApp: (id, target) => ipcRenderer.invoke('computer:open-app', id, target),
  chooseSkillDirectory: () => ipcRenderer.invoke('skills:choose-directory'),
  openSkillDirectory: () => ipcRenderer.invoke('skills:open-directory'),
  chooseBrowserDownloadDirectory: () => ipcRenderer.invoke('browser:choose-download-directory'),
  configureConversationStorage: (update, library) => ipcRenderer.invoke('chat:configure-storage', update, library),
  saveAgentSettings: (update, scope = 'shared') => ipcRenderer.invoke('app:agent-settings', update, scope),
  openCodexConfig: (scope = 'shared') => ipcRenderer.invoke('codex:open-config', scope),
  getCodexConfigurationStatus: (scope = 'shared') => ipcRenderer.invoke('codex:configuration-status', scope),
  diagnoseCodex: () => ipcRenderer.invoke('codex:diagnose'),
  openCodexDiagnostic: () => ipcRenderer.invoke('codex:open-diagnostic'),
  updateCodex: () => ipcRenderer.invoke('codex:update'),
  getWorkspaceTools: () => ipcRenderer.invoke('codex:tools-status'),
  reinstallWorkspaceTools: () => ipcRenderer.invoke('codex:reinstall-tools'),
  onWorkspaceToolsProgress: (listener) => {
    const handler = (_event, value) => listener(value);
    ipcRenderer.on('codex:tools-progress', handler);
    return () => ipcRenderer.removeListener('codex:tools-progress', handler);
  },
  listDevServices: () => ipcRenderer.invoke('dev-services:list'),
  getDevScripts: () => ipcRenderer.invoke('dev-services:scripts'),
  startDevService: (input, workspaceRoot) => ipcRenderer.invoke('dev-services:start', input, workspaceRoot),
  stopDevService: (id) => ipcRenderer.invoke('dev-services:stop', id),
  getDevServiceLogs: (id) => ipcRenderer.invoke('dev-services:logs', id),
  getDevServicePreview: (id) => ipcRenderer.invoke('dev-services:preview', id),
  onDevServiceState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('dev-services:state', handler);
    return () => ipcRenderer.removeListener('dev-services:state', handler);
  },
  getBrowserState: () => ipcRenderer.invoke('browser:get-state'),
  getBrowserHistory: () => ipcRenderer.invoke('browser:history'),
  onBrowserDownloadError: (listener) => {
    const handler = (_event, message) => listener(message);
    ipcRenderer.on('browser:download-error', handler);
    return () => ipcRenderer.removeListener('browser:download-error', handler);
  },
  browserAction: (action) => ipcRenderer.invoke('browser:action', action),
  layoutBrowser: (bounds) => ipcRenderer.invoke('browser:layout', bounds),
  onBrowserState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('browser:state', handler);
    return () => ipcRenderer.removeListener('browser:state', handler);
  },
  completeClose: (snapshot) => ipcRenderer.invoke('app:complete-close', snapshot),
  notify: (type) => ipcRenderer.invoke('app:notify', type),
  onPrepareClose: (listener) => {
    const handler = () => listener();
    ipcRenderer.on('app:prepare-close', handler);
    return () => ipcRenderer.removeListener('app:prepare-close', handler);
  },
  revealWorkspace: () => ipcRenderer.invoke('workspace:reveal'),
  openTerminal: () => ipcRenderer.invoke('workspace:terminal'),
  startTerminalSession: () => ipcRenderer.invoke('workspace:terminal-session:start'),
  writeTerminalCommand: (sessionId, command) => ipcRenderer.invoke('workspace:terminal-session:write', sessionId, command),
  closeTerminalSession: (sessionId) => ipcRenderer.invoke('workspace:terminal-session:close', sessionId),
  onTerminalEvent: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('terminal-session:event', handler);
    return () => ipcRenderer.removeListener('terminal-session:event', handler);
  },
  openExternalFile: (filePath) => ipcRenderer.invoke('workspace:open-external', filePath),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  listDirectory: (directory) => ipcRenderer.invoke('workspace:list', directory),
  searchWorkspace: (query) => ipcRenderer.invoke('workspace:search', query),
  chooseFile: (filters) => ipcRenderer.invoke('workspace:choose-file', filters),
  readTextFile: (filePath) => ipcRenderer.invoke('workspace:read-text', filePath),
  readBinaryFile: (filePath) => ipcRenderer.invoke('workspace:read-binary', filePath),
  saveTextFile: (filePath, value) => ipcRenderer.invoke('workspace:save-text', filePath, value),
  saveBinaryFile: (filePath, value) => ipcRenderer.invoke('workspace:save-binary', filePath, value),
  chooseSaveFile: (suggestedName, filters) => ipcRenderer.invoke('workspace:save-dialog', suggestedName, filters),
  createFile: (suggestedName) => ipcRenderer.invoke('workspace:create-file', suggestedName),
  listSkills: () => ipcRenderer.invoke('skills:list'),
  installSkill: () => ipcRenderer.invoke('skills:install'),
  listPlugins: () => ipcRenderer.invoke('plugins:list'),
  listPluginCatalog: () => ipcRenderer.invoke('plugins:catalog'),
  addPluginCatalogSource: input => ipcRenderer.invoke('plugins:catalog-add', input),
  removePluginCatalogSource: id => ipcRenderer.invoke('plugins:catalog-remove', id),
  refreshPluginCatalog: id => ipcRenderer.invoke('plugins:catalog-refresh', id),
  getPluginDetail: input => ipcRenderer.invoke('plugins:catalog-detail', input),
  installCatalogPlugin: input => ipcRenderer.invoke('plugins:catalog-install', input),
  setPluginEnabled: input => ipcRenderer.invoke('plugins:managed-enable', input),
  removeManagedPlugin: input => ipcRenderer.invoke('plugins:managed-remove', input),
  cancelPluginCatalogOperation: () => ipcRenderer.invoke('plugins:catalog-cancel'),
  onPluginCatalogProgress: listener => {
    const handler = (_event, progress) => listener(progress);
    ipcRenderer.on('plugins:catalog-progress', handler);
    return () => ipcRenderer.removeListener('plugins:catalog-progress', handler);
  },
  listMcpConnections: () => ipcRenderer.invoke('mcp:list'),
  listMcpContext: (input) => ipcRenderer.invoke('mcp:context-list', input),
  readMcpContext: (input) => ipcRenderer.invoke('mcp:context-read', input),
  cancelMcpContext: (requestId) => ipcRenderer.invoke('mcp:context-cancel', requestId),
  saveMcpConnection: (input) => ipcRenderer.invoke('mcp:save', input),
  connectMcp: (id) => ipcRenderer.invoke('mcp:connect', id),
  authorizeMcp: (id) => ipcRenderer.invoke('mcp:authorize', id),
  cancelMcpAuthorization: (id) => ipcRenderer.invoke('mcp:authorize-cancel', id),
  clearMcpAuthorization: (id) => ipcRenderer.invoke('mcp:authorize-clear', id),
  disconnectMcp: (id) => ipcRenderer.invoke('mcp:disconnect', id),
  removeMcpConnection: (id) => ipcRenderer.invoke('mcp:remove', id),
  onMcpState: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('mcp:state', handler);
    return () => ipcRenderer.removeListener('mcp:state', handler);
  },
  openPluginConfig: () => ipcRenderer.invoke('plugins:open-config'),
  listProjects: () => ipcRenderer.invoke('projects:list'),
  chooseProjectFolder: () => ipcRenderer.invoke('projects:choose-folder'),
  addProject: (input) => ipcRenderer.invoke('projects:add', input),
  selectProject: (id) => ipcRenderer.invoke('projects:select', id),
  listScheduledTasks: (options) => ipcRenderer.invoke('scheduled-tasks:list', options),
  setScheduledBackground: (enabled) => ipcRenderer.invoke('scheduled-tasks:background', enabled),
  chooseScheduledTaskAttachments: () => ipcRenderer.invoke('scheduled-tasks:choose-attachments'),
  createScheduledTask: (input) => ipcRenderer.invoke('scheduled-tasks:create', input),
  updateScheduledTask: (id, input) => ipcRenderer.invoke('scheduled-tasks:update', id, input),
  removeScheduledTask: (id) => ipcRenderer.invoke('scheduled-tasks:remove', id),
  enableScheduledTask: (id, enabled) => ipcRenderer.invoke('scheduled-tasks:enable', id, enabled),
  runScheduledTask: (id) => ipcRenderer.invoke('scheduled-tasks:run', id),
  saveHistory: (library) => ipcRenderer.invoke('chat:save-history', library),
  updateDirtyPaths: (paths) => ipcRenderer.invoke('workspace:dirty-paths', paths),
  approveAgentCommand: (id, allowed) => ipcRenderer.invoke('agent:approve', id, allowed),
  sendMessage: (payload) => ipcRenderer.invoke('chat:send', payload),
  cancelMessage: (requestId) => ipcRenderer.invoke('chat:cancel', requestId),
  steerMessage: (payload) => ipcRenderer.invoke('chat:steer', payload),
  onChatEvent: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('chat:event', handler);
    return () => ipcRenderer.removeListener('chat:event', handler);
  },
});
