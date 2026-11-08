import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import './message-timeline.css';

export function MessageTimeline({ conversationId, messages, children }) {
  const scroll = useRef(null), content = useRef(null), following = useRef(true);
  const [atBottom, setAtBottom] = useState(true), [activeId, setActiveId] = useState('');
  const [preview, setPreview] = useState(null);
  const requests = messages.filter(message => message.role === 'user');
  const measure = useCallback(() => {
    const element = scroll.current;
    if (!element) return;
    const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
    following.current = bottom; setAtBottom(bottom);
    const top = element.getBoundingClientRect().top + 32;
    let current = '';
    for (const message of element.querySelectorAll('[data-message-id]')) {
      if (message.getBoundingClientRect().top > top && current) break;
      if (message.classList.contains('user-message')) current = message.dataset.messageId;
    }
    setActiveId(current);
  }, []);
  const latest = useCallback(() => {
    following.current = true;
    const element = scroll.current;
    if (element) element.scrollTop = element.scrollHeight;
    measure();
  }, [measure]);
  useLayoutEffect(() => { setPreview(null); latest(); }, [conversationId, latest]);
  useLayoutEffect(() => {
    if (following.current) latest();
    else measure();
  }, [messages, latest, measure]);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => { if (following.current) latest(); else measure(); });
    if (content.current) observer.observe(content.current);
    if (scroll.current) observer.observe(scroll.current);
    return () => observer.disconnect();
  }, [latest, measure]);
  const locate = id => {
    const element = scroll.current;
    const target = [...element.querySelectorAll('[data-message-id]')].find(item => item.dataset.messageId === id);
    if (!target) return;
    following.current = false;
    element.scrollTop += target.getBoundingClientRect().top - element.getBoundingClientRect().top - 20;
    measure(); setActiveId(id);
  };
  const showPreview = (event, id) => {
    const button = event.currentTarget, rail = button.closest('nav').getBoundingClientRect();
    const bounds = scroll.current.parentElement.getBoundingClientRect();
    const top = Math.max(bounds.top - rail.top + 8, Math.min(button.getBoundingClientRect().top - rail.top - 8, bounds.bottom - rail.top - 200));
    setPreview({ id, top });
  };
  const previewIndex = preview ? requests.findIndex(message => message.id === preview.id) : -1;
  const previewMessage = requests[previewIndex];
  return <div className={'message-timeline' + (requests.length ? ' has-requests' : '')}>
    <div className="conversation-scroll" ref={scroll} onScroll={measure} tabIndex={0} aria-label="聊天消息"><div className="timeline-content" ref={content}>{children}</div></div>
    {requests.length > 0 && <nav className="request-timeline" aria-label="历史需求记录" onMouseLeave={() => setPreview(null)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPreview(null); }} onKeyDown={event => { if (event.key === 'Escape' && preview) { event.preventDefault(); event.stopPropagation(); setPreview(null); } }}>
      <div className="request-ticks">{requests.map((message, index) => {
      const summary = (message.content?.trim() || message.attachments?.[0]?.name || message.images?.[0]?.name || '附件需求').replace(/\s+/g, ' ').slice(0, 100);
      return <button key={message.id} type="button" aria-label={'需求 ' + (index + 1) + '：' + summary} aria-current={activeId === message.id ? 'step' : undefined} aria-describedby={preview?.id === message.id ? 'request-preview-' + conversationId : undefined} onMouseEnter={event => showPreview(event, message.id)} onFocus={event => showPreview(event, message.id)} onClick={event => { locate(message.id); showPreview(event, message.id); }}><span className="request-tick" /></button>;
    })}</div>
      {previewMessage && <div className="request-preview" id={'request-preview-' + conversationId} role="tooltip" style={{ top: preview.top }}><strong>需求 {previewIndex + 1}</strong><div>{previewMessage.content?.trim() || previewMessage.attachments?.map(item => item.name).join('、') || previewMessage.images?.map(item => item.name).join('、') || '附件需求'}</div></div>}
    </nav>}
    {!atBottom && messages.length > 0 && <button type="button" className="jump-to-latest" aria-label="回到最新消息" title="回到最新消息" onClick={latest}><ArrowDown size={20} /></button>}
  </div>;
}
