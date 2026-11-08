import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, messageElapsedMs, operationCaption, parseInline, parseMessageBlocks, safeMessageUrl, settledTiming, usedSkillNames } from '../src/lib/message-presentation.js';

const fence = String.fromCharCode(96).repeat(3);
test('timing follows the active request then settles to a fixed value, including subsecond results', () => {
  const pending = { pending: true, startedAt: 1000 };
  assert.equal(messageElapsedMs(pending, 3250), 2250);
  const completed = { ...pending, ...settledTiming(pending, 3250), pending: false };
  assert.equal(messageElapsedMs(completed, 99999), 2250);
  assert.equal(completed.startedAt, undefined);
  assert.equal(messageElapsedMs({ pending: true, startedAt: 1000 }, 999), 0);
  assert.equal(formatDuration(0), '0秒');
  assert.equal(formatDuration(611000), '10分钟 11秒');
  assert.equal(formatDuration(3601000), '1小时 0分钟 1秒');
});

test('old histories infer only recorded durations, reject negative values and bound untrusted times', () => {
  assert.equal(messageElapsedMs({ content: '未知' }), null);
  assert.equal(messageElapsedMs({ elapsedMs: -1 }), null);
  assert.equal(messageElapsedMs({ stoppedAfter: 3 }), 3000);
  assert.equal(messageElapsedMs({ elapsedMs: 0, stoppedAfter: 10 }), 0);
  const old = { operations: [{ startedAt: '2026-10-25T10:00:00Z', endedAt: '2026-10-25T10:00:03Z' }, { startedAt: 'invalid', endedAt: '' }] };
  assert.equal(messageElapsedMs(old), 3000);
  assert.equal(messageElapsedMs({ operations: [{ startedAt: '2026-10-25T10:00:03Z', endedAt: '2026-10-25T10:00:00Z' }] }), null);
  assert.equal(messageElapsedMs({ elapsedMs: 1e12 }), 604800000);
});

test('paragraphs, numbered steps, emphasis and inline code preserve semantic structure', () => {
  const code = String.fromCharCode(96);
  const blocks = parseMessageBlocks('我会按步骤执行：\n\n1. **读取交接**与' + code + 'HANDOFF.md' + code + '\n2. 修改并验证\n\n完成。');
  assert.deepEqual(blocks.map((block) => block.type), ['paragraph', 'list', 'paragraph']);
  assert.equal(blocks[1].ordered, true);
  assert.equal(blocks[1].items.length, 2);
  assert.deepEqual(parseInline(blocks[1].items[0][0].text).map((token) => token.type), ['strong', 'text', 'code']);
  assert.equal(blocks[2].text, '完成。');
});

test('streaming code fences retain unfinished content without allowing editor apply', () => {
  const text = '# 输出\n\n' + fence + 'js\nconst 中文 = "<script>";\n';
  const block = parseMessageBlocks(text).at(-1);
  assert.equal(block.type, 'code');
  assert.equal(block.language, 'js');
  assert.equal(block.closed, false);
  assert.match(block.text, /const 中文/);
  const completed = parseMessageBlocks(text + fence).at(-1);
  assert.equal(completed.closed, true);
  assert.equal(completed.text, 'const 中文 = "<script>";');
  assert.equal(parseMessageBlocks('~~~txt\n内容\n~~~')[0].text, '内容');
});

test('links permit only direct HTTP URLs without credentials or hidden control characters', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///C:/a', 'https://user:secret@example.com/', 'https://example.com/\n']) assert.equal(safeMessageUrl(value), null);
  assert.equal(safeMessageUrl('https://example.com/中文'), 'https://example.com/%E4%B8%AD%E6%96%87');
  const tokens = parseInline('[访问](https://example.com/) [无效](javascript:evil)');
  assert.equal(tokens[0].type, 'link');
  assert.ok(tokens.some((token) => token.type === 'text' && token.text.includes('javascript:evil')));
});

test('nested lists, quotes and tables keep content while long cells remain separate', () => {
  const blocks = parseMessageBlocks('3. 父项\n   - 子项\n   - 子项二\n4. 后续\n\n> 引用\n> 第二行\n\n| 名称 | 状态 |\n| :--- | ---: |\n| 文件\\|名 | **通过** |');
  assert.equal(blocks[0].start, 3);
  assert.equal(blocks[0].items.length, 2);
  assert.equal(blocks[0].items[0][1].type, 'list');
  assert.equal(blocks[0].items[0][1].items.length, 2);
  assert.equal(blocks[1].type, 'quote');
  assert.equal(blocks[2].type, 'table');
  assert.deepEqual(blocks[2].alignment, ['left', 'right']);
  assert.equal(parseInline(blocks[2].rows[0][0])[0].text, '文件|名');
});

test('raw HTML remains text and incomplete markup does not discard answer content', () => {
  const input = '<img src=x onerror=alert(1)>\n未闭合 **强调\n' + String.fromCharCode(96) + 'inline';
  const blocks = parseMessageBlocks(input);
  assert.equal(blocks.length, 1);
  assert.equal(parseInline(blocks[0].text).map((item) => item.text || '').join(''), input);
});

test('operation summaries distinguish failed, cancelled, interrupted and running work from success', () => {
  assert.equal(operationCaption({ name: 'run_command', status: 'succeeded' }), '已运行');
  assert.equal(operationCaption({ name: 'read_file', status: 'running' }), '正在读取');
  assert.equal(operationCaption({ name: 'run_command', status: 'failed' }), '运行 · 失败');
  assert.match(operationCaption({ name: 'service_start', status: 'cancelled' }), /已停止/);
  assert.match(operationCaption({ name: 'read_file', status: 'interrupted' }), /已中断/);
});

test('model debate operations keep role titles and merge structured completion details', () => {
  const proposal = { name: 'model_debate_proposal', title: '模型三 · 独立提案', detail: '只读模型请求；无工具和文件访问' };
  assert.equal(operationCaption({ ...proposal, status: 'running' }), '正在模型三 · 独立提案');
  assert.equal(operationCaption({ ...proposal, status: 'succeeded', detail: '独立提案已返回结构化结果' }), '模型三 · 独立提案已返回结构化结果');
  assert.equal(operationCaption({ name: 'model_debate_result', title: '三模型讨论完成 · 模型一 100%', status: 'succeeded', detail: '自动份额合计 100%；模型一独占实际执行' }), '三模型讨论完成 · 模型一 100% · 自动份额合计 100%；模型一独占实际执行');
  assert.equal(operationCaption({ ...proposal, status: 'failed', detail: '模型三等待超过时限。' }), '模型三 · 独立提案 · 失败');
});

test('Skill notices list only actual successful loads, once per name and including preloaded guidance', () => {
 const operations=[{name:'skill_use',status:'succeeded',detail:'requirement-understanding'},{name:'skill_open',status:'running',detail:'pending'},{name:'skill_open',status:'succeeded',detail:'pdf'},{name:'skill_open',status:'succeeded',detail:'pdf'},{name:'skill_open',status:'failed',detail:'unavailable'},{name:'skill_search',status:'succeeded',detail:'query'}];
 assert.deepEqual(usedSkillNames(operations),['requirement-understanding','pdf']);
 assert.equal(operationCaption({name:'skill_open',title:'使用 Skill',status:'succeeded'}),'已使用 Skill');
 assert.equal(operationCaption({name:'skill_open',title:'加载 Skill',status:'running'}),'正在加载 Skill');
});
