import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ModelConnectionPanel } from './model-connection-panel.jsx';

export function ModelConnectionDialog({ connection, onSaved, busy, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className="model-connection-dialog" aria-labelledby="workspace-model-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><div><h2 id="workspace-model-title">模型与连接</h2><p>直接编辑模型一、模型二和模型三的完整配置。</p></div><button type="button" className="icon-button" aria-label="关闭模型与连接" onClick={onClose}><X size={20} /></button></header>
    <div className="model-dialog-body"><ModelConnectionPanel connection={connection} onSaved={onSaved} busy={busy} /></div>
  </dialog>;
}
