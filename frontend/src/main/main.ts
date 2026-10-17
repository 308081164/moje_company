import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import { autoUpdater } from 'electron-updater';

// 保持窗口对象的全局引用，避免被垃圾回收
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let socialPublisherWindow: BrowserWindow | null = null;
let socialPublisherSidecar: ChildProcess | null = null;

/** 解析后的 HTTP(S) 基址，不含 /api，例如 http://62.234.174.95:8851 */
let cachedJewelryApiOrigin: string | undefined;

type InlayDesktopAuth = {
  origin: string;
  username: string;
  password: string;
};

/** 员工端直连 NAS 镶嵌库（默认公司内网 192.168.1.10:8871） */
let cachedInlayAuth: InlayDesktopAuth = {
  origin: 'http://192.168.1.10:8871',
  username: 'moje',
  password: '',
};

// 开发环境判断
const isDev = process.env.NODE_ENV === 'development';

function normalizeApiOriginString(raw: string): string {
  let u = raw.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  if (u.endsWith('/api')) {
    u = u.slice(0, -4).replace(/\/+$/, '');
  }
  return u;
}

type DesktopApiFile = {
  API_ORIGIN?: string;
  apiOrigin?: string;
  API_URL?: string;
  INLAY_API_ORIGIN?: string;
  inlayApiOrigin?: string;
  INLAY_USERNAME?: string;
  INLAY_PASSWORD?: string;
};

function readDesktopConfigFile(filePath: string): DesktopApiFile | undefined {
  try {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }
    const text = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(text) as DesktopApiFile;
  } catch (e) {
    console.warn('[jewelry] 读取 api 配置文件失败:', filePath, e);
    return undefined;
  }
}

function readApiOriginFromJsonFile(filePath: string): string | undefined {
  const j = readDesktopConfigFile(filePath);
  const v = j?.API_ORIGIN || j?.apiOrigin || j?.API_URL;
  if (typeof v === 'string' && v.trim()) {
    return normalizeApiOriginString(v);
  }
  return undefined;
}

function loadInlayAuthFromFiles(): Partial<InlayDesktopAuth> {
  const candidates: string[] = [];
  try {
    candidates.push(path.join(app.getPath('userData'), 'api-config.json'));
  } catch {
    /* ignore */
  }
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'api-config.json'));
  }
  try {
    candidates.push(path.join(path.dirname(app.getPath('exe')), 'api-config.json'));
  } catch {
    /* ignore */
  }
  for (const p of candidates) {
    const j = readDesktopConfigFile(p);
    if (!j) continue;
    const originRaw = j.INLAY_API_ORIGIN || j.inlayApiOrigin;
    const found: Partial<InlayDesktopAuth> = {};
    if (typeof originRaw === 'string' && originRaw.trim()) {
      found.origin = normalizeApiOriginString(originRaw);
    }
    if (typeof j.INLAY_USERNAME === 'string' && j.INLAY_USERNAME.trim()) {
      found.username = j.INLAY_USERNAME.trim();
    }
    if (typeof j.INLAY_PASSWORD === 'string' && j.INLAY_PASSWORD) {
      found.password = j.INLAY_PASSWORD;
    }
    if (found.origin || found.username || found.password) {
      console.log('[jewelry] 已从配置文件加载镶嵌库连接:', p);
      return found;
    }
  }
  return {};
}

/**
 * 解析桌面端应连接的后端基址（不含 /api）。
 * 优先级：环境变量 JEWELRY_API_ORIGIN / API_URL → 构建期 JEWELRY_API_ORIGIN（webpack 注入）
 * → userData/api-config.json → resources/api-config.json → 安装目录旁 api-config.json
 */
function resolveJewelryApiOrigin(): string | undefined {
  const fromEnv =
    process.env.JEWELRY_API_ORIGIN?.trim() ||
    process.env.API_URL?.trim();
  if (fromEnv) {
    return normalizeApiOriginString(fromEnv);
  }

  const baked = typeof __JEWELRY_API_ORIGIN_BAKED__ !== 'undefined' ? String(__JEWELRY_API_ORIGIN_BAKED__).trim() : '';
  if (baked) {
    return normalizeApiOriginString(baked);
  }

  const candidates: string[] = [];
  try {
    candidates.push(path.join(app.getPath('userData'), 'api-config.json'));
  } catch {
    /* ignore */
  }
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'api-config.json'));
  }
  try {
    candidates.push(path.join(path.dirname(app.getPath('exe')), 'api-config.json'));
  } catch {
    /* ignore */
  }

  for (const p of candidates) {
    const v = readApiOriginFromJsonFile(p);
    if (v) {
      console.log('[jewelry] 已从配置文件加载 API 基址:', p, '→', v);
      return v;
    }
  }

  return undefined;
}

