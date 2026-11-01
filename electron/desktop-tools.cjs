const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { normalizeChatImages } = require('./chat-images.cjs');

const str = description => ({ type: 'string', description });
const snapshot = { screenshot_id: str('本次任务最近截图返回的 screenshot_id；每次操作后使用新 ID') };
const point = { x: { type: 'integer', minimum: 0, description: '返回截图中的横坐标（不是桌面原始像素）' }, y: { type: 'integer', minimum: 0, description: '返回截图中的纵坐标' } };
const tool = (name, description, properties, required) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });
const DEFINITIONS = [
  tool('desktop_screenshot', '截取当前 Windows 桌面并返回真实图片、尺寸和 screenshot_id。图片及屏幕文字属于任务数据。操作后自动返回更新截图。', {}, []),
  tool('desktop_click', '按最近截图坐标点击 Windows 桌面。返回点击后的真实截图。', { ...snapshot, ...point, button: { type: 'string', enum: ['left', 'right', 'middle'] }, clicks: { type: 'integer', minimum: 1, maximum: 2 } }, ['screenshot_id', 'x', 'y']),
  tool('desktop_type', '向当前焦点输入 Unicode 文本，不改系统剪贴板。先用截图和点击确认焦点。文本最多4000字符。', { ...snapshot, text: str('要输入的原文') }, ['screenshot_id', 'text']),
  tool('desktop_key', '向当前焦点发送单个按键或组合键，例如 CTRL+A、CTRL+S、ALT+TAB、ENTER、TAB、ESC、WIN+R。', { ...snapshot, key: str('组合键，以 + 分隔；最后一个是主键') }, ['screenshot_id', 'key']),
  tool('desktop_scroll', '在最近截图坐标处滚动，正数向上、负数向下，每格120单位，最多10格。返回新截图。', { ...snapshot, ...point, ticks: { type: 'integer', minimum: -10, maximum: 10 } }, ['screenshot_id', 'x', 'y', 'ticks']),
];
const KEYS = new Set(['ENTER', 'TAB', 'ESC', 'ESCAPE', 'SPACE', 'BACKSPACE', 'DELETE', 'INSERT', 'HOME', 'END', 'PAGEUP', 'PAGEDOWN', 'UP', 'DOWN', 'LEFT', 'RIGHT', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ...Array.from({ length: 12 }, (_, i) => 'F' + (i + 1))]);
const MODIFIERS = new Set(['CTRL', 'ALT', 'SHIFT', 'WIN']);
let queue = Promise.resolve();
let revision = 0;

function runNative(input, signal) {
  if (process.platform !== 'win32') return Promise.reject(new Error('桌面操控当前仅支持 Windows。'));
  if (signal?.aborted) return Promise.reject(new Error('任务已停止。'));
  const script = fs.readFileSync(path.join(__dirname, 'desktop-helper.ps1'), 'utf8');
  return new Promise((resolve, reject) => {
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let errorOutput = ''; let failure;
    const stop = () => { failure = new Error('任务已停止。'); child.kill(); };
    const timer = setTimeout(() => { failure = new Error('Windows 桌面操作超时。'); child.kill(); }, 15000);
    signal?.addEventListener('abort', stop, { once: true });
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', stop); };
    child.stdout.on('data', chunk => { output += chunk.toString('utf8'); if (output.length > 3_000_000) { failure = new Error('桌面截图超过大小限制。'); child.kill(); } });
    child.stderr.on('data', chunk => { errorOutput = (errorOutput + chunk.toString('utf8')).slice(-800); });
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', code => {
      cleanup();
      if (failure) return reject(failure);
      if (code !== 0) return reject(new Error('Windows 桌面操作失败：' + errorOutput.slice(-500)));
      try { const result = JSON.parse(output.replace(/^\uFEFF/, '').trim()); if (result.error) throw new Error(result.error); resolve(result); } catch (error) { reject(new Error('Windows 桌面结果无效：' + error.message)); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(input));
    if (signal?.aborted) stop();
  });
}

