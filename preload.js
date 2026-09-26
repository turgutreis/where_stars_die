const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    generateUniverse: (apiKey, useQpu) => ipcRenderer.invoke('generate-universe', apiKey, useQpu),
    loadUniverseData: () => ipcRenderer.invoke('load-universe-data'),
    closeApp: () => ipcRenderer.send('close-app'),
    saveGame: (slotId, data) => ipcRenderer.invoke('save-game', slotId, data),
    loadGame: (slotId) => ipcRenderer.invoke('load-game', slotId),
    listSaves: () => ipcRenderer.invoke('list-saves'),
    deleteSave: (slotId) => ipcRenderer.invoke('delete-save', slotId)
});
