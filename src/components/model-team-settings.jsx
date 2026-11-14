import React, { useState } from 'react';
import { Check, Download, Eye, EyeOff, LoaderCircle, Plus, Save, X } from 'lucide-react';

export function ModelTeamSettings({ form, connection, update, apiKey, onApiKeyChange, onSave, saveDisabled, onFetch, working, EffortPicker, section = 'all' }) {
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
    {section !== 'advisor' && <section className="model-team-roles" aria-label="模型职责分工">
      <h2>模型分工</h2>
      <dl><div><dt>所选模式</dt><dd>整合方案、修改文件、执行命令、验证和交付；运行中切换模式可接续同一任务。</dd></div><div><dt>三个模型</dt><dd>独立提案、交叉评议；其余两个模型监督各自片段，连续偏移时可接手纠偏。</dd></div><div><dt>访问策略</dt><dd>三者使用同一当前权限策略；相同的运行中子任务合并，不设固定并发上限。</dd></div></dl>
      <details className="model-config-details"><summary>评议与核验规则</summary><p className="model-field-hint">按正确性25%、证据20%、任务适配20%、约束遵循15%、可验证性10%、风险10%计算中位分；低于60分或约束低于5/10淘汰。领先至少10分且总分不低于70时采用该方案，否则按得分分配份额。模型三在计划、重复错误和完成前核验；讨论失败时由所选模式依据证据继续。模型能力和价格以服务公布为准。</p></details>
    </section>}
    {section !== 'general' && <section className="model-subagent-section" aria-label="模型三服务配置">
      <div className="model-subagent-heading"><div><h2>模型三服务</h2><p>独立讨论与结果核验，可配置独立服务和密钥。</p></div><span className={saved ? 'model-key-state' : 'model-subagent-fallback'}>{saved ? <><Check size={13} />已配置模型三凭据</> : separate ? '不同地址需要独立凭据' : '同地址可跟随模型一凭据'}</span></div>
      <div className="model-field"><label><input id="model-advisor-enabled" type="checkbox" checked={Boolean(form.advisorEnabled)} onChange={event => update({ advisorEnabled: event.target.checked })} />启用三模型独立讨论</label><p className="model-field-hint">开启后，每项任务由三个模型分别提出方案并交叉评分。所选模式负责整合和执行，其余两个模型监督。提案和评议阶段不附工具；执行阶段仍遵循当前访问策略，重复偏移时由对应模型接手。失败时不生成份额，由所选模式依据实际证据继续。模型推理档位按各服务支持协议适配一次，已保存设置不变。</p></div>
      <div className="model-field"><label htmlFor="model-advisor-base-url">模型三 API 请求地址</label><input id="model-advisor-base-url" type="url" required value={form.advisorBaseUrl || form.baseUrl} spellCheck={false} onChange={event => update({ advisorBaseUrl: event.target.value })} /></div>
      <div className="model-field"><label htmlFor="model-advisor-api-key">模型三 API Key{saved && <span className="model-key-state"><Check size={13} />已配置</span>}</label><div className="model-key-input"><input id="model-advisor-api-key" type={visible ? 'text' : 'password'} value={apiKey} autoComplete="new-password" spellCheck={false} maxLength={8192} placeholder={saved ? '已保存，留空沿用' : separate ? '填写此地址的独立 API Key' : '留空跟随模型一'} onChange={event => onApiKeyChange(event.target.value)} /><button type="button" className="model-icon-button" aria-label={visible ? '隐藏模型三密钥' : '显示模型三密钥'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button><button type="button" className="model-small-button model-role-save" disabled={saveDisabled} onClick={onSave}><Save size={15} />保存模型三</button></div></div>
      <div className="model-field"><div className="model-field-heading"><label>模型三列表</label><div className="model-actions"><button type="button" className="model-small-button" onClick={onFetch}>{working === 'advisor-models' ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />}获取模型三列表</button><button type="button" className="model-small-button" aria-expanded={manualOpen} onClick={() => setManualOpen(!manualOpen)}><Plus size={15} />手动添加模型三</button></div></div>
        {manualOpen && <div className="model-inline-add"><input autoFocus aria-label="手动添加模型三 ID" value={manual} placeholder="填写服务实际支持的模型 ID" onChange={event => { setManual(event.target.value); setError(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} /><button type="button" className="model-small-button" onClick={add}>添加</button><button type="button" className="model-icon-button" aria-label="取消添加模型三" onClick={() => setManualOpen(false)}><X size={17} /></button></div>}
        {error && <p role="alert">{error}</p>}
        <div className="model-list" aria-label="已添加的模型三">{models.map(model => <span className="model-chip" key={model}>{model}<button type="button" aria-label={'移除模型三 ' + model} disabled={model === form.advisorModel} onClick={() => update({ advisorModels: models.filter(item => item !== model) })}><X size={13} /></button></span>)}</div>
      </div>
      <div className="model-field"><label htmlFor="model-advisor">模型三</label><div className="model-and-effort"><select id="model-advisor" value={form.advisorModel || ''} onChange={event => update({ advisorModel: event.target.value })}><option value="">请选择模型三</option>{models.map(model => <option key={model} value={model}>{model}</option>)}</select><EffortPicker label="模型三推理强度" value={form.advisorReasoningEffort || ''} onChange={value => update({ advisorReasoningEffort: value })} /></div></div>
      <details className="model-config-details"><summary>执行通道与上下文</summary>
      <div className="model-field"><label htmlFor="model-advisor-tool-protocol">模型三任务执行通道</label><select id="model-advisor-tool-protocol" value={form.advisorToolProtocol || ''} onChange={event => update({ advisorToolProtocol: event.target.value })}><option value="">跟随模型一</option><option value="auto">自动适配（推荐）</option><option value="native">原生工具调用</option><option value="json">兼容 JSON</option></select><p className="model-field-hint">模型三的接手执行请求按此服务协议发送；自动适配、原生调用和兼容 JSON 使用同一完整访问策略。</p></div>
      <div className="model-field"><label htmlFor="model-advisor-context-window">模型三上下文窗口（tokens）</label><input id="model-advisor-context-window" type="number" min="1" step="1" placeholder="留空按服务反馈自动压缩" value={form.advisorContextWindowTokens || ''} onChange={event => update({ advisorContextWindowTokens: Number(event.target.value) || 0 })} /><p className="model-field-hint">填写模型三服务公布的实际容量；留空时服务报错后动态压缩重试。</p></div>
      </details>
    </section>}
  </>;
}
