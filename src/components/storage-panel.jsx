import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Archive, Bot, FolderOpen, GitBranch, Play, RefreshCw, Search, Square, Trash2, Undo2, X } from 'lucide-react';
import './storage.css';

const CATEGORIES = [
  ['chats', '聊天', '#ffbf00'], ['agents', '子智能体', '#a34bfa'], ['archived', '已归档的聊天', '#ef5705'],
  ['worktrees', '工作树', '#079a46'], ['other', '其他', '#929292'],
];
const STATUS = { queued: '排队中', running: '运行中', complete: '已完成', cancelled: '已停止', error: '失败', interrupted: '已中断' };
const isRunning = (task) => ['queued', 'running'].includes(task.status);
const errorText = (error) => String(error?.message || error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
const dateText = (date) => new Date(date).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 字节';
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
  return `${index ? (bytes / 1024 ** index).toFixed(1) : bytes} ${['字节', 'KB', 'MB', 'GB', 'TB'][index]}`;
}

function ConfirmAction({ action, busy, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current.showModal(); }, []);
  return <dialog ref={dialogRef} className="storage-confirm" aria-labelledby="storage-confirm-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="storage-confirm-title">{action.title}</h2><p>{action.message}</p>
    <div className="storage-actions"><button className="secondary-button" autoFocus disabled={busy} onClick={onCancel}>取消</button><button className="danger-button" disabled={busy} onClick={onConfirm}>{busy ? '处理中…' : action.label || '确认删除'}</button></div>
  </dialog>;
}

function ManagementRow({ title, description, button, onClick }) {
  return <div className="storage-management-row"><div><strong>{title}</strong><p>{description}</p></div><button className="storage-button" onClick={onClick}>{button}</button></div>;
}

