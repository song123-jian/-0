import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ExcelJS = require('exceljs');
const { createAgentTools } = require('../electron/agent-tools.cjs');
const { createSpreadsheetTools, validate } = require('../electron/spreadsheet-tools.cjs');
async function fixture(t, extra = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-sheet-unit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const approvals = [], changed = [];
  const tools = createSpreadsheetTools({ projectFiles: createAgentTools({ workspaceRoot: root }).projectFiles,
    policy: () => 'on-request', approve: async (input) => approvals.push(input), onFileChanged: (target) => changed.push(target), ...extra });
  return { root, tools, approvals, changed, read: (p, rest = {}) => tools.execute('spreadsheet_read', { path: p, ...rest }), edit: (p, h, operations, context) => tools.execute('spreadsheet_edit', { path: p, expected_hash: h, operations }, context) };
}
const cells = (values, sheet) => [{ type: 'set_cells', sheet, cells: values }];

test('full access with never saves a real workbook and reads the saved cells', async t => {
  const f = await fixture(t, { policy: () => 'never', fullAccess: () => true });
  assert.ok(f.tools.definitions.some(d => d.function.name === 'spreadsheet_edit'));
  await f.edit('auto.xlsx', 'new', cells([{ address: 'A1', value: '真实写入' }]));
  const saved = await f.read('auto.xlsx');
  assert.equal(saved.cells.find(c => c.address === 'A1').value, '真实写入');
});
test('XLSX creates, reads, modifies values/formula/style, preserves other sheets and emits saved hash', async (t) => {
  const f = await fixture(t);
  let r = await f.edit('book.xlsx', 'new', [{ type: 'add_sheet', name: '保留' }, ...cells([{ address: 'A1', value: '中文标题', style: { bold: true, fill_color: 'ABCDEF', font_size: 16 } }, { address: 'B2', value: 12 }, { address: 'C2', formula: 'B2*2', style: { num_format: '0.00' } }]), ...cells([{ address: 'A1', value: '另一个表' }], '保留')]);
  assert.equal(r.formula_calculated, false); const before = await f.read('book.xlsx', { range: 'A1:C3' });
  assert.equal(before.hash, r.hash); assert.equal(before.cells.find((c) => c.address === 'C2').formula, 'B2*2');
  r = await f.edit('book.xlsx', before.hash, cells([{ address: 'B2', value: 15 }]));
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path.join(f.root, 'book.xlsx'));
  assert.equal(wb.getWorksheet('保留').getCell('A1').value, '另一个表');
  assert.equal(wb.worksheets[0].getCell('A1').fill.fgColor.argb, 'FFABCDEF');
  assert.equal(wb.worksheets[0].getCell('C2').numFmt, '0.00'); const zip = await require('jszip').loadAsync(await fs.readFile(path.join(f.root, 'book.xlsx'))); assert.match(await zip.file('xl/workbook.xml').async('string'), /fullCalcOnLoad="1"/);
  assert.equal(f.approvals.length, 2); assert.match(f.approvals[1].command, /before/); assert.equal(f.changed.length, 2);
});
test('UTF8 CSV and TSV preserve quotes/newlines/raw formula-like values and BOM; styles rejected', async (t) => {
  const f = await fixture(t);
  for (const name of ['data.csv', 'data.tsv']) {
    await fs.writeFile(path.join(f.root, name), '\uFEFF名称' + (name.endsWith('tsv') ? '\t' : ',') + '值\r\n');
    const r = await f.read(name);
    await f.edit(name, r.hash, cells([{ address: 'A2', value: '中文,\n"文字"' }, { address: 'B2', value: '=1+1' }]));
    const text = await fs.readFile(path.join(f.root, name), 'utf8'); assert.ok(text.startsWith('\uFEFF')); assert.match(text, /=1\+1/);
    const again = await f.read(name); assert.equal(again.cells.find((c) => c.address === 'A2').value, '中文,\n"文字"');
    assert.equal(again.cells.find((c) => c.address === 'B2').value, '=1+1');
    await assert.rejects(f.edit(name, again.hash, cells([{ address: 'A1', style: { bold: true } }])), /不支持公式和样式/);
  }
});
test('unobserved, stale, dirty, and approval-time external edits never overwrite original', async (t) => {
  let dirty = false, onApproval = async () => {};
  const f = await fixture(t, { isDirty: () => dirty, approve: () => onApproval() });
  await fs.writeFile(path.join(f.root, 'b.csv'), '原文');
  let r = await f.read('b.csv'); dirty = true;
  await assert.rejects(f.edit('b.csv', r.hash, cells([{ address: 'A1', value: '覆盖' }])), /未保存/); dirty = false;
  onApproval = async () => fs.writeFile(path.join(f.root, 'b.csv'), '外部修改');
  await assert.rejects(f.edit('b.csv', r.hash, cells([{ address: 'A1', value: '覆盖' }])), /其他程序修改/);
  assert.equal(await fs.readFile(path.join(f.root, 'b.csv'), 'utf8'), '外部修改');
  await assert.rejects(f.edit('b.csv', r.hash, cells([{ address: 'A1', value: '覆盖' }])), /版本/);
  r = await f.read('b.csv'); onApproval = async () => { dirty = true; };
  await assert.rejects(f.edit('b.csv', r.hash, cells([{ address: 'A1', value: '覆盖' }])), /未保存/);
  assert.equal(await fs.readFile(path.join(f.root, 'b.csv'), 'utf8'), '外部修改');
});
test('read-only, never, denied, cancellation and changed policy cannot save', async (t) => {
  for (const options of [{ readOnly: true }, { policy: () => 'never' }, { approve: async () => { throw Error('用户拒绝'); } }]) {
    const f = await fixture(t, options); await assert.rejects(f.edit('no.csv', 'new', cells([{ address: 'A1', value: '不写' }]))); await assert.rejects(fs.access(path.join(f.root, 'no.csv')));
  }
  let policy = 'on-request'; const control = new AbortController();
  const f = await fixture(t, { policy: () => policy, approve: async () => control.abort() });
  await assert.rejects(f.edit('no.csv', 'new', cells([{ address: 'A1', value: '不写' }]), { signal: control.signal }), /停止/);
  const g = await fixture(t, { policy: () => policy, approve: async () => { policy = 'never'; } });
  await assert.rejects(g.edit('no.csv', 'new', cells([{ address: 'A1', value: '不写' }])), /当前权限不允许表格修改/);
  await assert.rejects(fs.access(path.join(g.root, 'no.csv')));
});
test('paths, junctions, parameters and bounded ranges are checked at runtime', async (t) => {
  const f = await fixture(t); await assert.rejects(f.read('../outside.csv'), /项目/);
  await assert.rejects(f.read('.codex/config.csv'), /保护/);
  await fs.symlink(os.tmpdir(), path.join(f.root, 'junction'), 'junction');
  await assert.rejects(f.read('junction/data.csv'), /联接/);
  for (const args of [{ path: 'a.csv', range: 'A1:X1000' }, { path: 'a.csv', range: 'XFE1' }, { path: 'a.csv', unknown: 1 }]) assert.throws(() => validate('spreadsheet_read', args));
  assert.throws(() => validate('spreadsheet_edit', { path: 'a.xlsx', expected_hash: 'new', operations: cells([{ address: 'A1', value: 1, formula: '1' }]) }));
  const book = new ExcelJS.Workbook(); book.addWorksheet('Sheet1').getCell('IW1').value = '过宽';
  await book.xlsx.writeFile(path.join(f.root, 'large.xlsx')); await assert.rejects(f.read('large.xlsx'), /上限/);
});
test('complex workbooks remain readable but images and formula renames are protected', async (t) => {
  const f = await fixture(t); const wb = new ExcelJS.Workbook(), sheet = wb.addWorksheet('Sheet1');
  sheet.getCell('A1').value = '保留图片'; const id = wb.addImage({ buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aIpkAAAAASUVORK5CYII=', 'base64'), extension: 'png' }); sheet.addImage(id, 'B2:C3');
  await wb.xlsx.writeFile(path.join(f.root, 'image.xlsx')); const r = await f.read('image.xlsx'); assert.equal(r.writable, false);
  const bytes = await fs.readFile(path.join(f.root, 'image.xlsx')); await assert.rejects(f.edit('image.xlsx', r.hash, cells([{ address: 'A1', value: '不能覆盖' }])), /未覆盖/);
  assert.deepEqual(await fs.readFile(path.join(f.root, 'image.xlsx')), bytes);
  await f.edit('formula.xlsx', 'new', cells([{ address: 'A1', formula: '1+1' }])); const simple = await f.read('formula.xlsx');
  await assert.rejects(f.edit('formula.xlsx', simple.hash, [{ type: 'rename_sheet', sheet: 'Sheet1', name: '新名' }]), /公式/);
});
