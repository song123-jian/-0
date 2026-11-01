import test from 'node:test';
import assert from 'node:assert/strict';

test('fetched models replace old IDs and reconcile invalid default and subagent selections', async () => {
  const { replaceModelList } = await import('../src/lib/model-list.js');
  assert.deepEqual(replaceModelList({ models: ['old'], model: 'old', subagentModel: 'old-child' }, ['a', 'b', 'a']),
    { models: ['a', 'b'], model: 'a', subagentModel: 'a' });
  assert.deepEqual(replaceModelList({ model: 'b', subagentModel: 'a' }, ['a', 'b']),
    { models: ['a', 'b'], model: 'b', subagentModel: 'a' });
  assert.equal(replaceModelList({ model: 'old', subagentModel: '' }, ['a']).subagentModel, '');
  assert.throws(() => replaceModelList({ model: 'old' }, []), /为空/);
});
