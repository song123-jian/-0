const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createWriteStream } = require('node:fs');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { CATALOG } = require('../electron/workspace-tools.cjs');

const project = path.resolve(__dirname, '..');
const destination = path.join(project, 'resources', 'workspace-tools-bundle');

async function digest(file) {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

async function download(name, item) {
  const archive = path.join(destination, item.filename);
  try {
    if (await digest(archive) === item.sha256) {
      console.log(`${name} ${item.version}: verified existing archive`);
      return;
    }
    throw new Error(`${archive} already exists with an unexpected digest; inspect it before replacing it.`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }

  const temporary = `${archive}.download-${process.pid}`;
  const response = await fetch(item.url, { signal: AbortSignal.timeout(240_000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error(`Download failed for ${name}: HTTP ${response.status}`);
  const expected = Number(response.headers.get('content-length'));
  if (expected > 100 * 1024 * 1024) throw new Error(`${name} download exceeds 100 MB.`);
  const hash = crypto.createHash('sha256');
  let received = 0;
  const verify = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > 100 * 1024 * 1024) return callback(new Error(`${name} download exceeds 100 MB.`));
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body), verify, createWriteStream(temporary, { flags: 'wx' }));
    if (hash.digest('hex') !== item.sha256) throw new Error(`${name} download SHA-256 mismatch.`);
    await fs.rename(temporary, archive);
    console.log(`${name} ${item.version}: ${received} bytes; SHA-256 verified`);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function main() {
  await fs.mkdir(destination, { recursive: true });
  for (const [name, item] of Object.entries(CATALOG)) await download(name, item);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
