import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';

const MAX_WIDGET_STATE_BYTES = 16 * 1024;
const MAX_FOLLOWUP_CHARS = 1200;

function safeWidgetState(value) {
  const pending = [{ value, depth: 0 }];
  const visited = new WeakSet();
  let visitedCount = 0, textLength = 0;
  while (pending.length) {
    const item = pending.pop(), current = item.value;
    if (++visitedCount > 512 || item.depth > 10) return undefined;
    if (current === null || typeof current === 'boolean') continue;
    if (typeof current === 'string') {
      if (current.length > 4096) return undefined;
      textLength += current.length;
    } else if (typeof current === 'number') {
      if (!Number.isFinite(current)) return undefined;
      textLength += 16;
    } else if (Array.isArray(current)) {
      if (current.length > 100 || visited.has(current)) return undefined;
      visited.add(current);
      for (const child of current) pending.push({ value: child, depth: item.depth + 1 });
    } else if (current && typeof current === 'object' && Object.getPrototypeOf(current) === Object.prototype) {
      if (visited.has(current)) return undefined;
      visited.add(current);
      const entries = Object.entries(current);
      if (entries.length > 100) return undefined;
      for (const [key, child] of entries) {
        if (key.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(key)) return undefined;
        textLength += key.length;
        pending.push({ value: child, depth: item.depth + 1 });
      }
    } else return undefined;
    if (textLength > MAX_WIDGET_STATE_BYTES) return undefined;
  }
  let serialized;
  try { serialized = JSON.stringify(value); } catch { return undefined; }
  if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).length > MAX_WIDGET_STATE_BYTES) return undefined;
  let normalized;
  try { normalized = JSON.parse(serialized); } catch { return undefined; }
  return normalized;
}

function normalizePrompt(value) {
  if (typeof value !== 'string') return '';
  const prompt = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return prompt.length <= MAX_FOLLOWUP_CHARS ? prompt : '';
}

