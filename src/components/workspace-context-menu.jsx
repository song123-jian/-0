import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, ArchiveRestore, ArrowUpRight, BookOpen, Check, ChevronRight, Copy, Eye, FileText, FolderOpen, GitFork, Image, LoaderCircle, MessageSquare, MessageSquarePlus, Paperclip, Pencil, Pin, PinOff, Trash2, X, PanelsTopLeft } from 'lucide-react';

const ICONS = { rename: Pencil, pin: Pin, unpin: PinOff, unread: Eye, project: FolderOpen, fork: GitFork, copy: Copy, window: PanelsTopLeft, open: ArrowUpRight, archive: Archive, restore: ArchiveRestore, delete: Trash2, new: MessageSquarePlus, attach: Paperclip, chat: MessageSquare, folder: FolderOpen, snapshot: PanelsTopLeft, file: FileText, image: Image, skill: BookOpen };
export function WorkspaceContextMenu({ target, entries, onAction, onClose, theme }) {
  const rootRef = useRef(null), childRef = useRef(null), parentRef = useRef(null);
  const [position, setPosition] = useState({ x: target.x, y: target.y }), [submenu, setSubmenu] = useState(null);
  const focusFirst = node => node?.querySelector('[role=menuitem]:not(:disabled)')?.focus();
  useLayoutEffect(() => {
    const rect = rootRef.current.getBoundingClientRect();
    setPosition({ x: Math.max(8, Math.min(target.x, innerWidth - rect.width - 8)), y: Math.max(8, Math.min(target.y, innerHeight - rect.height - 8)) });
    focusFirst(rootRef.current);
  }, [target]);
  useEffect(() => {
    const dismiss = e => { if (!rootRef.current?.contains(e.target) && !childRef.current?.contains(e.target)) onClose(); };
    const blur = () => onClose();
    document.addEventListener('pointerdown', dismiss); window.addEventListener('resize', blur); window.addEventListener('blur', blur);
    return () => { document.removeEventListener('pointerdown', dismiss); window.removeEventListener('resize', blur); window.removeEventListener('blur', blur); };
  }, [onClose]);
  useLayoutEffect(() => { if (submenu?.keyboard) focusFirst(childRef.current); }, [submenu]);
  function open(entry, element, keyboard = false) {
    const r = element.getBoundingClientRect(); parentRef.current = element;
    setSubmenu({ entry, keyboard, x: r.right + 3 + 270 > innerWidth ? Math.max(8, r.left - 273) : r.right + 3, y: Math.max(8, Math.min(r.top - 5, innerHeight - Math.min(420, entry.children.length * 42 + 12) - 8)) });
  }
  function keys(event) {
    if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault(); const menu = event.target.closest('[role=menu]'), items = [...menu.querySelectorAll(':scope > [role=menuitem]:not(:disabled)')], index = items.indexOf(event.target);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[next]?.focus();
    } else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    else if (event.key === 'ArrowLeft' && childRef.current?.contains(event.target)) { event.preventDefault(); setSubmenu(null); parentRef.current?.focus(); }
    else if (event.key === 'ArrowRight') {
      const entry = entries.find(e => e.id === event.target.dataset.action);
      if (entry?.children) { event.preventDefault(); open(entry, event.target, true); }
    }
  }
  const rows = (items, child = false) => items.map(entry => {
    if (entry.separator) return <div className="workspace-menu-separator" role="separator" key={entry.id} />;
    const Icon = ICONS[entry.icon] || Copy;
    return <button key={entry.id} type="button" role="menuitem" className={'workspace-menu-item' + (entry.danger ? ' danger' : '')} disabled={entry.disabled}
      title={entry.reason || entry.label} data-action={entry.id} aria-haspopup={entry.children ? 'menu' : undefined} aria-expanded={entry.children ? submenu?.entry.id === entry.id : undefined}
      onPointerEnter={event => { if (!child) entry.children ? open(entry, event.currentTarget) : setSubmenu(null); }}
      onClick={event => { if (entry.children) open(entry, event.currentTarget, true); else onAction(entry.id); }}>
      {entry.checked ? <Check size={16} /> : <Icon size={16} />}<span>{entry.label}</span>{entry.shortcut && <kbd>{entry.shortcut}</kbd>}{entry.children && <ChevronRight size={15} />}
    </button>;
  });
  return createPortal(<><div ref={rootRef} data-theme={theme} className="workspace-context-menu" role="menu" aria-label={target.kind === 'chat' ? '聊天右键菜单' : '项目右键菜单'} style={{ left: position.x, top: position.y }} onKeyDown={keys} onContextMenu={e => e.preventDefault()}>{rows(entries)}</div>
    {submenu && <div ref={childRef} data-theme={theme} className="workspace-context-menu workspace-submenu" role="menu" aria-label={submenu.entry.label} style={{ left: submenu.x, top: submenu.y }} onKeyDown={keys}>{rows(submenu.entry.children, true)}</div>}</>, document.body);
}

