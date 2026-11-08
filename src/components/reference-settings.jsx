import React, { useState } from 'react';

const labels = { browserCdpEnabled: '完整网页调试访问', browserApprovalMode: '浏览器操作审批', browserAskBeforeDownload: '下载前询问', browserAiEnabled: 'AI 网页操作', computerControlEnabled: '电脑操控', computerAccentColor: '操控提示颜色', computerLocale: '操控提示语言', codexReferenceDirectory: '技能来源目录', approvalPolicy: '审批策略', sandboxMode: '文件访问范围', webSearch: '网页搜索', outputDetail: '回复详细程度', reasoningSummary: '推理摘要', defaultReasoningEffort: '默认推理强度', availableReasoningEfforts: '可用推理强度' };
const choices = { true: '开启', false: '关闭', never_ask: '遵循项目权限，不额外询问', always_ask: '每次询问', never: '从不询问', 'on-request': '按需询问', 'danger-full-access': '完整访问', 'workspace-write': '工作区写入', 'read-only': '只读', live: '实时搜索', cached: '缓存搜索', indexed: '索引搜索', disabled: '停用', low: '低', medium: '中', high: '高', xhigh: '很高', max: '最大', ultra: '最高', auto: '自动', concise: '简洁', detailed: '详细', none: '关闭', 'zh-CN': '简体中文', 'en-US': 'English' };
const display = value => Array.isArray(value) ? value.map(item => choices[String(item)] || String(item)).join('、') : choices[String(value)] || String(value);

export function ReferenceSettings({ category, preferences, onPreference, onAgentSetting, onRefreshSkills, busy }) {
  const [root, setRoot] = useState(preferences.codexReferenceDirectory || 'E:\\GDP\\.codex');
  const [snapshot, setSnapshot] = useState(null);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState('');
  const run = async operation => { setWorking(true); setFeedback(''); try { await operation(); } catch (error) { setFeedback(String(error.message || error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')); } finally { setWorking(false); } };
  const read = async () => { const result = await window.scodex.readReferenceSettings(root); setSnapshot(result); setRoot(result.root); return result; };
  const apply = () => run(async () => {
    const result = await read(); const values = result.categories[category];
    if (!values || !Object.keys(values).length) throw Error('参考目录没有此项的兼容配置。');
    if (category === 'agent') { if (!await onAgentSetting(values, 'workspace')) throw Error('配置保存失败。'); }
    else if (!await onPreference(values)) throw Error('设置保存失败。');
    if (category === 'skills') await onRefreshSkills();
    setFeedback('已应用参考配置；原目录保持只读。');
  });
  return <section className="settings-section reference-settings" aria-label="Codex 参考配置">
    <h2>Codex 参考配置</h2><p>读取本机 .codex 中此项的兼容设置；不会导入密钥或聊天记录。</p>
    <label>参考目录<input aria-label="Codex 参考目录" value={root} onChange={event => { setRoot(event.target.value); setSnapshot(null); }} disabled={working} /></label>
    <div className="integration-actions"><button type="button" className="secondary-button" disabled={working} onClick={() => run(read)}>读取参考配置</button><button type="button" className="primary-button" disabled={working || busy} onClick={apply}>应用此项配置</button></div>
    {snapshot && <><dl>{Object.entries(snapshot.categories[category] || {}).map(([key, value]) => <React.Fragment key={key}><dt>{labels[key] || key}</dt><dd>{display(value)}</dd></React.Fragment>)}</dl>{!Object.keys(snapshot.categories[category] || {}).length && <p>此目录没有当前分类的兼容配置。</p>}</>}
    {feedback && <p role="status">{feedback}</p>}
  </section>;
}