function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function buildDocument(visualization) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const parsed = new DOMParser().parseFromString(visualization.html, 'text/html');
  parsed.querySelectorAll('base, embed, frame, iframe, link, meta[http-equiv], object, portal, script[src]').forEach((element) => element.remove());
  parsed.querySelectorAll('*').forEach((element) => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || ['action', 'formaction', 'ping', 'poster', 'srcset'].includes(name)) element.removeAttribute(attribute.name);
      else if (name === 'src' && !/^(?:data:image\/(?:png|jpeg|gif|webp);|blob:)/.test(value)) element.removeAttribute(attribute.name);
      else if (name === 'href' && !value.startsWith('#')) element.removeAttribute(attribute.name);
      else if (name === 'target') element.removeAttribute(attribute.name);
    }
  });
  parsed.querySelectorAll('script').forEach((element) => element.setAttribute('nonce', nonce));

  const safeHead = [...parsed.head.childNodes].filter((node) => node.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE'].includes(node.tagName))
    .map((node) => node.nodeType === Node.ELEMENT_NODE ? node.outerHTML : escapeHtml(node.textContent)).join('');
  const initialState = safeWidgetState(visualization.widgetState) ?? null;
  const bridge = `(()=>{let state=${scriptJson(initialState)};let timer;const id=${scriptJson(visualization.id)};const send=(type,value)=>parent.postMessage({channel:"scodex.visualization",id,type,value},"*");const bounded=value=>{const stack=[{value,depth:0}],seen=new WeakSet();let count=0,size=0;while(stack.length){const item=stack.pop(),v=item.value;if(++count>512||item.depth>10)return false;if(v===null||typeof v==="boolean")continue;if(typeof v==="string"){if(v.length>4096)return false;size+=v.length}else if(typeof v==="number"){if(!Number.isFinite(v))return false;size+=16}else if(Array.isArray(v)){if(v.length>100||seen.has(v))return false;seen.add(v);for(const x of v)stack.push({value:x,depth:item.depth+1})}else if(v&&typeof v==="object"&&Object.getPrototypeOf(v)===Object.prototype){if(seen.has(v))return false;seen.add(v);const entries=Object.entries(v);if(entries.length>100)return false;for(const [k,x] of entries){if(k.length>200||["__proto__","constructor","prototype"].includes(k))return false;size+=k.length;stack.push({value:x,depth:item.depth+1})}}else return false;if(size>${MAX_WIDGET_STATE_BYTES})return false}return true};const setWidgetState=value=>{try{if(!bounded(value))return false;const copy=JSON.parse(JSON.stringify(value));if(new TextEncoder().encode(JSON.stringify(copy)).length>${MAX_WIDGET_STATE_BYTES})return false;state=copy;clearTimeout(timer);timer=setTimeout(()=>send("state",state),200);return true}catch{return false}};const sendFollowUpMessage=text=>{if(typeof text!=="string"||text.length>${MAX_FOLLOWUP_CHARS})return false;send("followup",text);return true};const api={get widgetState(){return state},setWidgetState,sendFollowUpMessage};Object.defineProperty(window,"openai",{value:api,configurable:false});Object.defineProperty(window,"widgetState",{get(){return state},set:setWidgetState,configurable:false});Object.defineProperty(window,"setWidgetState",{value:setWidgetState,writable:false,configurable:false});Object.defineProperty(window,"sendFollowUpMessage",{value:sendFollowUpMessage,writable:false,configurable:false});document.addEventListener("DOMContentLoaded",()=>window.dispatchEvent(new CustomEvent("openai:set_globals",{detail:{globals:{widgetState:state,setWidgetState,sendFollowUpMessage}}})),{once:true})})()`;
  const policy = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  const title = document.createElement('span'); title.textContent = visualization.title || '交互图表';
  const ready = `(()=>{const ready=()=>parent.postMessage({channel:"scodex.visualization",id:${scriptJson(visualization.id)},type:"ready"},"*");document.addEventListener("DOMContentLoaded",ready,{once:true});window.addEventListener("message",event=>{if(event.source===parent&&event.data?.channel==="scodex.visualization"&&event.data?.id===${scriptJson(visualization.id)}&&event.data?.type==="ping")ready()})})()`;
  return { nonce, html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>${title.innerHTML}</title><script nonce="${nonce}">${bridge};${ready}</script>${safeHead}</head><body>${parsed.body.innerHTML}</body></html>` };
}

export function VisualizationFrame({ visualization, onStateChange, onFollowUp }) {
  const frameRef = useRef(null);
  const pendingState = useRef(null);
  const stateCallback = useRef(onStateChange);
  const timer = useRef(null);
  const loadTimer = useRef(null);
  const awaitingReady = useRef(false);
  const recoveries = useRef(0);
  const [pendingPrompt, setPendingPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const document = useMemo(() => buildDocument(visualization), [visualization.id, visualization.html, reloadKey]);

  useEffect(() => { stateCallback.current = onStateChange; }, [onStateChange]);

  useEffect(() => {
    let disposed = false, registered = '';
    const release = (url) => window.scodex.releaseVisualization(url).catch(() => {});
    setReady(false); setSource(''); setError(''); setPendingPrompt('');
    window.scodex.registerVisualization(document).then((url) => {
      registered = url;
      if (disposed) release(url); else setSource(url);
    }).catch((failure) => { if (!disposed) setError(failure?.message || '图表未能加载。'); });
    return () => { disposed = true; clearTimeout(loadTimer.current); if (registered) release(registered); };
  }, [document]);

  useEffect(() => {
    const receive = (event) => {
      if (event.source !== frameRef.current?.contentWindow || event.origin !== 'null') return;
      const data = event.data;
      if (!data || data.channel !== 'scodex.visualization' || data.id !== visualization.id) return;
      if (data.type === 'ready') { awaitingReady.current = false; clearTimeout(loadTimer.current); setReady(true); return; }
      if (data.type === 'state') {
        const state = safeWidgetState(data.value);
        if (state === undefined) return;
        pendingState.current = state;
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => stateCallback.current?.(visualization.id, pendingState.current), 250);
      } else if (data.type === 'followup') {
        const prompt = normalizePrompt(data.value);
        if (prompt) { setPendingPrompt(prompt); setError(''); }
      }
    };
    window.addEventListener('message', receive);
    return () => {
      window.removeEventListener('message', receive);
      clearTimeout(timer.current);
    };
  }, [visualization.id]);

  const verifyLoadedDocument = () => {
    awaitingReady.current = true; setReady(false);
    clearTimeout(loadTimer.current);
    frameRef.current?.contentWindow?.postMessage({ channel: 'scodex.visualization', id: visualization.id, type: 'ping' }, '*');
    loadTimer.current = window.setTimeout(() => {
      if (!awaitingReady.current) return;
      if (recoveries.current++ < 1) setReloadKey((value) => value + 1);
      else { setSource(''); setError('图表多次加载异常，已停止运行。重新打开聊天后可重试。'); }
    }, 600);
  };

  const sendFollowUp = async () => {
    if (!pendingPrompt || sending) return;
    setSending(true); setError('');
    try { await onFollowUp(pendingPrompt); setPendingPrompt(''); }
    catch (failure) { setError(failure?.message || '追问未能发送。'); }
    finally { setSending(false); }
  };

  return <section className="visualization-card" aria-label={'交互图表：' + visualization.title}>
    <div className="visualization-heading"><strong>{visualization.title || '交互图表'}</strong><span role="status">{error && !source ? '加载失败' : ready ? '已加载' : '正在加载'}</span></div>
    {source && <iframe ref={frameRef} className="visualization-frame" title={visualization.title || '交互图表'} sandbox="allow-scripts" src={source} loading="lazy" onLoad={verifyLoadedDocument} />}
    {pendingPrompt && <div className="visualization-followup" role="group" aria-label="确认发送图表追问">
      <div><strong>图表提出了追问</strong><p>{pendingPrompt}</p></div>
      <button type="button" className="icon-button small" title="取消追问" aria-label="取消图表追问" disabled={sending} onClick={() => setPendingPrompt('')}><X size={16} /></button>
      <button type="button" className="text-tool" disabled={sending} onClick={sendFollowUp}><Send size={15} />发送追问</button>
    </div>}
    {error && <p className="visualization-error" role="alert">{error}</p>}
  </section>;
}
