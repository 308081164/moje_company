import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';

// 保持窗口对象的全局引用，避免被垃圾回收
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// 开发环境判断
const isDev = process.env.NODE_ENV === 'development';

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
      preload: path.join(__dirname, 'preload.js')
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
  createWindow();
  setupAutoUpdater();
  
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
ipcMain.handle('get-app-info', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    isDev
  };
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