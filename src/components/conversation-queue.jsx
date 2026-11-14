import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pause, Pencil, Play, X } from 'lucide-react';
import './conversation-queue.css';

export function ConversationQueue({ items = [], paused, running, disabled, onChange, onPause, onResume }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  if (!items.length) return null;
  const change = (id, action, text) => {
    try { onChange(id, action, text); setEditing(null); setError(''); }
    catch (failure) { setError(failure.message); }
  };
  return <section className="conversation-queue" aria-label="待发送队列">
    <div className="conversation-queue-heading"><strong>待发送 {items.length}</strong><span role="status">{paused || !running ? '已暂停' : '等待本轮完成'}</span>
      <button type="button" className="icon-button small" aria-label={paused || !running ? '继续发送队列' : '暂停发送队列'} title={paused || !running ? '继续发送队列' : '暂停发送队列'} disabled={disabled || Boolean(editing)} onClick={paused || !running ? onResume : onPause}>{paused || !running ? <Play size={15} /> : <Pause size={15} />}</button>
    </div>
    <ol>{items.map((item, index) => <li key={item.id} data-queue-id={item.id}>
      {editing?.id === item.id ? <form onSubmit={event => { event.preventDefault(); change(item.id, 'edit', editing.text); }}>
        <textarea aria-label="编辑待发送消息" maxLength={64000} value={editing.text} onChange={event => setEditing({ ...editing, text: event.target.value })} disabled={disabled} />
        <div className="conversation-queue-actions"><button className="icon-button small" type="submit" aria-label="保存待发送消息" title="保存" disabled={disabled}><Check size={15} /></button><button className="icon-button small" type="button" aria-label="取消编辑待发送消息" title="取消" onClick={() => { setEditing(null); setError(''); }}><X size={15} /></button></div>
      </form> : <><span className="conversation-queue-text" title={item.text}>{item.text}</span><div className="conversation-queue-actions">
        <button className="icon-button small" type="button" aria-label={`上移待发送消息 ${index + 1}`} title="上移" disabled={disabled || index === 0} onClick={() => change(item.id, 'up')}><ArrowUp size={14} /></button>
        <button className="icon-button small" type="button" aria-label={`下移待发送消息 ${index + 1}`} title="下移" disabled={disabled || index === items.length - 1} onClick={() => change(item.id, 'down')}><ArrowDown size={14} /></button>
        <button className="icon-button small" type="button" aria-label={`编辑待发送消息 ${index + 1}`} title="编辑" disabled={disabled} onClick={() => { onPause(); setEditing({ id: item.id, text: item.text }); setError(''); }}><Pencil size={14} /></button>
        <button className="icon-button small" type="button" aria-label={`移除待发送消息 ${index + 1}`} title="移除" disabled={disabled} onClick={() => change(item.id, 'remove')}><X size={14} /></button>
      </div></>}
    </li>)}</ol>
    {error && <p className="message-error" role="alert">{error}</p>}
  </section>;
}
