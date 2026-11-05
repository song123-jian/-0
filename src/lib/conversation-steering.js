const LABELS = {
  submitting: '运行中补充 · 正在发送',
  queued: '运行中补充 · 等待模型接收',
  accepted: '运行中补充 · 模型已接收',
  expired: '运行中补充 · 本次未采用',
  failed: '运行中补充 · 未发送',
};

export function insertSteeringMessage(messages, { requestId, steeringId, text }) {
  if (messages.some(item => item.steering?.id === steeringId)) return messages;
  const index = messages.findIndex(item => item.id === requestId && item.role === 'assistant');
  if (index < 0) throw Error('当前任务消息已变化，引导未发送。');
  const entry = { id: steeringId, role: 'user', content: text, steering: { id: steeringId, requestId, status: 'submitting' } };
  // Keep the continuing answer below the user's supplements without changing its identity.
  return [...messages.slice(0, index), entry, ...messages.slice(index)];
}

export function updateSteeringStatus(messages, requestId, steeringId, status) {
  if (!Object.hasOwn(LABELS, status)) return messages;
  return messages.map(item => {
    const current = item.steering;
    if (current?.requestId !== requestId || current.id !== steeringId) return item;
    // Receipt events and the IPC reply may arrive in either order.
    if (['accepted', 'expired', 'failed'].includes(current.status) || current.status === 'queued' && status === 'submitting') return item;
    return { ...item, steering: { ...current, status } };
  });
}

export function settleSteeringMessages(messages, requestId) {
  return messages.map(item => item.steering?.requestId === requestId && ['submitting', 'queued'].includes(item.steering.status)
    ? { ...item, steering: { ...item.steering, status: 'expired' } } : item);
}

export function steeringLabel(message) {
  return LABELS[message.steering?.status] || '';
}

export function includesModelHistory(message) {
  return !message.steering || message.steering.status === 'accepted';
}
