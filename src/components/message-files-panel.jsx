import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, FolderOpen, LoaderCircle, RotateCw, Search } from 'lucide-react';
import { MessageContent } from './message-content.jsx';
import { messagePathName } from '../lib/message-paths.js';
const readable = error => String(error.message || error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
const parent = value => value.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '') || value;

export function MessageFilesPanel({ workspaceRoot, request, onPath }) {
  const [grant, setGrant] = useState(null);
  const [directory, setDirectory] = useState('');
  const [listing, setListing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setListing(null); setSelected(null); setPreview(null); setGrant(null); setQuery(''); setNotice('');
    window.scodex.locateMessagePath(request?.path || workspaceRoot, Boolean(request?.path)).then(result => {
      if (!current) return;
      setGrant(result); setDirectory(result.directory); setNotice(result.notice);
    }).catch(caught => { if (current) { setError(readable(caught)); setLoading(false); } });
    return () => { current = false; };
  }, [request?.id, workspaceRoot]);
  useEffect(() => {
    if (!grant) return;
    let current = true;
    setLoading(true); setError(''); setListing(null); setSelected(null); setPreview(null);
    window.scodex.listMessageDirectory(grant.id, directory).then(result => {
      if (!current) return;
      setListing(result);
      const target = result.items.find(item => item.path.toLowerCase() === grant.selectedPath.toLowerCase());
      setSelected(target || null);
    }).catch(caught => { if (current) setError(readable(caught)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [grant?.id, directory, refresh]);
  useEffect(() => {
    let current = true;
    setPreview(null); setSource(false);
    if (selected && !selected.directory && grant) window.scodex.previewMessageFile(grant.id, selected.path).then(result => { if (current) setPreview(result); }).catch(caught => { if (current) { setError(readable(caught)); setPreview({ kind: 'error', note: readable(caught) }); } });
    return () => { current = false; };
  }, [grant?.id, selected?.path]);
  const act = async operation => { try { setError(''); await operation(); } catch (caught) { setError(readable(caught)); } };
  const reveal = () => grant && act(() => window.scodex.revealMessageFile(grant.id, selected?.path || directory));
  const open = () => selected && grant && act(() => window.scodex.openMessageFile(grant.id, selected.path));
  const atRoot = !grant || directory.toLowerCase() === grant.root.toLowerCase();
  const items = (listing?.items || []).filter(item => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="workspace-file-tool message-files-panel" aria-label="工作区文件">
    <div className="workspace-file-toolbar"><button type="button" className="workspace-root-button" title="打开项目工作区" onClick={() => onPath(workspaceRoot)}><FolderOpen size={15} />项目</button><span className="workspace-path-label" title={messagePathName(directory || request?.path)}>{messagePathName(directory || request?.path)}</span><button className="icon-button" aria-label="刷新当前目录" disabled={!grant || loading} onClick={() => setRefresh(value => value + 1)}><RotateCw size={16} /></button><button className="icon-button" aria-label="在资源管理器中定位" disabled={!grant} onClick={reveal}><ExternalLink size={16} /></button></div>
    {error && <p className="workspace-file-status error" role="alert">{error}</p>}{notice && <p className="workspace-file-status" role="status">{notice}</p>}
    <div className="workspace-file-columns">
      <div className="message-file-preview" aria-label="文件预览">
        {selected ? <><div className="message-file-preview-toolbar"><strong title={'附件：' + selected.name}>{selected.name}</strong>{preview?.kind === 'markdown' && <button type="button" className="text-tool" onClick={() => setSource(!source)}>{source ? '显示预览' : '查看源代码'}</button>}<button type="button" className="text-tool" onClick={open}>打开</button></div>
          <div className="message-file-preview-body">{!preview ? <LoaderCircle size={18} className="spin" /> : preview.kind === 'markdown' && !source ? <MessageContent content={preview.content} onPath={onPath} /> : ['text', 'markdown'].includes(preview.kind) ? <pre>{preview.content}</pre> : preview.kind === 'image' ? <img src={preview.dataUrl} alt={selected.name} /> : <div className="workspace-file-preview"><FileText size={30} /><strong>{selected.name}</strong><p>{preview.note || '此格式可通过“打开”交给系统应用查看。'}</p></div>}{preview?.truncated && <p role="status">仅显示前 128,000 个字符。</p>}</div></> : <div className="workspace-file-preview"><FolderOpen size={28} /><strong>文件预览</strong><p>选择右侧文件查看内容</p></div>}
      </div>
      <div className="workspace-file-list-pane"><label className="workspace-file-search"><Search size={15} /><input aria-label="筛选文件" placeholder="筛选文件…" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="workspace-file-location"><button type="button" aria-label="返回上级目录" disabled={atRoot} onClick={() => setDirectory(parent(directory))}><ChevronLeft size={15} /></button><span title={messagePathName(directory)}>{messagePathName(directory)}</span></div>
        {loading && <div className="workspace-file-status"><LoaderCircle size={16} className="spin" />正在读取目录</div>}
        {!loading && listing && <div className="workspace-file-items" role="listbox" aria-label="工作区文件列表">{items.map(item => <button type="button" role="option" aria-selected={selected?.path === item.path} key={item.path} className={'workspace-file-entry' + (selected?.path === item.path ? ' selected' : '')} onClick={() => { setError(''); if (item.directory) { setDirectory(item.path); setQuery(''); } else setSelected(item); }} onDoubleClick={() => { if (!item.directory) act(() => window.scodex.openMessageFile(grant.id, item.path)); }}><span className="workspace-file-entry-icon">{item.directory ? <FolderOpen size={15} /> : <FileText size={15} />}</span><span>{item.name}</span>{item.directory && <ChevronRight size={14} />}</button>)}{!items.length && <p className="workspace-file-empty">{query ? '没有匹配的文件' : '此目录为空'}</p>}{listing.truncated && <p role="status">部分目录项未显示。</p>}</div>}
      </div>
    </div>
  </section>;
}
