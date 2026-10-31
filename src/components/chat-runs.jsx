import React from 'react';
import { CircleAlert, LoaderCircle, Square } from 'lucide-react';

export function ChatRuns({ requests, conversations, projects = [], activeId, collapsed, onSelect, onStop }) {
  if (!requests.length) return null;
  return <section className={'chat-runs'+(collapsed?' collapsed':'')} aria-label="运行中的聊天任务">
    <div className="rail-section-head"><span>运行中</span><span className="chat-run-count">{requests.length}/3</span></div>
    <div className="chat-runs-list">{requests.map(request=>{
      const chat=conversations.find(c=>c.id===request.conversationId),project=projects.find(p=>p.id===(request.projectId||chat?.projectId)),projectName=project?.name||(request.projectId||chat?.projectId?'项目':'未分组'),message=chat?.messages.find(m=>m.id===request.requestId),waiting=Boolean(message?.approval);
      return <div key={request.requestId} className={'chat-run-row'+(activeId===request.conversationId?' active':'')} data-run-chat={request.conversationId}>
        <button type="button" className="chat-run-open" onClick={()=>onSelect(request.conversationId)} title={projectName+' · '+(chat?.title||'聊天任务')+' · '+(waiting?'等待审批':'正在运行')} aria-label={'打开运行任务 '+projectName+' · '+(chat?.title||'聊天任务')}>
          {waiting?<CircleAlert size={16} className="chat-run-waiting"/>:<LoaderCircle size={16} className="spin"/>}<span><strong>{chat?.title||'聊天任务'}</strong><small>{projectName} · {waiting?'等待审批':'正在运行'}</small></span>
        </button><button type="button" className="chat-run-stop" aria-label={'停止任务 '+(chat?.title||'聊天任务')} title="只停止此任务" onClick={()=>onStop(request.requestId)}><Square size={13}/></button>
      </div>;
    })}</div>
  </section>;
}
