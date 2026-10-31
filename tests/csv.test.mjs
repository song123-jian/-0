import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, stringifyCsv } from '../src/lib/csv.js';

test('parses commas, escaped quotes, and line breaks inside quoted cells', () => {
  const rows = parseCsv('name,note\r\nAda,"a, ""quoted"" value"\r\nLin,"line one\nline two"');
  assert.deepEqual(rows, [
    ['name', 'note'],
    ['Ada', 'a, "quoted" value'],
    ['Lin', 'line one\nline two'],
  ]);
});

test('normalizes ragged rows and strips an optional UTF-8 BOM', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b,c\n1,2\n'), [['a', 'b', 'c'], ['1', '2', '']]);
});

test('serializes values into a round-trippable CSV document', () => {
  const rows = [['title', 'note'], ['Sheet', 'a, "quoted"\nline']];
  assert.deepEqual(parseCsv(stringifyCsv(rows)), rows);
});

test('parses and serializes tab-delimited rows without changing quoted tabs', () => {
  const rows = [['name', 'note'], ['Ada', 'line one\tline two'], ['Lin', 'a "quote"']];
  assert.deepEqual(parseCsv(stringifyCsv(rows, '\t'), '\t'), rows);
});

test('rejects unclosed quoted cells', () => {
  assert.throws(() => parseCsv('a,"b'), /未闭合/);
});

test('rejects invalid delimiters', () => {
  assert.throws(() => parseCsv('a,b', '::'), /分隔符/);
  assert.throws(() => stringifyCsv([['a']], '"'), /分隔符/);
});
