const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createCdpScope } = require('../electron/browser-cdp-scope.cjs');
const output = path.resolve(__dirname, '../release/browser-cdp-20261101');
const profile = fs.mkdtempSync(path.join(output, 'native-scope-profile-'));
app.setPath('userData', profile);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const windows = [];
  const report = { status: 'running', electron: process.versions.electron, profile };
  try {
    for (const name of ['owned', 'manual']) {
      const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, partition: name + '-' + Date.now() } });
      windows.push(window);
      await window.loadURL('data:text/html,<title>Scope fixture</title>');
      await window.webContents.session.cookies.set({ url: 'https://scope.invalid', name, value: 'controlled' });
    }
    const api = windows[0].webContents.debugger;
    api.attach('1.3');
    const scope = createCdpScope();
    const read = await scope.execute(api, 'Storage.getCookies');
    assert.deepEqual(read.cookies.map(cookie => cookie.name), ['owned']);
    await scope.execute(api, 'Storage.setCookies', { cookies: [{ url: 'https://scope.invalid', name: 'second', value: 'controlled' }] });
    assert.equal((await windows[0].webContents.session.cookies.get({})).length, 2);
    await scope.execute(api, 'Storage.clearCookies');
    assert.equal((await windows[0].webContents.session.cookies.get({})).length, 0);
    assert.deepEqual((await windows[1].webContents.session.cookies.get({})).map(cookie => cookie.name), ['manual']);
    const arithmetic = await scope.execute(api, 'Runtime.evaluate', { expression: "({count:Math.floor((4*1024*1024-64*1024-256)/3),length:'汉'.repeat(Math.floor((4*1024*1024-64*1024-256)/3)).length})", returnByValue: true });
    report.unicodeArithmetic = arithmetic.result.value;
    const raw = await scope.execute(api, 'Runtime.evaluate', { expression: "'汉'.repeat(Math.floor((4*1024*1024-64*1024-256)/3))", returnByValue: true });
    report.rawStringLength = raw.result.value.length;
    report.rawStringSha256 = require('node:crypto').createHash('sha256').update(raw.result.value).digest('hex');
    assert.equal(report.rawStringLength, Math.floor((4 * 1024 * 1024 - 64 * 1024 - 256) / 3));
    report.status = 'passed';
    report.checks = ['owned read', 'owned write', 'owned clear with manual cookie preserved'];
  } catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }
  finally {
    for (const window of windows) if (!window.isDestroyed()) window.destroy();
    fs.writeFileSync(path.join(output, 'native-scope-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    app.quit();
  }
});
