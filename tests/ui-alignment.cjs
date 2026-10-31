const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');

const executeFile = promisify(execFile);
const project = path.resolve(__dirname, '..');
const output = path.resolve(project, process.env.SCODEX_UI_ALIGNMENT_OUTPUT || 'release/ui-alignment-20261031');
const referenceExecutable = path.join(project, 'release/chat-reference-final-ui-20261024/win-unpacked/Scodex工作台.exe');
const candidateExecutable = path.join(output, 'candidate/Scodex-Workbench-1.3.21-x64.exe');
const viewport = { width: 1280, height: 819, deviceScaleFactor: 1, mobile: false };
const report = {
  date: new Date().toISOString(),
  viewport,
  weights: { geometry: 30, navigation: 25, typography: 15, appearance: 15, interaction: 15 },
  status: 'running',
  variants: {},
  limitations: [
    'This is a deterministic visual/layout comparison at 1280x819 using the same seeded chat fixture.',
    'The reference executable is the archived 1.0.4 UI build; functional behavior and model services are not scored here.'
  ]
};

const json = value => JSON.stringify(value);

async function waitFor(fn, label, duration = 60000) {
  const end = Date.now() + duration;
  let last;
  while (Date.now() < end) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(label + (last ? ': ' + last.message : ''));
}

function connect(socket) {
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error('CDP timeout ' + method));
    }, 20000);
    pending.set(requestId, { resolve, reject, timer });
    socket.send(json({ id: requestId, method, params }));
  });
  return {
    command,
    async evaluate(expression) {
      const result = await command('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime evaluation failed');
      }
      return result.result?.value;
    }
  };
}

async function sha256(file) {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex').toUpperCase();
}

async function seedFixture(root, profile, workspace) {
  await fs.mkdir(profile, { recursive: true });
  await fs.mkdir(workspace, { recursive: true });
  await fs.mkdir(root, { recursive: true });
  const now = new Date().toISOString();
  const conversation = {
    id: 'ui-alignment-chat',
    title: '界面对标',
    createdAt: now,
    updatedAt: now,
    reasoningEffort: 'max',
    messages: [
      { id: 'ui-user', role: 'user', content: '请显示界面对标页面。' },
      { id: 'ui-assistant', role: 'assistant', content: '这是用于界面测量的受控中文消息。' }
    ]
  };
  await fs.writeFile(path.join(profile, 'settings.json'), json({
    workspaceRoot: workspace,
    preferences: {
      browserPanelOpen: false,
      browserPanelExpanded: false,
      railCollapsed: false,
      themeMode: 'light',
      fontSize: 16,
      notifyOnComplete: false,
      notifyOnIssues: false,
      notifyOnPermissions: false
    }
  }), 'utf8');
  await fs.writeFile(path.join(profile, 'conversations.json'), json({
    version: 2,
    activeId: conversation.id,
    conversations: [conversation]
  }), 'utf8');
}

async function launch(executable, label) {
  const temp = path.join(os.tmpdir(), 'scodex-ui-alignment-' + label + '-' + crypto.randomUUID());
  const profile = path.join(temp, 'profile');
  const fakeRoot = path.join(temp, 'root');
  const workspace = path.join(temp, 'workspace');
  await seedFixture(fakeRoot, profile, workspace);
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(executable, [
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    '--disable-gpu'
  ], {
    cwd: project,
    env: { ...process.env, SCODEX_HOME: fakeRoot },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.resume();
  let diagnostic = '';
  child.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-8000); });
  const target = await waitFor(async () => {
    if (child.exitCode !== null) throw new Error(diagnostic || 'process exited ' + child.exitCode);
    const response = await fetch('http://127.0.0.1:' + port + '/json/list');
    return (await response.json()).find(item => item.type === 'page');
  }, label + ' CDP page');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const cdp = connect(socket);
  await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".assistant-view, .task-chat-view"))'), label + ' chat renderer');
  await cdp.command('Emulation.setDeviceMetricsOverride', viewport);
  await waitFor(() => cdp.evaluate('innerWidth===1280 && innerHeight===819'), label + ' fixed viewport');
  await new Promise(resolve => setTimeout(resolve, 350));
  return { temp, profile, fakeRoot, workspace, child, socket, cdp, executable, label, diagnostic: () => diagnostic };
}

