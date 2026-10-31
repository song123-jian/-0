import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { matchTools } from '../src/lib/tool-catalog.js';
const require = createRequire(import.meta.url);
const { createDesktopTray } = require('../electron/desktop-tray.cjs');
const { configurationSummary, discoverLocalCapabilities } = require('../electron/local-capabilities.cjs');
const { normalizePreferences } = require('../electron/preferences.cjs');

test('configuration discovery never returns credentials or connection commands', () => {
  const text = '[mcp_servers.node_repl]\ncommand="SECRET_COMMAND"\nurl="SECRET_URL"\n[mcp_servers.node_repl.env]\nTOKEN="SECRET_TOKEN"\n[plugins."documents@openai-primary-runtime"]\nenabled=false\n';
  const result = configurationSummary(text);
  assert.deepEqual(result.servers, [{ name: 'node_repl', enabled: null }]);
  assert.equal(result.plugins.get('documents@openai-primary-runtime').enabled, false);
  assert.doesNotMatch(JSON.stringify(result.servers), /SECRET/);
  const opaque = configurationSummary('instructions="""\n[mcp_servers.not_a_server]\n"""\n[mcp_servers.real]\nenabled=false');
  assert.deepEqual(opaque.servers, [{ name: 'real', enabled: false }]);
});

test('native inventory detects plugins without Skills, selects latest cache and preserves source identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'scodex-capabilities-'));
  try {
    const native = path.join(root, '.codex'); const workspace = path.join(root, 'project');
    await mkdir(workspace, { recursive: true });
    for (const version of ['26.9.1', '26.10.1']) await mkdir(path.join(native, 'plugins/cache/provider/no-skill', version), { recursive: true });
    await writeFile(path.join(native, 'config.toml'), '[plugins."no-skill@provider"]\nenabled=true\n[mcp_servers.example]\ncommand="PRIVATE"\n');
    const state = await discoverLocalCapabilities({ scodexRoot: native, nativeHome: native, workspaceRoot: workspace, agentsHome: path.join(root, 'missing') });
    assert.equal(state.sources.length, 1); assert.equal(state.plugins.length, 1);
    assert.equal(state.plugins[0].version, '26.10.1'); assert.equal(state.plugins[0].codexEnabled, true);
    assert.equal(state.plugins[0].connected, false); assert.equal(state.servers[0].connected, false);
    assert.doesNotMatch(JSON.stringify(state), /PRIVATE/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('direct project Skills retain the stored 1.0.4 disabled identifier', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'scodex-skill-identity-'));
  try {
    const workspace = path.join(root, 'project');
    const file = path.join(workspace, '.codex', 'skills', 'legacy', 'SKILL.md');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, '---\nname: Legacy\n---\nExisting skill.\n');
    const state = await discoverLocalCapabilities({ scodexRoot: root, workspaceRoot: workspace, nativeHome: path.join(root, 'missing'), agentsHome: path.join(root, 'missing') });
    const source = state.skillRoots.find(item => item.scope === 'workspace');
    const restoredId = source.prefix + path.relative(source.idRoot || source.sourceRoot, file).replaceAll(path.sep, '/');
    assert.equal(restoredId, 'workspace:project/.codex/skills/legacy/SKILL.md');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('tray restores minimized windows, routes menu actions and disables without stranding a hidden window', () => {
  const created = []; const calls = []; const preferences = { trayEnabled: true, closeToTray: true };
  const window = { isDestroyed: () => false, isMinimized: () => true, isVisible: () => false, restore: () => calls.push('restore'), setSkipTaskbar: (v) => calls.push(['taskbar',v]), show: () => calls.push('show'), focus: () => calls.push('focus') };
  class Tray extends EventEmitter { constructor() { super(); this.destroyed=false; created.push(this); } isDestroyed(){return this.destroyed;} destroy(){this.destroyed=true;} setToolTip(t){this.tooltip=t;} setContextMenu(m){this.menu=m;} }
  const shell = createDesktopTray({ Tray, Menu: { buildFromTemplate: (items) => items }, nativeImage: { createFromPath: () => ({ isEmpty:()=>false, resize:()=>({}) }) }, iconPath:'icon.png', version:'1.0.5', getWindow:()=>window, getPreferences:()=>preferences, requestClose:(v)=>calls.push(['close',v]), onCommand:(v)=>calls.push(['command',v]) });
  shell.sync(); assert.equal(shell.status().available,true); shell.sync(); assert.equal(created.length,1);
  created[0].emit('click'); assert.ok(calls.includes('restore')); assert.ok(calls.includes('show'));
  created[0].menu.find(item=>item.label==='定时任务').click(); assert.ok(calls.some(item=>Array.isArray(item)&&item[0]==='command'&&item[1]==='tasks'));
  created[0].menu.find(item=>item.label==='退出 Scodex').click(); assert.ok(calls.some(item=>Array.isArray(item)&&item[0]==='close'&&item[1]==='quit'));
  preferences.trayEnabled=false; calls.length=0; shell.sync(); assert.equal(created[0].destroyed,true); assert.ok(calls.includes('show')); assert.equal(shell.status().available,false);
});

test('tray icon failure falls back to normal close; preferences are bounded and command search finds actions', () => {
  const shell=createDesktopTray({ Tray: class {}, Menu:{}, nativeImage:{createFromPath:()=>({isEmpty:()=>true})}, getPreferences:()=>({trayEnabled:true,closeToTray:true}), getWindow:()=>null });
  shell.sync(); assert.equal(shell.status().closeToTray,false); assert.match(shell.status().error,/不可用/);
  assert.equal(normalizePreferences().closeToTray,true); assert.equal(normalizePreferences().trayEnabled,true);
  assert.equal(normalizePreferences({browserPanelWidth:9999}).browserPanelWidth,660);
  assert.equal(normalizePreferences({browserPanelWidth:-1}).browserPanelWidth,320);
  assert.ok(matchTools('powershell').some(item=>item.id==='terminal'));
  assert.ok(matchTools('权限').some(item=>item.id==='setting:agent'));
  assert.equal(matchTools('不存在的工具xyz').length,0);
});
