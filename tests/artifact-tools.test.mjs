import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createArtifactTools } = require('../electron/artifact-tools.cjs');
const { createAgentTools } = require('../electron/agent-tools.cjs');
const { sealSnapshot, openSnapshot } = require('../electron/sync-crypto.cjs');
const spec = { title:'中文成品', sections:[{heading:'验证',paragraphs:['真实文件与并发保护']}] };
async function fixture(t, extra = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'scodex-artifact-')); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const tools=createArtifactTools({projectFiles:createAgentTools({workspaceRoot:root}).projectFiles,approve:async()=>{},...extra}); return {root,tools};
}
test('actual DOCX/PPTX creation and observed hash editing preserve conflicts',async t=>{
  const {root,tools}=await fixture(t);
  for(const ext of ['docx','pptx']) {
    const file='result.'+ext; await tools.execute('artifact_write',{path:file,expected_hash:'new',spec});
    const read=await tools.execute('artifact_read',{path:file}); assert.match(read.text,/真实文件/);
    await tools.execute('artifact_write',{path:file,expected_hash:read.hash,spec:{...spec,title:'已修改'}});
    const updated=await tools.execute('artifact_read',{path:file}); assert.equal(updated.title,'已修改');
    const bytes=await fs.readFile(path.join(root,file)); await fs.appendFile(path.join(root,file),'changed');
    await assert.rejects(tools.execute('artifact_write',{path:file,expected_hash:updated.hash,spec}),/变化/);
    assert.equal((await fs.readFile(path.join(root,file))).length,bytes.length+7);
  }
});
test('planning, path escape, refusal and stop do not create files',async t=>{
  const f=await fixture(t,{readOnly:true}); assert.deepEqual(f.tools.definitions.map(x=>x.function.name),['artifact_read']);
  await assert.rejects(f.tools.execute('artifact_write',{path:'x.docx',expected_hash:'new',spec}),/规划/);
  const g=await fixture(t,{approve:async()=>{throw Error('拒绝');}});
  await assert.rejects(g.tools.execute('artifact_write',{path:'x.docx',expected_hash:'new',spec}),/拒绝/);
  await assert.rejects(g.tools.execute('artifact_write',{path:'../outside.docx',expected_hash:'new',spec}));
  assert.deepEqual(await fs.readdir(g.root),[]);
});
test('sync ciphertext roundtrips and rejects wrong secrets and tampering',async()=>{
  const value={library:{title:'私有聊天正文'}}; const secret='test-fixture-shared-secret-123';
  const sealed=await sealSnapshot(value,secret); assert.equal(JSON.stringify(sealed).includes('私有聊天正文'),false);
  assert.deepEqual(await openSnapshot(sealed,secret),value);
  await assert.rejects(openSnapshot(sealed,'wrong-fixture-shared-secret'),/口令不一致/);
  await assert.rejects(openSnapshot({...sealed,data:sealed.data.slice(0,-4)+'AAAA'},secret),/损坏/);
});
