import React, { useEffect, useState } from 'react';
import { McpContextBrowser } from './mcp-context-browser.jsx';
import { AlertTriangle, Check, ChevronRight, LoaderCircle, Pencil, Plug, Plus, RefreshCw, Server, ShieldCheck, Trash2, Unplug, X } from 'lucide-react';

const statusLabels = { disconnected: '未连接', authorizing: '授权中', connecting: '连接中', connected: '已连接', disconnecting: '断开中', failed: '连接失败' };
const transportLabels = { stdio: '本地进程 · stdio', http: 'Streamable HTTP', sse: 'SSE（兼容旧服务）' };
const blank = { name: '', transport: 'stdio', command: '', args: '[]', cwd: '', url: '', env: '', headers: '', token: '', readOnlyTools: '', clearSecrets: false, authMode: 'bearer', oauthClientId: '', oauthIssuer: '', oauthScope: '', oauthCallbackPort: 0 };
function objectInput(value) { return value.trim() ? JSON.parse(value) : undefined; }

function ConnectionEditor({ connection, onClose, onSave }) {
  const [form, setForm] = useState(() => connection ? { ...blank, ...connection, args: JSON.stringify(connection.args || [], null, 2), readOnlyTools: (connection.readOnlyTools || []).join('\n'), token: '' } : blank);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const change = (key, value) => setForm((s) => ({ ...s, [key]: value }));
  useEffect(() => { const escape = (e) => { if (e.key === 'Escape' && !busy) onClose(); }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, [busy, onClose]);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSave({ id: connection?.id, name: form.name, transport: form.transport, command: form.command, args: form.transport === 'stdio' ? JSON.parse(form.args) : [], cwd: form.cwd, url: form.url,
      env: objectInput(form.env), headers: objectInput(form.headers), token: form.token || undefined, clearSecrets: form.clearSecrets,
      authMode: form.authMode, oauthClientId: form.oauthClientId, oauthIssuer: form.oauthIssuer, oauthScope: form.oauthScope, oauthCallbackPort: Number(form.oauthCallbackPort || 0),
      readOnlyTools: form.readOnlyTools.split(/\r?\n/).map((v) => v.trim()).filter(Boolean) }); onClose(); }
    catch (value) { setError(value.message || '保存失败'); } finally { setBusy(false); }
  };
  return <div className="modal-backdrop mcp-modal-backdrop"><form className="mcp-editor" role="dialog" aria-modal="true" aria-labelledby="mcp-editor-title" onSubmit={submit}>
    <div className="mcp-editor-heading"><div><h2 id="mcp-editor-title">{connection ? '编辑 MCP 连接' : '添加 MCP 连接'}</h2><p>配置保存在 Scodex，保存后手动连接。</p></div><button className="icon-button" type="button" aria-label="关闭连接编辑" disabled={busy} onClick={onClose}><X size={19} /></button></div>
    <div className="mcp-editor-scroll">
      <div className="mcp-form-pair"><label className="task-field"><span>连接名称</span><input autoFocus required maxLength={80} value={form.name} onChange={(e) => change('name', e.target.value)} aria-label="MCP 连接名称" placeholder="例如：项目资料工具" /></label><label className="task-field"><span>连接方式</span><select value={form.transport} onChange={(e) => change('transport', e.target.value)} aria-label="MCP 连接方式"><option value="stdio">本地进程 · stdio</option><option value="http">远程服务 · Streamable HTTP</option><option value="sse">远程服务 · SSE（兼容旧服务）</option></select></label></div>
      {form.transport === 'stdio' ? <>
        <label className="task-field"><span>程序命令或绝对路径</span><input required value={form.command} onChange={(e) => change('command', e.target.value)} aria-label="MCP 启动命令" placeholder="node 或已安装程序的完整路径" /></label>
        <label className="task-field"><span>启动参数 · JSON 字符串数组</span><textarea rows={3} required value={form.args} onChange={(e) => change('args', e.target.value)} aria-label="MCP 启动参数" placeholder={'["C:/tools/server.cjs"]'} /></label>
        <label className="task-field"><span>工作目录</span><input value={form.cwd} onChange={(e) => change('cwd', e.target.value)} aria-label="MCP 工作目录" placeholder="留空使用当前项目，或填写绝对路径" /></label>
        <label className="task-field"><span>加密环境变量 · JSON 对象</span><textarea rows={3} value={form.env} onChange={(e) => change('env', e.target.value)} aria-label="MCP 环境变量" autoComplete="off" spellCheck={false} placeholder={'{"SERVICE_KEY":"填写认证值"}'} /><small>{connection?.envNames?.length ? '已保存：' + connection.envNames.join('、') + '。留空保留原值。' : '值使用系统凭据加密保存，不放在启动参数中。'}</small></label>
        <p className="mcp-form-note">连接将启动你指定的程序，使用当前 Windows 账号权限。请先确认来源可信；工作目录不能隔离程序访问。</p>
      </> : <>
        <label className="task-field"><span>服务地址</span><input required type="url" value={form.url} onChange={(e) => change('url', e.target.value)} aria-label="MCP 服务地址" placeholder="https://example.com/mcp" /></label>
        <label className="task-field"><span>认证方式</span><select value={form.authMode} onChange={e=>change('authMode',e.target.value)} aria-label="MCP 认证方式"><option value="bearer">Bearer 或无需认证</option><option value="oauth">OAuth 网页授权 · PKCE</option></select></label>
        {form.authMode==='oauth'?<div className="mcp-oauth-fields">
          <div className="mcp-form-pair"><label className="task-field"><span>公共客户端 ID · 选填</span><input value={form.oauthClientId} maxLength={1024} onChange={e=>change('oauthClientId',e.target.value)} aria-label="MCP OAuth客户端ID" placeholder="留空由服务动态注册" /></label><label className="task-field"><span>授权服务器 · 预配置 ID 时必填</span><input type="url" required={Boolean(form.oauthClientId)} value={form.oauthIssuer} onChange={e=>change('oauthIssuer',e.target.value)} aria-label="MCP OAuth授权服务器" placeholder="https://auth.example.com" /></label></div>
          <div className="mcp-form-pair"><label className="task-field"><span>权限范围 · 选填</span><input value={form.oauthScope} maxLength={1024} onChange={e=>change('oauthScope',e.target.value)} aria-label="MCP OAuth权限范围" placeholder="以空格分隔，留空使用服务声明" /></label><label className="task-field"><span>本机回调端口</span><input type="number" min={0} max={65535} value={form.oauthCallbackPort} onChange={e=>change('oauthCallbackPort',e.target.value)} aria-label="MCP OAuth回调端口" /><small>0为首次自动选择；预配置客户端可填写已登记端口。</small></label></div>
          <p className="mcp-form-note">保存后点击“授权并连接”，在独立窗口登录。使用公共客户端、PKCE与本机回调；访问和续期令牌由Windows加密保存。取消或关闭授权窗口会停止本次登录，模型不会自动弹出登录窗口。</p>
        </div>:<label className="task-field"><span>Bearer 认证</span><input type="password" value={form.token} onChange={(e) => change('token', e.target.value)} aria-label="MCP Bearer 认证" autoComplete="new-password" placeholder={connection?.hasToken ? '已加密保存，留空保留' : '选填'} /></label>}
        <label className="task-field"><span>其他加密请求头 · JSON 对象</span><textarea rows={3} value={form.headers} onChange={(e) => change('headers', e.target.value)} aria-label="MCP 请求头" spellCheck={false} autoComplete="off" placeholder={'{"X-API-Key":"填写认证值"}'} /><small>{connection?.headerNames?.length ? '已保存：' + connection.headerNames.join('、') + '。留空保留原值。' : '远程服务须使用 HTTPS，本机回环地址可使用 HTTP。'}</small></label>
      </>}
      <details className="mcp-advanced"><summary>规划模式与认证管理</summary><label className="task-field"><span>规划模式只读白名单 · 每行一个工具原名</span><textarea rows={3} value={form.readOnlyTools} onChange={(e) => change('readOnlyTools', e.target.value)} aria-label="MCP 规划只读工具" /><small>只开放你明确列入且服务也声明只读的工具。每次调用仍需审批。</small></label>{connection && <label className="mcp-checkbox"><input type="checkbox" checked={form.clearSecrets} onChange={(e) => change('clearSecrets', e.target.checked)} />清除已保存的认证值，再应用本次填写内容</label>}</details>
      {error && <div className="inline-error" role="alert"><AlertTriangle size={17} />{error}</div>}
    </div><div className="mcp-editor-actions"><span>{connection ? '保存会断开当前连接。' : '保存不会自动启动服务。'}</span><button className="secondary-button" type="button" disabled={busy} onClick={onClose}>取消</button><button className="primary-button" disabled={busy}>{busy && <LoaderCircle size={16} className="spin" />}保存连接</button></div>
  </form></div>;
}

