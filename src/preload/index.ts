import { contextBridge, ipcRenderer } from 'electron'

import type { ErrorReportInput, HmiApi, LogEntryInput } from '../shared/hmi-api'
import { IPC_CHANNELS } from '../shared/ipc-channels'

const hmiApi: HmiApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.app.getInfo)
  },
  log: {
    write: (entry: LogEntryInput) => ipcRenderer.invoke(IPC_CHANNELS.log.write, entry)
  },
  errors: {
    report: (error: ErrorReportInput) => ipcRenderer.invoke(IPC_CHANNELS.errors.report, error)
  }
}

contextBridge.exposeInMainWorld('hmi', hmiApi)
