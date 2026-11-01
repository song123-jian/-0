import React, { useEffect, useRef, useState } from 'react';
import './document-preview.css';

export function DocumentPreview({ document, onClose, onSaved }) {
  const dialog = useRef(null);
  const [current, setCurrent] = useState(document);
  const [spec, setSpec] = useState(document.spec);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); }, []);
  const run = async (pdf) => {
    setBusy(true); setError('');
    try {
      if (pdf) {
        const destination = await window.scodex.chooseSaveFile(current.title + '.pdf', [{ name: 'PDF', extensions: ['pdf'] }]);
        if (destination) await window.scodex.exportOfficePdf(current.path, current.hash, destination, spec);
      } else {
        const saved = await window.scodex.saveOffice(current.path, current.hash, spec);
        setCurrent(saved); setSpec(saved.spec); onSaved?.(saved.path);
      }
    } catch (caught) { setError(String(caught.message || caught)); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="document-preview-dialog" onCancel={event => { if (busy) event.preventDefault(); }} onClose={onClose} aria-labelledby="document-preview-title">
    <header><h2 id="document-preview-title">{current.title} · 内容预览</h2><button type="button" aria-label="关闭文档预览" disabled={busy} onClick={() => dialog.current.close()}>关闭</button></header>
    <p>内容预览与 PDF 导出采用工作台排版。Office 原始版式请在 Word 或 PowerPoint 中检查。</p>
    <div className="document-preview-body">
      {current.editable && <div className="document-content-editor"><label>文档标题<input aria-label="文档标题" value={spec.title} disabled={busy} onChange={e => setSpec({ ...spec, title: e.target.value })} /></label>{spec.sections.map((section, index) => <section key={index}><label>章节 {index + 1}<input aria-label={'章节标题 ' + (index + 1)} value={section.heading} disabled={busy} onChange={e => setSpec({ ...spec, sections: spec.sections.map((item, i) => i === index ? { ...item, heading: e.target.value } : item) })} /></label><textarea aria-label={'章节正文 ' + (index + 1)} rows={5} value={section.paragraphs.join('\n\n')} disabled={busy} onChange={e => setSpec({ ...spec, sections: spec.sections.map((item, i) => i === index ? { ...item, paragraphs: e.target.value.split(/\n\n/) } : item) })} />{section.table?.length > 0 && <small>表格内容保留；可在对话中要求修改表格。</small>}</section>)}</div>}
      <iframe title="办公文档内容预览" sandbox="" srcDoc={current.html} />
    </div>
    {error && <p role="alert">{error}</p>}
    <footer><span>{current.editable ? '保存后刷新预览；版本变化时拒绝覆盖。' : '外部文档仅提取正文预览。'}</span><button type="button" disabled={busy} onClick={() => run(true)}>导出内容 PDF</button>{current.editable && <button type="button" disabled={busy} onClick={() => run(false)}>保存文档</button>}</footer>
  </dialog>;
}
