import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CircleAlert, Ellipsis, ExternalLink, FileCode2, FileSpreadsheet, FileText, FolderOpen, GitBranch, Globe, House, Image, LoaderCircle, Maximize2, MessageSquare, Minimize2, PanelRightClose, PanelRightOpen, Plus, RotateCw, Search, Send, Settings, ShieldAlert, ShieldCheck, Sparkles, StopCircle, Terminal, X } from 'lucide-react';
import { MAX_CHAT_IMAGES, prepareChatImages } from '../lib/chat-images.js';
import { DevServicesPanel } from './dev-services-panel.jsx';
import { MessageFilesPanel } from './message-files-panel.jsx';

const errorText = (error) => String(error?.message || error || '操作失败').replace(/^Error invoking remote method '[^']+': /, '');

export function ActivityRail({ onCommand, activeView, onView, browserOpen, onBrowser, onReveal, canGoBack = false, canGoForward = false, onBack, onForward }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!moreOpen) return;
    const dismiss = (event) => {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !menuRef.current?.contains(event.target))) setMoreOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss); };
  }, [moreOpen]);
  return <aside className="activity-rail" aria-label="快捷导航">
    <div className="activity-history-controls" role="group" aria-label="工作台导航历史">
      <button type="button" aria-label="后退" title="后退（Alt + ←）" disabled={!canGoBack} onClick={onBack}><ArrowLeft size={15} /></button>
      <button type="button" aria-label="前进" title="前进（Alt + →）" disabled={!canGoForward} onClick={onForward}><ArrowRight size={15} /></button>
    </div>
    <button className={'activity-button ' + (activeView === 'assistant' ? 'active' : '')} aria-label="项目" title="项目" onClick={() => onView('assistant')}><House size={21} /></button>
    <button className={'activity-button ' + (activeView === 'recent' ? 'active' : '')} aria-label="最近" title="最近" onClick={() => onView('recent')}><MessageSquare size={21} /></button>
    <button className={'activity-button shell-secondary-entry ' + (activeView === 'git' ? 'active' : '')} aria-label="版本控制" title="版本控制" aria-current={activeView === 'git' ? 'page' : undefined} onClick={() => onView('git')}><GitBranch size={21}/></button>
    <button className={'activity-button shell-secondary-entry ' + (activeView === 'tools' ? 'active' : '')} aria-label="工具总览" title="工具总览" onClick={() => onView('tools')}><FileCode2 size={21} /></button>
    <button className="activity-button shell-secondary-entry" aria-label="工具命令搜索" title="搜索工具（Ctrl Shift P）" onClick={onCommand}><Search size={21} /></button>
    <div className="activity-spacer" />
    <button className={'activity-button settings-activity ' + (activeView === 'settings' ? 'active' : '')} aria-label="设置" title="设置" aria-current={activeView === 'settings' ? 'page' : undefined} onClick={() => onView('settings')}><Settings size={21} /></button>
  </aside>;
}

