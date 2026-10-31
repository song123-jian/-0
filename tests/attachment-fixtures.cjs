// Generated, non-sensitive documents shared by parser and packaged-app acceptance tests.
const JSZip = require('jszip');
const ExcelJS = require('exceljs');
const xml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const zipBytes = (zip) => zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

async function docx(text = 'DOCX正文：中文 🚀', extra = '') {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${xml(text)}</w:t></w:r></w:p>${extra}<w:sectPr/></w:body></w:document>`, 'utf8'));
  return zipBytes(zip);
}

function legacyDoc(text = 'DOC旧版正文：中文', { encrypted = false, cycle = false } = {}) {
  const end = 0xfffffffe, free = 0xffffffff, body = Buffer.from(text + '\r', 'utf16le');
  const header = Buffer.alloc(512); Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(header);
  header.writeUInt16LE(0x3e, 24); header.writeUInt16LE(3, 26); header.writeUInt16LE(0xfffe, 28); header.writeUInt16LE(9, 30); header.writeUInt16LE(6, 32);
  header.writeUInt32LE(1, 44); header.writeUInt32LE(0, 48); header.writeUInt32LE(4096, 56); header.writeUInt32LE(end, 60); header.writeUInt32LE(end, 68);
  for (let i = 0; i < 109; i++) header.writeUInt32LE(i ? free : 17, 76 + i * 4);
  const directory = Buffer.alloc(512);
  const entry = (index, name, type, first, size, child = free, left = free) => {
    const start = index * 128, label = Buffer.from(name + '\0', 'utf16le'); label.copy(directory, start);
    directory.writeUInt16LE(label.length, start + 64); directory[start + 66] = type; directory[start + 67] = 1;
    directory.writeUInt32LE(left, start + 68); directory.writeUInt32LE(free, start + 72); directory.writeUInt32LE(child, start + 76);
    directory.writeUInt32LE(first, start + 116); directory.writeUInt32LE(size, start + 120);
  };
  entry(0, 'Root Entry', 5, end, 0, 1); entry(1, 'WordDocument', 2, 1, 4096, free, 2); entry(2, '0Table', 2, 9, 4096);
  const word = Buffer.alloc(4096), table = Buffer.alloc(4096), fat = Buffer.alloc(512, 255);
  word.writeUInt16LE(0xa5ec, 0); word.writeUInt16LE(0xc1, 2); word.writeUInt16LE(encrypted ? 0x104 : 4, 10);
  word.writeUInt32LE(1024, 24); word.writeUInt32LE(1024 + body.length, 28); word.writeUInt32LE(text.length + 1, 0x4c); word.writeUInt32LE(21, 0x1a6); body.copy(word, 1024);
  table[0] = 2; table.writeUInt32LE(16, 1); table.writeUInt32LE(text.length + 1, 9); table.writeUInt32LE(1024, 15);
  fat.writeUInt32LE(end, 0); for (let i = 1; i <= 16; i++) fat.writeUInt32LE(i === 8 || i === 16 ? end : i + 1, i * 4);
  if (cycle) fat.writeUInt32LE(7, 8 * 4);
  fat.writeUInt32LE(0xfffffffd, 17 * 4);
  return Buffer.concat([header, directory, word, table, fat]);
}

function pdf(text = 'PDF_BODY_MARKER', { blank = false, encrypted = false } = {}) {
  const stream = blank ? '' : `BT /F1 12 Tf 50 750 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  if (encrypted) objects.push('<< /Filter /Standard /V 1 /R 2 /Length 40 /O <' + '00'.repeat(32) + '> /U <' + '00'.repeat(32) + '> /P -4 >>');
  let result = '%PDF-1.4\n', offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(result)); result += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n').join('');
  result += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${encrypted ? '/Encrypt 6 0 R /ID [<00112233445566778899aabbccddeeff><00112233445566778899aabbccddeeff>]' : ''} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(result);
}

async function xlsx() {
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet('中文数据');
  sheet.addRow(['名称', '数量', '合计']); sheet.addRow(['苹果', 3, { formula: 'B2*2', result: 6 }]);
  sheet.addRow([{ richText: [{ text: '富文本' }, { text: '正文' }] }, true]);
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function pptx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>');
  zip.file('ppt/presentation.xml', '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst></p:presentation>');
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>');
  for (const [number, text] of [[1, '第二页正文'], [2, '第一页中文正文']]) zip.file(`ppt/slides/slide${number}.xml`, `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  return zipBytes(zip);
}

async function odf(format = 'odt', { encrypted = false } = {}) {
  const zip = new JSZip(), types = { odt: 'text', ods: 'spreadsheet', odp: 'presentation' };
  zip.file('mimetype', 'application/vnd.oasis.opendocument.' + types[format]);
  zip.file('META-INF/manifest.xml', `<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">${encrypted ? '<manifest:encryption-data/>' : ''}</manifest:manifest>`);
  zip.file('content.xml', '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text><text:p>开放文档正文<text:tab/>中文<text:s text:c="2"/>内容</text:p></office:text></office:body></office:document-content>');
  return zipBytes(zip);
}

const rtf = () => Buffer.from('{\\rtf1\\ansi\\ansicpg1252{\\fonttbl{\\f0 Arial;}}RTF正文 \\u20013?\\u25991?\\par visible {\\*\\generator HIDDEN;}\\{ok\\}}'.replace('正文', 'body'), 'ascii');
module.exports = { docx, legacyDoc, pdf, xlsx, pptx, odf, rtf, zipBytes };
