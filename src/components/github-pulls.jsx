import React, { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, GitMerge, GitPullRequest, KeyRound, LoaderCircle, Plus, RefreshCw, X } from 'lucide-react';

const errorMessage = error => String(error?.message || error).replace(/^Error invoking remote method '[^']+': /, '');
const stateLabel = pull => pull.state === 'merged' ? '已合并' : pull.state === 'closed' ? '已关闭' : pull.draft ? '草稿' : '待审查';
function PullDialog({ title, subtitle, busy, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog className="pr-dialog" ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" className="secondary-button" aria-label="关闭 PR 对话框" disabled={busy} onClick={onClose}><X size={20}/></button></header>
    <div className="pr-dialog-scroll">{children}</div>
    <footer>{footer}</footer>
  </dialog>;
}
export function GitHubPulls({ workspaceRoot, remote, token, branch, blocked, draftPullRequest = true, mergeMethod = 'merge', onBusyChange }) {
  const [auth, setAuth] = useState(null), [authForm, setAuthForm] = useState(false), [credential, setCredential] = useState('');
  const [data, setData] = useState(null), [filter, setFilter] = useState('open'), [working, setWorking] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [dialog, setDialog] = useState(null), [pull, setPull] = useState(null);
  const [title, setTitle] = useState(''), [base, setBase] = useState(''), [body, setBody] = useState(''), [draft, setDraft] = useState(draftPullRequest), [method, setMethod] = useState(mergeMethod);
  const generation = useRef(0), busy = useRef(false);
  useEffect(() => { let active = true; window.scodex.githubStatus().then(value => { if (active) setAuth(value); }).catch(e => { if (active) setError(errorMessage(e)); }); return () => { active = false; }; }, []);
  useEffect(() => { ++generation.current; setData(null); setPull(null); setDialog(null); setError(''); setNotice(''); setBase(''); return () => { ++generation.current; }; }, [workspaceRoot, remote, token]);
  const input = extra => ({ token, remote, ...extra });
  async function run(operation, apply, write = false) {
    if (busy.current || blocked || (write && !auth?.connected)) return;
    const id = generation.current; busy.current = true; setWorking(true); setError(''); setNotice(''); onBusyChange(true);
    try { const value = await operation(); if (id === generation.current) await apply(value, id); }
    catch (e) { if (id === generation.current) setError(errorMessage(e)); }
    finally { busy.current = false; setWorking(false); onBusyChange(false); }
  }
  const load = (page = 1, state = filter) => run(() => window.scodex.githubList(workspaceRoot, input({ page, state })), value => { setData(value); setBase(current => current || value.defaultBranch); setFilter(state); });
  const openDetail = number => run(() => window.scodex.githubDetail(workspaceRoot, input({ number })), value => { setPull(value); setMethod(mergeMethod); setDialog('detail'); });
  async function action(type) {
    await run(() => window.scodex.githubAction(workspaceRoot, input(type === 'create' ? { type, title, base, body, draft } : { type, number: pull.number, headSha: pull.headSha, method })), async (result, id) => {
      if (result.cancelled) { setNotice('已取消，远端未执行本次操作'); return; }
      setPull(current => current?.number === result.pull.number && current.headSha === result.pull.headSha ? { ...current, ...result.pull } : result.pull); setDialog('detail');
      setNotice(result.existing ? '此分支已存在 PR，已打开现有记录' : ({ create: 'PR 已创建并核对远端记录', ready: '已标记为可审查', merge: 'PR 已合并，远端分支保留；本地分支可另行 Fetch／Pull' })[type]);
      // A successful write stays visible even if the subsequent list refresh fails.
      try { const value = await window.scodex.githubList(workspaceRoot, input({ state: filter, page: data?.page || 1 })); if (id === generation.current) setData(value); }
      catch (e) { if (id === generation.current) setError('操作已完成；列表刷新失败：' + errorMessage(e)); }
    }, true);
  }
  const locked = blocked || working;
  const canMerge = pull?.state === 'open' && !pull.draft && pull.mergeable === true && data?.mergeMethods?.[method] !== false;
  const alerts = <>{error && <p className="git-alert" role="alert">{error}</p>}{notice && <p className="git-notice" role="status"><Check size={17}/>{notice}</p>}</>;
  return <section className="pr-workbench" aria-label="GitHub Pull Request">
    <div className="pr-heading"><div><h2><GitPullRequest size={22}/>Pull Request</h2><p>{data?.repository || '将当前 GitHub 仓库的分支提交审查与合并'}</p></div><button type="button" className="secondary-button" disabled={locked} aria-expanded={authForm} onClick={() => { setAuthForm(value => !value); setCredential(''); }}><KeyRound size={17}/>{auth?.connected ? auth.login : '连接 GitHub'}</button></div>
    {authForm && <form className="pr-auth-form" onSubmit={event => { event.preventDefault(); run(() => window.scodex.githubConnect(credential), value => { setAuth(value); setCredential(''); setAuthForm(false); setNotice('GitHub 已连接，令牌已在本机加密保存'); }); }}>
      <label>GitHub 访问令牌<input type="password" autoComplete="off" spellCheck="false" aria-label="GitHub 访问令牌" maxLength={8192} value={credential} onChange={event => setCredential(event.target.value)} placeholder="输入有目标仓库授权的访问令牌" disabled={locked}/></label>
      <p>令牌仅用于 api.github.com。精细令牌需授权目标仓库的 Pull requests 读写；读取分支还需 Contents 读取。私有仓库的经典令牌需 repo 权限。</p>
      {auth?.error && <p role="alert">{auth.error}</p>}
      <div><button className="primary-button" disabled={locked || !credential.trim()}>验证并加密保存</button>{auth?.connected && <button type="button" className="secondary-button" disabled={locked} onClick={() => run(() => window.scodex.githubDisconnect(), value => { setAuth(value); setCredential(''); setNotice('已移除本机 GitHub 连接'); })}>断开连接</button>}<button type="button" className="secondary-button" disabled={locked} onClick={() => { setAuthForm(false); setCredential(''); }}>收起</button></div>
    </form>}
    {!dialog && alerts}
    <div className="pr-toolbar"><label>记录范围<select aria-label="PR 记录范围" value={filter} disabled={locked} onChange={event => { if (data) load(1, event.target.value); else setFilter(event.target.value); }}><option value="open">进行中</option><option value="closed">已关闭／合并</option><option value="all">全部</option></select></label><button className="secondary-button" type="button" disabled={locked || !remote} onClick={() => load()}>{working ? <LoaderCircle size={17} className="spin"/> : <RefreshCw size={17}/>}读取 PR</button><button type="button" className="primary-button" disabled={locked || !data || !auth?.connected || !branch} onClick={() => { setDraft(draftPullRequest); setDialog('create'); setError(''); setNotice(''); }}><Plus size={17}/>创建 PR</button></div>
    {!data && <p className="pr-hint">选择 GitHub 远端后读取记录；公开仓库可直接查看，创建及合并需要连接账号。</p>}
    {data && <><div className="pr-list">{data.pulls.map(item => <button type="button" key={item.number} className="pr-record" disabled={locked} aria-label={'查看 PR #' + item.number} onClick={() => openDetail(item.number)}><GitPullRequest size={19}/><span><strong>#{item.number} {item.title}</strong><small>{item.head} → {item.base} · {item.author}</small></span><b data-state={item.state}>{stateLabel(item)}</b></button>)}{!data.pulls.length && <p className="pr-hint">此范围暂无 Pull Request。</p>}</div><div className="pr-pagination"><span>第 {data.page} 页 · 每页最多20条</span><button type="button" className="secondary-button" disabled={locked || data.page === 1} onClick={() => load(data.page - 1)}>上一页</button><button type="button" className="secondary-button" disabled={locked || !data.more || data.page >= 100} onClick={() => load(data.page + 1)}>下一页</button></div></>}
    {dialog === 'create' && <PullDialog title="创建 Pull Request" subtitle={data.repository + ' · ' + branch + ' → ' + base} busy={working} onClose={() => setDialog(null)} footer={<><button type="button" className="secondary-button" disabled={working} onClick={() => setDialog(null)}>取消</button><button type="button" className="primary-button" disabled={locked || !title.trim() || !base.trim() || base === branch} onClick={() => action('create')}>{working ? '正在处理…' : draft ? '创建草稿 PR' : '创建正式 PR'}</button></>}>
      {alerts}<form id="pr-create-form" className="pr-create-fields" onSubmit={event => { event.preventDefault(); if (!locked && title.trim() && base.trim() && base !== branch) action('create'); }}>
        <label>目标分支<input aria-label="PR 目标分支" value={base} maxLength={250} disabled={working} onChange={event => setBase(event.target.value)}/></label>
        <label>标题<input aria-label="PR 标题" value={title} maxLength={256} disabled={working} onChange={event => setTitle(event.target.value)} placeholder="简要说明这次改动" autoFocus/></label>
        <label>说明<textarea aria-label="PR 说明" value={body} maxLength={65536} rows={6} disabled={working} onChange={event => setBody(event.target.value)} placeholder="改动内容、验证方法及需要审查的事项"/></label>
        <label className="pr-draft-option"><input type="checkbox" checked={draft} disabled={working} onChange={event => setDraft(event.target.checked)}/>创建为草稿，准备就绪后再发起审查</label>
        <p className="pr-hint">创建前请先提交并普通推送当前分支。已有相同分支 PR 时会打开原记录。</p>
      </form>
    </PullDialog>}
    {dialog === 'detail' && pull && <PullDialog title={'#' + pull.number + ' ' + pull.title} subtitle={stateLabel(pull) + ' · ' + pull.head + ' → ' + pull.base} busy={working} onClose={() => setDialog(null)} footer={<><button type="button" className="secondary-button" disabled={locked} onClick={() => openDetail(pull.number)}><RefreshCw size={17}/>刷新详情</button><button type="button" className="secondary-button" disabled={locked} onClick={() => run(() => window.scodex.githubOpen(workspaceRoot, input({ number: pull.number })), () => {})}><ExternalLink size={17}/>在 GitHub 打开</button>{pull.state === 'open' && pull.draft && <button type="button" className="primary-button" disabled={locked || !auth?.connected} onClick={() => action('ready')}>标记为可审查</button>}{pull.state === 'open' && !pull.draft && <><label>合并方式<select aria-label="PR 合并方式" value={method} disabled={locked} onChange={event => setMethod(event.target.value)}><option value="merge" disabled={data?.mergeMethods?.merge === false}>合并提交</option><option value="squash" disabled={data?.mergeMethods?.squash === false}>压缩合并</option></select></label><button type="button" className="primary-button" disabled={locked || !auth?.connected || !canMerge} onClick={() => action('merge')}><GitMerge size={17}/>合并 PR</button></>}</>}>
      {alerts}<div className="pr-detail-meta"><span>{pull.author}</span><span>{pull.commits} 个提交</span><span>{pull.changedFiles} 个文件</span><span>+{pull.additions} / −{pull.deletions}</span><code>{pull.headSha?.slice(0, 12)}</code></div>
      <p className="pr-body">{pull.body || '暂无说明。'}</p>
      {pull.state === 'open' && !pull.draft && <p className="pr-hint">{pull.mergeable === true ? 'GitHub 当前可计算合并；仍须通过仓库审查、检查项和分支保护。' : pull.mergeable === false ? '存在冲突，请先解决后重新推送。' : 'GitHub 正在计算合并状态，请稍后刷新详情。'}</p>}
      <details className="pr-files"><summary>变更文件 · {pull.changedFiles} 项{pull.filesTruncated ? '（显示前30项）' : ''}</summary>{pull.files?.map((file, index) => <details className="pr-file-record" key={index}><summary><span>{file.name}</span><span>+{file.additions} / −{file.deletions}</span></summary><pre>{file.patch || '暂无可显示的文本差异；完整内容可在 GitHub 查看。'}</pre></details>)}{!pull.files && <p className="pr-hint">点击“刷新详情”读取文件变更。</p>}</details>
    </PullDialog>}
  </section>;
}
