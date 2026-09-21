const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('wildformDesktop', {
  openFiles: (options) => ipcRenderer.invoke('wf:open-files', options),
  saveText: (options) => ipcRenderer.invoke('wf:save-text', options),
  loadText: (options) => ipcRenderer.invoke('wf:load-text', options)
});
