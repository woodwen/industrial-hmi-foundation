import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import type {
  AppUpdateEvent,
  AppUpdateListener,
  DeviceReadRequest,
  DeviceWriteRequest,
  ErrorReportInput,
  HmiApi,
  LogEntryInput,
  TagValuesChangedEvent,
  TagValuesListener
} from '../shared/hmi-api'
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
  },
  devices: {
    connect: () => ipcRenderer.invoke(IPC_CHANNELS.devices.connect),
    disconnect: () => ipcRenderer.invoke(IPC_CHANNELS.devices.disconnect),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.devices.getStatus),
    readRegisters: (request: DeviceReadRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.devices.readRegisters,
      request
    ),
    writeRegisters: (request: DeviceWriteRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.devices.writeRegisters,
      request
    )
  },
  tags: {
    getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.tags.getSnapshot),
    subscribeValues: (listener: TagValuesListener) => {
      const wrappedListener = (_event: IpcRendererEvent, tagEvent: TagValuesChangedEvent): void => {
        listener(tagEvent)
      }

      ipcRenderer.on(IPC_CHANNELS.tags.valuesChanged, wrappedListener)
      void ipcRenderer.invoke(IPC_CHANNELS.tags.subscribe)

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.tags.valuesChanged, wrappedListener)
        void ipcRenderer.invoke(IPC_CHANNELS.tags.unsubscribe)
      }
    }
  }
}

contextBridge.exposeInMainWorld('hmi', hmiApi)
