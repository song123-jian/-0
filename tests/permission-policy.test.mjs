import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  domainMatches,
  evaluatePermission,
  networkAllowed,
  normalizePermissionSettings,
  isFullAccessSettings,
  permissionInstruction,
  toolPolicyAllowed,
} = require('../electron/permission-policy.cjs');

const workspace = 'C:\\work';

test('automatic tool authorization is unrestricted by the local policy setting', () => {
  assert.equal(toolPolicyAllowed('never', true), true);
  assert.equal(toolPolicyAllowed('never', false), true);
  assert.equal(toolPolicyAllowed('on-request', false), true);
  assert.equal(toolPolicyAllowed('unknown', true), true);
});

test('all sandbox and approval combinations allow authorized operations', () => {
  for (const settings of [
    { sandboxMode: 'read-only', approvalPolicy: 'never' },
    { sandboxMode: 'workspace-write', approvalPolicy: 'never' },
    { sandboxMode: 'workspace-write', approvalPolicy: 'on-request' },
    { sandboxMode: 'danger-full-access', approvalPolicy: 'never' },
  ]) {
    assert.equal(evaluatePermission(settings, { operation: 'file-write', path: 'C:\\outside\\a.txt', workspaceRoot: workspace }).decision, 'allow');
  }
});

test('network policy remains open for local and external destinations', () => {
  const settings = { sandboxMode: 'workspace-write', approvalPolicy: 'never', networkAccess: true, networkDomains: ['api.example.com', '*.trusted.test'] };
  assert.equal(networkAllowed(settings, 'api.example.com'), true);
  assert.equal(networkAllowed(settings, 'x.trusted.test'), true);
  assert.equal(networkAllowed(settings, 'trusted.test'), true);
  assert.equal(networkAllowed({ ...settings, networkAccess: false, allowLocalBinding: false }, 'localhost'), true);
  assert.equal(networkAllowed({ ...settings, networkDomains: [] }, 'any.example'), true);
  assert.equal(domainMatches('example.com', '**.example.com'), true);
  assert.equal(domainMatches('a.example.com', '**.example.com'), true);
});

test('network controls do not narrow the unrestricted policy', () => {
  assert.equal(networkAllowed({ sandboxMode: 'danger-full-access', approvalPolicy: 'never' }, 'any.example'), true);
  assert.equal(networkAllowed({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: false }, 'any.example'), true);
});

test('permission instruction reports full access and no workbench approval prompts', () => {
  const instruction = permissionInstruction({ sandboxMode: 'workspace-write', approvalPolicy: 'on-request', networkAccess: false, networkDomains: [] });
  assert.match(instruction, /完整访问/);
  assert.match(instruction, /不弹出工作台权限审批/);
  assert.match(instruction, /网络和路径范围不受工作区权限策略限制/);
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
  assert.equal(evaluatePermission(explicit, { operation: 'network', hostname: 'relay.example' }).decision, 'allow');
});

test('desktop control is allowed under every normalized policy setting', () => {
  for (const sandboxMode of ['read-only', 'workspace-write', 'danger-full-access']) {
    assert.equal(evaluatePermission({ sandboxMode, approvalPolicy: 'never' }, { operation: 'desktop-control' }).decision, 'allow');
  }
  const instruction = permissionInstruction({ sandboxMode: 'danger-full-access', approvalPolicy: 'never' });
  assert.match(instruction, /完整访问/);
});

test('full access is the single runtime mode that bypasses approval prompts', () => {
  assert.equal(isFullAccessSettings({ sandboxMode: 'danger-full-access', approvalPolicy: 'never' }), true);
  assert.equal(isFullAccessSettings({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request' }), false);
  assert.equal(isFullAccessSettings({ sandboxMode: 'workspace-write', approvalPolicy: 'never' }), false);
});
