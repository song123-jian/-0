import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { applyConversationAction, forkChatRecord, newChatRecord, conversationText } from '../src/lib/conversation-actions.js';
const require=createRequire(import.meta.url);
const {normalizeLibrary}=require('../electron/conversations.cjs');
const {normalizeProjects}=require('../electron/project-registry.cjs');
const {validateExport,exportConversation}=require('../electron/conversation-actions.cjs');
const {validateWindowAction}=require('../electron/workspace-windows.cjs');
const projects=[{id:'p1',name:'项目甲'},{id:'p2',name:'项目乙'},{id:'pa',archivedAt:'2026-10-25'}];
function fixture(){const a=newChatRecord('p1'),b=newChatRecord('p1');a.title='中文任务';a.messages=[{id:'u',role:'user',content:'修改文件'},{id:'a',role:'assistant',content:'处理中',pending:true,approval:{id:'ap'},operations:[{id:'o',name:'write_file',status:'running',path:'file.txt'}]}];return {version:2,activeId:a.id,conversations:[a,b]};}
const options={projects,activeProjectId:'p1'};
test('fork keeps history and source immutable, with independent identities and no live actions',()=>{
 const l=fixture(),source=structuredClone(l.conversations[0]),f=forkChatRecord(source);assert.notEqual(f.id,source.id);assert.equal(f.parentId,source.id);assert.equal(f.projectId,'p1');assert.equal(f.messages[1].pending,false);assert.equal(f.messages[1].approval,null);assert.equal(f.messages[1].operations[0].status,'interrupted');assert.equal(f.messages[1].cancelled,true);assert.ok(f.messages.every((m,i)=>m.id!==source.messages[i].id));assert.deepEqual(source,l.conversations[0]);
 f.messages[1].operations[0].path='another';assert.equal(source.messages[1].operations[0].path,'file.txt');
 const n=normalizeLibrary({version:2,activeId:f.id,conversations:[f]});assert.equal(n.conversations[0].parentId,source.id);assert.equal(normalizeLibrary({conversations:[{...f,parentId:f.id}]}).conversations[0].parentId,undefined);
});
test('metadata actions retain unrelated running content and normalize readable titles',()=>{
 const l=fixture(),id=l.activeId,other=l.conversations[1];let n=applyConversationAction(l,{type:'rename',id,value:' 新\n名称\0 '},options).library;assert.equal(n.conversations[0].title,'新 名称');n=applyConversationAction(n,{type:'pin',id},options).library;n=applyConversationAction(n,{type:'unread',id},options).library;assert.equal(n.conversations[0].pinned,true);assert.equal(n.conversations[0].unreadResult,true);assert.equal(n.conversations[1],other);assert.throws(()=>applyConversationAction(l,{type:'rename',id,value:'\n'},options));
});
test('running chat cannot move, archive or delete while another idle chat can be managed',()=>{
 const l=fixture(),id=l.activeId,opts={...options,runningIds:[id]};for(const type of ['move','archive','delete'])assert.throws(()=>applyConversationAction(l,{type,id,value:'p2'},opts),/仍在运行/);const n=applyConversationAction(l,{type:'delete',id:l.conversations[1].id},opts).library;assert.equal(n.conversations[0].id,id);assert.deepEqual(n.conversations[0].messages,l.conversations[0].messages);
});
test('move/archive/delete select a valid current-project fallback and restore keeps history',()=>{
 for(const type of ['move','archive','delete']){const l=fixture(),id=l.activeId,n=applyConversationAction(l,{type,id,value:'p2'},options).library;assert.equal(n.activeId,l.conversations[1].id);if(type==='archive'){const restored=applyConversationAction(n,{type:'restore',id},options).library;assert.equal(restored.conversations[0].archivedAt,null);assert.deepEqual(restored.conversations[0].messages,l.conversations[0].messages);}}
 const l=fixture();l.conversations=l.conversations.slice(0,1);const n=applyConversationAction(l,{type:'delete',id:l.activeId},options).library;assert.equal(n.conversations.length,1);assert.equal(n.conversations[0].projectId,'p1');assert.equal(n.activeId,n.conversations[0].id);assert.throws(()=>applyConversationAction(l,{type:'move',id:l.activeId,value:'pa'},options),/不可用/);
});
test('fork into another project does not move the main selection or source',()=>{
 const l=fixture(),r=applyConversationAction(l,{type:'fork',id:l.activeId,value:'p2'},options);assert.equal(r.library.activeId,l.activeId);assert.equal(r.created.projectId,'p2');assert.equal(r.library.conversations.length,3);assert.equal(r.library.conversations[1],l.conversations[0]);
});
test('project metadata survives save/reload and invalid archived timestamps are dropped',()=>{
 const p=normalizeProjects([{id:'p',name:'中文',path:path.resolve(os.tmpdir(),'scodex-project'),pinned:true,unread:true,archivedAt:'2026-10-25T00:00:00Z'}]);assert.equal(p[0].pinned,true);assert.equal(p[0].unread,true);assert.equal(p[0].archivedAt,'2026-10-25T00:00:00Z');assert.deepEqual(normalizeProjects(JSON.parse(JSON.stringify(p))),p);assert.equal(normalizeProjects([{...p[0],archivedAt:'bad'}])[0].archivedAt,null);
});
test('conversation text includes project, attachments and operation summaries with a UTF8 byte bound',()=>{
 const l=fixture(),chat=l.conversations[0];chat.messages[0].attachments=[{name:'中文附件.txt'}];let text=conversationText(chat,projects[0]);assert.match(text,/项目甲/);assert.match(text,/中文附件.txt/);assert.match(text,/write_file/);chat.messages[0].content='中'.repeat(1500000);text=conversationText(chat,projects[0]);assert.ok(Buffer.byteLength(text)<=4*1024*1024);assert.ok(!text.includes('\uFFFD'));
});
test('export writes verified unique UTF8 files with safe filenames and no overwrites',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'scodex-context-export-')),files=[];try{const input={title:'../文:件?',text:'中文\n实际导出',format:'txt'};for(let i=0;i<2;i++){const r=await exportConversation(input,dir);files.push(r.path);assert.equal(path.dirname(r.path),dir);assert.equal(await fs.readFile(r.path,'utf8'),input.text);assert.equal(r.bytes,Buffer.byteLength(input.text));}assert.notEqual(files[0],files[1]);assert.throws(()=>validateExport({...input,text:'x\0y'}));assert.throws(()=>validateExport({...input,text:'中'.repeat(1500000)}));}finally{for(const f of files)await fs.unlink(f);await fs.rmdir(dir);}
});
test('restricted workspace window actions bind approvals, paths and chat identities',()=>{
 const r={kind:'chat',snapshot:{available:true,chat:{messages:[{approval:{id:'ap'},operations:[{path:'allowed.txt'}]}]}}};assert.deepEqual(validateWindowAction(r,{type:'send',text:'中文',other:'discard'}),{type:'send',text:'中文'});assert.throws(()=>validateWindowAction(r,{type:'new-chat'}),/不允许/);assert.throws(()=>validateWindowAction(r,{type:'send',text:' '}));assert.throws(()=>validateWindowAction(r,{type:'draft',text:'x'.repeat(64001)}));assert.throws(()=>validateWindowAction(r,{type:'approval',approvalId:'stale'}),/变化/);assert.throws(()=>validateWindowAction(r,{type:'file',path:'other.txt'}),/不在/);assert.equal(validateWindowAction(r,{type:'approval',approvalId:'ap',allowed:true}).allowed,true);const p={kind:'project',snapshot:{available:true,chats:[{id:'c'}]}};assert.equal(validateWindowAction(p,{type:'open-chat',chatId:'c'}).chatId,'c');assert.throws(()=>validateWindowAction(p,{type:'open-chat',chatId:'other'}));assert.throws(()=>validateWindowAction({...r,snapshot:{available:false}},{type:'focus'}));
});
