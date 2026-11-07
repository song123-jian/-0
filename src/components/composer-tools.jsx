import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, BookOpen, Check, ChevronRight, FileCode2, FileSpreadsheet, FileText, FolderOpen, Globe, Image, ListChecks, LoaderCircle, MessageSquare, Monitor, Paintbrush, PanelTop, Paperclip, Plus, Presentation, Search, ShieldAlert, ShieldCheck, Goal, WandSparkles, X } from 'lucide-react';

const FEATURED = [
  ['documents', 'Documents', '创建和编辑文档', FileText, 'blue'],
  ['pdf', 'PDF', '阅读、创建和检查 PDF', FileText, 'red'],
  ['spreadsheets', 'Spreadsheets', '创建和编辑电子表格', FileSpreadsheet, 'green'],
  ['presentations', 'Presentations', '创建和编辑演示文稿', Presentation, 'orange'],
  ['template-creator', 'Template Creator', '创建可复用的模板', WandSparkles, 'violet'],
  ['browser', '浏览器', '浏览器操作技能指引', Globe, 'blue'],
  ['computer-use', '电脑', '电脑操作技能指引', Monitor, 'violet'],
  ['visualize', 'Visualize', '图表和交互可视化指引', Image, 'blue'],
];
const errorText = (error) => String(error?.message || error || '操作失败').replace(/^Error invoking remote method '[^']+': /, '');
const parentPath = (value) => value.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '');

function ToolItem({ icon: Icon, label, description, tone = '', checked, trailing, className = '', ...props }) {
  return <button type="button" className={'composer-menu-item ' + className} title={description ? `${label} · ${description}` : label} {...props}>
    <span className={'composer-item-icon ' + tone}><Icon size={18} /></span>
    <span className="composer-item-copy"><span>{label}</span>{description && <small>{description}</small>}</span>
    {checked ? <Check size={16} className="composer-item-check" /> : trailing ? <ChevronRight size={16} /> : null}
  </button>;
}

