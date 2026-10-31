const crypto = require('node:crypto');
const path = require('node:path');

function projectPathKey(value) {
  return path.resolve(value).replace(/[\\/]+$/, '').toLocaleLowerCase('en-US');
}

function createProject(name, directory, options = {}) {
  const label = String(name || '').trim().slice(0, 80);
  if (!label) throw new Error('请输入项目名称。');
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('请选择有效的本地项目文件夹。');
  const at = (options.now || (() => new Date()))().toISOString();
  return {
    id: options.id || crypto.randomUUID(),
    name: label,
    path: path.resolve(directory),
    createdAt: options.createdAt || at,
    updatedAt: at,
  };
}

function normalizeProjects(value, fallbackDirectory) {
  const projects = [];
  const seen = new Set();
  const source = Array.isArray(value) ? value : [];
  for (const item of source) {
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.path !== 'string' || !path.isAbsolute(item.path)) continue;
    const key = projectPathKey(item.path);
    if (seen.has(key)) continue;
    seen.add(key);
    projects.push({
      id: item.id,
      name: item.name.trim().slice(0, 80) || path.basename(item.path),
      pinned: item.pinned === true, unread: item.unread === true,
      archivedAt: Number.isFinite(Date.parse(item.archivedAt)) ? item.archivedAt : null,
      path: path.resolve(item.path),
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date(0).toISOString(),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date(0).toISOString(),
    });
  }
  if (typeof fallbackDirectory === 'string' && path.isAbsolute(fallbackDirectory) && !seen.has(projectPathKey(fallbackDirectory))) {
    const absolutePath = path.resolve(fallbackDirectory);
    projects.unshift({
      id: `project-${crypto.createHash('sha256').update(projectPathKey(absolutePath)).digest('hex').slice(0, 20)}`,
      name: path.basename(absolutePath) || absolutePath,
      path: absolutePath,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });
  }
  return projects;
}

function upsertProject(projects, input, options = {}) {
  const next = createProject(input.name, input.path, options);
  const existing = projects.find((item) => projectPathKey(item.path) === projectPathKey(next.path));
  if (existing) {
    const updated = { ...existing, name: next.name, updatedAt: next.updatedAt };
    return { projects: projects.map((item) => item.id === existing.id ? updated : item), project: updated };
  }
  return { projects: [next, ...projects], project: next };
}

module.exports = { createProject, normalizeProjects, projectPathKey, upsertProject };