function setupAutoUpdater() {
  if (isDev) {
    console.log('[updater] 开发模式，跳过自动更新');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking-for-update');
    mainWindow?.webContents.send('update-checking');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] update-available', info?.version);
    mainWindow?.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] update-not-available', info?.version);
    mainWindow?.webContents.send('update-not-available', info);
  });

  autoUpdater.on('error', (error) => {
    console.error('[updater] error', error);
    mainWindow?.webContents.send('update-error', {
      message: error?.message || '自动更新失败',
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-download-progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] update-downloaded', info?.version);
    mainWindow?.webContents.send('update-downloaded', info);
  });
}

function createWindow() {
  // 动态查找图标路径
  let iconPath: string;
  if (isDev) {
    iconPath = path.join(__dirname, '../../assets/icon.png');
  } else {
    iconPath = path.join(process.resourcesPath, 'assets/icon.png');
  }

  const extraArgs: string[] = [];
  if (cachedJewelryApiOrigin) {
    extraArgs.push(`--jewelry-api-origin=${encodeURIComponent(cachedJewelryApiOrigin)}`);
  }
  extraArgs.push(`--inlay-api-origin=${encodeURIComponent(cachedInlayAuth.origin)}`);

  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: iconPath, // 设置窗口图标
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // 开发期：允许跨域请求（后端若未配置 CORS，会在 renderer 里表现为 Axios Network Error）
      // 打包/生产环境请保持 webSecurity=true
      webSecurity: !isDev,
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: extraArgs,
    },
    show: false, // 先隐藏，等加载完成再显示
    frame: true,
    titleBarStyle: 'default'
  });

  // 加载应用
  if (isDev) {
    // 开发环境：直接加载 dist/index.html（避免 dev-server 客户端在 nodeIntegration=false 下触发 require/global 报错）
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    // 打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  // 关键加载/渲染事件日志（用于排查白屏）
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[renderer] did-fail-load', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[renderer] did-finish-load', mainWindow?.webContents.getURL());
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[renderer] dom-ready', mainWindow?.webContents.getURL());
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const lvl = ['debug', 'info', 'warn', 'error'][level] ?? String(level);
    console.log(`[renderer console:${lvl}] ${message} (${sourceId}:${line})`);
  });

  // 窗口加载完成后显示
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 创建系统托盘
  createTray();
}

// ============ social_publisher 社媒发布内嵌（桌面端） ============

/** 解析 social_publisher sidecar 可执行文件路径（开发走源码目录，打包走 extraResources） */
function resolveSocialPublisherSidecarExe(): string {
  if (isDev) {
    return path.join(__dirname, '../../../social_publisher/sidecar/dist/publisher-engine.exe');
  }
  return path.join(process.resourcesPath, 'social-publisher', 'publisher-engine.exe');
}

/** 解析 social_publisher 前端（renderer dist）目录 */
function resolveSocialPublisherDistDir(): string {
  if (isDev) {
    return path.join(__dirname, '../../../social_publisher/electron/dist');
  }
  return path.join(process.resourcesPath, 'social-publisher', 'dist');
}

/** 拉起 social_publisher sidecar（无安全层模式，仅内嵌场景） */
function startSocialPublisherSidecar() {
  try {
    const exe = resolveSocialPublisherSidecarExe();
    if (!fs.existsSync(exe)) {
      console.warn('[social-publisher] sidecar 可执行文件不存在（跳过内嵌）:', exe);
      return;
    }
    const dataDir = path.join(app.getPath('userData'), 'social-publisher');
    socialPublisherSidecar = spawn(exe, ['--host', '127.0.0.1', '--port', '8854'], {
      env: {
        ...process.env,
        SOCIAL_PUBLISHER_BYPASS_SECURITY: '1',
        SOCIAL_PUBLISHER_DATA_DIR: dataDir,
      },
      stdio: 'ignore',
      windowsHide: true,
    });
    socialPublisherSidecar.on('exit', (code, signal) => {
      console.log('[social-publisher] sidecar exited code=%s signal=%s', code, signal);
      socialPublisherSidecar = null;
    });
    socialPublisherSidecar.on('error', (err) => {
      console.error('[social-publisher] sidecar 启动失败', err);
      socialPublisherSidecar = null;
    });
    console.log('[social-publisher] sidecar 已启动，端口 8854');
  } catch (e) {
    console.error('[social-publisher] 启动 sidecar 异常', e);
  }
}

/** 打开社媒发布子窗口（加载 social_publisher renderer dist） */
function openSocialPublisherWindow() {
  if (socialPublisherWindow && !socialPublisherWindow.isDestroyed()) {
    socialPublisherWindow.show();
    socialPublisherWindow.focus();
    return;
  }
  const distDir = resolveSocialPublisherDistDir();
  const indexHtml = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.warn('[social-publisher] 前端产物不存在:', indexHtml);
    return;
  }
  socialPublisherWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: '社媒发布',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  // query.sidecar 会被 social_publisher 前端读取，用于连接本地 sidecar
  socialPublisherWindow.loadFile(indexHtml, { query: { sidecar: '8854' } });
  socialPublisherWindow.on('closed', () => {
    socialPublisherWindow = null;
  });
}

