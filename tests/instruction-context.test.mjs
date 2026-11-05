import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {createInstructionContext}=require('../electron/instruction-context.cjs');
const {createAgentTools}=require('../electron/agent-tools.cjs');
async function fixture(t){const base=await fs.mkdtemp(path.join(os.tmpdir(),'scodex-instructions-'));t.after(()=>fs.rm(base,{recursive:true,force:true}));const root=path.join(base,'project'),global=path.join(base,'personal');await fs.mkdir(root);await fs.mkdir(global);return{base,root,global};}
test('personal, ancestor and project instructions preserve full text, order and provenance',async t=>{
 const f=await fixture(t),long='中文规则。'.repeat(6500)+'TAIL-RULE';
 await fs.writeFile(path.join(f.global,'AGENTS.md'),'PERSONAL');await fs.writeFile(path.join(f.base,'AGENTS.md'),'ANCESTOR');await fs.writeFile(path.join(f.root,'AGENTS.md'),long);
 const c=await createInstructionContext({workspaceRoot:f.root,globalRoots:[f.global,f.global]});
 assert.deepEqual(c.entries.map(e=>e.scope),['personal','ancestor','project']);assert.equal(c.entries[2].content,long);assert.ok(c.content.endsWith('TAIL-RULE'));assert.ok(c.entries.every(e=>/^[a-f0-9]{64}$/.test(e.hash)));await c.assertCurrent();
});
test('changed, removed and newly created effective rules stop an active request',async t=>{
 const f=await fixture(t);await fs.writeFile(path.join(f.root,'AGENTS.md'),'original');let c=await createInstructionContext({workspaceRoot:f.root});
 await fs.writeFile(path.join(f.root,'AGENTS.md'),'changed');await assert.rejects(c.assertCurrent(),/已变化/);
 c=await createInstructionContext({workspaceRoot:f.root});await fs.unlink(path.join(f.root,'AGENTS.md'));await assert.rejects(c.assertCurrent(),/已变化/);
 c=await createInstructionContext({workspaceRoot:f.root});await fs.writeFile(path.join(f.base,'AGENTS.md'),'new ancestor');await assert.rejects(c.assertCurrent(),/已变化/);
});
test('invalid, oversized or junction instructions fail clearly instead of being ignored',async t=>{
 const f=await fixture(t),file=path.join(f.root,'AGENTS.md');
 for(const bytes of [Buffer.from([255]),Buffer.from([0]),Buffer.alloc(128*1024+1,65)]){await fs.writeFile(file,bytes);await assert.rejects(createInstructionContext({workspaceRoot:f.root}),/UTF-8|二进制|128 KiB/);}
 await fs.unlink(file);await fs.writeFile(path.join(f.global,'AGENTS.md'),'outside');await fs.symlink(path.join(f.global,'AGENTS.md'),file,'file').catch(async()=>{await fs.symlink(f.global,path.join(f.root,'linked'),'junction');});
 if(await fs.lstat(file).catch(()=>null))await assert.rejects(createInstructionContext({workspaceRoot:f.root}),/链接|联接/);else await assert.rejects(createInstructionContext({workspaceRoot:path.join(f.root,'linked')}),/链接|联接/);
});
test('preloaded rules are not repeated and new scoped rules precede effects',async t=>{
 const f=await fixture(t);await fs.writeFile(path.join(f.root,'AGENTS.md'),'ROOT');await fs.mkdir(path.join(f.root,'nested'));await fs.writeFile(path.join(f.root,'nested','AGENTS.md'),'SCOPED');await fs.writeFile(path.join(f.root,'nested','a.txt'),'before');
 const c=await createInstructionContext({workspaceRoot:f.root}),tools=createAgentTools({workspaceRoot:f.root,instructionsPreloaded:c.entries});
 const read=await tools.execute('read_file',{path:'nested/a.txt'});assert.deepEqual(read.instructions.map(r=>r.content),['SCOPED']);
 assert.equal((await tools.execute('read_file',{path:'nested/a.txt'})).instructions.length,0);
 await fs.writeFile(path.join(f.root,'nested','AGENTS.md'),'NEW-SCOPED');const args={path:'nested/a.txt',content:'after',expected_hash:read.hash};
 const blocked=await tools.execute('write_file',args);assert.equal(blocked.ok,false);assert.equal(blocked.instructions[0].content,'NEW-SCOPED');assert.equal(await fs.readFile(path.join(f.root,'nested/a.txt'),'utf8'),'before');
 assert.equal((await tools.execute('write_file',args)).ok,true);
});
test('new-file writes and nested commands load undisclosed rules without invoking authorization or shell',async t=>{
 const f=await fixture(t);await fs.mkdir(path.join(f.root,'nested'));await fs.writeFile(path.join(f.root,'nested','AGENTS.md'),'FIRST');let authorized=0,launched=0;
 const tools=createAgentTools({workspaceRoot:f.root,fullAccess:true,authorize:async()=>{authorized++;},commandCapture:async()=>{launched++;return {exitCode:0};}});
 const first=await tools.execute('write_file',{path:'nested/new.txt',content:'ok',expected_hash:'new'});assert.equal(first.ok,false);assert.equal(authorized,0);
 await fs.writeFile(path.join(f.root,'nested','AGENTS.md'),'SECOND');const command=await tools.execute('run_command',{cwd:'nested',command:'Write-Output ok'});assert.equal(command.ok,false);assert.equal(launched,0);assert.equal(authorized,0);
});
test('assigned-file agents inherit only applicable rules and keep other file reads denied',async t=>{
 const f=await fixture(t);await fs.writeFile(path.join(f.root,'AGENTS.md'),'INHERITED');await fs.writeFile(path.join(f.root,'assigned.txt'),'allowed');await fs.writeFile(path.join(f.root,'other.txt'),'private');
 const tools=createAgentTools({workspaceRoot:f.root,allowedPaths:['assigned.txt']});const read=await tools.execute('read_file',{path:'assigned.txt'});assert.equal(read.instructions[0].content,'INHERITED');await assert.rejects(tools.execute('read_file',{path:'other.txt'}),/分配范围/);
});
