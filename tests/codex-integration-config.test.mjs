import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readIntegrationConfig, writeIntegrationConfig, setPluginEnabled } = require('../electron/codex-integration-config.cjs');

test('integration config updates browser and computer values while preserving unknown fields', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'scodex-integration-'));
  try {
    await mkdir(path.join(root, 'browser'), { recursive: true });
    await mkdir(path.join(root, 'computer-use'), { recursive: true });
    await writeFile(path.join(root, 'browser', 'config.toml'), '# retain this comment\ncustom_option = "keep"\napproval_mode = "ask"\n');
    await writeFile(path.join(root, 'computer-use', 'config.json'), JSON.stringify({ customFlag: 'keep', accentColor: '#112233', strings: { extra: 'preserve' } }));

    const saved = await writeIntegrationConfig(root, {
      browser: { approvalMode: 'never_ask', fullCdpAccessEnabled: true },
      computer: { accentColor: '#445566', locale: 'en-US', strings: { usingComputer: 'Using computer' } },
    });
    const browserText = await readFile(path.join(root, 'browser', 'config.toml'), 'utf8');
    const computerValue = JSON.parse(await readFile(path.join(root, 'computer-use', 'config.json'), 'utf8'));
    assert.equal(saved.browser.approvalMode, 'never_ask');
    assert.equal(saved.browser.fullCdpAccessEnabled, true);
    assert.match(browserText, /# retain this comment/);
    assert.match(browserText, /custom_option = "keep"/);
    assert.equal(computerValue.customFlag, 'keep');
    assert.equal(computerValue.strings.extra, 'preserve');
    assert.equal(computerValue.strings.usingComputer, 'Using computer');
    assert.equal(computerValue.locale, 'en-US');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('concurrent browser setting updates preserve independent values', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'scodex-integration-concurrent-'));
  try {
    const configPath = path.join(root, 'browser', 'config.toml');
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, 'approval_mode = "ask"\ndownload_approval_mode = "ask"\n');

    await Promise.all([
      writeIntegrationConfig(root, { browser: { approvalMode: 'never_ask' } }),
      writeIntegrationConfig(root, { browser: { downloadApprovalMode: 'never_ask' } }),
    ]);

    const saved = await readIntegrationConfig(root);
    assert.equal(saved.browser.approvalMode, 'never_ask');
    assert.equal(saved.browser.downloadApprovalMode, 'never_ask');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('plugin enablement updates only the selected TOML section and is reversible', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'scodex-plugin-config-'));
  try {
    const configPath = path.join(root, 'config.toml');
    await writeFile(configPath, '[plugins."keep@provider"]\nenabled = true\nother = "unchanged"\n');
    await setPluginEnabled(configPath, 'keep', 'provider', false);
    let text = await readFile(configPath, 'utf8');
    assert.match(text, /\[plugins\."keep@provider"\]\n(?:[^\n]*\n)*enabled = false/);
    assert.match(text, /other = "unchanged"/);
    await setPluginEnabled(configPath, 'new', 'provider', true);
    text = await readFile(configPath, 'utf8');
    assert.match(text, /\[plugins\."new@provider"\]\nenabled = true/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