/** 关闭 sidecar 子进程 */
function stopSocialPublisherSidecar() {
  if (socialPublisherSidecar) {
    try {
      socialPublisherSidecar.kill();
    } catch {
      /* ignore */
    }
    socialPublisherSidecar = null;
  }
}

// 创建系统托盘
function createTray() {
  // 动态查找图标路径（支持开发和生产环境）
  let iconPath: string;
  if (isDev) {
    // 开发环境：直接使用 assets 目录
    iconPath = path.join(__dirname, '../../assets/icon.png');
  } else {
    // 生产环境：使用 app.asar 解压后的资源目录
    iconPath = path.join(process.resourcesPath, 'assets/icon.png');
  }
  
  // 尝试加载图标，如果失败则回退
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      throw new Error('图标文件为空');
    }
  } catch (e) {
    console.warn('[tray] 无法加载图标，使用默认图标', e);
    // 创建一个简单的空白图标
    trayIcon = nativeImage.createEmpty();
  }
  
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('珠宝定制管理系统');
  tray.setContextMenu(contextMenu);
  
  // 双击托盘图标显示主窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  cachedJewelryApiOrigin = resolveJewelryApiOrigin();
  const inlayFromEnv =
    process.env.JEWELRY_INLAY_API_ORIGIN?.trim() ||
    process.env.INLAY_API_ORIGIN?.trim();
  const inlayBaked =
    typeof __JEWELRY_INLAY_API_ORIGIN_BAKED__ !== 'undefined'
      ? String(__JEWELRY_INLAY_API_ORIGIN_BAKED__).trim()
      : '';
  const inlayFromFile = loadInlayAuthFromFiles();
  cachedInlayAuth = {
    origin: normalizeApiOriginString(
      inlayFromEnv || inlayFromFile.origin || inlayBaked || cachedInlayAuth.origin
    ),
    username:
      process.env.JEWELRY_INLAY_USERNAME?.trim() ||
      inlayFromFile.username ||
      cachedInlayAuth.username,
    password: process.env.JEWELRY_INLAY_PASSWORD || inlayFromFile.password || '',
  };
  console.log('[jewelry] 镶嵌库直连:', cachedInlayAuth.origin, 'user=', cachedInlayAuth.username);
  if (!cachedJewelryApiOrigin && app.isPackaged) {
    console.error(
      '[jewelry] 未配置后端 API 基址，桌面端将仍回退 localhost（仅本机联调可用）。' +
        ' 请任选其一：1) 启动前设置环境变量 JEWELRY_API_ORIGIN=http://服务器:8851  ' +
        '2) 在 GitHub Actions 构建时设置同名 Secret 并写入 JEWELRY_API_ORIGIN  ' +
        `3) 创建配置文件: ${path.join(app.getPath('userData'), 'api-config.json')} 内容示例: {"API_ORIGIN":"http://x.x.x.x:8851"}`
    );
  } else if (cachedJewelryApiOrigin) {
    console.log('[jewelry] 使用 API 基址:', cachedJewelryApiOrigin);
  }

  createWindow();
  setupAutoUpdater();
  startSocialPublisherSidecar();
  
  // macOS 应用激活
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  // 创建应用菜单
  createApplicationMenu();

  // 应用启动后稍等检查更新，避免和首屏加载竞争
  setTimeout(() => {
    if (!isDev) {
      autoUpdater.checkForUpdates().catch((e) => {
        console.error('[updater] checkForUpdates failed', e);
      });
    }
  }, 5000);
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  stopSocialPublisherSidecar();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 退出前清理 sidecar
app.on('before-quit', () => {
  stopSocialPublisherSidecar();
});

// 创建应用菜单
function createApplicationMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建订单',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-new-order');
            }
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '重新加载',
          accelerator: 'CmdOrCtrl+R',
          click: (item, focusedWindow) => {
            if (focusedWindow) focusedWindow.reload();
          }
        },
        {
          label: '切换开发者工具',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: (item, focusedWindow) => {
            if (focusedWindow) focusedWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '切换全屏', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: '关闭', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            // 显示关于对话框
            if (mainWindow) {
              mainWindow.webContents.send('show-about');
            }
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC 通信处理
ipcMain.handle('get-inlay-auth', () => ({
  origin: cachedInlayAuth.origin,
  username: cachedInlayAuth.username,
  password: cachedInlayAuth.password,
}));

ipcMain.handle('get-app-info', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    isDev
  };
});

ipcMain.handle('open-social-publisher', () => {
  openSocialPublisherWindow();
  return { opened: true };
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('check-updates', async () => {
  if (isDev) {
    return { checked: false, reason: 'development' };
  }
  await autoUpdater.checkForUpdates();
  return { checked: true };
});

ipcMain.handle('quit-and-install-update', () => {
  if (!isDev) {
    autoUpdater.quitAndInstall();
  }
});

// 处理渲染进程崩溃
app.on('render-process-gone', (event, webContents, details) => {
  console.error('渲染进程崩溃:', details);
  // 可以在这里显示错误对话框或重启渲染进程
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});