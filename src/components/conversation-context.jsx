import React from 'react';

export function ConversationContext({ messages, disabled, onCompact }) {
  if (!messages.length) return null;
  const latest = messages.findLast(message => message.contextUsage);
  const saved = messages.findLast(message => message.contextCheckpoint)?.contextCheckpoint;
  const compacting = messages.some(message => message.pending && message.phase === 'compacting');
  const usage = latest?.contextUsage;
  const capacity = usage?.capacityTokens;
  const percentage = capacity ? Math.min(100, Math.round(usage.sentTokens / capacity * 100)) : null;
  return <div className="conversation-context" aria-label="对话上下文">
    <span role="status">{compacting ? '正在压缩上下文…' : usage ? `上下文约 ${usage.sentTokens.toLocaleString()}${capacity ? ` / ${capacity.toLocaleString()} tokens · ${percentage}%` : ' tokens'}` : '上下文按需压缩'}</span>
    <div>{saved && <details><summary>历史摘要</summary><div className="context-summary"><p>完整聊天记录已保留。摘要用于后续接续，编辑历史后会重新核对。</p><pre>{saved.summary}</pre></div></details>}
      <button type="button" disabled={disabled} title="生成历史摘要，保留完整聊天；也可输入 /compact" onClick={onCompact}>压缩上下文</button></div>
  </div>;
}
