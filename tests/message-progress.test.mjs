import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { messageProgressState } from '../src/lib/message-presentation.js';

test('message progress distinguishes active, failed, cancelled, and complete states', () => {
  assert.equal(messageProgressState({ pending: true }), 'running');
  assert.equal(messageProgressState({ pending: false, error: '请求失败' }), 'failed');
  assert.equal(messageProgressState({ pending: false, cancelled: true }), 'cancelled');
  assert.equal(messageProgressState({ pending: false }), 'complete');
});

test('completed progress is compact and completed activity receives the collapsed state', () => {
  const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const activity = fs.readFileSync(new URL('../src/components/agent-activity.jsx', import.meta.url), 'utf8');
  const workbench = fs.readFileSync(new URL('../src/workbench.jsx', import.meta.url), 'utf8');

  assert.match(styles, /\.message-progress\s*\{[^}]*font-size:\s*calc\(13px \+ var\(--font-step, 0px\)\)/s);
  assert.match(styles, /\.message-progress\[data-state="complete"\] \.message-progress-line\s*\{\s*display:\s*none;/);
  assert.match(activity, /collapsed\s*=\s*false/);
  assert.match(workbench, /collapsed=\{messageProgressState\(message\) === 'complete'\}/);
});

test('run commands keep their command and output inside a toggleable operation', () => {
  const activity = fs.readFileSync(new URL('../src/components/agent-activity.jsx', import.meta.url), 'utf8');

  assert.match(activity, /<details className=\{['"]agent-operation ['"] \+ operation\.status\} data-operation-name=\{operation\.name\}>/);
  assert.match(activity, /<summary aria-label=\{caption \+ \(preview \? ' ' \+ preview : ''\)\} aria-controls=\{bodyId\}>/);
  assert.match(activity, /<div className="agent-operation-body" id=\{bodyId\}>[\s\S]*operation\.name === 'run_command'[\s\S]*agent-command-line[\s\S]*operation\.output/);
});
