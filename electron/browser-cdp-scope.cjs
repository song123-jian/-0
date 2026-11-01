const GLOBAL_DOMAINS = new Set(['Browser', 'SystemInfo', 'Tethering', 'Tracing']);
const TARGET_METHODS = new Set(['getTargets', 'getTargetInfo', 'setAutoAttach', 'attachToTarget', 'detachFromTarget', 'activateTarget', 'closeTarget']);
const COOKIE_METHODS = { 'Storage.getCookies': 'Network.getAllCookies', 'Storage.setCookies': 'Network.setCookies', 'Storage.clearCookies': 'Network.clearBrowserCookies' };

function createCdpScope({ isActive = () => true } = {}) {
  let root;
  let initialization;
  const sessions = new Map();
  const targetAllowed = (id) => id === root?.targetId || [...sessions.values()].some(session => session.targetId === id);
  const removeSession = (id) => {
    for (const [child, entry] of [...sessions]) if (entry.parent === id) removeSession(child);
    sessions.delete(id);
  };
  const assertTarget = (id) => {
    if (!targetAllowed(id)) throw new Error('CDP 仅允许当前 AI 标签及其子目标。');
  };
  const assertSession = (id) => {
    if (id && !sessions.has(id)) throw new Error('CDP 子会话不属于当前 AI 标签，或已关闭。');
  };
  const initialize = async (api) => {
    if (!initialization) initialization = api.sendCommand('Target.getTargetInfo').then(response => {
      if (!response.targetInfo?.targetId) throw new Error('无法确认当前 AI 标签调试目标。');
      root = response.targetInfo;
    });
    await initialization;
  };
  return {
    observe(method, params = {}, sessionId) {
      if (sessionId && !sessions.has(sessionId)) return false;
      if (method === 'Target.attachedToTarget') {
        const info = params.targetInfo;
        if (!root || !params.sessionId || !info?.targetId || info.type === 'browser' ||
            (info.browserContextId && info.browserContextId !== root.browserContextId) ||
            (info.type === 'page' && !targetAllowed(info.openerId) && !targetAllowed(info.targetId))) return false;
        sessions.set(params.sessionId, { targetId: info.targetId, parent: sessionId || null });
      } else if (method === 'Target.detachedFromTarget') {
        if (!sessions.has(params.sessionId)) return false;
        removeSession(params.sessionId);
      } else if (method.startsWith('Target.') && (params.targetInfo?.targetId || params.targetId)) {
        if (!targetAllowed(params.targetInfo?.targetId || params.targetId)) return false;
      }
      return true;
    },
    async execute(api, method, params = {}, sessionId, signal) {
      if (signal?.aborted) throw new Error('任务已停止。');
      if (!isActive()) throw new Error('完整 CDP 访问权限已关闭。');
      const [domain, action] = method.split('.');
      if (GLOBAL_DOMAINS.has(domain)) throw new Error('当前 AI 标签不开放浏览器全局 CDP 命令。');
      if (domain === 'Target' && !TARGET_METHODS.has(action)) throw new Error('CDP 仅允许当前 AI 标签及其子目标，禁止浏览器全局目标命令。');
      await initialize(api);
      if (signal?.aborted) throw new Error('任务已停止。');
      if (!isActive()) throw new Error('完整 CDP 访问权限已关闭。');
      assertSession(sessionId);
      if (Object.hasOwn(params, 'browserContextId') && params.browserContextId !== root.browserContextId) throw new Error('CDP 不允许访问其他浏览器上下文。');
      if (Object.hasOwn(COOKIE_METHODS, method)) {
        if (!root.browserContextId) throw new Error('无法确认当前 AI 标签的浏览器上下文。');
        const cookieParams = method === 'Storage.setCookies' ? { cookies: params.cookies } : {};
        return api.sendCommand(COOKIE_METHODS[method], cookieParams);
      }
      if (params.targetId) assertTarget(params.targetId);
      if (Array.isArray(params.targetIds)) params.targetIds.forEach(assertTarget);
      if (domain === 'Target') {
        if ((action === 'attachToTarget' || action === 'setAutoAttach' && params.autoAttach !== false) && params.flatten !== true) throw new Error('CDP 子目标必须使用 flatten=true 的受管会话。');
        if (action === 'attachToTarget' || action === 'activateTarget' || action === 'closeTarget') assertTarget(params.targetId);
        if (action === 'detachFromTarget') {
          if (!params.sessionId) throw new Error('CDP 子会话标识缺失。');
          assertSession(params.sessionId);
        }
      }
      const result = await api.sendCommand(method, params, sessionId);
      if (method === 'Target.getTargets') return { ...result, targetInfos: (result.targetInfos || []).filter(info => targetAllowed(info.targetId)) };
      if (method === 'Target.attachToTarget' && result.sessionId) sessions.set(result.sessionId, { targetId: params.targetId, parent: sessionId || null });
      if (method === 'Target.detachFromTarget') removeSession(params.sessionId);
      return result;
    },
  };
}

module.exports = { createCdpScope };
