const MAX_ELAPSED_MS = 7 * 24 * 60 * 60 * 1000;
const boundedTime = (value) => Number.isFinite(value) && value >= 0 ? Math.min(MAX_ELAPSED_MS, Math.floor(value)) : null;

export function messageElapsedMs(message, now = Date.now()) {
  if (message.pending && Number.isFinite(message.startedAt)) return boundedTime(Math.max(0, now - message.startedAt));
  const saved = boundedTime(message.elapsedMs);
  if (saved !== null) return saved;
  if (Number.isFinite(message.stoppedAfter)) return boundedTime(message.stoppedAfter * 1000);
  // Old histories only recorded operation timestamps. Do not invent a duration
  // when neither complete timestamps nor an explicit elapsed value are known.
  const operations = message.operations || [];
  const starts = operations.map((item) => Date.parse(item.startedAt)).filter(Number.isFinite);
  const ends = operations.map((item) => Date.parse(item.endedAt)).filter(Number.isFinite);
  if (starts.length && ends.length) return boundedTime(Math.max(...ends) - Math.min(...starts));
  return null;
}

export function settledTiming(message, now = Date.now()) {
  const value = messageElapsedMs(message, now);
  return { startedAt: undefined, ...(value !== null ? { elapsedMs: value } : {}) };
}

export function messageProgressState(message = {}) {
  if (message.pending) return 'running';
  if (message.error) return 'failed';
  if (message.cancelled) return 'cancelled';
  return 'complete';
}

export function messageContentParts(message = {}) {
  const content = typeof message.content === 'string' ? message.content : '';
  if (message.pending) return { activity: content, answer: '' };
  const offset = message.finalContentOffset;
  if (!message.error && !message.cancelled && Number.isInteger(offset) && offset > 0 && offset < content.length) {
    return { activity: content.slice(0, offset).trim(), answer: content.slice(offset).trim() };
  }
  return { activity: '', answer: content };
}