export function StoragePanel({ onOpenWorktree, workspaceRoot, library, busy: chatBusy, historyError, onManageChats, onChooseWorkspace, onRevealWorkspace, onCopyWorkspace }) {
  const [screen, setScreen] = useState('overview');
  const [usage, setUsage] = useState(null);
  const [agents, setAgents] = useState([]);
  const [trees, setTrees] = useState({ trees: [], retainCount: 5 });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [search, setSearch] = useState('');
  const [oldOnly, setOldOnly] = useState(true);
  const [selection, setSelection] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [taskPrompt, setTaskPrompt] = useState('');
  const [parentId, setParentId] = useState(library?.activeId || '');
  const disabled = working || chatBusy;
  const chats = library?.conversations || [];
  const selectedCount = selection.length;
  const filtered = useMemo(() => chats.filter((chat) => Boolean(chat.archivedAt) === (screen === 'archived'))
    .filter((chat) => screen !== 'chats' || !oldOnly || Date.now() - Date.parse(chat.updatedAt) >= 30 * 86400_000)
    .filter((chat) => (chat.title + '\n' + chat.draft + '\n' + chat.messages.map((item) => item.content).join('\n')).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [chats, screen, oldOnly, search]);
  const availableParents = chats.filter((chat) => !chat.archivedAt);
  const actualParent = availableParents.some((chat) => chat.id === parentId) ? parentId : availableParents[0]?.id;

  const refresh = async () => {
    setLoading(true);
    const results = await Promise.allSettled([window.scodex.storageUsage(), window.scodex.listAgents(), window.scodex.listWorktrees()]);
    if (results[0].status === 'fulfilled') setUsage(results[0].value);
    if (results[1].status === 'fulfilled') setAgents(results[1].value);
    if (results[2].status === 'fulfilled') setTrees(results[2].value);
    const errors = results.filter((item) => item.status === 'rejected').map((item) => errorText(item.reason));
    setError(errors.join('；'));
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);
  const runningCount = agents.filter(isRunning).length;
  useEffect(() => {
    if (!runningCount) return;
    let active = true;
    const timer = setInterval(() => window.scodex.listAgents().then((tasks) => { if (active) setAgents(tasks); }).catch((caught) => { clearInterval(timer); if (active) setError(errorText(caught)); }), 1000);
    return () => { active = false; clearInterval(timer); };
  }, [runningCount]);
  const perform = async (operation) => {
    setWorking(true); setError(''); setFeedback('');
    try { await operation(); await refresh(); setSelection([]); setConfirmation(null); }
    catch (caught) { setError(errorText(caught)); setConfirmation(null); }
    finally { setWorking(false); }
  };
  const navigate = (target) => { setScreen(target); setSearch(''); setSelection([]); setExpanded(null); setFeedback(''); };
  const manageChats = (action, ids) => perform(async () => { await onManageChats(action, ids); setFeedback(action === 'archive' ? '已归档，可在“已归档的聊天”恢复。' : action === 'restore' ? '已恢复到对话记录。' : '聊天已删除。子智能体记录可单独查看和清理。'); });
  const confirmChatDelete = (ids) => setConfirmation({ title: '永久删除聊天？', message: `将永久删除 ${ids.length} 个聊天及其草稿，无法恢复。关联的子智能体记录会保留，请先查看后再单独清理。`, run: () => manageChats('delete', ids) });
  const toggle = (id) => setSelection((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <div className="storage-panel" aria-busy={working || loading}>
    {screen !== 'overview' && <button className="storage-back" onClick={() => navigate('overview')}><ArrowLeft size={17} />返回存储空间</button>}
    {error && <div className="storage-alert" role="alert">{error}<button className="icon-button small" aria-label="关闭存储错误" onClick={() => setError('')}><X size={15} /></button></div>}
    {historyError && <p className="storage-alert" role="alert">{historyError} 已暂停聊天管理以保护原文件。</p>}
    {feedback && <p className="storage-feedback" role="status">{feedback}</p>}
    {screen === 'overview' && <>
      <section className="storage-device" aria-label="此设备的存储用量"><h2>此设备</h2><p>管理存储在此电脑上的聊天和工作树</p>
        <div className="storage-total-row"><strong data-testid="storage-total">{usage ? `Scodex 已占用 ${formatBytes(usage.total)}` : loading ? '正在计算存储空间…' : '暂时无法读取存储空间'}</strong><button className="storage-button" aria-label="刷新存储空间" disabled={loading || working} onClick={refresh}>{loading && <RefreshCw size={14} className="storage-spinning" />}{loading ? '计算中' : '刷新'}</button></div>
        <div className={'storage-bar ' + (!usage?.total ? 'storage-bar-empty' : '')} role="img" aria-label={usage ? CATEGORIES.map(([key, label]) => `${label} ${formatBytes(usage.sizes[key])}`).join('，') : '正在计算用量'}>{usage && CATEGORIES.map(([key, label, color]) => usage.sizes[key] > 0 && <span key={key} title={`${label} ${formatBytes(usage.sizes[key])}`} style={{ width: `${usage.sizes[key] / usage.total * 100}%`, backgroundColor: color }} />)}</div>
        <dl className="storage-legend">{CATEGORIES.map(([key, label, color]) => <div key={key}><dt><i style={{ backgroundColor: color }} />{label}</dt><dd data-category={key}>{usage ? formatBytes(usage.sizes[key]) : '—'}</dd></div>)}</dl>
        <p className="storage-path">{usage?.root || '本机数据目录'}</p>
        {usage && <p className="storage-scan-note">{usage.complete ? '按文件大小统计' : '部分统计'} · {dateText(usage.scannedAt)}{usage.compressedAllocation && <><br />压缩聊天按内容比例分摊分类占用，合计为实际压缩字节。</>}{usage.warnings.length > 0 && <><br />{usage.warnings.join(' ')}</>}</p>}
      </section>
      <div className="storage-management storage-cleanup"><ManagementRow title="清理旧聊天" description="永久删除前，请先查看聊天及其子智能体" button="查看" onClick={() => navigate('chats')} /></div>
      <div className="storage-management"><ManagementRow title="管理工作树" description="查看工作副本，并选择要保留的旧工作树数量" button="管理" onClick={() => navigate('worktrees')} /><ManagementRow title="已归档的聊天" description="恢复或删除单个已归档的聊天" button="管理" onClick={() => navigate('archived')} /><ManagementRow title="子智能体" description="创建独立子任务，查看结果并清理本机记录" button="管理" onClick={() => navigate('agents')} /></div>
      <details className="storage-files"><summary>工作文件与存储位置</summary><p>{workspaceRoot}</p><div className="storage-actions"><button className="storage-button" onClick={onChooseWorkspace}>更改工作区</button><button className="storage-button" onClick={onRevealWorkspace}><FolderOpen size={15} />打开工作区</button><button className="storage-button" onClick={onCopyWorkspace}>复制路径</button><button className="storage-button" onClick={() => perform(() => window.scodex.revealData())}>打开数据目录</button></div><p>此处统计当前工作台的数据目录；外部工作区与应用安装文件不计入。聊天、草稿和偏好自动保存，编辑中的文件仍需手动保存。</p></details>
    </>}

    {['chats', 'archived'].includes(screen) && <section className="storage-manager"><h2>{screen === 'chats' ? '清理旧聊天' : '已归档的聊天'}</h2><p>{screen === 'chats' ? '归档可暂时收起聊天，永久删除前请先检查内容和子智能体。' : '归档的聊天保留全部消息与草稿，可随时恢复。'}</p>
      <label className="storage-search"><Search size={17} /><input aria-label="搜索存储聊天" value={search} onChange={(event) => { setSearch(event.target.value); setSelection([]); }} placeholder="搜索聊天标题或内容" /></label>
      {screen === 'chats' && <label className="storage-checkbox"><input type="checkbox" checked={oldOnly} onChange={(event) => { setOldOnly(event.target.checked); setSelection([]); }} />仅显示 30 天前未更新的聊天</label>}
      <div className="storage-list-toolbar"><label className="storage-checkbox"><input type="checkbox" aria-label="选择当前列表全部聊天" checked={filtered.length > 0 && filtered.every((chat) => selection.includes(chat.id))} onChange={(event) => setSelection(event.target.checked ? filtered.map((chat) => chat.id) : [])} disabled={disabled || !!historyError || !filtered.length} />{selectedCount ? `已选 ${selectedCount} 个` : `${filtered.length} 个聊天`}</label><div className="storage-actions"><button className="storage-button" disabled={disabled || !!historyError || !selectedCount} onClick={() => manageChats(screen === 'archived' ? 'restore' : 'archive', selection)}>{screen === 'archived' ? <Undo2 size={15} /> : <Archive size={15} />}{screen === 'archived' ? '恢复所选' : '归档所选'}</button><button className="storage-button storage-danger" disabled={disabled || !!historyError || !selectedCount} onClick={() => confirmChatDelete(selection)}><Trash2 size={15} />删除所选</button></div></div>
      <div className="storage-list">{filtered.map((chat) => { const children = agents.filter((task) => task.parentId === chat.id); return <article className="storage-record" key={chat.id}>
        <div className="storage-record-heading"><label className="storage-checkbox"><input type="checkbox" aria-label={`选择聊天 ${chat.title}`} disabled={disabled || !!historyError} checked={selection.includes(chat.id)} onChange={() => toggle(chat.id)} /><strong>{chat.title}</strong></label><button className="storage-button" onClick={() => setExpanded(expanded === chat.id ? null : chat.id)}>{expanded === chat.id ? '收起' : '查看'}</button></div>
        <p>{chat.messages.length} 条消息 · {children.length} 个子智能体 · {dateText(chat.updatedAt)}</p>
        {expanded === chat.id && <div className="storage-preview">{chat.messages.map((message, index) => <div key={message.id || index}><strong>{message.role === 'user' ? '你' : '助手'}</strong><pre>{message.content}</pre></div>)}{chat.draft && <div><strong>草稿</strong><pre>{chat.draft}</pre></div>}{!chat.messages.length && !chat.draft && <p>尚无消息或草稿。</p>}{children.length > 0 && <div><strong>关联子智能体</strong>{children.map((task) => <p key={task.id}>{task.title} · {STATUS[task.status]}</p>)}<button className="storage-button" onClick={() => navigate('agents')}>查看子智能体记录</button></div>}</div>}
      </article>; })}{!filtered.length && <p className="storage-empty">{screen === 'archived' ? '暂无已归档的聊天' : oldOnly ? '暂无 30 天前的旧聊天，可取消筛选查看全部聊天。' : '没有匹配的聊天'}</p>}</div>
    </section>}

    {screen === 'agents' && <section className="storage-manager"><h2><Bot size={21} />子智能体</h2><p>每个子任务独立调用当前模型并保存结果，只发送下面填写的任务内容。</p>
      <form className="storage-agent-form" onSubmit={(event) => { event.preventDefault(); perform(async () => { await window.scodex.startAgent({ parentId: actualParent, prompt: taskPrompt }); setTaskPrompt(''); setFeedback('子任务已创建，可以离开此页，结果会保存在本机。'); }); }}><label>关联聊天<select aria-label="子任务关联聊天" value={actualParent || ''} onChange={(event) => setParentId(event.target.value)}>{availableParents.map((chat) => <option key={chat.id} value={chat.id}>{chat.title}</option>)}</select></label><label>任务内容<textarea aria-label="子智能体任务" placeholder="描述一个独立任务，例如：为下面的需求整理验收条件……" value={taskPrompt} maxLength={16000} onChange={(event) => setTaskPrompt(event.target.value)} rows={4} /></label><button className="storage-button" type="submit" disabled={working || !!historyError || !actualParent || !taskPrompt.trim() || runningCount >= 3}><Play size={15} />运行子智能体</button></form>
      <div className="storage-list-toolbar"><span>{agents.length} 个任务 · {runningCount} 个运行中</span><button className="storage-button" disabled={loading || working} onClick={refresh}><RefreshCw size={15} />刷新记录</button></div>
      <div className="storage-list">{agents.map((task) => <article className="storage-record" key={task.id}><div className="storage-record-heading"><strong>{task.title}</strong><span className={'storage-task-status status-' + task.status}>{STATUS[task.status] || task.status}</span></div><p>{chats.find((chat) => chat.id === task.parentId)?.title || '原聊天已删除'} · {dateText(task.createdAt)}</p><div className="storage-actions"><button className="storage-button" onClick={() => setExpanded(expanded === task.id ? null : task.id)}>{expanded === task.id ? '收起' : '查看任务'}</button>{isRunning(task) ? <button className="storage-button" disabled={working} onClick={() => perform(() => window.scodex.cancelAgent(task.id))}><Square size={14} />停止</button> : <><button className="storage-button" disabled={working || !actualParent || runningCount >= 3} onClick={() => perform(() => window.scodex.startAgent({ prompt: task.prompt, parentId: chats.some((chat) => chat.id === task.parentId && !chat.archivedAt) ? task.parentId : actualParent }))}>重新运行</button><button className="storage-button storage-danger" disabled={working} onClick={() => setConfirmation({ title: '删除子智能体记录？', message: `将永久删除“${task.title}”的任务和结果。`, run: () => perform(() => window.scodex.removeAgents([task.id])) })}>删除</button></> }</div>{expanded === task.id && <div className="storage-preview"><strong>任务</strong><pre>{task.prompt}</pre>{task.result && <><strong>结果</strong><pre>{task.result}</pre></>}{task.error && <p className="storage-error-text" role="alert">{task.error}</p>}{isRunning(task) && <p role="status">正在处理，可停止任务或稍后查看。</p>}</div>}</article>)}{!agents.length && <p className="storage-empty">暂无子智能体记录</p>}</div>
    </section>}

    {screen === 'worktrees' && <section className="storage-manager"><h2><GitBranch size={21} />管理工作树</h2><p>从本地 Git 仓库创建独立工作副本。只管理在此处创建的工作树。</p><div className="storage-actions"><button className="storage-button" disabled={working} onClick={() => perform(() => window.scodex.createWorktree(true))}>从当前工作区创建</button><button className="storage-button" disabled={working} onClick={() => perform(() => window.scodex.createWorktree(false))}><FolderOpen size={15} />选择仓库创建</button><button className="storage-button" disabled={working || loading} onClick={refresh}><RefreshCw size={15} />刷新工作树</button></div>
      <div className="storage-retention"><label>保留最新工作树数量<select aria-label="保留工作树数量" disabled={working} value={trees.retainCount} onChange={(event) => perform(() => window.scodex.setWorktreeRetention(Number(event.target.value)))}>{Array.from({ length: 21 }, (_, value) => <option key={value} value={value}>{value} 个</option>)}</select></label><p>只在点击清理并确认后删除超出数量的旧副本；有修改或新增提交的工作树会保留。</p><button className="storage-button storage-danger" disabled={working || trees.trees.length <= trees.retainCount} onClick={() => { const ids = [...trees.trees].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(trees.retainCount).map((tree) => tree.id); setConfirmation({ title: '清理旧工作树？', label: '确认清理', message: `将检查 ${ids.length} 个旧工作树，只删除未修改、未新增提交且未被使用的副本。`, run: () => perform(async () => { const results = await window.scodex.cleanupWorktrees(ids); setFeedback(`已清理 ${results.filter((item) => item.removed).length} 个；保留 ${results.filter((item) => !item.removed).length} 个。`); const errors = results.filter((item) => !item.removed); if (errors.length) setFeedback((current) => current + ' ' + errors.map((item) => item.error).join('；')); }) }); }}>清理超出数量的副本</button></div>
      <div className="storage-list">{trees.trees.map((tree) => <article className="storage-record" key={tree.id}><div className="storage-record-heading"><strong>{tree.name}</strong><span>{tree.error ? '不可用' : tree.current ? '当前工作区' : tree.dirty ? '有本地内容' : tree.changedHead ? '有新提交' : '干净'}</span></div><p>{tree.path}</p><p>{dateText(tree.createdAt)} · {tree.head.slice(0, 8)}</p>{tree.error && <p className="storage-error-text">{tree.error}</p>}<div className="storage-actions"><button className="storage-button" disabled={working || chatBusy || !!tree.error || tree.current} onClick={() => perform(() => onOpenWorktree(tree.id))}>作为项目打开</button><button className="storage-button" disabled={working || !!tree.error} onClick={() => perform(() => window.scodex.revealWorktree(tree.id))}><FolderOpen size={15} />打开文件夹</button><button className="storage-button storage-danger" disabled={working || !!tree.error || tree.current || tree.dirty || tree.changedHead} onClick={() => setConfirmation({ title: '删除工作树？', message: `将从磁盘删除“${tree.name}”。原始仓库保留，存在本地内容时会拒绝删除。`, run: () => perform(() => window.scodex.removeWorktree(tree.id)) })}>删除副本</button></div></article>)}{!trees.trees.length && <p className="storage-empty">暂无工作树，先选择 Git 仓库创建工作副本。</p>}</div>
    </section>}
    {confirmation && <ConfirmAction action={confirmation} busy={working} onCancel={() => setConfirmation(null)} onConfirm={confirmation.run} />}
  </div>;
}
