const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
function normalizeUsage(value) {
  if (!value || typeof value !== 'object') return null;
  const inputTokens = count(value.prompt_tokens ?? value.inputTokens);
  const outputTokens = count(value.completion_tokens ?? value.outputTokens);
  if (inputTokens === null || outputTokens === null) return null;
  return { inputTokens, outputTokens, totalTokens: count(value.total_tokens ?? value.totalTokens) ?? inputTokens + outputTokens };
}
function createUsageLedger(file) {
  let records; let queue = Promise.resolve();
  const ensure = async () => { if (records) return; try { const value = JSON.parse(await fs.readFile(file, 'utf8')); if (!Array.isArray(value)) throw Error('Invalid usage ledger'); records = value.slice(-1000); } catch (e) { if (e.code !== 'ENOENT') throw new Error('用量记录无法读取，原文件已保留。'); records = []; } };
  return {
    record(input) {
      const operation = queue.then(async () => {
        await ensure();
        const record = { at: new Date().toISOString(), model: String(input.model || '').slice(0, 200), status: ['succeeded', 'failed', 'cancelled'].includes(input.status) ? input.status : 'failed', durationMs: count(Math.round(input.durationMs)) ?? 0, firstTokenMs: count(input.firstTokenMs), httpStatus: count(input.httpStatus), usage: normalizeUsage(input.usage) };
        record.role = ['main', 'explorer', 'advisor'].includes(input.role) ? input.role : 'main';
        if (['plan', 'debate-proposal', 'debate-review', 'repeated-error', 'completion'].includes(input.stage)) record.stage = input.stage;
        for (const key of ['preparationMs', 'responseHeadersMs', 'firstByteMs', 'firstToolCallMs', 'firstTextMs']) record[key] = count(input[key]);
        const next = [...records, record].slice(-1000); const temporary = file + '.' + crypto.randomUUID() + '.tmp';
        await fs.mkdir(path.dirname(file), { recursive: true });
        try { await fs.writeFile(temporary, JSON.stringify(next), { flag: 'wx' }); await fs.rename(temporary, file); records = next; }
        finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
      }); queue = operation.catch(() => {}); return operation;
    },
    async get() {
      await queue; await ensure();
      const summary = { requests: records.length, succeeded: 0, unknownUsage: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, records: records.slice(-30).reverse() };
      for (const record of records) { if (record.status === 'succeeded') summary.succeeded++; const usage = normalizeUsage(record.usage); if (usage) for (const key of ['inputTokens', 'outputTokens', 'totalTokens']) summary[key] += usage[key]; else summary.unknownUsage++; }
      return summary;
    },
    flush: () => queue,
  };
}
module.exports = { normalizeUsage, createUsageLedger };
