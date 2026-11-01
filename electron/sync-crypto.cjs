const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
async function sealSnapshot(value, secret) {
  if (typeof secret !== 'string' || secret.length < 16 || secret.length > 512) throw new Error('同步口令须为16至512字符，所有设备使用相同口令。');
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = await scrypt(secret, salt, 32);
  try { const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from('scodex-sync-v1')); const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]); return { encryption: 'aes-256-gcm-v1', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }; }
  finally { key.fill(0); }
}
async function openSnapshot(value, secret) {
  if (value?.encryption !== 'aes-256-gcm-v1') throw new Error('远端不是加密同步数据；请使用新的同步空间，旧记录保持不变。');
  const decode = (text, size) => { if (typeof text !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw Error('无效密文'); const b = Buffer.from(text, 'base64'); if (size && b.length !== size) throw Error('无效长度'); return b; };
  let key;
  try { const salt = decode(value.salt, 16), iv = decode(value.iv, 12), tag = decode(value.tag, 16), bytes = decode(value.data); key = await scrypt(secret, salt, 32); const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv); decipher.setAAD(Buffer.from('scodex-sync-v1')); decipher.setAuthTag(tag); return JSON.parse(Buffer.concat([decipher.update(bytes), decipher.final()]).toString('utf8')); }
  catch { throw new Error('同步口令不一致或远端数据损坏，未应用任何远端数据。'); }
  finally { key?.fill(0); }
}
module.exports = { sealSnapshot, openSnapshot };