export function McpConnections({ onUseContext }) {
  const [state, setState] = useState({ servers: [] }); const [error, setError] = useState(''); const [busy, setBusy] = useState(''); const [editor, setEditor] = useState(undefined);
  const refresh = async () => { try { setState(await window.scodex.listMcpConnections()); setError(''); } catch (value) { setError(value.message || '无法读取 MCP 连接'); } };
  useEffect(() => { refresh(); return window.scodex.onMcpState(setState); }, []);
  const action = async (key, fn) => { setBusy(key); setError(''); try { setState(await fn()); } catch (value) { setError(value.message || '操作失败'); await refresh().catch(() => {}); setError(value.message || '操作失败'); } finally { setBusy(''); } };
  const connected = state.servers.filter((v) => v.status === 'connected');
  return <div className="mcp-connections">
    <div className="mcp-section-heading"><div><h2>MCP 连接</h2><p>把本地程序和远程服务的工具、资料与提示词接入任务。</p></div><div><button className="secondary-button" disabled={Boolean(busy)} onClick={refresh}><RefreshCw size={16} />刷新状态</button><button className="primary-button" onClick={() => setEditor(null)}><Plus size={16} />添加连接</button></div></div>
    <div className="mcp-summary"><span><span className="mcp-online-dot" />{connected.length} 个已连接</span><span>{connected.reduce((n, v) => n + v.tools.length, 0)} 项已发现工具</span><span><ShieldCheck size={16} />每次调用需审批</span></div>
    {error && <div className="inline-error" role="alert"><AlertTriangle size={17} />{error}</div>}
    <div className="mcp-server-list">{state.servers.map((server) => <article className="mcp-server-card" key={server.id} data-mcp-id={server.id}>
      <div className="mcp-server-heading"><span className="mcp-server-icon"><Server size={21} /></span><div><h3>{server.name}<span className={'mcp-status ' + server.status}>{statusLabels[server.status]}</span></h3><p>{transportLabels[server.transport] || server.transport}{server.serverVersion?.name ? ' · ' + server.serverVersion.name : ''}{server.serverVersion?.version ? ' ' + server.serverVersion.version : ''}</p></div><div className="mcp-card-actions"><button className="icon-button" aria-label={'编辑连接 ' + server.name} disabled={Boolean(busy)} onClick={() => setEditor(server)}><Pencil size={17} /></button><button className="icon-button" aria-label={'删除连接 ' + server.name} disabled={Boolean(busy)} onClick={() => { if (window.confirm('删除连接“' + server.name + '”？将同时断开服务并删除其加密认证。')) action(server.id, () => window.scodex.removeMcpConnection(server.id)); }}><Trash2 size={17} /></button><button className={server.status === 'connected' ? 'secondary-button' : 'primary-button'} disabled={Boolean(busy) || ['connecting', 'disconnecting', 'authorizing'].includes(server.status)} onClick={() => action(server.id, () => server.status === 'connected' ? window.scodex.disconnectMcp(server.id) : server.authMode==='oauth'&&!server.hasOAuthTokens ? window.scodex.authorizeMcp(server.id) : window.scodex.connectMcp(server.id))}>{busy === server.id || ['connecting', 'disconnecting', 'authorizing'].includes(server.status) ? <LoaderCircle size={16} className="spin" /> : server.status === 'connected' ? <Unplug size={16} /> : <Plug size={16} />}{server.status === 'connected' ? '断开' : server.status==='authorizing'?'授权中':server.authMode==='oauth'&&!server.hasOAuthTokens?'授权并连接':'连接'}</button></div></div>
      <div className="mcp-server-address">{server.transport === 'stdio' ? [server.command, ...server.args].join(' ') : server.url}</div>
      {server.authMode==='oauth'&&<div className="mcp-oauth-status"><div><ShieldCheck size={16}/><span>{server.authorizing?'正在进行网页登录'+(server.authOrigin?' · '+server.authOrigin:''):server.hasOAuthTokens?'本机已加密保存授权'+(server.oauthExpiresAt?' · 访问令牌到期 '+new Date(server.oauthExpiresAt).toLocaleString():''):'尚未保存登录授权'}</span></div><div className="mcp-oauth-actions">{server.authorizing?<button className="secondary-button" onClick={()=>window.scodex.cancelMcpAuthorization(server.id).catch(e=>setError(e.message))}>取消授权</button>:<>{server.hasOAuthTokens&&<button className="secondary-button" disabled={Boolean(busy)} onClick={()=>action(server.id,()=>window.scodex.authorizeMcp(server.id))}>重新授权</button>}<button className="secondary-button" disabled={Boolean(busy)||!server.hasOAuthTokens} onClick={()=>{if(window.confirm('清除此连接的本机OAuth授权并断开服务？这不会撤销服务端已授予的权限。'))action(server.id,()=>window.scodex.clearMcpAuthorization(server.id));}}>清除本机授权</button></>}</div></div>}
      {server.error && <p className="mcp-server-error" role="alert">{server.error}</p>}
      {server.status === 'connected' && <details className="mcp-tools"><summary><ChevronRight size={16} />已发现 {server.tools.length} 项工具<span>展开查看参数与规划权限</span></summary><div>{server.tools.map((tool) => <details className="mcp-tool" key={tool.name}><summary><span>{tool.name}</span>{tool.allowedInPlan && <small><Check size={14} />规划可用</small>}</summary><p>{tool.description || '服务未提供工具说明。'}</p><pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre></details>)}{!server.tools.length && <p>服务未声明工具。</p>}</div></details>}
      {server.status === 'connected' && (server.contextCapabilities?.resources || server.contextCapabilities?.prompts) && <McpContextBrowser server={server} onUseContext={onUseContext} />}
    </article>)}</div>
    {!state.servers.length && <div className="mcp-empty"><span className="mcp-server-icon"><Plug size={28} /></span><h3>连接你的工具</h3><p>添加已知 MCP 服务，连接后可直接在对话中按当前权限使用。</p><button className="primary-button" onClick={() => setEditor(null)}><Plus size={16} />添加第一个连接</button></div>}
    <p className="mcp-footer-note">仅对话不开放本机工具。规划可读取资料，其他工具需要只读白名单；完整访问且不请求审批时直接调用，按请求审批时逐项确认。服务不会随应用启动自动运行，切换项目或退出时会断开。</p>
    {editor !== undefined && <ConnectionEditor connection={editor} onClose={() => setEditor(undefined)} onSave={async (input) => { setState(await window.scodex.saveMcpConnection(input)); }} />}
  </div>;
}
