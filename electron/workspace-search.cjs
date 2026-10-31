const fs = require('node:fs/promises');
const path = require('node:path');

// Search names only, with fixed limits; never traverse links or generated folders.
async function searchWorkspace(workspaceRoot, value) {
  const root = await fs.realpath(workspaceRoot);
  const query = typeof value === 'string' ? value.trim().slice(0, 160).toLocaleLowerCase() : '';
  if (!query) return { root, items: [], truncated: false };
  const ignored = new Set(['node_modules', 'dist', 'release', 'target']);
  const queue = [{ directory: root, depth: 0 }];
  const items = [];
  let visited = 0;
  let truncated = false;
  for (let index = 0; index < queue.length; index += 1) {
    const { directory, depth } = queue[index];
    let entries;
    try {
      const real = await fs.realpath(directory);
      const relative = path.relative(root, real);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) continue;
      entries = await fs.readdir(real, { withFileTypes: true });
    } catch { continue; }
    for (const entry of entries) {
      if (++visited > 6000 || items.length >= 40) { truncated = true; break; }
      if (entry.name.startsWith('.') || ignored.has(entry.name) || entry.isSymbolicLink() || (!entry.isFile() && !entry.isDirectory())) continue;
      const fullPath = path.join(directory, entry.name);
      const relative = path.relative(root, fullPath);
      if (relative.toLocaleLowerCase().includes(query)) items.push({ name: entry.name, path: fullPath, relative, directory: entry.isDirectory() });
      if (entry.isDirectory()) {
        if (depth < 6) queue.push({ directory: fullPath, depth: depth + 1 });
        else truncated = true;
      }
    }
    if (visited > 6000 || items.length >= 40) break;
  }
  return { root, items, truncated };
}

module.exports = { searchWorkspace };
