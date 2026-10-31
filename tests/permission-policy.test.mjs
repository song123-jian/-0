import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  domainMatches,
  evaluatePermission,
  networkAllowed,
  normalizePermissionSettings,
  permissionInstruction,
} = require('../electron/permission-policy.cjs');

const workspace = 'C:\\work';

test('official sandbox and approval combinations produce stable decisions', () => {
  assert.equal(evaluatePermission({ sandboxMode: 'read-only', approvalPolicy: 'never' }, { operation: 'file-write', path: `${workspace}\\a.txt`, workspaceRoot: workspace }).decision, 'deny');
  assert.equal(evaluatePermission({ sandboxMode: 'workspace-write', approvalPolicy: 'never' }, { operation: 'file-write', path: `${workspace}\\a.txt`, workspaceRoot: workspace }).decision, 'allow');
  assert.equal(evaluatePermission({ sandboxMode: 'workspace-write', approvalPolicy: 'on-request' }, { operation: 'file-write', path: 'C:\\outside\\a.txt', workspaceRoot: workspace }).decision, 'approval-required');
  assert.equal(evaluatePermission({ sandboxMode: 'danger-full-access', approvalPolicy: 'never' }, { operation: 'file-write', path: 'C:\\outside\\a.txt', workspaceRoot: workspace }).decision, 'allow');
});

test('network policy is allowlist-first and protects local destinations', () => {
  const settings = { sandboxMode: 'workspace-write', approvalPolicy: 'never', networkAccess: true, networkDomains: ['api.example.com', '*.trusted.test'] };
  assert.equal(networkAllowed(settings, 'api.example.com'), true);
  assert.equal(networkAllowed(settings, 'x.trusted.test'), true);
  assert.equal(networkAllowed(settings, 'trusted.test'), false);
  assert.equal(networkAllowed(settings, 'localhost'), false);
  assert.equal(networkAllowed({ ...settings, allowLocalBinding: true }, 'localhost'), true);
  assert.equal(domainMatches('example.com', '**.example.com'), true);
  assert.equal(domainMatches('a.example.com', '**.example.com'), true);
});

test('danger full access keeps legacy unrestricted behavior until network controls are explicit', () => {
  assert.equal(networkAllowed({ sandboxMode: 'danger-full-access', approvalPolicy: 'never' }, 'any.example'), true);
  assert.equal(networkAllowed({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: false }, 'any.example'), false);
});

test('permission instruction states that prompts cannot escalate the OS token', () => {
  const instruction = permissionInstruction({ sandboxMode: 'workspace-write', approvalPolicy: 'on-request', networkAccess: true, networkDomains: ['api.example.com'] });
  assert.match(instruction, /工作空间写入沙箱/);
  assert.match(instruction, /按请求审批/);
  assert.match(instruction, /管理员令牌/);
});

test('permission settings normalize malformed domains without widening access', () => {
  const settings = normalizePermissionSettings({ networkAccess: true, networkDomains: ['api.example.com', 'bad domain', '*.ok.test', '*.ok.test'], allowLocalBinding: 'yes' });
  assert.deepEqual(settings.networkDomains, ['api.example.com', '*.ok.test']);
  assert.equal(settings.allowLocalBinding, true);
});


test('normalized policies remain idempotent through main-process permission checks', () => {
  const implicit = normalizePermissionSettings({ sandboxMode: 'danger-full-access', approvalPolicy: 'never' });
  assert.deepEqual(normalizePermissionSettings(implicit), implicit);
  assert.equal(evaluatePermission(implicit, { operation: 'network', hostname: 'relay.example' }).decision, 'allow');
  const explicit = normalizePermissionSettings({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: false });
  assert.deepEqual(normalizePermissionSettings(explicit), explicit);
  assert.equal(evaluatePermission(explicit, { operation: 'network', hostname: 'relay.example' }).decision, 'deny');
});
