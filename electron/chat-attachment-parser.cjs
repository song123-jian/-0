const path = require('node:path');
const { fork } = require('node:child_process');
const { normalizeAttachmentInputs, normalizeAttachmentRecords } = require('./chat-attachments.cjs');

const PARSE_TIMEOUT_MS = 15000;
let parsing = false;

function parseFile(item) {
  return new Promise((resolve) => {
    const entry = path.join(__dirname, 'chat-attachment-worker.cjs');
    const env = { ...process.env }; delete env.NODE_OPTIONS;
    const options = { env, execArgv: ['--max-old-space-size=192'], stdio: 'pipe' };
    const electron = Boolean(process.versions.electron);
    const child = electron ? require('electron').utilityProcess.fork(entry, [], { ...options, serviceName: '附件正文解析' })
      : fork(entry, [], { ...options, serialization: 'advanced', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    child.stdout?.resume();
    let diagnostic = '', result;
    child.stderr?.on('data', (chunk) => { diagnostic = (diagnostic + chunk.toString()).slice(-2048); });
    const stop = (value) => {
      if (result) return;
      result = value;
      child.kill();
    };
    const timer = setTimeout(() => stop({ parsed: false, parseStatus: 'timeout' }), PARSE_TIMEOUT_MS);
    child.once('message', stop);
    child.once('error', (_type, location, details) => stop({ parsed: false, parseStatus: /heap|memory/i.test(diagnostic + (location || '') + (details || '')) ? 'resource-limit' : 'failed' }));
    let completed = false;
    const complete = () => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      resolve({ name: item.name, mimeType: item.mimeType, size: item.size, ...(result || { parsed: false, parseStatus: /heap|memory/i.test(diagnostic) ? 'resource-limit' : 'failed' }) });
    };
    child.once('exit', complete);
    if (!electron) child.once('close', complete);
    if (electron) child.postMessage(item);
    else child.send(item, (error) => { if (error) stop({ parsed: false, parseStatus: 'failed' }); });
  });
}

async function prepareChatAttachments(value, existing = []) {
  const inputs = normalizeAttachmentInputs(value);
  const previous = normalizeAttachmentRecords(existing);
  normalizeAttachmentRecords([...previous, ...inputs]);
  if (!inputs.length) return [];
  if (parsing) throw new Error('正在解析其他附件，请稍候再添加。');
  parsing = true;
  try {
    const records = [];
    for (const item of inputs) records.push(await parseFile(item));
    return normalizeAttachmentRecords([...previous, ...records]).slice(previous.length);
  } finally { parsing = false; }
}

module.exports = { prepareChatAttachments };
