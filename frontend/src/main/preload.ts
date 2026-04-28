import { contextBridge, ipcRenderer } from 'electron';

const env = {
  API_URL: process.env.API_URL,
};

const electronAPI = {
  onMenuNewOrder: (handler: () => void) => ipcRenderer.on('menu-new-order', handler),
  removeMenuNewOrderListener: (handler: () => void) => ipcRenderer.removeListener('menu-new-order', handler),
  onShowAbout: (handler: () => void) => ipcRenderer.on('show-about', handler),
  removeShowAboutListener: (handler: () => void) => ipcRenderer.removeListener('show-about', handler),

  closeWindow: () => ipcRenderer.invoke('close-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),

  checkForUpdates: () => ipcRenderer.invoke('check-updates'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  onUpdateChecking: (handler: () => void) => ipcRenderer.on('update-checking', handler),
  onUpdateAvailable: (handler: (info: any) => void) => ipcRenderer.on('update-available', handler),
  onUpdateNotAvailable: (handler: (info: any) => void) => ipcRenderer.on('update-not-available', handler),
  onUpdateError: (handler: (error: { message: string }) => void) => ipcRenderer.on('update-error', handler),
  onUpdateDownloadProgress: (handler: (progress: any) => void) => ipcRenderer.on('update-download-progress', handler),
  onUpdateDownloaded: (handler: (info: any) => void) => ipcRenderer.on('update-downloaded', handler),

  log: (level: 'info' | 'warn' | 'error', message: string, meta?: any) => {
    ipcRenderer.send('renderer-log', { level, message, meta });
  },
};

contextBridge.exposeInMainWorld('env', env);
contextBridge.exposeInMainWorld('electronAPI', electronAPI);