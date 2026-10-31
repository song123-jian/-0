function createDesktopTray({ Tray, Menu, nativeImage, iconPath, version, getWindow, getPreferences, requestClose, onCommand, onError }) {
  let tray = null; let error = '';
  const show = () => {
    const window = getWindow(); if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.setSkipTaskbar(false); window.show(); window.focus();
  };
  const run = (action) => { show(); onCommand(action); };
  const contextMenu = () => Menu.buildFromTemplate([
    { label: '打开 Scodex 工作台', click: show },
    { type: 'separator' },
    { label: '新建聊天', click: () => run('new-chat') },
    { label: '定时任务', click: () => run('tasks') },
    { label: '插件与技能', click: () => run('plugins') },
    { label: '工具与操作', click: () => run('tools') },
    { label: '设置', click: () => run('settings') },
    { type: 'separator' },
    { label: '隐藏到托盘', click: () => requestClose('hide') },
    { label: '退出 Scodex', click: () => { show(); requestClose('quit'); } },
  ]);
  const sync = () => {
    if (!getPreferences().trayEnabled) { show(); if (tray) tray.destroy(); tray = null; error = ''; return; }
    if (tray && !tray.isDestroyed()) return;
    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) throw new Error('托盘图标无法加载');
      tray = new Tray(icon.resize({ width: 20, height: 20 }));
      tray.setToolTip('Scodex 工作台 ' + version + ' · 单击打开');
      tray.setContextMenu(contextMenu());
      tray.on('click', show); tray.on('double-click', show);
      error = '';
    } catch { if (tray && !tray.isDestroyed()) tray.destroy(); tray = null; error = '系统托盘不可用，关闭窗口将正常退出。'; onError?.(error); }
  };
  const status = () => ({ available: Boolean(tray && !tray.isDestroyed()), visible: Boolean(getWindow() && !getWindow().isDestroyed() && getWindow().isVisible()), error, closeToTray: Boolean(getPreferences().trayEnabled && getPreferences().closeToTray && tray && !tray.isDestroyed()) });
  const destroy = () => { if (tray && !tray.isDestroyed()) tray.destroy(); tray = null; };
  return { sync, show, status, destroy };
}
module.exports = { createDesktopTray };
