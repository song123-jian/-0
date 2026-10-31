import React, { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, Monitor, Plus, RefreshCw, Search, Settings2, X } from 'lucide-react';

export function IntegrationSwitch({ label, checked, onChange, disabled = false }) {
  return <button type="button" className={'settings-switch ' + (checked ? 'checked' : '')} role="switch" aria-label={label} aria-checked={Boolean(checked)} disabled={disabled} onClick={() => onChange(!checked)}><span /></button>;
}

function Row({ label, description, children }) {
  return <div className="settings-row"><div className="settings-row-copy"><strong>{label}</strong>{description && <p>{description}</p>}</div><div className="settings-row-control">{children}</div></div>;
}

function Group({ title, children, actions }) {
  return <section className="settings-section"><div className="integration-section-heading"><h2>{title}</h2>{actions}</div><div className="settings-row-group">{children}</div></section>;
}

function Segments({ label, value, options, onChange }) {
  return <div className="integration-segments" role="group" aria-label={label}>{options.map(([id, text]) => <button key={id} type="button" aria-pressed={value === id} className={value === id ? 'selected' : ''} onClick={() => onChange(id)}>{text}</button>)}</div>;
}

function useAction() {
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const run = async (operation) => {
    setError(''); setWorking(true);
    try { return await operation(); }
    catch (caught) { setError(String(caught.message || caught).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')); return null; }
    finally { setWorking(false); }
  };
  return { error, working, run };
}

export function PluginSettings({ preferences, skills = [], onPreference, onRefreshSkills }) {
  const [query, setQuery] = useState('');
  const action = useAction();
  const disabled = preferences.disabledSkillIds || [];
  const directories = preferences.skillDirectories || [];
  const filtered = skills.filter((skill) => `${skill.name} ${skill.description}`.toLowerCase().includes(query.toLowerCase()));
  const save = async (update) => { const saved = await onPreference(update); if (!saved) throw new Error('保存失败，请重试。'); return saved; };
  const addDirectory = () => action.run(async () => {
    const directory = await window.scodex.chooseSkillDirectory();
    if (!directory) return;
    await save({ skillDirectories: [...new Set([...directories, directory])] });
    await onRefreshSkills();
  });
  return <div className="integration-settings plugin-settings">
    <div className="integration-toolbar"><div /><div className="integration-actions"><button className="secondary-button" disabled={action.working} onClick={() => action.run(() => window.scodex.openSkillDirectory())}>浏览目录</button><button className="primary-button" disabled={action.working || directories.length >= 20} onClick={addDirectory}><Plus size={15} />添加技能目录</button></div></div>
    <div className="integration-toolbar"><div className="integration-auto-note"><BookOpen size={17} /><span><strong>AI 自动调用 SKILL</strong><small>根据你的需求匹配本机技能指引，不在聊天中显示手动选择器。</small></span></div><label className="integration-search"><Search size={16} /><input aria-label="搜索已安装技能" placeholder="搜索技能" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
    {action.error && <p className="integration-error" role="alert">{action.error}</p>}
    <div className="integration-toolbar plugin-master"><div><strong>允许 AI 使用本地技能</strong><p>启用后由 AI 根据需求自动匹配 SKILL.md，不需要手动选择。</p></div><IntegrationSwitch label="允许 AI 自动调用 SKILL" checked={preferences.skillsEnabled} onChange={(checked) => action.run(() => save({ skillsEnabled: checked }))} /></div>
    <div className="plugin-skill-list">{filtered.map((skill) => <div className="plugin-skill-row" key={skill.id}><span className="plugin-skill-icon"><BookOpen size={18} /></span><div><strong>{skill.name}</strong><p title={skill.description}>{skill.description || '本地技能指引'}</p></div><span className="plugin-skill-source">{skill.id.startsWith('custom:') ? '自选目录' : skill.source.startsWith('skills/') ? '个人' : '插件'}</span><IntegrationSwitch label={`允许 AI 调用 ${skill.name}`} checked={!disabled.includes(skill.id)} disabled={!preferences.skillsEnabled || action.working} onChange={(checked) => action.run(() => save({ disabledSkillIds: checked ? disabled.filter((id) => id !== skill.id) : [...disabled, skill.id] }))} /></div>)}</div>
    {!filtered.length && <p className="integration-empty">{skills.length ? '没有匹配的技能' : '未找到可读取的 SKILL.md，可添加本地技能目录。'}</p>}
    <div className="integration-actions"><button className="secondary-button" disabled={action.working} onClick={() => action.run(onRefreshSkills)}><RefreshCw size={15} />重新读取</button></div>
    {directories.length > 0 && <Group title="自选技能目录">{directories.map((directory) => <Row key={directory} label={directory} description="从该目录读取 SKILL.md；移除不会删除本地文件。"><button className="icon-button" aria-label={`移除目录 ${directory}`} disabled={action.working} onClick={() => action.run(async () => { await save({ skillDirectories: directories.filter((item) => item !== directory) }); await onRefreshSkills(); })}><X size={16} /></button></Row>)}</Group>}
    <p className="settings-footnote">技能内容会在 AI 判断当前需求需要时提交给模型；聊天工具栏不再提供手动技能选择器。</p>
  </div>;
}

export function ComputerSettings({ preferences, desktopApps = [], onPreference }) {
  const action = useAction();
  const allowed = preferences.computerAllowedApps || [];
  return <div className="integration-settings">
    <Group title="控制">
      <Row label="桌面应用" description="允许从工作台启动下方已授权的本机应用。"><IntegrationSwitch label="允许打开桌面应用" checked={preferences.computerControlEnabled} onChange={(checked) => onPreference({ computerControlEnabled: checked })} /></Row>
      {desktopApps.map((application) => <Row key={application.id} label={application.name} description={application.installed ? `${application.id === 'excel' ? '已检测到应用' : '已检测到浏览器；自动化扩展未接入'}` : '未检测到应用'}><div className="integration-actions">{application.installed && <button className="secondary-button" disabled={!preferences.computerControlEnabled || !allowed.includes(application.id) || action.working} onClick={() => action.run(() => window.scodex.openDesktopApp(application.id))}>打开</button>}{application.installed && application.id !== 'excel' && <button className="icon-button" aria-label={`管理 ${application.name} 扩展`} title="管理扩展" disabled={!preferences.computerControlEnabled || !allowed.includes(application.id) || action.working} onClick={() => action.run(() => window.scodex.openDesktopApp(application.id, 'extensions'))}><Settings2 size={16} /></button>}<IntegrationSwitch label={`允许打开 ${application.name}`} checked={allowed.includes(application.id)} disabled={!preferences.computerControlEnabled || !application.installed} onChange={(checked) => onPreference({ computerAllowedApps: checked ? [...allowed, application.id] : allowed.filter((id) => id !== application.id) })} /></div></Row>)}
    </Group>
    {action.error && <p className="integration-error" role="alert">{action.error}</p>}
    <Group title="始终允许的应用">{allowed.length ? desktopApps.filter((item) => allowed.includes(item.id)).map((item) => <Row key={item.id} label={item.name} description="保留启动授权，可通过上方开关撤销。"><Monitor size={18} /></Row>) : <Row label="尚未授权应用" description="启用桌面应用后，可逐个允许打开。" />}</Group>
    <p className="settings-footnote">当前支持按按钮启动应用和打开扩展管理页；鼠标键盘自动操控、浏览器自动化扩展和 Excel 加载项尚未接入。</p>
  </div>;
}

export function BrowserSettings({ preferences, onPreference }) {
  const action = useAction();
  const [history, setHistory] = useState(null);
  const [ruleHost, setRuleHost] = useState('');
  const [feedback, setFeedback] = useState('');
  useEffect(() => window.scodex.onBrowserDownloadError((message) => setFeedback(message)), []);
  const rules = preferences.browserSiteRules || [];
  const save = async (update) => {
    const saved = await onPreference(update);
    if (!saved) throw new Error('保存失败，请重试。');
    return saved;
  };
  const updateRule = (host, update) => action.run(() => save({ browserSiteRules: rules.map((rule) => rule.host === host ? { ...rule, ...update } : rule) }));
  const addRule = () => action.run(async () => {
    let url;
    try { url = new URL(ruleHost.includes('://') ? ruleHost : `https://${ruleHost}`); } catch { throw new Error('请输入有效的网站地址。'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname) throw new Error('请输入 HTTP 或 HTTPS 网站地址。');
    const host = url.hostname.toLowerCase();
    if (rules.some((rule) => rule.host === host)) throw new Error('该网站已经添加。');
    if (rules.length >= 200) throw new Error('最多保存 200 个网站规则。');
    await save({ browserSiteRules: [...rules, { host, browse: 'allow', download: 'allow', camera: false, microphone: false }] });
    setRuleHost('');
  });
  return <div className="integration-settings">
    <Group><Row label="浏览器" description="显示内置标签工作台，网页与本地文件和模型接口隔离。"><IntegrationSwitch label="启用内置浏览器" checked={preferences.browserPanelOpen} onChange={(checked) => onPreference({ browserPanelOpen: checked })} /></Row></Group>
    <Group title="AI 网页操作"><Row label="允许 AI 使用内置浏览器" description="执行任务时可搜索、读取网页并经审批操作；使用独立临时会话，与手工页面的登录信息分开。"><IntegrationSwitch label="允许 AI 使用内置浏览器" checked={preferences.browserAiEnabled} onChange={(checked) => onPreference({ browserAiEnabled: checked })} /></Row><Row label="操作范围" description="每次导航、读取、点击、填入、按键、滚动及截图均需审批；规划不开放写交互。截图以图片发给所选模型，需支持视觉；密码、上传和下载需手动处理。"><span className="settings-value">按次授权</span></Row><Row label="临时会话" description="仅当前项目和对话可由 AI 操作；切换项目、关闭 AI 浏览器或完整退出会清理。托盘隐藏保留页面。"><span className="settings-value">项目隔离</span></Row></Group>
    <Group title="常规">
      <Row label="网页 URL 和链接打开位置" description="控制网页新窗口链接；地址栏输入始终在内置浏览器打开。"><select aria-label="网页链接打开位置" value={preferences.browserLinkOpenTarget || 'builtin'} onChange={(event) => onPreference({ browserLinkOpenTarget: event.target.value })}><option value="system">默认浏览器</option><option value="builtin">Scodex</option></select></Row>
      <Row label="本地 URL 打开位置" description="localhost 和回环地址的新窗口链接。"><select aria-label="本地 URL 打开位置" value={preferences.browserLocalUrlTarget || 'builtin'} onChange={(event) => onPreference({ browserLocalUrlTarget: event.target.value })}><option value="builtin">Scodex</option><option value="system">默认浏览器</option></select></Row>
      <Row label="显示完整网址" description="在地址栏中显示路径、查询参数和片段。"><IntegrationSwitch label="显示完整网址" checked={preferences.browserShowFullUrl !== false} onChange={(checked) => onPreference({ browserShowFullUrl: checked })} /></Row>
      <Row label="浏览数据" description="清除内置浏览器的网站数据、缓存和本次浏览历史；会退出网站登录。"><button className="secondary-button" disabled={action.working} onClick={() => { if (window.confirm('清除内置浏览器的网站数据和缓存？此操作会退出网站登录。')) action.run(async () => { await window.scodex.browserAction({ type: 'clear-data' }); setHistory([]); setFeedback('浏览数据已清除'); }); }}>清除浏览数据</button></Row>
      <Row label="浏览历史" description="查看本次启动期间访问的页面，最多 500 条；重启后不保留。"><button className="secondary-button" disabled={action.working} onClick={() => action.run(async () => setHistory(await window.scodex.getBrowserHistory()))}>管理</button></Row>
      <Row label="批注截图" description="当前没有网页截图批注功能。"><span className="settings-value">未接入</span></Row>
    </Group>
    {history && <Group title="本次浏览历史">{history.length ? history.slice(0, 50).map((item, index) => <Row key={index} label={item.title || new URL(item.url).hostname} description={item.url}><button className="icon-button" aria-label={`重新打开 ${item.title}`} onClick={() => action.run(() => window.scodex.browserAction({ type: 'new', url: item.url }))}><ExternalLink size={16} /></button></Row>) : <Row label="暂无浏览记录" />}</Group>}
    <Group title="自动填充和密码"><Row label="密码管理器" description="当前没有保存密码的管理功能。"><span className="settings-value">未接入</span></Row><Row label="联系信息" description="当前没有地址、电话和电子邮件自动填充。"><span className="settings-value">未接入</span></Row></Group>
    <Group title="扩展程序"><Row label="扩展程序管理器" description="当前内置浏览器没有加载第三方扩展。"><span className="settings-value">未接入</span></Row></Group>
    <Group title="下载">
      <Row label="位置" description={preferences.browserDownloadDirectory || '系统下载文件夹'}><button className="secondary-button" disabled={action.working} onClick={() => action.run(async () => { const directory = await window.scodex.chooseBrowserDownloadDirectory(); if (directory) await onPreference({ browserDownloadDirectory: directory }); })}>更改</button></Row>
      <Row label="下载前询问保存位置" description="启用时每次下载使用系统保存对话框；关闭后保存到上述目录。"><IntegrationSwitch label="下载前询问保存位置" checked={preferences.browserAskBeforeDownload !== false} onChange={(checked) => onPreference({ browserAskBeforeDownload: checked })} /></Row>
      <Row label="下载历史记录" description="当前不会保存下载历史。"><span className="settings-value">未接入</span></Row>
    </Group>
    <Group title="浏览器权限"><Row label="网站设置" description="下方可为具体网站配置浏览、下载、摄像头和麦克风权限。" /><Row label="历史记录" description="浏览历史仅在用户点击“管理”时显示；AI 只读取自身标签，并单独请求审批。"><span className="settings-value">仅手动查看</span></Row><Row label="默认使用网站工具" description="当前聊天引擎没有调用 WebMCP 网站工具。"><span className="settings-value">未接入</span></Row></Group>
    <Group title="网站权限">
      <form className="integration-site-form" onSubmit={(event) => { event.preventDefault(); addRule(); }}><input aria-label="网站或主机名" placeholder="example.com 或 localhost" value={ruleHost} onChange={(event) => setRuleHost(event.target.value)} /><button className="secondary-button" disabled={action.working || !ruleHost.trim()}><Plus size={15} />添加</button></form>
      <div className="integration-site-table"><div className="integration-site-head"><strong>网站或模式</strong><span>浏览</span><span>下载</span><span>设备权限</span></div><div className="integration-site-row"><strong>默认</strong><span>允许</span><span>允许</span><span>禁止</span></div>{rules.map((rule) => <div className="integration-site-row" key={rule.host}><strong>{rule.host}<button className="icon-button small" aria-label={`移除网站 ${rule.host}`} disabled={action.working} onClick={() => action.run(() => save({ browserSiteRules: rules.filter((item) => item.host !== rule.host) }))}><X size={14} /></button></strong>{[['browse', '浏览'], ['download', '下载']].map(([key, label]) => <select key={key} aria-label={`${rule.host} ${label}权限`} value={rule[key]} disabled={action.working} onChange={(event) => updateRule(rule.host, { [key]: event.target.value })}><option value="allow">允许</option><option value="block">禁止</option></select>)}<span className="integration-device-controls"><label><input type="checkbox" aria-label={`${rule.host} 摄像头`} checked={rule.camera} disabled={action.working} onChange={(event) => updateRule(rule.host, { camera: event.target.checked })} />摄像头</label><label><input type="checkbox" aria-label={`${rule.host} 麦克风`} checked={rule.microphone} disabled={action.working} onChange={(event) => updateRule(rule.host, { microphone: event.target.checked })} />麦克风</label></span></div>)}</div>
    </Group>
    <Group title="开发者模式"><Row label="启用完整 CDP 访问权限" description="当前不向模型暴露内置浏览器 CDP 调试接口。"><span className="settings-value">未接入</span></Row></Group>
    {action.error && <p className="integration-error" role="alert">{action.error}</p>}{feedback && <p role="status">{feedback}</p>}
  </div>;
}

export function GitSettings({ preferences, onPreference }) {
  const [prefix, setPrefix] = useState(preferences.gitBranchPrefix ?? 'scodex/');
  const [commit, setCommit] = useState(preferences.gitCommitInstructions || '');
  const [pullRequest, setPullRequest] = useState(preferences.gitPullRequestInstructions || '');
  const [error, setError] = useState('');
  const persist = async (update) => {
    const saved = await onPreference(update);
    if (!saved) { setError('保存失败，请重试。'); return false; }
    setError(''); return true;
  };
  const savePrefix = async () => {
    const value = prefix.trim();
    if (value && (/[\s~^:?*\[\\\x00-\x1f\x7f]/.test(value) || value.includes('..') || value.includes('@{') || value.startsWith('/') || value.startsWith('-') || value.includes('//') || value.split('/').some((part) => part.startsWith('.') || part.endsWith('.lock')) || value.endsWith('.'))) {
      setError('请输入有效的 Git 分支前缀，例如 scodex/。'); return;
    }
    await persist({ gitBranchPrefix: value });
  };
  const saveCommit = () => persist({ gitCommitInstructions: commit });
  const savePullRequest = () => persist({ gitPullRequestInstructions: pullRequest });
  return <div className="integration-settings git-settings">
    <Group>
      <Row label="分支前缀" description="Scodex 提议创建新分支时使用的前缀。"><input className="integration-prefix" aria-label="分支前缀" maxLength={80} value={prefix} onChange={(event) => setPrefix(event.target.value)} onBlur={savePrefix} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></Row>
      <Row label="Pull Request 合并方法" description="生成合并建议时使用的默认方式。"><Segments label="Pull Request 合并方法" value={preferences.gitMergeMethod || 'merge'} options={[[ 'merge', '合并' ], [ 'squash', '压缩合并' ]]} onChange={(value) => persist({ gitMergeMethod: value })} /></Row>
      <Row label="始终强制推送" description="生成推送命令时使用 --force-with-lease。"><IntegrationSwitch label="始终强制推送" checked={preferences.gitForcePush} onChange={(checked) => persist({ gitForcePush: checked })} /></Row>
      <Row label="创建草稿 Pull Request" description="生成 PR 创建命令时默认使用草稿。"><IntegrationSwitch label="创建草稿 Pull Request" checked={preferences.gitDraftPullRequest !== false} onChange={(checked) => persist({ gitDraftPullRequest: checked })} /></Row>
      <Row label="审查结果呈现方式" description="选择审查建议的排版偏好。"><Segments label="审查结果呈现方式" value={preferences.gitReviewResultMode || 'inline'} options={[[ 'inline', '内联' ], [ 'separate', '单独' ]]} onChange={(value) => persist({ gitReviewResultMode: value })} /></Row>
    </Group>
    {error && <p className="integration-error" role="alert">{error}</p>}
    <section className="integration-instructions"><label htmlFor="git-commit-instructions">提交指令</label><p>将添加到提交信息生成提示中</p><textarea id="git-commit-instructions" aria-label="提交指令" placeholder="添加提交信息指引…" maxLength={8000} value={commit} onChange={(event) => { setCommit(event.target.value); persist({ gitCommitInstructions: event.target.value }); }} onBlur={saveCommit} /></section>
    <section className="integration-instructions"><label htmlFor="git-pr-instructions">Pull Request 指令</label><p>将添加到 PR 标题/描述生成提示中</p><textarea id="git-pr-instructions" aria-label="Pull Request 指令" placeholder="添加 Pull Request 指引…" maxLength={8000} value={pullRequest} onChange={(event) => { setPullRequest(event.target.value); persist({ gitPullRequestInstructions: event.target.value }); }} onBlur={savePullRequest} /></section>
    <p className="settings-footnote">分支前缀在离开输入框时校验保存，其余选项和指令自动保存，并用于 Git 任务的模型指引。左侧“版本控制”可查看差异、暂存、创建本地提交和分支，隔离工作树可作为项目打开。远端推送、PR 创建／合并和独立审查聊天仍需明确执行。</p>
  </div>;
}
