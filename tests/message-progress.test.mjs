import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { messageContentParts, messageProgressState } from '../src/lib/message-presentation.js';

test('message progress distinguishes active, failed, cancelled, and complete states', () => {
  assert.equal(messageProgressState({ pending: true }), 'running');
  assert.equal(messageProgressState({ pending: false, error: '请求失败' }), 'failed');
  assert.equal(messageProgressState({ pending: false, cancelled: true }), 'cancelled');
  assert.equal(messageProgressState({ pending: false }), 'complete');
});

test('completed progress is compact and recorded commentary is separated from the final answer', () => {
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

  assert.match(styles, /\.message-progress\s*\{[^}]*font-size:\s*calc\(13px \+ var\(--font-step, 0px\)\)/s);
  assert.match(styles, /\.message-progress\[data-state="complete"\] \.message-progress-line\s*\{\s*display:\s*none;/);
  assert.deepEqual(messageContentParts({ content: '过程\n\n答复', finalContentOffset: 4 }), { activity: '过程', answer: '答复' });
  assert.deepEqual(messageContentParts({ content: '旧记录保留全文' }), { activity: '', answer: '旧记录保留全文' });
});

test('run commands keep their command and output inside a toggleable operation', () => {
  const activity = fs.readFileSync(new URL('../src/components/agent-activity.jsx', import.meta.url), 'utf8');

  assert.match(activity, /<details className=\{['"]agent-operation ['"] \+ operation\.status\} data-operation-name=\{operation\.name\}>/);
  assert.match(activity, /<summary aria-label=\{caption \+ \(preview \? ' ' \+ preview : ''\)\} aria-controls=\{bodyId\}>/);
  assert.match(activity, /<div className="agent-operation-body" id=\{bodyId\}>[\s\S]*operation\.name === 'run_command'[\s\S]*agent-command-line[\s\S]*operation\.output/);
});