export function ComposerTools({ workspaceRoot, directory, skills, conversations, activeId, activeSkill, mode, goal, goalRun, onGoalStart, contextAccess, busy, onFile, onImage, onFolder, onWorkbench, onMode, onGoal, onSkill, onChat, onView, onPermission }) {
  const [panel, setPanel] = useState(null);
  const [page, setPage] = useState('tools');
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState(null);
  const [folderPath, setFolderPath] = useState('');
  const [folderLoading, setFolderLoading] = useState(false);
  const [searchResult, setSearchResult] = useState({ items: [], truncated: false });
  const [searching, setSearching] = useState(false);
  const [goalDraft, setGoalDraft] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);
  const permissionsRef = useRef(null);
  const restricted = contextAccess === 'chat-only';
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const orderedSkills = useMemo(() => {
    const used = new Set();
    const featured = FEATURED.flatMap(([key, label, description, icon, tone]) => {
      const skill = skills.find((item) => !used.has(item.id) && (item.name.toLowerCase().split(':').pop() === key || item.id.toLowerCase().includes('/' + key + '/')));
      if (!skill) return [];
      used.add(skill.id);
      return [{ skill, label, description, icon, tone }];
    });
    return [...featured, ...skills.filter((skill) => !used.has(skill.id)).map((skill) => ({ skill, label: skill.name, description: skill.description || 'SKILL 技能指引', icon: BookOpen, tone: 'green' }))];
  }, [skills]);
  const visibleSkills = normalizedQuery ? orderedSkills.filter(({ skill, label }) => `${label} ${skill.name} ${skill.description}`.toLocaleLowerCase().includes(normalizedQuery)).slice(0, 30) : orderedSkills.slice(0, 8);
  const matchingChats = normalizedQuery ? conversations.filter((chat) => `${chat.title} ${chat.messages.map((item) => item.content).join(' ')}`.toLocaleLowerCase().includes(normalizedQuery)).slice(0, 12) : [];

  const dismiss = (restoreFocus = false) => {
    const target = panel === 'permissions' ? permissionsRef.current : triggerRef.current;
    setPanel(null);
    if (restoreFocus) requestAnimationFrame(() => target?.focus());
  };
  const open = (next) => {
    if (panel === next) { dismiss(); return; }
    setError(''); setQuery(''); setPage('tools'); setGoalDraft(goal || '');
    setPanel(next);
  };
  const run = async (action) => {
    setWorking(true); setError('');
    try { if (await action() !== false) dismiss(true); }
    catch (caught) { setError(errorText(caught)); }
    finally { setWorking(false); }
  };

  useEffect(() => {
    if (!panel) return;
    const dismissOnOutside = (event) => { if (!rootRef.current?.contains(event.target)) setPanel(null); };
    const dismissOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      setPanel(null);
      (panel === 'permissions' ? permissionsRef : triggerRef).current?.focus();
    };
    const frame = requestAnimationFrame(() => popoverRef.current?.querySelector('input, textarea, button:not(:disabled)')?.focus());
    document.addEventListener('pointerdown', dismissOnOutside);
    document.addEventListener('keydown', dismissOnEscape, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', dismissOnOutside);
      document.removeEventListener('keydown', dismissOnEscape, true);
    };
  }, [panel, page]);

  useEffect(() => { setPanel(null); }, [activeId, workspaceRoot]);

  useEffect(() => {
    if (panel !== 'tools' || page !== 'files' || !folderPath) return;
    let cancelled = false;
    setFolder(null); setFolderLoading(true); setError('');
    window.scodex.listDirectory(folderPath).then((result) => { if (!cancelled) setFolder(result); })
      .catch((caught) => { if (!cancelled) setError(errorText(caught)); })
      .finally(() => { if (!cancelled) setFolderLoading(false); });
    return () => { cancelled = true; };
  }, [panel, page, folderPath]);

  useEffect(() => {
    let cancelled = false;
    setSearchResult({ items: [], truncated: false });
    if (panel !== 'tools' || page !== 'tools' || !normalizedQuery || restricted) { setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(() => window.scodex.searchWorkspace(normalizedQuery)
      .then((result) => { if (!cancelled) setSearchResult(result); })
      .catch((caught) => { if (!cancelled) setError(errorText(caught)); })
      .finally(() => { if (!cancelled) setSearching(false); }), 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [panel, page, normalizedQuery, workspaceRoot, restricted]);

  const browse = (path = directory || workspaceRoot) => { setError(''); setFolderPath(path); setPage('files'); };
  const handleKeys = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'INPUT' && !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const elements = [...popoverRef.current.querySelectorAll('button:not(:disabled), input, textarea')].filter((item) => item.getClientRects().length);
    const current = elements.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? elements.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + elements.length) % elements.length;
    event.preventDefault(); elements[next]?.focus();
  };

  return <div className="composer-tool-picker" ref={rootRef}>
    <button ref={triggerRef} type="button" className={'icon-button composer-action composer-plus ' + (panel === 'tools' ? 'selected' : '')} aria-label="添加工具和上下文" title="添加工具和上下文" aria-haspopup="dialog" aria-expanded={panel === 'tools'} aria-controls={panel === 'tools' ? 'composer-tools-popover' : undefined} onClick={() => open('tools')}><Plus size={22} /></button>
    <button ref={permissionsRef} type="button" className={'icon-button composer-action composer-permission ' + (restricted ? 'restricted' : '')} aria-label="更改权限" title={restricted ? '仅对话：只发送对话内容' : '完全访问：按当前设置自动衔接回答和本机工具'} aria-haspopup="dialog" aria-expanded={panel === 'permissions'} aria-controls={panel === 'permissions' ? 'composer-permissions-popover' : undefined} onClick={() => open('permissions')}>{restricted ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}<span>{restricted ? '仅对话' : '完全访问'}</span></button>

    {panel && <div className={'composer-popover ' + (panel === 'permissions' ? 'permission-popover' : '')} id={panel === 'permissions' ? 'composer-permissions-popover' : 'composer-tools-popover'} ref={popoverRef} role="dialog" aria-label={panel === 'permissions' ? '权限与访问' : '添加工具和上下文'} aria-modal="false" onKeyDown={handleKeys} onBlur={(event) => { if (event.relatedTarget && !rootRef.current?.contains(event.relatedTarget)) setPanel(null); }}>
      {panel === 'permissions' ? <>
        <div className="composer-popover-heading"><strong>权限与访问</strong><button className="icon-button" aria-label="关闭权限面板" onClick={() => dismiss(true)}><X size={17} /></button></div>
        <div className="composer-menu-scroll permission-options" role="radiogroup" aria-label="模型内容权限">
          <button role="radio" aria-checked={!restricted} className={'permission-option ' + (!restricted ? 'selected' : '')} disabled={working || busy} onClick={() => run(() => onPermission('manual'))}><ShieldAlert size={20} /><span><strong>完全访问（默认）</strong><small>允许附加文件、图片和技能；直接描述要求，模型按权限设置调用工具完成工作，无需切换执行模式。</small></span>{!restricted && <Check size={17} />}</button>
          <button role="radio" aria-checked={restricted} className={'permission-option ' + (restricted ? 'selected' : '')} disabled={working || busy} onClick={() => run(() => onPermission('chat-only'))}><ShieldCheck size={20} /><span><strong>仅对话</strong><small>不附加本机文件、工作台快照或技能内容。</small></span>{restricted && <Check size={17} />}</button>
          <p className="composer-permission-note">普通消息自动衔接回答和操作；仅对话不开放本机工具，规划只读。完整访问且不请求审批时直接执行；按请求审批时逐项确认。Windows 账号和明确网络限制仍生效。</p>
        </div>
      </> : <>
        {page !== 'tools' && <div className="composer-popover-heading"><button className="icon-button" aria-label="返回工具菜单" onClick={() => { setPage('tools'); setError(''); }}><ArrowLeft size={17} /></button><strong>{page === 'files' ? '文件和文件夹' : '对话目标'}</strong><button className="icon-button" aria-label="关闭工具菜单" onClick={() => dismiss(true)}><X size={17} /></button></div>}
        <div className="composer-menu-scroll" aria-busy={working || searching || folderLoading}>
          {page === 'tools' && <>
            {!normalizedQuery && <div className="composer-menu-group">
              <ToolItem icon={Paperclip} label="文件和文件夹" description="附加工作区内容" trailing disabled={working || restricted || busy} onClick={() => browse()} />
              <ToolItem icon={Image} tone="blue" label="图片" description="附加图片到当前消息" disabled={working || restricted || busy} onClick={() => run(onImage)} />
              <ToolItem icon={PanelTop} tone="green" label="附加 Scodex 工作台" description="当前工作状态快照" disabled={working || restricted || busy} onClick={() => run(onWorkbench)} />
              <ToolItem icon={Goal} className="composer-goal-entry" label="目标" description={goal ? '编辑要持续追求的目标' : '设置要持续追求的目标'} checked={Boolean(goal)} disabled={busy} onClick={() => { setGoalDraft(goal || ''); setPage('goal'); }} />
              <ToolItem icon={ListChecks} label="计划模式" description={mode === 'plan' ? '已开启，点击返回问答' : '开启计划模式'} checked={mode === 'plan'} disabled={busy} onClick={() => run(() => onMode(mode === 'plan' ? 'answer' : 'plan'))} />
              <ToolItem icon={Paintbrush} tone="green" label="绘图" description="打开本地图片编辑" onClick={() => run(() => onView('images'))} />
            </div>}
            <div className="composer-menu-group">
              <div className="composer-menu-caption"><span>插件</span><small>已安装技能指引</small></div>
              {visibleSkills.map(({ skill, label, description, icon, tone }) => <ToolItem key={skill.id} icon={icon} tone={tone} label={label} description={description} checked={activeSkill?.id === skill.id} disabled={working || restricted || busy} onClick={() => run(() => onSkill(skill))} />)}
              {!visibleSkills.length && <p className="composer-menu-empty">{normalizedQuery ? '没有匹配的技能' : '暂无已安装技能'}</p>}
              {!normalizedQuery && <ToolItem icon={BookOpen} label="全部技能" description={`查看 ${skills.length} 项技能与使用说明`} trailing onClick={() => run(() => onView('skills'))} />}
            </div>
            {normalizedQuery && <div className="composer-menu-group composer-search-results">
              <div className="composer-menu-caption"><span>文件和聊天</span>{searching && <LoaderCircle size={16} className="spin" />}</div>
              {!restricted && searchResult.items.map((item) => <ToolItem key={item.path} icon={item.directory ? FolderOpen : FileCode2} label={item.name} description={item.relative} trailing={item.directory} disabled={working || busy} onClick={() => item.directory ? browse(item.path) : run(() => onFile(item.path))} />)}
              {matchingChats.map((chat) => <ToolItem key={chat.id} icon={MessageSquare} label={chat.title} description={chat.id === activeId ? '当前对话' : '打开本机对话'} checked={chat.id === activeId} disabled={busy} onClick={() => run(() => onChat(chat.id))} />)}
              {!searching && !searchResult.items.length && !matchingChats.length && <p className="composer-menu-empty">没有匹配的文件或聊天</p>}
              {searchResult.truncated && <p className="composer-menu-note">搜索达到范围上限，请缩短目录范围或使用更具体的文件名。</p>}
              {restricted && <p className="composer-menu-note">仅对话权限下不搜索工作区文件。</p>}
            </div>}
          </>}
          {page === 'files' && <>
            <div className="composer-folder-path" title={folder?.directory || folderPath}><FolderOpen size={16} /><span>{folder?.directory || folderPath}</span>{folder && folder.directory !== folder.root && <button className="icon-button" aria-label="返回上级文件夹" onClick={() => setFolderPath(parentPath(folder.directory))}><ArrowUp size={16} /></button>}</div>
            <ToolItem icon={Paperclip} label="选择文件…" description="任意文件，也可以拖入聊天页" disabled={working || busy || restricted} onClick={() => run(() => onFile())} />
            <ToolItem icon={FolderOpen} tone="orange" label="附加此文件夹" description="仅包含目录清单，不读取文件内容" disabled={working || busy || restricted || !folder} onClick={() => run(() => onFolder(folder))} />
            <div className="composer-menu-caption"><span>当前文件夹</span>{folderLoading && <LoaderCircle size={16} className="spin" />}</div>
            {folder?.items.map((item) => <ToolItem key={item.path} icon={item.directory ? FolderOpen : FileCode2} label={item.name} description={item.directory ? '打开文件夹' : '附加文本内容'} trailing={item.directory} disabled={working || busy || restricted} onClick={() => item.directory ? setFolderPath(item.path) : run(() => onFile(item.path))} />)}
            {folder && !folder.items.length && <p className="composer-menu-empty">文件夹为空</p>}
          </>}
          {page === 'goal' && <form className="composer-goal-form" onSubmit={(event) => { event.preventDefault(); run(() => onGoal(goalDraft.trim())); }}>
            <label htmlFor="composer-goal">希望这次对话达成什么？</label>
            <textarea id="composer-goal" value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} placeholder="例如：完成一个可运行的小程序，并说明验证方法。" maxLength={2000} rows={5} />
            <p>保存只记录目标；点击开始后持续执行，直到完成、需要你处理阻塞或手动停止。关闭程序后可恢复，恢复时先核对已有结果。</p>
            {goalRun && <p role="status">{({ running: '执行中', completed: '模型报告完成', blocked: '需要处理阻塞', paused: '已暂停' })[goalRun.status] || '未开始'}。{goalRun.summary}</p>}
            <button type="button" className="primary-button" disabled={working || busy || restricted || mode === 'plan' || !goalDraft.trim()} onClick={() => { const text = goalDraft.trim(); dismiss(); Promise.resolve(onGoalStart(text)).catch(caught => setError(errorText(caught))); }}>{goalRun && goalRun.status !== 'completed' ? '恢复目标执行' : '开始目标执行'}</button>
            <div><button type="button" className="secondary-button" disabled={!goal || busy} onClick={() => run(() => onGoal(''))}>清除目标</button><button className="primary-button" type="submit" disabled={working || busy}>保存目标</button></div>
          </form>}
        </div>
        {page === 'tools' && <div className="composer-menu-search"><label htmlFor="composer-search">文件和聊天</label><div><Search size={17} /><input id="composer-search" aria-label="搜索文件或聊天" placeholder="输入内容以搜索文件或聊天" value={query} maxLength={160} onChange={(event) => { setQuery(event.target.value); setError(''); }} />{query && <button className="icon-button" aria-label="清除文件和聊天搜索" onClick={() => setQuery('')}><X size={15} /></button>}</div></div>}
      </>}
      {error && <p className="composer-menu-error" role="alert">{error}</p>}
    </div>}
  </div>;
}
