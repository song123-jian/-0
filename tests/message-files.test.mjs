import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { localMessagePath, parseLocalPaths } from '../src/lib/message-paths.js';
import { parseInline } from '../src/lib/message-presentation.js';
const require = createRequire(import.meta.url);
const { createMessageFiles } = require('../electron/message-files.cjs');
const { readReferenceSettings } = require('../electron/reference-settings.cjs');

test('message paths preserve Chinese, spaces, markdown, line numbers and reject commands', () => {
  const target = 'E:\\项目 文档\\说明.md';
  assert.equal(localMessagePath(target + ':12:3'), target);
  assert.equal(parseInline('`' + target + '`')[0].path, target);
  assert.equal(parseInline('[说明](<' + target + ':12>)')[0].path, target);
  assert.equal(parseInline('[快捷入口](<' + target + ':12>)')[0].label, '快捷入口');
  assert.equal(parseInline('[快捷入口](/D:/cx/.Scodex/EXE快捷启动.lnk)')[0].label, '快捷入口');
  assert.equal(parseInline('[文件夹](file:///D:/%E4%B8%AD%E6%96%87%20space/)')[0].path, 'D:/中文 space/');
  assert.equal(parseLocalPaths('查看 "' + target + '"。')[1].path, target);
  assert.equal(parseInline('E:\\GDP\\a.txt。')[0].path, 'E:\\GDP\\a.txt');
  for (const input of ['../notes.md', 'cmd /c echo x', 'javascript:alert(1)', 'https://example.com', '\\\\host\\share', 'E:\\file.txt:stream', 'E:\\x\n']) assert.equal(localMessagePath(input), null);
});

test('message directory grants enforce scope, expiry, permissions and UTF-8 previews', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-message-unit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = path.join(root, '中文 space'), outside = path.join(root, 'outside');
  await fs.mkdir(folder); await fs.mkdir(outside);
  const file = path.join(folder, '说明.md'); await fs.writeFile(file, '# 中文预览\n正文');
  await fs.writeFile(path.join(folder, 'binary.txt'), Buffer.from([0, 1, 2]));
  await fs.symlink(outside, path.join(folder, 'link'), 'junction');
  let time = 1, denied = false; const opened = [];
  const service = createMessageFiles({ now: () => time, authorize: async () => { if (denied) throw Error('denied'); }, revealFile: target => opened.push(target), openDirectory: target => opened.push(target), openFile: async target => target });
  const grant = await service.locate(file); assert.deepEqual(opened, [file]);
  assert.equal((await service.preview(grant.id, file)).kind, 'markdown');
  assert.equal((await service.preview(grant.id, path.join(folder, 'binary.txt'))).kind, 'unsupported');
  const listing = await service.list(grant.id, folder); assert.equal(listing.items.some(item => item.name === 'link'), false);
  await assert.rejects(service.list(grant.id, outside), /本次点击/);
  await assert.rejects(service.list(grant.id, path.join(folder, 'link')), /链接/);
  denied = true; await assert.rejects(service.preview(grant.id, file), /denied/); denied = false;
  time += 31 * 60 * 1000; await assert.rejects(service.preview(grant.id, file), /过期/);
  await assert.rejects(service.locate(path.join(folder, 'missing')), /不存在/);
  await assert.rejects(service.locate('relative.txt'), /绝对/);
});

test('reference import only exposes compatible public settings, never credentials', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-reference-unit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'browser')); await fs.mkdir(path.join(root, 'computer-use'));
  await fs.writeFile(path.join(root, 'config.toml'), 'approval_policy = "never"\nsandbox_mode = "danger-full-access"\nweb_search = "live"\napi_key = "private-test-value"\n[model_providers.custom]\napproval_policy = "on-request"\n[plugins."browser@openai-bundled"]\nenabled = true\n');
  await fs.writeFile(path.join(root, 'browser/config.toml'), 'approval_mode = "never_ask"\nfull_cdp_access_enabled = true\ndownload_approval_mode = "never_ask"');
  await fs.writeFile(path.join(root, 'computer-use/config.json'), JSON.stringify({ accentColor: '#339cff', locale: 'zh-CN', secret: 'private-test-value' }));
  const result = await readReferenceSettings(root);
  assert.equal(result.categories.browser.browserCdpEnabled, true);
  assert.equal(result.categories.browser.browserAskBeforeDownload, false);
  assert.equal(result.categories.agent.approvalPolicy, 'never');
  assert.equal(result.categories.computer.computerAccentColor, '#339cff');
  assert.ok(!JSON.stringify(result).includes('private-test-value'));
  await fs.writeFile(path.join(root, 'computer-use/config.json'), '{');
  await assert.rejects(readReferenceSettings(root), /有效 JSON/);
});
