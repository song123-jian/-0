const MAX_VISUALIZATION_HTML_BYTES = 128 * 1024;
const MAX_WIDGET_STATE_BYTES = 16 * 1024;
const MAX_VISUALIZATIONS_PER_MESSAGE = 3;
const MAX_FOLLOWUP_CHARS = 1200;

function normalizeVisualizationHtml(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) return null;
  return Buffer.byteLength(value, 'utf8') <= MAX_VISUALIZATION_HTML_BYTES ? value : null;
}

function normalizeWidgetState(value) {
  const pending = [{ value, depth: 0 }];
  const visited = new WeakSet();
  let visitedCount = 0, textBytes = 0;
  while (pending.length) {
    const item = pending.pop(), current = item.value;
    if (++visitedCount > 512 || item.depth > 10) return undefined;
    if (current === null || typeof current === 'boolean') continue;
    if (typeof current === 'string') {
      if (current.length > 4096) return undefined;
      textBytes += Buffer.byteLength(current, 'utf8');
    } else if (typeof current === 'number') {
      if (!Number.isFinite(current)) return undefined;
      textBytes += 16;
    } else if (Array.isArray(current)) {
      if (current.length > 100 || visited.has(current)) return undefined;
      visited.add(current);
      for (const child of current) pending.push({ value: child, depth: item.depth + 1 });
    } else if (current && typeof current === 'object' && Object.getPrototypeOf(current) === Object.prototype) {
      if (visited.has(current)) return undefined;
      visited.add(current);
      const entries = Object.entries(current);
      if (entries.length > 100) return undefined;
      for (const [key, child] of entries) {
        if (key.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(key)) return undefined;
        textBytes += Buffer.byteLength(key, 'utf8');
        pending.push({ value: child, depth: item.depth + 1 });
      }
    } else return undefined;
    if (textBytes > MAX_WIDGET_STATE_BYTES) return undefined;
  }
  let serialized;
  try { serialized = JSON.stringify(value); } catch { return undefined; }
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > MAX_WIDGET_STATE_BYTES) return undefined;
  let normalized;
  try { normalized = JSON.parse(serialized); } catch { return undefined; }
  return normalized;
}

function normalizeFollowupPrompt(value) {
  if (typeof value !== 'string') return '';
  const prompt = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return prompt.length <= MAX_FOLLOWUP_CHARS ? prompt : '';
}

module.exports = {
  MAX_FOLLOWUP_CHARS,
  MAX_VISUALIZATION_HTML_BYTES,
  MAX_VISUALIZATIONS_PER_MESSAGE,
  MAX_WIDGET_STATE_BYTES,
  normalizeFollowupPrompt,
  normalizeVisualizationHtml,
  normalizeWidgetState,
};
