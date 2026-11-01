const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../release/browser-cdp-20261101');
const profile = fs.mkdtempSync(path.join(output, 'boundary-profile-'));
app.setPath('userData', profile);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const report = { electron: process.versions.electron, profile, status: 'running' };
  const windows = [];
  try {
    for (const title of ['CDP probe AI', 'CDP probe manual']) {
      const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: title } });
      windows.push(window);
      await window.loadURL('data:text/html,<title>' + title + '</title>');
    }
    const debuggerApi = windows[0].webContents.debugger;
    debuggerApi.attach('1.3');
    const targets = await debuggerApi.sendCommand('Target.getTargets');
    report.targets = targets.targetInfos.map(({ targetId, title, type }) => ({ targetId, title, type }));
    const manual = targets.targetInfos.find(target => target.title === 'CDP probe manual');
    if (manual) {
      try {
        const { sessionId } = await debuggerApi.sendCommand('Target.attachToTarget', { targetId: manual.targetId, flatten: true });
        report.crossTargetResult = await debuggerApi.sendCommand('Runtime.evaluate', { expression: 'document.title', returnByValue: true }, sessionId);
      } catch (error) { report.crossTargetError = error.message; }
    }
    report.status = 'completed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }
  finally {
    for (const window of windows) if (!window.isDestroyed()) window.destroy();
    fs.writeFileSync(path.join(output, 'boundary-probe.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    app.quit();
  }
});
