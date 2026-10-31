import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, FileText, LoaderCircle, RefreshCw, StopCircle } from 'lucide-react';
const labels={resource:'资源',template:'资源模板',prompt:'提示词'};
export function McpContextBrowser({server,onUseContext}) {
  const [catalog,setCatalog]=useState(null),[selected,setSelected]=useState(''),[args,setArgs]=useState({});
  const [preview,setPreview]=useState(null),[busy,setBusy]=useState(''),[error,setError]=useState('');
  const active=useRef(null);
  useEffect(()=>{
    setCatalog(null);setSelected('');setArgs({});setPreview(null);setError('');setBusy('');
    return()=>{const id=active.current;active.current=null;if(id)window.scodex.cancelMcpContext(id).catch(()=>{});};
  },[server.generation,server.contextRevision]);
  const items=catalog?[...catalog.resources,...catalog.templates,...catalog.prompts]:[];
  const item=items.find(v=>v.id===selected);
  async function request(kind,fn) {
    const requestId='ctx-'+window.crypto.randomUUID();active.current=requestId;setBusy(kind);setError('');setPreview(null);
    try {const value=await fn(requestId);if(active.current!==requestId)return;if(kind==='catalog'){setCatalog(value);setSelected('');setArgs({});}else setPreview(value);}
    catch(value){if(active.current===requestId)setError(value.message||'资料请求失败');}
    finally{if(active.current===requestId){active.current=null;setBusy('');}}
  }
  const refresh=()=>request('catalog',requestId=>window.scodex.listMcpContext({id:server.id,requestId}));
  const read=()=>request('read',requestId=>window.scodex.readMcpContext({serverId:server.id,generation:catalog.generation,catalogId:catalog.catalogId,itemId:item.id,arguments:args,requestId}));
  return <section className="mcp-context-browser" aria-label={'MCP资料 '+server.name}>
    <div className="mcp-context-heading"><div><BookOpen size={16}/><strong>资源与提示词</strong></div><div className="heading-actions"><button className="secondary-button" disabled={Boolean(busy)} onClick={refresh}>{busy==='catalog'?<LoaderCircle size={15} className="spin"/>:<RefreshCw size={15}/>} {catalog?'刷新资料目录':'浏览资料目录'}</button>{busy&&<button className="secondary-button" onClick={()=>window.scodex.cancelMcpContext(active.current).catch(e=>setError(e.message))}><StopCircle size={15}/>停止请求</button>}</div></div>
    <p className="mcp-context-note">浏览和预览会请求此服务。加入草稿后，由你发送给模型；服务内容仅作任务数据。</p>
    {catalog&&<>
      <p className="mcp-context-count">{catalog.resources.length} 项资源 · {catalog.templates.length} 项模板 · {catalog.prompts.length} 项提示词</p>
      {catalog.warnings?.length>0&&<p className="mcp-context-note" role="status">{catalog.warnings.join('；')}</p>}
      <label className="task-field"><span>选择资料</span><select aria-label={'MCP资料选择 '+server.name} value={selected} disabled={Boolean(busy)} onChange={event=>{setSelected(event.target.value);setArgs({});setPreview(null);setError('');}}><option value="">选择资源、模板或提示词</option>{items.map(value=><option key={value.id} value={value.id}>{labels[value.kind]} · {value.name}</option>)}</select></label>
      {!items.length&&<p className="mcp-context-note">服务目录为空。</p>}
      {item&&<div className="mcp-context-selection"><h4><FileText size={16}/>{item.name}</h4>{item.description&&<p className="mcp-context-note">{item.description}</p>}{item.uri&&<p className="mcp-context-uri">{item.uri}</p>}
        <div className="mcp-context-arguments">{item.arguments.map(argument=><label className="task-field" key={argument.name}><span>{argument.name}{argument.required?' · 必填':' · 选填'}</span><input aria-label={'MCP资料参数 '+argument.name} value={args[argument.name]??''} maxLength={4096} disabled={Boolean(busy)} onChange={event=>setArgs(value=>({...value,[argument.name]:event.target.value}))}/>{argument.description&&<small>{argument.description}</small>}</label>)}</div>
        <button className="secondary-button" disabled={Boolean(busy)||item.arguments.some(a=>a.required&&!Object.hasOwn(args,a.name))} onClick={read}>{busy==='read'&&<LoaderCircle size={15} className="spin"/>}读取预览</button>
      </div>}
    </>}
    {error&&<p className="mcp-server-error" role="alert">{error}</p>}
    {preview&&<div className="mcp-context-preview"><div className="mcp-context-heading"><strong>{labels[preview.kind]}预览</strong>{onUseContext&&<button className="primary-button" disabled={!preview.text} onClick={()=>onUseContext(preview)}>加入当前对话草稿</button>}</div><pre tabIndex={0} aria-label="MCP资料预览">{preview.text||'服务返回空文本。'}</pre>{preview.truncated&&<p role="status" className="mcp-context-note">内容已按48KB上限截断，请缩小资源内容后重新读取完整资料。</p>}<p className="mcp-context-note">{preview.notice}</p></div>}
  </section>;
}
