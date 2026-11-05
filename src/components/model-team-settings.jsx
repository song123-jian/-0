import React, { useState } from 'react';
import { Check, Download, Eye, EyeOff, LoaderCircle, Plus, X } from 'lucide-react';

export function ModelTeamSettings({ form, connection, update, apiKey, onApiKeyChange, onFetch, working, EffortPicker }) {
  const [visible, setVisible] = useState(false);
  const [manual, setManual] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const models = form.advisorModels || [];
  const separate = (form.advisorBaseUrl || form.baseUrl) !== form.baseUrl;
  const saved = form.hasAdvisorCredential && form.advisorBaseUrl === connection?.advisorBaseUrl
    && (form.advisorCredentialSource !== '跟随主模型凭据' || !separate && form.baseUrl === connection.baseUrl);
  const [error, setError] = useState('');
  const add = () => {
    const id = manual.trim();
    if (!id || /[\s\x00-\x1f\x7f]/.test(id) || models.length >= 500) { setError('请填写不含空格的模型 ID；列表最多 500 项。'); return; }
    update({ advisorModels: [...new Set([...models, id])] }); setManual(''); setManualOpen(false); setError('');
  };
  return <>
    <section className="model-team-roles" aria-label="模型职责分工">
      <h2>模型分工</h2>
      <dl><div><dt>主模型</dt><dd>制定计划、编写代码、运行验证、整合结果并交付。</dd></div><div><dt>探索子模型</dt><dd>并行查文件、文档和接口，返回路径、哈希与依据；主模型负责复核。</dd></div><div><dt>顾问模型</dt><dd>只做计划、重复错误和完成前的判断，意见交回主模型处理。</dd></div></dl>
      <p className="model-field-hint">按实际能力和服务报价选择模型。程序不会自动推断模型能力、价格或节省金额。</p>
      <div className="model-field"><label htmlFor="model-subagent-concurrency">探索并发数</label><select id="model-subagent-concurrency" value={form.subagentMaxConcurrent ?? 2} onChange={event => update({ subagentMaxConcurrent: Number(event.target.value) })}>{[1, 2, 3].map(value => <option key={value} value={value}>最多 {value} 个</option>)}</select><p className="model-field-hint">每次主任务最多 4 个子任务，每个最多 6 轮，单轮最多 1,600 输出 tokens；相同的运行中任务合并。</p></div>
      <div className="model-field"><label><input type="checkbox" checked={Boolean(form.subagentAllowEdits)} onChange={event => update({ subagentAllowEdits: event.target.checked })} />允许子模型修改明确分配的路径</label><p className="model-field-hint">默认关闭，仅只读探索。开启后仍检查路径冲突、最新文件哈希与现有审批权限。</p></div>
    </section>
    <section className="model-subagent-section" aria-label="顾问模型服务配置">
      <div className="model-subagent-heading"><div><h2>顾问模型</h2><p>在计划确定前、同类工具错误第二次出现、任务完成前各咨询一次。顾问没有工具权限，不能代替实际测试。</p></div><span className={saved ? 'model-key-state' : 'model-subagent-fallback'}>{saved ? <><Check size={13} />已配置顾问凭据</> : separate ? '不同地址需要独立凭据' : '同地址可跟随主模型凭据'}</span></div>
      <div className="model-field"><label><input id="model-advisor-enabled" type="checkbox" checked={Boolean(form.advisorEnabled)} onChange={event => update({ advisorEnabled: event.target.checked })} />启用顾问核验</label><p className="model-field-hint">默认关闭，选择模型并启用后生效。每次主任务最多 3 次顾问请求，每次最多 30 秒、1,200 输出 tokens；不自动重试。失败时记录未核验并由主模型继续。</p></div>
      <div className="model-field"><label htmlFor="model-advisor-base-url">顾问 API 请求地址</label><input id="model-advisor-base-url" type="url" required value={form.advisorBaseUrl || form.baseUrl} spellCheck={false} onChange={event => update({ advisorBaseUrl: event.target.value })} /></div>
      <div className="model-field"><label htmlFor="model-advisor-api-key">顾问 API Key{saved && <span className="model-key-state"><Check size={13} />已配置</span>}</label><div className="model-key-input"><input id="model-advisor-api-key" type={visible ? 'text' : 'password'} value={apiKey} autoComplete="new-password" spellCheck={false} maxLength={8192} placeholder={saved ? '已保存，留空沿用' : separate ? '填写此地址的独立 API Key' : '留空跟随主模型'} onChange={event => onApiKeyChange(event.target.value)} /><button type="button" className="model-icon-button" aria-label={visible ? '隐藏顾问密钥' : '显示顾问密钥'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
      <div className="model-field"><div className="model-field-heading"><label>顾问模型列表</label><div className="model-actions"><button type="button" className="model-small-button" onClick={onFetch}>{working === 'advisor-models' ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />}获取顾问模型列表</button><button type="button" className="model-small-button" aria-expanded={manualOpen} onClick={() => setManualOpen(!manualOpen)}><Plus size={15} />手动添加顾问模型</button></div></div>
        {manualOpen && <div className="model-inline-add"><input autoFocus aria-label="手动添加顾问模型 ID" value={manual} placeholder="填写服务实际支持的模型 ID" onChange={event => { setManual(event.target.value); setError(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} /><button type="button" className="model-small-button" onClick={add}>添加</button><button type="button" className="model-icon-button" aria-label="取消添加顾问模型" onClick={() => setManualOpen(false)}><X size={17} /></button></div>}
        {error && <p role="alert">{error}</p>}
        <div className="model-list" aria-label="已添加的顾问模型">{models.map(model => <span className="model-chip" key={model}>{model}<button type="button" aria-label={'移除顾问模型 ' + model} disabled={model === form.advisorModel} onClick={() => update({ advisorModels: models.filter(item => item !== model) })}><X size={13} /></button></span>)}</div>
      </div>
      <div className="model-field"><label htmlFor="model-advisor">顾问模型</label><div className="model-and-effort"><select id="model-advisor" value={form.advisorModel || ''} onChange={event => update({ advisorModel: event.target.value })}><option value="">请选择顾问模型</option>{models.map(model => <option key={model} value={model}>{model}</option>)}</select><EffortPicker label="顾问推理强度" value={form.advisorReasoningEffort || ''} onChange={value => update({ advisorReasoningEffort: value })} /></div></div>
    </section>
  </>;
}
