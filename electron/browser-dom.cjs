// Fixed isolated-world DOM operations. No model supplied code or selectors are evaluated.
const WORLD_ID = 1073;
function browserDom(operation, args) {
  const clip = (value, limit = 300) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
  const visible = (element, viewport = false) => {
    if (!element?.isConnected || element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    const style = getComputedStyle(element); const box = element.getBoundingClientRect();
    if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0 || box.width < 1 || box.height < 1) return false;
    return !viewport || box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
  };
  const sensitive = (element) => {
    if (!element) return true;
    if (element.tagName === 'LABEL' && element.control) return sensitive(element.control);
    const type = String(element.type || '').toLowerCase();
    const autocomplete = String(element.getAttribute('autocomplete') || '').toLowerCase();
    const name = [element.id, element.getAttribute('name'), element.getAttribute('aria-label')].join(' ');
    return ['password', 'file', 'hidden'].includes(type) || /password|one-time-code|cc-/.test(autocomplete) ||
      /password|passwd|secret|token|api[-_ ]?key|密码|密钥|验证码|信用卡/i.test(name);
  };
  const safeHref = (element) => {
    try { const url = new URL(element.href || '', location.href); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href.slice(0, 2048) : ''; } catch { return ''; }
  };
  const nameOf = (element) => {
    const labelled = (element.getAttribute('aria-labelledby') || '').split(/\s+/).slice(0, 5).map((id) => document.getElementById(id)?.innerText || '').join(' ');
    return clip(element.getAttribute('aria-label') || labelled || [...(element.labels || [])].map((v) => v.innerText).join(' ') || element.getAttribute('placeholder') || element.getAttribute('alt') ||
      (element.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(element.type) ? element.value : element.innerText) || element.getAttribute('title'));
  };
  const describe = (element) => {
    const box = element.getBoundingClientRect();
    return { tag: element.tagName.toLowerCase(), role: element.getAttribute('role') || '', type: element.type || '',
      name: nameOf(element), href: element.tagName === 'A' ? safeHref(element) : '',
      disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'), readOnly: Boolean(element.readOnly),
      bounds: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) } };
  };
  const fingerprint = (element) => JSON.stringify({ ...describe(element), id: element.id, form: element.form?.action || '', target: element.getAttribute('target') || '', text: clip(element.innerText, 500), value: sensitive(element) ? '' : clip(element.value, 1000), scrollX, scrollY, width: innerWidth, height: innerHeight });
  if (operation === 'snapshot') {
    const state = { id: args.snapshotId, url: location.href, refs: new Map() };
    const elements = []; const candidates = document.querySelectorAll('a[href],button,input,textarea,select,summary,[role="button"],[role="link"],[role="textbox"],[contenteditable="true"],[tabindex]');
    let blocked = 0; let index = 0;
    for (const element of candidates) {
      if (!visible(element, true)) continue;
      if (sensitive(element)) { blocked += 1; continue; }
      if (elements.length >= 120) break;
      const ref = 'e' + (++index); const data = describe(element);
      state.refs.set(ref, { element, fingerprint: fingerprint(element) });
      elements.push({ ref, ...data, ...(element.value !== undefined && !['button','submit','reset'].includes(element.type) ? { value: clip(element.value, 1000) } : {}) });
    }
    globalThis.__scodexBrowserSnapshot = state;
    return { snapshot_id: state.id, url: location.href, title: document.title.slice(0, 200),
      text: String(document.body?.innerText || '').slice(0, 20000), elements, blocked_fields: blocked,
      viewport: { width: innerWidth, height: innerHeight, scroll_x: scrollX, scroll_y: scrollY, page_height: document.documentElement.scrollHeight },
      limitations: '仅顶层文档；元素引用限当前视口，最多 120 项；不读取密码、隐藏字段或跨域框架。先滚动再读取可获得新引用。' };
  }
  if (operation === 'scroll') {
    const before = { x: scrollX, y: scrollY }; scrollBy({ top: args.y, left: args.x, behavior: 'instant' });
    globalThis.__scodexBrowserSnapshot = null;
    return { before, after: { x: scrollX, y: scrollY } };
  }
  const state = globalThis.__scodexBrowserSnapshot;
  if (!state || state.id !== args.snapshotId || state.url !== location.href) throw new Error('页面快照已失效，请重新读取后再操作。');
  const entry = state.refs.get(args.ref);
  if (!entry || !visible(entry.element, true) || sensitive(entry.element) || fingerprint(entry.element) !== entry.fingerprint) throw new Error('目标元素已变化、离开视口或不可访问，请重新读取。');
  const element = entry.element; const info = describe(element);
  if (info.disabled || operation === 'fill' && info.readOnly) throw new Error('目标元素当前不能操作。');
  if (operation === 'inspect') return { ...info, fingerprint: entry.fingerprint };
  if (args.fingerprint !== entry.fingerprint) throw new Error('审批目标与当前元素不一致，请重新读取。');
  if (operation === 'click') HTMLElement.prototype.click.call(element);
  else if (operation === 'fill') {
    if (element instanceof HTMLInputElement && !['text','search','email','url','tel','number','date','datetime-local','month','week','time'].includes(element.type)) throw new Error('此字段类型不支持填入。');
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, args.text);
    } else if (element.isContentEditable) element.textContent = args.text;
    else throw new Error('目标不是可编辑文本字段。');
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: args.text }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (operation === 'focus') element.focus({ preventScroll: true });
  else throw new Error('不支持此页面操作。');
  globalThis.__scodexBrowserSnapshot = null;
  return { target: info, dispatched: true };
}
function domScript(operation, args) {
  if (!['snapshot', 'inspect', 'click', 'fill', 'focus', 'scroll'].includes(operation)) throw new Error('未知的浏览器 DOM 操作。');
  return '(() => { try { return (' + browserDom.toString() + ')(' + JSON.stringify(operation) + ',' + JSON.stringify(args) + '); } catch (error) { return { __scodexBrowserError: String(error?.message || error).slice(0, 500) }; } })()';
}
module.exports = { WORLD_ID, domScript };