async function close(app) {
  if (!app) return;
  await app.cdp?.command('Browser.close').catch(() => {});
  await waitFor(() => app.child.exitCode !== null, app.label + ' clean exit', 10000).catch(async () => {
    await executeFile('taskkill.exe', ['/PID', String(app.child.pid), '/T', '/F'], { windowsHide: true }).catch(() => {});
  });
  app.socket?.close();
  await fs.rm(app.temp, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}

async function snapshot(app, state) {
  return app.cdp.evaluate(`(() => {
    const state = ${json(state)};
    const selectors = {
      rail: '.rail',
      activityRail: '.activity-rail',
      topbar: '.topbar',
      mainPanel: '.main-panel',
      assistant: '.assistant-view, .task-chat-view',
      conversation: '.conversation-scroll',
      composerArea: '.composer-area',
      composerBox: '.composer-box',
      brand: '.brand-row',
      primaryNav: '.primary-nav',
      workbenchNav: '.workbench-primary-nav',
      projectHeading: '.project-section-heading',
      recentHeading: '.recent-section-heading',
      workspace: '.workspace-switch',
      newTask: '.new-task-button'
    };
    const visible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const box = selector => {
      const element = [...document.querySelectorAll(selector)].find(visible);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        right: rect.right, bottom: rect.bottom,
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
        borderRadius: style.borderRadius,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontWeight: style.fontWeight
      };
    };
    const text = selector => [...document.querySelectorAll(selector)].filter(visible).map(element => element.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean);
    const styles = selector => {
      const element = [...document.querySelectorAll(selector)].find(visible);
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontWeight: style.fontWeight,
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        borderRadius: style.borderRadius
      };
    };
    const labels = [
      ...text('.rail .nav-item'),
      ...text('.rail .rail-section-head'),
      ...text('.rail .project-archive-toggle'),
      ...text('.rail .rail-empty'),
      ...text('.rail .recent-item'),
      ...text('.rail .rail-command-search'),
      ...text('.rail .workbench-primary-nav .nav-item')
    ];
    const appShell = document.querySelector('.app-shell');
    const collapse = document.querySelector('[aria-label="收起侧栏"], [aria-label="展开侧栏"]');
    const rail = [...document.querySelectorAll('.rail')].find(visible);
    return {
      state,
      url: location.href,
      title: document.title,
      bodyText: document.body.innerText.slice(0, 2500),
      className: appShell?.className || '',
      boxes: Object.fromEntries(Object.entries(selectors).map(([key, selector]) => [key, box(selector)])),
      styles: {
        body: styles('body'),
        rail: styles('.rail'),
        topbar: styles('.topbar'),
        nav: styles('.rail .nav-item'),
        composer: styles('.composer-box'),
        heading: styles('.rail .rail-section-head')
      },
      labels,
      counts: {
        visibleNavItems: text('.rail .nav-item').length,
        visibleRecentItems: text('.rail .recent-item').length,
        visibleIcons: [...document.querySelectorAll('.rail svg')].filter(element => visible(element)).length
      },
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      innerHeight,
      railWidth: rail?.getBoundingClientRect().width || 0,
      collapseLabel: collapse?.getAttribute('aria-label') || null,
      collapsed: Boolean(appShell?.classList.contains('rail-collapsed'))
    };
  })()`);
}

async function capture(app, name) {
  const image = await app.cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(output, 'measurements', name + '.png');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(image.data, 'base64'));
  return file;
}

async function setCollapsed(app, collapsed) {
  const current = await app.cdp.evaluate('document.querySelector(".app-shell")?.classList.contains("rail-collapsed")');
  if (current === collapsed) return;
  const selector = collapsed ? '[aria-label="收起侧栏"]' : '[aria-label="展开侧栏"]';
  const clicked = await app.cdp.evaluate(`(() => { const button = document.querySelector(${json(selector)}); if (!button) return false; button.click(); return true; })()`);
  if (!clicked) throw new Error(app.label + ' missing collapse control for ' + (collapsed ? 'collapse' : 'expand'));
  await waitFor(() => app.cdp.evaluate(`document.querySelector(".app-shell")?.classList.contains("rail-collapsed") === ${collapsed}`), app.label + ' sidebar ' + (collapsed ? 'collapse' : 'expand'));
  await new Promise(resolve => setTimeout(resolve, 200));
}

