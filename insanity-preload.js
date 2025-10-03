const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveLog: (text) => ipcRenderer.invoke('save-log', text)
});
