const crypto = require('node:crypto');

const VISUALIZATION_SCHEME = 'scodex-chart';
const VISUALIZATION_PREFIX = VISUALIZATION_SCHEME + '://view/';

function createVisualizationDocuments({ maxEntries = 128, maxDocumentBytes = 1024 * 1024, maxTotalBytes = 16 * 1024 * 1024 } = {}) {
  const documents = new Map();
  let totalBytes = 0;
  return {
    register(input) {
      if (typeof input?.html !== 'string' || !/^[a-f0-9]{32}$/.test(input?.nonce || '')) throw new Error('图表文档无效。');
      const bytes = Buffer.byteLength(input.html, 'utf8');
      if (!bytes || bytes > maxDocumentBytes) throw new Error('图表文档过大。');
      if (documents.size >= maxEntries || totalBytes + bytes > maxTotalBytes) throw new Error('当前图表过多，请关闭其他聊天后重试。');
      const url = VISUALIZATION_PREFIX + crypto.randomBytes(32).toString('hex');
      documents.set(url, { ...input, bytes });
      totalBytes += bytes;
      return url;
    },
    release(url) {
      const document = documents.get(url);
      if (!document) return false;
      totalBytes -= document.bytes;
      return documents.delete(url);
    },
    clear() { documents.clear(); totalBytes = 0; },
    allowsNavigation({ url, isMainFrame, fromMainFrame }) {
      if (isMainFrame) return !url.startsWith(VISUALIZATION_SCHEME + ':');
      return documents.has(url) || (url === 'about:srcdoc' && fromMainFrame);
    },
    allowsRequest(details, hostId) {
      return details.webContentsId !== hostId || details.resourceType !== 'subFrame' || documents.has(details.url);
    },
    respond(request) {
      const document = request.method === 'GET' ? documents.get(request.url) : null;
      if (!document) return new Response('', { status: 404 });
      return new Response(document.html, { headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': `sandbox allow-scripts; default-src 'none'; script-src 'nonce-${document.nonce}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`,
      } });
    },
  };
}

module.exports = { VISUALIZATION_SCHEME, VISUALIZATION_PREFIX, createVisualizationDocuments };
