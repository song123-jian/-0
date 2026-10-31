// Verify the resolved installed shortcut target with the actual portable EXE.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'release/spreadsheet-runtime-20261025');
async function main() {
  const shortcut = JSON.parse(await fs.readFile(path.join(output, 'shortcut-verification.json'), 'utf8'));
  const ui = JSON.parse(await fs.readFile(path.join(output, 'spreadsheet-ui-verification.json'), 'utf8'));
  const executable = shortcut.after.target, temporary = ui.fixtureDirectory, profile = path.join(temporary, 'profile');
  assert.ok(path.basename(temporary).startsWith('scodex-sheet-ui-')); assert.equal(ui.status, 'passed');
  const hash = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex'); assert.equal(hash, ui.sha256);
  const port = await freePort(), child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { windowsHide: true, cwd: shortcut.after.workingDirectory, stdio: 'ignore', env: { ...process.env, SCODEX_HOME: path.join(temporary, 'scodex'), SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
  let cdp, socket;
  const report = { status: 'running', executable, sha256: hash, version: '1.3.2', checks: [], limitations: ['Only isolated settings are loaded. Production data and model connection remain unchanged.'] };
  try {
    const target = await wait(async () => (await fetch('http://127.0.0.1:' + port + '/json/list').then((r) => r.json())).find((t) => t.type === 'page' && t.url.startsWith('file:')), 'Final shortcut startup', 60000);
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => socket.addEventListener('open', r, { once: true })); cdp = connect(socket);
    await wait(() => cdp.evaluate('!!document.querySelector("[aria-label=输入工作内容]")'), 'Final renderer ready');
    const state = await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspace:s.workspaceRoot,library:s.library}))'); assert.equal(state.version, '1.3.2');
    const workflow = state.library.conversations.find((c) => c.id === ui.workflowId); assert.equal(workflow.messages.at(-1).operations.length, 3);
    assert.equal(workflow.messages.at(-1).operations.filter((o) => o.name === 'spreadsheet_edit' && o.status === 'succeeded').length, 1);
    assert.equal(await cdp.evaluate('!!document.querySelector(".agent-approval")'), false);
    // The workflow was the saved active conversation at final acceptance.
    await wait(() => cdp.evaluate('document.querySelector(".assistant-message-content")?.innerText.includes("实际工作簿")'), 'Saved workbook answer');
    await cdp.evaluate('document.querySelector(".agent-operation>summary").click()');
    await cdp.evaluate('[...document.querySelectorAll(".agent-operation button")].find(e=>e.textContent.includes("在表格中查看")).click()');
    await wait(() => cdp.evaluate('document.querySelector(".spreadsheet [aria-label=B2]")?.value==="15"'), 'Installed entry table action');
    report.checks.push({ version: state.version, savedOperations: 3, savedTableValue: 15, noLiveApproval: true });
    report.status = 'passed';
  } catch (e) { report.status = 'failed'; report.error = e.stack; process.exitCode = 1; }
  finally {
    if (cdp) {
      await cdp.evaluate('window.scodex.quitApp()');
      await wait(async () => { try { await fetch('http://127.0.0.1:' + port + '/json/list'); return false; } catch { return true; } }, 'Final actual main exit', 25000);
    }
    await wait(() => Promise.resolve(child.exitCode !== null), 'Final launcher exit', 15000); assert.equal(child.exitCode, 0); socket?.close();
    report.exited = true; report.exitCode = child.exitCode; await fs.writeFile(path.join(output, 'post-replacement-verification.json'), JSON.stringify(report, null, 2)); console.log('RESULT ' + report.status);
  }
}
main().catch((e) => { console.error(e.stack); process.exitCode = 1; });
