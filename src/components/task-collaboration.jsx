import React, { useEffect, useRef, useState } from 'react';
import { listTasks, readTask } from '../lib/task-collaboration.js';

const statusLabel = { running: '运行中', completed: '已结束', error: '发生错误', cancelled: '已停止', idle: '尚无回复' };
export function TaskCollaborationDialog({ library, projects, runningIds, sourceId, canExecute, onSubmit, onReference, onClose }) {
  const dialog = useRef(null);
  const [query, setQuery] = useState(''), [targetId, setTargetId] = useState(''), [text, setText] = useState('');
  const [execute, setExecute] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState(null);
  useEffect(() => { const e = dialog.current; e.showModal(); return () => { if (e.open) e.close(); }; }, []);
  const { tasks, truncated } = listTasks(library, projects, runningIds, { sourceId, query, includeArchived: true });
  let target; try { if (targetId) target = readTask(library, projects, runningIds, { conversationId: targetId, limit: 8 }); } catch { /* Removed while dialog was open. */ }
  useEffect(() => { setExecute(false); }, [canExecute, targetId]);
  const blocked = !target ? '请选择其他任务。' : !target.projectId ? '目标未绑定项目，请先通过聊天菜单选择项目。' : !target.available ? '目标任务或项目已归档或不可用。' : target.running ? '目标仍在运行，可以查看结果，结束后再发送。' : target.hasDraft ? '目标有未发送草稿，请先处理草稿。' : runningIds.length >= 3 ? '已有3个任务运行，请等待其中一项结束。' : '';
  async function submit(e) {
    e.preventDefault(); if (blocked || busy) return;
    setBusy(true); setError(''); setReceipt(null);
    try { const result = await onSubmit({ conversationId: target.id, expectedStamp: target.stamp, text, executionEnabled: execute }); setReceipt(result); setText(''); }
    catch (e) { setError(String(e.message || e).replace(/^Error invoking remote method '[^']+': /, '')); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="message-revision-dialog task-collaboration-dialog" aria-labelledby="task-collaboration-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={submit}>
      <h2 id="task-collaboration-title">任务协作</h2><p>查看其他聊天的消息，将结果引用到当前草稿，或确认后发送交接。</p>
      <label>筛选任务<input aria-label="筛选协作任务" value={query} disabled={busy} autoFocus maxLength={200} onChange={e => { setQuery(e.target.value); setTargetId(''); setReceipt(null); }}/></label>
      <label>目标任务<select aria-label="协作目标任务" value={targetId} disabled={busy} onChange={e => { setTargetId(e.target.value); setExecute(false); setError(''); setReceipt(null); }}><option value="">请选择其他任务</option>{tasks.map(t => <option key={t.id} value={t.id}>{t.projectName} / {t.title} · {t.archived ? '已归档' : statusLabel[t.status]}{t.hasDraft ? ' · 有草稿' : ''}</option>)}</select></label>
      {truncated && <p>仅显示最近50项，可输入标题或项目名称缩小范围。</p>}
      {target && <section className="collaboration-preview" aria-label="协作任务消息"><div className="collaboration-state"><strong>{target.title}</strong><span role="status">{statusLabel[target.status]}</span></div><p>{target.projectName} · {target.id}</p>
        {!target.messages.length && <p>目标暂无消息。</p>}{target.messages.map(m => <article key={m.id}><strong>{m.role === 'user' ? '用户' : '助手'}{m.pending ? ' · 生成中' : ''}</strong><pre>{m.content || '暂无文本'}</pre>{m.truncated && <p>长文本已截断。</p>}{m.error && <p className="message-error">{m.error}</p>}{m.attachmentCount > 0 && <p>{m.attachmentCount} 个附件或图片未展开</p>}</article>)}
        <button type="button" className="secondary-button" disabled={busy || !target.messages.some(m => m.content)} onClick={() => { try { onReference(target); onClose(); } catch (e) { setError(e.message); } }}>引用到当前草稿</button>
      </section>}
      <label>交接内容<textarea aria-label="任务交接内容" value={text} maxLength={16000} rows={4} disabled={busy} onChange={e => setText(e.target.value)}/></label>
      <label className="message-revision-execution"><input type="checkbox" checked={execute} disabled={busy || !canExecute || !target?.available} onChange={e => setExecute(e.target.checked)}/>允许目标任务本次使用项目工具</label>
      <p>{execute ? '目标使用自己的项目、工具权限和审批设置；提交后独立运行。' : '本次交接仅请求回答，不授权本机操作。'}</p>
      {blocked && <p role="note">{blocked}</p>}{error && <p role="alert" className="message-error">{error}</p>}
      {receipt && <p role="status" className="collaboration-receipt">已提交至目标任务，尚不代表完成。可在上方查看状态和结果。</p>}
      <div className="message-revision-buttons"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>关闭</button><button className="primary-button" disabled={busy || Boolean(blocked) || !text.trim()}>{busy ? '正在保存交接…' : '确认并发送交接'}</button></div>
    </form>
  </dialog>;
}
