const path = require('node:path');
const { archive } = require('./document-text.cjs');
const { parseFile } = require('./chat-attachment-parser.cjs');
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function normalizeSpec(value, type = 'docx') {
  if (!value || typeof value.title !== 'string' || !Array.isArray(value.sections) || value.sections.length < 1 || value.sections.length > 80 || JSON.stringify(value).length > 150000) throw new Error('文档须包含标题和1至80个章节，总内容不超过150000字符。');
  const sections = value.sections.map(item => {
    if (!item || typeof item.heading !== 'string' || !Array.isArray(item.paragraphs) || item.paragraphs.some(p => typeof p !== 'string') || item.paragraphs.length > 200) throw new Error('章节须包含标题与正文段落。');
    if (item.heading.length > 160 || item.paragraphs.some(p => p.length > 20000)) throw new Error('章节标题或段落过长。');
    if (item.table !== undefined && (!Array.isArray(item.table) || item.table.length > 100 || item.table.some(row => !Array.isArray(row) || row.length > 12 || row.some(cell => typeof cell !== 'string' || cell.length > 2000)))) throw new Error('表格最多100行12列，每格最多2000字符。');
    if (type === 'pptx' && (item.paragraphs.length > 8 || item.paragraphs.some(p => p.length > 140) || item.heading.length > 60 || item.table && (item.table.length > 8 || item.table.some(r => r.length > 5 || r.some(c => c.length > 50))) || item.table?.length && item.paragraphs.length > 3)) throw new Error('单张幻灯片内容过多；请拆分为多页，正文最多8段每段140字符，表格最多8行5列。');
    return { heading: item.heading, paragraphs: item.paragraphs, ...(item.table ? { table: item.table } : {}) };
  });
  return { title: value.title.slice(0, 160), sections };
}
async function buildOffice(value, type) {
  const spec = normalizeSpec(value, type); let bytes;
  if (type === 'docx') {
    const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType } = require('docx');
    const children = [new Paragraph({ text: spec.title, heading: HeadingLevel.TITLE })];
    for (const section of spec.sections) {
      children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }));
      for (const text of section.paragraphs) children.push(new Paragraph({ text, spacing: { after: 180, line: 300 } }));
      if (section.table?.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: section.table.map(row => new TableRow({ children: row.map(text => new TableCell({ children: [new Paragraph(text)] })) })) }));
    }
    bytes = await Packer.toBuffer(new Document({ creator: 'Scodex Workbench', title: spec.title, styles: { default: { document: { run: { font: 'Microsoft YaHei', size: 22 } } } }, sections: [{ children }] }));
  } else if (type === 'pptx') {
    const PptxGenJS = require('pptxgenjs'); const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Scodex Workbench'; pptx.subject = spec.title; pptx.title = spec.title; pptx.lang = 'zh-CN'; pptx.theme = { headFontFace: 'Microsoft YaHei', bodyFontFace: 'Microsoft YaHei', lang: 'zh-CN' };
    for (const [index, section] of spec.sections.entries()) {
      const slide = pptx.addSlide(); slide.background = { color: 'FAFBFC' };
      slide.addText(section.heading || spec.title, { x: 0.65, y: 0.5, w: 12, h: 0.75, fontSize: 28, bold: true, color: '182438', breakLine: false });
      if (section.paragraphs.length) slide.addText(section.paragraphs.join('\n\n'), { x: 0.7, y: 1.55, w: 11.9, h: section.table?.length ? 2 : 4.9, fontSize: 20, color: '273548', valign: 'top', margin: 0, fit: 'shrink' });
      if (section.table?.length) slide.addTable(section.table, { x: 0.7, y: section.paragraphs.length ? 3.7 : 1.55, w: 11.9, h: 2.8, fontFace: 'Microsoft YaHei', fontSize: 16, color: '273548', fill: 'FFFFFF', border: { type: 'solid', pt: 1, color: 'CED7E1' }, margin: 0.08, autoPage: false });
      slide.addText(`${spec.title} · ${index + 1}`, { x: 0.7, y: 7.05, w: 11.9, h: 0.2, fontSize: 10, color: '64748B' });
    }
    bytes = await pptx.write({ outputType: 'nodebuffer' });
  } else throw new Error('办公成品仅支持DOCX和PPTX。');
  const JSZip = require('jszip'); const zip = await JSZip.loadAsync(bytes);
  zip.file('scodex/content.json', JSON.stringify(spec));
  const types = zip.file('[Content_Types].xml'); zip.file('[Content_Types].xml', (await types.async('string')).replace('</Types>', '<Default Extension="json" ContentType="application/json"/></Types>'));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
async function readOffice(bytes, name) {
  if (bytes.length > 16 * 1024 * 1024) throw new Error('办公文件超过16MB读取上限。');
  const parsed = await parseFile({ name, data: bytes, size: bytes.length, mimeType: 'application/octet-stream' });
  if (!parsed.parsed) throw new Error('无法提取此文件正文：' + parsed.parseStatus);
  let spec = null;
  if (/\.(docx|pptx)$/i.test(name)) { const zip = await archive(bytes); try { if (zip.entries.has('scodex/content.json')) spec = normalizeSpec(JSON.parse(await zip.read('scodex/content.json')), path.extname(name).slice(1).toLowerCase()); } finally { zip.close(); } }
  return { text: parsed.text, truncated: parsed.truncated, editable: Boolean(spec), spec, title: spec?.title || path.basename(name) };
}
function documentHtml(value) {
  const spec = normalizeSpec(value); const table = rows => '<table>' + rows.map(row => '<tr>' + row.map(cell => '<td>' + escapeHtml(cell) + '</td>').join('') + '</tr>').join('') + '</table>';
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>' + escapeHtml(spec.title) + '</title><style>@page{size:A4;margin:20mm}body{font-family:"Microsoft YaHei",sans-serif;color:#182438;margin:32px;line-height:1.65}h1{font-size:28px}h2{font-size:21px;border-bottom:1px solid #d4dce5;padding-bottom:8px}p{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:14px}td{border:1px solid #cbd5e1;padding:8px;overflow-wrap:anywhere}tr{break-inside:avoid}h2{break-after:avoid}</style><body><h1>' + escapeHtml(spec.title) + '</h1>' + spec.sections.map(section => '<section><h2>' + escapeHtml(section.heading) + '</h2>' + section.paragraphs.map(p => '<p>' + escapeHtml(p) + '</p>').join('') + (section.table?.length ? table(section.table) : '') + '</section>').join('') + '</body></html>';
}
function createPdfRenderer({ BrowserWindow }) {
  return async (spec, signal) => {
    if (signal?.aborted) throw new Error('任务已停止。');
    const worker = new BrowserWindow({ show: false, skipTaskbar: true, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, partition: 'scodex-doc-' + require('node:crypto').randomUUID() } });
    let timer, abort;
    try {
      worker.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); worker.webContents.session.setPermissionRequestHandler((_c, _p, cb) => cb(false));
      const operation = async () => { await worker.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(documentHtml(spec))); return worker.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true }); };
      return await Promise.race([operation(), new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('PDF导出超时。')), 30000); abort = () => reject(new Error('任务已停止。')); signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort(); })]);
    } finally { clearTimeout(timer); if (abort) signal?.removeEventListener('abort', abort); if (!worker.isDestroyed()) worker.destroy(); }
  };
}
module.exports = { normalizeSpec, buildOffice, readOffice, documentHtml, createPdfRenderer };
