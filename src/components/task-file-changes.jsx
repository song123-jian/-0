import React, { useEffect, useState } from 'react';
import { FileCode2, ChevronDown, ChevronRight, Undo2 } from 'lucide-react';

export function TaskFileChanges({ record, conversationId, disabled }) {
  const [data, setData] = useState(record.files ? record : null);
  const [expanded, setExpanded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [loadedDiff, setLoadedDiff] = useState(false);
  const details = (summaryOnly = false) => window.scodex ? window.scodex.taskChangeDetails(record.id, conversationId, { summaryOnly }) : window.scodexWindow.action({ type: 'change-details', changeId: record.id, summaryOnly });
  useEffect(() => { let active = true; setLoadedDiff(false); setExpanded(false); details(true).then(value => { if (active) setData(value); }).catch(() => { if (active) setError('文件修改记录不可用，请查看操作记录。'); }); return () => { active = false; }; }, [record.id, conversationId]);
  async function toggleDiff() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true); if (loadedDiff) return;
    try { setData(await details()); setLoadedDiff(true); setError(''); }
    catch { setError('文件差异无法读取，请重试。'); }
  }
  async function undo() {
    if (!window.confirm('撤销本次任务的文件修改？已有的用户内容会恢复，任务中新建的文件会删除；发现后续修改时停止撤销。')) return;
    setBusy(true); setError('');
    try { const value = window.scodex ? await window.scodex.undoTaskChanges(record.id, conversationId) : await window.scodexWindow.action({ type: 'change-undo', changeId: record.id }); setData(previous => ({ ...previous, ...value, files: previous.files })); }
    catch (cause) { setError(String(cause.message || cause).replace(/^Error invoking remote method '[^']+': /, '')); try { setData(await details()); } catch {} }
    finally { setBusy(false); }
  }
  if (!data) return <div className="task-changes-notice" role="status">{error || '正在读取文件修改…'}</div>;
  const added = data.files.reduce((sum, file) => sum + (file.added || 0), 0), removed = data.files.reduce((sum, file) => sum + (file.removed || 0), 0);
  const incomplete = !!data.warning || data.coverage?.complete === false;
  const unknownLines = data.files.some(file => file.added === null || file.removed === null);
  const reasons = { entries: '条目上限', bytes: '快照容量', time: '扫描时限', large: '大文件', unreadable: '无法读取', changed: '读取期间变化', link: '目录联接', storage: '加密存储不可用' };
  return <section className="task-file-changes" aria-label="本次任务文件修改">
    <div className="task-changes-heading"><strong>{incomplete && !data.files.length ? "修改情况未完整确认" : (incomplete ? "已确认修改 " : "已修改 ") + data.files.length + " 个文件"}</strong>{data.files.length > 0 && <>{(incomplete || unknownLines) && <span>已确认行数</span>}<span className="task-lines-added" aria-label={"已确认新增 " + added + " 行"}>+{added}</span><span className="task-lines-removed" aria-label={"已确认删除 " + removed + " 行"}>−{removed}</span></>}{data.undone && <span>已撤销</span>}</div>
    <div className="task-change-files">{data.files.map(file => <div key={file.path}><div className="task-change-file"><FileCode2 size={15} aria-hidden="true"/><span className="task-change-path">{file.path}</span>{file.added === null ? <span>未计行数</span> : <><span className="task-lines-added">+{file.added}</span><span className="task-lines-removed">−{file.removed}</span></>}</div>{expanded && <pre className="task-change-diff" aria-label={`${file.path} 文件差异`} tabIndex={0}>{(file.diff || '正在读取差异…').split(String.fromCharCode(10)).map((line, index) => <span key={index} className={line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : ''}>{line || ' '}</span>)}</pre>}</div>)}</div>
    {incomplete && data.coverage && <p className="task-changes-notice">已跳过 {data.coverage.skippedFiles} 项；{Object.entries(data.coverage.reasons || {}).map(([key, count]) => (reasons[key] || key) + " " + count).join("、")}{(data.coverage.reasons?.entries || data.coverage.reasons?.time) ? "；其余文件数量未确认" : ""}。依赖、构建产物和受保护路径不在命令记录范围内。</p>}
    {data.warning && <p className="task-changes-notice">{data.warning}</p>}{error && <p className="task-changes-notice message-error" role="alert">{error}</p>}
    <div className="task-changes-actions"><button type="button" className="text-tool" disabled={!data.files.length} aria-expanded={expanded} onClick={toggleDiff}>{expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>} {expanded ? '收起更改' : '查看更改'}</button><button type="button" className="text-tool" disabled={disabled || busy || data.undone || data.unavailable || incomplete} onClick={undo}><Undo2 size={14}/>{busy ? '正在撤销…' : data.undone ? '已撤销' : '撤销'}</button></div>
  </section>;
}
