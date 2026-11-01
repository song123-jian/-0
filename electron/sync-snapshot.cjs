const crypto = require('node:crypto');
const { normalizeLibrary } = require('./conversations.cjs');
const PREFERENCE_KEYS = ['themeMode', 'themeStyle', 'accentColor', 'backgroundColor', 'foregroundColor', 'fontFamily', 'fontSize', 'sendShortcut', 'showEditorStatusBar', 'notifyOnComplete', 'notifyOnIssues', 'notificationSound'];
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const fingerprint = value => crypto.createHash('sha256').update(stable(value) || 'null').digest('hex');
function snapshot(value) {
  if (!value?.library || !Array.isArray(value.library.conversations)) throw new Error('远端同步记录缺少有效聊天库，未应用。');
  const library = normalizeLibrary(value.library);
  const preferences = Object.fromEntries(PREFERENCE_KEYS.filter(k => Object.hasOwn(value.preferences || {}, k)).map(k => [k, value.preferences[k]]));
  // Paths, live approvals, machine permissions and credentials never migrate.
  for (const chat of library.conversations) { delete chat.projectId; delete chat.parentId; if (chat.goalRun) chat.goalRun.status = 'paused'; }
  return { schema: 1, library, preferences };
}
function mergeSnapshots(baseValue, localValue, remoteValue) {
  const local = snapshot(localValue), remote = snapshot(remoteValue);
  const base = baseValue ? snapshot(baseValue) : { library: { conversations: [] }, preferences: {} };
  const map = entries => new Map(entries.map(x => [x.id, x]));
  const a = map(local.library.conversations), b = map(remote.library.conversations), old = map(base.library.conversations);
  const merged = new Map(); let conflicts = 0;
  for (const id of new Set([...a.keys(), ...b.keys(), ...old.keys()])) {
    const l = a.get(id), r = b.get(id), o = old.get(id);
    if (fingerprint(l) === fingerprint(r)) { if (l) merged.set(id, l); continue; }
    if (fingerprint(l) === fingerprint(o)) { if (r) merged.set(id, r); continue; }
    if (fingerprint(r) === fingerprint(o)) { if (l) merged.set(id, l); continue; }
    if (!l || !r) { merged.set(id, l || r); conflicts++; continue; }
    merged.set(id, l);
    const copyId = 'sync-' + fingerprint([id, r]).slice(0, 48);
    merged.set(copyId, { ...r, id: copyId, title: (r.title.slice(0, 75) + '（同步冲突副本）'), pinned: false });
    conflicts++;
  }
  const preferences = {};
  for (const key of PREFERENCE_KEYS) {
    const l = local.preferences[key], r = remote.preferences[key], o = base.preferences[key];
    const selected = fingerprint(l) === fingerprint(o) ? r : l;
    if (selected !== undefined) preferences[key] = selected;
  }
  const conversations = [...merged.values()];
  const library = normalizeLibrary({ version: 2, activeId: local.library.activeId, conversations });
  return { snapshot: { schema: 1, library, preferences }, conflicts };
}
module.exports = { snapshot, mergeSnapshots, fingerprint, PREFERENCE_KEYS };
