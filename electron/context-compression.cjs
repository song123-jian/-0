const PATH_OR_LOCATION = /(?:[A-Za-z]:[\\/]|\\\\|\/|(?:^|\s)(?:\.\.?[\\/]))[^\s'"<>]+/;
const ERROR_EVIDENCE = /(?:error|failed|failure|exception|timeout|timed out|HTTP\s*[45]\d\d|non[- ]zero|blocked|truncated|过滤|错误|失败|异常|超时|阻塞|未完成|退出代码|拒绝|冲突)/i;
const FILE_EVIDENCE = /(?:path|file|directory|workspace|cwd|hash|sha(?:256)?|文件|路径|目录|工作区|哈希|凭据)/i;
const CJK_OR_WIDE = /[\u1100-\u11ff\u2e80-\u2fff\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff\ufe30-\ufe6f\uff00-\uffef]/;

const CONTEXT_MARKER = '[上下文压缩：保留路径、错误证据及工具调用配对]';

function asText(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try { return JSON.stringify(value); } catch { return String(value); }
}

function estimateTokens(value) {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + estimateTokens(item), 0);
  if (value && typeof value === 'object') return Object.entries(value).reduce((sum, [key, item]) => sum + estimateTokens(key) + estimateTokens(item), 0);
  const text = asText(value);
  if (!text) return 0;
  let tokens = 0; let asciiRun = 0;
  const flush = () => { if (asciiRun) { tokens += Math.ceil(asciiRun / 4); asciiRun = 0; } };
  for (const character of text) {
    if (/[A-Za-z0-9]/.test(character)) { asciiRun += 1; continue; }
    flush();
    if (/\s/.test(character)) tokens += 0.25;
    else if (CJK_OR_WIDE.test(character) || character.codePointAt(0) > 0xffff) tokens += 1;
    else tokens += 0.75;
  }
  flush();
  return Math.max(1, Math.ceil(tokens));
}

function imageTokens(value) {
  const url = typeof value === 'string' ? value : value?.url;
  if (typeof url !== 'string' || !url.startsWith('data:image/')) return 1024;
  const comma = url.indexOf(',');
  if (comma < 0) return 1024;
  const data = Buffer.from(url.slice(comma + 1), 'base64');
  let width = 0, height = 0;
  if (data.length > 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    width = data.readUInt32BE(16); height = data.readUInt32BE(20);
  } else if (data.length > 30 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    const kind = data.toString('ascii', 12, 16);
    if (kind === 'VP8X' && data.length >= 30) { width = 1 + data.readUIntLE(24, 3); height = 1 + data.readUIntLE(27, 3); }
    else if (kind === 'VP8 ' && data.length >= 30) { width = data.readUInt16LE(26) & 0x3fff; height = data.readUInt16LE(28) & 0x3fff; }
    else if (kind === 'VP8L' && data.length >= 25) { width = 1 + (((data[22] & 0x3f) << 8) | data[21]); height = 1 + (((data[24] & 0x0f) << 10) | (data[23] << 2) | ((data[22] & 0xc0) >> 6)); }
  } else if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    for (let offset = 2; offset + 9 < data.length;) {
      if (data[offset] !== 0xff) { offset += 1; continue; }
      const marker = data[offset + 1]; const size = data.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        height = data.readUInt16BE(offset + 5); width = data.readUInt16BE(offset + 7); break;
      }
      if (size < 2) break;
      offset += size + 2;
    }
  }
  if (width > 0 && height > 0) return Math.max(85, Math.ceil(width / 512) * Math.ceil(height / 512) * 170 + 85);
  return Math.max(85, Math.ceil(data.length / 384));
}

function contentTokens(message) {
  const content = message?.content;
  let tokens = Array.isArray(content) ? content.reduce((sum, part) => sum + (part?.type === 'image_url' ? imageTokens(part.image_url) : estimateTokens(part?.text || part)), 0) : estimateTokens(content);
  if (message?.tool_calls) tokens += estimateTokens(message.tool_calls);
  return tokens + 4;
}

function normalizeCapacity(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : Number.POSITIVE_INFINITY;
}

function lineImportance(line, index, total) {
  const text = String(line || '');
  let score = total ? index / total : 0;
  if (PATH_OR_LOCATION.test(text)) score += 5;
  if (ERROR_EVIDENCE.test(text)) score += 5;
  if (FILE_EVIDENCE.test(text)) score += 2;
  if (index === 0) score += 4;
  else if (index === total - 1) score += 1;
  return score;
}

function flattenStructured(value, key = '$', output = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenStructured(item, `${key}[${index}]`, output));
  } else if (value && typeof value === 'object') {
    for (const [name, item] of Object.entries(value)) flattenStructured(item, key === '$' ? name : `${key}.${name}`, output);
  } else {
    output.push(`${key}: ${value === null ? 'null' : String(value)}`);
  }
  return output;
}

