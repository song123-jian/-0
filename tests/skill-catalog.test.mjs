import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {createSkillCatalog}=require('../electron/skill-catalog.cjs');const {createSkillContext}=require('../electron/skill-context.cjs');
async function fixture(t){const base=await fs.mkdtemp(path.join(os.tmpdir(),'scodex-catalog-'));t.after(()=>fs.rm(base,{recursive:true,force:true}));let prefs={skillsEnabled:true,disabledSkillIds:[]},skills=[];
 async function add(name,description='表格项目跟踪'){const dir=path.join(base,name);await fs.mkdir(dir);const file=path.join(dir,'SKILL.md');await fs.writeFile(file,'---\nname: '+name+'\n---\nGUIDANCE-'+name);await fs.writeFile(path.join(dir,'ref.md'),'REFERENCE-'+name);const s={id:name,name,description,absolutePath:file};skills.push(s);return s;}
 const options={getSkills:async()=>skills,getPreferences:()=>prefs,guard:async()=>{},authorize:async()=>{}};return {base,add,options,getSkills:()=>skills,setPreferences:p=>{prefs=p;},setSkills:v=>{skills=v;},create:extra=>createSkillCatalog({...options,...extra})};}
test('automatic catalog exists without manual selection and loads installed task prerequisite',async t=>{
 const f=await fixture(t);await f.add('requirement-understanding','每次需求固定前置');await f.add('excel-workbook');const c=await f.create();assert.deepEqual(c.definitions.map(d=>d.function.name),['skill_search','skill_open','skill_list','skill_read']);assert.match(c.instruction,/GUIDANCE-requirement-understanding/);assert.ok(!c.instruction.includes('GUIDANCE-excel-workbook'));
 const found=await c.execute('skill_search',{query:'表格'});assert.equal(found.entries.length,1);assert.equal(found.entries[0].name,'excel-workbook');assert.equal(found.entries[0].content,undefined);
 const opened=await c.execute('skill_open',{skill_id:found.entries[0].id});assert.match(opened.content,/GUIDANCE-excel-workbook/);assert.match(opened.hash,/^[a-f0-9]{64}$/);assert.equal((await c.execute('skill_read',{path:'ref.md'})).content,'REFERENCE-excel-workbook');
});
test('disabled settings and live package changes are enforced for automatic skills',async t=>{
 const f=await fixture(t),a=await f.add('sample');f.setPreferences({skillsEnabled:false});assert.equal(await f.create(),null);f.setPreferences({skillsEnabled:true,disabledSkillIds:[a.id]});const c=await f.create();assert.equal((await c.execute('skill_search',{})).total,0);await assert.rejects(c.execute('skill_open',{skill_id:a.id}),/未停用/);
 f.setPreferences({skillsEnabled:true});await c.execute('skill_open',{skill_id:a.id});await fs.writeFile(a.absolutePath,'changed');await assert.rejects(c.execute('skill_read',{path:'ref.md'}),/更改/);f.setPreferences({skillsEnabled:false});await assert.rejects(c.execute('skill_search',{}),/停用/);
});
test('manual selection remains compatible and package scope cannot be broadened',async t=>{
 const f=await fixture(t),a=await f.add('manual');const selected=await createSkillContext({skillId:a.id,...f.options}),c=await f.create({selected});assert.match(c.instruction,/GUIDANCE-manual/);assert.equal((await c.execute('skill_read',{path:'ref.md'})).content,'REFERENCE-manual');await assert.rejects(c.execute('skill_read',{path:'../private'}),/越出/);await assert.rejects(c.execute('skill_open',{skill_id:'C:/private/SKILL.md'}),/先 skill_search/);await assert.rejects(c.execute('skill_search',{query:'x',extra:true}),/参数/);
});
test('catalog metadata remains paged while Skill bodies load completely without a fixed content cap',async t=>{
 const f=await fixture(t);for(let i=0;i<25;i++)await f.add('s'+String(i).padStart(2,'0'));const c=await f.create();const page=await c.execute('skill_search',{}),last=await c.execute('skill_search',{offset:page.next_offset});assert.equal(page.entries.length,20);assert.equal(last.entries.length,5);assert.equal(last.next_offset,null);
 await fs.writeFile(f.getSkills()[0].absolutePath,'指导'.repeat(16000));const one=await c.execute('skill_open',{skill_id:'s00'}),two=await c.execute('skill_open',{skill_id:'s00'});assert.equal(one.content,'指导'.repeat(16000));assert.equal(two.content,'');assert.equal(two.reused,true);
 for (const skill_id of ['s01','s02','s03','s04','s05']) assert.match((await c.execute('skill_open',{skill_id})).content,/GUIDANCE-/);
 assert.equal((await c.execute('skill_search',{})).loaded_skills.length,6);
 assert.ok(!c.instruction.includes('零至三个'));
});

