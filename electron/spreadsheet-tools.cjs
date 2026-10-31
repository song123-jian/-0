const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const ExcelJS = require('exceljs');
const yauzl = require('yauzl');
const { withFileCommit } = require('./file-commit.cjs');
const MAX_BYTES = 8 * 1024 * 1024, MAX_ROWS = 20000, MAX_COLS = 256, MAX_CELLS = 200000;
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const str = (description) => ({ type: 'string', description });
const def = (name, description, properties, required) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });
const styleSchema = { type: 'object', additionalProperties: false, properties: {
  num_format: str('Excel 数字格式'), bold: { type: 'boolean' }, italic: { type: 'boolean' },
  font_size: { type: 'number', minimum: 8, maximum: 72 }, font_color: str('六位 RGB'), fill_color: str('六位 RGB'),
  alignment: { type: 'string', enum: ['left', 'center', 'right'] }, wrap: { type: 'boolean' },
} };
const DEFINITIONS = [
  def('spreadsheet_read', '读取项目内 XLSX／UTF-8 CSV／TSV，返回完整 SHA256、工作表、指定范围的值／公式／格式及项目规则。默认首表 A1:J20；每次最多2000格。修改前必须先读取。公式不由本工具计算；复杂结构可能只读。', {
    path: str('相对项目的 .xlsx／.csv／.tsv 文件'), sheet: str('工作表名称，默认首表'), range: str('A1:B20 形式的范围，最多2000格'),
  }, ['path']),
  def('spreadsheet_edit', '逐次审批后批量修改并保存工作簿。已有文件必须先 spreadsheet_read 并使用其 hash；新建用 new。拒绝并发、未保存或复杂不支持的工作簿；不执行宏、不计算公式。CSV只支持首表 set_cells 原始值，不支持公式或样式。不要用文本工具处理 XLSX。', {
    path: str('项目内目标文件路径'), expected_hash: str('刚读取的完整 SHA256；新建为 new'),
    operations: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object', additionalProperties: false, properties: {
      type: { type: 'string', enum: ['set_cells', 'add_sheet', 'rename_sheet'] }, sheet: str('现有工作表名；set_cells 默认首表'), name: str('新增／重命名后的工作表名'),
      cells: { type: 'array', minItems: 1, maxItems: 1000, items: { type: 'object', additionalProperties: false, properties: {
        address: str('A1 形式地址，至多第20000行／256列'), value: { type: ['string', 'number', 'boolean', 'null'] },
        formula: str('不含开头等号的 Excel 公式，与 value 二选一；没有缓存计算值'), style: styleSchema,
      }, required: ['address'] } },
    }, required: ['type'] } },
  }, ['path', 'expected_hash', 'operations']),
];
const only = (obj, keys) => obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).every((k) => keys.includes(k));
function address(value) {
  const m = typeof value === 'string' && /^([A-Z]{1,3})([1-9]\d{0,4})$/i.exec(value);
  if (!m) throw new Error('单元格地址应为 A1 形式。');
  let col = 0; for (const ch of m[1].toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64;
  const row = Number(m[2]);
  if (row > MAX_ROWS || col > MAX_COLS) throw new Error('表格工具范围上限为20000行、256列。');
  return { row, col, text: m[1].toUpperCase() + row };
}
function range(value = 'A1:J20') {
  if (typeof value !== 'string') throw new Error('读取范围无效。');
  const parts = value.split(':'); if (parts.length > 2) throw new Error('读取范围无效。');
  const a = address(parts[0]), b = address(parts[1] || parts[0]);
  if (a.row > b.row || a.col > b.col || (b.row - a.row + 1) * (b.col - a.col + 1) > 2000) throw new Error('读取范围须正向且不超过2000格。');
  return { a, b };
}
function sheetName(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 31 || /[\\/*?:\[\]\x00-\x1f]/.test(value) || /^'|'$/.test(value)) throw new Error('工作表名称应为1–31字符且不含特殊路径符号。');
  return value;
}
function style(value) {
  if (!only(value, Object.keys(styleSchema.properties))) throw new Error('单元格格式包含未知字段。');
  for (const [k, v] of Object.entries(value)) {
    if (['bold', 'italic', 'wrap'].includes(k) ? typeof v !== 'boolean'
      : k === 'font_size' ? !Number.isFinite(v) || v < 8 || v > 72
      : ['font_color', 'fill_color'].includes(k) ? typeof v !== 'string' || !/^[0-9a-f]{6}$/i.test(v)
      : k === 'alignment' ? !['left', 'center', 'right'].includes(v)
      : typeof v !== 'string' || v.length > 200) throw new Error('单元格格式无效：' + k);
  }
}
function validate(name, args) {
  const schema = DEFINITIONS.find((d) => d.function.name === name)?.function.parameters;
  if (!schema || !only(args, Object.keys(schema.properties)) || schema.required.some((k) => !Object.hasOwn(args, k))
    || typeof args.path !== 'string' || args.path.length > 4096 || args.sheet !== undefined && typeof args.sheet !== 'string') throw new Error('表格工具参数缺失或包含未知字段。');
  if (name === 'spreadsheet_read') { range(args.range); return; }
  if (typeof args.expected_hash !== 'string' || !/^(new|[a-f0-9]{64})$/.test(args.expected_hash)) throw new Error('文件版本应为读取返回的 SHA256 或 new。');
  if (!Array.isArray(args.operations) || !args.operations.length || args.operations.length > 50 || Buffer.byteLength(JSON.stringify(args)) > 512000) throw new Error('每批应为1–50项操作，参数不超过500KB。');
  let count = 0;
  for (const op of args.operations) {
    if (!only(op, ['type', 'sheet', 'name', 'cells']) || !['set_cells', 'add_sheet', 'rename_sheet'].includes(op.type)) throw new Error('表格操作无效。');
    if (op.sheet !== undefined) sheetName(op.sheet);
    if (op.type !== 'set_cells') { sheetName(op.name); if (op.cells !== undefined || op.type === 'rename_sheet' && !op.sheet) throw new Error('工作表操作参数不正确。'); continue; }
    if (op.name !== undefined || !Array.isArray(op.cells) || !op.cells.length || (count += op.cells.length) > 1000) throw new Error('每批最多修改1000格。');
    for (const cell of op.cells) {
      if (!only(cell, ['address', 'value', 'formula', 'style']) || !['value', 'formula', 'style'].some((k) => Object.hasOwn(cell, k))) throw new Error('单元格修改不能为空。');
      address(cell.address);
      if (Object.hasOwn(cell, 'value') && !(cell.value === null || typeof cell.value === 'boolean' || typeof cell.value === 'number' && Number.isFinite(cell.value) || typeof cell.value === 'string' && cell.value.length <= 32767)) throw new Error('单元格只接受有限数字、布尔值、文本或 null。');
      if (Object.hasOwn(cell, 'formula') && (Object.hasOwn(cell, 'value') || typeof cell.formula !== 'string' || !cell.formula || cell.formula.startsWith('=') || cell.formula.length > 8192)) throw new Error('公式应非空且不带开头等号，不能同时提供 value。');
      if (Object.hasOwn(cell, 'style')) style(cell.style);
    }
  }
}
// Inspect the archive before ExcelJS inflates it. Unsupported parts are readable
// but never rewritten; otherwise an office roundtrip could silently discard them.
async function inspectZip(bytes) {
  const zip = await new Promise((resolve, reject) => yauzl.fromBuffer(bytes, { lazyEntries: true, autoClose: false, strictFileNames: true }, (e, z) => e ? reject(e) : resolve(z)));
  try {
    return await new Promise((resolve, reject) => {
      let size = 0, count = 0, reason = '';
      zip.on('error', reject); zip.on('end', () => resolve(reason));
      zip.on('entry', (entry) => {
        size += entry.uncompressedSize; count += 1;
        if (size > 32 * 1024 * 1024 || count > 1000 || entry.generalPurposeBitFlag & 1) { reject(new Error('工作簿解压体积／条目超过限制，或包含加密内容。')); return; }
        const name = entry.fileName;
        const supported = /\/$/.test(name) || /^(?:\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(?:app|core)\.xml|xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|calcChain\.xml|theme\/theme\d+\.xml|worksheets\/sheet\d+\.xml|worksheets\/_rels\/sheet\d+\.xml\.rels))$/.test(name);
        if (!supported) reason ||= '包含图表、图片、表对象或其他暂不支持的工作簿部件：' + name;
        if (!/^xl\/(?:worksheets\/sheet\d+\.xml|workbook\.xml|styles\.xml)$/.test(name)) { zip.readEntry(); return; }
        zip.openReadStream(entry, (error, stream) => {
          if (error) { reject(error); return; }
          const chunks = [];
          stream.on('data', (data) => chunks.push(data)); stream.on('error', reject);
          stream.on('end', () => {
            let xml = Buffer.concat(chunks).toString('utf8');
            if (name === 'xl/styles.xml') {
              xml = xml.replace(/<ext uri="\{EB79DEF2-80B8-43e5-95BD-54CBDDF9020C\}" xmlns:x14="http:\/\/schemas\.microsoft\.com\/office\/spreadsheetml\/2009\/9\/main"><x14:slicerStyles defaultSlicerStyle="SlicerStyleLight1"\/><\/ext>/g, '')
                .replace(/<ext uri="\{9260A510-F301-46a8-8635-F512D64BE5F5\}" xmlns:x15="http:\/\/schemas\.microsoft\.com\/office\/spreadsheetml\/2010\/11\/main"><x15:timelineStyles defaultTimelineStyle="TimeSlicerStyleLight1"\/><\/ext>/g, '')
                .replace(/<extLst><\/extLst>/g, '');
            }
            if (/<(?:\w+:)?(?:extLst|drawing|legacyDrawing|tableParts|pivotTable|oleObjects|controls|picture|smartTags|sheetProtection|workbookProtection|conditionalFormatting|slicerList)(?:\s|>|\/)/.test(xml)) reason ||= '包含扩展、保护、条件格式或其他暂不能可靠保留的结构。';
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  } finally { zip.close(); }
}
function dimensions(workbook) {
  if (workbook.worksheets.length > 32) throw new Error('工作簿最多支持32个工作表。');
  let total = 0;
  for (const sheet of workbook.worksheets) {
    total += Math.max(1, sheet.rowCount) * Math.max(1, sheet.columnCount);
    if (sheet.rowCount > MAX_ROWS || sheet.columnCount > MAX_COLS || total > MAX_CELLS) throw new Error('工作簿超出20000行／256列／合计20万格的处理上限。');
  }
}
function cellData(cell) {
  const value = cell.value;
  const result = { address: cell.address, value: value ?? null };
  if (cell.formula) { result.value = null; result.formula = cell.formula; result.cached_result = cell.result ?? null; }
  result.format = { num_format: cell.numFmt, bold: cell.font?.bold, italic: cell.font?.italic, font_size: cell.font?.size,
    font_color: cell.font?.color?.argb, fill_color: cell.fill?.fgColor?.argb, alignment: cell.alignment?.horizontal, wrap: cell.alignment?.wrapText };
  return result;
}
function applyStyle(cell, s) {
  if (s.num_format !== undefined) cell.numFmt = s.num_format;
  const font = { ...cell.font };
  if (s.bold !== undefined) font.bold = s.bold;
  if (s.italic !== undefined) font.italic = s.italic;
  if (s.font_size !== undefined) font.size = s.font_size;
  if (s.font_color !== undefined) font.color = { argb: 'FF' + s.font_color.toUpperCase() };
  cell.font = font;
  if (s.fill_color !== undefined) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + s.fill_color.toUpperCase() } };
  cell.alignment = { ...cell.alignment, ...(s.alignment !== undefined ? { horizontal: s.alignment } : {}), ...(s.wrap !== undefined ? { wrapText: s.wrap } : {}) };
}
function createSpreadsheetTools({ projectFiles, readOnly = false, guard = async () => {}, policy = () => 'never', approve, authorize = async () => {}, isDirty = () => false, onFileChanged = () => {} }) {
  const observed = new Map();
  const check = async (signal, writing = false) => {
    await guard(); if (signal?.aborted) throw new Error('任务已停止。');
    if (writing && (readOnly || policy() !== 'on-request')) throw new Error('表格修改需要执行模式和逐次审批。');
  };
  async function load(item) {
    const kind = path.extname(item.target).toLowerCase();
    if (!['.xlsx', '.csv', '.tsv'].includes(kind)) throw new Error('表格工具只支持 .xlsx、.csv 和 .tsv。');
    const info = await fs.stat(item.target); if (!info.isFile() || info.size > MAX_BYTES) throw new Error('表格文件必须为8MB以内的普通文件。');
    const bytes = await fs.readFile(item.target); if (bytes.length > MAX_BYTES) throw new Error('文件在读取期间超过大小限制。');
    const workbook = new ExcelJS.Workbook(); let blocked = '';
    if (kind === '.xlsx') { blocked = await inspectZip(bytes); await workbook.xlsx.load(bytes); }
    else {
      const { parseCsv } = await import('./csv.mjs');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (text.includes('\0')) throw new Error('CSV／TSV 必须为 UTF-8 文本。');
      const rows = parseCsv(text, kind === '.tsv' ? '\t' : ','); const sheet = workbook.addWorksheet('Sheet1');
      sheet.addRows(rows);
    }
    dimensions(workbook);
    return { bytes, hash: hash(bytes), workbook, kind, blocked };
  }
  return {
    definitions: DEFINITIONS.filter((d) => d.function.name === 'spreadsheet_read' || !readOnly && policy() === 'on-request'),
    async execute(name, args, context = {}) {
      validate(name, args); const writing = name === 'spreadsheet_edit'; await check(context.signal, writing);
      const item = await projectFiles.resolve(args.path, writing);
      await authorize(writing ? 'file-write' : 'file-read', { path: item.target }, context);
      await check(context.signal, writing);
      if (writing && isDirty(item.target)) throw new Error('此表格有未保存修改，请先保存或取消编辑。');
      let original;
      try { original = await load(item); } catch (e) { if (e.code !== 'ENOENT' || !writing || args.expected_hash !== 'new') throw e; }
      if (!writing) {
        observed.set(item.target, original.hash);
        const sheet = args.sheet ? original.workbook.getWorksheet(args.sheet) : original.workbook.worksheets[0];
        if (!sheet) throw new Error('工作表不存在。');
        const bounds = range(args.range), cells = []; let truncated = false, outputSize = 0;
        outer: for (let row = bounds.a.row; row <= bounds.b.row; row += 1) for (let col = bounds.a.col; col <= bounds.b.col; col += 1) {
          const cell = sheet.getCell(row, col); if (cell.value === null && !cell.hasStyle) continue;
          const value = cellData(cell), size = JSON.stringify(value).length;
          if (outputSize + size > 64000) { truncated = true; break outer; }
          cells.push(value); outputSize += size;
        }
        await check(context.signal);
        return { ok: true, path: item.relative, hash: original.hash, sheet: sheet.name, range: args.range || 'A1:J20',
          worksheets: original.workbook.worksheets.map((s) => ({ name: s.name, rows: s.rowCount, columns: s.columnCount })),
          cells, truncated, writable: !original.blocked, warning: original.blocked || '公式返回已有缓存，工具不计算公式。', instructions: await projectFiles.instructions(item.target),
          activity: { title: '读取表格', detail: item.relative + ' · ' + sheet.name, path: item.target, output: JSON.stringify({ cells, truncated, warning: original.blocked || '公式不在本机计算。' }, null, 2).slice(0, 24000) } };
      }
      if (original ? observed.get(item.target) !== args.expected_hash || original.hash !== args.expected_hash : args.expected_hash !== 'new') throw new Error('表格版本已变化或尚未读取，请重新 spreadsheet_read。');
      if (original?.blocked) throw new Error('未覆盖原工作簿：' + original.blocked);
      const kind = path.extname(item.target).toLowerCase();
      if (!['.xlsx', '.csv', '.tsv'].includes(kind)) throw new Error('目标扩展名必须为 xlsx／csv／tsv。');
      const workbook = original?.workbook || new ExcelJS.Workbook();
      if (!workbook.worksheets.length) workbook.addWorksheet('Sheet1');
      const preview = [];
      for (const op of args.operations) {
        if (op.type !== 'set_cells') {
          if (kind !== '.xlsx') throw new Error('CSV／TSV 只有一个工作表，不支持新增或重命名。');
          const existing = workbook.worksheets.find((s) => s.name.toLowerCase() === op.name.toLowerCase());
          if (existing) throw new Error('工作表名称已存在。');
          if (op.type === 'add_sheet') workbook.addWorksheet(op.name);
          else {
            const sheet = workbook.getWorksheet(op.sheet); if (!sheet) throw new Error('工作表不存在。');
            // ExcelJS does not rewrite formulas when renaming a sheet.
            if (workbook.worksheets.some((s) => s.getSheetValues().some((r) => r?.some((v) => v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)))) || workbook.definedNames.model.length) throw new Error('含公式或命名引用的工作簿暂不自动重命名，请在 Excel 中处理引用。');
            sheet.name = op.name;
          }
          preview.push({ operation: op.type, sheet: op.sheet, name: op.name }); continue;
        }
        const sheet = op.sheet ? workbook.getWorksheet(op.sheet) : workbook.worksheets[0];
        if (!sheet) throw new Error('工作表不存在。');
        for (const change of op.cells) {
          const a = address(change.address), cell = sheet.getCell(a.row, a.col);
          if (cell.isMerged && cell.master.address !== cell.address) throw new Error('不能修改合并单元格的从属格，请修改左上角主格。');
          if (kind !== '.xlsx' && (change.formula !== undefined || change.style !== undefined)) throw new Error('CSV／TSV 不支持公式和样式；以 = 开头的 value 作为原始文本保存。');
          const before = cellData(cell);
          if (Object.hasOwn(change, 'value')) cell.value = change.value;
          if (Object.hasOwn(change, 'formula')) cell.value = { formula: change.formula };
          if (change.style) applyStyle(cell, change.style);
          preview.push({ sheet: sheet.name, before, after: cellData(cell) });
        }
      }
      dimensions(workbook); workbook.calcProperties.fullCalcOnLoad = true;
      let data;
      if (kind === '.xlsx') data = Buffer.from(await workbook.xlsx.writeBuffer());
      else {
        const { stringifyCsv } = await import('./csv.mjs');
        const sheet = workbook.worksheets[0], rows = [];
        for (let r = 1; r <= sheet.rowCount; r += 1) { const values = []; for (let c = 1; c <= sheet.columnCount; c += 1) values.push(sheet.getCell(r, c).value ?? ''); rows.push(values); }
        const text = stringifyCsv(rows, kind === '.tsv' ? '\t' : ',');
        data = Buffer.from((original?.bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])) ? '\uFEFF' : '') + text, 'utf8');
      }
      if (data.length > MAX_BYTES) throw new Error('修改后文件超过8MB，未写入。');
      await check(context.signal, true);
      if (typeof approve !== 'function') throw new Error('缺少表格审批处理器。');
      const summary = JSON.stringify({ file: item.relative, version: original?.hash || 'new', changes: preview }, null, 2);
      await approve({ kind: 'spreadsheet', title: '保存表格修改', path: item.target, command: summary.slice(0, 24000) + (summary.length > 24000 ? '\n[预览已截断；操作计数：' + preview.length + ']' : ''),
        note: '批准后保存这一批修改。公式只写入，需由 Excel 等表格软件重新计算；未保存编辑或文件版本变化会阻止覆盖。', allowLabel: '允许本次表格修改' }, context.signal);
      await check(context.signal, true);
      const fresh = await projectFiles.resolve(args.path, true);
      if (fresh.target !== item.target || isDirty(item.target)) throw new Error('路径或未保存编辑状态已变化，未覆盖表格。');
      await fs.mkdir(path.dirname(item.target), { recursive: true });
      const temporary = item.target + '.scodex-' + crypto.randomUUID() + '.tmp';
      return withFileCommit(item.target, async () => {
      try {
        await fs.writeFile(temporary, data, { flag: 'wx' }); await check(context.signal, true);
        await projectFiles.resolve(args.path, true);
        if (isDirty(item.target)) throw new Error('表格出现未保存修改，未覆盖。');
        let current; try { current = await fs.readFile(item.target); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        if (original ? !current || hash(current) !== original.hash : Boolean(current)) throw new Error('审批期间表格已被其他程序修改，未覆盖原文件。');
        if (original) await fs.rename(temporary, item.target);
        else { await fs.link(temporary, item.target); await fs.unlink(temporary); }
        const saved = await fs.readFile(item.target), savedHash = hash(saved);
        if (savedHash !== hash(data)) throw new Error('保存后表格发生变化，请重新读取。');
        observed.set(item.target, savedHash); onFileChanged(item.target);
        return { ok: true, path: item.relative, hash: savedHash, changes: preview.length, bytes: saved.length, formula_calculated: false,
          activity: { title: '保存表格', detail: item.relative + ' · ' + preview.length + ' 项修改', path: item.target, output: '已保存并回读校验。公式未在本机计算。\n' + summary.slice(0, 23000) } };
      } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
      });
    },
  };
}
module.exports = { createSpreadsheetTools, DEFINITIONS, validate, inspectZip, address, range };
