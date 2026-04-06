const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // 应用信息
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // 文件操作
  selectFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  
  // 系统信息
  getPlatform: () => process.platform,
  isDev: () => process.env.NODE_ENV === 'development',
  
  // 菜单事件监听
  onMenuNewOrder: (callback) => ipcRenderer.on('menu-new-order', callback),
  onShowAbout: (callback) => ipcRenderer.on('show-about', callback),
  
  // 移除监听器
  removeMenuNewOrderListener: (callback) => ipcRenderer.removeListener('menu-new-order', callback),
  removeShowAboutListener: (callback) => ipcRenderer.removeListener('show-about', callback),
  
  // 通知
  showNotification: (title, body) => ipcRenderer.invoke('notification:show', { title, body }),
  
  // 存储
  setStoreValue: (key, value) => ipcRenderer.invoke('store:set', { key, value }),
  getStoreValue: (key) => ipcRenderer.invoke('store:get', key),
  deleteStoreValue: (key) => ipcRenderer.invoke('store:delete', key),
  
  // 打印
  print: (options) => ipcRenderer.invoke('print', options),
  
  // 日志
  log: (level, message, data) => ipcRenderer.invoke('log', { level, message, data })
});

// 监听主进程消息
ipcRenderer.on('update-available', (event, info) => {
  window.dispatchEvent(new CustomEvent('electron-update-available', { detail: info }));
});

ipcRenderer.on('update-downloaded', (event, info) => {
  window.dispatchEvent(new CustomEvent('electron-update-downloaded', { detail: info }));
});

ipcRenderer.on('update-error', (event, error) => {
  window.dispatchEvent(new CustomEvent('electron-update-error', { detail: error }));
});

// 暴露Node.js模块（有限制地）
contextBridge.exposeInMainWorld('nodeModules', {
  path: {
    join: (...args) => require('path').join(...args),
    basename: (path, ext) => require('path').basename(path, ext),
    dirname: (path) => require('path').dirname(path),
    extname: (path) => require('path').extname(path)
  },
  fs: {
    readFile: (path, encoding) => ipcRenderer.invoke('fs:readFile', { path, encoding }),
    writeFile: (path, data, encoding) => ipcRenderer.invoke('fs:writeFile', { path, data, encoding }),
    exists: (path) => ipcRenderer.invoke('fs:exists', { path }),
    mkdir: (path, options) => ipcRenderer.invoke('fs:mkdir', { path, options })
  },
  os: {
    platform: () => require('os').platform(),
    homedir: () => require('os').homedir(),
    tmpdir: () => require('os').tmpdir()
  }
});

// 安全地暴露环境变量
contextBridge.exposeInMainWorld('env', {
  NODE_ENV: process.env.NODE_ENV,
  API_URL: process.env.API_URL || 'http://localhost:8851/api'
});