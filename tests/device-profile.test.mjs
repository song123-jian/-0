import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createModelConnection, DEFAULT_CONNECTION } = require('../electron/model-connection.cjs');
const encryption = { isEncryptionAvailable: () => true, encryptString: text => Buffer.from('test:' + text), decryptString: bytes => bytes.toString().slice(5) };
test('the composer has no inherited model when the connection is unconfigured', async () => {
  const { connectionModels } = await import('../src/lib/model-list.js');
  assert.equal(typeof connectionModels, 'function', 'A clean connection must not display a hardcoded model');
  assert.deepEqual(connectionModels({ connection: { models: [], model: '' }, model: '' }), []);
  assert.deepEqual(connectionModels({ connection: { models: ['configured'], model: 'configured' } }), ['configured']);
  assert.deepEqual(connectionModels({ model: 'legacy-configured' }), ['legacy-configured']);
});
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-device-profile-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
function deviceModule() {
  assert.equal(existsSync(new URL('../electron/device-profile.cjs', import.meta.url)), true, 'Device ownership selection must be implemented');
  return require('../electron/device-profile.cjs');
}

test('new installation has an empty provider, models and credentials without importing a legacy key', async t => {
  const directory = await fixture(t); let legacyCalls = 0;
  const service = createModelConnection(path.join(directory, 'model-connection.json'), { encryption, blankOnMissing: true, legacyKey: () => { legacyCalls++; return 'must-not-import'; } });
  const state = await service.get();
  assert.equal(state.baseUrl, ''); assert.equal(state.name, ''); assert.equal(state.model, '');
  assert.deepEqual(state.models, []); assert.deepEqual(state.addresses, []);
  assert.equal(state.hasCredential, false); assert.equal(state.hasSubagentCredential, false);
  await assert.rejects(service.request(), /配置|填写/);
  assert.equal(legacyCalls, 0);
});

test('a clean connection can discover models before a default model is selected', async t => {
  const directory = await fixture(t); let calls = 0;
  const service = createModelConnection(path.join(directory, 'model-connection.json'), { encryption, blankOnMissing: true,
    fetchImpl: async (url, options) => {
      calls++; assert.equal(url, 'https://example.invalid/v1/models');
      assert.equal(options.headers.authorization, 'Bearer controlled-discovery-key');
      return new Response(JSON.stringify({ data: [{ id: 'first-discovered-model' }] }));
    } });
  const input = { ...await service.get(), name: 'New provider', baseUrl: 'https://example.invalid/v1', apiKey: 'controlled-discovery-key' };
  const result = await service.models(input);
  assert.deepEqual(result.models, ['first-discovered-model']); assert.equal(calls, 1);
  assert.equal((await service.get()).model, '');
  await assert.rejects(service.save(input), /默认模型/);
});

test('saving then reopening a clean connection retains the configured model and credential', async t => {
  const directory = await fixture(t); const file = path.join(directory, 'model-connection.json');
  const service = createModelConnection(file, { encryption, blankOnMissing: true });
  await service.save({ ...DEFAULT_CONNECTION, name: 'Test provider', baseUrl: 'https://example.invalid/v1', model: 'configured-model', models: ['configured-model'], apiKey: 'test-only-key' });
  const reopened = createModelConnection(file, { encryption, blankOnMissing: true });
  assert.equal((await reopened.get()).model, 'configured-model');
  assert.equal((await reopened.request()).apiKey, 'test-only-key');
});

