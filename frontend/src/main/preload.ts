import { contextBridge, ipcRenderer } from 'electron';

/** 主进程通过 BrowserWindow.webPreferences.additionalArguments 传入 */
function readJewelryApiOriginFromArgv(): string | undefined {
  const prefix = '--jewelry-api-origin=';
  const hit = process.argv.find((a) => typeof a === 'string' && a.startsWith(prefix));
  if (!hit) {
    return undefined;
  }
  try {
    return decodeURIComponent(hit.slice(prefix.length)).trim();
  } catch {
    return undefined;
  }
}

function toApiUrlWithApiSuffix(origin: string): string {
  const base = origin.replace(/\/+$/, '');
  if (base.endsWith('/api')) {
    return base;
  }
  return `${base}/api`;
}

const argvOrigin = readJewelryApiOriginFromArgv();
const envOrigin =
  process.env.JEWELRY_API_ORIGIN?.trim() ||
  process.env.API_URL?.trim();

const resolvedOrigin = argvOrigin || (envOrigin ? envOrigin.replace(/\/+$/, '').replace(/\/api$/, '') : undefined);

function readInlayOriginFromArgv(): string | undefined {
  const prefix = '--inlay-api-origin=';
  const hit = process.argv.find((a) => typeof a === 'string' && a.startsWith(prefix));
  if (!hit) {
    return undefined;
  }
  try {
    return decodeURIComponent(hit.slice(prefix.length)).trim();
  } catch {
    return undefined;
  }
}

const inlayArgvOrigin = readInlayOriginFromArgv();
const inlayEnvOrigin = process.env.JEWELRY_INLAY_API_ORIGIN?.trim() || process.env.INLAY_API_ORIGIN?.trim();

const env = {
  /** 供 axios 使用：带 /api 后缀的基址（与现有 api.ts 归一化逻辑兼容） */
  API_URL: resolvedOrigin ? toApiUrlWithApiSuffix(resolvedOrigin) : process.env.API_URL,
  /** 珠宝结构库 NAS 基址（不含 /api），员工端内网直连 */
  INLAY_API_ORIGIN: inlayArgvOrigin || inlayEnvOrigin || 'http://192.168.1.10:8871',
};

const electronAPI = {
  getInlayAuth: () => ipcRenderer.invoke('get-inlay-auth') as Promise<{ origin: string; username: string; password: string }>,
  setInlayAuth: (payload: { username: string; password: string }) =>
    ipcRenderer.invoke('set-inlay-auth', payload) as Promise<{ ok: boolean }>,
  onMenuNewOrder: (handler: () => void) => ipcRenderer.on('menu-new-order', handler),
  removeMenuNewOrderListener: (handler: () => void) => ipcRenderer.removeListener('menu-new-order', handler),
  onShowAbout: (handler: () => void) => ipcRenderer.on('show-about', handler),
  removeShowAboutListener: (handler: () => void) => ipcRenderer.removeListener('show-about', handler),

  closeWindow: () => ipcRenderer.invoke('close-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),

  openSocialPublisher: () => ipcRenderer.invoke('open-social-publisher'),
  embedSocialPublisher: () =>
    ipcRenderer.invoke('embed-social-publisher') as Promise<{ ok: boolean; url?: string; error?: string }>,

  checkForUpdates: () => ipcRenderer.invoke('check-updates'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  onUpdateChecking: (handler: () => void) => ipcRenderer.on('update-checking', handler),
  onUpdateAvailable: (handler: (info: any) => void) => ipcRenderer.on('update-available', handler),
  onUpdateNotAvailable: (handler: (info: any) => void) => ipcRenderer.on('update-not-available', handler),
  onUpdateError: (handler: (error: any) => void) => ipcRenderer.on('update-error', handler),
  onUpdateDownloadProgress: (handler: (progress: any) => void) => ipcRenderer.on('update-download-progress', handler),
  onUpdateDownloaded: (handler: (info: any) => void) => ipcRenderer.on('update-downloaded', handler),

  log: (level: 'info' | 'warn' | 'error', message: string, meta?: any) => {
    ipcRenderer.send('renderer-log', { level, message, meta });
  },
};

contextBridge.exposeInMainWorld('env', env);
contextBridge.exposeInMainWorld('electronAPI', electronAPI);