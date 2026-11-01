import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const spec = { title: '验收报告', sections: [{ heading: '结果', paragraphs: ['中文内容与 <script>字样'], table: [['项目','结果'],['检查','通过']] }] };
test('DOCX and PPTX contain editable text and roundtrip authoring data', async () => {
  const { buildOffice, readOffice } = require('../electron/office-artifacts.cjs');
  for (const type of ['docx','pptx']) {
    const bytes = await buildOffice(spec,type); assert.equal(bytes.subarray(0,2).toString(),'PK');
    const result = await readOffice(bytes, 'report.'+type);
    assert.equal(result.spec.title,spec.title); assert.match(result.text,/中文内容/); assert.equal(result.editable,true);
  }
});
test('preview escapes active content and rejects excessive slide content', () => {
  const { documentHtml, normalizeSpec } = require('../electron/office-artifacts.cjs');
  const html=documentHtml(spec); assert.ok(html.includes('&lt;script&gt;')); assert.equal(html.includes('<script>'),false);
  assert.throws(()=>normalizeSpec({title:'x',sections:[{heading:'a',paragraphs:Array(50).fill('text')}]},'pptx'),/幻灯片/);
});
