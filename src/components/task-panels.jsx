import { McpConnections } from './mcp-connections.jsx';
import { PluginMarketplace, ManagedPluginActions } from './plugin-marketplace.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BookOpen, CalendarClock, Check, ChevronDown, ChevronRight, Clock3, ExternalLink,
  Files, FolderOpen, LoaderCircle, Paperclip, Pause, Pencil, Play, Plus, Puzzle, RefreshCw, Search,
  Settings, Sparkles, Trash2, X,
} from 'lucide-react';

const FREQUENCIES = [
  ['once', '仅一次'], ['daily', '每天'], ['weekdays', '工作日'], ['weekly', '每周'], ['monthly', '每月'],
];
const TIMEZONES = ['Asia/Shanghai', 'Asia/Tokyo', 'UTC', 'America/Los_Angeles', 'Europe/London'];
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const CATEGORY_LABELS = { all: '全部', workspace: 'Scodex', personal: '个人', system: '系统' };

function frequencyLabel(task) {
  const label = FREQUENCIES.find(([id]) => id === task.frequency)?.[1] || '每天';
  if (task.frequency === 'weekly') return `每周${WEEKDAYS[task.weekday]}`;
  if (task.frequency === 'monthly') return `每月 ${task.monthDay} 日`;
  if (task.frequency === 'once') return `仅一次 · ${task.date}`;
  return label;
}

