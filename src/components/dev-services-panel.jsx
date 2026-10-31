import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, LoaderCircle, Play, RefreshCw, Server, Square, Terminal } from 'lucide-react';

const LIVE = ['starting', 'running', 'stopping'];
const labels = { starting: '启动中', running: '运行中', stopping: '停止中', stopped: '已停止', exited: '已结束', failed: '启动失败' };
const emptyForm = () => ({ name: '', command: '', cwd: '.', previewUrl: '' });
const sameRoot = (a, b) => String(a || '').replaceAll('\\', '/').toLowerCase() === String(b || '').replaceAll('\\', '/').toLowerCase();
const message = (error) => String(error?.message || error).replace(/^Error invoking remote method '[^']+': /, '');
export function DevServicesPanel({ workspaceRoot, active, contextAccess, onPreview }) {
  const [state, setState] = useState({ services: [], maxActive: 4 });
  const [scripts, setScripts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [log, setLog] = useState({ output: '', truncated: false });
  const [follow, setFollow] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const rootRef = useRef(workspaceRoot); rootRef.current = workspaceRoot;
  const logRef = useRef(null);
  const services = state.services || [];
  const selected = services.find((service) => service.id === selectedId);
  const count = services.filter((service) => LIVE.includes(service.status)).length;
  useEffect(() => { setSelectedId(null); setState({ services: [], maxActive: 4 }); setForm(emptyForm()); setFormOpen(true); setError(''); setBusy(false); setStopping(null); setOpening(false); setLog({ output: '' }); }, [workspaceRoot]);
  useEffect(() => {
    let current = true;
    const accept = (next) => { if (current && sameRoot(next.workspaceRoot, workspaceRoot)) setState(next); };
    window.scodex.listDevServices().then(accept).catch((e) => { if (current) setError(message(e)); });
    window.scodex.getDevScripts().then((next) => { if (current) setScripts(next); }).catch((e) => { if (current) { setScripts([]); setError(message(e)); } });
    const unsubscribe = window.scodex.onDevServiceState(accept);
    return () => { current = false; unsubscribe(); };
  }, [workspaceRoot, refresh]);
  useEffect(() => { if (!selectedId || !services.some((s) => s.id === selectedId)) setSelectedId(services[0]?.id || null); }, [services, selectedId]);
  useEffect(() => {
    if (!active || !selectedId) return;
    let current = true; let pending = false;
    const read = async () => {
      if (pending) return; pending = true;
      try { const next = await window.scodex.getDevServiceLogs(selectedId); if (current) setLog(next); }
      catch (e) { if (current) setError(message(e)); }
      finally { pending = false; }
    };
    setLog({ output: '' }); void read();
    const timer = window.setInterval(read, 900);
    return () => { current = false; window.clearInterval(timer); };
  }, [active, selectedId, workspaceRoot]);
  useEffect(() => { if (follow && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log.output, follow]);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const start = async (event) => {
    event.preventDefault(); if (busy) return;
    const root = workspaceRoot; setBusy(true); setError('');
    try { const service = await window.scodex.startDevService(form, root); if (rootRef.current !== root) return; setSelectedId(service.id); setFormOpen(false); setState(await window.scodex.listDevServices()); if (service.status === 'failed') setError(service.error || '命令已退出，请检查日志。'); }
    catch (e) { if (rootRef.current === root) setError(message(e)); }
    finally { if (rootRef.current === root) setBusy(false); }
  };
  const stop = async () => {
    if (!selected || stopping) return;
    const root = workspaceRoot; setStopping(selected.id); setError('');
    try { await window.scodex.stopDevService(selected.id); if (rootRef.current === root) setState(await window.scodex.listDevServices()); }
    catch (e) { if (rootRef.current === root) setError(message(e)); }
    finally { if (rootRef.current === root) setStopping(null); }
  };
  const preview = async () => {
    if (!selected || opening) return;
    const root = workspaceRoot; setOpening(true); setError('');
    try { const result = await window.scodex.getDevServicePreview(selected.id); if (rootRef.current === root) await onPreview(result.url); }
    catch (e) { if (rootRef.current === root) setError(message(e)); }
    finally { if (rootRef.current === root) setOpening(false); }
  };
  return <section className="dev-services-panel" aria-label="运行与预览">
    <header className="dev-services-heading"><div><Server size={22} /><h2>运行与预览</h2></div><button className="icon-button" aria-label="刷新开发服务" title="刷新服务和项目脚本" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={18} /></button></header>
    <div className="dev-services-overview"><strong>{count}<span> / {state.maxActive || 4} 个运行</span></strong><span>当前项目 · 本次会话</span></div>
    <details className="dev-service-launch" open={formOpen} onToggle={(e) => setFormOpen(e.currentTarget.open)}><summary>启动开发服务</summary>
      <form onSubmit={start}>
        {scripts.length > 0 && <label>项目脚本<select aria-label="项目启动脚本" value="" onChange={(e) => { const script = scripts.find((s) => s.name === e.target.value); if (script) { update('command', script.command); update('name', script.name); } }}><option value="">选择 package.json 中的脚本</option>{scripts.map((script) => <option value={script.name} key={script.name}>{script.name} · {script.description}</option>)}</select></label>}
        <label>服务名称<input aria-label="服务名称" value={form.name} maxLength={80} placeholder="例如：前端预览" onChange={(e) => update('name', e.target.value)} /></label>
        <label>启动命令<textarea aria-label="服务启动命令" value={form.command} maxLength={16000} rows={3} placeholder="npm run dev -- --host 127.0.0.1" required spellCheck={false} onChange={(e) => update('command', e.target.value)} /></label>
        <label>工作目录<input aria-label="服务工作目录" value={form.cwd} maxLength={4096} placeholder=".（项目根目录）" onChange={(e) => update('cwd', e.target.value)} /></label>
        <label>预览地址<span className="dev-service-optional">可选</span><input aria-label="服务预览地址" value={form.previewUrl} type="url" maxLength={2048} placeholder="http://127.0.0.1:5173" onChange={(e) => update('previewUrl', e.target.value)} /></label>
        <p>使用前台命令，日志会显示在下方。服务可在托盘驻留期间运行，切换项目或完整退出会停止。</p>
        <button type="submit" className="primary-button" disabled={busy || !form.command.trim() || count >= (state.maxActive || 4) || contextAccess === 'chat-only'}>{busy ? <LoaderCircle size={17} className="spin" /> : <Play size={17} />}{busy ? '正在启动并检查预览…' : '启动服务'}</button>
        {contextAccess === 'chat-only' && <p role="status">请将输入栏权限切换为完全访问后启动服务。</p>}
      </form>
    </details>
    {error && <p className="dev-service-error" role="alert">{error}</p>}
    {services.length > 0 ? <><div className="dev-service-list" role="list" aria-label="项目开发服务">{services.map((service) => <button type="button" role="listitem" key={service.id} aria-pressed={service.id === selectedId} onClick={() => setSelectedId(service.id)} className={'dev-service-card' + (selectedId === service.id ? ' selected' : '')}><span className="dev-service-card-head"><span className={'dev-service-dot ' + service.status} /><strong>{service.name}</strong><span className="dev-service-badge">{labels[service.status] || service.status}</span></span><span className="dev-service-command" title={service.command}>{service.command.split('\n')[0]}</span><span className="dev-service-health">{service.health === 'ready' ? '预览已就绪 · ' + service.healthDetail : service.health === 'waiting' ? '等待预览 · ' + (service.healthDetail || '检测中') : service.status === 'running' ? '未配置预览 · 进程存活' : service.exitCode !== null ? '退出码 ' + service.exitCode : service.source}</span></button>)}</div>
      {selected && <div className="dev-service-detail"><div className="dev-service-detail-heading"><strong>{selected.name}</strong><span>{selected.pid ? 'PID ' + selected.pid : '无进程'}</span></div><p className="dev-service-path" title={selected.cwd}>{selected.cwd}</p>
        {selected.previewUrl && <p className="dev-service-url">{selected.previewUrl}</p>}
        <div className="dev-service-actions"><button className="secondary-button" disabled={opening || selected.health !== 'ready' || !LIVE.includes(selected.status)} onClick={preview}>{opening ? <LoaderCircle size={16} className="spin" /> : <ExternalLink size={16} />}打开预览</button><button className="secondary-button" aria-label="停止所选服务" disabled={Boolean(stopping) || !LIVE.includes(selected.status)} onClick={stop}>{stopping === selected.id ? <LoaderCircle size={16} className="spin" /> : <Square size={16} />}停止</button><button className="text-tool" onClick={() => { setForm({ name: selected.name, command: selected.command, cwd: selected.relativeCwd, previewUrl: selected.previewUrl }); setFormOpen(true); }}>使用此命令</button></div>
        {selected.error && <p className="dev-service-error">{selected.error}</p>}
        <div className="dev-service-log-heading"><span><Terminal size={16} />服务日志</span><label><input type="checkbox" aria-label="跟随最新日志" checked={follow} onChange={(e) => setFollow(e.target.checked)} />跟随输出</label></div>
        <pre className="dev-service-log" ref={logRef} role="log" aria-label="开发服务日志" aria-live="off">{log.output || '等待服务输出…'}</pre>
        <p className="dev-service-log-note">{log.truncated ? '仅显示最新日志，较早输出已截断。' : '输出只在本次会话保留。'}{log.pendingLine ? ' 正在接收下一行。' : ''}</p>
      </div>}
    </> : <div className="dev-services-empty"><Server size={32} /><strong>项目还没有运行服务</strong><p>选择项目脚本或填写命令，启动后可查看日志与本地网页。</p></div>}
  </section>;
}
