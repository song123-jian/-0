const MAX_PENDING = 20;
const MAX_TEXT_LENGTH = 64000;

function createSteeringQueue() {
  const pending = [];
  let closed = false;
  return {
    enqueue(input) {
      if (closed) throw new Error('任务已结束，引导未提交。');
      if (!input || typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.id)) throw new Error('引导标识无效。');
      const text = typeof input.text === 'string' ? input.text.trim() : '';
      if (!text || text.length > MAX_TEXT_LENGTH || text.includes('\0')) throw new Error('请输入 64000 字以内的引导内容。');
      if (pending.length >= MAX_PENDING) throw new Error('待处理的引导过多，请等待模型接收。');
      if (pending.some((item) => item.id === input.id)) throw new Error('此引导已提交。');
      pending.push({ id: input.id, text });
      return true;
    },
    drain() { return pending.splice(0); },
    close() { closed = true; return pending.splice(0); },
  };
}

module.exports = { createSteeringQueue };
