const stop = document.getElementById('stop');
stop.addEventListener('click', () => window.desktopControl.stop());
window.desktopControl.onState(({ stopping, count }) => {
  document.getElementById('title').textContent = stopping ? '正在停止电脑操控…' : 'Scodex 正在使用你的电脑';
  document.getElementById('hint').textContent = stopping ? '已阻止后续操作，正在结束任务' : `按 Esc 可停止${count > 1 ? ` · ${count} 个任务` : ''}`;
  stop.disabled = stopping;
});
