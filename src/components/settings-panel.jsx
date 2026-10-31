import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bot, Check, ChevronDown, Clipboard, FolderOpen, GitBranch, Globe, Info, Keyboard, LayoutPanelLeft, Monitor, Moon, Palette, RefreshCw, RotateCcw, Search, Settings2, ShieldCheck, Sun, X } from 'lucide-react';
import { WORK_MODES } from '../lib/modes.js';
import { StoragePanel } from './storage-panel.jsx';
import { ModelConnectionPanel } from './model-connection-panel.jsx';
import { PluginSettings, ComputerSettings, BrowserSettings, GitSettings } from './integration-settings.jsx';
import FONT_FAMILIES from '../../electron/font-families.json';

const CATEGORIES = [
  { id: 'general', label: '常规', icon: Settings2, group: '个人', search: '权限 工作区 聊天目录 压缩 归档 插件 技能 开源 许可 默认模式 完整视图 底部面板 默认打开终端 shell 语言 关闭窗口 通知 Dot 托盘 驻留 最小化 退出' },
  { id: 'appearance', label: '外观', icon: Palette, group: '个人', search: '字体 微软雅黑 字号 清晰 主题 模式 强调色 背景 前景' },
  { id: 'workspace', label: '工作台与标签', icon: LayoutPanelLeft, group: '个人', search: '导航 侧栏 隐藏 第三 页面 标签 状态栏 技能' },
  { id: 'storage', label: '存储空间', icon: FolderOpen, group: '个人', search: '数据目录 会话 草稿 文件 保存 本地 归档 聊天 子智能体 工作树 清理' },
  { id: 'shortcuts', label: '键盘快捷键', icon: Keyboard, group: '个人', search: 'Ctrl K P S Enter 快捷键' },
  { id: 'model', label: '模型与连接', icon: Globe, group: '集成', search: 'Grok 中转站 服务地址 密钥 凭据 API 网络' },
  { id: 'agent', label: '配置', icon: Bot, group: '集成', search: '智能体 默认 审批 策略 沙盒 权限 网页搜索 输出详细程度 推理摘要 可用推理强度 工作空间依赖 诊断 重新安装 config.toml' },
  { id: 'skills', label: 'SKILL 技能', icon: BookOpen, group: '集成', search: '技能 SKILL 指引 目录 搜索 启用 停用 刷新 自动调用' },
  { id: 'computer', label: '电脑操控', icon: Monitor, group: '集成', search: '桌面 应用 Chrome Edge Excel 授权 扩展' },
  { id: 'browser', label: '浏览器', icon: Globe, group: '集成', search: '网站 权限 下载 缓存 历史 地址 URL 摄像头 麦克风' },
  { id: 'git', label: 'Git', icon: GitBranch, group: '集成', search: '分支 前缀 提交 指令 PR Pull Request 合并 压缩 强制推送 草稿 审查 内联' },
  { id: 'about', label: '关于 Scodex', icon: Info, group: '工作台', search: '版本 Electron 说明 能力' },
];

const ACCENT_PRESETS = [
  ['default', '默认', '#176C5B'], ['blue', '蓝色', '#2878C7'], ['green', '绿色', '#16836B'],
  ['yellow', '黄色', '#B17A00'], ['pink', '粉色', '#C75183'], ['orange', '橙色', '#C76332'],
  ['purple', '紫色', '#7259B8'], ['black', '黑色', '#34383B'],
];

function SettingRow({ label, description, children, wide = false }) {
  return <div className={'settings-row ' + (wide ? 'wide-control' : '')}><div className="settings-row-copy"><strong>{label}</strong>{description && <p>{description}</p>}</div><div className="settings-row-control">{children}</div></div>;
}

function SettingsGroup({ title, children }) {
  return <section className="settings-section"><h2>{title}</h2><div className="settings-row-group">{children}</div></section>;
}

function Switch({ label, checked, onChange, disabled = false }) {
  return <button type="button" className={'settings-switch ' + (checked ? 'checked' : '')} role="switch" aria-label={label} aria-checked={Boolean(checked)} disabled={disabled} onClick={() => onChange(!checked)}><span /></button>;
}

function ColorField({ label, value, onChange }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => { if (/^#[0-9a-f]{6}$/i.test(text)) onChange(text.toUpperCase()); else setText(value); };
  return <div className="settings-color-field"><input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} /><input className="settings-hex-input" aria-label={'输入' + label} value={text} maxLength={7} spellCheck={false} onChange={(event) => setText(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setText(value); event.stopPropagation(); } }} /></div>;
}

function AccentSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const selected = ACCENT_PRESETS.find(([, , color]) => color === value);
  useEffect(() => {
    if (!open) return undefined;
    root.current?.querySelector('input:checked')?.focus();
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const keyboard = (event) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keyboard); };
  }, [open]);
  return <div className="settings-accent-select" ref={root} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className="settings-accent-trigger" aria-label="强调色" aria-expanded={open} onClick={() => setOpen(!open)}><i style={{ background: value }} /><span>{selected?.[1] || '自定义'}</span><ChevronDown size={16} /></button>
    {open && <div className="settings-accent-menu" role="radiogroup" aria-label="强调色选项">{ACCENT_PRESETS.map(([key, label, color]) => <label key={key}><input type="radio" name="appearance-accent" value={color} checked={value === color} onChange={() => onChange(color)} /><i style={{ background: color }} /><span>{label}</span>{value === color && <Check size={16} />}</label>)}<div className="settings-accent-custom"><span>自定义</span><ColorField label="自定义强调色" value={value} onChange={onChange} /></div></div>}
  </div>;
}