export function formatDuration(value) {
  const bounded = boundedTime(value);
  if (bounded === null) return '';
  const seconds = Math.floor(bounded / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return (hours ? hours + '小时 ' : '') + (minutes || hours ? minutes + '分钟 ' : '') + (seconds % 60) + '秒';
}

export function safeMessageUrl(value) {
  try {
    if (typeof value !== 'string' || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function parseInline(value, depth = 0) {
  const text = String(value || '');
  const tokens = [];
  const pushText = (content) => {
    if (tokens.at(-1)?.type === 'text') tokens.at(-1).text += content;
    else tokens.push({ type: 'text', text: content });
  };
  for (let i = 0; i < text.length;) {
    const rest = text.slice(i);
    const escaped = rest.match(/^\\([\\\x60*_[\]{}()#+.!|>~-])/);
    if (escaped) { pushText(escaped[1]); i += escaped[0].length; continue; }
    const code = rest.match(/^(\x60+)/);
    if (code) {
      const close = text.indexOf(code[1], i + code[1].length);
      if (close >= 0) {
        tokens.push({ type: 'code', text: text.slice(i + code[1].length, close).replace(/\n/g, ' ') });
        i = close + code[1].length; continue;
      }
    }
    const link = rest.match(/^\[([^\]\n]{1,500})\]\(([^)\s]{1,2000})\)/);
    if (link) {
      const href = safeMessageUrl(link[2]);
      if (href) tokens.push({ type: 'link', href, children: depth < 4 ? parseInline(link[1], depth + 1) : [{ type: 'text', text: link[1] }] });
      else pushText(link[0]);
      i += link[0].length; continue;
    }
    let matched = false;
    if (depth < 4) {
      for (const [marker, type] of [['**', 'strong'], ['__', 'strong'], ['~~', 'del'], ['*', 'em'], ['_', 'em']]) {
        if (!rest.startsWith(marker) || (marker === '_' && /[\p{L}\p{N}]/u.test(text[i - 1] || ''))) continue;
        const end = text.indexOf(marker, i + marker.length);
        if (end <= i + marker.length || /\s/.test(text[i + marker.length]) || /\s/.test(text[end - 1])) continue;
        tokens.push({ type, children: parseInline(text.slice(i + marker.length, end), depth + 1) });
        i = end + marker.length; matched = true; break;
      }
    }
    if (!matched) { pushText(text[i]); i++; }
  }
  return tokens;
}

function tableCells(line) {
  const text = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = []; let cell = ''; let escaped = false; let code = false;
  for (const char of text) {
    if (escaped) { cell += '\\' + char; escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char.charCodeAt(0) === 96) code = !code;
    if (char === '|' && !code) { cells.push(cell.trim()); cell = ''; } else cell += char;
  }
  cells.push((cell + (escaped ? '\\' : '')).trim());
  return cells;
}
const fenceMatch = (line) => line.match(/^ {0,3}(\x60{3,}|~{3,})\s*([^\s]*)[^\n]*$/);
const listMatch = (line) => line.match(/^(\s*)([-+*]|\d+[.)])\s+(.+)$/);
const isRule = (line) => /^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line);
const tableSeparator = (line) => line?.includes('|') && tableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell));

// A bounded, text-only Markdown subset. React escapes all text; raw HTML and
// model-supplied images are never injected into the desktop renderer.
export function parseMessageBlocks(value, depth = 0) {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  const startsBlock = (index) => fenceMatch(lines[index]) || /^ {0,3}#{1,6}\s/.test(lines[index]) || /^ {0,3}>/.test(lines[index]) || listMatch(lines[index]) || isRule(lines[index]) || (lines[index].includes('|') && tableSeparator(lines[index + 1]));
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = fenceMatch(line);
    if (fence) {
      const body = []; i++;
      const closing = new RegExp('^ {0,3}' + fence[1][0] + '{' + fence[1].length + ',}\\s*$');
      while (i < lines.length && !closing.test(lines[i])) body.push(lines[i++]);
      const closed = i < lines.length;
      if (closed) i++;
      blocks.push({ type: 'code', language: /^[\w.+-]{1,40}$/.test(fence[2]) ? fence[2] : '', text: body.join('\n'), closed });
      continue;
    }
    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); i++; continue; }
    if (isRule(line)) { blocks.push({ type: 'rule' }); i++; continue; }
    if (/^ {0,3}>/.test(line) && depth < 8) {
      const body = [];
      while (i < lines.length && /^ {0,3}>/.test(lines[i])) body.push(lines[i++].replace(/^ {0,3}> ?/, ''));
      blocks.push({ type: 'quote', children: parseMessageBlocks(body.join('\n'), depth + 1) }); continue;
    }
    if (line.includes('|') && tableSeparator(lines[i + 1])) {
      const header = tableCells(line);
      const alignment = tableCells(lines[i + 1]).map((cell) => cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : 'left');
      const rows = []; i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(tableCells(lines[i++]));
      blocks.push({ type: 'table', header, alignment, rows }); continue;
    }
    const first = listMatch(line);
    if (first && depth < 8) {
      const ordered = /^\d/.test(first[2]); const indent = first[1].length; const items = [];
      while (i < lines.length) {
        const match = listMatch(lines[i]);
        if (!match || match[1].length !== indent || /^\d/.test(match[2]) !== ordered) break;
        const body = [match[3]]; const bodyIndent = match[1].length + match[2].length + 1; i++;
        while (i < lines.length) {
          const next = listMatch(lines[i]);
          if (next && next[1].length <= indent) break;
          if (!lines[i].trim()) {
            let look = i + 1; while (look < lines.length && !lines[look].trim()) look++;
            if (look >= lines.length || (lines[look].match(/^\s*/)[0].length <= indent && !listMatch(lines[look]))) break;
            body.push(''); i++; continue;
          }
          const spaces = lines[i].match(/^\s*/)[0].length;
          if (spaces <= indent) break;
          body.push(lines[i++].slice(Math.min(spaces, bodyIndent)));
        }
        items.push(parseMessageBlocks(body.join('\n'), depth + 1));
        while (i < lines.length && !lines[i].trim()) i++;
      }
      blocks.push({ type: 'list', ordered, start: ordered ? Number.parseInt(first[2], 10) : undefined, items }); continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(i)) paragraph.push(lines[i++]);
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
  }
  return blocks;
}

const actionLabels = {
  run_command: '运行', read_file: '读取', list_directory: '查看目录', search_text: '搜索',
  write_file: '写入', edit_file: '修改', update_plan: '更新计划',
  service_start: '启动开发服务', service_logs: '读取服务日志', service_list: '查看开发服务', service_stop: '停止开发服务',
  browser_open: '打开网页', browser_search: '搜索网页', browser_read: '读取网页', browser_snapshot: '读取网页',
  browser_click: '点击网页', browser_fill: '填写网页', browser_press: '发送按键', browser_scroll: '滚动网页',
  browser_screenshot: '截取网页', browser_close: '关闭网页',
  spreadsheet_read: '读取表格', spreadsheet_edit: '保存表格',
  image_read: '查看图片', image_edit: '保存图片',
  artifact_read: '读取办公成品', artifact_write: '保存办公成品', artifact_image: '生成图片', goal_finish: '报告目标结果',
};
export function operationCaption(operation) {
  if (operation.status === 'deferred') return '已加载目录规则 · 原操作未执行';
  const action = actionLabels[operation.name] || operation.title || operation.name || '操作';
  const prefix = { succeeded: '已', running: '正在', failed: '', cancelled: '', interrupted: '' }[operation.status] || '';
  const suffix = { failed: '失败', cancelled: '已停止', interrupted: '已中断' }[operation.status] || '';
  return prefix + action + (suffix ? ' · ' + suffix : '');
}
