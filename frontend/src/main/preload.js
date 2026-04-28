const { contextBridge, ipcRenderer } = require('electron');

const env = {
  API_URL: process.env.API_URL || 'http://localhost:8851/api',
};

const electronAPI = {
  onMenuNewOrder: (handler) => ipcRenderer.on('menu-new-order', handler),
  removeMenuNewOrderListener: (handler) => ipcRenderer.removeListener('menu-new-order', handler),
  onShowAbout: (handler) => ipcRenderer.on('show-about', handler),
  removeShowAboutListener: (handler) => ipcRenderer.removeListener('show-about', handler),

  closeWindow: () => ipcRenderer.invoke('close-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),

  checkForUpdates: () => ipcRenderer.invoke('check-updates'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  onUpdateChecking: (handler) => ipcRenderer.on('update-checking', handler),
  onUpdateAvailable: (handler) => ipcRenderer.on('update-available', handler),
  onUpdateNotAvailable: (handler) => ipcRenderer.on('update-not-available', handler),
  onUpdateError: (handler) => ipcRenderer.on('update-error', handler),
  onUpdateDownloadProgress: (handler) => ipcRenderer.on('update-download-progress', handler),
  onUpdateDownloaded: (handler) => ipcRenderer.on('update-downloaded', handler),

  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  selectFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  getPlatform: () => process.platform,
  isDev: () => process.env.NODE_ENV === 'development',

  showNotification: (title, body) => ipcRenderer.invoke('notification:show', { title, body }),

  setStoreValue: (key, value) => ipcRenderer.invoke('store:set', { key, value }),
  getStoreValue: (key) => ipcRenderer.invoke('store:get', key),
  deleteStoreValue: (key) => ipcRenderer.invoke('store:delete', key),

  print: (options) => ipcRenderer.invoke('print', options),

  log: (level, message, data) => ipcRenderer.invoke('log', { level, message, data }),
};

contextBridge.exposeInMainWorld('env', env);
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

ipcRenderer.on('update-available', (event, info) => {
  window.dispatchEvent(new CustomEvent('electron-update-available', { detail: info }));
});

ipcRenderer.on('update-downloaded', (event, info) => {
  window.dispatchEvent(new CustomEvent('electron-update-downloaded', { detail: info }));
});

ipcRenderer.on('update-error', (event, error) => {
  window.dispatchEvent(new CustomEvent('electron-update-error', { detail: error }));
});

ipcRenderer.on('update-checking', (event, info) => {
  window.dispatchEvent(new CustomEvent('electron-update-checking', { detail: info }));
});

ipcRenderer.on('update-not-available', (event, info) => {
  window.dispatchEvent(new CustomEvent('electron-update-not-available', { detail: info }));
});

ipcRenderer.on('update-download-progress', (event, progress) => {
  window.dispatchEvent(new CustomEvent('electron-update-download-progress', { detail: progress }));
});

ipcRenderer.on('menu-new-order', (event) => {
  window.dispatchEvent(new CustomEvent('electron-menu-new-order'));
});

ipcRenderer.on('show-about', (event) => {
  window.dispatchEvent(new CustomEvent('electron-show-about'));
});

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