function AppearanceModes({ value, onChange }) {
  return <div className="settings-mode-choices" role="group" aria-label="外观模式">{[['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([mode, label]) => <button key={mode} type="button" className={'settings-mode-choice ' + (value === mode ? 'selected' : '')} aria-label={label} aria-pressed={value === mode} onClick={() => onChange(mode)}><span className={'settings-mode-preview preview-' + mode} aria-hidden="true"><span className="preview-sidebar"><i /><i /><i /></span><span className="preview-content"><i /><i /><i /><b /></span></span><span>{label}</span></button>)}</div>;
}

function LicenseDialog({ onClose }) {
  const dialog = useRef(null);
  const [licenses, setLicenses] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current.showModal();
    let mounted = true;
    window.scodex.getLicenses().then((value) => { if (mounted) setLicenses(value); }).catch(() => { if (mounted) setError('暂时无法读取许可声明，请重新打开。'); });
    return () => { mounted = false; };
  }, []);
  return <dialog ref={dialog} className="settings-license-dialog" aria-labelledby="license-title" onClose={onClose}>
    <header><h2 id="license-title">开源许可证</h2><button autoFocus className="icon-button" aria-label="关闭许可证" onClick={() => dialog.current.close()}><X size={21} /></button></header>
    <p>Scodex 使用以下开源组件。各组件保留其原始许可和版权声明。</p>
    <div className="license-list">{error ? <p role="alert">{error}</p> : licenses ? licenses.map((item) => <details key={item.name + item.version}><summary>{item.name} <span>{item.version} · {item.license}</span></summary>{item.notices.length ? item.notices.map((notice) => <pre key={notice.file}>{notice.text}</pre>) : <p>该组件声明的许可为 {item.license}；随包未提供单独许可文本。</p>}</details>) : <p role="status">正在读取许可声明…</p>}</div>
  </dialog>;
}

const REASONING_EFFORTS = [
  ['low', '轻度'], ['medium', '中'], ['high', '高'],
  ['xhigh', '极高'], ['max', 'Max'], ['ultra', 'Ultra'],
];

function ReasoningEffortSelect({ value, onChange }) {
  const detailsRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const selected = new Set(value);
  useEffect(() => {
    const closeOutside = (event) => {
      if (detailsRef.current?.open && !detailsRef.current.contains(event.target)) detailsRef.current.open = false;
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);
  const toggleEffort = async (effort) => {
    if (saving || (selected.has(effort) && value.length === 1)) return;
    setSaving(true);
    try { await onChange(selected.has(effort) ? value.filter((item) => item !== effort) : [...value, effort]); }
    finally { setSaving(false); }
  };
  return <details ref={detailsRef} className="settings-effort-select" onKeyDown={(event) => {
    if (event.key === 'Escape' && detailsRef.current?.open) {
      event.preventDefault();
      detailsRef.current.open = false;
      detailsRef.current.querySelector('summary')?.focus();
    }
  }} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
  }}>
    <summary aria-label="选择可用推理强度">已选择 {value.length} 个<ChevronDown size={14} /></summary>
    <div className="settings-effort-menu" role="group" aria-label="可用推理强度" aria-busy={saving}>
      {REASONING_EFFORTS.map(([effort, label]) => <label key={effort}>
        <input type="checkbox" aria-label={`${label}推理强度`} checked={selected.has(effort)} disabled={saving || (selected.has(effort) && value.length === 1)} onChange={() => toggleEffort(effort)} />
        <span>{label}</span>
      </label>)}
      <p>至少保留一个级别</p>
    </div>
  </details>;
}

export function SettingsPanel({ onOpenWorktree, initialCategory, onModelConnectionSaved, onModalChange, appState, workspaceRoot, preferences, resolvedTheme, agentSettings: effectiveAgentSettings, onPreference, onAgentSetting, onConfigureConversationStorage, onOpenCodexConfig, onDiagnoseCodex, onOpenCodexDiagnostic, onUpdateCodex, onReinstallTools, onChooseWorkspace, onReveal, onCopyPath, onRefreshSkills, skills = [], connectionLabel, onView, library, chatBusy, onManageChats }) {
  const [selected, setSelected] = useState(initialCategory?.id || 'general');
  const [desktopError, setDesktopError] = useState('');
  useEffect(() => { if (initialCategory?.id && CATEGORIES.some((item) => item.id === initialCategory.id)) setSelected(initialCategory.id); }, [initialCategory]);
  const [scope, setScope] = useState('shared');
  const [configurationStatus, setConfigurationStatus] = useState(null);
  const [configurationRevision, setConfigurationRevision] = useState(0);
  const [savingAgent, setSavingAgent] = useState(false);
  const scopeState = appState?.agentSettingsScopes?.[scope];
  const agentSettings = scopeState?.settings || effectiveAgentSettings;
  const [licensesOpen, setLicensesOpen] = useState(false);
  useEffect(() => { onModalChange?.(licensesOpen); return () => onModalChange?.(false); }, [licensesOpen, onModalChange]);
  const [search, setSearch] = useState('');
  const [codexAction, setCodexAction] = useState(null);
  const [workingCodexAction, setWorkingCodexAction] = useState('');
  const [tools, setTools] = useState(appState?.workspaceTools || { installed: false });
  const [toolProgress, setToolProgress] = useState('');
  useEffect(() => window.scodex.onWorkspaceToolsProgress?.((progress) => {
    const size = progress.received ? `（${(progress.received / 1024 / 1024).toFixed(1)}${progress.total ? ' / ' + (progress.total / 1024 / 1024).toFixed(1) : ''} MB）` : '';
    setToolProgress(progress.message + size);
  }), []);
  useEffect(() => { setTools(appState?.workspaceTools || { installed: false }); }, [appState?.workspaceTools]);
  const categories = useMemo(() => CATEGORIES.filter((category) => (category.label + ' ' + category.search).toLowerCase().includes(search.trim().toLowerCase())), [search]);
  const category = categories.find((item) => item.id === selected) || categories[0];
  const active = category?.id;
  useEffect(() => {
    if (active !== 'agent') return undefined;
    let mounted = true;
    setConfigurationStatus({ loading: true });
    window.scodex.getCodexConfigurationStatus(scope).then((value) => { if (mounted) setConfigurationStatus(value); })
      .catch(() => { if (mounted) setConfigurationStatus({ ok: false, warnings: [], error: '暂时无法读取配置，请刷新或运行诊断。' }); });
    return () => { mounted = false; };
  }, [active, scope, workspaceRoot, configurationRevision]);
  const updateAgentSetting = async (key, value) => {
    setSavingAgent(true);
    try { return await onAgentSetting(key === null ? null : { [key]: value }, scope); }
    finally { setSavingAgent(false); }
  };
  const runCodexAction = async (kind, action) => {
    setWorkingCodexAction(kind);
    setToolProgress('');
    setCodexAction({ kind, status: 'running', output: '' });
    try {
      const result = await action();
      if (result?.tools) setTools(result.tools);
      setCodexAction({
        kind,
        status: result?.cancelled ? 'cancelled' : result?.ok ? 'complete' : 'failed',
        output: String(result?.output || '').slice(-16_000),
        exitCode: result?.exitCode,
        health: result?.health,
        logPath: result?.logPath,
        truncated: String(result?.output || '').length > 16_000,
      });
    } catch (error) {
      setCodexAction({ kind, status: 'failed', output: String(error?.message || error).slice(-16_000) });
    } finally {
      setWorkingCodexAction('');
    }
  };
  const backgroundColor = preferences.backgroundColor || (resolvedTheme === 'dark' ? '#15191A' : '#F5F7F6');
  const foregroundColor = preferences.foregroundColor || (resolvedTheme === 'dark' ? '#E5EBE8' : '#1B2825');

  return <section className="settings-view">
    <aside className="settings-sidebar">
      <div className="settings-sidebar-title"><h1>设置</h1><span className="version-badge">v{appState?.version || '—'}</span></div>
      <label className="settings-search"><Search size={18} /><input aria-label="搜索设置" placeholder="搜索设置" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button className="icon-button small" aria-label="清除设置搜索" onClick={() => setSearch('')}><X size={15} /></button>}</label>
      <nav className="settings-category-list" aria-label="设置分类">{['个人', '集成', '工作台'].map((group) => {
        const items = categories.filter((item) => item.group === group);
        return items.length ? <div className="settings-category-group" key={group}><p>{group}</p>{items.map(({ id, label, icon: Icon }) => <button className={'settings-category ' + (active === id ? 'active' : '')} aria-current={active === id ? 'page' : undefined} key={id} onClick={() => setSelected(id)}><Icon size={18} /><span>{label}</span></button>)}</div> : null;
      })}</nav>
      <div className="settings-sidebar-footer"><Monitor size={17} /><span>本地桌面工作台</span></div>
    </aside>
    <div className="settings-detail" key={active}>
      {category ? <div className="settings-detail-inner"><header className="settings-detail-heading"><h1>{category.label}</h1>{active !== 'storage' && <p>{active === 'model' ? '配置模型服务，点击“保存配置”后生效。' : active === 'general' ? '管理本地权限、默认行为和通知。' : active === 'appearance' ? '选择舒适清晰的配色和字体。' : active === 'agent' ? '配置新聊天的权限、网页访问和智能体回复。' : '设置会自动保存到当前电脑。'}</p>}</header>
        {active === 'general' && <>
          <SettingsGroup title="权限">
            <SettingRow label="默认权限" description="完全访问允许选择本机内容随消息提交；仅对话只发送对话内容。"><select aria-label="默认权限" value={preferences.contextAccess} onChange={(event) => onPreference({ contextAccess: event.target.value })}><option value="manual">完全访问</option><option value="chat-only">仅对话</option></select></SettingRow>
            <SettingRow label="完整访问权限" description="工作台聊天通过确认后保存文件；不会自行执行模型生成的系统命令。"><span className="settings-value">按操作确认</span></SettingRow>
          </SettingsGroup>
          <SettingsGroup title="常规">
            <SettingRow label="本地聊天文件夹" description={appState?.conversationDirectory || appState?.userDataPath || '当前应用数据目录'} wide><button className="secondary-button" disabled={chatBusy || Boolean(appState?.historyError)} onClick={() => onConfigureConversationStorage({ chooseDirectory: true })}><FolderOpen size={16} />更改</button></SettingRow>
            <SettingRow label="本地工作区" description={workspaceRoot} wide><button className="secondary-button" onClick={onChooseWorkspace}>更改</button></SettingRow>
            <SettingRow label="默认文件打开位置" description="在内置编辑器中打开文件，或使用 Windows 默认程序。"><select aria-label="默认文件打开方式" value={preferences.defaultFileOpen} onChange={(event) => onPreference({ defaultFileOpen: event.target.value })}><option value="builtin">Scodex 编辑器</option><option value="system">Windows 默认程序</option></select></SettingRow>
            <SettingRow label="集成终端 Shell" description="从工作台打开终端时使用的程序。"><select aria-label="集成终端 Shell" value={preferences.terminalShell} onChange={(event) => onPreference({ terminalShell: event.target.value })}><option value="powershell">PowerShell</option><option value="cmd">命令提示符</option></select></SettingRow>
            <SettingRow label="语言" description="当前桌面界面语言。"><span className="settings-value">简体中文</span></SettingRow>
            <SettingRow label="退出程序前确认" description="完整退出时检查未保存文件和生成请求；隐藏到托盘不会丢弃编辑。"><select aria-label="关闭窗口前确认" value={preferences.closeConfirmation} onChange={(event) => onPreference({ closeConfirmation: event.target.value })}><option value="busy">有未完成工作时</option><option value="always">每次关闭</option></select></SettingRow>
            <SettingRow label="默认使用完整视图" description="新建聊天时收起侧栏和标签工作台，将空间留给当前内容。"><Switch label="默认使用完整视图" checked={preferences.defaultFullView} onChange={(checked) => onPreference({ defaultFullView: checked })} /></SettingRow>
            <SettingRow label="新对话默认模式" description="已有对话保留各自的工作模式。"><select aria-label="新对话默认模式" value={preferences.defaultMode} onChange={(event) => onPreference({ defaultMode: event.target.value })}>{WORK_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select></SettingRow>
            <SettingRow label="底部面板" description="在文件编辑器底部显示路径、编码和编辑状态。"><Switch label="底部面板" checked={preferences.showEditorStatusBar} onChange={(checked) => onPreference({ showEditorStatusBar: checked })} /></SettingRow>
            <SettingRow label="自动归档不活跃聊天" description="启动时归档超过指定天数未更新的聊天；当前和置顶聊天保留，可在存储空间恢复。"><select aria-label="自动归档不活跃聊天" disabled={chatBusy || Boolean(appState?.historyError)} value={preferences.autoArchiveDays} onChange={(event) => onConfigureConversationStorage({ autoArchiveDays: Number(event.target.value) })}><option value={0}>永不</option><option value={30}>30 天后</option><option value={90}>90 天后</option></select></SettingRow>
            <SettingRow label="压缩本地保存的聊天历史记录" description="使用 gzip 节省聊天文件占用，立即生效；关闭后还原为 JSON。"><Switch label="压缩聊天记录" disabled={chatBusy || Boolean(appState?.historyError)} checked={preferences.compressHistory} onChange={(checked) => onConfigureConversationStorage({ compressHistory: checked })} /></SettingRow>
            <SettingRow label="开源许可证" description="查看随工作台使用的开源组件及许可声明。"><button className="secondary-button" onClick={() => setLicensesOpen(true)}>查看</button></SettingRow>
          </SettingsGroup>
          <SettingsGroup title="系统托盘">
            <SettingRow label="启用系统托盘" description="在 Windows 通知区域显示 Scodex 图标，单击恢复，右键打开快捷菜单。"><Switch label="启用系统托盘" checked={preferences.trayEnabled !== false} onChange={(checked) => onPreference({ trayEnabled: checked })} /></SettingRow>
            <SettingRow label="关闭窗口后驻留托盘" description="保存聊天和草稿后隐藏窗口；未保存的编辑、终端、模型请求和定时任务继续保留。"><Switch label="关闭窗口后驻留托盘" disabled={preferences.trayEnabled === false} checked={preferences.closeToTray !== false} onChange={(checked) => onPreference({ closeToTray: checked })} /></SettingRow>
            <SettingRow label="最小化到托盘" description="最小化窗口时隐藏任务栏按钮，可通过托盘图标或再次启动程序恢复。"><Switch label="最小化到托盘" disabled={preferences.trayEnabled === false} checked={Boolean(preferences.minimizeToTray)} onChange={(checked) => onPreference({ minimizeToTray: checked })} /></SettingRow>
            <SettingRow label="后台运行" description="隐藏到托盘后程序继续运行；完整退出后停止定时任务和终端。"><div className="desktop-action-buttons"><button className="secondary-button" disabled={preferences.trayEnabled === false} onClick={() => window.scodex.hideToTray().catch((error) => setDesktopError(String(error.message || error)))}>隐藏到托盘</button><button className="secondary-button" onClick={() => window.scodex.quitApp().catch((error) => setDesktopError(String(error.message || error)))}>退出程序</button></div></SettingRow>
            {desktopError && <p className="tools-inline-error" role="alert">{desktopError}</p>}
          </SettingsGroup>
          <SettingsGroup title="编辑器">
            <SettingRow label="纯文本编辑器" description="代码、Markdown 和链接均以纯文本编辑。"><span className="settings-value">已启用</span></SettingRow>
            <SettingRow label="显示上下文窗口使用情况" description="当前中转站没有提供上下文用量，接入后才能显示。"><span className="settings-value">暂不可用</span></SettingRow>
            <SettingRow label="发送快捷键" description="Shift Enter 始终换行；中文输入法选词时不会发送。"><select aria-label="发送快捷键" value={preferences.sendShortcut} onChange={(event) => onPreference({ sendShortcut: event.target.value })}><option value="ctrl-enter">Ctrl Enter 发送</option><option value="enter">Enter 发送</option></select></SettingRow>
            <SettingRow label="跟进处理方式" description="生成过程中可停止当前请求，结束后再发送下一条。"><span className="settings-value">单条处理</span></SettingRow>
          </SettingsGroup>
          <SettingsGroup title="通知">
            <SettingRow label="轮次完成通知" description="设置任务完成后何时提醒。"><select aria-label="任务完成通知" value={preferences.notifyOnComplete ? 'background' : 'off'} onChange={(event) => onPreference({ notifyOnComplete: event.target.value === 'background' })}><option value="background">仅在未聚焦时</option><option value="off">关闭</option></select></SettingRow>
            <SettingRow label="启用权限通知" description="需要确认附加文件且工作台位于后台时，显示 Windows 通知。"><Switch label="权限通知" checked={preferences.notifyOnPermissions} onChange={(checked) => onPreference({ notifyOnPermissions: checked })} /></SettingRow>
            <SettingRow label="启用问题通知" description="请求失败且工作台处于后台时显示通知。"><Switch label="问题通知" checked={preferences.notifyOnIssues} onChange={(checked) => onPreference({ notifyOnIssues: checked })} /></SettingRow>
            <SettingRow label="启用 Dot 通知" description="当前工作台没有接入 Dot 消息服务。"><span className="settings-value">未接入</span></SettingRow>
            <SettingRow label="通知提示音" description="用于任务完成、权限和问题通知。"><select aria-label="通知提示音" value={preferences.notificationSound} onChange={(event) => onPreference({ notificationSound: event.target.value })}><option value="default">系统默认</option><option value="silent">静音</option></select></SettingRow>
          </SettingsGroup>
        </>}
        {active === 'appearance' && <>
          <SettingsGroup title="视觉风格">
            <SettingRow label="模式" description="跟随系统，或使用固定的浅色、深色外观。"><AppearanceModes value={preferences.themeMode} onChange={(themeMode) => onPreference({ themeMode })} /></SettingRow>
            <SettingRow label="主题" description="标准配色或提高文字与边界对比度。"><select aria-label="主题" value={preferences.themeStyle} onChange={(event) => onPreference({ themeStyle: event.target.value })}><option value="standard">Scodex 标准</option><option value="high-contrast">高对比</option></select></SettingRow>
            <SettingRow label="强调色"><AccentSelect value={preferences.accentColor} onChange={(accentColor) => onPreference({ accentColor })} /></SettingRow>
            <SettingRow label="背景" description="更改工作台表面背景色。"><ColorField label="背景颜色" value={backgroundColor} onChange={(color) => onPreference({ backgroundColor: color })} /></SettingRow>
            <SettingRow label="前景" description="更改主要文字颜色。"><ColorField label="前景颜色" value={foregroundColor} onChange={(color) => onPreference({ foregroundColor: color })} /></SettingRow>
            <SettingRow label="字体" description="默认使用微软雅黑；未安装的字体自动回退。"><select aria-label="界面字体" value={preferences.fontFamily} onChange={(event) => onPreference({ fontFamily: event.target.value })}>{FONT_FAMILIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></SettingRow>
            <SettingRow label="字体大小" description="正文默认 16 像素；辅助说明保持清晰可读。"><select aria-label="字体大小" value={preferences.fontSize} onChange={(event) => onPreference({ fontSize: Number(event.target.value) })}><option value={16}>标准 · 16</option><option value={18}>大字 · 18</option><option value={20}>更大 · 20</option></select></SettingRow>
          </SettingsGroup>
          <div className="settings-font-preview"><span>字体预览</span><h2>让每一次阅读，都更清楚。</h2><p>{preferences.fontFamily} · Scodex 工作台</p><p>今天的计划、代码与数据，都在这里。0123456789</p></div>
          <button className="settings-reset-button" type="button" onClick={() => onPreference({ themeMode: 'system', themeStyle: 'standard', accentColor: '#176C5B', backgroundColor: null, foregroundColor: null, fontFamily: 'Microsoft YaHei', fontSize: 16 })}><RotateCcw size={16} />重置为默认设置</button>
        </>}
        {active === 'workspace' && <>
          <SettingsGroup title="布局"><SettingRow label="收起左侧导航" description="仅显示图标，为主工作区留出更多空间。"><Switch label="收起左侧导航" checked={preferences.railCollapsed} onChange={(checked) => onPreference({ railCollapsed: checked })} /></SettingRow><SettingRow label="显示标签工作台" description="右侧第三工作台提供独立网页标签。隐藏后保留已打开页面。"><Switch label="显示标签工作台" checked={preferences.browserPanelOpen} onChange={(checked) => onPreference({ browserPanelOpen: checked })} /></SettingRow><SettingRow label="放大标签工作台" description="暂时收起主区域；可从面板右上角还原。"><Switch label="放大标签工作台" checked={preferences.browserPanelExpanded} onChange={(checked) => onPreference({ browserPanelExpanded: checked, browserPanelOpen: true })} /></SettingRow><SettingRow label="显示编辑器底部状态栏"><Switch label="显示编辑器底部状态栏" checked={preferences.showEditorStatusBar} onChange={(checked) => onPreference({ showEditorStatusBar: checked })} /></SettingRow></SettingsGroup>
          <SettingsGroup title="网页标签"><SettingRow label="网页隔离" description="网页标签不能调用本地文件或模型接口。"><span className="settings-value status-value"><Check size={16} />已启用</span></SettingRow><SettingRow label="页面保留"><span className="settings-value">最多 10 个标签</span></SettingRow></SettingsGroup>
        </>}
        {active === 'storage' && <>
          <StoragePanel onOpenWorktree={onOpenWorktree} workspaceRoot={workspaceRoot} library={library} busy={chatBusy} historyError={appState?.historyError} onManageChats={onManageChats} onChooseWorkspace={onChooseWorkspace} onRevealWorkspace={onReveal} onCopyWorkspace={onCopyPath} />
        </>}
        {active === 'shortcuts' && <SettingsGroup title="常用操作">{[['工具命令搜索', 'Ctrl Shift P'], ['新建对话', 'Ctrl K'], ['打开文件面板', 'Ctrl P'], ['集成终端', 'Ctrl J'], ['打开设置', 'Ctrl ,'], ['工作台后退／前进', 'Alt ← / →'], ['发送当前消息', preferences.sendShortcut === 'enter' ? 'Enter' : 'Ctrl Enter'], ['保存当前文件或表格', 'Ctrl S'], ['显示或隐藏标签工作台', 'Ctrl Shift B']].map(([label, key]) => <SettingRow key={key} label={label}><kbd>{key}</kbd></SettingRow>)}</SettingsGroup>}
        {active === 'model' && <ModelConnectionPanel connection={appState?.connection} onSaved={onModelConnectionSaved} busy={chatBusy} />}
        {active === 'agent' && <>
          {appState?.agentSettingsError && <p className="settings-agent-error" role="alert">{appState.agentSettingsError}</p>}
          <div className="settings-configuration-toolbar">
            <select aria-label="配置范围" disabled={savingAgent} value={scope} onChange={(event) => setScope(event.target.value)}><option value="shared">Scodex 默认</option><option value="workspace">当前工作空间</option></select>
            <button className="secondary-button" onClick={() => onOpenCodexConfig(scope)}><FolderOpen size={16} />打开 config.toml</button>
          </div>
          <section className="settings-config-status" aria-label="配置检查" aria-live="polite">
            <div><span>{configurationStatus?.loading ? '正在读取配置…' : '配置检查'}</span><button className="icon-button small" aria-label="刷新配置检查" disabled={configurationStatus?.loading} onClick={() => setConfigurationRevision((value) => value + 1)}><RefreshCw size={15} /></button></div>
            {configurationStatus?.error && <p role="alert">{configurationStatus.error}</p>}
            {configurationStatus?.ok && !configurationStatus.warnings?.length && <p>当前范围未收到配置告警。</p>}
            {configurationStatus?.warnings?.map((warning, index) => <div className="settings-config-warning" key={index}><strong>{warning.summary}</strong>{warning.details && <p>{warning.details}</p>}{warning.path && <p>{warning.path}{warning.range?.start?.line ? `:${warning.range.start.line}` : ''}</p>}</div>)}
          </section>
          <SettingsGroup title="智能体默认设置">
            <SettingRow label="批准策略" description="作用于 Scodex 启动的 Codex CLI；工作台聊天不会执行生成的命令。"><select aria-label="批准策略" value={agentSettings.approvalPolicy} onChange={(event) => updateAgentSetting('approvalPolicy', event.target.value)}><option value="on-request">按请求</option><option value="never">从不请求审批</option></select></SettingRow>
            <SettingRow label="沙盒设置" description="选择 Codex CLI 运行命令时的文件访问范围。"><select aria-label="沙盒设置" value={agentSettings.sandboxMode} onChange={(event) => updateAgentSetting('sandboxMode', event.target.value)}><option value="read-only">只读</option><option value="workspace-write">工作空间写入</option><option value="danger-full-access">完整访问权限</option></select></SettingRow>
            <SettingRow label="工作台权限边界" description="同一策略同时约束工作台文件、终端、插件、Git 工作树和浏览器相关本机入口。"><span className="settings-value">{agentSettings.sandboxMode === 'read-only' ? '只读' : agentSettings.sandboxMode === 'workspace-write' ? '工作空间写入' : '完整访问'} · {agentSettings.approvalPolicy === 'on-request' ? '按请求审批' : '直接拒绝越界操作'}</span></SettingRow>
            <SettingRow label="网页搜索" description="设置 Codex CLI 的网页搜索模式；工作台网页标签仍由用户手动访问。"><select aria-label="网页搜索" value={agentSettings.webSearch} onChange={(event) => updateAgentSetting('webSearch', event.target.value)}><option value="disabled">禁用</option><option value="cached">缓存</option><option value="indexed">索引</option><option value="live">实时</option></select></SettingRow>
            <SettingRow label="命令网络访问" description="开启后仍只允许下方域名；未列出的地址保持阻止。"><Switch label="命令网络访问" checked={Boolean(agentSettings.networkAccess)} onChange={(checked) => updateAgentSetting('networkAccess', checked)} /></SettingRow>
            <SettingRow label="允许网络域名" description="用逗号分隔，例如 api.openai.com, *.example.com。"><input className="integration-prefix" aria-label="允许网络域名" value={(agentSettings.networkDomains || []).join(', ')} onChange={(event) => updateAgentSetting('networkDomains', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} /></SettingRow>
            <SettingRow label="允许本机和私有地址" description="只在需要访问 localhost 或内网服务时开启。"><Switch label="允许本机和私有地址" checked={Boolean(agentSettings.allowLocalBinding)} onChange={(checked) => updateAgentSetting('allowLocalBinding', checked)} /></SettingRow>
            <SettingRow label="输出详细程度" description="Codex CLI 原生使用该选项；Grok 工作台按同一偏好调整回复指引。"><select aria-label="输出详细程度" value={agentSettings.outputDetail} onChange={(event) => updateAgentSetting('outputDetail', event.target.value)}><option value="default">模型默认</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></SettingRow>
            <SettingRow label="推理摘要" description="控制结论依据的呈现方式，不显示隐藏的逐步思维链。"><select aria-label="推理摘要" value={agentSettings.reasoningSummary} onChange={(event) => updateAgentSetting('reasoningSummary', event.target.value)}><option value="auto">自动</option><option value="concise">简洁</option><option value="detailed">详细</option><option value="none">无</option></select></SettingRow>
          </SettingsGroup>
          <SettingsGroup title="系统权限状态">
            <SettingRow label="Windows 管理员令牌" description={appState?.windowsSecurity?.note || '正在读取当前进程状态。'}><span className="settings-value">{appState?.windowsSecurity?.isElevated ? '已提升' : '普通用户'}</span></SettingRow>
            <SettingRow label="权限审计" description="记录工作台权限判定和用户审批，不包含 API Key 或文件正文。"><button className="secondary-button" onClick={() => window.scodex.refreshPermissionSecurity().then(() => window.location.reload())}>刷新状态</button></SettingRow>
          </SettingsGroup>
          <SettingsGroup title="模型功能">
            <SettingRow label="可用推理强度" description="决定本机对话输入栏可选的回答深度，模型是否支持由服务提供方决定。"><ReasoningEffortSelect value={agentSettings.availableReasoningEfforts} onChange={(value) => updateAgentSetting('availableReasoningEfforts', value)} /></SettingRow>
            <SettingRow label="默认推理强度" description="新对话默认使用此级别；每个对话可单独调整。"><select aria-label="默认推理强度" value={agentSettings.defaultReasoningEffort} onChange={(event) => updateAgentSetting('defaultReasoningEffort', event.target.value)}>{REASONING_EFFORTS.filter(([effort]) => agentSettings.availableReasoningEfforts.includes(effort)).map(([effort, label]) => <option key={effort} value={effort}>{label}</option>)}</select></SettingRow>
          </SettingsGroup>
          <SettingsGroup title="工作空间依赖项">
            <SettingRow label="Scodex 依赖项" description="在新开的 CLI 和终端中加载随应用预置的 Node.js、npm、Python 与 pip 工具。"><Switch label="Scodex 依赖项" checked={agentSettings.workspaceDependencies} onChange={(checked) => updateAgentSetting('workspaceDependencies', checked)} /></SettingRow>
            <SettingRow label="诊断 Scodex 工作空间" description="检查当前 CLI 安装、配置、凭据和运行环境，完整报告保存在本机。"><button className="secondary-button" disabled={Boolean(workingCodexAction)} onClick={() => runCodexAction('diagnose', onDiagnoseCodex)}><Search size={16} />{workingCodexAction === 'diagnose' ? '诊断中' : '诊断'}</button></SettingRow>
            <SettingRow label="工作空间工具状态" description={tools.error || (tools.installed ? `Node.js ${tools.nodeVersion} · Python ${tools.pythonVersion} · pip ${tools.pipVersion}` : '工具已随应用预置；启动时自动离线安装。')}><span className="settings-value">{tools.installed ? '已安装' : tools.error ? '需要修复' : '未安装'}</span></SettingRow>
            <SettingRow label="工作空间工具" description="使用应用内置工具包离线安装或修复；不会联网，已有项目文件和可用安装会保留。"><button className="secondary-button settings-reinstall-button" disabled={Boolean(workingCodexAction)} onClick={() => runCodexAction('reinstall', onReinstallTools)}><RotateCcw size={16} />{workingCodexAction === 'reinstall' ? '安装中' : '重新安装'}</button></SettingRow>
            <SettingRow label="更新 Codex CLI" description="检查并安装可用的 CLI 新版本；与工作空间工具重装分别管理。"><button className="secondary-button settings-update-button" disabled={Boolean(workingCodexAction)} onClick={() => runCodexAction('update', onUpdateCodex)}><RefreshCw size={16} />{workingCodexAction === 'update' ? '更新中' : '检查更新'}</button></SettingRow>
          </SettingsGroup>
          <p className="settings-footnote">{scope === 'shared' ? '默认设置由两个 Scodex CLI 启动器共享；工作空间覆盖项优先生效。' : scopeState?.inherited ? '当前工作空间继承 Scodex 默认；修改后只覆盖相应选项。' : '当前工作空间已设置覆盖项；其余选项继续继承 Scodex 默认。'}新开的 CLI 会话读取相同规则。</p>
          <SettingsGroup title="配置文件">
            <SettingRow label="设置保存位置" description={scopeState?.path || '当前没有可用的 Scodex 配置目录。'} wide><span className="settings-value">自动保存</span></SettingRow>
            {scope === 'workspace' && <SettingRow label="恢复默认设置" description="清除当前工作空间的界面配置覆盖，重新继承 Scodex 默认。"><button className="secondary-button" disabled={savingAgent || scopeState?.inherited} onClick={() => updateAgentSetting(null)}>使用默认设置</button></SettingRow>}
          </SettingsGroup>
          {codexAction && <section className="settings-diagnostic" aria-live="polite"><div className="settings-diagnostic-heading"><strong>{codexAction.kind === 'diagnose' ? '诊断结果' : codexAction.kind === 'reinstall' ? '工作空间安装结果' : '更新结果'}</strong><span>{codexAction.status === 'running' ? '处理中' : codexAction.status === 'complete' ? '执行完成' : codexAction.status === 'cancelled' ? '已取消' : '未完成'}</span></div>{codexAction.status === 'running' && toolProgress && <p role="status">{toolProgress}</p>}{codexAction.health && <p>报告状态：{codexAction.health === 'ok' ? '正常' : ['warning', 'warn'].includes(codexAction.health) ? '有警告，请查看报告' : ['error', 'fail'].includes(codexAction.health) ? '发现问题，请查看报告' : codexAction.health}</p>}{codexAction.truncated && <p>下方显示报告末尾，完整内容可打开本机报告查看。</p>}{codexAction.output && <pre tabIndex={0} aria-label="Scodex 操作报告">{codexAction.output}</pre>}{codexAction.logPath && <p><button className="secondary-button" onClick={onOpenCodexDiagnostic}><FolderOpen size={16} />打开完整报告</button></p>}{codexAction.status === 'complete' && codexAction.kind === 'update' && <p>请重新启动 Codex CLI 会话以加载更新后的工具。</p>}{codexAction.status === 'failed' && codexAction.exitCode !== undefined && <p>退出代码：{codexAction.exitCode}</p>}</section>}
          <p className="settings-footnote">审批、沙盒、网络和依赖设置会随两个 Scodex CLI 启动器生效，并约束工作台本机入口。完整访问仍受 Windows UAC 和当前用户文件权限限制，不会自动获得管理员令牌。</p>
        </>}
        {active === 'skills' && <PluginSettings preferences={preferences} skills={skills} onPreference={onPreference} onRefreshSkills={onRefreshSkills} />}
        {active === 'computer' && <ComputerSettings preferences={preferences} desktopApps={appState?.desktopApps} onPreference={onPreference} />}
        {active === 'browser' && <BrowserSettings preferences={preferences} onPreference={onPreference} />}
        {active === 'git' && <GitSettings preferences={preferences} onPreference={onPreference} />}
        {active === 'about' && <><SettingsGroup title="Scodex 工作台"><SettingRow label="当前版本"><span className="settings-value">{appState?.version || '—'}</span></SettingRow><SettingRow label="运行方式" description="Windows 本地桌面 EXE；模型通过已配置的中转站提供输出。"><span className="settings-value">本地运行</span></SettingRow><SettingRow label="上下文用量"><span className="settings-value">中转站未提供 token 用量数据</span></SettingRow></SettingsGroup><p className="settings-footnote">支持对话、项目与最近记录；本地输入输出由 AI 按需求处理。模型输出取决于服务可用性。</p></>}
      </div> : <div className="settings-search-empty"><Search size={30} /><h2>没有匹配的设置</h2><p>试试“字体”“标签”或“模型”。</p><button className="secondary-button" onClick={() => setSearch('')}>清除搜索</button></div>}
    </div>
    {licensesOpen && <LicenseDialog onClose={() => setLicensesOpen(false)} />}
  </section>;
}
