import path from 'path';
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
import { autoUpdater } from 'electron-updater';

import { version } from '../../package.json';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

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

const createTray = () => {
  tray = new Tray("https://github.com/binary-blazer/ym-desktop/blob/v1.4.3/assets/icon.png");

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

const createWindow = async (updateAvailable: boolean) => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(app.getAppPath(), 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    show: false,
    width,
    height,
    icon: getAssetPath('icon.png'),
    title: 'YouTube Music Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    mainWindow.setTitle('YouTube Music Desktop');
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
