import React, { useEffect, useState } from 'react';
import { Check, ChevronRight, CircleAlert, FileCode2, ListChecks, LoaderCircle, ShieldAlert, Terminal, X } from 'lucide-react';
import { operationCaption } from '../lib/message-presentation.js';

function Status({ status, name }) {
  if (status === 'running') return <LoaderCircle size={16} className="spin" />;
  if (status === 'succeeded') return name === 'run_command' ? <Terminal size={16} /> : <Check size={16} />;
  if (status === 'failed') return <CircleAlert size={16} />;
  return <X size={16} />;
}

function Operation({ operation, index, onOpenFile, onBrowser, onServices }) {
  const caption = operationCaption(operation);
  const preview = operation.detail?.split('\n')[0] || operation.path || '';
  return <details className={'agent-operation ' + operation.status}>
    <summary aria-label={caption + (preview ? ' ' + preview : '')}>
      <span className="agent-operation-status"><Status status={operation.status} name={operation.name} /></span>
      <span className="agent-operation-title"><span>{caption}</span>{preview && <small title={preview}>{preview}</small>}</span>
      <ChevronRight size={15} className="agent-chevron" />
    </summary>
    <div className="agent-operation-body">
      {operation.name === 'run_command' && <div className="agent-command-line"><Terminal size={16} /><code>{operation.detail}</code></div>}
      {operation.path && <div className="agent-operation-path">{operation.path}</div>}
      {operation.diff && <pre className="agent-diff" aria-label={'文件差异 ' + (index + 1)}>{operation.diff.split('\n').map((line, i) => <span className={line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : ''} key={i}>{line}</span>)}</pre>}
      {operation.output && <pre className="agent-operation-output" aria-label={'操作输出 ' + (index + 1)}>{operation.output}</pre>}
      {operation.screenshot && <figure className="agent-web-screenshot"><img src={operation.screenshot.dataUrl} alt={operation.name?.startsWith('image_') ? '获准处理的项目图片' : '获准截取的网页视口'} loading="lazy" /><figcaption>{operation.name?.startsWith('image_') ? '本轮项目图片' : '本轮网页截图'}</figcaption></figure>}
      {operation.name?.startsWith('browser_') && onBrowser && <button className="text-tool" onClick={onBrowser}>在第三工作台查看网页</button>}
      {operation.name?.startsWith('service_') && onServices && <button className="text-tool" onClick={onServices}>查看运行与预览</button>}
      {operation.exitCode !== undefined && <p className="agent-exit-code">退出码：{operation.exitCode === null ? '进程已终止' : operation.exitCode}{operation.truncated ? ' · 输出显示已截断' : ''}</p>}
      {operation.path && ['write_file', 'edit_file', 'read_file', 'spreadsheet_read', 'spreadsheet_edit', 'image_read', 'image_edit'].includes(operation.name) && onOpenFile && <button className="text-tool" onClick={() => onOpenFile(operation.path)}><FileCode2 size={16} />{operation.name?.startsWith('spreadsheet_') ? '在表格中查看' : operation.name?.startsWith('image_') ? '在图片中查看' : '在编辑器查看'}</button>}
    </div>
  </details>;
}

