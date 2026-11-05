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
test('catalog and long instruction pages remain bounded and at most three skills load',async t=>{
 const f=await fixture(t);for(let i=0;i<25;i++)await f.add('s'+String(i).padStart(2,'0'));const c=await f.create();const page=await c.execute('skill_search',{}),last=await c.execute('skill_search',{offset:page.next_offset});assert.equal(page.entries.length,20);assert.equal(last.entries.length,5);assert.equal(last.next_offset,null);
 await fs.writeFile(f.getSkills()[0].absolutePath,'指导'.repeat(16000));const one=await c.execute('skill_open',{skill_id:'s00'}),two=await c.execute('skill_open',{skill_id:'s00',offset:one.next_offset});assert.equal(one.content+two.content,'指导'.repeat(16000));
 await c.execute('skill_open',{skill_id:'s01'});await c.execute('skill_open',{skill_id:'s02'});await assert.rejects(c.execute('skill_open',{skill_id:'s03'}),/三个/);
});
