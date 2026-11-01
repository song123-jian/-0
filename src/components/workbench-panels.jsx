import React, { useMemo, useState } from 'react';
import { Archive, ArrowRight, BookOpen, Braces, Check, Clipboard, Clock3, FileCode2, FileSpreadsheet, FolderOpen, Image, LayoutGrid, ListTodo, MessageSquare, Pencil, Pin, Plus, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { WORK_MODES, workMode } from '../lib/modes.js';

const MODE_ICONS = { answer: MessageSquare, plan: ListTodo, code: Braces, office: FileSpreadsheet };
export function ModeIcon({ mode, size = 18 }) {
  const Icon = MODE_ICONS[mode] || MessageSquare;
  return <Icon size={size} strokeWidth={1.8} />;
}

export function Dashboard({ projectName }) {
  return <div className="workspace-home">
    <div className="workspace-home-content"><div className="workspace-home-mark"><Sparkles size={27} /></div><h1>我们应该在 Scodex 中做些什么？</h1><p>项目：{projectName || '当前工作区'} · 由 AI 自动选择处理方式</p></div>
  </div>;
}

export function RecentPanel({ conversations, activeId, busy, runningIds = [], onSelect, onNew, projectName, archived = false, onToggleArchived, onContextMenu, onContextKey }) {
  const filtered = useMemo(() => [...conversations].sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt))), [conversations]);
  return <section className="tool-view history-view recent-view"><div className="tool-heading"><div><h1>最近</h1><p>{projectName || '当前项目'} · 最近使用的对话</p></div><button className="primary-button" onClick={onNew} disabled={busy}><Plus size={16} />新建对话</button></div>
    <div className="history-content"><button type="button" className="secondary-button recent-archive-toggle" onClick={onToggleArchived}><Archive size={16}/>{archived ? '返回最近聊天' : '已归档聊天'}</button><div className="recent-panel-note"><Clock3 size={16} />项目切换后，最近列表会自动跟随当前项目更新。</div>
      <div className="history-list">{filtered.map((chat) => <article key={chat.id} data-chat-id={chat.id} tabIndex={0} onContextMenu={e=>onContextMenu?.(e,chat.id)} onKeyDown={e=>onContextKey?.(e,chat.id)} className={`history-card ${chat.id === activeId ? 'selected' : ''}`}>
        <div className={`history-mode mode-${chat.mode}`}><ModeIcon mode={chat.mode} /></div>
        <div className="history-card-main"><button className="history-open" onClick={() => onSelect(chat.id)} disabled={busy}><strong>{chat.pinned && <Pin size={13} />}{chat.title}</strong><span>{chat.messages.filter((item) => item.role === 'user').at(-1)?.content?.slice(0, 140) || chat.draft || '尚未发送消息'}</span></button><div className="history-meta">{runningIds.includes(chat.id) && <span className="chat-run-badge">运行中</span>}{chat.unreadResult && <span className="chat-unread-badge">有新结果</span>}<span>{workMode(chat.mode).label}</span><span>{chat.messages.length} 条消息</span><span><Clock3 size={12} />{new Date(chat.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div></div>
      </article>)}</div>{!filtered.length && <div className="history-empty"><Clock3 size={26} /><p>当前项目还没有最近对话。</p></div>}
    </div></section>;
}

export function HistoryPanel({ conversations, activeId, busy, onSelect, onNew, onRename, onDelete, onPin, onArchive }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState(null);
  const filtered = useMemo(() => conversations.filter((chat) => `${chat.title}\n${chat.messages.map((item) => item.content).join('\n')}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)), [conversations, search]);
  return <section className="tool-view history-view"><div className="tool-heading"><div><h1>对话记录</h1><p>按任务保留上下文，保存在当前电脑</p></div><button className="primary-button" onClick={onNew} disabled={busy}><Plus size={16} />新建对话</button></div>
    <div className="history-content"><label className="history-search"><Search size={17} /><input aria-label="搜索对话" placeholder="搜索标题或对话内容" value={search} onChange={(event) => setSearch(event.target.value)} /><span>{filtered.length} 个对话</span></label>
      {busy && <p className="history-hint">生成结束或停止后，可切换和管理对话。</p>}
      <div className="history-list">{filtered.map((chat) => <article key={chat.id} className={`history-card ${chat.id === activeId ? 'selected' : ''}`}>
        <div className={`history-mode mode-${chat.mode}`}><ModeIcon mode={chat.mode} /></div>
        <div className="history-card-main">{editing === chat.id ? <form className="history-rename" onSubmit={(event) => { event.preventDefault(); if (title.trim()) { onRename(chat.id, title.trim()); setEditing(null); } }}><input aria-label="对话标题" autoFocus maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} /><button className="icon-button small" title="保存标题" aria-label="保存标题" disabled={!title.trim()}><Check size={15} /></button><button className="icon-button small" type="button" aria-label="取消重命名" onClick={() => setEditing(null)}><X size={15} /></button></form> : <button className="history-open" onClick={() => onSelect(chat.id)} disabled={busy}><strong>{chat.pinned && <Pin size={13} />}{chat.title}</strong><span>{chat.messages.filter((item) => item.role === 'user').at(-1)?.content.slice(0, 140) || chat.draft || '尚未发送消息'}</span></button>}
          <div className="history-meta"><span>{workMode(chat.mode).label}</span><span>{chat.messages.length} 条消息</span><span><Clock3 size={12} />{new Date(chat.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div></div>
        <div className="history-actions">{deleting === chat.id ? <><span>删除此对话？</span><button className="danger-button" disabled={busy} onClick={() => { onDelete(chat.id); setDeleting(null); }}>确认删除</button><button className="text-tool" onClick={() => setDeleting(null)}>取消</button></> : <><button className={`icon-button ${chat.pinned ? 'is-pinned' : ''}`} disabled={busy} aria-label={chat.pinned ? '取消置顶' : '置顶对话'} onClick={() => onPin(chat.id)} title="置顶"><Pin size={15} /></button><button className="icon-button" disabled={busy} aria-label={`重命名 ${chat.title}`} title="重命名" onClick={() => { setEditing(chat.id); setTitle(chat.title); }}><Pencil size={15} /></button><button className="icon-button" disabled={busy} aria-label={`归档 ${chat.title}`} title="归档" onClick={() => onArchive(chat.id)}><Archive size={15} /></button><button className="icon-button" disabled={busy} aria-label={`删除 ${chat.title}`} title="删除" onClick={() => setDeleting(chat.id)}><Trash2 size={15} /></button></>}</div>
      </article>)}</div>{!filtered.length && <div className="history-empty"><Search size={26} /><p>没有匹配的对话，试试其他关键词。</p></div>}
    </div></section>;
}