export function AgentActivity({ operations = [], approval, onApproval, onOpenFile, onBrowser, onServices }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasUrgentActivity = Boolean(approval || operations.some((item) => item.status !== 'succeeded'));
  const [expanded, setExpanded] = useState(hasUrgentActivity);
  useEffect(() => {
    if (hasUrgentActivity) setExpanded(true);
    else setExpanded(false);
  }, [hasUrgentActivity]);
  const plan = [...operations].reverse().find((item) => item.plan?.length)?.plan;
  const changes = new Map();
  for (const item of operations) {
    if (!item.path || !item.diff || item.status !== 'succeeded') continue;
    const entry = changes.get(item.path) || { path: item.path, added: 0, removed: 0 };
    entry.added += item.diff.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')).length;
    entry.removed += item.diff.split('\n').filter((line) => line.startsWith('-') && !line.startsWith('---')).length;
    changes.set(item.path, entry);
  }
  // Only completed older work is folded. Failures and running work stay visible.
  const folded = operations.length > 6 ? operations.slice(0, -4).filter((item) => item.status === 'succeeded') : [];
  const foldedIds = new Set(folded.map((item) => item.id));
  const visible = operations.filter((item) => !foldedIds.has(item.id));
  const renderOperation = (operation) => <Operation key={operation.id} operation={operation} index={operations.indexOf(operation)} onOpenFile={onOpenFile} onBrowser={onBrowser} onServices={onServices} />;
  const decide = async (allowed) => {
    if (!approval || busy) return;
    setBusy(true); setError('');
    try { await onApproval(approval.id, allowed); } catch (value) { setError(value?.message || '审批未能提交'); }
    finally { setBusy(false); }
  };
  if (!operations.length && !approval) return null;
  const labels = operations.map(operationCaption).filter(Boolean);
  const summaryLabel = labels.length <= 2 ? labels.join(' · ') : `${labels.slice(0, 2).join(' · ')} · 其他 ${labels.length - 2} 项`;
  const summaryStatus = approval || operations.some((item) => item.status === 'running') ? 'running' : operations.some((item) => item.status === 'failed') ? 'failed' : operations.some((item) => ['cancelled', 'interrupted'].includes(item.status)) ? 'cancelled' : 'succeeded';
  const summaryIcon = summaryStatus === 'running' ? <LoaderCircle size={16} className="spin" /> : summaryStatus === 'failed' ? <CircleAlert size={16} /> : summaryStatus === 'cancelled' ? <X size={16} /> : <ListChecks size={16} />;
  return <section className="agent-activity" aria-label="任务执行记录">
    <details className="agent-activity-shell" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary className="agent-activity-summary" aria-label={`任务执行记录：${summaryLabel || '已完成'}`}>
        <span className={'agent-activity-summary-icon ' + summaryStatus}>{summaryIcon}</span>
        <span className="agent-activity-summary-title">{summaryLabel || '已完成操作'}</span>
        <small>{operations.length ? `${operations.length} 项` : '待审批'}</small>
        <ChevronRight size={15} className="agent-chevron" />
      </summary>
      <div className="agent-activity-details">
        {plan && <details className="agent-plan-summary"><summary><ListChecks size={16} /><span>任务计划</span><small>{plan.filter((step) => step.status === 'completed').length}/{plan.length} 已完成</small><ChevronRight size={15} className="agent-chevron" /></summary><ol className="agent-plan" aria-label="任务计划">{plan.map((step, index) => <li key={index} className={step.status}><span>{step.status === 'completed' ? <Check size={15} /> : step.status === 'in_progress' ? <LoaderCircle size={15} className="spin" /> : index + 1}</span>{step.text}</li>)}</ol></details>}
        <div className="agent-operations">
          {folded.length > 0 && <details className="agent-earlier-operations"><summary><ChevronRight size={15} className="agent-chevron" />较早的 {folded.length} 项操作</summary>{folded.map(renderOperation)}</details>}
          {visible.map(renderOperation)}
        </div>
        {changes.size > 0 && <details className="agent-changes-summary"><summary><FileCode2 size={16} /><span>{changes.size} 个文件已修改</span><ChevronRight size={15} className="agent-chevron" /></summary><ul>{[...changes.values()].map((item) => <li key={item.path}><button className="text-tool" disabled={!onOpenFile} onClick={() => onOpenFile(item.path)}>{item.path}</button><span className="agent-added">+{item.added}</span><span className="agent-removed">−{item.removed}</span></li>)}</ul></details>}
        {approval && <div className="agent-approval" role="region" aria-label={approval.kind === 'mcp' ? 'MCP 调用审批' : approval.kind === 'browser' ? '网页操作审批' : approval.kind === 'service' ? '开发服务审批' : approval.kind === 'spreadsheet' ? '表格修改审批' : approval.kind === 'image' ? '图片操作审批' : '命令审批'}><div><ShieldAlert size={20} /><strong>{approval.title}</strong></div><p>{approval.note}</p>{approval.server && <p className="agent-mcp-target">服务器：{approval.server} · 工具：{approval.tool}</p>}<div className="agent-operation-path">{approval.path}</div><pre>{approval.command}</pre><div className="agent-approval-actions"><button className="secondary-button" disabled={busy} onClick={() => decide(false)}>拒绝</button><button className="primary-button" disabled={busy} onClick={() => decide(true)}>{approval.allowLabel || '允许本次命令'}</button></div>{error && <p role="alert">{error}</p>}</div>}
      </div>
    </details>
  </section>;
}
