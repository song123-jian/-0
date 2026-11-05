import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Clipboard, FileCode2, LoaderCircle } from 'lucide-react';
import { formatDuration, messageElapsedMs, messageProgressState, parseInline, parseMessageBlocks } from '../lib/message-presentation.js';
import { AgentActivity } from './agent-activity.jsx';

function Inline({ text, tokens = parseInline(text) }) {
  return tokens.map((token, index) => {
    if (token.type === 'text') return <React.Fragment key={index}>{token.text}</React.Fragment>;
    if (token.type === 'code') return <code key={index}>{token.text}</code>;
    if (token.type === 'link') return <a key={index} href={token.href} target="_blank" rel="noreferrer"><Inline tokens={token.children} /></a>;
    const Tag = token.type;
    return <Tag key={index}><Inline tokens={token.children} /></Tag>;
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

function Blocks({ blocks, onApplyCode }) {
  return blocks.map((block, index) => {
    if (block.type === 'code') return <CodeBlock key={index} block={block} onApplyCode={onApplyCode} />;
    if (block.type === 'heading') { const Tag = 'h' + Math.min(6, block.level + 1); return <Tag key={index}><Inline text={block.text} /></Tag>; }
    if (block.type === 'rule') return <hr key={index} />;
    if (block.type === 'quote') return <blockquote key={index}><Blocks blocks={block.children} onApplyCode={onApplyCode} /></blockquote>;
    if (block.type === 'list') {
      const Tag = block.ordered ? 'ol' : 'ul';
      return <Tag key={index} start={block.start}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Blocks blocks={item} onApplyCode={onApplyCode} /></li>)}</Tag>;
    }
    if (block.type === 'table') return <div key={index} className="message-table-scroll" tabIndex={0} role="region" aria-label="回复表格"><table><thead><tr>{block.header.map((cell, i) => <th key={i} scope="col" style={{ textAlign: block.alignment[i] }}><Inline text={cell} /></th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{block.header.map((_, i) => <td key={i} style={{ textAlign: block.alignment[i] }}><Inline text={row[i] || ''} /></td>)}</tr>)}</tbody></table></div>;
    return <p key={index}><Inline text={block.text} /></p>;
  });
}

export function MessageContent({ content, onApplyCode }) {
  const blocks = useMemo(() => parseMessageBlocks(content), [content]);
  return <div className="assistant-message-content"><Blocks blocks={blocks} onApplyCode={onApplyCode} /></div>;
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
  const phases = { preparing: '正在准备请求', model: '正在准备模型上下文', waiting: '等待模型响应', receiving: '已连接，等待模型内容', reasoning: '模型正在推理', 'tool-input': '正在接收工具参数', streaming: '正在接收答复', tool: '正在执行', retry: '服务重试等待中' };
  const label = message.pending ? message.approval ? '等待审批' : phases[message.phase] || '正在准备请求' : message.error ? '处理失败' : message.cancelled ? '已停止' : '已处理';
  const inferred = !message.pending && !Number.isFinite(message.elapsedMs) && !Number.isFinite(message.stoppedAfter) && elapsed !== null;
  return <div className="message-progress" data-state={message.pending ? 'running' : message.error ? 'failed' : message.cancelled ? 'cancelled' : 'complete'} data-collapsed={collapsed ? 'true' : 'false'}>
    <span className="message-progress-label" role="status">{message.pending && <LoaderCircle size={15} className="spin" />}{label}</span>
    {elapsed !== null && <time title={inferred ? '根据历史操作记录起止时间计算' : '本条回复的实际处理时长'}>{formatDuration(elapsed)}{inferred && <span className="message-time-note">（操作耗时）</span>}</time>}
    <span className="message-progress-line" />
  </div>;
}

export function MessageExecution({ message, activity, ...actions }) {
  const complete = messageProgressState(message) === 'complete';
  const [expanded, setExpanded] = useState(!complete);
  useEffect(() => { setExpanded(!complete); }, [message.id, complete, message.approval?.id]);
  return <details className="message-execution agent-activity-shell" open={expanded} onToggle={(event) => {
    if (event.target === event.currentTarget) setExpanded(event.currentTarget.open);
  }}>
    <summary className="message-execution-summary" aria-label="任务处理过程">
      <MessageProgress message={message} collapsed={!expanded} />
      <ChevronRight size={15} className="agent-chevron" aria-hidden="true" />
    </summary>
    <div className="message-execution-body">
      {activity && <MessageContent content={activity} />}
      <AgentActivity operations={message.operations} approval={message.approval} collapsed={complete} embedded {...actions} />
      {!message.pending && !activity && !message.operations?.length && <p className="message-execution-empty">本次未执行工具操作。</p>}
    </div>
  </details>;
}
