const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;

function getFrontendURL() {
  // Development: Vite serves the React application locally.
  if (!app.isPackaged) {
    return 'http://localhost:5173';
  }

  // Production: Electron loads the compiled React application bundled with the installer.
  return `file://${path.join(__dirname, 'dist', 'index.html')}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'DC Control - Trazabilidad y Gobernabilidad',
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    titleBarStyle: 'hiddenInset',
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.loadURL(getFrontendURL());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
