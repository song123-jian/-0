const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { decodeText } = require('./chat-attachments.cjs');

const MAX_UNPACKED_BYTES = 32 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = new Set(['.doc', '.docx', '.docm', '.pdf', '.xlsx', '.xlsm', '.pptx', '.pptm', '.odt', '.ods', '.odp', '.rtf']);
const OLE_SIGNATURE = Buffer.from('d0cf11e0a1b11ae1', 'hex');

function failure(status) { return Object.assign(new Error(status), { parseStatus: status }); }

function oleHasStream(bytes, name) {
  const label = Buffer.from(name + '\0', 'utf16le');
  for (let offset = 512; offset + 128 <= bytes.length; offset += 128) {
    if (bytes[offset + 66] === 2 && bytes.readUInt16LE(offset + 64) === label.length && bytes.subarray(offset, offset + label.length).equals(label)) return true;
  }
  return false;
}

function outputText() {
  let text = '', pendingHigh = '';
  return {
    get full() { return false; },
    add(value) {
      if (!value) return;
      value = pendingHigh + String(value).replace(/\0/g, ''); pendingHigh = '';
      const last = value.charCodeAt(value.length - 1);
      if (last >= 0xd800 && last <= 0xdbff) { pendingHigh = value.slice(-1); value = value.slice(0, -1); }
      if (/[\ud800-\udfff]/u.test(value)) throw failure('invalid');
      text += value;
    },
    result(format, emptyStatus = 'empty') {
      if (pendingHigh) throw failure('invalid');
      const empty = !text.trim();
      return { format, text, parsed: !empty || emptyStatus === 'empty', parseStatus: empty ? emptyStatus : 'parsed' };
    },
  };
}

// Inspect the central directory before any Office parser inflates data. Never extract to disk.
async function archive(bytes) {
  const yauzl = require('yauzl');
  const zip = await new Promise((resolve, reject) => yauzl.fromBuffer(bytes, { lazyEntries: true, autoClose: false, strictFileNames: true }, (error, value) => error ? reject(error) : resolve(value)));
  const entries = new Map();
  try {
    await new Promise((resolve, reject) => {
      let total = 0;
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', (entry) => {
        if (entry.generalPurposeBitFlag & 1) { reject(failure('encrypted')); return; }
        total += entry.uncompressedSize;
        if (entries.size >= 4096 || total > MAX_UNPACKED_BYTES || entry.uncompressedSize > MAX_ENTRY_BYTES) { reject(failure('resource-limit')); return; }
        if (entries.has(entry.fileName)) { reject(failure('invalid')); return; }
        entries.set(entry.fileName, entry);
        zip.readEntry();
      });
      zip.readEntry();
    });
  } catch (error) { zip.close(); throw error; }
  return {
    entries,
    close: () => zip.close(),
    async read(name) {
      const entry = entries.get(name);
      if (!entry) throw failure('invalid');
      const stream = await new Promise((resolve, reject) => zip.openReadStream(entry, (error, value) => error ? reject(error) : resolve(value)));
      const parts = []; let count = 0;
      for await (const chunk of stream) {
        count += chunk.length;
        if (count > MAX_ENTRY_BYTES || count > entry.uncompressedSize) { stream.destroy(); throw failure('resource-limit'); }
        parts.push(chunk);
      }
      return Buffer.concat(parts).toString('utf8');
    },
  };
}

function xmlRead(xml, handlers) {
  const { SaxesParser } = require('saxes');
  const parser = new SaxesParser({ xmlns: true });
  parser.on('doctype', () => { throw failure('invalid'); });
  for (const [event, handler] of Object.entries(handlers)) parser.on(event, handler);
  parser.write(xml).close();
}

