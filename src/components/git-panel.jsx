import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, FileCode2, FolderGit2, GitBranch, GitCommitHorizontal, GitFork, GitPullRequest, LoaderCircle, RefreshCw, RotateCcw, Trash2, Upload } from 'lucide-react';
import { GitHubPulls } from './github-pulls.jsx';
const message = error => String(error?.message || error).replace(/^Error invoking remote method '[^']+': /, '');
export function GitPanel({ workspaceRoot, blocked, branchPrefix = 'scodex/', draftPullRequest = true, mergeMethod = 'merge', onOpenFile, onOpenWorktree }) {
  const [state, setState] = useState(null), [selection, setSelection] = useState(null), [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false), [working, setWorking] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [commitMessage, setCommitMessage] = useState(''), [branch, setBranch] = useState(''), [branchForm, setBranchForm] = useState(false), [resetTarget, setResetTarget] = useState('HEAD'), [resetMode, setResetMode] = useState('mixed'), [trees, setTrees] = useState([]), [selectedRemote, setSelectedRemote] = useState('');
  const [prWorking, setPrWorking] = useState(false);
  const prBusy = useRef(false);
  const handlePrBusy = useCallback(value => { prBusy.current = value; setPrWorking(value); }, []);
  const epoch = useRef(0), busy = useRef(false), scope = useRef(workspaceRoot); scope.current = workspaceRoot;
  const refresh = useCallback(async () => {
    if (busy.current || prBusy.current) return;
    const id = ++epoch.current; setLoading(true); setError('');
    try { const value = await window.scodex.gitSnapshot(workspaceRoot); if (id === epoch.current) setState(value); }
    catch (e) { if (id === epoch.current) { setError(message(e)); setState(null); } }
    finally { if (id === epoch.current) setLoading(false); }
  }, [workspaceRoot]);
  const refreshTrees = useCallback(async () => {
    const root = workspaceRoot;
    try { const value = await window.scodex.listWorktrees(); if (scope.current === root) setTrees(value.trees); } catch (e) { if (scope.current === root) setError(message(e)); }
  }, [workspaceRoot]);
  useEffect(() => { setState(null); setSelection(null); setDiff(null); setNotice(''); setCommitMessage(''); setBranchForm(false); setSelectedRemote(''); refresh(); refreshTrees(); window.addEventListener('focus', refresh); return () => { ++epoch.current; window.removeEventListener('focus', refresh); }; }, [refresh, refreshTrees]);
  useEffect(() => {
    if (!state?.available) return;
    setSelectedRemote(current => state.remotes.includes(current) ? current : state.upstream?.remote || state.remotes[0] || '');
  }, [state]);
  useEffect(() => {
    let active = true; setDiff(null);
    if (state?.available && selection) {
      const file = state.files.find(f => f.path === selection.path && (selection.staged ? f.staged : f.unstaged));
      if (!file) { setSelection(null); return; }
      window.scodex.gitDiff(workspaceRoot, { ...selection, token: state.token }).then(value => { if (active) setDiff(value); }).catch(e => { if (active) setError(message(e)); });
    }
    return () => { active = false; };
  }, [state, selection, workspaceRoot]);
  async function perform(type, extra = {}) {
    if (busy.current || prBusy.current || blocked || !state?.available) return;
    busy.current = true; ++epoch.current; setWorking(true); setLoading(false); setError(''); setNotice('');
    const root = workspaceRoot;
    try {
      const result = await window.scodex.gitMutate(root, { type, token: state.token, ...extra });
      if (scope.current !== root) return;
      setState(result.state); setNotice(result.cancelled ? (type === 'discard' ? '已取消丢弃' : '已取消重置') : ({ stage: '已暂存所选文件', unstage: '已取消暂存，工作文件保持', commit: '已创建本地提交', branch: '已创建并切换分支', discard: '已丢弃所选文件修改', reset: '已完成 Git 重置' })[type]);
      if (type === 'commit') setCommitMessage('');
      if (type === 'branch') setBranchForm(false);
    } catch (e) { if (scope.current === root) setError(message(e)); }
    finally { busy.current = false; if (scope.current === root) setWorking(false); }
  }
  async function remoteAction(type) {
    if (busy.current || prBusy.current || blocked || !state?.available) return;
    busy.current = true; ++epoch.current; setWorking(true); setLoading(false); setError(''); setNotice('');
    const root = workspaceRoot;
    try {
      const result = await window.scodex.gitRemote(root, { type, remote: selectedRemote, token: state.token });
      if (scope.current !== root) return;
      setState(result.state);
      setNotice(result.cancelled ? '已取消推送' : result.warning || ({ fetch: '远端状态已刷新', pull: '已完成快进拉取', push: '普通推送已完成' })[type]);
    } catch (e) { if (scope.current === root) setError(message(e)); }
    finally { busy.current = false; if (scope.current === root) setWorking(false); }
  }
  async function treeAction(action) {
    if (working || prBusy.current || blocked) return;
    setWorking(true); setError('');
    try { await action(); await refreshTrees(); } catch (e) { setError(message(e)); } finally { setWorking(false); }
  }
  const staged = state?.files.filter(f => f.staged) || [], unstaged = state?.files.filter(f => f.unstaged) || [];
  const selectedFile = selection && state?.files.find(f => f.path === selection.path);
  const locked = working || loading || blocked || prWorking;
  const canPull = Boolean(state?.upstream && state.upstream.behind > 0 && state.upstream.ahead === 0 && !state.files.length);
  const pushRemote = state?.upstream?.remote || selectedRemote;
  const canPush = Boolean(state?.head && state?.branch && state?.remotes.includes(pushRemote));
  const list = (files, stagedView) => <section className="git-file-group"><h2>{stagedView ? '已暂存的更改' : '工作区更改'} <span>{files.length}</span></h2>{files.map(file => <button type="button" key={file.path} className={'git-file-row ' + (selection?.path === file.path && selection.staged === stagedView ? 'selected' : '')} disabled={working || prWorking} aria-label={'查看' + (stagedView ? '已暂存' : '未暂存') + '差异 ' + file.path} onClick={() => { setError(''); setSelection({ path: file.path, staged: stagedView }); }}><FileCode2 size={17}/><span title={file.path}>{file.path}{file.oldPath && <small>原路径：{file.oldPath}</small>}</span><b className={file.conflict ? 'git-conflict' : ''}>{file.conflict ? '冲突' : file.untracked ? '新' : stagedView ? file.index : file.working}</b></button>)}{!files.length && <p className="git-empty-row">暂无更改</p>}</section>;
  return <section className="git-panel" aria-label="版本控制工作台">
    <div className="tool-heading"><div><h1><GitBranch size={27}/>版本控制</h1><p>{workspaceRoot}</p></div><button className="secondary-button" onClick={() => { refresh(); refreshTrees(); }} disabled={working || loading || prWorking}><RefreshCw size={17} className={loading ? 'spin' : ''}/>刷新仓库</button></div>
    {error && <div role="alert" className="git-alert">{error}</div>}{notice && <div role="status" className="git-notice"><Check size={17}/>{notice}</div>}
    {blocked && <p className="git-alert">请先保存编辑内容并停止运行中的任务，再进行 Git 写入或切换工作树。</p>}
    {loading && !state && <p><LoaderCircle size={18} className="spin"/>正在读取仓库…</p>}
    {state && !state.available && <div className="git-unavailable"><FolderGit2 size={36}/><h2>项目尚未连接 Git 仓库</h2><p>{state.message}</p></div>}
    {state?.available && <><div className="git-branch-bar"><span><GitBranch size={18}/>{state.branch || '分离 HEAD'}<code>{state.head ? state.head.slice(0, 9) : '尚无提交'}</code></span><button className="secondary-button" disabled={locked || !state.head} onClick={() => { setBranch(branchPrefix); setBranchForm(v => !v); }}>新建分支</button></div>
      <section className="git-remote-sync" aria-label="远端同步">
        <div className="git-remote-heading"><h2><GitPullRequest size={20}/>远端同步</h2><span>{state.upstream ? `跟踪 ${state.upstream.name}` : '当前分支未设置跟踪分支'}</span></div>
        <div className="git-remote-toolbar"><label>远端<select aria-label="Git 远端" value={selectedRemote} onChange={e => setSelectedRemote(e.target.value)} disabled={locked || !state.remotes.length}><option value="">选择远端</option>{state.remotes.map(name => <option key={name} value={name}>{name}</option>)}</select></label><button className="secondary-button" disabled={locked || !state.remotes.length || !selectedRemote} onClick={() => remoteAction('fetch')}><RefreshCw size={17} className={working ? 'spin' : ''}/>获取远端更新</button><button className="secondary-button" disabled={locked || !canPull} onClick={() => remoteAction('pull')}><GitPullRequest size={17}/>快进拉取 Pull</button><button className="secondary-button" disabled={locked || !canPush} onClick={() => remoteAction('push')}><Upload size={17}/>普通推送 Push</button></div>
        <div className="git-remote-status">{state.upstream ? <><span>本地领先 {state.upstream.ahead ?? '—'} 个提交</span><span>远端领先 {state.upstream.behind ?? '—'} 个提交</span></> : <span>Fetch 只更新远端引用；需要拉取时先 Fetch，Pull 仅快进且要求工作区干净。</span>}{state.upstream && <span>推送目标：{state.upstream.remote}/{state.upstream.branch}</span>}</div>
        {state.upstream && <p className="git-remote-help">Pull 会先获取上游提交并执行快进；分叉或存在工作区改动时不会拉取。Push 前会显示系统确认，始终使用普通推送。</p>}
      </section>
      <GitHubPulls workspaceRoot={workspaceRoot} remote={selectedRemote} token={state.token} branch={state.branch} blocked={working || loading || blocked} draftPullRequest={draftPullRequest} mergeMethod={mergeMethod} onBusyChange={handlePrBusy}/>
      {branchForm && <form className="git-branch-form" onSubmit={e => { e.preventDefault(); perform('branch', { branch }); }}><label>新分支名称<input aria-label="新分支名称" value={branch} maxLength={180} onChange={e => setBranch(e.target.value)}/></label><button className="primary-button" disabled={locked || !branch.trim()}>创建并切换</button><button type="button" className="secondary-button" onClick={() => setBranchForm(false)} disabled={working || prWorking}>取消</button></form>}
      <div className="git-review-grid"><aside className="git-file-list">{list(staged, true)}{list(unstaged, false)}</aside><div className="git-diff-pane"><div className="git-diff-toolbar"><strong>{selection?.path || '选择文件查看差异'}</strong>{selection && <span>{selection.staged ? '已暂存' : '工作区'}</span>}<div>{selection && <><button className="secondary-button" disabled={locked || !diff || selectedFile?.conflict} onClick={() => perform(selection.staged ? 'unstage' : 'stage', { ...selection, contentToken: diff.contentToken })}>{selection.staged ? '取消暂存' : '暂存此文件'}</button><button className="secondary-button git-destructive-button" disabled={locked || !diff || selectedFile?.conflict} onClick={() => perform('discard', { path: selection.path, staged: selection.staged, contentToken: diff.contentToken })}><Trash2 size={15}/>丢弃此文件</button><button className="secondary-button" disabled={working || prWorking} onClick={() => onOpenFile(workspaceRoot + '/' + selection.path)}>打开文件</button></>}</div></div>
      {diff ? <><pre className="git-diff-content" aria-label="Git 文件差异">{diff.text ? diff.text.split('\n').map((line, i) => <span key={i} className={line.startsWith('+') && !line.startsWith('+++') ? 'added' : line.startsWith('-') && !line.startsWith('---') ? 'removed' : line.startsWith('@@') ? 'hunk' : ''}>{line || ' '}<br/></span>) : '没有可显示的文本差异。二进制文件或权限变化请结合文件状态查看。'}</pre>{diff.truncated && <p className="git-alert">差异内容较长，当前显示前 200000 字符；完整差异请在终端查看。</p>}</> : <p className="git-diff-placeholder">{selection ? '正在读取差异…' : '先检查文件差异，再选择暂存并提交。'}</p>}</div></div>
      <form className="git-commit-form" onSubmit={e => { e.preventDefault(); perform('commit', { message: commitMessage }); }}><label>提交说明<textarea aria-label="Git 提交说明" rows={2} value={commitMessage} maxLength={10000} onChange={e => setCommitMessage(e.target.value)} placeholder="说明本次改动的目的"/></label><button className="primary-button" disabled={locked || !staged.length || state.conflict || !commitMessage.trim()}>{working ? <LoaderCircle size={17} className="spin"/> : <GitCommitHorizontal size={18}/>}提交已暂存的更改</button><p>只提交暂存内容，保留未暂存文件。本地提交跳过仓库钩子及签名；仓库身份沿用 Git 配置。</p></form>
      <form className="git-reset-form" onSubmit={e => { e.preventDefault(); perform('reset', { target: resetTarget, mode: resetMode }); }}>
        <div className="git-reset-heading"><h2><RotateCcw size={19}/>重置当前分支</h2></div>
        <label>目标提交<input aria-label="Git 重置目标提交" placeholder="HEAD、HEAD~1 或提交 SHA" value={resetTarget} maxLength={64} onChange={e => setResetTarget(e.target.value)} disabled={locked || !state.head || !state.branch}/></label>
        <label>重置模式<select aria-label="Git 重置模式" value={resetMode} onChange={e => setResetMode(e.target.value)} disabled={locked || !state.head || !state.branch}><option value="soft">Soft：仅移动分支</option><option value="mixed">Mixed：保留工作文件，重置暂存区</option><option value="hard">Hard：覆盖已跟踪文件</option></select></label>
        <button className="secondary-button git-destructive-button" disabled={locked || !state.head || !state.branch || !resetTarget.trim()}><RotateCcw size={15}/>重置分支</button>
        <p>{resetMode === 'hard' ? 'Hard 重置可能覆盖与目标提交路径冲突的未跟踪文件；不会清理其他未跟踪文件。每次操作都会显示系统确认。' : 'Soft 和 Mixed 会改写当前分支指向；工作文件保留。每次操作都会显示系统确认。'}</p>
      </form>
      <section className="git-worktrees"><div className="git-worktree-heading"><div><h2><GitFork size={21}/>隔离工作树</h2><p>从当前 HEAD 创建独立工作副本，作为项目打开后执行任务。</p></div><button className="secondary-button" disabled={locked || !state.head} onClick={() => treeAction(async () => { await window.scodex.createWorktree(true); setNotice('工作树已创建，可在下方作为项目打开'); })}>创建隔离工作树</button></div>{trees.map(tree => <div className="git-worktree-row" key={tree.id}><div><strong>{tree.name}</strong><p>{tree.path}</p>{tree.error && <p role="alert">{tree.error}</p>}</div><span>{tree.current ? '当前项目' : tree.dirty ? '有本地内容' : tree.changedHead ? '有新提交' : '干净'}</span><button className="secondary-button" disabled={locked || tree.current || Boolean(tree.error)} onClick={() => treeAction(() => onOpenWorktree(tree.id))}>作为项目打开</button></div>)}{!trees.length && <p className="git-empty-row">还没有托管工作树。原仓库的未提交修改不会复制到新工作树。</p>}</section>
    </>}
  </section>;
}
