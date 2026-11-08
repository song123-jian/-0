const stop = document.getElementById('stop');
stop.addEventListener('click', () => window.desktopControl.stop());
window.desktopControl.onState(({ stopping, count, config = {} }) => {
  const strings = config.strings || {};
  document.documentElement.lang = config.locale || 'zh-CN';
  document.documentElement.dir = config.direction === 'rtl' ? 'rtl' : 'ltr';
  if (/^#[a-f\d]{6}$/i.test(config.accentColor || '')) document.documentElement.style.setProperty('--accent', config.accentColor);
  document.getElementById('title').textContent = stopping ? (strings.stopping || '正在停止电脑操控…') : (strings.usingComputer || 'Scodex 正在使用你的电脑');
  const cancelText = strings.escToCancel || '按 Esc 可停止';
  const activeHint = strings.activeHint || `${cancelText}${count > 1 ? ` · ${count} 个任务` : ''}`;
  document.getElementById('hint').textContent = stopping ? (strings.stoppingHint || '已阻止后续操作，正在结束任务') : activeHint;
  const stopText = strings.stop || '停止';
  const stopLabel = strings.stopLabel || stopText;
  stop.textContent = stopText;
  stop.setAttribute('aria-label', stopLabel);
  stop.disabled = stopping;
});