async function wordText(bytes, format, output) {
  const WordExtractor = require('word-extractor');
  if (format === 'doc') {
    // The pinned library exposes no password flag; inspect its compound stream first.
    const Compound = require('word-extractor/lib/ole-compound-doc');
    const BufferReader = require('word-extractor/lib/buffer-reader');
    const reader = new BufferReader(bytes);
    await reader.open();
    try {
      const compound = new Compound(reader); await compound.read();
      const chunks = []; let size = 0;
      for await (const chunk of compound.stream('WordDocument')) {
        size += chunk.length;
        if (size > MAX_ENTRY_BYTES) throw failure('resource-limit');
        chunks.push(chunk);
      }
      const stream = Buffer.concat(chunks);
      if (stream.length < 12 || stream.readUInt16LE(0) !== 0xa5ec) throw failure('invalid');
      if (stream.readUInt16LE(10) & 0x8100) throw failure('encrypted');
    } finally { await reader.close(); }
  }
  const document = await new WordExtractor().extract(bytes);
  const parts = [document.getBody({ filterUnicode: false }), document.getTextboxes({ filterUnicode: false }), document.getHeaders({ includeFooters: false, filterUnicode: false }), document.getFooters({ filterUnicode: false }), document.getFootnotes({ filterUnicode: false }), document.getEndnotes({ filterUnicode: false })];
  output.add(parts.filter((part) => part && part.trim()).join('\n'));
  return output.result(format);
}

async function docxText(zip, output) {
  const parts = [...zip.entries.keys()].filter((name) => /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(name));
  parts.sort((a, b) => (a === 'word/document.xml' ? -1 : b === 'word/document.xml' ? 1 : a.localeCompare(b, undefined, { numeric: true })));
  for (const name of parts) {
    if (output.full) break;
    let inText = false, skipped = 0;
    xmlRead(await zip.read(name), {
      opentag: (node) => {
        if (skipped) { skipped++; return; }
        if (['del', 'instrText', 'delText'].includes(node.local)) { skipped = 1; return; }
        if (node.local === 't') inText = true;
        if (node.local === 'tab') output.add('\t');
        if (['br', 'cr'].includes(node.local)) output.add('\n');
      },
      text: (text) => { if (inText && !skipped) output.add(text); },
      closetag: (node) => {
        if (skipped) { skipped--; return; }
        if (node.local === 't') inText = false;
        if (node.local === 'p') output.add('\n');
        if (node.local === 'tc') output.add('\t');
      },
    });
    output.add('\n');
  }
  return output.result('docx');
}

async function spreadsheetText(bytes, output) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes, { ignoreNodes: ['drawing', 'picture', 'extLst'] });
  const cellText = (value) => {
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
    if ('result' in value) return cellText(value.result);
    return value.text || value.error || (value.formula ? `=${value.formula}` : '');
  };
  let cells = 0;
  for (const sheet of workbook.worksheets) {
    if (output.full) break;
    output.add(`[工作表：${sheet.name}]\n`);
    sheet.eachRow((row) => {
      if (output.full) return;
      const values = [];
      row.eachCell({ includeEmpty: true }, (cell) => { if (++cells > 100000) throw failure('resource-limit'); values.push(cellText(cell.value)); });
      output.add(values.join('\t') + '\n');
    });
  }
  return output.result('xlsx');
}

async function presentationText(zip, output) {
  const order = [], relations = new Map();
  xmlRead(await zip.read('ppt/presentation.xml'), { opentag: (node) => {
    if (node.local === 'sldId') order.push(Object.values(node.attributes).find((attr) => attr.local === 'id' && attr.prefix)?.value);
  } });
  xmlRead(await zip.read('ppt/_rels/presentation.xml.rels'), { opentag: (node) => {
    if (node.local === 'Relationship' && node.attributes.TargetMode?.value !== 'External') relations.set(node.attributes.Id?.value, node.attributes.Target?.value);
  } });
  let index = 0;
  for (const id of order) {
    if (output.full) break;
    const target = relations.get(id);
    if (!target) throw failure('invalid');
    const entry = target.startsWith('/') ? target.slice(1) : path.posix.normalize('ppt/' + target);
    if (!/^ppt\/slides\/[^/]+\.xml$/.test(entry)) throw failure('invalid');
    output.add(`[幻灯片 ${++index}]\n`);
    let inText = false;
    xmlRead(await zip.read(entry), {
      opentag: (node) => { if (node.local === 't') inText = true; if (node.local === 'br') output.add('\n'); },
      text: (text) => { if (inText) output.add(text); },
      closetag: (node) => { if (node.local === 't') inText = false; if (node.local === 'p') output.add('\n'); },
    });
  }
  return output.result('pptx');
}

