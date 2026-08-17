import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import type { AppUpdateEvent, AppUpdateListener, ErrorReportInput, HmiApi, LogEntryInput } from '../shared/hmi-api'
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
  },
  updates: {
    checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.updates.checkForUpdates),
    downloadUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.updates.downloadUpdate),
    cancelUpdateDownload: () => ipcRenderer.invoke(IPC_CHANNELS.updates.cancelUpdateDownload),
    openUpdateDownloadPage: (version?: string) => ipcRenderer.invoke(
      IPC_CHANNELS.updates.openUpdateDownloadPage,
      version
    ),
    quitAndInstallUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.updates.quitAndInstallUpdate),
    onUpdateEvent: (listener: AppUpdateListener) => {
      const wrappedListener = (_event: IpcRendererEvent, updateEvent: AppUpdateEvent): void => {
        listener(updateEvent)
      }

      ipcRenderer.on(IPC_CHANNELS.updates.event, wrappedListener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.updates.event, wrappedListener)
      }
    }
  }
}

contextBridge.exposeInMainWorld('hmi', hmiApi)