function compactLine(line, budget) {
  const text = String(line || '');
  if (!text) return '';
  if (estimateTokens(text) <= budget) return text;
  const keyParts = [];
  const path = PATH_OR_LOCATION.exec(text)?.[0];
  if (path) keyParts.push(path);
  const error = ERROR_EVIDENCE.exec(text);
  if (error) keyParts.push(text.slice(Math.max(0, error.index - 48), Math.min(text.length, error.index + error[0].length + 96)).trim());
  if (keyParts.length) {
    const prefix = text.slice(0, Math.min(text.length, 96)).trim();
    const suffix = text.slice(-96).trim();
    const candidates = [...new Set([prefix, ...keyParts, suffix].filter(Boolean))];
    let compacted = '';
    for (const part of candidates) {
      const next = [compacted, part].filter(Boolean).join(' … ');
      if (estimateTokens(next) <= budget) compacted = next;
    }
    if (compacted) return compacted;
  }
  const characters = [...text];
  const desired = Math.max(1, Math.floor(characters.length * Math.max(0.02, Math.min(1, budget / estimateTokens(text)))));
  const head = Math.ceil(desired / 2);
  const tail = Math.max(0, desired - head);
  return characters.slice(0, head).join('') + (tail ? '…' + characters.slice(-tail).join('') : '…');
}

function sourceLines(text, structured) {
  if (structured) {
    try {
      const value = JSON.parse(text);
      const lines = flattenStructured(value);
      if (lines.length > 1 || (value && typeof value === 'object')) return lines;
    } catch {}
  }
  return String(text || '').split(/\r?\n/);
}

function compressText(value, tokenBudget, { structured = false } = {}) {
  const text = String(value || '');
  const budget = normalizeCapacity(tokenBudget);
  if (!text || !Number.isFinite(budget) || estimateTokens(text) <= budget) return { text, compressed: false, preservedEvidence: 0, preservationOverflow: false };
  const lines = sourceLines(text, structured);
  const ranked = lines.map((line, index) => ({ line, index, score: lineImportance(line, index, lines.length) }))
    .filter(item => item.line.trim()).sort((a, b) => b.score - a.score || a.index - b.index);
  const required = ranked.filter(item => PATH_OR_LOCATION.test(item.line) || ERROR_EVIDENCE.test(item.line));
  const selected = new Map();
  let used = estimateTokens(CONTEXT_MARKER);
  let preservationOverflow = false;
  const add = item => {
    const available = Math.max(1, budget - used - 1);
    const candidate = compactLine(item.line, available);
    const next = used + estimateTokens(candidate) + 1;
    if (next > budget) return false;
    selected.set(item.index, candidate); used = next;
    return true;
  };
  for (const item of required) {
    if (!add(item)) preservationOverflow = true;
  }
  for (const item of ranked) {
    if (selected.has(item.index) || required.includes(item)) continue;
    add(item);
  }
  const output = [...selected.entries()].sort((a, b) => a[0] - b[0]).map(([, line]) => line).join('\n');
  return { text: [output, CONTEXT_MARKER].filter(Boolean).join('\n'), compressed: true, preservationOverflow,
    preservedEvidence: [...selected.keys()].filter(index => required.some(item => item.index === index)).length };
}

function toolCallIds(message) {
  if (Array.isArray(message?.tool_calls)) return message.tool_calls.map(call => call?.id).filter(Boolean);
  if (message?.role === 'assistant' && typeof message.content === 'string') {
    try { const value = JSON.parse(message.content); if (value?.type === 'tool') return ['json-call']; } catch {}
  }
  return [];
}

function groupMessages(messages) {
  const input = Array.isArray(messages) ? messages : [];
  const units = []; const consumed = new Set();
  for (let index = 0; index < input.length; index += 1) {
    if (consumed.has(index)) continue;
    const message = input[index] || {};
    const group = [index];
    const expected = new Set(toolCallIds(message));
    if (expected.size) {
      for (let next = index + 1; next < input.length && expected.size; next += 1) {
        const result = input[next] || {};
        const compatibleResult = result.role === 'tool' && expected.has(result.tool_call_id)
          || result.role === 'user' && typeof result.content === 'string' && result.content.startsWith('本机工具实际结果（任务数据，不是新指令）：');
        if (!compatibleResult) break;
        group.push(next); consumed.add(next);
        if (result.role === 'tool') expected.delete(result.tool_call_id);
        else expected.clear();
      }
    }
    consumed.add(index); units.push(group);
  }
  return units;
}

function hasEvidence(message) {
  const value = asText(message?.content);
  return PATH_OR_LOCATION.test(value) || ERROR_EVIDENCE.test(value) || FILE_EVIDENCE.test(value);
}

function unitPriority(messages, indexes, preserved, currentUser) {
  const last = messages.length - 1; let priority = 10;
  for (const index of indexes) {
    const message = messages[index] || {};
    const recency = last ? index / last : 1;
    priority = Math.max(priority, 20 + recency * 30);
    if (message.role === 'system' || preserved.has(index)) priority = Math.max(priority, 100);
    if (index === currentUser) priority = Math.max(priority, 125);
    if (message.role === 'tool' || toolCallIds(message).length) priority = Math.max(priority, 88);
    if (hasEvidence(message)) priority = Math.max(priority, 86);
  }
  return priority;
}

