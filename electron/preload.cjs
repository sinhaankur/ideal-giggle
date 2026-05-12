const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('empatheia', {
  platform: process.platform,
  isElectron: true,
  version: process.versions.electron,
})