export function WorkspaceActionDialog({ state, onClose, onConfirm, onChooseDirectory, theme }) {
  const [value, setValue] = useState(state.value || ''), [directory, setDirectory] = useState(state.directory || ''), [format, setFormat] = useState('md');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), formRef = useRef(null);
  useEffect(() => { (formRef.current?.querySelector('input,select') || formRef.current?.querySelector('.workspace-action-footer button'))?.focus(); }, []);
  const destructive = state.type === 'delete';
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { await onConfirm({ value, directory, format }); onClose(); } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  return createPortal(<div data-theme={theme} className="modal-backdrop workspace-action-backdrop" onMouseDown={e => { if(e.target===e.currentTarget&&!busy)onClose(); }}>
    <form ref={formRef} className="workspace-action-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-action-title" onSubmit={submit} onKeyDown={e => {
      if(e.key==='Escape'&&!busy){e.preventDefault();onClose();}
      if(e.key==='Tab'){const items=[...e.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')],i=items.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&i===items.length-1){e.preventDefault();items[0]?.focus();}}
    }}>
      <div className="workspace-action-heading"><h2 id="workspace-action-title">{state.type==='rename'?'重命名':state.type==='export'?'导出聊天':'永久删除'}</h2><button type="button" className="icon-button" aria-label="关闭操作对话框" disabled={busy} onClick={onClose}><X size={18}/></button></div>
      <p>{state.description}</p>
      {state.type==='rename' && <label>名称<input aria-label="新名称" value={value} maxLength={state.kind==='project'?80:100} required disabled={busy} onFocus={e=>e.target.select()} onChange={e=>setValue(e.target.value)}/></label>}
      {state.type==='export' && <><label>导出格式<select aria-label="导出格式" value={format} disabled={busy} onChange={e=>setFormat(e.target.value)}><option value="md">Markdown（.md）</option><option value="txt">纯文本（.txt）</option></select></label><label>导出文件夹<div className="workspace-export-directory"><input aria-label="导出文件夹" placeholder="留空保存到本机 Scodex 导出文件夹" value={directory} disabled={busy} onChange={e=>setDirectory(e.target.value)}/><button type="button" className="secondary-button" disabled={busy} onClick={async()=>{try{const p=await onChooseDirectory();if(p)setDirectory(p);}catch(e){setError(e.message);}}}><FolderOpen size={16}/>选择</button></div></label><small>保存为新文件，不覆盖同名文件；图片和附件以名称列出。</small></>}
      {destructive && <div className="workspace-delete-warning"><Trash2 size={18}/><span>{state.warning}</span></div>}
      {error&&<p className="workspace-action-error" role="alert">{error}</p>}
      <div className="workspace-action-footer"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>取消</button><button className={'primary-button'+(destructive?' danger-button':'')} disabled={busy||state.type==='rename'&&!value.trim()}>{busy&&<LoaderCircle className="spin" size={16}/>} {destructive?'永久删除':state.type==='export'?'保存导出':'保存'}</button></div>
    </form>
  </div>, document.body);
}
