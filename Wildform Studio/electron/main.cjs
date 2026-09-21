const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#11151a',
    title: 'Wildform Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (isDev) win.loadURL('http://127.0.0.1:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

ipcMain.handle('wf:open-files', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', ...(options.multiple ? ['multiSelections'] : [])],
    filters: options.filters || []
  });
  if (result.canceled) return [];
  return result.filePaths.map((filePath) => ({
    path: filePath,
    name: path.basename(filePath),
    ext: path.extname(filePath).toLowerCase(),
    dataUrl: `data:application/octet-stream;base64,${fs.readFileSync(filePath).toString('base64')}`
  }));
});

ipcMain.handle('wf:save-text', async (_event, options) => {
  const result = await dialog.showSaveDialog({
    defaultPath: options.defaultName,
    filters: options.filters || []
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, options.text, 'utf8');
  return result.filePath;
});

ipcMain.handle('wf:load-text', async (_event, options = {}) => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: options.filters || [] });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  return { path: filePath, name: path.basename(filePath), text: fs.readFileSync(filePath, 'utf8') };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
