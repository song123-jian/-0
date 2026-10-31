import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  normalizeAgentSettings,
  responseStyleInstruction,
  toCodexConfigArguments,
} = require('../electron/agent-settings.cjs');

test('agent settings use supported defaults and reject malformed values', () => {
  assert.deepEqual(normalizeAgentSettings(null), {
    approvalPolicy: 'never', sandboxMode: 'danger-full-access', webSearch: 'disabled',
    outputDetail: 'default', reasoningSummary: 'auto',
    availableReasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultReasoningEffort: 'max', workspaceDependencies: true,
  });
  const normalized = normalizeAgentSettings({
    approvalPolicy: 'unexpected', sandboxMode: '../../', webSearch: 'live',
    outputDetail: 'default', reasoningSummary: 'none',
    availableReasoningEfforts: ['ultra', 'bogus', 'low', 'ultra'],
    defaultReasoningEffort: 'medium', workspaceDependencies: false,
  });
  assert.equal(normalized.approvalPolicy, 'never');
  assert.equal(normalized.sandboxMode, 'danger-full-access');
  assert.equal(normalized.webSearch, 'live');
  assert.deepEqual(normalized.availableReasoningEfforts, ['low', 'ultra']);
  assert.equal(normalized.defaultReasoningEffort, 'ultra');
  assert.equal(normalized.workspaceDependencies, false);
});

test('CLI overrides cover the referenced settings and omit unsupported default verbosity', () => {
  const args = toCodexConfigArguments({
    approvalPolicy: 'on-request', sandboxMode: 'workspace-write', webSearch: 'indexed',
    outputDetail: 'default', reasoningSummary: 'concise',
    availableReasoningEfforts: ['low', 'high', 'max'], defaultReasoningEffort: 'high',
    workspaceDependencies: false,
  });
  assert.deepEqual(args, [
    '--config', 'approval_policy="on-request"',
    '--config', 'sandbox_mode="workspace-write"',
    '--config', 'web_search="indexed"',
    '--config', 'model_reasoning_effort="high"',
    '--config', 'model_reasoning_summary="concise"',
    '--disable', 'workspace_dependencies',
  ]);
  assert.ok(!args.some((argument) => argument.startsWith('model_verbosity=')));
});

test('response style applies saved detail and summary without exposing hidden reasoning', () => {
  const prompt = responseStyleInstruction({
    outputDetail: 'high', reasoningSummary: 'detailed',
    availableReasoningEfforts: ['low', 'medium', 'high'], defaultReasoningEffort: 'medium',
  }, 'high');
  assert.match(prompt, /较完整的解释/);
  assert.match(prompt, /结构化的关键依据/);
  assert.match(prompt, /不要输出隐含的逐步思维链/);
  assert.doesNotMatch(responseStyleInstruction({ availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low' }, 'ultra'), /全面核对/);
});

test('malformed setting shapes and disabled default efforts recover to a usable selection', () => {
  for (const value of [[], 'settings', 1, null]) assert.deepEqual(normalizeAgentSettings(value), normalizeAgentSettings());
  const settings = normalizeAgentSettings({ availableReasoningEfforts: [null, {}, 5, 'wrong'], workspaceDependencies: 'false' });
  assert.deepEqual(settings.availableReasoningEfforts, ['max']);
  assert.equal(settings.defaultReasoningEffort, 'max');
  assert.equal(settings.workspaceDependencies, true);
  assert.equal(normalizeAgentSettings({ availableReasoningEfforts: ['low'], defaultReasoningEffort: 'ultra' }).defaultReasoningEffort, 'low');
});

test('all reference enum values reach their intended CLI settings', () => {
  for (const [key, values, argument] of [
    ['approvalPolicy', ['on-request', 'never'], 'approval_policy'],
    ['sandboxMode', ['read-only', 'workspace-write', 'danger-full-access'], 'sandbox_mode'],
    ['webSearch', ['disabled', 'cached', 'indexed', 'live'], 'web_search'],
    ['outputDetail', ['low', 'medium', 'high'], 'model_verbosity'],
    ['reasoningSummary', ['auto', 'concise', 'detailed', 'none'], 'model_reasoning_summary'],
  ]) {
    for (const value of values) assert.ok(toCodexConfigArguments({ [key]: value }).includes(`${argument}="${value}"`));
  }
  for (const effort of ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']) {
    assert.ok(toCodexConfigArguments({ availableReasoningEfforts: [effort], defaultReasoningEffort: effort }).includes(`model_reasoning_effort="${effort}"`));
  }
});

test('per-conversation effort survives storage while legacy and invalid records remain compatible', () => {
  const { createConversation, normalizeLibrary } = require('../electron/conversations.cjs');
  const first = createConversation('answer', undefined, 'low');
  const second = createConversation('plan', undefined, 'ultra');
  const normalized = normalizeLibrary({ activeId: second.id, conversations: [first, second, { id: 'legacy', title: '旧聊天' }, { id: 'invalid', reasoningEffort: 'wrong' }] });
  assert.deepEqual(normalizeLibrary(JSON.parse(JSON.stringify(normalized))), normalized);
  assert.deepEqual(normalized.conversations.map((item) => item.reasoningEffort), ['low', 'ultra', undefined, undefined]);
  assert.equal(normalized.activeId, second.id);
});
