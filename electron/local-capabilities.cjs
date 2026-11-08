const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const key = (value) => path.resolve(value).toLowerCase();
const idFor = (value) => crypto.createHash('sha256').update(key(value)).digest('hex').slice(0, 16);
const cleanName = (value) => String(value).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160);
async function directory(value) { try { return (await fs.stat(value)).isDirectory() ? await fs.realpath(value) : null; } catch { return null; } }
async function entries(value) { try { return (await fs.readdir(value, { withFileTypes: true })).filter((item) => item.isDirectory() && !item.isSymbolicLink()).slice(0, 200); } catch { return []; } }

// Read table names and enabled flags only. Never expose commands, URLs, env or credentials.
function configurationSummary(text) {
  const plugins = new Map(); const servers = new Map(); let current; let multiline;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (multiline) { if (line.includes(multiline)) multiline = null; continue; }
    // Multiline values are opaque data, including any table-looking lines inside them.
    const block = line.match(/=\s*("{3}|'{3})/);
    if (block) { const rest = line.slice(line.indexOf(block[1]) + 3); if (!rest.includes(block[1])) multiline = block[1]; continue; }
    if (line.startsWith('[')) {
      current = null;
      const match = line.match(/^\[\s*(plugins|mcp_servers)\s*\.\s*(?:"([^"\\]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*\]\s*(?:#.*)?$/);
      if (match) {
        const name = cleanName(match[2] || match[3] || match[4]);
        const map = match[1] === 'plugins' ? plugins : servers;
        if (!map.has(name)) map.set(name, { name, enabled: null });
        current = map.get(name);
      }
    } else if (current) {
      const enabled = line.match(/^enabled\s*=\s*(true|false)\s*(?:#.*)?$/);
      if (enabled) current.enabled = enabled[1] === 'true';
    }
  }
  return { plugins, servers: [...servers.values()] };
}

async function discoverLocalCapabilities({ scodexRoot, workspaceRoot, nativeHome = process.env.SCODEX_REFERENCE_HOME || path.join(os.homedir(), '.codex'), agentsHome = process.env.SCODEX_REFERENCE_AGENTS_HOME || path.join(os.homedir(), '.agents') }) {
  const candidates = [{ path: scodexRoot, label: 'Scodex', scope: 'scodex' }, { path: nativeHome, label: '本机 .codex', scope: 'personal' }];
  let ancestor = path.resolve(workspaceRoot);
  for (let i = 0; i < 12; i += 1) {
    const candidate = path.join(ancestor, '.codex');
    if (await directory(candidate)) { candidates.push({ path: candidate, label: '项目 .codex', scope: 'workspace' }); break; }
    const parent = path.dirname(ancestor); if (parent === ancestor) break; ancestor = parent;
  }
  const sources = []; const plugins = []; const servers = []; const skillRoots = []; const seen = new Set(); const pluginSeen = new Set();
  for (const candidate of candidates) {
    if (!candidate.path) continue;
    const real = await directory(candidate.path); if (!real || seen.has(key(real))) continue; seen.add(key(real));
    const source = { id: idFor(real), path: real, label: candidate.label, scope: candidate.scope, configPath: path.join(real, 'config.toml'), configReadable: false, warning: '' };
    let summary = configurationSummary('');
    try {
      const info = await fs.stat(source.configPath);
      if (info.size > 1024 * 1024) source.warning = '配置超过 1 MB，未读取。';
      else { summary = configurationSummary(await fs.readFile(source.configPath, 'utf8')); source.configReadable = true; }
    } catch (error) { if (error.code !== 'ENOENT') source.warning = '配置无法读取，请检查文件权限。'; }
    sources.push(source);
    const prefix = scodexRoot && key(real) === key(scodexRoot) ? '' : 'local:' + source.id + ':';
    // Preserve 1.0.4 project Skill IDs so stored disabled/selected choices remain valid.
    const legacyWorkspace = scodexRoot && source.scope === 'workspace' && key(real) === key(path.join(workspaceRoot, '.codex'));
    skillRoots.push({ path: path.join(real, 'skills'), sourceRoot: real, idRoot: legacyWorkspace ? scodexRoot : real, label: source.label, scope: source.scope, prefix: legacyWorkspace ? 'workspace:' : prefix });
    for (const server of summary.servers) servers.push({ ...server, id: source.id + ':' + server.name, sourceId: source.id, source: source.label, connected: false });
    const locations = [path.join(real, 'plugins', 'cache'), path.join(real, 'marketplaces')];
    for (let kind = 0; kind < locations.length; kind += 1) {
      for (const provider of await entries(locations[kind])) {
        const base = kind === 0 ? path.join(locations[kind], provider.name) : path.join(locations[kind], provider.name, 'plugins');
        for (const item of await entries(base)) {
          let pluginPath = path.join(base, item.name); let version = '';
          if (kind === 0) {
            const versions = (await entries(pluginPath)).filter((entry) => /^\d/.test(entry.name)).sort((a, b) => b.name.localeCompare(a.name, 'en', { numeric: true }));
            if (versions.length) { version = versions[0].name; pluginPath = path.join(pluginPath, version); }
          }
          const pluginKey = source.id + ':' + provider.name + '/' + item.name;
          if (pluginSeen.has(pluginKey)) continue; pluginSeen.add(pluginKey);
          const declared = summary.plugins.get(item.name + '@' + provider.name);
          plugins.push({ id: pluginKey, name: cleanName(item.name), provider: cleanName(provider.name), source: source.label, path: pluginPath, sourceId: source.id, configPath: source.configPath, version, codexEnabled: declared?.enabled ?? null, status: 'installed', connected: false });
          skillRoots.push({ path: pluginPath, sourceRoot: real, label: source.label, scope: 'plugin', prefix });
        }
      }
    }
  }
  const agents = await directory(path.join(agentsHome, 'skills'));
  if (agents) skillRoots.push({ path: agents, sourceRoot: agentsHome, label: '个人 .agents', scope: 'personal', prefix: 'agents:' + idFor(agents) + ':' });
  return { sources, plugins, servers, skillRoots, scannedAt: new Date().toISOString() };
}

module.exports = { configurationSummary, discoverLocalCapabilities };
