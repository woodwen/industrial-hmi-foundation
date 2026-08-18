import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import type {
  AlarmAcknowledgeRequest,
  AlarmChangedEvent,
  AlarmListener,
  AppUpdateEvent,
  AppUpdateListener,
  DeviceCommandRequest,
  DeviceReadRequest,
  DeviceStateChangedEvent,
  DeviceStateListener,
  DeviceWriteRequest,
  ErrorReportInput,
  HmiApi,
  HistoricalTrendQuery,
  LogEntryInput,
  RealtimeTrendChangedEvent,
  RealtimeTrendListener,
  RealtimeTrendRequest,
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
    subscribeState: (listener: DeviceStateListener) => {
      const wrappedListener = (_event: IpcRendererEvent, stateEvent: DeviceStateChangedEvent): void => {
        listener(stateEvent)
      }

      ipcRenderer.on(IPC_CHANNELS.devices.stateChanged, wrappedListener)
      void ipcRenderer.invoke(IPC_CHANNELS.devices.subscribeState)

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.devices.stateChanged, wrappedListener)
        void ipcRenderer.invoke(IPC_CHANNELS.devices.unsubscribeState)
      }
    },
    readRegisters: (request: DeviceReadRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.devices.readRegisters,
      request
    ),
    writeRegisters: (request: DeviceWriteRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.devices.writeRegisters,
      request
    )
  },
  commands: {
    execute: (request: DeviceCommandRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.commands.execute,
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
  },
  alarms: {
    getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.alarms.getSnapshot),
    subscribe: (listener: AlarmListener) => {
      const wrappedListener = (_event: IpcRendererEvent, alarmEvent: AlarmChangedEvent): void => {
        listener(alarmEvent)
      }

      ipcRenderer.on(IPC_CHANNELS.alarms.changed, wrappedListener)
      void ipcRenderer.invoke(IPC_CHANNELS.alarms.subscribe)

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.alarms.changed, wrappedListener)
        void ipcRenderer.invoke(IPC_CHANNELS.alarms.unsubscribe)
      }
    },
    acknowledge: (request: AlarmAcknowledgeRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.alarms.acknowledge,
      request
    ),
    queryHistory: (query) => ipcRenderer.invoke(IPC_CHANNELS.alarms.queryHistory, query)
  },
  trends: {
    getRealtimeSnapshot: (request: RealtimeTrendRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.trends.getRealtimeSnapshot,
      request
    ),
    subscribeRealtime: (request: RealtimeTrendRequest, listener: RealtimeTrendListener) => {
      const wrappedListener = (_event: IpcRendererEvent, trendEvent: RealtimeTrendChangedEvent): void => {
        listener(trendEvent)
      }

      ipcRenderer.on(IPC_CHANNELS.trends.realtimeChanged, wrappedListener)
      void ipcRenderer.invoke(IPC_CHANNELS.trends.subscribeRealtime, request)

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.trends.realtimeChanged, wrappedListener)
        void ipcRenderer.invoke(IPC_CHANNELS.trends.unsubscribeRealtime)
      }
    },
    queryHistorical: (query: HistoricalTrendQuery) => ipcRenderer.invoke(
      IPC_CHANNELS.trends.queryHistorical,
      query
    )
  }
}

contextBridge.exposeInMainWorld('hmi', hmiApi)
