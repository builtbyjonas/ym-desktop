import path from 'path';
import fs from 'fs';
import {
  app,
  BrowserWindow,
  shell,
  screen,
  dialog,
  Menu,
  Tray,
  ipcMain,
} from 'electron';
import electronUpdater from 'electron-updater';

// @ts-ignore
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const { autoUpdater } = electronUpdater;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

if (process.env.NODE_ENV === 'production') {
  import('source-map-support').then((sourceMapSupport) => {
    sourceMapSupport.install();
  });
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

const version = app.getVersion();

if (isDebug) {
  import('electron-debug').then((electronDebug) => electronDebug.default());
}

const checkForUpdates = async (): Promise<boolean> => {
  try {
    const result = await autoUpdater.checkForUpdates();
    const updateAvailable = result && result.updateInfo?.version !== version;
    const updateDownloaded = result && result.downloadPromise !== undefined;
    return !!(updateAvailable && !updateDownloaded);
  } catch (erro: any) {
    console.error('Error checking for updates:', erro);
    return false;
  }
};

const getAssetPath = (...paths: string[]): string => {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(app.getAppPath(), 'assets')
    : path.join(__dirname, '../../assets');

  return path.join(RESOURCES_PATH, ...paths);
};

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const ICON = getAssetPath('icon.png').replace('\\C', 'C').split(';')[0];

const loadConfig = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return {};
};

const saveConfig = (config: any) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
  }
};

const createTray = () => {
  tray = new Tray(ICON);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      },
    },
    {
      label: 'Check for Updates',
      click: async () => {
        const updateAvailable = await checkForUpdates();
        if (updateAvailable) {
          const response = await dialog.showMessageBox(mainWindow as any, {
            type: 'info',
            buttons: ['Update now', 'Later', 'Close'],
            title: 'Update Available',
            message: 'An update is available. Would you like to update now?',
          });

          if (response.response === 0) {
            autoUpdater.quitAndInstall();
          }
        } else {
          dialog.showMessageBox(mainWindow as any, {
            type: 'info',
            buttons: ['OK'],
            title: 'No Updates',
            message: 'You are using the latest version.',
          });
        }
      },
    },
    {
      label: 'App Info',
      click: () => {
        const versions = `Node.js: ${process.versions.node}\nElectron: ${process.versions.electron}\nChromium: ${process.versions.chrome}\nApp: ${version}`;
        dialog.showMessageBox(mainWindow as any, {
          type: 'info',
          buttons: ['OK'],
          title: 'App Info',
          message: 'App Versions',
          detail: versions,
        });
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.exit();
      },
    },
  ]);

  tray.setToolTip('YouTube Music Desktop');
  tray.setContextMenu(contextMenu);
};

const changeZoom = (factor: number) => {
  if (!mainWindow) return;
  const currentZoom = mainWindow.webContents.getZoomLevel();
  const newZoom = currentZoom + factor;
  mainWindow.webContents.setZoomLevel(newZoom);

  const config = loadConfig();
  config.zoomLevel = newZoom;
  saveConfig(config);
};

const createWindow = async (updateAvailable: boolean) => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    show: false,
    width,
    height,
    icon: ICON,
    title: 'YouTube Music Desktop',
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.ym/dll/preload.js'),
    },
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    mainWindow.setTitle('YouTube Music Desktop');

    const config = loadConfig();
    if (typeof config.zoomLevel === 'number') {
      mainWindow.webContents.setZoomLevel(config.zoomLevel);
    }

    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `Failed to load URL: ${validatedURL} with error: ${errorDescription} (${errorCode})`,
      );
    },
  );

  mainWindow.loadURL('https://music.youtube.com');

  mainWindow.setMenu(null);

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((edata: any) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  if (updateAvailable) {
    const response = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Update now', 'Later', 'Close'],
      title: 'Update Available',
      message: 'An update is available. Would you like to update now?',
    });

    if (response.response === 0) {
      autoUpdater.quitAndInstall();
    } else if (response.response === 2) {
      app.quit();
    }
  }

  const menuTemplate = [
    {
      label: 'Options',
      submenu: [
        {
          label: 'Check for Updates',
          click: async () => {
            const updateAvailable = await checkForUpdates();
            if (updateAvailable) {
              const response = await dialog.showMessageBox(mainWindow as any, {
                type: 'info',
                buttons: ['Update now', 'Later', 'Close'],
                title: 'Update Available',
                message:
                  'An update is available. Would you like to update now?',
              });

              if (response.response === 0) {
                autoUpdater.quitAndInstall();
              }
            } else {
              dialog.showMessageBox(mainWindow as any, {
                type: 'info',
                buttons: ['OK'],
                title: 'No Updates',
                message: 'You are using the latest version.',
              });
            }
          },
        },
        {
          label: 'App Info',
          click: () => {
            const versions = `Node.js: ${process.versions.node}\nElectron: ${process.versions.electron}\nChromium: ${process.versions.chrome}\nApp: ${version}`;
            dialog.showMessageBox(mainWindow as any, {
              type: 'info',
              buttons: ['OK'],
              title: 'App Info',
              message: 'App Versions',
              detail: versions,
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CommandOrControl+=',
          click: () => {
            changeZoom(0.5);
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CommandOrControl+-',
          click: () => {
            changeZoom(-0.5);
          },
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            app.exit();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate as any);
  Menu.setApplicationMenu(menu);

  mainWindow.on('swipe', (event, direction) => {
    if (direction === 'left') {
      mainWindow?.webContents.send('navigate-back');
    }
  });

  mainWindow.on('swipe', (event, direction) => {
    if (direction === 'right') {
      mainWindow?.webContents.send('navigate-forward');
    }
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    const updateAvailable = await checkForUpdates();
    await createWindow(updateAvailable);
    createTray();
    app.on('activate', () => {
      if (mainWindow === null) createWindow(false);
    });
  })
  .catch((err: Error) => {
    console.error('Error creating window:', err);
  });

ipcMain.on('navigate-back', () => {
  mainWindow?.webContents.goBack();
});

ipcMain.on('navigate-forward', () => {
  mainWindow?.webContents.goForward();
});

ipcMain.on('resize-window', (event, deltaY) => {
  const step = 0.1;
  const change = deltaY > 0 ? -step : step;
  changeZoom(change);
});
