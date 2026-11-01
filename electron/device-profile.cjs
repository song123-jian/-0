const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

function readDeviceId() {
  if (process.platform !== 'win32') return os.platform() + ':' + os.hostname();
  try {
    const key = ['HKLM', 'SOFTWARE', 'Microsoft', 'Cryptography'].join(path.sep);
    const output = execFileSync('reg.exe', ['query', key, '/v', 'MachineGuid', '/reg:64'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    const guid = output.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i)?.[0];
    if (guid) return 'windows:' + guid.toLowerCase();
  } catch {}
  throw new Error('无法确认当前电脑身份；原有数据未重置，请恢复系统设备标识读取后重试。');
}

function readMarker(profile) {
  try {
    const stat = fs.lstatSync(profile);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('应用配置目录不能是链接或普通文件。');
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  try {
    const file = path.join(profile, 'device-profile.json');
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('电脑归属标记必须是本机普通文件。');
    const marker = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (marker.schema !== 1 || !/^[a-f0-9]{64}$/.test(marker.computerHash) || typeof marker.isolatedHome !== 'boolean' || typeof marker.allowLegacy !== 'boolean') throw new Error('Invalid marker');
    return marker;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('电脑归属标记无法读取；已保留原有数据，请修复标记后重启。', { cause: error });
  }
}

function prepareDeviceProfile(directory, { machineId = readDeviceId() } = {}) {
  if (typeof machineId !== 'string' || !machineId.trim() || machineId.length > 512) throw new Error('电脑设备身份无效；未更改配置。');
  const computerHash = crypto.createHash('sha256').update(machineId.trim()).digest('hex');
  const root = path.resolve(directory);
  const original = readMarker(root);
  const profile = original && original.computerHash !== computerHash ? root + '-device-' + computerHash : root;
  let marker = profile === root ? original : readMarker(profile);
  if (marker && marker.computerHash !== computerHash) throw new Error('电脑归属标记不匹配；未加载或覆盖原有配置。');
  if (!marker) {
    const migrated = profile === root && ['settings.json', 'model-connection.json', 'conversations.json', 'conversations.json.gz'].some(name => fs.existsSync(path.join(profile, name)));
    marker = { schema: 1, computerHash, isolatedHome: !migrated, allowLegacy: migrated };
    fs.mkdirSync(profile, { recursive: true });
    try { fs.writeFileSync(path.join(profile, 'device-profile.json'), JSON.stringify(marker, null, 2), { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      marker = readMarker(profile);
      if (!marker || marker.computerHash !== computerHash) throw new Error('电脑归属标记在启动时发生变化，请重新启动。');
    }
  }
  return { profile, isolatedHome: marker.isolatedHome, allowLegacy: marker.allowLegacy };
}

module.exports = { prepareDeviceProfile, readDeviceId };
