import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, FolderOpen, LoaderCircle, MessageSquare, Plus, Square } from 'lucide-react';
import { MessageBubble } from '../workbench.jsx';
import { MessageRevisionDialog } from './conversation-revisions.jsx';
import { revisionStamp, revisionSource } from '../lib/conversation-revisions.js';

export function WorkspaceWindow() {
  const [snapshot,setSnapshot]=useState(null),[draft,setDraft]=useState(''),[error,setError]=useState(''),[waiting,setWaiting]=useState(false),[copied,setCopied]=useState(''),[revisionRequest,setRevisionRequest]=useState(null);
  const inputRef=useRef(null),endRef=useRef(null),draftRef=useRef(''),pendingDraftRef=useRef(null);
  useEffect(()=>{
    let mounted=true;
    const update=value=>{if(!mounted)return;setSnapshot(value);const text=value?.chat?.draft||'';if(pendingDraftRef.current===null||pendingDraftRef.current===text){setDraft(text);draftRef.current=text;pendingDraftRef.current=null;}};
    window.scodexWindow.getSnapshot().then(update).catch(e=>setError(e.message));
    const off=window.scodexWindow.onSnapshot(update);return()=>{mounted=false;off();};
  },[]);
  useEffect(()=>{endRef.current?.scrollIntoView({block:'end'});},[snapshot?.chat?.messages]);
  async function action(input) { setError('');try{return await window.scodexWindow.action(input);}catch(e){setError(e.message);return false;} }
  async function send() {
    if(!draft.trim()||waiting)return;setWaiting(true);
    const text=draft;setDraft('');draftRef.current='';pendingDraftRef.current='';
    if(await action({type:'draft',text:''})===false){setDraft(text);draftRef.current=text;pendingDraftRef.current=null;setWaiting(false);return;}
    try{const result=await action({type:'send',text});if(result===false&&!draftRef.current){setDraft(text);draftRef.current=text;pendingDraftRef.current=text;await action({type:'draft',text});}}finally{setWaiting(false);}
  }
  const chat=snapshot?.chat,busy=chat?.messages.some(m=>m.pending),archived=Boolean(chat?.archivedAt||snapshot?.project?.archivedAt),preferences=snapshot?.preferences||{};
  const openRevision = (kind, messageId) => { try { setRevisionRequest({kind,messageId,stamp:revisionStamp(chat),source:structuredClone(revisionSource(chat,kind,messageId).user)}); } catch(e){setError(e.message);} };
  const retryUser = (message) => {
    if (message?.role !== 'user') { setError('找不到对应的用户消息。'); return; }
    const index = chat.messages.findIndex(item => item.id === message.id && item.role === 'user');
    if (index < 0) { setError('原消息已变化，请刷新后重试。'); return; }
    const discarded = chat.messages.slice(index + 1);
    const discardFollowing = discarded.some(item => item.role === 'user');
    const discardEffects = discarded.some(item => item.fileChanges || item.operations?.some(operation => operation.status === 'succeeded'));
    if ((discardFollowing || discardEffects) && !window.confirm((discardFollowing ? '重试这条较早的消息会移除它之后的对话。' : '') + (discardEffects ? '原回答的操作记录和撤销入口将移除，但已执行的文件操作不会回滚。' : '') + '确定继续吗？')) return;
    action({ type:'revise', kind:'retry', messageId:message.id, text:message.content, stamp:revisionStamp(chat), discardFollowing, discardEffects });
  };
  const style={'--ui-font-size':(preferences.fontSize||16)+'px','--font-step':((preferences.fontSize||16)-16)+'px','--ui-font-family':'"Microsoft YaHei","微软雅黑",sans-serif'};
  return <main className="detached-workspace" style={style} data-theme={preferences.themeMode==='dark'?'dark':'light'}>
    <header className="detached-heading"><div><FolderOpen size={18}/><span><strong>{snapshot?.title||'正在打开工作台…'}</strong><small>{snapshot?.project?.name||'Scodex'}{archived?' · 已归档':''}</small></span></div><button type="button" className="secondary-button" disabled={!snapshot?.available} onClick={()=>action({type:'focus'})}><ArrowUpRight size={16}/>在主工作台中打开</button></header>
    {!snapshot&&<div className="detached-empty"><LoaderCircle size={22} className="spin"/>正在同步工作台…</div>}
    {snapshot&&!snapshot.available&&<div className="detached-empty">此项目或聊天已被删除，请回到主工作台。</div>}
    {snapshot?.available&&snapshot.kind==='project'&&<section className="detached-project"><div className="detached-project-heading"><h1>{snapshot.title}</h1><button type="button" className="primary-button" disabled={archived} onClick={()=>action({type:'new-chat'})}><Plus size={16}/>新建聊天</button></div><p>{snapshot.project.path}</p><div className="history-list">{snapshot.chats.map(c=><button type="button" key={c.id} className="detached-project-chat" onClick={()=>action({type:'open-chat',chatId:c.id})}><MessageSquare size={18}/><span><strong>{c.title}</strong><small>{c.archivedAt?'已归档':c.running?'运行中':c.unreadResult?'有新结果':'本机聊天'}</small></span><ArrowUpRight size={16}/></button>)}</div>{!snapshot.chats.length&&<p>项目中还没有聊天。新建聊天会在独立窗口打开。</p>}</section>}
    {snapshot?.available&&snapshot.kind==='chat'&&<>
      {revisionRequest?.kind==='regenerate' && <MessageRevisionDialog chat={chat} request={revisionRequest} canExecute={snapshot.canExecute} onClose={()=>setRevisionRequest(null)} onSubmit={async input=>{const result=await action({...input,type:'revise'});if(result===false)throw Error('版本操作未执行，请查看窗口提示。');}}/>}
      <div className="detached-messages conversation-scroll"><div className="message-list">{chat.messages.map((m,index)=><MessageBubble key={m.id} message={m} conversationId={chat.id} copied={copied===m.id}
        onCopy={()=>navigator.clipboard.writeText(m.content||'').then(()=>setCopied(m.id)).catch(e=>setError(e.message))}
        onEdit={()=>openRevision('edit',m.id)} editRequest={revisionRequest?.kind==='edit' && revisionRequest.messageId===m.id ? revisionRequest : null} onEditCancel={()=>setRevisionRequest(null)} onEditSubmit={async input=>{const result=await action({...input,type:'revise'});if(result===false)throw Error('消息编辑未执行，请查看窗口提示。');}} canExecute={snapshot.canExecute}
        onRegenerate={()=>openRevision('regenerate',m.id)} onFork={()=>action({type:'fork',messageId:m.id})} actionsDisabled={busy||archived||waiting}
        onRetryUser={()=>retryUser(m)}
        onRetry={()=>{if(!m.operations?.length){retryUser(chat.messages[index-1]);return;}const original=chat.messages[index-1]?.content||'继续未完成任务';action({type:'send',text:'继续未完成的任务：'+original+'\n先检查已有操作和失败原因，保留已完成的修改。'});}}
        onApproval={(id,allowed)=>action({type:'approval',approvalId:id,allowed})}
        onOpenFile={path=>action({type:'file',path})} onBrowser={()=>action({type:'focus'})} onServices={()=>action({type:'focus'})}/>
      )}<div ref={endRef}/>{!chat.messages.length&&<div className="detached-empty"><MessageSquare size={28}/><strong>在这里继续你的工作</strong><p>回复、审批与停止会实时同步到主工作台。</p></div>}</div></div>
      <div className="detached-composer"><textarea ref={inputRef} aria-label="独立窗口输入工作内容" placeholder={archived?'聊天已归档，请先在主工作台恢复':'输入工作内容…'} value={draft} disabled={archived} maxLength={64000}
        onChange={e=>{setDraft(e.target.value);draftRef.current=e.target.value;pendingDraftRef.current=e.target.value;action({type:'draft',text:e.target.value});}}
        onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent.isComposing){e.preventDefault();send();}}}/>
        <div><span>{chat.model||snapshot.model} · {chat.mode==='plan'?'规划只读':snapshot.canExecute?'自动衔接':'仅对话'}</span>
        {busy?<><button type="button" className="send-button stop-button" aria-label="独立窗口停止生成" onClick={()=>action({type:'stop'})}><Square size={15}/></button><button type="button" className="send-button steering-send-button" aria-label="独立窗口提交引导但不中断模型运行" title="提交引导 · 不中断模型运行" disabled={!draft.trim()||waiting||archived} onClick={send}><ArrowUp size={18}/></button></>:<button type="button" className="send-button" aria-label="独立窗口发送消息" disabled={!draft.trim()||waiting||archived} onClick={send}><ArrowUp size={18}/></button>}</div></div>
    </>}
    {error&&<div className="detached-error" role="alert">{error}</div>}
    <footer className="detached-footer">本机实时窗口 · 任务与主工作台共享项目，关闭此窗口后任务继续运行。</footer>
  </main>;
}