function SideChatPanel({ model, reasoningOptions, defaultReasoningEffort, contextAccess, onContextPermission }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState(defaultReasoningEffort);
  const [error, setError] = useState('');
  const requestRef = useRef(null);
  const imagesRef = useRef(images);
  const imageInputRef = useRef(null);
  const scrollRef = useRef(null);
  const canShareImages = contextAccess !== 'chat-only';
  const updateImages = (next) => { imagesRef.current = next; setImages(next); };

  useEffect(() => window.scodex.onChatEvent((event) => {
    if (event.requestId !== requestRef.current?.id) return;
    const requestId = event.requestId;
    if (event.type === 'delta') setMessages((current) => current.map((item) => item.id === requestId ? { ...item, content: item.content + event.text } : item));
    else {
      setBusy(false); requestRef.current = null;
      setMessages((current) => current.map((item) => {
        if (item.id !== requestId) return item;
        if (event.type === 'complete') return { ...item, content: event.text, pending: false, startedAt: undefined };
        if (event.type === 'cancelled') return { ...item, pending: false, cancelled: true, stoppedAfter: Math.max(0, Math.floor((Date.now() - (item.startedAt || Date.now())) / 1000)), startedAt: undefined };
        return { ...item, pending: false, error: event.message, startedAt: undefined };
      }));
    }
  }), []);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
  useEffect(() => { if (!canShareImages) updateImages([]); }, [canShareImages]);

  const attachImages = async (files) => {
    try {
      const prepared = await prepareChatImages(files, imagesRef.current);
      updateImages([...imagesRef.current, ...prepared]); setError('');
    } catch (caught) { setError(errorText(caught)); }
  };
  const send = async (text = draft, retry = null) => {
    const content = String(text || '').trim();
    const outgoingImages = retry?.images || imagesRef.current;
    if ((!content && !outgoingImages.length) || requestRef.current) return;
    const requestId = window.crypto.randomUUID();
    const userEntry = { id: `${requestId}-user`, role: 'user', content, ...(outgoingImages.length ? { images: outgoingImages } : {}) };
    const assistantEntry = { id: requestId, role: 'assistant', content: '', pending: true, startedAt: Date.now(), model };
    const retryIndex = retry ? messages.findIndex((item) => item.id === retry.userId) : messages.length;
    const history = messages.slice(0, retryIndex).filter((item) => ['user', 'assistant'].includes(item.role) && (item.content || item.images?.length) && !item.error && !item.cancelled)
      .map((item) => ({ role: item.role, content: item.content, images: item.images }));
    setMessages((current) => retry ? [...current.filter((item) => item.id !== retry.userId && item.id !== retry.assistantId), userEntry, assistantEntry] : [...current, userEntry, assistantEntry]);
    setDraft(''); updateImages([]); setBusy(true); setError(''); requestRef.current = { id: requestId };
    try { await window.scodex.sendMessage({ requestId, mode: 'answer', reasoningEffort, prompt: content || (outgoingImages.length ? '请描述这些图片。' : ''), messages: history, images: outgoingImages }); }
    catch (caught) {
      if (requestRef.current?.id !== requestId) return;
      requestRef.current = null; setBusy(false);
      setMessages((current) => current.map((item) => item.id === requestId ? { ...item, pending: false, error: errorText(caught), startedAt: undefined } : item));
    }
  };
  const retry = (assistant) => {
    const index = messages.findIndex((item) => item.id === assistant.id);
    const user = messages[index - 1];
    if (user?.role === 'user') send(user.content, { userId: user.id, assistantId: assistant.id, images: user.images || [] });
  };

  return <section className="side-chat-view" aria-label="临时侧边聊天">
    {messages.length === 0 ? <div className="side-chat-empty"><span className="side-chat-empty-icon"><Plus size={28} /></span><strong>侧边聊天</strong><p>侧边聊天是临时聊天，关闭应用后会消失。</p></div> : <div className="side-chat-messages" ref={scrollRef} aria-live="polite">
      {messages.map((item) => item.role === 'user'
        ? <article className="side-chat-user" key={item.id}>{item.images?.length > 0 && <div className="message-image-list" aria-label="已发送图片">{item.images.map((image, index) => <img key={`${image.name}-${index}`} src={image.dataUrl} alt={image.name} title={image.name} />)}</div>}{item.content && <div className="side-chat-user-content">{item.content}</div>}</article>
        : <article className="side-chat-reply" key={item.id}><div className="side-chat-reply-mark"><Sparkles size={14} /></div><div className="side-chat-reply-content"><span className="side-chat-model">{item.model || model}</span>{item.pending && !item.content && <span className="thinking-indicator"><LoaderCircle size={15} className="spin" />正在生成</span>}{item.content && <p>{item.content}</p>}{item.cancelled && <span className="cancelled-label">{Number.isFinite(item.stoppedAfter) ? `你在 ${item.stoppedAfter} 秒后停止了` : '已停止生成'}</span>}{item.error && <div className="side-chat-error"><CircleAlert size={15} />{item.error}<button type="button" className="text-tool retry-message" onClick={() => retry(item)}>重试</button></div>}</div></article>)}
      <div />
    </div>}
    <div className="side-chat-composer">
      {images.length > 0 && <div className="chat-image-preview-list" aria-label="待发送图片">{images.map((image, index) => <div className="chat-image-preview" key={`${image.name}-${index}`}><img src={image.dataUrl} alt={image.name} /><button type="button" aria-label={`移除图片 ${image.name}`} title="移除图片" onClick={() => updateImages(images.filter((_, imageIndex) => index !== imageIndex))}><X size={13} /></button><span title={image.name}>{image.name}</span></div>)}</div>}
      <textarea aria-label="输入侧边聊天内容" placeholder="和 Codex 一起工作" rows={2} value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.nativeEvent.isComposing || event.keyCode === 229 || event.shiftKey) return; if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); send(); } }} />
      {error && <div className="side-chat-error" role="alert"><CircleAlert size={15} />{error}</div>}
      <div className="side-chat-toolbar">
        <div className="side-chat-tools"><button type="button" className="icon-button" aria-label="添加图片" title={canShareImages ? '添加图片' : '当前为仅对话权限'} disabled={!canShareImages || busy || images.length >= MAX_CHAT_IMAGES} onClick={() => imageInputRef.current?.click()}><Plus size={18} /></button><button type="button" className={'icon-button side-chat-permission ' + (canShareImages ? '' : 'restricted')} aria-label={canShareImages ? '切换为仅对话权限' : '允许完全访问'} title={canShareImages ? '切换为仅对话权限' : '当前仅对话，点击允许完全访问'} onClick={() => onContextPermission?.(canShareImages ? 'chat-only' : 'manual')}>{canShareImages ? <ShieldCheck size={17} /> : <ShieldAlert size={17} />}</button><input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="visually-hidden" aria-label="选择侧边聊天图片" disabled={!canShareImages || busy || images.length >= MAX_CHAT_IMAGES} onChange={(event) => { attachImages(event.target.files); event.target.value = ''; }} /></div>
        <div className="side-chat-model-controls"><span title="当前模型">{model}</span><label><span className="visually-hidden">侧边聊天回答深度</span><select aria-label="侧边聊天回答深度" value={reasoningEffort} disabled={busy} onChange={(event) => setReasoningEffort(event.target.value)}>{reasoningOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{busy ? <button type="button" className="side-chat-send stop-button" aria-label="停止侧边聊天生成" title="停止生成" onClick={() => requestRef.current && window.scodex.cancelMessage(requestRef.current.id).catch(() => {})}><StopCircle size={17} /></button> : <button type="button" className="side-chat-send" aria-label="发送侧边聊天消息" title="发送消息" disabled={!draft.trim() && images.length === 0} onClick={() => send()}><Send size={16} /></button>}</div>
      </div>
    </div>
  </section>;
}

