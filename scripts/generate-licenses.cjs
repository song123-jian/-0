const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const manifest = require('../package.json');
const entries = new Map();

function collect(name, owner) {
  const resolver = createRequire(path.join(owner, 'package.json'));
  let packageFile;
  try {
    const candidate = resolver.resolve(name + '/package.json');
    if (JSON.parse(fs.readFileSync(candidate, 'utf8')).name === name) packageFile = candidate;
  } catch {}
  // Some exports expose an internal package.json and no top-level entry.
  // Resolve the actual package root using Node's ordered module search paths.
  if (!packageFile) for (const location of resolver.resolve.paths(name) || []) {
    const candidate = path.join(location, name, 'package.json');
    if (fs.existsSync(candidate) && JSON.parse(fs.readFileSync(candidate, 'utf8')).name === name) { packageFile = candidate; break; }
  }
  if (!packageFile) throw new Error('Cannot locate license metadata: ' + name);
  const directory = path.dirname(packageFile);
  const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const key = pkg.name + '@' + pkg.version;
  if (entries.has(key)) return;
  const licenseFiles = fs.readdirSync(directory).filter((file) => /^(license|licence|copying|notice)(\.|$|-)/i.test(file));
  const notices = licenseFiles.filter((file) => fs.statSync(path.join(directory, file)).isFile()).map((file) => ({ file, text: fs.readFileSync(path.join(directory, file), 'utf8') }));
  if (name === 'electron') notices.push({ file: 'Electron LICENSE', text: fs.readFileSync(path.join(directory, 'dist', 'LICENSE'), 'utf8') });
  entries.set(key, { name: pkg.name, version: pkg.version, license: typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license || pkg.licenses || 'See component notices'), notices });
  if (name !== 'electron') for (const dependency of Object.keys(pkg.dependencies || {})) collect(dependency, directory);
  if (name !== 'electron') for (const dependency of Object.keys(pkg.optionalDependencies || {})) {
    try { resolver.resolve(dependency); } catch { continue; }
    collect(dependency, directory);
  }
}

for (const name of [...Object.keys(manifest.dependencies), 'electron']) collect(name, root);
fs.writeFileSync(path.join(root, 'electron', 'third-party-licenses.json'), JSON.stringify([...entries.values()].sort((a, b) => a.name.localeCompare(b.name)), null, 2) + '\n');
console.log('License metadata generated for ' + entries.size + ' components.');
