const { WebContentsView, session: electronSession } = require('electron');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { WORLD_ID, domScript } = require('./browser-dom.cjs');

const MAX_TABS = 10;

function normalizeAddress(input) {
  const value = String(input || '').trim();
  if (!value || value.length > 4096) throw new Error('请输入有效的网址或搜索内容。');
  let candidate = value;
  if (/^[\w.-]+:\d+(?:[/?#]|$)/i.test(candidate)) candidate = 'https://' + candidate;
  else if (!/^[a-z][a-z\d+.-]*:/i.test(candidate)) {
    candidate = /^(localhost(?::\d+)?|[\w.-]+\.[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})(?:[:/?#]|$)/i.test(candidate)
      ? 'https://' + candidate
      : 'https://www.bing.com/search?q=' + encodeURIComponent(candidate);
  }
  let url;
  try { url = new URL(candidate); } catch { throw new Error('网址格式不正确，请检查后重试。'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('标签页只支持 HTTP 或 HTTPS 网页。');
  if (url.username || url.password) throw new Error('请使用不含用户名和密码的网址。');
  return url.href;
}

function siteRuleFor(preferences, input) {
  let host;
  try { host = new URL(input).hostname.toLowerCase(); } catch { return null; }
  return (preferences.browserSiteRules || []).find((rule) => rule.host === host) || null;
}

function browserPermissionAllowed(preferences, permission, details, fallbackUrl) {
  const rule = siteRuleFor(preferences, details?.requestingUrl || fallbackUrl);
  if (!rule || rule.browse === 'block') return false;
  if (permission === 'camera') return rule.camera;
  if (permission === 'microphone') return rule.microphone;
  if (permission === 'media') {
    const types = Array.isArray(details?.mediaTypes) ? details.mediaTypes : details?.mediaType ? [details.mediaType] : [];
    return types.length > 0 && types.every((type) => type === 'video' ? rule.camera : type === 'audio' ? rule.microphone : false);
  }
  return false;
}

function installPanelBrowser({ window, ipcMain, getPreferences = () => ({}), shell, app, agentUrlAllowed = () => false }) {
  const tabs = [];
  const history = [];
  const agentSessions = new Map();
  const agentSessionFor = (owner) => {
    if (agentSessions.has(owner)) return agentSessions.get(owner);
    const session = electronSession.fromPartition('scodex-ai-' + crypto.randomUUID());
    session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.setPermissionCheckHandler(() => false);
    session.on('will-download', (_event, item) => { item.cancel(); const tab = tabs.find((entry) => entry.owner === owner); if (tab) { tab.notice = 'AI 标签页不自动下载文件，请手动处理下载。'; emit(); } });
    session.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      const blocked = !agentUrlAllowed(details.url, owner) || siteRuleFor(getPreferences(), details.url)?.browse === 'block';
      if (blocked && details.resourceType === 'mainFrame') { const tab = tabs.find((entry) => entry.view?.webContents.id === details.webContentsId); if (tab) { tab.error = '当前网络或网站规则禁止此页面。'; tab.loading = false; emit(); syncLayout(); } }
      callback({ cancel: blocked });
    });
    agentSessions.set(owner, session); return session;
  };
  let activeId;
  let activeWorkspaceRoot = '';
  let panelBounds = null;
  let attached = null;
  let disposed = false;
  let approvalSuspended = false;
  const downloadSession = electronSession.fromPartition('persist:scodex-tool-browser');
  const pendingDownloads = new Set();
  const confirmDownload = (_event, item) => {
    const preferences = getPreferences();
    const denied = item.getURLChain().some((url) => {
      const rule = siteRuleFor(preferences, url);
      return rule?.download === 'block' || rule?.browse === 'block';
    });
    if (denied) { item.cancel(); return; }
    try {
      const directory = preferences.browserDownloadDirectory || app.getPath('downloads');
      let filename = path.basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '') || 'download';
      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(filename)) filename = '_' + filename;
      const parsed = path.parse(filename);
      let destination = path.join(directory, filename);
      let index = 1;
      while (fs.existsSync(destination) || pendingDownloads.has(destination.toLowerCase())) {
        destination = path.join(directory, `${parsed.name} (${index++})${parsed.ext}`);
      }
      if (preferences.browserAskBeforeDownload !== false) item.setSaveDialogOptions({ title: '保存网页下载文件', buttonLabel: '保存', defaultPath: destination });
      else {
        if (!fs.statSync(directory).isDirectory()) throw new Error('下载目录不可用');
        pendingDownloads.add(destination.toLowerCase());
        item.once('done', () => pendingDownloads.delete(destination.toLowerCase()));
        item.setSavePath(destination);
      }
    } catch { item.cancel(); window.webContents.send('browser:download-error', '下载目录不可用，请在浏览器设置中重新选择。'); }
  };
  downloadSession.on('will-download', confirmDownload);
  downloadSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(Boolean(contents && browserPermissionAllowed(getPreferences(), permission, details, contents.getURL())));
  });
  downloadSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) =>
    Boolean(contents && browserPermissionAllowed(getPreferences(), permission, { ...details, requestingUrl: requestingOrigin }, contents.getURL())));
  downloadSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    const blocked = siteRuleFor(getPreferences(), details.url)?.browse === 'block';
    if (blocked && details.resourceType === 'mainFrame') {
      const tab = tabs.find((entry) => entry.view?.webContents.id === details.webContentsId);
      if (tab) { tab.error = '此网站已在浏览器权限中禁止访问。'; tab.loading = false; emit(); syncLayout(); }
    }
    callback({ cancel: blocked });
  });
  const trusted = (event) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('该页面无法访问本地工作台。');
    }
  };
  const ownerRoot = (owner) => owner ? path.resolve(String(owner).split('\0')[0]).toLowerCase() : '';
  const visible = (tab) => !tab.owner || ownerRoot(tab.owner) === activeWorkspaceRoot;
  const activeTab = () => {
    const current = tabs.find((tab) => tab.id === activeId);
    if (current && visible(current)) return current;
    const next = tabs.find((tab) => !tab.owner) || tabs.find(visible);
    if (next) activeId = next.id;
    return next;
  };
  const snapshot = () => ({
    activeId: activeTab()?.id,
    maxTabs: MAX_TABS,
    tabs: tabs.filter(visible).map(({ view, id, title, url, loading, error, owner, notice }) => ({ id, title, url, loading, error, ai: Boolean(owner), notice: notice || '',
      canGoBack: view ? view.webContents.navigationHistory.canGoBack() : false,
      canGoForward: view ? view.webContents.navigationHistory.canGoForward() : false,
    })),
  });
  const emit = () => {
    if (!disposed && !window.webContents.isDestroyed()) window.webContents.send('browser:state', snapshot());
  };
  const detach = () => {
    if (attached) {
      window.contentView.removeChildView(attached);
      attached = null;
    }
  };
  const syncLayout = () => {
    detach();
    const tab = activeTab();
    if (approvalSuspended || !panelBounds || !tab?.view || tab.error || !tab.url || disposed) return;
    const [width, height] = window.getContentSize();
    const x = Math.max(0, Math.min(width, Math.round(panelBounds.x)));
    const y = Math.max(0, Math.min(height, Math.round(panelBounds.y)));
    const bounds = { x, y, width: Math.max(0, Math.min(width - x, Math.round(panelBounds.width))),
      height: Math.max(0, Math.min(height - y, Math.round(panelBounds.height))) };
    if (bounds.width < 50 || bounds.height < 50) return;
    window.contentView.addChildView(tab.view);
    attached = tab.view;
    tab.view.setBounds(bounds);
  };
  const createTab = (url = '', owner = '') => {
    if (tabs.length >= MAX_TABS) throw new Error('最多打开 10 个标签页，请先关闭暂时不用的页面。');
    const tab = { id: crypto.randomUUID(), title: '新标签页', url: '', loading: false, error: '', owner, generation: 0, agentSnapshot: null, view: null };
    tabs.push(tab);
    if (!owner || visible(tab)) activeId = tab.id;
    if (url) navigate(tab, url);
    syncLayout();
    emit();
    return tab;
  };
  const navigate = (tab, input) => {
    const url = normalizeAddress(input);
    if (tab.owner && !agentUrlAllowed(url, tab.owner)) throw new Error('当前网络策略禁止此网址。');
    if (siteRuleFor(getPreferences(), url)?.browse === 'block') throw new Error('此网站已在浏览器权限中禁止访问。');
    if (!tab.view) {
      tab.view = new WebContentsView({ webPreferences: {
        sandbox: true, contextIsolation: true, nodeIntegration: false,
        webSecurity: true, ...(tab.owner ? { session: agentSessionFor(tab.owner), disableDialogs: true } : { partition: 'persist:scodex-tool-browser' }),
      } });
      tab.view.setBounds({ x: 0, y: 0, width: 1100, height: 760 });
      const contents = tab.view.webContents;
      // Remote pages have no preload bridge or local file access; device access is opt-in per host.
      contents.setWindowOpenHandler(({ url: target }) => {
        if (tab.owner) { tab.notice = '网页请求新窗口，已阻止。请单独打开目标网址。'; emit(); return { action: 'deny' }; }
        try {
          const url = normalizeAddress(target);
          if (siteRuleFor(getPreferences(), url)?.browse === 'block') throw new Error('此网站已在浏览器权限中禁止访问。');
          const preferences = getPreferences();
          const hostname = new URL(url).hostname;
          const local = hostname === 'localhost' || hostname === '[::1]' || /^127\./.test(hostname);
          const targetSystem = local ? preferences.browserLocalUrlTarget === 'system' : preferences.browserLinkOpenTarget === 'system';
          if (targetSystem && shell) shell.openExternal(url).catch(() => { tab.error = '无法使用系统浏览器打开此链接。'; emit(); });
          else createTab(url);
        } catch (error) { tab.error = error.message; emit(); syncLayout(); }
        return { action: 'deny' };
      });
      const guardNavigation = (event, target) => {
        try {
          const url = normalizeAddress(target);
          if (tab.owner && !agentUrlAllowed(url, tab.owner)) throw new Error('当前网络策略禁止此网址。');
          if (siteRuleFor(getPreferences(), url)?.browse === 'block') throw new Error('此网站已在浏览器权限中禁止访问。');
        } catch (error) { event.preventDefault(); tab.error = error.message; emit(); syncLayout(); }
      };
      contents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => { if (isMainFrame) { tab.generation += 1; tab.agentSnapshot = null; } });
      contents.on('will-navigate', guardNavigation);
      contents.on('will-redirect', guardNavigation);
      contents.on('did-start-loading', () => { tab.loading = true; tab.error = ''; emit(); });
      contents.on('did-stop-loading', () => { tab.loading = false; emit(); });
      contents.on('did-navigate', (_event, target) => {
        tab.url = target; tab.error = '';
        history.unshift({ url: target, title: tab.title, visitedAt: new Date().toISOString() });
        if (history.length > 500) history.length = 500;
        emit(); syncLayout();
      });
      contents.on('did-navigate-in-page', (_event, target, isMainFrame) => {
        if (isMainFrame) { tab.url = target; emit(); }
      });
      contents.on('page-title-updated', (_event, title) => { tab.title = (title || '网页').slice(0, 160); emit(); });
      contents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
        if (code !== -3 && isMainFrame) {
          tab.error = '页面未能加载（' + code + '）：' + description;
          tab.loading = false; emit(); syncLayout();
        }
      });
      contents.on('render-process-gone', () => {
        tab.error = '页面进程已停止，请刷新此标签页。'; tab.loading = false; emit(); syncLayout();
      });
    }
    tab.url = url; tab.error = ''; tab.notice = ''; tab.agentSnapshot = null; tab.title = new URL(url).hostname;
    const loading = tab.view.webContents.loadURL(url).then(() => true).catch((error) => {
      if (disposed || !tabs.includes(tab) || error.code === 'ERR_ABORTED') return false;
      tab.error ||= '无法打开此页面，请检查网址或网络连接。'; tab.loading = false; emit(); syncLayout(); return false;
    });
    syncLayout();
    return loading;
  };
  createTab();
  const handles = {
    'browser:get-state': () => snapshot(),
    'browser:history': () => history.map((entry) => ({ ...entry })),
    'browser:layout': (_event, bounds) => {
      panelBounds = bounds && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key])) ? bounds : null;
      syncLayout();
      return true;
    },
    'browser:action': (_event, action) => {
      const tab = tabs.find((item) => item.id === (action?.id || activeId));
      switch (action?.type) {
        case 'clear-data': {
          detach();
          for (const entry of tabs) if (entry.view && !entry.view.webContents.isDestroyed()) entry.view.webContents.close();
          tabs.length = 0;
          return resetAgents().then(() => downloadSession.clearStorageData()).then(() => downloadSession.clearCache()).then(() => {
            history.length = 0;
            createTab();
            syncLayout(); emit();
            return { cleared: true };
          });
        }
        case 'new': createTab(action.url ? normalizeAddress(action.url) : ''); break;
        case 'select':
          if (!tab) throw new Error('标签页已关闭。');
          activeId = tab.id; break;
        case 'close':
          if (!tab) break;
          detach();
          const index = tabs.indexOf(tab);
          tabs.splice(index, 1);
          if (tab.view && !tab.view.webContents.isDestroyed()) tab.view.webContents.close();
          if (activeId === tab.id) activeId = tabs[Math.min(index, tabs.length - 1)]?.id;
          if (!tabs.length) createTab();
          break;
        case 'navigate':
          if (!tab) throw new Error('标签页已关闭。');
          navigate(tab, action.url); break;
        case 'back':
          if (tab?.view?.webContents.navigationHistory.canGoBack()) tab.view.webContents.navigationHistory.goBack();
          break;
        case 'forward':
          if (tab?.view?.webContents.navigationHistory.canGoForward()) tab.view.webContents.navigationHistory.goForward();
          break;
        case 'reload':
          if (tab?.url) navigate(tab, tab.url);
          break;
        default: throw new Error('未知的标签页操作。');
      }
      syncLayout(); emit();
      return snapshot();
    },
  };
  for (const [channel, handler] of Object.entries(handles)) {
    ipcMain.handle(channel, (event, ...args) => { trusted(event); return handler(event, ...args); });
  }
  window.webContents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => {
    if (isMainFrame) { panelBounds = null; detach(); }
  });
  window.on('resize', syncLayout);
  window.on('closed', () => {
    disposed = true;
    resetAgents().catch(() => {});
    downloadSession?.removeListener('will-download', confirmDownload);
    for (const channel of Object.keys(handles)) ipcMain.removeHandler(channel);
    for (const tab of tabs) if (tab.view && !tab.view.webContents.isDestroyed()) tab.view.webContents.close();
  });
  const agentPage = (owner, id) => {
    const tab = tabs.find((item) => item.id === id && item.owner === owner);
    if (!tab?.view || tab.view.webContents.isDestroyed()) throw new Error('AI 标签页已关闭，或不属于当前对话。');
    return tab;
  };
  const pageStamp = (tab) => ({ id: tab.id, generation: tab.generation, url: tab.view.webContents.getURL() });
  const verifyStamp = (owner, stamp) => {
    const tab = agentPage(owner, stamp.id);
    if (tab.generation !== stamp.generation || tab.view.webContents.getURL() !== stamp.url || tab.loading) throw new Error('审批期间页面已变化，请重新读取后再操作。');
    if (!agentUrlAllowed(stamp.url) || siteRuleFor(getPreferences(), stamp.url)?.browse === 'block') throw new Error('当前网络或网站规则禁止此页面。');
    return tab;
  };
  const bounded = (promise, contents, signal, milliseconds = 25000) => new Promise((resolve, reject) => {
    const abort = () => { try { if (!contents.isDestroyed()) contents.stop(); } catch {} finish(new Error(signal?.aborted ? '任务已停止。' : '网页操作超时，请检查当前页面。')); };
    const timer = setTimeout(abort, milliseconds);
    const finish = (error, value) => { clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then((value) => finish(null, value), (error) => finish(error));
    if (signal?.aborted) abort();
  });
  const dom = async (tab, operation, args, signal) => {
    const result = await bounded(tab.view.webContents.executeJavaScriptInIsolatedWorld(WORLD_ID, [{ code: domScript(operation, args) }]), tab.view.webContents, signal, 10000);
    if (typeof result?.__scodexBrowserError === 'string') throw new Error(result.__scodexBrowserError);
    return result;
  };
  const closeTab = (tab) => {
    detach(); const index = tabs.indexOf(tab); if (index < 0) return;
    tabs.splice(index, 1);
    if (tab.view && !tab.view.webContents.isDestroyed()) tab.view.webContents.close();
    if (activeId === tab.id) activeId = tabs[Math.min(index, tabs.length - 1)]?.id;
    if (!tabs.length) createTab();
    syncLayout(); emit();
  };
  const resetAgents = async () => {
    for (const tab of [...tabs]) if (tab.owner) closeTab(tab);
    const sessions = [...agentSessions.values()]; agentSessions.clear();
    await Promise.allSettled(sessions.map((session) => session.clearStorageData().then(() => session.clearCache())));
  };
  const resetAgentsForWorkspace = async (root) => {
    const target = path.resolve(root).toLowerCase();
    for (const tab of [...tabs]) if (tab.owner && ownerRoot(tab.owner) === target) closeTab(tab);
    const sessions = [...agentSessions.entries()].filter(([owner]) => ownerRoot(owner) === target);
    for (const [owner] of sessions) agentSessions.delete(owner);
    await Promise.allSettled(sessions.map(([, session]) => session.clearStorageData().then(() => session.clearCache())));
  };
  return {
    resetAgents,
    resetAgentsForWorkspace,
    setWorkspaceRoot(root) {
      activeWorkspaceRoot = path.resolve(root).toLowerCase();
      if (!activeTab()) createTab();
      syncLayout(); emit();
    },
    suspendApproval(value) { approvalSuspended = Boolean(value); syncLayout(); },
    list: (owner) => snapshot().tabs.filter((item) => tabs.find((tab) => tab.id === item.id)?.owner === owner),
    describe(owner, id) { const tab = agentPage(owner, id); return { stamp: pageStamp(tab), tab: snapshot().tabs.find((item) => item.id === id) }; },
    verify: verifyStamp,
    async open(owner, url, id, signal) {
      if (!agentUrlAllowed(url, owner)) throw new Error('当前网络策略禁止此网址。');
      const tab = id ? agentPage(owner, id) : createTab('', owner);
      if (visible(tab)) activeId = tab.id;
      const loaded = await bounded(navigate(tab, url), tab.view.webContents, signal);
      if (!loaded || tab.error) throw new Error(tab.error || '网页加载被中断。');
      if (tab.loading) {
        let stopped; const idle = new Promise((resolve) => { stopped = resolve; tab.view.webContents.once('did-stop-loading', stopped); });
        try { await bounded(idle, tab.view.webContents, signal, 10000); } finally { if (!tab.view.webContents.isDestroyed()) tab.view.webContents.removeListener('did-stop-loading', stopped); }
      }
      verifyStamp(owner, pageStamp(tab)); emit(); syncLayout();
      return this.describe(owner, tab.id).tab;
    },
    async snapshot(owner, stamp, signal) {
      const tab = verifyStamp(owner, stamp); const snapshotId = crypto.randomUUID();
      const result = await dom(tab, 'snapshot', { snapshotId }, signal); verifyStamp(owner, stamp);
      tab.agentSnapshot = { id: snapshotId, generation: tab.generation, url: stamp.url };
      return { tab_id: tab.id, ...result };
    },
    async inspect(owner, stamp, snapshotId, ref, signal) {
      const tab = verifyStamp(owner, stamp);
      if (tab.agentSnapshot?.id !== snapshotId || tab.agentSnapshot.generation !== tab.generation || tab.agentSnapshot.url !== stamp.url) throw new Error('元素快照已失效，请重新读取网页。');
      return dom(tab, 'inspect', { snapshotId, ref }, signal);
    },
    async act(owner, stamp, operation, args, signal) {
      const tab = verifyStamp(owner, stamp);
      if (['click', 'fill', 'focus'].includes(operation) && tab.agentSnapshot?.id !== args.snapshotId) throw new Error('元素快照已失效，请重新读取网页。');
      const result = await dom(tab, operation, args, signal); tab.agentSnapshot = null;
      if (operation === 'focus') {
        if (signal?.aborted) throw new Error('任务已停止。');
        verifyStamp(owner, stamp);
        const contents = tab.view.webContents;
        contents.focus();
        contents.sendInputEvent({ type: 'keyDown', keyCode: args.key });
        contents.sendInputEvent({ type: 'keyUp', keyCode: args.key });
      }
      return { ...result, tab: this.describe(owner, tab.id).tab, needs_snapshot: true };
    },
    async capture(owner, stamp, signal) {
      const tab = verifyStamp(owner, stamp); const contents = tab.view.webContents;
      let image = await bounded(contents.capturePage(undefined, { stayHidden: true, stayAwake: true }), contents, signal, 10000);
      verifyStamp(owner, stamp);
      if (image.isEmpty()) throw new Error('页面尚未产生可用截图，请打开标签页后重试。');
      const original = image.getSize();
      if (original.width > 1280 || original.height > 900) image = image.resize({ width: Math.max(1, Math.round(original.width * Math.min(1280 / original.width, 900 / original.height))), quality: 'good' });
      let bytes = image.toJPEG(80);
      if (bytes.length > 1800000) { image = image.resize({ width: Math.min(900, image.getSize().width), quality: 'good' }); bytes = image.toJPEG(60); }
      if (bytes.length > 1800000) throw new Error('截图过大，请缩小页面后重试。');
      let preview = image.resize({ width: Math.min(480, image.getSize().width), quality: 'good' }).toJPEG(50);
      const dataUrl = 'data:image/jpeg;base64,' + bytes.toString('base64');
      return { image: { name: 'webpage.jpg', dataUrl }, preview: preview.length <= 96000 ? { name: 'webpage-preview.jpg', dataUrl: 'data:image/jpeg;base64,' + preview.toString('base64') } : null, original, size: image.getSize() };
    },
    close(owner, stamp) { const tab = verifyStamp(owner, stamp); closeTab(tab); return { closed: stamp.id }; },
  };
}

module.exports = { installPanelBrowser, normalizeAddress, siteRuleFor, browserPermissionAllowed, MAX_TABS };