test('first startup registers this computer and the same computer preserves settings and history', async t => {
  const directory = await fixture(t); const profile = path.join(directory, 'profile');
  const { prepareDeviceProfile } = deviceModule();
  const first = prepareDeviceProfile(profile, { machineId: 'controlled-computer-A' });
  assert.equal(first.profile, profile); assert.equal(first.isolatedHome, true); assert.equal(first.allowLegacy, false);
  await fs.writeFile(path.join(profile, 'settings.json'), 'existing-settings');
  await fs.writeFile(path.join(profile, 'conversations.json'), 'existing-history');
  const again = prepareDeviceProfile(profile, { machineId: 'controlled-computer-A' });
  assert.equal(again.profile, first.profile);
  assert.equal(await fs.readFile(path.join(again.profile, 'settings.json'), 'utf8'), 'existing-settings');
  assert.equal(await fs.readFile(path.join(again.profile, 'conversations.json'), 'utf8'), 'existing-history');
  assert.equal(again.isolatedHome, true); assert.equal(again.allowLegacy, false);
  assert.equal((await fs.readFile(path.join(profile, 'device-profile.json'), 'utf8')).includes('controlled-computer-A'), false);
});

test('a transferred profile opens a blank device profile and never modifies the original computer data', async t => {
  const directory = await fixture(t); const profile = path.join(directory, 'profile');
  const { prepareDeviceProfile } = deviceModule();
  prepareDeviceProfile(profile, { machineId: 'controlled-computer-A' });
  await fs.writeFile(path.join(profile, 'settings.json'), 'source-settings');
  await fs.writeFile(path.join(profile, 'model-connection.json'), 'source-credential-file');
  const second = prepareDeviceProfile(profile, { machineId: 'controlled-computer-B' });
  assert.notEqual(second.profile, profile); assert.equal(second.isolatedHome, true); assert.equal(second.allowLegacy, false);
  assert.equal(existsSync(path.join(second.profile, 'model-connection.json')), false);
  assert.equal(existsSync(path.join(second.profile, 'settings.json')), false);
  await fs.writeFile(path.join(second.profile, 'settings.json'), 'computer-B-settings');
  const secondAgain = prepareDeviceProfile(profile, { machineId: 'controlled-computer-B' });
  assert.equal(secondAgain.profile, second.profile);
  assert.equal(await fs.readFile(path.join(secondAgain.profile, 'settings.json'), 'utf8'), 'computer-B-settings');
  assert.equal(await fs.readFile(path.join(profile, 'model-connection.json'), 'utf8'), 'source-credential-file');
  assert.equal(prepareDeviceProfile(profile, { machineId: 'controlled-computer-A' }).profile, profile);
});

test('upgrading an existing unmarked installation adopts its settings without resetting them', async t => {
  const directory = await fixture(t); const profile = path.join(directory, 'profile');
  await fs.mkdir(profile); await fs.writeFile(path.join(profile, 'settings.json'), 'legacy-settings');
  const { prepareDeviceProfile } = deviceModule();
  const selected = prepareDeviceProfile(profile, { machineId: 'controlled-computer-A' });
  assert.equal(selected.profile, profile); assert.equal(selected.isolatedHome, false); assert.equal(selected.allowLegacy, true);
  assert.equal(await fs.readFile(path.join(profile, 'settings.json'), 'utf8'), 'legacy-settings');
});

test('invalid computer identity and a corrupt ownership marker fail without rewriting user data', async t => {
  const directory = await fixture(t); const profile = path.join(directory, 'profile');
  const { prepareDeviceProfile } = deviceModule();
  assert.throws(() => prepareDeviceProfile(profile, { machineId: '' }), /电脑|设备/);
  assert.equal(existsSync(profile), false);
  await fs.mkdir(profile); await fs.writeFile(path.join(profile, 'device-profile.json'), 'broken-marker');
  await fs.writeFile(path.join(profile, 'settings.json'), 'preserve-settings');
  assert.throws(() => prepareDeviceProfile(profile, { machineId: 'controlled-computer-A' }), /标记/);
  assert.equal(await fs.readFile(path.join(profile, 'device-profile.json'), 'utf8'), 'broken-marker');
  assert.equal(await fs.readFile(path.join(profile, 'settings.json'), 'utf8'), 'preserve-settings');
});
