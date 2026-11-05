import React, { useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
export function InlineMessageEditor({ request, canExecute, disabled, onSubmit, onClose }) {
  const input = useRef(null), [text, setText] = useState(request.source.content), [execute, setExecute] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { input.current?.focus(); }, []);
  async function submit(event) {
    event?.preventDefault();
    if (busy || disabled) return;
    setError(''); setBusy(true);
    try { await onSubmit({ ...request, text, executionEnabled: execute }); onClose(); }
    catch (cause) { setError(String(cause.message || cause).replace(/^Error invoking remote method '[^']+': /, '')); }
    finally { setBusy(false); }
  }
  return <form className="user-message-inline-editor" onSubmit={submit} onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) submit(event); }}>
    <textarea ref={input} aria-label="在原消息内编辑" value={text} maxLength={64000} rows={3} disabled={busy || disabled} onChange={event => setText(event.target.value)} />
    {(request.source.images?.length > 0 || request.source.attachments?.length > 0) && <small>保留原消息的 {request.source.images?.length || 0} 张图片、{request.source.attachments?.length || 0} 个附件。</small>}
    {request.source.contextName && <small>临时文件上下文不会重新发送，需要时请在输入栏重新附加。</small>}
    <label className="user-message-inline-execution"><input type="checkbox" checked={execute} disabled={!canExecute || busy || disabled} onChange={event => setExecute(event.target.checked)} />在新版本中执行项目工具</label>
    {error && <span role="alert" className="user-message-inline-error">{error}</span>}
    <div className="user-message-inline-buttons"><button type="button" className="text-tool" disabled={busy} onClick={onClose}>取消</button><button type="submit" className="primary-button" disabled={busy || disabled || (!text.trim() && !request.source.images?.length && !request.source.attachments?.length)}> {busy ? '正在发送…' : '保存为新版本并发送'}</button></div>
  </form>;
}
export function MessageRevisionDialog({ chat, request, canExecute, onSubmit, onClose }) {
  const dialog = useRef(null), [text, setText] = useState(() => request.source.content), [execute, setExecute] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const source = request.source;
  useEffect(() => { const element = dialog.current; element.showModal(); return () => { if (element.open) element.close(); }; }, []);
  async function submit(e) { e.preventDefault(); setError(''); setBusy(true); try { await onSubmit({ ...request, text, executionEnabled: execute }); onClose(); } catch (e) { setError(String(e.message || e).replace(/^Error invoking remote method '[^']+': /, '')); } finally { setBusy(false); } }
  return <dialog ref={dialog} className="message-revision-dialog" aria-labelledby="message-revision-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}><form onSubmit={submit}>
    <h2 id="message-revision-title">{request.kind === 'edit' ? '编辑已发送的消息' : '重新生成回答'}</h2><p>从这条用户消息继续创建新版本，原回答及后续对话保留，可随时切回。</p>
    <label>用户消息<textarea aria-label="编辑已发送的消息" autoFocus rows={6} maxLength={64000} readOnly={request.kind !== 'edit'} value={text} onChange={e => setText(e.target.value)}/></label>
    {(source.images?.length > 0 || source.attachments?.length > 0) && <p>保留原消息的 {source.images?.length || 0} 张图片、{source.attachments?.length || 0} 个附件。</p>}
    {source.contextName && <p role="note">原消息的临时文件上下文“{source.contextName}”不重新发送；需要时请在输入栏重新附加。</p>}
    <label className="message-revision-execution"><input type="checkbox" checked={execute} disabled={!canExecute || busy} onChange={e => setExecute(e.target.checked)}/>在新版本中执行项目工具</label><p>已执行的操作与本地文件不会回滚。勾选后将重新请求工具，仍需遵循现有权限与审批。</p>
    {error && <p role="alert" className="message-error">{error}</p>}
    <div className="message-revision-buttons"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>取消</button><button className="primary-button" disabled={busy || (!text.trim() && !source.images?.length && !source.attachments?.length)}><RotateCw size={17}/>{busy ? '正在创建版本…' : '保存为新版本并发送'}</button></div>
  </form></dialog>;
}
