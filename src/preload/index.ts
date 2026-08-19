import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import type {
  AlarmAcknowledgeRequest,
  AlarmChangedEvent,
  AlarmListener,
  AppUpdateEvent,
  AppUpdateListener,
  AuditQuery,
  CreateFirstAdminRequest,
  CreateUserRequest,
  DeviceCommandRequest,
  DeviceConfigUpdateRequest,
  DeviceReadRequest,
  DeviceStateChangedEvent,
  DeviceStateListener,
  DeviceWriteRequest,
  ErrorReportInput,
  HmiApi,
  HistoricalTrendQuery,
  LoginRequest,
  LogEntryInput,
  RecipeDownloadRequest,
  RecipeDraft,
  RealtimeTrendChangedEvent,
  RealtimeTrendListener,
  RealtimeTrendRequest,
  SetUserEnabledRequest,
  SimulatorLifecycleListener,
  SimulatorLifecycleRequest,
  SimulatorStatusChangedEvent,
  TagValuesChangedEvent,
  TagValuesListener,
  UpdateRecipeRequest,
  UpdateUserRoleRequest
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
    updateConfig: (request: DeviceConfigUpdateRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.devices.updateConfig,
      request
    ),
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
  auth: {
    getCurrentUser: () => ipcRenderer.invoke(IPC_CHANNELS.auth.getCurrentUser),
    createFirstAdmin: (request: CreateFirstAdminRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.auth.createFirstAdmin,
      request
    ),
    login: (request: LoginRequest) => ipcRenderer.invoke(IPC_CHANNELS.auth.login, request),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.auth.logout),
    listUsers: () => ipcRenderer.invoke(IPC_CHANNELS.auth.listUsers),
    createUser: (request: CreateUserRequest) => ipcRenderer.invoke(IPC_CHANNELS.auth.createUser, request),
    updateUserRole: (request: UpdateUserRoleRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.auth.updateUserRole,
      request
    ),
    setUserEnabled: (request: SetUserEnabledRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.auth.setUserEnabled,
      request
    )
  },
  recipes: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.recipes.list),
    getParameterDefinitions: () => ipcRenderer.invoke(IPC_CHANNELS.recipes.getParameterDefinitions),
    validate: (draft: RecipeDraft) => ipcRenderer.invoke(IPC_CHANNELS.recipes.validate, draft),
    create: (draft: RecipeDraft) => ipcRenderer.invoke(IPC_CHANNELS.recipes.create, draft),
    update: (request: UpdateRecipeRequest) => ipcRenderer.invoke(IPC_CHANNELS.recipes.update, request),
    copy: (recipeId: string) => ipcRenderer.invoke(IPC_CHANNELS.recipes.copy, recipeId),
    delete: (recipeId: string) => ipcRenderer.invoke(IPC_CHANNELS.recipes.delete, recipeId),
    download: (request: RecipeDownloadRequest) => ipcRenderer.invoke(IPC_CHANNELS.recipes.download, request)
  },
  audit: {
    query: (query: AuditQuery) => ipcRenderer.invoke(IPC_CHANNELS.audit.query, query)
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
  },
  simulators: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.simulators.getStatus),
    start: (request: SimulatorLifecycleRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.simulators.start,
      request
    ),
    stop: (request: SimulatorLifecycleRequest) => ipcRenderer.invoke(
      IPC_CHANNELS.simulators.stop,
      request
    ),
    subscribeStatus: (listener: SimulatorLifecycleListener) => {
      const wrappedListener = (_event: IpcRendererEvent, simulatorEvent: SimulatorStatusChangedEvent): void => {
        listener(simulatorEvent)
      }

      ipcRenderer.on(IPC_CHANNELS.simulators.statusChanged, wrappedListener)
      void ipcRenderer.invoke(IPC_CHANNELS.simulators.subscribeStatus)

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.simulators.statusChanged, wrappedListener)
        void ipcRenderer.invoke(IPC_CHANNELS.simulators.unsubscribeStatus)
      }
    }
  }
}

contextBridge.exposeInMainWorld('hmi', hmiApi)
