const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const executeFile = promisify(execFile);
const http = require('node:http');
const path = require('node:path');

module.exports = async function checkShell({ cdp, createCdp, clickByText, replaceFocusedText, waitFor, profileRoot, releaseRoot, port, stopProcessTree, applicationPid }) {
  const browserState = () => cdp.evaluate('window.scodex.getBrowserState()');
  const click = (label) => cdp.evaluate('document.querySelector(' + JSON.stringify('[aria-label="' + label + '"]') + ').click()');
  const visibleSettings = () => click('工作台设置');
  const preferencesFile = path.join(profileRoot, 'settings.json');
  let remoteSocket;
  let visits = 0;
  const server = http.createServer((request, response) => {
    visits += 1;
    const second = request.url === '/second';
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><meta charset="utf-8"><title>' + (second ? '网页二' : '网页一') + '</title><h1>' +
      (second ? '第二个真实页面' : '第一个真实页面') + '</h1><a href="/second">下一页</a>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = 'http://127.0.0.1:' + server.address().port + '/first';
  try {
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.activity-rail')) && document.querySelectorAll('.browser-tab').length === 1"), 'activity rail and new tab');
    if (!await cdp.evaluate("!document.querySelector('.browser-pane').hidden")) await click('打开第三工作台');
    assert.equal(await cdp.evaluate("document.querySelectorAll('button[aria-label=\"工作台设置\"]').length"), 1);
    assert.equal(await cdp.evaluate("Boolean(document.querySelector('.top-settings'))"), false);
    if (process.env.SCODEX_REUSE_BROWSER !== '1') {
    await replaceFocusedText(cdp, 'input[aria-label="搜索或输入网址"]', address);
    await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
    await waitFor(async () => (await browserState()).tabs.some((tab) => tab.title === '网页一' && !tab.loading && !tab.error), 'real web page navigation through address bar');
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    const remote = pages.find((page) => page.url === address);
    assert.ok(remote?.webSocketDebuggerUrl, 'Expected a separate web contents target');
    remoteSocket = new WebSocket(remote.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { remoteSocket.addEventListener('open', resolve, { once: true }); remoteSocket.addEventListener('error', reject, { once: true }); });
    const remoteCdp = createCdp(remoteSocket);
    assert.deepEqual(await remoteCdp.evaluate("({ text: document.querySelector('h1').textContent, localBridge: typeof window.scodex, requireType: typeof require })"), {
      text: '第一个真实页面', localBridge: 'undefined', requireType: 'undefined',
    });
    await remoteCdp.evaluate("window.retainedSmokeValue = '隐藏页面仍保留'; document.querySelector('a').click()");
    await waitFor(async () => (await browserState()).tabs.some((tab) => tab.title === '网页二' && tab.canGoBack && !tab.loading), 'remote link and history');
    await click('网页后退');
    await waitFor(async () => (await browserState()).tabs.some((tab) => tab.title === '网页一' && tab.canGoForward && !tab.loading), 'browser back');
    await click('网页前进');
    await waitFor(async () => (await browserState()).tabs.some((tab) => tab.title === '网页二' && !tab.loading), 'browser forward');
    await remoteCdp.evaluate("window.retainedSmokeValue = '隐藏页面仍保留'");
    const visitCount = visits;
    await click('收起标签工作台');
    await waitFor(() => cdp.evaluate("document.querySelector('.browser-pane').hidden"), 'hidden third panel');
    await click('打开第三工作台');
    await waitFor(() => cdp.evaluate("!document.querySelector('.browser-pane').hidden"), 'restored third panel');
    assert.equal(await remoteCdp.evaluate('window.retainedSmokeValue'), '隐藏页面仍保留');
    assert.equal(visits, visitCount, 'Hiding and showing the panel must not reload the web page');
    await click('新建标签页');
    await waitFor(async () => (await browserState()).tabs.length === 2, 'second tab');
    const firstId = (await browserState()).tabs[0].id;
    await cdp.evaluate('document.querySelectorAll(\'.browser-tab [role="tab"]\')[0].click()');
    await waitFor(async () => (await browserState()).activeId === firstId, 'tab selection');
    assert.equal(await remoteCdp.evaluate('window.retainedSmokeValue'), '隐藏页面仍保留');
    await cdp.evaluate("document.querySelector('.browser-tab.active .tab-close').click()");
    await waitFor(async () => (await browserState()).tabs.length === 1 && !(await browserState()).tabs[0].url, 'close active web tab');
    remoteSocket.close(); remoteSocket = null;
    for (let count = 1; count < 10; count += 1) {
      await click('新建标签页');
      await waitFor(async () => (await browserState()).tabs.length === count + 1, 'tab limit count');
    }
    assert.equal(await cdp.evaluate('document.querySelector(\'button[aria-label="新建标签页"]\').disabled'), true);
    assert.match(await cdp.evaluate("window.scodex.browserAction({ type: 'new' }).then(() => '', error => error.message)"), /10/);
    const allTabs = (await browserState()).tabs;
    for (const tab of allTabs) await cdp.evaluate('window.scodex.browserAction({type:"close",id:' + JSON.stringify(tab.id) + '})');
    assert.equal((await browserState()).tabs.length, 1, 'Closing last tab creates one new blank tab');
    const blocked = await cdp.evaluate("window.scodex.browserAction({type:'navigate',url:'file:///C:/Windows/win.ini'}).then(() => '',error => error.message)");
    assert.match(blocked, /HTTP/);
    }
    const terminalProcesses = async () => {
      const query = "Get-CimInstance Win32_Process -Filter \"Name = 'powershell.exe'\" | Where-Object { $_.CommandLine -match '\\s-NoExit(?:\\s|$)' -and $_.CommandLine -notmatch '-EncodedCommand' } | Select-Object -ExpandProperty ProcessId";
      const result = await executeFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(query, 'utf16le').toString('base64')], { windowsHide: true });
      return result.stdout.trim().split(/\s+/).filter(Boolean).map(Number);
    };
    const beforeTerminal = await terminalProcesses();
    await clickByText(cdp, '.browser-tool-list button', '终端');
    const terminalPid = await waitFor(async () => (await terminalProcesses()).find((pid) => !beforeTerminal.includes(pid)), 'native PowerShell launch');
    await waitFor(() => cdp.evaluate("document.querySelector('.toast')?.textContent.includes('已在当前工作区打开 PowerShell')"), 'terminal launcher completion');
    await stopProcessTree([terminalPid]);
    console.log('Native terminal entry passed: UI launched a separate PowerShell process, and the test-owned process was closed.');
    console.log((process.env.SCODEX_REUSE_BROWSER === '1' ? 'Reused prior unchanged browser integration: ' : 'Browser integration passed: ') + ' real loopback HTTP pages, separate target/no local bridge, back/forward, hide retention, tabs/limit and file protocol rejection. External sites/download dialogs were not exercised.');

    await click('放大标签工作台');
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.app-shell.browser-expanded'))"), 'expanded third workbench');
    await click('还原标签工作台');
    await waitFor(() => cdp.evaluate("!document.querySelector('.app-shell.browser-expanded')"), 'restored split workbench');
    await click('收起标签工作台');
    await visibleSettings();
    await waitFor(() => cdp.evaluate("document.querySelector('.settings-detail-heading h1')?.textContent === '常规'"), 'reference-style general settings');
    await clickByText(cdp, '.settings-category', '外观');
    await cdp.evaluate("{ const control = document.querySelector('select[aria-label=\"字体大小\"]'); control.value = '18'; control.dispatchEvent(new Event('change', {bubbles:true})); }");
    await waitFor(async () => JSON.parse(await fs.readFile(preferencesFile, 'utf8')).preferences.fontSize === 18, 'font size disk readback');
    await waitFor(() => cdp.evaluate("getComputedStyle(document.querySelector('.app-shell')).fontSize === '18px'"), 'large text live update');
    await replaceFocusedText(cdp, 'input[aria-label="搜索设置"]', '模型');
    await waitFor(() => cdp.evaluate("document.querySelectorAll('.settings-category').length === 1 && document.querySelector('.settings-detail-heading h1')?.textContent === '模型与连接'"), 'settings search');
    await replaceFocusedText(cdp, 'input[aria-label="搜索设置"]', '没有此设置项');
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.settings-search-empty'))"), 'settings empty result');
    await click('清除设置搜索');
    await clickByText(cdp, '.settings-category', '外观');
    await cdp.evaluate("{ const control = document.querySelector('select[aria-label=\"字体大小\"]'); control.value = '16'; control.dispatchEvent(new Event('change', {bubbles:true})); }");
    await waitFor(async () => JSON.parse(await fs.readFile(preferencesFile, 'utf8')).preferences.fontSize === 16, 'restore readable default');
    for (const label of ['工作台与标签', '文件与存储', '键盘快捷键', '模型与连接', 'SKILL 技能', '关于 Scodex', '常规']) {
      await clickByText(cdp, '.settings-category', label);
      await waitFor(() => cdp.evaluate('document.querySelector(".settings-detail-heading h1")?.textContent === ' + JSON.stringify(label)), 'settings category ' + label);
    }
    await cdp.evaluate('document.querySelector(\'button[aria-label="关闭提示"]\')?.click()');
    await cdp.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const settingsScreenshot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(path.join(releaseRoot, 'workbench-settings.png'), Buffer.from(settingsScreenshot.data, 'base64'));
    await cdp.evaluate("Promise.all([window.scodex.savePreferences({ defaultMode: 'code' }), window.scodex.savePreferences({ browserPanelOpen: false }), window.scodex.savePreferences({ fontSize: 18 })])");
    const concurrent = JSON.parse(await fs.readFile(preferencesFile, 'utf8')).preferences;
    assert.equal(concurrent.defaultMode, 'code'); assert.equal(concurrent.browserPanelOpen, false); assert.equal(concurrent.fontSize, 18);
    await waitFor(() => cdp.evaluate("document.querySelector('.history-save-state')?.textContent === '已保存到本机'"), 'history save before reload');
    await cdp.command('Page.reload');
    await waitFor(() => cdp.evaluate("document.querySelector('.app-shell') && getComputedStyle(document.querySelector('.app-shell')).fontSize === '18px' && document.querySelector('.browser-pane').hidden"), 'new preference reload');
    await cdp.evaluate("window.scodex.savePreferences({ defaultMode: 'answer', fontSize: 16, browserPanelOpen: true, railCollapsed: false, browserPanelExpanded: false })");
    await cdp.command('Page.reload');
    await waitFor(() => cdp.evaluate("document.querySelector('.browser-pane') && !document.querySelector('.browser-pane').hidden && getComputedStyle(document.querySelector('.app-shell')).fontSize === '16px'"), 'restored readable shell');

    for (const viewport of [{ width: 1464, height: 901 }, { width: 1064, height: 660 }]) {
      await cdp.command('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: false });
      for (const label of ['助手', '文件与代码', '图片', '表格', '技能', '对话记录', '工作台设置']) {
        if (label === '助手') await click('工作台首页');
        else await cdp.evaluate('document.querySelector(' + JSON.stringify('.nav-item[aria-label="' + label + '"]') + ').click()');
        await cdp.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const result = await cdp.evaluate("(() => { const visible = el => el.getBoundingClientRect().width && el.getBoundingClientRect().height && getComputedStyle(el).visibility !== 'hidden'; const els = [...document.querySelectorAll('.activity-rail, .browser-pane, .browser-tabs-toolbar, .browser-address-toolbar, .tool-heading button, .composer-box, .settings-view, .settings-detail, .settings-row-control, .history-search')].filter(visible); return { overflow: els.map(el=>({name: el.className, left: el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).filter(r=>r.left < -1 || r.right > innerWidth+1), small: [...document.querySelectorAll('p,small,button,input,textarea,select,kbd')].filter(el=>visible(el) && (el.textContent.trim() || el.placeholder)).filter(el=>parseFloat(getComputedStyle(el).fontSize)<14).map(el=>({text:el.textContent.slice(0,30),size:getComputedStyle(el).fontSize})), family: getComputedStyle(document.querySelector('.app-shell')).fontFamily }; })()");
        assert.deepEqual(result.overflow, [], label + ' controls overflow at ' + viewport.width);
        assert.deepEqual(result.small, [], label + ' text smaller than 14px');
        assert.match(result.family, /Microsoft YaHei/);
      }
    }
    await cdp.command('Emulation.clearDeviceMetricsOverride');
    await cdp.evaluate('document.querySelector(\'button[aria-label="工作台首页"]\').click()');
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.assistant-view'))"), 'return to assistant');
    await clickByText(cdp, '.new-task-button', '新建对话');
    await waitFor(() => cdp.evaluate("document.querySelectorAll('.mode-card').length === 4"), 'final dashboard');
    console.log('Shell/settings passed: single footer settings entry; all 8 categories, search/empty state, 16/18px persistence/concurrent merge; Microsoft YaHei/minimum 14px; 7 views at 1464x901 and 1064x660 renderer viewports.');
  } catch (error) {
    console.error('Shell failure:', JSON.stringify(await cdp.evaluate("window.scodex.getBrowserState().then(browser=>({browser,address:document.querySelector('.browser-address input')?.value,error:document.querySelector('.browser-page-error')?.textContent,focus:document.activeElement?.tagName}))").catch(()=>null)));
    throw error;
  } finally {
    if (remoteSocket?.readyState === WebSocket.OPEN) remoteSocket.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
};
