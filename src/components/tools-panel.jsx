import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, CalendarClock, Command, FileCode2, FileSpreadsheet, FolderOpen, GitBranch, Globe, Image, Keyboard, MessageSquare, Puzzle, RefreshCw, Search, Settings, Terminal, X } from 'lucide-react';
import { TOOL_GROUPS, matchTools } from '../lib/tool-catalog.js';
const ICONS = { chat: MessageSquare, project: FolderOpen, file: FileCode2, table: FileSpreadsheet, image: Image, terminal: Terminal, browser: Globe, clock: CalendarClock, plugin: Puzzle, skill: BookOpen, settings: Settings, git: GitBranch, keyboard: Keyboard };
export function ToolIcon({ name, size = 20 }) { const Icon = ICONS[name] || Command; return <Icon size={size} />; }

export function ToolsPanel({ inventory, loading, error, onRefresh, onAction, onRevealSource }) {
  const [query, setQuery] = useState(''); const [group, setGroup] = useState('全部');
  const tools = matchTools(query, group);
  return <section className="tool-view tools-overview" aria-label="工具与操作">
    <header className="tools-heading"><div><span className="tools-eyebrow">SCODEX WORKSPACE</span><h1>工具与操作</h1><p>项目、办公、自动化和扩展，在一个工作台里继续。</p></div><button className="secondary-button" onClick={onRefresh} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} />重新读取本机能力</button></header>
    <div className="tools-search-row"><label className="tools-search"><Search size={18} /><input aria-label="搜索工作台工具" placeholder="搜索工具、操作或快捷键" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span><kbd>Ctrl Shift P</kbd> 随时搜索</span></div>
    <div className="tools-filters" role="group" aria-label="工具分类">{TOOL_GROUPS.map((name) => <button key={name} aria-pressed={group === name} className={group === name ? 'active' : ''} onClick={() => setGroup(name)}>{name}</button>)}</div>
    <div className="tools-grid">{tools.map((tool) => <button className="tool-card" key={tool.id} onClick={() => onAction(tool.id)}><span className="tool-card-icon"><ToolIcon name={tool.icon} /></span><span className="tool-card-copy"><strong>{tool.label}</strong><span>{tool.description}</span>{tool.shortcut && <kbd>{tool.shortcut}</kbd>}</span></button>)}</div>{!tools.length && <p className="tools-empty" role="status">没有匹配的工具，请尝试“文件”“技能”或“配置”。</p>}
    <section className="local-capability-section"><div className="tools-section-heading"><div><h2>本机 .codex 能力来源</h2><p>按真实文件读取；配置与凭据保持原样。</p></div><span>{inventory?.plugins?.length || 0} 个插件 · {inventory?.servers?.length || 0} 个 MCP 配置</span></div>
      {error && <div className="tools-inline-error" role="alert">{error}<button onClick={onRefresh}>重新读取</button></div>}
      {loading && !inventory && <p role="status">正在读取本机能力…</p>}
      <div className="capability-source-list">{inventory?.sources?.map((source) => <article className="capability-source" key={source.id}><FolderOpen size={19} /><div><strong>{source.label}</strong><code>{source.path}</code><span>{source.warning || (source.configReadable ? '配置已读取 · 仅显示名称与启用状态' : '此目录没有 config.toml，已读取可用技能目录')}</span></div><button className="text-tool" onClick={() => onRevealSource(source.id)}>打开目录</button></article>)}</div>
      {!loading && inventory && !inventory.sources.length && <p className="tools-empty">未发现本机配置目录，可在技能设置中添加本地目录。</p>}
      {Boolean(inventory?.servers?.length) && <><h3 className="mcp-list-heading">已配置的 MCP 服务</h3><div className="local-mcp-list">{inventory.servers.map((server) => <article key={server.id}><Puzzle size={17} /><div><strong>{server.name}</strong><span>{server.source} · {server.enabled === false ? '配置已停用' : '已配置'}</span></div><span className="capability-badge">Scodex 运行时未连接</span></article>)}</div></>}
      <p className="tools-boundary-note">本地编辑器、终端、表格、图片和定时任务可从上方打开。Codex 专属的电脑操控、浏览器代理、外部插件工具和 MCP 进程需要各自运行环境；发现安装文件不代表已连接。<button className="text-tool" onClick={() => onAction('plugins')}>查看插件与技能</button></p>
    </section>
  </section>;
}

export function CommandPalette({ onAction, onClose }) {
  const ref = useRef(null); const input = useRef(null); const previousFocus = useRef(document.activeElement);
  const [query, setQuery] = useState(''); const [selected, setSelected] = useState(0); const tools = matchTools(query);
  const run = (tool) => { if (!tool) return; onClose(); onAction(tool.id); };
  useEffect(() => { const dialog = ref.current; dialog.showModal(); input.current?.focus(); return () => { dialog.close(); const element = previousFocus.current; if (element?.isConnected) element.focus(); }; }, []);
  useEffect(() => { ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [selected]);
  return <dialog ref={ref} className="command-palette" aria-labelledby="command-palette-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const b=event.currentTarget.getBoundingClientRect(); if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)onClose(); } }} onKeyDown={(event) => {
    if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key) && !event.nativeEvent.isComposing) { event.preventDefault(); if (event.key === 'Enter') run(tools[selected]); else setSelected((value) => tools.length ? (value + (event.key === 'ArrowDown' ? 1 : -1) + tools.length) % tools.length : 0); }
  }}><h2 id="command-palette-title" className="sr-only">搜索工作台操作</h2><div className="command-search"><Search size={20} /><input ref={input} role="combobox" aria-label="搜索工作台操作" aria-expanded="true" aria-controls="workbench-commands" aria-autocomplete="list" aria-activedescendant={tools[selected] ? 'command-' + tools[selected].id : undefined} placeholder="输入工具名称或操作…" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} /><button className="icon-button" aria-label="关闭工具搜索" onClick={onClose}><X size={18} /></button></div><div id="workbench-commands" className="command-list" role="listbox">{tools.map((tool, index) => <div role="option" id={'command-' + tool.id} aria-selected={selected === index} className={selected === index ? 'selected' : ''} key={tool.id} onMouseMove={() => setSelected(index)} onClick={() => run(tool)}><ToolIcon name={tool.icon} size={18} /><span><strong>{tool.label}</strong><small>{tool.group}</small></span>{tool.shortcut && <kbd>{tool.shortcut}</kbd>}</div>)}{!tools.length && <p className="tools-empty">没有匹配的操作</p>}</div><footer><span>↑ ↓ 选择</span><span>Enter 打开</span><span>Esc 关闭</span></footer></dialog>;
}