function displayNextRun(task) {
  if (!task.nextRunAt) return task.enabled ? '等待下次执行' : '已停用';
  try { return new Intl.DateTimeFormat('zh-CN', { timeZone: task.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(task.nextRunAt)); }
  catch { return task.nextRunAt; }
}

function defaultDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function taskAttachmentSize(size) {
  if (!Number.isFinite(size)) return '';
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function TaskEditor({ task, onClose, onSave, projects, activeProjectId }) {
  const availableProjects = projects.filter((project) => !project.archivedAt);
  const defaultProjectId = activeProjectId || availableProjects[0]?.id || '';
  const [form, setForm] = useState(() => task ? { ...task } : {
    name: '', prompt: '', projectId: defaultProjectId, attachments: [], frequency: 'daily', time: '09:00', timezone: 'Asia/Shanghai',
    date: defaultDate(), weekday: 1, monthDay: 1, enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [choosingAttachments, setChoosingAttachments] = useState(false);
  const [error, setError] = useState('');
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const chooseAttachments = async () => {
    setChoosingAttachments(true);
    setError('');
    try {
      const chosen = await window.scodex.chooseScheduledTaskAttachments();
      const merged = [...(form.attachments || [])];
      const seen = new Set(merged.map((item) => item.path.toLowerCase()));
      for (const item of chosen || []) if (!seen.has(item.path.toLowerCase())) { merged.push(item); seen.add(item.path.toLowerCase()); }
      if (merged.length > 10) throw new Error('每项定时任务最多附加 10 个文件。');
      change('attachments', merged);
    } catch (chooseError) { setError(chooseError.message || '添加附件失败。'); }
    finally { setChoosingAttachments(false); }
  };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try { await onSave(form, task?.id); onClose(); }
    catch (saveError) { setError(saveError.message || '保存失败。'); }
    finally { setSaving(false); }
  };
  return <div className="modal-backdrop task-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="task-editor" role="dialog" aria-modal="true" aria-labelledby="task-editor-title" onSubmit={submit}>
      <div className="task-editor-heading"><h2 id="task-editor-title">{task ? '编辑定时任务' : '设置定时任务'}</h2><button className="icon-button" type="button" title="关闭" aria-label="关闭" onClick={onClose}><X size={17} /></button></div>
      <div className="task-editor-body">
      <label className="task-field task-prompt-field"><span>任务说明</span><textarea autoFocus required maxLength={16000} value={form.prompt} onChange={(event) => change('prompt', event.target.value)} placeholder="说明要定期完成的工作，例如：整理项目进度并列出下一步。" /></label>
      <label className="task-field"><span>任务名称</span><input maxLength={100} value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="可留空，使用说明首行" /></label>
      <label className="task-field"><span>所属项目</span><select required value={form.projectId || defaultProjectId} onChange={(event) => change('projectId', event.target.value)}>
        {!form.projectId && !defaultProjectId && <option value="">请选择项目</option>}
        {form.projectId && !availableProjects.some((project) => project.id === form.projectId) && <option value={form.projectId} disabled>原项目不可用，请重新选择</option>}
        {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select></label>
      <div className="task-field task-attachment-field"><span>附件</span>
        <button className="secondary-button task-attachment-add" type="button" disabled={choosingAttachments || saving} onClick={chooseAttachments}>{choosingAttachments ? <LoaderCircle size={15} className="spin" /> : <Paperclip size={15} />}添加附件</button>
        {(form.attachments || []).length > 0 && <details className="task-attachment-disclosure">
          <summary aria-label={`任务附件 ${(form.attachments || []).length} 项`} title="展开或收起任务附件">
            <Paperclip size={16} aria-hidden="true" />
            <span>{form.attachments[0].name}{form.attachments.length > 1 ? ` 等 ${form.attachments.length} 项` : ''}</span>
            <small>{form.attachments.length} 项</small>
            <ChevronRight size={15} className="task-attachment-chevron" aria-hidden="true" />
          </summary>
          <div className="task-attachment-list" aria-label="任务附件详情">{form.attachments.map((item, index) => <div className="task-attachment-row" key={`${item.path}-${item.sha256}`}>
            <Files size={17} aria-hidden="true" /><span className="task-attachment-copy"><strong>{item.name}</strong><small>{taskAttachmentSize(item.size)} · {item.mimeType}</small><small className="task-attachment-path" title={item.path}>{item.path}</small></span>
            <button className="icon-button" type="button" aria-label={`移除附件 ${item.name}`} title="移除附件" onClick={() => change('attachments', form.attachments.filter((_entry, entryIndex) => entryIndex !== index))}><X size={15} /></button>
          </div>)}</div>
        </details>}
      </div>
      <div className="task-schedule-fields">
        <label className="task-field"><span>重复</span><select value={form.frequency} onChange={(event) => change('frequency', event.target.value)}>{FREQUENCIES.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
        {form.frequency === 'once' && <label className="task-field"><span>日期</span><input type="date" required value={form.date} onChange={(event) => change('date', event.target.value)} /></label>}
        {form.frequency === 'weekly' && <label className="task-field"><span>星期</span><select value={form.weekday} onChange={(event) => change('weekday', Number(event.target.value))}>{WEEKDAYS.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label>}
        {form.frequency === 'monthly' && <label className="task-field"><span>日期</span><input type="number" min="1" max="31" value={form.monthDay} onChange={(event) => change('monthDay', Number(event.target.value))} /></label>}
      </div>
      <div className="task-schedule-fields task-time-fields">
        <label className="task-field"><span>时间</span><input type="time" required value={form.time} onChange={(event) => change('time', event.target.value)} /></label>
        <label className="task-field"><span>时区</span><select value={form.timezone} onChange={(event) => change('timezone', event.target.value)}>{TIMEZONES.map((zone) => <option value={zone} key={zone}>{zone === 'Asia/Shanghai' ? '中国时间 (Asia/Shanghai)' : zone}</option>)}</select></label>
      </div>
      <details className="task-advanced"><summary>高级设置</summary><p>任务使用当前模型连接与助手工作模式执行，不会自动读取本机文件或运行系统命令。</p></details>
      {error && <div className="inline-error" role="alert"><AlertTriangle size={15} />{error}</div>}
      </div>
      <div className="task-editor-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" disabled={saving || !form.prompt.trim()}>{saving && <LoaderCircle className="spin" size={15} />}{task ? '保存' : '创建任务'}</button></div>
    </form>
  </div>;
}

function TaskRunDisclosure({ run }) {
  const [expanded, setExpanded] = useState(false);
  const label = run.status === 'running' ? '正在执行' : run.status === 'succeeded' ? '执行成功' : '执行失败';
  const date = new Date(run.startedAt);
  const validDate = Number.isFinite(date.getTime());
  const timeLabel = validDate
    ? date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    : run.startedAt;
  const fullTime = validDate ? date.toLocaleString('zh-CN') : run.startedAt;
  const output = String(run.output || '').trim();
  const compactOutput = output.replace(/\s+/g, ' ');
  const preview = compactOutput.length > 112 ? `${compactOutput.slice(0, 112)}...` : compactOutput || '等待模型返回结果。';
  const icon = run.status === 'running' ? <LoaderCircle size={16} className="spin" /> : run.status === 'succeeded' ? <Check size={16} /> : <AlertTriangle size={16} />;

  return <details className={`task-run-row ${run.status}`} data-run-id={run.id} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary className="task-run-summary" aria-label={`${label}，${fullTime}，${preview}`} title={expanded ? '收起运行详情' : '展开运行详情'}>
      <span className={`task-run-status ${run.status}`}>{icon}</span>
      <strong className="task-run-label">{label}</strong>
      <time className="task-run-time" dateTime={validDate ? date.toISOString() : undefined} title={fullTime}>{timeLabel}</time>
      <span className="task-run-preview" title={output || undefined}>{preview}</span>
      <ChevronRight size={16} className="task-run-chevron" />
    </summary>
    <div className="task-run-details"><p className="task-run-output">{output || '等待模型返回结果。'}</p></div>
  </details>;
}

export function ScheduledTasksPanel({ state, projects = [], activeProjectId = '', backgroundBusy = false, onBackground, onRefresh, onCreate, onUpdate, onRemove, onEnable, onRun }) {
  const [selectedId, setSelectedId] = useState('');
  const [editorTask, setEditorTask] = useState(undefined);
  const [runningId, setRunningId] = useState('');
  const tasks = state?.tasks || [];
  const runs = state?.runs || [];
  const background = state?.background;
  const backgroundLabel = backgroundBusy ? '正在同步后台调度'
    : background?.error ? '后台调度失败'
      : !background?.available ? '后台调度不可用'
        : !background.enabled ? '仅在程序运行期间执行'
          : background.registered ? (background.inProcess ? '窗口关闭后继续执行' : background.sessionOnly ? '后台助手已启动' : 'Windows 计划任务已登记') : '等待已启用的任务';
  useEffect(() => {
    if (!tasks.some((task) => task.id === selectedId)) setSelectedId(tasks[0]?.id || '');
  }, [tasks, selectedId]);
  const selected = tasks.find((task) => task.id === selectedId);
  const projectName = (task) => projects.find((project) => project.id === task.projectId)?.name || (task.projectId ? '所属项目不可用' : '未绑定项目');
  const selectedRuns = runs.filter((run) => run.taskId === selectedId).slice(0, 8);
  const saveTask = async (form, id) => id ? onUpdate(id, form) : onCreate(form);
  const runSelected = async () => {
    if (!selected) return;
    setRunningId(selected.id);
    try { await onRun(selected.id); }
    finally { setRunningId(''); }
  };
  return <section className="tool-view scheduled-view">
    <aside className="scheduled-sidebar">
      <div className="scheduled-sidebar-heading"><h1>定时任务</h1><button className="icon-button" title="刷新任务" aria-label="刷新任务" onClick={onRefresh}><RefreshCw size={16} /></button></div>
      <button className="scheduled-new-button" onClick={() => setEditorTask(null)}><Plus size={16} />新建任务</button>
      <div className="scheduled-list-label"><span>即将执行</span><Clock3 size={14} /></div>
      <div className="scheduled-task-list">{tasks.map((task) => <button key={task.id} className={`scheduled-task-item ${task.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(task.id)}>
        <span className={`task-status-dot ${task.enabled ? 'enabled' : ''}`} /><span className="scheduled-task-copy"><strong>{task.name}</strong><small>{displayNextRun(task)}</small><small className="scheduled-task-project">{projectName(task)}</small></span>
      </button>)}{tasks.length === 0 && <p className="scheduled-empty-list">暂无已安排的任务</p>}</div>
      <div className={`scheduled-runtime-note ${background?.error ? 'has-error' : ''}`} aria-busy={backgroundBusy}>
        <label className="scheduled-background-toggle"><span>退出后继续执行</span><input type="checkbox" role="switch" aria-label="退出后继续执行" checked={Boolean(background?.enabled)} disabled={!background?.available || backgroundBusy} onChange={(event) => onBackground(event.target.checked)} /></label>
        <div className="scheduled-background-status" role="status">{backgroundBusy ? <LoaderCircle size={15} className="spin" /> : background?.error ? <AlertTriangle size={15} /> : <Clock3 size={15} />}<span>{backgroundLabel}</span></div>
        {background?.enabled && <span>{background.inProcess ? '窗口关闭后仍在本机运行；重启电脑后请重新打开程序。' : background.sessionOnly ? '当前登录期间有效；重启电脑后请重新打开程序。' : '当前 Windows 用户需保持登录。'}</span>}
        {background?.error && <p role="alert">{background.error}</p>}
      </div>
    </aside>
    <div className="scheduled-main">
      <div className="tool-heading"><div><h1>定时任务</h1></div><div className="heading-actions"><button className="secondary-button" disabled={backgroundBusy} onClick={onRefresh}><RefreshCw size={15} />刷新</button><button className="primary-button" onClick={() => setEditorTask(null)}><Plus size={16} />新建任务</button></div></div>
      {selected ? <div className="scheduled-detail-scroll">
        <section className="scheduled-detail-heading"><div className="task-large-icon"><CalendarClock size={22} /></div><div className="scheduled-title-copy"><h2>{selected.name}</h2><p>{frequencyLabel(selected)} · {selected.time} · {selected.timezone}</p><span className="scheduled-project-label"><FolderOpen size={14} />{projectName(selected)}</span></div><span className={`task-state-label ${selected.enabled ? 'enabled' : ''}`}>{selected.enabled ? '已启用' : '已停用'}</span></section>
        <section className="scheduled-description"><h3>任务说明</h3><p>{selected.prompt}</p><div className="scheduled-next-run"><span>下次执行</span><strong>{displayNextRun(selected)}</strong></div></section>
        <div className="scheduled-detail-actions"><button className="primary-button" disabled={runningId === selected.id} onClick={runSelected}>{runningId === selected.id ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}立即运行</button><button className="secondary-button" onClick={() => setEditorTask(selected)}><Pencil size={15} />编辑</button><button className="secondary-button" onClick={() => onEnable(selected.id, !selected.enabled)}>{selected.enabled ? <Pause size={15} /> : <Play size={15} />}{selected.enabled ? '暂停' : '启用'}</button><button className="icon-button" title="删除任务" aria-label="删除任务" onClick={() => { if (window.confirm(`删除“${selected.name}”？执行记录会保留。`)) onRemove(selected.id); }}><Trash2 size={16} /></button></div>
        <section className="task-runs"><div className="task-runs-heading"><h3>运行记录</h3><span>{selectedRuns.length} 条</span></div>{selectedRuns.map((run) => <TaskRunDisclosure key={run.id} run={run} />)}{selectedRuns.length === 0 && <div className="task-runs-empty">运行记录会显示在这里。</div>}</section>
      </div> : <div className="scheduled-empty-state"><div className="task-large-icon"><CalendarClock size={24} /></div><h2>暂无定时任务</h2><button className="primary-button" onClick={() => setEditorTask(null)}><Plus size={15} />新建任务</button></div>}
    </div>
    {editorTask !== undefined && <TaskEditor task={editorTask} projects={projects} activeProjectId={activeProjectId} onClose={() => setEditorTask(undefined)} onSave={saveTask} />}
  </section>;
}

function skillCategory(skill) {
  if (skill.originScope === 'workspace' || skill.id.startsWith('workspace:')) return 'workspace';
  if (skill.originScope === 'plugin') return 'system';
  if (skill.source.startsWith('plugins/cache/') || skill.source.startsWith('marketplaces/')) return 'system';
  return 'personal';
}

function AddMenu({ onInstallSkill, onOpenConfig }) {
  const [open, setOpen] = useState(false);
  return <div className="extension-add-menu"><button className="primary-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Plus size={15} />添加<ChevronDown size={13} /></button>
    {open && <div className="extension-add-popover"><button onClick={() => { setOpen(false); onInstallSkill(); }}><BookOpen size={15} /><span><strong>安装本地 Skill</strong><small>导入一个 SKILL.md 文件</small></span></button><button onClick={() => { setOpen(false); onOpenConfig(); }}><Settings size={15} /><span><strong>配置 MCP 插件</strong><small>管理 Scodex 的 MCP 连接与工具</small></span></button></div>}
  </div>;
}

export function PluginCenterPanel({ section, skills, plugins, preferences, selectedSkill, activeSkill, onSelectSkill, onToggleSkill, onRefresh, onInstallSkill, onOpenConfig, onUseSkill, onUseMcpContext }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [scope, setScope] = useState('installed');
  const [manageSection, setManageSection] = useState(section === 'skills' ? 'skills' : 'plugins');
  useEffect(() => setManageSection(section === 'skills' ? 'skills' : 'plugins'), [section]);
  const disabledIds = preferences.disabledSkillIds || [];
  const localSkills = skills.filter((skill) => `${skill.name} ${skill.description} ${skill.source}`.toLowerCase().includes(search.toLowerCase()));
  const filteredSkills = localSkills.filter((skill) => category === 'all' || skillCategory(skill) === category);
  const filteredPlugins = plugins.filter((plugin) => `${plugin.name} ${plugin.provider}`.toLowerCase().includes(search.toLowerCase()));
  const activeLocal = manageSection === 'skills' ? filteredSkills.filter((skill) => !disabledIds.includes(skill.id)) : [];
  const currentSkill = selectedSkill && skills.find((skill) => skill.id === selectedSkill.id);
  const heading = manageSection === 'skills' ? '技能' : '插件';
  const openMcp = () => { setManageSection('plugins'); setScope('mcp'); };
  return <section className="tool-view extension-center">
    <aside className="extension-sidebar"><div className="extension-sidebar-title"><span>自定义</span><Search size={15} /></div>
      <button className={manageSection === 'plugins' ? 'active' : ''} onClick={() => { setManageSection('plugins'); setSearch(''); }}><Puzzle size={16} />插件</button>
      <button className={manageSection === 'skills' ? 'active' : ''} onClick={() => { setManageSection('skills'); setSearch(''); }}><BookOpen size={16} />技能<span className="extension-count">{activeLocal.length || skills.filter((skill) => !disabledIds.includes(skill.id)).length}</span></button>
      <div className="extension-sidebar-divider" />
      <h3>已安装</h3>
      {manageSection === 'plugins' ? <p>{plugins.length ? `${plugins.length} 个本地插件包` : '未安装任何插件'}</p> : <p>{skills.length ? `${skills.filter((skill) => !disabledIds.includes(skill.id)).length} 项技能可用` : '未找到本地技能'}</p>}
      {manageSection === 'plugins' && <><div className="extension-sidebar-divider" /><h3>插件目录</h3><p>从 Scodex 与本机 .codex 只读发现</p></>}
    </aside>
    <main className="extension-main">
      <div className="extension-heading"><div><h1>{heading}</h1><p>{manageSection === 'plugins' ? '管理本机已安装插件包与 MCP 配置' : '通过任务专用技能扩展 Scodex'}</p></div>
        <div className="extension-toolbar"><label className="extension-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`搜索${heading}`} aria-label={`搜索${heading}`} /></label><button className="icon-button" title="重新读取本地能力" aria-label="重新读取本地能力" onClick={onRefresh}><RefreshCw size={16} /></button><button className="icon-button" title="打开 MCP 插件配置" aria-label="打开 MCP 插件配置" onClick={openMcp}><Settings size={16} /></button>{manageSection === 'skills' && <button className="primary-button" onClick={onInstallSkill}><Plus size={15} />添加技能</button>}{manageSection === 'plugins' && <AddMenu onInstallSkill={onInstallSkill} onOpenConfig={openMcp} />}</div>
      </div>
      {manageSection === 'plugins' ? <>
        <div className="extension-segment" role="tablist" aria-label="插件范围"><button className={scope === 'installed' ? 'selected' : ''} onClick={() => setScope('installed')} role="tab" aria-selected={scope === 'installed'}>已安装</button><button className={scope === 'public' ? 'selected' : ''} onClick={() => setScope('public')} role="tab" aria-selected={scope === 'public'}>公开目录</button><button className={scope === 'mcp' ? 'selected' : ''} onClick={() => setScope('mcp')} role="tab" aria-selected={scope === 'mcp'}>MCP 连接</button></div>
        {scope === 'mcp' ? <McpConnections onUseContext={onUseMcpContext} /> : scope === 'installed' ? <div className="extension-content"><h2>本机插件包</h2>{filteredPlugins.length ? <div className="plugin-grid">{filteredPlugins.map((plugin) => <article className="plugin-row" key={plugin.id}><div className="plugin-icon"><Puzzle size={17} /></div><div className="plugin-row-copy"><strong>{plugin.name}</strong><span>{plugin.managed ? plugin.enabled ? '技能已启用' : '技能已停用' : `${plugin.skillsCount} 项随包技能`} · {plugin.provider}</span><small title={plugin.path}>{plugin.source}{plugin.version ? ` · ${plugin.version}` : ''}</small><small>{plugin.managed ? plugin.enabled ? 'Scodex 已启用 · 可在技能列表中选择' : 'Scodex 已停用 · 文件保留，技能暂不可选' : <>{plugin.codexEnabled === true ? 'Codex 已启用' : plugin.codexEnabled === false ? 'Codex 已停用' : 'Codex 启用状态未声明'} · {plugin.skillsCount ? 'Scodex 可读取技能' : 'Scodex 运行时未连接'}</>}</small></div>{plugin.managed ? <ManagedPluginActions plugin={plugin} onChanged={onRefresh} /> : <span className="plugin-installed"><Check size={15} />已安装</span>}</article>)}</div> : <div className="extension-empty"><Puzzle size={25} /><strong>{search ? '没有匹配的插件包' : '当前没有已发现的插件包'}</strong><p>这里只列出本机插件缓存中的真实包，不会把未安装的目录项显示为已连接。</p></div>}</div> : <PluginMarketplace search={search} onChanged={onRefresh} />}
        <p className="extension-runtime-note">插件缓存仅提供本地技能文件；外部工具需配置并连接 MCP 服务后才能使用。</p>
      </> : <>
        <div className="extension-content skills-center-content"><div className="skills-center-header"><h2>已安装</h2><span>{skills.length} 项本地技能</span></div><div className="skill-category-tabs" role="tablist" aria-label="技能来源分类">{Object.entries(CATEGORY_LABELS).map(([id, label]) => <button key={id} className={category === id ? 'selected' : ''} onClick={() => setCategory(id)} role="tab" aria-selected={category === id}>{label}</button>)}</div>
          {filteredSkills.length ? <div className="skills-center-grid"><div className="skills-center-list">{filteredSkills.map((skill) => {
            const enabled = !disabledIds.includes(skill.id);
            return <article className={`skills-center-row ${currentSkill?.id === skill.id ? 'selected' : ''}`} key={skill.id}>
              <button className="skills-center-open" onClick={() => onSelectSkill(skill)}><span className="skill-icon"><BookOpen size={16} /></span><span className="skill-row-copy"><strong>{skill.name}</strong><small>{skill.description || '本地技能指引'}</small></span></button>
              <button className={`skill-enable-toggle ${enabled ? 'enabled' : ''}`} role="switch" aria-checked={enabled} aria-label={`${enabled ? '停用' : '启用'}技能 ${skill.name}`} onClick={() => onToggleSkill(skill.id, !enabled)}><span /></button>
            </article>;
          })}</div>
            <div className="skills-center-detail">{currentSkill ? <><div className="skill-detail-head"><div className="skill-icon large"><BookOpen size={20} /></div><div><h2>{currentSkill.name}</h2><p>{currentSkill.description}</p></div></div><div className="skill-source"><span>来源</span><code>{currentSkill.sourceLabel ? currentSkill.sourceLabel + ' · ' : ''}{currentSkill.source}</code></div>{currentSkill.requiredMcp && <div className="dependency-notice"><AlertTriangle size={16} /><span>此技能声明依赖 MCP：{currentSkill.requiredMcp}。本工作台仅加载技能说明；需接入相应外部工具后才能执行相关操作。</span></div>}<div className="skill-readme"><pre>{currentSkill.content}</pre></div><div className="skill-detail-actions"><button className="primary-button" disabled={disabledIds.includes(currentSkill.id)} onClick={() => onUseSkill(currentSkill)}><Sparkles size={15} />{activeSkill?.id === currentSkill.id ? '当前对话已启用' : '设为本轮技能'}</button></div></> : <div className="extension-empty"><BookOpen size={25} /><strong>选择一项技能</strong><p>查看本地 SKILL.md 的来源和使用说明。</p></div>}</div>
          </div> : <div className="extension-empty"><BookOpen size={25} /><strong>{search ? '没有匹配的技能' : '这个分类中没有技能'}</strong><p>本地技能来自 Scodex、个人目录和已安装插件包。</p></div>}
        </div><p className="extension-runtime-note">技能文件在本机读取；只有主动发送消息且权限允许时，所选技能内容才会提交给模型。</p>
      </>}
    </main>
  </section>;
}