test('initial and repeated Skill pages announce names and reuse content after live validation', async t => {
 const f=await fixture(t);const prerequisite=await f.add('requirement-understanding','固定前置');const probe=await f.add('probe','实现检查');const c=await f.create();
 assert.equal(c.initialActivities[0].detail,'requirement-understanding');
 const preloaded=await c.execute('skill_open',{skill_id:prerequisite.id});assert.equal(preloaded.already_loaded,true);assert.equal(preloaded.content,'');
 const progress=[];const opened=await c.execute('skill_open',{skill_id:probe.id},{onProgress:e=>progress.push(e)});
 assert.equal(progress[0].detail,'probe');assert.equal(opened.activity.title,'使用 Skill');
 const repeated=await c.execute('skill_open',{skill_id:probe.id});assert.equal(repeated.reused,true);assert.equal(repeated.content,'');assert.equal(repeated.activity.title,'复用 Skill');
 await fs.writeFile(probe.absolutePath,'changed');await assert.rejects(c.execute('skill_open',{skill_id:probe.id}),/更改/);
});

test('copied or equivalent named Skill packages reuse canonical responsibility, not another slot', async t => {
 const f=await fixture(t);const original=await f.add('pdf','读取并核对 PDF');const alias=await f.add('plugin-pdf','读取并核对 PDF');alias.name='plugin:pdf';const copy=await f.add('other-reader','替代包');
 await fs.writeFile(copy.absolutePath,'---\nname: other-reader\n---\nGUIDANCE-pdf');
 const c=await f.create();await c.execute('skill_open',{skill_id:original.id});
 for(const item of [alias,copy]){const r=await c.execute('skill_open',{skill_id:item.id});assert.equal(r.reused,true);assert.equal(r.skill_id,original.id);assert.equal(r.skill_name,'pdf');assert.equal(r.content,undefined);assert.equal(r.next_offset,null);}
 assert.equal((await c.execute('skill_search',{})).loaded_skills.length,1);
 f.setPreferences({skillsEnabled:true,disabledSkillIds:[original.id]});await assert.rejects(c.execute('skill_open',{skill_id:alias.id}),/停用|卸载/);
});

test('aliases reuse complete canonical bodies and duplicate references are not returned twice',async t=>{
 const f=await fixture(t);const a=await f.add('guide-a','导航'),b=await f.add('guide-b','导航副本');const body='资料'.repeat(16000);
 await fs.writeFile(a.absolutePath,body);await fs.writeFile(b.absolutePath,body);const c=await f.create();
 const first=await c.execute('skill_open',{skill_id:a.id});const reused=await c.execute('skill_open',{skill_id:b.id});
 assert.equal(first.content,body);assert.equal(reused.skill_id,a.id);assert.equal(reused.content,undefined);assert.equal(reused.next_offset,null);
 const ref=await c.execute('skill_read',{path:'ref.md'});assert.equal(ref.content,'REFERENCE-guide-a');assert.equal((await c.execute('skill_read',{path:'ref.md'})).content,'');
});

test('manual prerequisite alias is not preloaded again and missing Skill attempts announce their ID',async t=>{
 const f=await fixture(t);await f.add('requirement-understanding','固定前置');const manual=await f.add('manual-prerequisite','固定前置');manual.name='requirement-understanding';
 const selected=await createSkillContext({skillId:manual.id,...f.options}),c=await f.create({selected});assert.equal(c.initialActivities.length,1);assert.equal((await c.execute('skill_search',{})).loaded_skills.length,1);
 const events=[];await assert.rejects(c.execute('skill_open',{skill_id:'missing'},{onProgress:event=>events.push(event)}),/skill_search/);assert.equal(events[0].detail,'missing');
});