async function openDocumentText(zip, format, output) {
  if (zip.entries.has('META-INF/manifest.xml')) {
    let encrypted = false;
    xmlRead(await zip.read('META-INF/manifest.xml'), { opentag: (node) => { if (node.local === 'encryption-data') encrypted = true; } });
    if (encrypted) throw failure('encrypted');
  }
  let textDepth = 0;
  xmlRead(await zip.read('content.xml'), {
    opentag: (node) => {
      if (node.uri === 'urn:oasis:names:tc:opendocument:xmlns:text:1.0') {
        if (node.local === 'p' || node.local === 'h') textDepth++;
        if (textDepth && node.local === 'tab') output.add('\t');
        if (textDepth && node.local === 'line-break') output.add('\n');
        if (textDepth && node.local === 's') {
          const count = Number(Object.values(node.attributes).find((attr) => attr.local === 'c')?.value || 1);
          output.add(' '.repeat(Math.min(256, Math.max(1, Number.isFinite(count) ? count : 1))));
        }
      }
    },
    text: (value) => { if (textDepth) output.add(value); },
    closetag: (node) => { if (node.uri === 'urn:oasis:names:tc:opendocument:xmlns:text:1.0' && ['p', 'h'].includes(node.local)) { textDepth--; output.add('\n'); } },
  });
  return output.result(format);
}

async function pdfText(bytes, output) {
  const actualProcess = globalThis.process;
  // PDF.js excludes Electron utility processes from its Node backend detection.
  // A local JS view selects that backend without changing native process properties.
  if (actualProcess.versions.electron && actualProcess.type === 'utility') {
    const nodeView = Object.create(actualProcess);
    Object.defineProperty(nodeView, 'type', { value: 'browser' });
    globalThis.process = nodeView;
  }
  let task;
  try {
  const root = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const pdfjs = await import(pathToFileURL(path.join(root, 'legacy/build/pdf.mjs')).href);
  task = pdfjs.getDocument({
    data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false, enableXfa: false,
    disableFontFace: true, useSystemFonts: false, useWorkerFetch: false, useWasm: false,
    isOffscreenCanvasSupported: false, isImageDecoderSupported: false, maxImageSize: 1,
    cMapUrl: root.replaceAll('\\', '/') + '/cmaps/', cMapPacked: true,
    standardFontDataUrl: root.replaceAll('\\', '/') + '/standard_fonts/',
  });
    const document = await task.promise;
    if (document.numPages > 300) throw failure('resource-limit');
    for (let i = 1; i <= document.numPages && !output.full; i++) {
      const page = await document.getPage(i);
      try {
        const content = await page.getTextContent();
        for (const item of content.items) if (typeof item.str === 'string') output.add(item.str + (item.hasEOL ? '\n' : ' '));
        output.add('\n');
      } finally { page.cleanup(); }
    }
    return output.result('pdf', 'scanned');
  } catch (error) {
    if (error.name === 'PasswordException') throw failure('encrypted');
    if (error.parseStatus) throw error;
    throw failure(error.name === 'InvalidPDFException' ? 'invalid' : 'failed');
  } finally {
    try { await task?.destroy(); }
    finally { globalThis.process = actualProcess; }
  }
}

function rtfText(bytes, output) {
  const source = bytes.toString('latin1');
  const skipped = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'objdata', 'fldinst', 'datastore', 'themedata']);
  let state = { skip: false, uc: 1, encoding: 'windows-1252' }, stack = [], fallback = 0, index = 0;
  const add = (text) => { if (state.skip) return; if (fallback) { const count = Math.min(fallback, text.length); fallback -= count; text = text.slice(count); } output.add(text); };
  while (index < source.length) {
    const char = source[index++];
    if (char === '{') { if (stack.length >= 256) throw failure('resource-limit'); stack.push({ ...state }); }
    else if (char === '}') { if (!stack.length) throw failure('invalid'); state = stack.pop(); }
    else if (char === '\\') {
      const remaining = source.slice(index);
      if (source[index] === "'") {
        const values = []; while (source[index] === "'" && /^[a-f\d]{2}$/i.test(source.slice(index + 1, index + 3))) { values.push(parseInt(source.slice(index + 1, index + 3), 16)); index += 3; if (source[index] === '\\' && source[index + 1] === "'") index++; else break; }
        if (!values.length) throw failure('invalid');
        add(new TextDecoder(state.encoding).decode(Uint8Array.from(values)));
      } else if (/^[a-z]/i.test(remaining)) {
        const match = /^([a-z]+)(-?\d+)? ?/i.exec(remaining); index += match[0].length;
        const word = match[1].toLowerCase(), number = Number(match[2]);
        if (skipped.has(word)) state.skip = true;
        else if (word === 'ansicpg') state.encoding = number === 65001 ? 'utf-8' : number === 936 ? 'gbk' : 'windows-' + number;
        else if (word === 'uc') state.uc = Math.min(16, Math.max(0, number));
        else if (word === 'u') { if (!state.skip) output.add(String.fromCharCode(number & 0xffff)); fallback = state.uc; }
        else if (['par', 'line', 'row'].includes(word)) add('\n');
        else if (['tab', 'cell'].includes(word)) add('\t');
        else if (word === 'bin') { if (!Number.isSafeInteger(number) || number < 0 || index + number > source.length) throw failure('invalid'); index += number; }
      } else {
        const symbol = source[index++];
        if (symbol === '*') state.skip = true;
        else if (symbol === '~') add(' ');
        else if (['\\', '{', '}'].includes(symbol)) add(symbol);
      }
    } else if (char !== '\n' && char !== '\r') add(char.charCodeAt(0) > 127 ? new TextDecoder(state.encoding).decode(Buffer.from([char.charCodeAt(0)])) : char);
  }
  if (stack.length) throw failure('invalid');
  return output.result('rtf');
}