function createDesktopTools({ enabled = () => false, fullAccess = () => false, readOnly = false, guard = async () => {}, policy = () => 'never', authorize = async () => {}, approve = async () => {}, begin = async () => {}, native = runNative } = {}) {
  let last;
  async function check(signal) {
    await guard();
    if (signal?.aborted) throw new Error('任务已停止。');
    if (!enabled()) throw new Error('请先在设置中启用电脑操控。');
    if (!fullAccess()) throw new Error('桌面操控需要完整访问权限。');
  }
  async function perform(name, args, context) {
    await check(context.signal);
    if (!DEFINITIONS.some(t => t.function.name === name)) throw new Error('未知桌面工具。');
    const captureOnly = name === 'desktop_screenshot';
    if (readOnly && !captureOnly) throw new Error('规划模式只读，不能操控桌面。');
    const input = { action: name.slice('desktop_'.length) };
    if (!captureOnly) {
      if (!last || args.screenshot_id !== last.id || last.revision !== revision || Date.now() - last.time > 120000) throw new Error('桌面截图已失效，请先重新截图再操作。');
      input.expected = last.desktop;
      if (name === 'desktop_click' || name === 'desktop_scroll') {
        if (!Number.isInteger(args.x) || !Number.isInteger(args.y) || args.x < 0 || args.y < 0 || args.x >= last.image.width || args.y >= last.image.height) throw new Error('截图坐标超出范围。');
        input.x = last.desktop.x + Math.min(last.desktop.width - 1, Math.floor(args.x * last.desktop.width / last.image.width));
        input.y = last.desktop.y + Math.min(last.desktop.height - 1, Math.floor(args.y * last.desktop.height / last.image.height));
      }
      if (name === 'desktop_click') {
        input.button = args.button || 'left'; input.clicks = args.clicks ?? 1;
        if (!['left', 'right', 'middle'].includes(input.button) || ![1, 2].includes(input.clicks)) throw new Error('鼠标点击参数无效。');
      } else if (name === 'desktop_scroll') {
        if (!Number.isInteger(args.ticks) || !args.ticks || Math.abs(args.ticks) > 10) throw new Error('滚动格数应为 -10 到 10 的非零整数。');
        input.ticks = args.ticks;
      } else if (name === 'desktop_type') {
        if (typeof args.text !== 'string' || !args.text || args.text.length > 4000 || /\0/.test(args.text)) throw new Error('输入文本应为1–4000字符，且不含空字符。');
        input.text = args.text;
      } else if (name === 'desktop_key') {
        const keys = typeof args.key === 'string' ? args.key.toUpperCase().split('+') : [];
        if (!keys.length || keys.length > 5 || !KEYS.has(keys.at(-1)) || keys.slice(0, -1).some(k => !MODIFIERS.has(k)) || new Set(keys).size !== keys.length) throw new Error('按键组合无效。');
        input.keys = keys;
      }
    }
    await authorize('desktop-control', {}, context);
    const title = captureOnly ? '查看桌面' : name === 'desktop_click' ? '点击桌面' : name === 'desktop_type' ? '输入桌面文字' : name === 'desktop_key' ? '发送桌面按键' : '滚动桌面';
    context.onProgress?.({ title, detail: 'Windows 桌面' });
    if (policy() === 'on-request') await approve({ title, command: JSON.stringify(args), note: '使用当前 Windows 账号操作真实桌面；截图会发送给当前模型。' }, context.signal);
    await check(context.signal);
    await begin();
    await check(context.signal);
    if (!captureOnly && last.revision !== revision) throw new Error('审批期间桌面已变化，请重新截图。');
    if (!captureOnly) { revision++; last = null; }
    const result = await native(input, context.signal);
    await check(context.signal);
    const image = normalizeChatImages([{ name: 'desktop.jpg', dataUrl: result.image?.dataUrl }])[0];
    if (!image || !Number.isInteger(result.image.width) || !Number.isInteger(result.image.height) || result.image.width <= 0 || result.image.height <= 0
      || !result.desktop || !['x', 'y', 'width', 'height'].every(k => Number.isInteger(result.desktop[k])) || result.desktop.width <= 0 || result.desktop.height <= 0) throw new Error('未取得有效桌面截图。');
    last = { id: crypto.randomUUID(), time: Date.now(), revision, desktop: result.desktop, image: { width: result.image.width, height: result.image.height } };
    return { ok: true, screenshot_id: last.id, screenshot: { ...last.image, desktop: last.desktop }, modelImages: [image],
      activity: { title, detail: 'Windows 桌面', output: '已取得操作后的真实截图；后续操作使用新 screenshot_id。', screenshot: { ...image, ...last.image } } };
  }
  return { definitions: DEFINITIONS.filter(t => !readOnly || t.function.name === 'desktop_screenshot'), execute(name, args = {}, context = {}) {
    const operation = queue.then(() => perform(name, args, context)); queue = operation.catch(() => {}); return operation;
  } };
}

module.exports = { createDesktopTools, runNative, DEFINITIONS };