async function collect(app) {
  const states = {};
  await setCollapsed(app, false);
  states.expanded = await snapshot(app, 'expanded');
  states.expanded.screenshot = await capture(app, app.label + '-expanded');
  await setCollapsed(app, true);
  states.collapsed = await snapshot(app, 'collapsed');
  states.collapsed.screenshot = await capture(app, app.label + '-collapsed');
  await setCollapsed(app, false);
  return states;
}

function number(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreBox(reference, candidate, viewportSize) {
  if (!reference || !candidate) return reference === candidate ? null : 0;
  const dimensions = ['x', 'y', 'width', 'height'];
  const error = dimensions.reduce((sum, key) => {
    const scale = key === 'x' || key === 'width' ? viewportSize.width : viewportSize.height;
    return sum + Math.min(1, Math.abs(reference[key] - candidate[key]) / scale);
  }, 0) / dimensions.length;
  return Math.max(0, 1 - error);
}

function scoreStyles(reference, candidate) {
  if (!reference || !candidate) return reference === candidate ? null : 0;
  const fontSize = Math.min(1, Math.abs(number(reference.fontSize) - number(candidate.fontSize)) / 8);
  const lineHeight = Math.min(1, Math.abs(number(reference.lineHeight) - number(candidate.lineHeight)) / 12);
  const family = reference.fontFamily === candidate.fontFamily ? 1 : 0;
  const weight = reference.fontWeight === candidate.fontWeight ? 1 : Math.max(0, 1 - Math.abs(number(reference.fontWeight) - number(candidate.fontWeight)) / 400);
  return (family + weight + (1 - fontSize) + (1 - lineHeight)) / 4;
}

function scoreAppearance(reference, candidate) {
  if (!reference || !candidate) return reference === candidate ? null : 0;
  const same = key => reference[key] === candidate[key] ? 1 : 0;
  const radius = Math.min(1, Math.abs(number(reference.borderRadius) - number(candidate.borderRadius)) / 12);
  return (same('color') + same('backgroundColor') + same('borderColor') + (1 - radius)) / 4;
}

function tokenSet(labels) {
  return new Set(labels.map(label => label.replace(/[0-9]+/g, '').trim()).filter(Boolean));
}

function scoreNavigation(reference, candidate) {
  const a = tokenSet(reference.labels);
  const b = tokenSet(candidate.labels);
  const intersection = [...a].filter(value => b.has(value)).length;
  const union = new Set([...a, ...b]).size;
  const jaccard = union ? intersection / union : 1;
  const countSimilarity = Math.max(0, 1 - Math.abs(reference.labels.length - candidate.labels.length) / Math.max(1, reference.labels.length, candidate.labels.length));
  const navCountSimilarity = Math.max(0, 1 - Math.abs(reference.counts.visibleNavItems - candidate.counts.visibleNavItems) / Math.max(1, reference.counts.visibleNavItems, candidate.counts.visibleNavItems));
  return 0.55 * jaccard + 0.3 * countSimilarity + 0.15 * navCountSimilarity;
}

function scoreInteraction(reference, candidate) {
  const railDeltaReference = reference.expanded.railWidth - reference.collapsed.railWidth;
  const railDeltaCandidate = candidate.expanded.railWidth - candidate.collapsed.railWidth;
  const deltaScore = Math.max(0, 1 - Math.abs(railDeltaReference - railDeltaCandidate) / Math.max(1, reference.expanded.railWidth));
  const expandedWidthScore = Math.max(0, 1 - Math.abs(reference.expanded.railWidth - candidate.expanded.railWidth) / 1280);
  const collapsedWidthScore = Math.max(0, 1 - Math.abs(reference.collapsed.railWidth - candidate.collapsed.railWidth) / 1280);
  const expectedVisibility = state => state.collapsed ? candidate.collapsed.labels.length <= candidate.expanded.labels.length : candidate.expanded.labels.length >= candidate.collapsed.labels.length;
  const visibilityScore = expectedVisibility(true) && expectedVisibility(false) ? 1 : 0;
  return (deltaScore + expandedWidthScore + collapsedWidthScore + visibilityScore) / 4;
}

function compare(reference, candidate) {
  const geometryKeys = ['rail', 'topbar', 'mainPanel', 'assistant', 'conversation', 'composerArea', 'composerBox', 'brand', 'projectHeading', 'recentHeading', 'workspace'];
  const geometryValues = [];
  for (const state of ['expanded', 'collapsed']) {
    for (const key of geometryKeys) {
      const value = scoreBox(reference[state].boxes[key], candidate[state].boxes[key], viewport);
      if (value !== null) geometryValues.push(value);
    }
  }
  const geometry = geometryValues.length ? geometryValues.reduce((sum, value) => sum + value, 0) / geometryValues.length : 0;
  const navigation = (scoreNavigation(reference.expanded, candidate.expanded) + scoreNavigation(reference.collapsed, candidate.collapsed)) / 2;
  const typographyValues = [];
  for (const state of ['expanded', 'collapsed']) {
    for (const key of ['body', 'rail', 'topbar', 'nav', 'composer', 'heading']) {
      const value = scoreStyles(reference[state].styles[key], candidate[state].styles[key]);
      if (value !== null) typographyValues.push(value);
    }
  }
  const typography = typographyValues.length ? typographyValues.reduce((sum, value) => sum + value, 0) / typographyValues.length : 0;
  const appearanceValues = [];
  for (const state of ['expanded', 'collapsed']) {
    for (const key of ['rail', 'topbar', 'nav', 'composer', 'heading']) {
      const value = scoreAppearance(reference[state].styles[key], candidate[state].styles[key]);
      if (value !== null) appearanceValues.push(value);
    }
  }
  const appearance = appearanceValues.length ? appearanceValues.reduce((sum, value) => sum + value, 0) / appearanceValues.length : 0;
  const interaction = scoreInteraction(reference, candidate);
  const weighted = geometry * 30 + navigation * 25 + typography * 15 + appearance * 15 + interaction * 15;
  return {
    geometry: Number((geometry * 100).toFixed(2)),
    navigation: Number((navigation * 100).toFixed(2)),
    typography: Number((typography * 100).toFixed(2)),
    appearance: Number((appearance * 100).toFixed(2)),
    interaction: Number((interaction * 100).toFixed(2)),
    total: Number(weighted.toFixed(2)),
    evidence: { geometryLandmarks: geometryValues.length, typographySamples: typographyValues.length, appearanceSamples: appearanceValues.length }
  };
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const [referenceHash, candidateHash] = await Promise.all([sha256(referenceExecutable), sha256(candidateExecutable)]);
  report.reference = { executable: referenceExecutable, sha256: referenceHash };
  report.candidate = { executable: candidateExecutable, sha256: candidateHash };
  let reference;
  let candidate;
  try {
    reference = await launch(referenceExecutable, 'reference');
    report.variants.reference = await collect(reference);
    await close(reference);
    reference = null;
    candidate = await launch(candidateExecutable, 'candidate');
    report.variants.candidate = await collect(candidate);
    await close(candidate);
    candidate = null;
    report.scores = compare(report.variants.reference, report.variants.candidate);
    report.status = 'passed';
    report.completedAt = new Date().toISOString();
    console.log('UI similarity: ' + report.scores.total + '%');
  } catch (error) {
    report.status = 'failed';
    report.error = error.stack || String(error);
    if (reference?.diagnostic) report.referenceDiagnostic = reference.diagnostic();
    if (candidate?.diagnostic) report.candidateDiagnostic = candidate.diagnostic();
    process.exitCode = 1;
  } finally {
    await close(candidate);
    await close(reference);
    await fs.writeFile(path.join(output, 'ui-alignment-measurement.json'), JSON.stringify(report, null, 2), 'utf8');
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