function TerminalPanel() {
  const [output, setOutput] = useState('Windows PowerShell\r\nCopyright (C) Microsoft Corporation. All rights reserved.\r\n\r\n');
  const [promptPath, setPromptPath] = useState('');
  const [command, setCommand] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const commandHistory = useRef([]);
  const historyIndex = useRef(0);
  const sessionRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let pendingEvents = [];
    const consume = (event) => {
      if (!mounted || event.sessionId !== sessionRef.current) return;
      if (event.type === 'output') setOutput((current) => (current + event.text).slice(-180_000));
      else if (event.type === 'prompt') { setPromptPath(event.directory); setReady(true); }
      else if (event.type === 'error') { setError(event.message); setReady(false); }
      else if (event.type === 'exit') { setError(`PowerShell 已退出（${event.code ?? '未知'}）。`); setReady(false); }
    };
    const unsubscribe = window.scodex.onTerminalEvent((event) => {
      if (!sessionRef.current) pendingEvents.push(event);
      else consume(event);
    });
    window.scodex.startTerminalSession().then((result) => {
      if (!mounted) { window.scodex.closeTerminalSession(result.sessionId).catch(() => {}); return; }
      sessionRef.current = result.sessionId; setSessionId(result.sessionId); setPromptPath(result.directory);
      for (const event of pendingEvents) consume(event);
      pendingEvents = [];
    }).catch((caught) => { if (mounted) { setError(errorText(caught)); setReady(false); } });
    return () => {
      mounted = false; unsubscribe();
      if (sessionRef.current) window.scodex.closeTerminalSession(sessionRef.current).catch(() => {});
    };
  }, []);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [output]);

  const submit = async (event) => {
    event.preventDefault();
    const value = command.trim();
    if (!value || !sessionId || !ready) return;
    setOutput((current) => (current + `PS ${promptPath}> ${value}\r\n`).slice(-180_000));
    commandHistory.current.push(value); historyIndex.current = commandHistory.current.length;
    setCommand(''); setReady(false); setError('');
    try { await window.scodex.writeTerminalCommand(sessionId, value); }
    catch (caught) { setError(errorText(caught)); setReady(true); }
  };
  const browseHistory = (event) => {
    if (event.key === 'ArrowUp' && commandHistory.current.length) { event.preventDefault(); historyIndex.current = Math.max(0, historyIndex.current - 1); setCommand(commandHistory.current[historyIndex.current] || ''); }
    if (event.key === 'ArrowDown' && commandHistory.current.length) { event.preventDefault(); historyIndex.current = Math.min(commandHistory.current.length, historyIndex.current + 1); setCommand(commandHistory.current[historyIndex.current] || ''); }
  };

  return <section className="terminal-panel" aria-label="PowerShell 终端">
    <div className="terminal-output" ref={scrollRef} role="log" aria-label="终端输出" aria-live="off"><pre>{output}</pre>{error && <div className="terminal-error" role="alert">{error}</div>}</div>
    <form className="terminal-prompt" onSubmit={submit}><span>{promptPath ? `PS ${promptPath}>` : 'PS …>'}</span><input aria-label="PowerShell 命令" autoComplete="off" spellCheck="false" value={command} disabled={!ready} onKeyDown={browseHistory} onChange={(event) => setCommand(event.target.value)} /><button type="submit" aria-label="执行命令" disabled={!ready || !command.trim()}><Send size={15} /></button></form>
  </section>;
}

