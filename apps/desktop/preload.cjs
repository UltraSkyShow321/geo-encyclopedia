const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('__GEO_NATIVE__', true);
