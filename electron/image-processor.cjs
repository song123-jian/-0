// Fixed offline Canvas program. No model JavaScript or remote page is executed.
function imageProgram(request) {
  return (async () => {
    const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const source = new Image();
    await new Promise((resolve, reject) => { source.onload = resolve; source.onerror = () => reject(Error('无法解码图片。')); source.src = request.dataUrl; });
    const validSize = (w, h) => Number.isSafeInteger(w) && Number.isSafeInteger(h) && w > 0 && h > 0 && w <= 10000 && h <= 10000 && w * h <= 20000000;
    if (!validSize(source.naturalWidth, source.naturalHeight)) throw Error('图片超出尺寸限制。');
    let canvas = make(source.naturalWidth, source.naturalHeight);
    canvas.getContext('2d').drawImage(source, 0, 0);
    for (const op of request.operations) {
      let next, ctx;
      if (op.type === 'crop') {
        if (op.x + op.width > canvas.width || op.y + op.height > canvas.height) throw Error('裁剪区域超出当前图片。');
        next = make(op.width, op.height); next.getContext('2d').drawImage(canvas, op.x, op.y, op.width, op.height, 0, 0, op.width, op.height);
      } else if (op.type === 'resize') {
        next = make(op.width, op.height); ctx = next.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(canvas, 0, 0, next.width, next.height);
      } else if (op.type === 'rotate') {
        const swap = op.degrees !== 180; next = make(swap ? canvas.height : canvas.width, swap ? canvas.width : canvas.height);
        ctx = next.getContext('2d'); ctx.translate(next.width / 2, next.height / 2); ctx.rotate(op.degrees * Math.PI / 180); ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      } else if (op.type === 'flip') {
        next = make(canvas.width, canvas.height); ctx = next.getContext('2d'); ctx.translate(op.axis === 'horizontal' ? next.width : 0, op.axis === 'vertical' ? next.height : 0); ctx.scale(op.axis === 'horizontal' ? -1 : 1, op.axis === 'vertical' ? -1 : 1); ctx.drawImage(canvas, 0, 0);
      } else if (op.type === 'brightness') {
        next = make(canvas.width, canvas.height); ctx = next.getContext('2d'); ctx.filter = 'brightness(' + op.percent + '%)'; ctx.drawImage(canvas, 0, 0);
      } else if (op.type === 'text') {
        if (op.x >= canvas.width || op.y >= canvas.height) throw Error('文字位置超出图片。');
        next = make(canvas.width, canvas.height); ctx = next.getContext('2d'); ctx.drawImage(canvas, 0, 0);
        ctx.font = (op.bold ? '600 ' : '') + op.font_size + 'px "Microsoft YaHei", sans-serif';
        ctx.textBaseline = 'top'; ctx.fillStyle = op.color; ctx.lineWidth = Math.max(1, op.font_size / 12);
        if (op.outline) { ctx.strokeStyle = op.outline; ctx.strokeText(op.text, op.x, op.y, Math.max(1, canvas.width - op.x)); }
        ctx.fillText(op.text, op.x, op.y, Math.max(1, canvas.width - op.x));
      }
      canvas.width = 0; canvas.height = 0; canvas = next;
    }
    const jpeg = (edge, quality) => {
      const scale = Math.min(1, edge / Math.max(canvas.width, canvas.height)), small = make(Math.max(1, Math.round(canvas.width * scale)), Math.max(1, Math.round(canvas.height * scale)));
      const ctx = small.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, small.width, small.height); ctx.drawImage(canvas, 0, 0, small.width, small.height);
      return small.toDataURL('image/jpeg', quality);
    };
    const result = { width: canvas.width, height: canvas.height, preview: jpeg(1280, 0.72), thumbnail: jpeg(320, 0.62) };
    if (!request.previewOnly) {
      if (request.format === 'jpeg') { const white = make(canvas.width, canvas.height), ctx = white.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, white.width, white.height); ctx.drawImage(canvas, 0, 0); result.dataUrl = white.toDataURL('image/jpeg', 0.92); }
      else result.dataUrl = canvas.toDataURL('image/png');
    }
    return result;
  })().catch((error) => ({ error: String(error?.message || '图片处理失败。').slice(0, 500) }));
}
function createImageProcessor({ BrowserWindow }) {
  return async (dataUrl, operations, { signal, format = 'png', previewOnly = false } = {}) => {
    if (signal?.aborted) throw new Error('任务已停止。');
    const worker = new BrowserWindow({ show: false, width: 1, height: 1, skipTaskbar: true,
      webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, backgroundThrottling: false, partition: 'scodex-image-' + require('node:crypto').randomUUID() } });
    let timer, abort;
    try {
      worker.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      worker.webContents.session.setPermissionRequestHandler((_c, _p, callback) => callback(false));
      worker.webContents.on('will-navigate', (event) => event.preventDefault());
      const run = async () => {
        await worker.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:"><title>Scodex image worker</title>'));
        const result = await worker.webContents.executeJavaScript('(' + imageProgram.toString() + ')(' + JSON.stringify({ dataUrl, operations, previewOnly, format }) + ')', true);
        if (result?.error) throw new Error(result.error);
        return result;
      };
      return await Promise.race([run(), new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('图片处理超时。')), 25000);
        abort = () => reject(new Error('任务已停止。')); signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort();
      })]);
    } finally { clearTimeout(timer); if (abort) signal?.removeEventListener('abort', abort); if (!worker.isDestroyed()) worker.destroy(); }
  };
}
module.exports = { imageProgram, createImageProcessor };