export function BrowserPanel({ requestedTool, panelWidth = 400, onWidthChange, onWidthCommit, open, expanded, suspended = false, preferences, workspaceRoot, model = 'grok-4.7', reasoningOptions = [], defaultReasoningEffort = 'max', contextAccess, onContextPermission, onOpenFile, onReveal, onToggle, onExpand, onView, onTerminal, onError, onAiOpen }) {
  const [state, setState] = useState({ tabs: [], activeId: null });
  const [address, setAddress] = useState('');
  const [addressFocused, setAddressFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [toolTabs, setToolTabs] = useState([]);
  const [activeToolId, setActiveToolId] = useState(null);
  const [fileRequest, setFileRequest] = useState(null);
  const [browserHistory, setBrowserHistory] = useState([]);
  const contentRef = useRef(null);
  const tab = state.tabs.find((item) => item.id === state.activeId);
  const activeTool = toolTabs.find((item) => item.id === activeToolId);
  const knownWebTabs = useRef(new Set());
  const updateState = (next) => {
    const addedAI = next.tabs.some((item) => item.ai && !knownWebTabs.current.has(item.id));
    knownWebTabs.current = new Set(next.tabs.map((item) => item.id));
    setState(next);
    if (addedAI) { setActiveToolId(null); onAiOpen?.(); }
  };
  const action = async (type, value = {}) => {
    try { setActionError(''); if (type === 'new' || type === 'select') setActiveToolId(null); updateState(await window.scodex.browserAction({ type, ...value })); }
    catch (error) { setActionError(String(error.message || error).replace(/^Error invoking remote method '[^']+': /, '')); }
  };
  useEffect(() => {
    let mounted = true;
    window.scodex.getBrowserState().then((next) => { if (mounted) updateState(next); }).catch(onError);
    const unsubscribe = window.scodex.onBrowserState(updateState);
    return () => { mounted = false; unsubscribe(); };
  }, []);
  useEffect(() => { window.scodex.getBrowserHistory().then(setBrowserHistory).catch(() => {}); }, [state.activeId, tab?.url, tab?.title]);
  useEffect(() => {
    if (addressFocused) return;
    let value = tab?.url || '';
    if (value && preferences?.browserShowFullUrl === false) {
      try { value = new URL(value).origin; } catch {}
    }
    setAddress(value);
  }, [tab?.url, tab?.id, addressFocused, preferences?.browserShowFullUrl]);
  useEffect(() => {
    if (!open) { setMenuOpen(false); window.scodex.layoutBrowser(null).catch(onError); return; }
    let frame;
    const layout = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = contentRef.current?.getBoundingClientRect();
        window.scodex.layoutBrowser(rect && !activeTool && !suspended && !menuOpen && !actionError && tab?.url && !tab.error
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null).catch(onError);
      });
    };
    const observer = new ResizeObserver(layout);
    if (contentRef.current) observer.observe(contentRef.current);
    window.addEventListener('resize', layout);
    layout();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', layout); };
  }, [open, expanded, suspended, menuOpen, actionError, activeToolId, tab?.id, tab?.url, tab?.error]);
  useEffect(() => {
    if (!menuOpen) return;
    const escape = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [menuOpen]);
  const navigate = (event) => {
    event.preventDefault();
    document.activeElement?.blur();
    setAddressFocused(false);
    action('navigate', { url: address });
  };
  const switchTool = (kind) => {
    const existing = toolTabs.find((item) => item.kind === kind);
    if (existing) { setActiveToolId(existing.id); return; }
    const titles = { chat: '侧边聊天', terminal: '终端', files: '打开文件', services: '运行与预览' };
    const next = { id: `tool-${window.crypto.randomUUID()}`, kind, title: titles[kind] };
    setToolTabs((current) => [...current, next]); setActiveToolId(next.id); setMenuOpen(false);
  };
  useEffect(() => {
    if (!requestedTool) return;
    if (requestedTool.kind === 'browser') { setActiveToolId(null); setMenuOpen(false); }
    else { if (requestedTool.kind === 'files' && requestedTool.path) setFileRequest(requestedTool); switchTool(requestedTool.kind); }
  }, [requestedTool?.id]);
  useEffect(() => window.scodex.onBrowserShortcut(({ type }) => {
    if (type !== 'focus-address' || !open || suspended) return;
    setActiveToolId(null); setAddressFocused(true);
    requestAnimationFrame(() => { const field = document.querySelector('[aria-label="搜索或输入网址"]'); field?.focus(); field?.select(); });
  }), [open, suspended]);
  useEffect(() => {
    const keydown = event => {
      if (!open || suspended || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.isComposing || event.defaultPrevented) return;
      const key = event.key.toLowerCase();
      const inPanel = event.target?.closest?.('.browser-pane');
      if (!inPanel && !document.body?.contains(event.target)) return;
      if (key === 'l' && !activeTool) { event.preventDefault(); setAddressFocused(true); const field = document.querySelector('[aria-label="搜索或输入网址"]'); field?.focus(); field?.select(); }
      else if (inPanel && key === 't') { event.preventDefault(); action('new'); }
      else if (inPanel && key === 'w') { event.preventDefault(); if (activeTool) closeTool(activeTool.id); else if (tab) action('close', { id: tab.id }); }
      else if (inPanel && key === 'r' && !activeTool && tab?.url) { event.preventDefault(); action('reload'); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });
  const resizeRef = useRef(null);
  const constrainedWidth = (value) => Math.max(320, Math.min(660, window.innerWidth - 460, Math.round(value)));
  const closeTool = (id) => {
    setToolTabs((current) => current.filter((item) => item.id !== id));
    if (activeToolId === id) setActiveToolId(null);
  };
  const openHistoryItem = (item) => { setAddress(item.url); setAddressFocused(false); action('navigate', { url: item.url }); };
  const uniqueHistory = browserHistory.filter((item, index, all) => item.url && all.findIndex((candidate) => candidate.url === item.url) === index).slice(0, 8);
  const suggestions = address.trim() ? uniqueHistory.filter((item) => `${item.title} ${item.url}`.toLocaleLowerCase().includes(address.trim().toLocaleLowerCase())).slice(0, 8) : uniqueHistory;
  const hideOnlyBlankWebTab = Boolean(activeTool && state.tabs.length === 1 && !tab?.url);
  const visibleWebTabs = state.tabs.filter((item) => !(hideOnlyBlankWebTab && item.id === tab?.id));
  return <aside className="browser-pane" hidden={!open} aria-label="标签工作台">
    {!expanded && <div className="panel-resize-handle" role="separator" aria-label="调整第三工作台宽度" aria-orientation="vertical" aria-valuemin={320} aria-valuemax={660} aria-valuenow={panelWidth} tabIndex={0} onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); resizeRef.current = { x: event.clientX, width: panelWidth, next: panelWidth }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!resizeRef.current) return; const width = constrainedWidth(resizeRef.current.width + resizeRef.current.x - event.clientX); resizeRef.current.next = width; onWidthChange?.(width); }} onPointerUp={(event) => { if (!resizeRef.current) return; const width = resizeRef.current.next; resizeRef.current = null; event.currentTarget.releasePointerCapture(event.pointerId); onWidthCommit?.(width); }} onPointerCancel={() => { if (resizeRef.current) { const width = resizeRef.current.width; resizeRef.current = null; onWidthCommit?.(width); } }} onKeyDown={(event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); onWidthCommit?.(constrainedWidth(event.key === 'Home' ? 320 : event.key === 'End' ? 660 : panelWidth + (event.key === 'ArrowLeft' ? 20 : -20))); }}><span /></div>}
    <div className="browser-tabs-toolbar">
      <div className="browser-tabs" role="tablist" aria-label="工作台标签">
        {visibleWebTabs.map((item) => <div className={'browser-tab ' + (!activeTool && item.id === tab?.id ? 'active' : '')} key={item.id}>
          <button role="tab" aria-selected={!activeTool && item.id === tab?.id} aria-controls="browser-tab-content" title={item.title} onClick={() => { setAddressFocused(false); action('select', { id: item.id }); }}>{item.loading ? <LoaderCircle size={15} className="spin" /> : <Globe size={15} />}<span>{item.ai ? 'AI · ' : ''}{item.title}</span></button>
          <button className="tab-close" aria-label={'关闭标签 ' + item.title} title="关闭标签" onClick={() => action('close', { id: item.id })}><X size={14} /></button>
        </div>)}
        {toolTabs.map((item) => <div className={'browser-tab ' + (item.id === activeToolId ? 'active' : '')} key={item.id}>
          <button role="tab" aria-selected={item.id === activeToolId} aria-controls="browser-tab-content" title={item.title} onClick={() => setActiveToolId(item.id)}>{item.kind === 'chat' ? <MessageSquare size={15} /> : item.kind === 'terminal' ? <Terminal size={15} /> : <FileCode2 size={15} />}<span>{item.title}</span></button>
          <button className="tab-close" aria-label={'关闭标签 ' + item.title} title="关闭标签" onClick={() => closeTool(item.id)}><X size={14} /></button>
        </div>)}
      </div>
      <button className="icon-button" aria-label="新建标签页" title="新建标签页" disabled={state.tabs.length >= (state.maxTabs || 10)} onClick={() => action('new')}><Plus size={18} /></button>
      <button className="icon-button" aria-label={expanded ? '还原标签工作台' : '放大标签工作台'} title={expanded ? '还原面板' : '放大面板'} onClick={onExpand}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      <button className="icon-button" aria-label="收起标签工作台" title="隐藏面板，保留标签" onClick={onToggle}><PanelRightClose size={19} /></button>
    </div>
    {!activeTool && <form className="browser-address-toolbar" onSubmit={navigate}>
      <div className="browser-history-controls"><button type="button" className="icon-button" aria-label="网页后退" disabled={!tab?.canGoBack} onClick={() => action('back')}><ArrowLeft size={16} /></button><button type="button" className="icon-button" aria-label="网页前进" disabled={!tab?.canGoForward} onClick={() => action('forward')}><ArrowRight size={16} /></button><button type="button" className="icon-button" aria-label="刷新网页" disabled={!tab?.url} onClick={() => action('reload')}><RotateCw size={16} /></button></div>
      <div className="browser-address"><Search size={15} /><input aria-label="搜索或输入网址" placeholder="搜索或输入网址" value={address} onFocus={() => { setAddressFocused(true); setAddress(tab?.url || ''); }} onBlur={() => window.setTimeout(() => setAddressFocused(false), 120)} onChange={(event) => setAddress(event.target.value)} />{addressFocused && <div className="browser-address-suggestions" role="listbox" aria-label="网页历史建议">
        {suggestions.map((item) => <button type="button" key={`${item.url}-${item.visitedAt}`} role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => openHistoryItem(item)}><Globe size={15} /><span><strong>{item.title || item.url}</strong><small>{item.url}</small></span></button>)}
        {address.trim() && !suggestions.some((item) => item.url.toLocaleLowerCase() === address.trim().toLocaleLowerCase()) && <button type="button" className="browser-search-suggestion" onMouseDown={(event) => event.preventDefault()} onClick={() => { setAddressFocused(false); action('navigate', { url: address }); }}><Search size={15} /><span><strong>搜索网页</strong><small>{address}</small></span></button>}
        {!suggestions.length && !address.trim() && <p>最近没有打开的网页</p>}
      </div>}</div>
      <button type="button" className="icon-button" aria-label="标签页选项" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Ellipsis size={18} /></button>
    </form>}
    {!activeTool && tab?.ai && <div className="browser-ai-status"><Globe size={15} /><span>AI 独立会话 · 操作前逐次审批</span></div>}
    {!activeTool && tab?.notice && <p className="browser-ai-notice" role="status">{tab.notice}</p>}
    <div className="browser-content" id="browser-tab-content" role="tabpanel" ref={contentRef} aria-label={activeTool?.title || tab?.title || '新标签页'}>
      {toolTabs.map((item) => <div className="browser-tool-tab-content" hidden={item.id !== activeToolId} key={item.id}>
        {item.kind === 'chat' && <SideChatPanel model={model} reasoningOptions={reasoningOptions} defaultReasoningEffort={defaultReasoningEffort} contextAccess={contextAccess} onContextPermission={onContextPermission} />}
        {item.kind === 'terminal' && <TerminalPanel />}
        {item.kind === 'services' && <DevServicesPanel workspaceRoot={workspaceRoot} active={open && item.id === activeToolId} contextAccess={contextAccess} onPreview={(url) => action('new', { url })} />}
        {item.kind === 'files' && <MessageFilesPanel workspaceRoot={workspaceRoot} request={fileRequest} onPath={path => setFileRequest({ path, id: window.crypto.randomUUID() })} />}
      </div>)}
      {!activeTool && <>
        {menuOpen ? <div className="browser-options"><h2>标签页选项</h2><button className="secondary-button" onClick={() => { action('new'); setMenuOpen(false); }} disabled={state.tabs.length >= 10}><Plus size={17} />新建标签页</button><button className="secondary-button" onClick={() => { setMenuOpen(false); onTerminal?.(); }}><ExternalLink size={17} />在独立窗口打开终端</button><button className="secondary-button" onClick={() => { setMenuOpen(false); onToggle(); }}><PanelRightOpen size={17} />隐藏工作台，保留页面</button><button className="text-tool" onClick={() => setMenuOpen(false)}>返回页面</button></div>
          : actionError || tab?.error ? <div className="browser-page-error" role="alert"><Globe size={32} /><h2>页面暂时无法打开</h2><p>{actionError || tab.error}</p><button className="secondary-button" onClick={() => { setActionError(''); action('reload'); }} disabled={!tab?.url}><RotateCw size={16} />重试当前页面</button><button className="text-tool" onClick={() => action('new')}>打开新标签页</button></div>
          : !tab?.url ? <div className="browser-newtab">
            <div className="browser-newtab-heading"><Globe size={17} /><h2>工具</h2></div><div className="browser-tool-list">
              <button onClick={() => switchTool('files')}><FolderOpen size={19} /><span>文件</span><ChevronRight size={16} /></button>
              <button onClick={() => switchTool('chat')}><MessageSquare size={19} /><span>侧边聊天</span><ChevronRight size={16} /></button>
              <button onClick={() => switchTool('terminal')}><Terminal size={19} /><span>终端</span><span className="tool-badge">PowerShell</span></button>
              <button onClick={() => switchTool('services')}><Terminal size={19} /><span>运行与预览</span><ChevronRight size={16} /></button>
            </div><h2 className="browser-recommend-title">推荐</h2><div className="browser-recommendations">
              {(uniqueHistory.length ? uniqueHistory.slice(0, 3).map((item) => ({ title: item.title || item.url, url: item.url })) : [
                { title: 'GitHub', url: 'https://github.com' }, { title: 'Stack Overflow', url: 'https://stackoverflow.com' }, { title: 'npm', url: 'https://www.npmjs.com' },
              ]).map((item, index) => <button key={item.url} title={item.url} onClick={() => { setAddress(item.url); action('navigate', { url: item.url }); }}><span className={'recommend-icon ' + ['skill-recommend', 'sheet-recommend', 'image-recommend'][index]}><Globe size={22} /></span><span>{item.title}</span></button>)}
            </div>
          </div> : <div className="browser-loading">{tab.loading && <><LoaderCircle size={20} className="spin" /><span>正在加载网页…</span></>}</div>}
      </>}
    </div>
  </aside>;
}
