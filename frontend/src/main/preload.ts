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

  log: (level: 'info' | 'warn' | 'error', message: string, meta?: any) => {
    ipcRenderer.send('renderer-log', { level, message, meta });
  },
};

contextBridge.exposeInMainWorld('env', env);
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

