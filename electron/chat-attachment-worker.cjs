const { extractAttachment } = require('./document-text.cjs');

const receive = async (item) => {
  let result;
  try { result = await extractAttachment({ ...item, data: Buffer.from(item.data) }); }
  catch { result = { parsed: false, parseStatus: 'failed' }; }
  if (process.parentPort) process.parentPort.postMessage(result);
  else process.send(result);
};

if (process.parentPort) process.parentPort.once('message', (event) => receive(event.data));
else process.once('message', receive);
