import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Clipboard, FileCode2, FileText, LoaderCircle } from 'lucide-react';
import { formatDuration, messageElapsedMs, messageProgressState, parseInline, parseMessageBlocks, usedSkillNames } from '../lib/message-presentation.js';
import { AgentActivity } from './agent-activity.jsx';
import { messagePathName, parseLocalPaths } from '../lib/message-paths.js';

function PathButton({ token, onPath }) {
  const name = token.label || messagePathName(token.path);
  return <button type="button" className="message-path-link" title={token.path} aria-label={'打开文件或文件夹：' + name} onClick={() => onPath?.(token.path)}><FileText size={15} aria-hidden="true" />{token.code ? <code>{name}</code> : name}</button>;
}

export function MessagePaths({ text, onPath }) {
  return parseLocalPaths(text).map((token, index) => token.type === 'path' ? <PathButton key={index} token={token} onPath={onPath} /> : <React.Fragment key={index}>{token.text}</React.Fragment>);
}

function Inline({ text, tokens = parseInline(text), onPath }) {
  return tokens.map((token, index) => {
    if (token.type === 'text') return <React.Fragment key={index}>{token.text}</React.Fragment>;
    if (token.type === 'code') return <code key={index}>{token.text}</code>;
    if (token.type === 'path') return <PathButton key={index} token={token} onPath={onPath} />;
    if (token.type === 'link') return <a key={index} href={token.href} target="_blank" rel="noreferrer"><Inline tokens={token.children} /></a>;
    const Tag = token.type;
    return <Tag key={index}><Inline tokens={token.children} onPath={onPath} /></Tag>;
  });
}

function CodeBlock({ block, onApplyCode }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setCopied(false); setError(''); }, [block.text]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(block.text); setCopied(true); setError(''); }
    catch { setError('复制失败，请选择代码后复制'); }
  };
  return <div className="message-code-block">
    <div className="message-code-toolbar"><span>{block.language || '代码'}</span><div>
      <button type="button" className="text-tool" aria-label="复制代码" onClick={copy}>{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? '已复制' : '复制'}</button>
      {onApplyCode && block.closed && <button type="button" className="text-tool apply-code" onClick={() => onApplyCode(block.text)}><FileCode2 size={15} />放入编辑器</button>}
    </div></div>
    <pre><code>{block.text}</code></pre>
    {error && <p className="message-copy-error" role="alert">{error}</p>}
  </div>;
}

function Blocks({ blocks, onApplyCode, onPath }) {
  return blocks.map((block, index) => {
    if (block.type === 'code') return <CodeBlock key={index} block={block} onApplyCode={onApplyCode} />;
    if (block.type === 'heading') { const Tag = 'h' + Math.min(6, block.level + 1); return <Tag key={index}><Inline text={block.text} onPath={onPath} /></Tag>; }
    if (block.type === 'rule') return <hr key={index} />;
    if (block.type === 'quote') return <blockquote key={index}><Blocks blocks={block.children} onApplyCode={onApplyCode} onPath={onPath} /></blockquote>;
    if (block.type === 'list') {
      const Tag = block.ordered ? 'ol' : 'ul';
      return <Tag key={index} start={block.start}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Blocks blocks={item} onApplyCode={onApplyCode} onPath={onPath} /></li>)}</Tag>;
    }
    if (block.type === 'table') return <div key={index} className="message-table-scroll" tabIndex={0} role="region" aria-label="回复表格"><table><thead><tr>{block.header.map((cell, i) => <th key={i} scope="col" style={{ textAlign: block.alignment[i] }}><Inline text={cell} onPath={onPath} /></th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{block.header.map((_, i) => <td key={i} style={{ textAlign: block.alignment[i] }}><Inline text={row[i] || ''} onPath={onPath} /></td>)}</tr>)}</tbody></table></div>;
    return <p key={index}><Inline text={block.text} onPath={onPath} /></p>;
  });
}

export function MessageContent({ content, onApplyCode, onPath, collapsible = false }) {
  const blocks = useMemo(() => parseMessageBlocks(content), [content]);
  const [expanded, setExpanded] = useState(true);
  if (!collapsible) return <div className="assistant-message-content"><Blocks blocks={blocks} onApplyCode={onApplyCode} onPath={onPath} /></div>;
  return <details className="assistant-message-disclosure" open={expanded} onToggle={(event) => {
    if (event.target === event.currentTarget) setExpanded(event.currentTarget.open);
  }}>
    <summary aria-label="答复内容"><span>答复内容</span><ChevronRight size={15} className="agent-chevron" aria-hidden="true" /></summary>
    <div className="assistant-message-content"><Blocks blocks={blocks} onApplyCode={onApplyCode} onPath={onPath} /></div>
  </details>;
}

export function MessageProgress({ message, collapsed = false }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!message.pending) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [message.pending, message.startedAt]);
  const elapsed = messageElapsedMs(message, now);
  const phases = { preparing: '正在准备请求', model: '正在准备模型上下文', waiting: '等待模型响应', receiving: '已连接，等待模型内容', reasoning: '模型正在推理', 'tool-input': '正在接收工具参数', streaming: '正在接收答复', tool: '正在执行', retry: '服务重试等待中', paused: '已暂停，点击继续' };
  const label = message.pending ? message.approval ? '等待审批' : phases[message.phase] || '正在准备请求' : message.error ? '处理失败' : message.cancelled ? '已停止' : '已处理';
  const inferred = !message.pending && !Number.isFinite(message.elapsedMs) && !Number.isFinite(message.stoppedAfter) && elapsed !== null;
  const skills = usedSkillNames(message.operations);
  return <div className="message-progress" data-state={message.pending ? 'running' : message.error ? 'failed' : message.cancelled ? 'cancelled' : 'complete'} data-collapsed={collapsed ? 'true' : 'false'}>
    <span className="message-progress-label" role="status">{message.pending && <LoaderCircle size={15} className="spin" />}{label}</span>
    {elapsed !== null && <time title={inferred ? '根据历史操作记录起止时间计算' : '本条回复的实际处理时长'}>{formatDuration(elapsed)}{inferred && <span className="message-time-note">（操作耗时）</span>}</time>}
    {skills.length > 0 && <span className="message-skill-notice" role="status" title={'使用 Skill：' + skills.join('、')}>Skill：{skills.join('、')}</span>}
    <span className="message-progress-line" />
  </div>;
}

export function MessageExecution({ message, activity, ...actions }) {
  const complete = messageProgressState(message) === 'complete';
  const [expanded, setExpanded] = useState(!complete);
  useEffect(() => { setExpanded(!complete); }, [message.id, complete, message.approval?.id]);
  if (message.operations?.length === 1 && !activity && !message.approval) return <div className="message-execution is-single">
    <MessageProgress message={message} />
    <AgentActivity operations={message.operations} collapsed={complete} embedded {...actions} />
  </div>;
  return <details className="message-execution agent-activity-shell" open={expanded} onToggle={(event) => {
    if (event.target === event.currentTarget) setExpanded(event.currentTarget.open);
  }}>
    <summary className="message-execution-summary" aria-label="任务处理过程">
      <MessageProgress message={message} collapsed={!expanded} />
      <ChevronRight size={15} className="agent-chevron" aria-hidden="true" />
    </summary>
    <div className="message-execution-body">
      {activity && <MessageContent content={activity} onPath={actions.onMessagePath} />}
      <AgentActivity operations={message.operations} approval={message.approval} collapsed={complete} embedded {...actions} />
      {!message.pending && !activity && !message.operations?.length && <p className="message-execution-empty">本次未执行工具操作。</p>}
    </div>
  </details>;
}