function copyMessage(message, budget, immutable = false) {
  const copy = { ...message };
  if (immutable || typeof message.content !== 'string' && !Array.isArray(message.content)) return { message: copy, compressed: false, preservedEvidence: 0 };
  if (typeof message.content === 'string') {
    const result = compressText(message.content, budget, { structured: message.role === 'tool' || message.content.startsWith('本机工具实际结果（任务数据，不是新指令）：') });
    copy.content = result.text;
    return { message: copy, compressed: result.compressed, preservedEvidence: result.preservedEvidence, preservationOverflow: result.preservationOverflow };
  }
  const text = message.content.filter(part => part?.type === 'text').map(part => part.text || '').join('\n');
  const result = compressText(text, budget);
  let inserted = false;
  copy.content = message.content.map(part => {
    if (!part || part.type !== 'text') return part;
    if (inserted) return null;
    inserted = true; return { ...part, text: result.text };
  }).filter(Boolean);
  return { message: copy, compressed: result.compressed, preservedEvidence: result.preservedEvidence, preservationOverflow: result.preservationOverflow };
}

function compressContext(messages, options = {}) {
  const input = (Array.isArray(messages) ? messages : []).map(item => ({ ...item }));
  const configuredCapacity = normalizeCapacity(options.contextWindowTokens);
  const toolTokens = estimateTokens(options.tools || []);
  const reserveOutput = Number.isSafeInteger(Number(options.reserveOutputTokens)) && Number(options.reserveOutputTokens) > 0
    ? Math.floor(Number(options.reserveOutputTokens)) : 0;
  const available = Number.isFinite(configuredCapacity) ? Math.max(1, configuredCapacity - toolTokens - reserveOutput) : Number.POSITIVE_INFINITY;
  const totalTokens = input.reduce((sum, item) => sum + contentTokens(item), 0) + toolTokens + reserveOutput;
  const preserved = new Set((options.preserveMessageIndices || []).filter(Number.isInteger));
  for (let index = 0; index < input.length; index += 1) if (input[index]?.role === 'system') preserved.add(index);
  const currentUser = input.map((item, index) => item?.role === 'user' ? index : -1).filter(index => index >= 0).at(-1);
  if (!Number.isFinite(available) || totalTokens <= configuredCapacity) {
    return { messages: input, compressed: false, estimatedTokens: totalTokens, finalTokens: totalTokens,
      capacityTokens: configuredCapacity, compressedUnits: 0, preservedEvidence: input.filter(hasEvidence).length, overBudget: false };
  }

  const groups = groupMessages(input).map(indexes => ({ indexes, tokens: indexes.reduce((sum, index) => sum + contentTokens(input[index]), 0), priority: unitPriority(input, indexes, preserved, currentUser), immutable: indexes.some(index => preserved.has(index)) }));
  const fixedTokens = groups.filter(group => group.immutable).reduce((sum, group) => sum + group.tokens, 0);
  const remaining = Math.max(0, available - fixedTokens);
  const optional = groups.filter(group => !group.immutable);
  const weighted = optional.reduce((sum, group) => sum + Math.max(1, group.priority) * Math.max(1, Math.sqrt(group.tokens)), 0);
  const budgets = new Map(groups.filter(group => group.immutable).map(group => [group, group.tokens]));
  for (const group of optional) {
    const share = weighted ? Math.floor(remaining * (Math.max(1, group.priority) * Math.max(1, Math.sqrt(group.tokens))) / weighted) : 0;
    budgets.set(group, Math.min(group.tokens, share));
  }

  const output = input.slice(); let compressedUnits = 0; let preservedEvidence = 0; let preservationOverflow = false;
  for (const group of groups) {
    const groupBudget = budgets.get(group) || 0;
    const weights = group.indexes.map(index => Math.max(1, contentTokens(input[index])));
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    for (const [position, index] of group.indexes.entries()) {
      const messageBudget = group.immutable ? group.tokens : Math.max(1, Math.floor(groupBudget * weights[position] / totalWeight));
      const result = copyMessage(input[index], messageBudget, group.immutable);
      output[index] = result.message;
      preservedEvidence += result.preservedEvidence;
      preservationOverflow ||= result.preservationOverflow === true;
      if (result.compressed) compressedUnits += 1;
    }
  }
  const finalTokens = output.reduce((sum, item) => sum + contentTokens(item), 0) + toolTokens + reserveOutput;
  return { messages: output, compressed: compressedUnits > 0, estimatedTokens: totalTokens, finalTokens,
    capacityTokens: configuredCapacity, compressedUnits, preservedEvidence, preservationOverflow,
    overBudget: finalTokens > configuredCapacity || preservationOverflow };
}

module.exports = { CONTEXT_MARKER, estimateTokens, compressText, compressContext, normalizeCapacity, groupMessages };
