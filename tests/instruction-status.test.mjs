import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {operationCaption} from '../src/lib/message-presentation.js';
const require=createRequire(import.meta.url);
const {runModelTask}=require('../electron/agent-runtime.cjs');
const {normalizeLibrary}=require('../electron/conversations.cjs');

test('rule disclosure stays deferred, persists and never reports an unperformed write as success or failure',async()=>{
  let request=0,effects=0;const events=[];
  const tools=[{type:'function',function:{name:'write_file',parameters:{type:'object'}}}];
  const result=await runModelTask({connection:{endpoint:'http://fixture/v1/chat/completions',model:'fixture',apiKey:'synthetic'},messages:[],tools,emit:e=>events.push(e),
    executeTool:async()=>effects++ ? {ok:true} : {ok:false,requires_instruction_review:true,instructions:[{path:'AGENTS.md',content:'RULE'}],error:'规则已加载，原操作尚未执行。',activity:{title:'已加载目录规则 · 原操作未执行'}},
    fetchImpl:async(_url,init)=>{
      const body=JSON.parse(init.body);
      if(request===1){const previous=JSON.parse(body.messages.at(-1).content);assert.equal(previous.ok,false);assert.equal(previous.requires_instruction_review,true);assert.equal(previous.instructions[0].content,'RULE');}
      const message=request++<2 ? {content:null,tool_calls:[{id:'write-'+request,type:'function',function:{name:'write_file',arguments:'{}'}}]} : {content:'完成'};
      return new Response(JSON.stringify({choices:[{message,finish_reason:message.tool_calls?'tool_calls':'stop'}]}),{headers:{'content-type':'application/json'}});
    }});
  assert.equal(result.text,'完成');assert.equal(effects,2);
  const operations=events.filter(e=>e.type==='operation'&&e.operation.status!=='running').map(e=>e.operation);
  assert.deepEqual(operations.map(o=>o.status),['deferred','succeeded']);
  const normalized=normalizeLibrary([{role:'assistant',content:'完成',operations}]);
  const persisted=normalizeLibrary(JSON.parse(JSON.stringify(normalized))).conversations[0].messages[0].operations;
  assert.equal(persisted[0].status,'deferred');assert.equal(operationCaption(persisted[0]),'已加载目录规则 · 原操作未执行');
  assert.equal(operationCaption(persisted[1]),'已写入');
});
