import test from 'node:test';
import assert from 'node:assert/strict';
import { chatModelMode, connectionModels, configuredConnectionModels, chatModel, modelModeError } from '../src/lib/model-list.js';

test('chat modes expose their own model lists and restore each selection independently', () => {
  const state = { connection: { models: ['m1', 'm2'], model: 'm1', subagentModels: ['c1', 'c2'], subagentModel: 'c1', advisorModels: ['a1', 'a2'], advisorModel: 'a1' } };
  const chat = { modelMode: 'subagent', model: 'c2', modelSelections: { main: 'm2', subagent: 'c2', advisor: 'a2' } };
  assert.deepEqual(connectionModels(state, 'subagent'), ['c1', 'c2']);
  assert.deepEqual(connectionModels(state, 'advisor'), ['a1', 'a2']);
  for (const [mode, model] of Object.entries(chat.modelSelections)) assert.equal(chatModel(state, chat, mode), model);
  assert.equal(chatModel(state, { modelMode: 'subagent', model: 'c2' }, 'main'), 'm1');
  assert.equal(chatModel(state, { modelMode: 'advisor', model: 'c2', modelSelections: { advisor: 'removed' } }), 'a1');
  assert.equal(chatModel(state, { model: 'm2' }), 'm2');
  assert.equal(chatModelMode(undefined), 'main');
  assert.equal(chatModelMode('invalid'), 'main');
});

test('unconfigured roles never fall back to the main model and report missing credentials', () => {
  const state = { connection: { models: ['m1'], model: 'm1', hasCredential: true, advisorModels: ['a1'], advisorModel: 'a1', hasAdvisorCredential: false } };
  assert.deepEqual(connectionModels(state, 'subagent'), []);
  assert.equal(chatModel(state, { modelMode: 'subagent', model: 'm1' }), '');
  assert.match(modelModeError(state, 'subagent'), /模式二尚未配置/);
  assert.match(modelModeError(state, 'advisor'), /模式三尚未配置/);
  assert.match(modelModeError({ connection: { ...state.connection, advisorModel: '', hasAdvisorCredential: true } }, 'advisor'), /模式三尚未配置/);
  assert.equal(modelModeError(state, 'main'), '');
  assert.deepEqual(connectionModels({ model: 'legacy' }), ['legacy']);
  assert.deepEqual(connectionModels({ model: 'legacy' }, 'advisor'), []);
});

test('same-address subagent default is hidden only from the main picker while configured history remains retryable', () => {
  const state = { connection: {
    baseUrl: 'https://shared.example/v1', subagentBaseUrl: 'https://shared.example/v1',
    models: ['glm-5.3', 'grok-4.7'], model: 'glm-5.3',
    subagentModels: ['grok-4.6', 'grok-4.7'], subagentModel: 'grok-4.7',
    advisorModels: ['advisor-model'], advisorModel: 'advisor-model',
    hasCredential: true, hasSubagentCredential: true, hasAdvisorCredential: true,
  } };
  assert.deepEqual(configuredConnectionModels(state, 'main'), ['glm-5.3', 'grok-4.7']);
  assert.deepEqual(connectionModels(state, 'main'), ['glm-5.3']);
  assert.deepEqual(connectionModels(state, 'subagent'), ['grok-4.6', 'grok-4.7']);
  assert.equal(chatModel(state, { modelMode: 'main', model: 'grok-4.7' }, 'main'), 'glm-5.3');
  assert.equal(modelModeError(state, 'main'), '');
  assert.deepEqual(connectionModels({ connection: { ...state.connection, subagentBaseUrl: 'https://child.example/v1' } }, 'main'), state.connection.models);
  const sharedDefault = { connection: { ...state.connection, models: ['grok-4.7'], model: 'grok-4.7' } };
  assert.deepEqual(connectionModels(sharedDefault, 'main'), ['grok-4.7']);
  assert.equal(chatModel(sharedDefault, {}, 'main'), 'grok-4.7');
});

test('fetched models replace old IDs and reconcile invalid default and subagent selections', async () => {
  const { replaceModelList } = await import('../src/lib/model-list.js');
  assert.deepEqual(replaceModelList({ models: ['old'], model: 'old', subagentModel: 'old-child' }, ['a', 'b', 'a']),
    { models: ['a', 'b'], model: 'a', subagentModel: 'a' });
  assert.deepEqual(replaceModelList({ model: 'b', subagentModel: 'a' }, ['a', 'b']),
    { models: ['a', 'b'], model: 'b', subagentModel: 'a' });
  assert.equal(replaceModelList({ model: 'old', subagentModel: '' }, ['a']).subagentModel, '');
  assert.throws(() => replaceModelList({ model: 'old' }, []), /为空/);
});