async function extractAttachment(item) {
  const bytes = item.data, extension = path.extname(item.name).toLowerCase(), output = outputText();
  let format = '';
  try {
    if (bytes.subarray(0, 5).toString('ascii') === '%PDF-' || extension === '.pdf') { format = 'pdf'; return await pdfText(bytes, output); }
    if (bytes.subarray(0, 5).toString('ascii') === '{\\rtf' || extension === '.rtf') {
      format = 'rtf'; if (!bytes.subarray(0, 5).equals(Buffer.from('{\\rtf'))) throw failure('invalid');
      return rtfText(bytes, output);
    }
    if (bytes.subarray(0, 8).equals(OLE_SIGNATURE)) {
      if (oleHasStream(bytes, 'EncryptedPackage') || oleHasStream(bytes, 'EncryptionInfo')) throw failure('encrypted');
      if (extension === '.doc' || oleHasStream(bytes, 'WordDocument')) { format = 'doc'; return await wordText(bytes, format, output); }
      return { parsed: false, parseStatus: 'unsupported' };
    }
    if (bytes.subarray(0, 2).toString('ascii') === 'PK' || ['.docx', '.docm', '.xlsx', '.xlsm', '.pptx', '.pptm', '.odt', '.ods', '.odp'].includes(extension)) {
      const zip = await archive(bytes);
      try {
        if (zip.entries.has('word/document.xml')) { format = 'docx'; return await docxText(zip, output); }
        if (zip.entries.has('xl/workbook.xml')) { format = 'xlsx'; return await spreadsheetText(bytes, output); }
        if (zip.entries.has('ppt/presentation.xml')) { format = 'pptx'; return await presentationText(zip, output); }
        if (zip.entries.has('content.xml') && zip.entries.has('mimetype')) {
          const mime = (await zip.read('mimetype')).trim();
          format = { 'application/vnd.oasis.opendocument.text': 'odt', 'application/vnd.oasis.opendocument.spreadsheet': 'ods', 'application/vnd.oasis.opendocument.presentation': 'odp' }[mime] || '';
          if (format) return await openDocumentText(zip, format, output);
        }
        if (DOCUMENT_EXTENSIONS.has(extension)) throw failure('invalid');
        return { parsed: false, parseStatus: 'unsupported' };
      } finally { zip.close(); }
    }
    if (DOCUMENT_EXTENSIONS.has(extension)) throw failure('invalid');
    // Avoid mistaking known media/executables for text even when their first bytes are ASCII.
    if (/\.(?:exe|dll|bin|wasm|png|jpe?g|gif|webp|ico|mp[34]|wav|ogg|zip|7z|rar|xls|ppt)$/i.test(item.name) || /^(?:image|audio|video)\//.test(item.mimeType)) return { parsed: false, parseStatus: 'unsupported' };
    const text = decodeText(bytes);
    if (text === null) return { parsed: false, parseStatus: item.mimeType.startsWith('text/') ? 'encoding-error' : 'unsupported' };
    output.add(text);
    return output.result('text');
  } catch (error) {
    return { parsed: false, text: '', format, parseStatus: error.parseStatus || 'invalid' };
  }
}

module.exports = { extractAttachment, archive };
