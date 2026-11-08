export function localMessagePath(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\x00-\x1f\x7f]/.test(value)) return null;
  let target = value.trim();
  if (/^file:\/\//i.test(target)) {
    try { const url = new URL(target); if (url.hostname || url.search || url.hash) return null; target = decodeURIComponent(url.pathname); } catch { return null; }
  }
  target = target.replace(/^\/([a-z]:[\\/])/i, '$1').replace(/:\d+(?::\d+)?$/, '');
  if (!/^[a-z]:[\\/]/i.test(target) && !/^\/(?!\/)[^\s]/.test(target)) return null;
  if (/^[\\/]{2}|[<>|?*\x60]/.test(target) || /:(?![\\/])/.test(target.replace(/^[a-z]:/i, ''))) return null;
  return target;
}

export function messagePathName(value) {
  const text = String(value || '').replace(/[\\/]+$/, '');
  return text.split(/[\\/]/).filter(Boolean).at(-1) || '附件';
}

export function parseLocalPaths(value) {
  const text = String(value || '');
  const tokens = [];
  const pattern = /["'\x60]([a-z]:[\\/][^\r\n"'\x60]+)["'\x60]|[a-z]:[\\/][^\s<>"'|?*\x60，。；！？、）]+/gi;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > 0 && /[\w/\\]/.test(text[match.index - 1])) continue;
    let display = match[1] || match[0].replace(/[.,;!)}\]]+$/, '');
    const target = localMessagePath(display);
    if (!target) continue;
    const start = match.index + (match[1] ? 1 : 0);
    if (start > offset) tokens.push({ type: 'text', text: text.slice(offset, start) });
    tokens.push({ type: 'path', text: display, path: target });
    offset = start + display.length;
  }
  if (offset < text.length) tokens.push({ type: 'text', text: text.slice(offset) });
  return tokens;
}
