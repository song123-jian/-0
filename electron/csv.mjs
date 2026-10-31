export function parseCsv(input, delimiter = ',') {
  if (typeof delimiter !== 'string' || delimiter.length !== 1 || delimiter === '"' || /[\r\n]/.test(delimiter)) {
    throw new Error('CSV 分隔符必须是单个有效字符。');
  }
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('CSV 文件包含未闭合的引号。');
  if (cell.length || row.length || (text.length && !/[\r\n]$/.test(text))) {
    row.push(cell);
    rows.push(row);
  }
  const width = Math.max(0, ...rows.map((entry) => entry.length));
  return rows.map((entry) => [...entry, ...Array(Math.max(0, width - entry.length)).fill('')]);
}

export function stringifyCsv(rows, delimiter = ',') {
  if (typeof delimiter !== 'string' || delimiter.length !== 1 || delimiter === '"' || /[\r\n]/.test(delimiter)) {
    throw new Error('CSV 分隔符必须是单个有效字符。');
  }
  return rows.map((row) => row.map((value) => {
    const text = String(value ?? '');
    return text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(delimiter)).join('\r\n');
}
