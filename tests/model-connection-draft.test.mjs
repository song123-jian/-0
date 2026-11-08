import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConnectionDraft, roleSavePayload } from '../src/lib/model-connection-draft.js';

test('individual role save uses latest persistence and omits other credentials and drafts', () => {
  const saved = { baseUrl: 'https://main.example/v1', model: 'main', subagentModel: 'child-newer', advisorModel: 'advisor-newer' };
  const draft = { ...saved, model: 'draft-main', subagentModel: 'draft-child', advisorModel: 'draft-advisor' };
  for (const [role, field, key] of [['main', 'model', 'apiKey'], ['subagent', 'subagentModel', 'subagentApiKey'], ['advisor', 'advisorModel', 'advisorApiKey']]) {
    const payload = roleSavePayload(saved, draft, role, 'new-secret');
    assert.equal(payload[field], draft[field]); assert.equal(payload[key], 'new-secret');
    for (const other of ['model', 'subagentModel', 'advisorModel'].filter(f => f !== field)) assert.equal(payload[other], saved[other]);
    assert.deepEqual(Object.keys(payload).filter(k => /ApiKey$|^apiKey$/.test(k)), [key]);
  }
});

test('saved connection updates metadata while preserving other dirty form fields', () => {
  const dirty = new Set(['subagentModel', 'advisorModel', 'subagentApiKey']);
  const merged = mergeConnectionDraft({ model: 'old-main', subagentModel: 'draft-child', advisorModel: 'draft-advisor' }, { model: 'saved-main', subagentModel: 'old-child', advisorModel: 'old-advisor', hasCredential: true }, dirty);
  assert.equal(merged.model, 'saved-main'); assert.equal(merged.hasCredential, true);
  assert.equal(merged.subagentModel, 'draft-child'); assert.equal(merged.advisorModel, 'draft-advisor');
  assert.equal(Object.hasOwn(merged, 'subagentApiKey'), false);
});
