const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;

const PRODUCTION_URL = 'https://dc-control.onrender.com';
const HEALTH_URL = 'https://dc-control.onrender.com/api/health';

async function waitForBackend() {
  console.log('Esperando a que DC Control esté disponible...');

  while (true) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(HEALTH_URL, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        console.log('DC Control está disponible.');
        return true;
      }
    } catch (error) {
      console.log('Backend todavía no disponible...');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    title: 'DC Control - Trazabilidad y Gobernabilidad',
    icon: path.join(__dirname, 'logo.png'),
    backgroundColor: '#0F4C81',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    return { action: 'allow' };
  });

  const loadingPage = `file://${path.join(__dirname, 'electron-loading.html')}`;

  mainWindow.loadURL(loadingPage);

  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();

    await waitForBackend();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(PRODUCTION_URL);
    }
  });

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