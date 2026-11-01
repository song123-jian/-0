import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, CircleHelp, Download, Eye, EyeOff, LoaderCircle, Plus, Save, X, Zap } from 'lucide-react';
import './model-connection.css';
import { replaceModelList } from '../lib/model-list.js';

const EFFORTS = ['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const errorText = (error) => String(error?.message || error).replace(/^Error invoking remote method '[^']+': /, '');

function Help({ text }) { return <span className="model-help" title={text} aria-label={text}><CircleHelp size={14} /></span>; }

function EffortPicker({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const root = useRef(null);
  const choose = (next) => { onChange(next); setOpen(false); root.current?.querySelector('button')?.focus(); };
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const keydown = (event) => {
    if (event.key === 'Escape') { if (open) { event.stopPropagation(); event.preventDefault(); setOpen(false); } return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); setOpen(true);
      const current = open ? cursor : Math.max(0, EFFORTS.indexOf(value));
      setCursor(event.key === 'Home' ? 0 : event.key === 'End' ? EFFORTS.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + EFFORTS.length) % EFFORTS.length);
    } else if (open && ['Enter', ' '].includes(event.key)) { event.preventDefault(); choose(EFFORTS[cursor]); }
  };
  return <div className="model-effort" ref={root} onKeyDown={keydown} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button type="button" role="combobox" aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={'effort-' + label} aria-activedescendant={open ? label + '-' + cursor : undefined} onClick={() => { setCursor(Math.max(0, EFFORTS.indexOf(value))); setOpen(!open); }}><span>{value || '默认强度'}</span><ChevronDown size={16} /></button>
    {open && <div className="model-effort-menu" role="listbox" id={'effort-' + label} aria-label={label + '选项'}>{EFFORTS.map((effort, index) => <div key={effort} id={label + '-' + index} role="option" aria-selected={value === effort} className={index === cursor ? 'highlighted' : ''} onPointerMove={() => setCursor(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(effort)}><span className="model-effort-check">{value === effort && <Check size={15} />}</span>{effort || '默认强度'}</div>)}</div>}
  </div>;
}

export function ModelConnectionPanel({ connection, onSaved, busy }) {
  const [usage, setUsage] = useState(null);
  useEffect(() => { window.scodex.getModelUsage().then(setUsage).catch(() => {}); }, [busy]);
  const [form, setForm] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [subagentApiKey, setSubagentApiKey] = useState('');
  const [visibleKey, setVisibleKey] = useState(false);
  const [visibleSubagentKey, setVisibleSubagentKey] = useState(false);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualModel, setManualModel] = useState('');
  const [subagentManualOpen, setSubagentManualOpen] = useState(false);
  const [subagentManualModel, setSubagentManualModel] = useState('');
  const [addressesOpen, setAddressesOpen] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [speeds, setSpeeds] = useState({});
  useEffect(() => { if (connection) { setForm(connection); setDirty(false); } else { window.scodex.getModelConnection().then(setForm).catch((error) => setMessage({ error: true, text: errorText(error) })); } }, [connection]);
  const update = (patch) => { setForm((current) => ({ ...current, ...patch })); setDirty(true); setMessage(null); };
  if (!form) return <p role="status">正在读取模型配置…</p>;
  const separateSubagentService = form.subagentBaseUrl !== form.baseUrl;
  const savedSubagentCredential = form.hasSubagentCredential && form.subagentBaseUrl === connection?.subagentBaseUrl
    && (form.subagentCredentialSource !== '跟随主模型凭据' || !separateSubagentService && form.baseUrl === connection.baseUrl);
  const payload = () => ({ ...form, apiKey, subagentApiKey });
  const act = async (kind, action) => { setWorking(kind); setMessage(null); try { await action(); } catch (error) { setMessage({ error: true, text: errorText(error) }); } finally { setWorking(''); } };
  const fetchList = (channel = 'main') => act(channel === 'subagent' ? 'subagent-models' : 'models', async () => {
    const result = await window.scodex.fetchModels({ ...payload(), modelChannel: channel });
    if (channel === 'subagent') {
      const models = result.models; update({ subagentModels: models, subagentModel: models.includes(form.subagentModel) ? form.subagentModel : models[0] });
    } else update(replaceModelList(form, result.models));
    setMessage({ text: `${channel === 'subagent' ? '子模型' : '主模型'}已获取 ${result.models.length} 个模型，耗时 ${result.latencyMs} ms。保存后生效。` });
  });
  const save = (event) => { event.preventDefault(); if (working || busy) return; act('save', async () => { const saved = await window.scodex.saveModelConnection(payload()); setForm(saved); setApiKey(''); setSubagentApiKey(''); setVisibleKey(false); setVisibleSubagentKey(false); setDirty(false); onSaved(saved); setMessage({ text: '已保存，主模型与子模型配置立即生效。' }); }); };
  const addModel = () => { const id = manualModel.trim(); if (!id || /[\s\x00-\x1f\x7f]/.test(id)) { setMessage({ error: true, text: '请填写不含空格或控制字符的模型 ID。' }); return; } if (form.models.length >= 500) { setMessage({ error: true, text: '模型列表最多保存 500 项。' }); return; } update({ models: [...new Set([...form.models, id])] }); setManualModel(''); setManualOpen(false); };
  const addSubagentModel = () => { const id = subagentManualModel.trim(); const models = form.subagentModels || form.models || []; if (!id || /[\s\x00-\x1f\x7f]/.test(id)) { setMessage({ error: true, text: '请填写不含空格或控制字符的子模型 ID。' }); return; } if (models.length >= 500) { setMessage({ error: true, text: '子模型列表最多保存 500 项。' }); return; } update({ subagentModels: [...new Set([...models, id])] }); setSubagentManualModel(''); setSubagentManualOpen(false); };
  const testAddress = (address) => act(address, async () => { try { const result = await window.scodex.fetchModels({ ...payload(), baseUrl: address, addresses: [address] }); setSpeeds((current) => ({ ...current, [address]: result.latencyMs + ' ms' })); } catch (error) { setSpeeds((current) => ({ ...current, [address]: '连接失败' })); throw error; } });
  const disabled = Boolean(working) || busy;
  return <form className="model-connection-form" onSubmit={save} aria-label="模型服务配置" aria-busy={Boolean(working)}>
    <fieldset disabled={disabled}>
      <div className="model-name-row">
        <div className="model-field"><label htmlFor="model-service-name">名称<span className="model-required">*</span></label><div className="model-name-input"><span className="model-service-avatar" aria-hidden="true">{(form.name.match(/[A-Za-z0-9]/g)?.slice(0, 2).join('') || form.name.slice(0, 1)).toUpperCase()}</span><input id="model-service-name" required value={form.name} maxLength={80} onChange={(event) => update({ name: event.target.value })} /></div></div>
        <div className="model-field"><label htmlFor="model-service-note">备注</label><input id="model-service-note" value={form.note} maxLength={500} placeholder="例如：公司专用账号" onChange={(event) => update({ note: event.target.value })} /></div>
      </div>
      <div className="model-field"><label htmlFor="model-website">官网链接</label><input id="model-website" type="url" value={form.website} placeholder="https://example.com" spellCheck={false} onChange={(event) => update({ website: event.target.value })} /></div>
      <div className="model-field"><label htmlFor="model-api-key">API Key<span className="model-required">*</span>{form.hasCredential && <span className="model-key-state"><Check size={13} />已配置</span>}</label><div className="model-key-input"><input id="model-api-key" type={visibleKey ? 'text' : 'password'} value={apiKey} autoComplete="new-password" spellCheck={false} maxLength={8192} placeholder={form.hasCredential ? '•••••••••••••••••••••••• · 已保存，留空沿用' : '输入 API Key'} onChange={(event) => { setApiKey(event.target.value); setDirty(true); setMessage(null); }} /><button type="button" className="model-icon-button" aria-label={visibleKey ? '隐藏新输入的密钥' : '显示新输入的密钥'} title={visibleKey ? '隐藏密钥' : '查看本次输入'} onClick={() => setVisibleKey(!visibleKey)}>{visibleKey ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
      <div className="model-field"><div className="model-field-heading"><label htmlFor="model-base-url">API 请求地址<span className="model-required">*</span><Help text="支持 OpenAI 兼容服务；根地址会补上 /v1，也可填写自定义 API 前缀。" /></label><button type="button" className="model-link-button" aria-expanded={addressesOpen} onClick={() => setAddressesOpen(!addressesOpen)}><Zap size={15} />管理与测速</button></div><input id="model-base-url" type="url" required value={form.baseUrl} spellCheck={false} onChange={(event) => update({ baseUrl: event.target.value })} /></div>
      {addressesOpen && <section className="model-address-manager" aria-label="API 地址管理"><p>测速请求模型列表，不生成回答；更换服务主机时请填写对应的 API Key。</p>{[...new Set([form.baseUrl, ...form.addresses])].map((address) => <div className="model-address-row" key={address}><label><input type="radio" name="model-address" aria-label={'使用地址 ' + address} checked={form.baseUrl === address} onChange={() => update({ baseUrl: address })} /><span>{address}</span></label><span className="model-latency" role="status">{speeds[address]}</span><button type="button" className="model-small-button" onClick={() => testAddress(address)}>{working === address ? <LoaderCircle size={14} className="spin" /> : <Zap size={14} />}测速</button>{address !== form.baseUrl && <button type="button" className="model-icon-button" aria-label={'移除地址 ' + address} onClick={() => update({ addresses: form.addresses.filter((item) => item !== address) })}><X size={15} /></button>}</div>)}<div className="model-inline-add"><input aria-label="新增 API 地址" placeholder="https://api.example.com/v1" value={newAddress} onChange={(event) => setNewAddress(event.target.value)} /><button type="button" className="model-small-button" disabled={!newAddress.trim() || form.addresses.length >= 20} onClick={() => { update({ addresses: [...new Set([...form.addresses, newAddress.trim()])] }); setNewAddress(''); }}><Plus size={15} />添加地址</button></div></section>}
      <div className="model-field"><div className="model-field-heading"><label>模型列表<Help text="从服务获取模型，或填写提供方给出的完整模型 ID。列表不代表每个模型都支持相同能力。" /></label><div className="model-actions"><button type="button" className="model-small-button" onClick={() => fetchList()}>{working === 'models' ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />}获取模型列表</button><button type="button" className="model-small-button" aria-expanded={manualOpen} onClick={() => setManualOpen(!manualOpen)}><Plus size={15} />手动添加</button></div></div><p className="model-field-hint">保存后立即生效，无需重启 Scodex。</p>
        {manualOpen && <div className="model-inline-add"><input autoFocus aria-label="手动添加模型 ID" placeholder="输入模型 ID，例如 gpt-6.1-sol" value={manualModel} onChange={(event) => setManualModel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addModel(); } }} /><button type="button" className="model-small-button" disabled={!manualModel.trim()} onClick={addModel}>添加</button><button type="button" className="model-icon-button" aria-label="取消添加模型" onClick={() => setManualOpen(false)}><X size={17} /></button></div>}
        <div className="model-list" aria-label="已添加的模型">{form.models.map((model) => <span className="model-chip" key={model}>{model}<button type="button" aria-label={'移除模型 ' + model} title={model === form.model || model === form.subagentModel ? '先更换正在使用的模型' : '移除模型'} disabled={model === form.model || model === form.subagentModel} onClick={() => update({ models: form.models.filter((item) => item !== model) })}><X size={13} /></button></span>)}</div>
      </div>
      <div className="model-field"><label htmlFor="model-default">默认模型<Help text="用于主聊天。默认强度表示不向服务发送 reasoning_effort 参数；显式强度需模型支持。" /></label><div className="model-and-effort"><select id="model-default" required value={form.model} onChange={(event) => update({ model: event.target.value })}>{form.models.map((model) => <option key={model} value={model}>{model}</option>)}</select><EffortPicker label="默认模型推理强度" value={form.reasoningEffort} onChange={(value) => update({ reasoningEffort: value })} /></div></div>
      <div className="model-field"><label htmlFor="model-tool-protocol">任务执行通道</label><select id="model-tool-protocol" aria-label="任务执行通道" value={form.toolProtocol || "json"} onChange={(event) => update({ toolProtocol: event.target.value })}><option value="json">中转兼容（适合 Grok）</option><option value="native">原生工具调用</option></select><p className="model-field-hint">兼容通道适用于只能返回文字的中转服务；两种通道遵循相同权限。仅在开启“执行任务”时生效。</p></div>
      <section className="model-subagent-section" aria-label="子模型服务配置">
        <div className="model-subagent-heading"><div><h2>子模型服务</h2><p>主模型负责当前任务的决策与整合；子模型只执行主模型分配的分析或指定路径修改，可使用独立 API 地址和密钥。</p></div><span className={savedSubagentCredential ? 'model-key-state' : 'model-subagent-fallback'}>{savedSubagentCredential ? <><Check size={13} />已配置子模型凭据</> : separateSubagentService ? '不同地址需要独立凭据' : '未单独配置时跟随主模型凭据'}</span></div>
        <div className="model-field"><label htmlFor="model-subagent-base-url">子模型 API 请求地址<Help text="子模型可使用不同的 OpenAI 兼容服务；更换地址后应填写对应的独立 API Key。" /></label><input id="model-subagent-base-url" type="url" required value={form.subagentBaseUrl || form.baseUrl} spellCheck={false} onChange={(event) => update({ subagentBaseUrl: event.target.value })} /></div>
        <div className="model-field"><label htmlFor="model-subagent-api-key">子模型 API Key{savedSubagentCredential && <span className="model-key-state"><Check size={13} />已配置</span>}</label><div className="model-key-input"><input id="model-subagent-api-key" type={visibleSubagentKey ? 'text' : 'password'} value={subagentApiKey} autoComplete="new-password" spellCheck={false} maxLength={8192} placeholder={savedSubagentCredential ? '•••••••••••••••••••••••• · 已保存，留空沿用' : separateSubagentService ? '输入此地址的独立 API Key' : '输入独立子模型 API Key；留空跟随主模型'} onChange={(event) => { setSubagentApiKey(event.target.value); setDirty(true); setMessage(null); }} /><button type="button" className="model-icon-button" aria-label={visibleSubagentKey ? '隐藏子模型密钥' : '显示子模型密钥'} title={visibleSubagentKey ? '隐藏密钥' : '查看本次输入'} onClick={() => setVisibleSubagentKey(!visibleSubagentKey)}>{visibleSubagentKey ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
        <div className="model-field"><div className="model-field-heading"><label>子模型列表<Help text="主模型通过 subagent_start 分配任务时使用此列表中的默认子模型。" /></label><div className="model-actions"><button type="button" className="model-small-button" onClick={() => fetchList('subagent')}>{working === 'subagent-models' ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />}获取子模型列表</button><button type="button" className="model-small-button" aria-expanded={subagentManualOpen} onClick={() => setSubagentManualOpen(!subagentManualOpen)}><Plus size={15} />手动添加</button></div></div>
          {subagentManualOpen && <div className="model-inline-add"><input autoFocus aria-label="手动添加子模型 ID" placeholder="输入子模型 ID，例如 claude-sonnet-5" value={subagentManualModel} onChange={(event) => setSubagentManualModel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSubagentModel(); } }} /><button type="button" className="model-small-button" disabled={!subagentManualModel.trim()} onClick={addSubagentModel}>添加</button><button type="button" className="model-icon-button" aria-label="取消添加子模型" onClick={() => setSubagentManualOpen(false)}><X size={17} /></button></div>}
          <div className="model-list" aria-label="已添加的子模型">{(form.subagentModels || form.models || []).map((model) => <span className="model-chip" key={model}>{model}<button type="button" aria-label={'移除子模型 ' + model} title={model === form.subagentModel ? '先更换正在使用的子模型' : '移除子模型'} disabled={model === form.subagentModel} onClick={() => update({ subagentModels: (form.subagentModels || form.models).filter((item) => item !== model) })}><X size={13} /></button></span>)}</div>
        </div>
        <div className="model-field"><label htmlFor="model-subagent">默认子模型<Help text="主模型分配子任务时使用；同地址留空可跟随主模型，不同地址须选择子模型。" /></label><div className="model-and-effort"><select id="model-subagent" value={form.subagentModel || ''} onChange={(event) => update({ subagentModel: event.target.value })}><option value="" disabled={separateSubagentService}>{separateSubagentService ? '请选择子模型' : '跟随主模型'}</option>{(form.subagentModels || form.models || []).map((model) => <option key={model} value={model}>{model}</option>)}</select><EffortPicker label="子模型推理强度" value={form.subagentReasoningEffort} onChange={(value) => update({ subagentReasoningEffort: value })} /></div></div>
        <div className="model-field"><label htmlFor="model-subagent-tool-protocol">子模型任务执行通道</label><select id="model-subagent-tool-protocol" value={form.subagentToolProtocol || ''} onChange={(event) => update({ subagentToolProtocol: event.target.value })}><option value="">跟随主模型</option><option value="native">原生工具调用</option><option value="json">中转兼容</option></select></div>
      </section>
      <div className="model-name-row"><div className="model-field"><label htmlFor="model-retry">临时服务错误重试</label><select id="model-retry" value={form.retryLimit ?? 1} onChange={event => update({ retryLimit: Number(event.target.value) })}><option value={0}>关闭</option><option value={1}>最多 1 次</option><option value={2}>最多 2 次</option></select><p className="model-field-hint">仅重试 HTTP 429/502/503/504；已返回内容、断流、鉴权失败和工具操作不会重放。</p></div><div className="model-field"><label htmlFor="model-token-limit">单次输出 token 上限</label><input id="model-token-limit" type="number" min="128" max="128000" placeholder="留空由服务决定" value={form.maxOutputTokens || ''} onChange={event => update({ maxOutputTokens: Number(event.target.value) || 0 })} /></div></div>
      <div className="model-field"><label><input type="checkbox" checked={Boolean(form.reportUsage)} onChange={event => update({ reportUsage: event.target.checked })} />请求服务返回流式 token 用量</label><p className="model-field-hint">服务须支持 stream_options；不支持时关闭。未返回的用量显示为未知，不估算账单。</p></div>
      <div className="model-field"><label htmlFor="model-image">图像生成模型 ID</label><input id="model-image" value={form.imageModel || ''} placeholder="可选，须支持 images/generations" onChange={event => update({ imageModel: event.target.value })} /><p className="model-field-hint">仅配置独立图像模型时开放生成工具，文字聊天模型不会自动视作图像模型。</p></div>
    </fieldset>
    {usage && <section className="model-address-manager" aria-label="模型用量与诊断"><strong>最近 {usage.requests} 次请求 · 成功 {usage.succeeded}</strong><p>输入 {usage.inputTokens.toLocaleString()} / 输出 {usage.outputTokens.toLocaleString()} tokens；{usage.unknownUsage} 次用量未知。保留最近 1,000 次，不包含提示词或密钥。</p><details><summary>最近请求</summary>{usage.records.map((record, index) => <p key={index}>{record.model} · {record.status === 'succeeded' ? '成功' : record.status === 'cancelled' ? '已停止' : '失败'} · {record.durationMs} ms · {record.httpStatus ? 'HTTP ' + record.httpStatus : '网络/取消'} · {record.usage ? record.usage.totalTokens + ' tokens' : '用量未知'}</p>)}</details></section>}
    {(message || form.error) && <div className={'model-message ' + (message?.error || form.error ? 'error' : '')} role={message?.error || form.error ? 'alert' : 'status'}>{message?.text || form.error}</div>}
    <footer className="model-form-footer"><span>{busy ? '请先停止或完成正在运行的聊天' : dirty ? '有未保存的修改' : form.credentialSource || '密钥使用 Windows 用户加密保存'}</span><button type="submit" className="model-save-button" disabled={disabled || !dirty || Boolean(form.error)}>{working === 'save' ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}保存配置</button></footer>
  </form>;
}
