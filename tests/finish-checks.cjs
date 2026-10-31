const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const executeFile = promisify(execFile);

module.exports = async ({ cdp, clickByText, waitFor, stopProcessTree }) => {
  const click = (label) => cdp.evaluate('document.querySelector(' + JSON.stringify('[aria-label="' + label + '"]') + ').click()');
  const terminalProcesses = async () => {
    const query = "Get-CimInstance Win32_Process -Filter \"Name = 'powershell.exe'\" | Where-Object { $_.CommandLine -match '\\s-NoExit(?:\\s|$)' -and $_.CommandLine -notmatch '-EncodedCommand' } | Select-Object -ExpandProperty ProcessId";
    const { stdout } = await executeFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(query, 'utf16le').toString('base64')], { windowsHide: true });
    return stdout.trim().split(/\s+/).filter(Boolean).map(Number);
  };
  let terminalPid;
  try {
    const before = await terminalProcesses();
    await clickByText(cdp, '.browser-tool-list button', '终端');
    terminalPid = await waitFor(async () => (await terminalProcesses()).find((id) => !before.includes(id)), 'interactive PowerShell process');
    await waitFor(() => cdp.evaluate("document.querySelector('.toast')?.textContent.includes('已在当前工作区打开 PowerShell')"), 'successful terminal launch result');
    await stopProcessTree([terminalPid]);
    terminalPid = null;
    assert.deepEqual(await terminalProcesses(), before, 'No terminal or launcher created by this test may remain');
    console.log('Interactive terminal verified from UI; actual -NoExit process closed, no test shell remains.');
    await click('收起标签工作台');
    await click('工作台设置');
    await clickByText(cdp, '.settings-category', '外观');
    await cdp.command('DOM.enable');
    await cdp.command('CSS.enable');
    const document = await cdp.command('DOM.getDocument', { depth: 0 });
    for (const selector of ['.settings-detail-heading h1', '.settings-row-copy strong', '.settings-row-copy p']) {
      const { nodeId } = await cdp.command('DOM.querySelector', { nodeId: document.root.nodeId, selector });
      const { fonts } = await cdp.command('CSS.getPlatformFontsForNode', { nodeId });
      assert.ok(fonts.some((font) => /Microsoft YaHei|微软雅黑/i.test(font.familyName)), 'Actual rendered font for ' + selector + ': ' + JSON.stringify(fonts));
      console.log('Actual platform fonts:', selector, JSON.stringify(fonts.map(({ familyName, glyphCount }) => ({ familyName, glyphCount }))));
    }
    await cdp.evaluate("{ const select=document.querySelector('select[aria-label=\"字体大小\"]'); select.value='20'; select.dispatchEvent(new Event('change',{bubbles:true})); }");
    await waitFor(() => cdp.evaluate("getComputedStyle(document.querySelector('.app-shell')).fontSize==='20px'"), '20px large text');
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
    const overflow = await cdp.evaluate("[...document.querySelectorAll('.settings-search,.settings-row-control,.settings-category')].filter(el=>el.getBoundingClientRect().width).map(el=>({text:el.textContent,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).filter(el=>el.left<0||el.right>innerWidth+1)");
    assert.deepEqual(overflow, [], 'Large text settings layout at 1064px');
    await cdp.evaluate("{ const select=document.querySelector('select[aria-label=\"字体大小\"]'); select.value='16'; select.dispatchEvent(new Event('change',{bubbles:true})); }");
    await waitFor(() => cdp.evaluate("getComputedStyle(document.querySelector('.app-shell')).fontSize==='16px'"), 'restore default font');
    await cdp.command('Emulation.clearDeviceMetricsOverride');
    await click('工作台首页');
    await clickByText(cdp, '.new-task-button', '新建对话');
    await click('打开第三工作台');
    await waitFor(() => cdp.evaluate("document.querySelectorAll('.mode-card').length===4&&!document.querySelector('.browser-pane').hidden"), 'final shell');
    console.log('Font finish checks passed: actual Microsoft YaHei font glyphs, 20px settings at 1064x660, restored 16px desktop shell.');
  } finally {
    if (terminalPid) await stopProcessTree([terminalPid]);
  }
};
