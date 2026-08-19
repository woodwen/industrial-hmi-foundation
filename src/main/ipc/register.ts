import { app, ipcMain, type IpcMainInvokeEvent } from 'electron'

import { createAppError, toAppError } from '../../shared/app-error'
import type {
  AlarmAcknowledgeRequest,
  AlarmHistoryQuery,
  AlarmHistoryResult,
  AlarmOccurrence,
  AlarmSnapshot
} from '../../shared/alarm'
import type {
  AuditLogResult,
  AuditQuery,
  CreateFirstAdminRequest,
  CreateUserRequest,
  CurrentUserSnapshot,
  DeviceCommandRequest,
  DeviceCommandResult,
  DeviceConfigUpdateRequest,
  DeviceReadResponse,
  DeviceReadRequest,
  DeviceStateChangedEvent,
  DeviceStatus,
  DeviceWriteRequest,
  DeviceWriteResponse,
  HmiResult,
  LoginRequest,
  RecipeDownloadRequest,
  RecipeDownloadResult,
  RecipeDraft,
  RecipeDto,
  RecipeListResult,
  RecipeParameterDefinition,
  RecipeValidationResult,
  SetUserEnabledRequest,
  UpdateRecipeRequest,
  UpdateUserRoleRequest,
  UserDto,
  UserListResult
} from '../../shared/hmi-api'
import type { TagSnapshot } from '../../shared/tag'
import type {
  HistoricalTrendQuery,
  HistoricalTrendResult,
  RealtimeTrendRequest,
  RealtimeTrendSnapshot
} from '../../shared/trend'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { createDefaultDeviceManager } from '../device'
import { TagCache, TagService } from '../tag'
import type { Logger } from '../logging/logger'
import { createDeviceError, DEVICE_ERROR_CODES } from '../protocol/errors'
import * as defaultUpdateManager from '../update-manager'
import {
  parseDeviceReadRequest,
  parseDeviceWriteRequest,
  parseAuditQuery,
  parseAlarmAcknowledgeRequest,
  parseAlarmHistoryQuery,
  parseCreateFirstAdminRequest,
  parseCreateUserRequest,
  parseDeviceCommandRequest,
  parseDeviceConfigUpdateRequest,
  parseErrorReportInput,
  parseHistoricalTrendQuery,
  parseLoginRequest,
  parseLogEntryInput,
  parseOptionalStringPayload,
  parseRecipeDownloadRequest,
  parseRecipeDraft,
  parseRecipeIdPayload,
  parseRealtimeTrendRequest,
  parseSetUserEnabledRequest,
  parseUpdateRecipeRequest,
  parseUpdateUserRoleRequest
} from './input-validation'

type Handler<TResult> = (payload: unknown, event: IpcMainInvokeEvent) => Promise<TResult> | TResult

export interface UpdateManagerApi {
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  cancelUpdateDownload(): void
  openUpdateDownloadPage(version?: string): Promise<void>
  quitAndInstallUpdate(): void
}

export interface DeviceManagerApi {
  connectDevice(): Promise<DeviceStatus>
  disconnectDevice(): Promise<DeviceStatus>
  getDeviceStatus(): DeviceStatus
  updateDeviceConfig(request: DeviceConfigUpdateRequest): Promise<DeviceStatus>
  subscribeState(listener: (event: DeviceStateChangedEvent) => void): () => void
  readDeviceRegisters(request: DeviceReadRequest): Promise<DeviceReadResponse>
  writeDeviceRegisters(request: DeviceWriteRequest): Promise<DeviceWriteResponse>
}

export interface CommandManagerApi {
  executeCommand(request: DeviceCommandRequest): Promise<DeviceCommandResult>
  writeDeviceRegisters(request: DeviceWriteRequest): Promise<DeviceWriteResponse>
}

export interface AuthManagerApi {
  getCurrentUser(): CurrentUserSnapshot
  createFirstAdmin(request: CreateFirstAdminRequest): UserDto
  login(request: LoginRequest): CurrentUserSnapshot
  logout(): CurrentUserSnapshot
  listUsers(): UserListResult
  createUser(request: CreateUserRequest): UserDto
  updateUserRole(request: UpdateUserRoleRequest): UserDto
  setUserEnabled(request: SetUserEnabledRequest): UserDto
}

export interface RecipeManagerApi {
  listRecipes(): RecipeListResult
  getRecipeParameterDefinitions(): RecipeParameterDefinition[]
  validateRecipe(draft: RecipeDraft): RecipeValidationResult
  createRecipe(draft: RecipeDraft): RecipeDto
  updateRecipe(request: UpdateRecipeRequest): RecipeDto
  copyRecipe(recipeId: string): RecipeDto
  deleteRecipe(recipeId: string): void
  downloadRecipe(request: RecipeDownloadRequest): Promise<RecipeDownloadResult>
}

export interface AuditManagerApi {
  queryAuditLog(query: AuditQuery): AuditLogResult
}

export interface TagManagerApi {
  getTagSnapshot(): TagSnapshot
}

export interface TagSubscriptionApi {
  addSubscriber(webContents: IpcMainInvokeEvent['sender']): void
  removeSubscriber(webContentsId: number): void
}

export interface AlarmManagerApi {
  getAlarmSnapshot(): AlarmSnapshot
  acknowledgeAlarm(request: AlarmAcknowledgeRequest): AlarmOccurrence
  queryAlarmHistory(query: AlarmHistoryQuery): AlarmHistoryResult
}

export interface AlarmSubscriptionApi {
  addSubscriber(webContents: IpcMainInvokeEvent['sender']): void
  removeSubscriber(webContentsId: number): void
}

export interface TrendManagerApi {
  getRealtimeTrendSnapshot(request: RealtimeTrendRequest): RealtimeTrendSnapshot
  queryHistoricalTrend(query: HistoricalTrendQuery): HistoricalTrendResult
}

export interface TrendSubscriptionApi {
  addSubscriber(webContents: IpcMainInvokeEvent['sender'], tagIds: readonly string[]): void
  removeSubscriber(webContentsId: number): void
}

export interface DeviceStateSubscriptionApi {
  addSubscriber(webContents: IpcMainInvokeEvent['sender']): void
  removeSubscriber(webContentsId: number): void
}

export function registerIpcHandlers(
  logger: Logger,
  updateManager: UpdateManagerApi = defaultUpdateManager,
  deviceManager: DeviceManagerApi = createDefaultDeviceManager(logger),
  tagManager: TagManagerApi = createDefaultTagManager(),
  tagSubscription: TagSubscriptionApi = createNoopTagSubscription(),
  commandManager: CommandManagerApi = createDefaultCommandManager(),
  deviceStateSubscription: DeviceStateSubscriptionApi = createNoopDeviceStateSubscription(),
  alarmManager: AlarmManagerApi = createDefaultAlarmManager(),
  alarmSubscription: AlarmSubscriptionApi = createNoopAlarmSubscription(),
  trendManager: TrendManagerApi = createDefaultTrendManager(),
  trendSubscription: TrendSubscriptionApi = createNoopTrendSubscription(),
  authManager: AuthManagerApi = createDefaultAuthManager(),
  recipeManager: RecipeManagerApi = createDefaultRecipeManager(),
  auditManager: AuditManagerApi = createDefaultAuditManager()
): void {
  handleIpc(IPC_CHANNELS.app.getInfo, logger, () => ({
    name: app.getName(),
    version: app.getVersion(),
    environment: process.env.NODE_ENV === 'test'
      ? 'test'
      : app.isPackaged
        ? 'production'
        : 'development'
  }))

  handleIpc<void>(IPC_CHANNELS.log.write, logger, (payload) => {
    const entry = parseLogEntryInput(payload, `ipc:${IPC_CHANNELS.log.write}`)

    logger.write({
      ...entry,
      source: entry.source ?? 'renderer'
    })
  })

  handleIpc<void>(IPC_CHANNELS.errors.report, logger, (payload) => {
    const error = parseErrorReportInput(payload, `ipc:${IPC_CHANNELS.errors.report}`)

    logger.write({
      category: 'error',
      level: 'error',
      message: error.message,
      source: error.source ?? 'renderer',
      context: {
        code: error.code,
        detail: error.detail ?? null,
        cause: error.cause ?? null,
        componentStack: error.componentStack ?? null
      }
    })
  })

  handleIpc<void>(IPC_CHANNELS.updates.checkForUpdates, logger, () => updateManager.checkForUpdates())

  handleIpc<void>(IPC_CHANNELS.updates.downloadUpdate, logger, () => updateManager.downloadUpdate())

  handleIpc<void>(IPC_CHANNELS.updates.cancelUpdateDownload, logger, () => {
    updateManager.cancelUpdateDownload()
  })

  handleIpc<void>(IPC_CHANNELS.updates.openUpdateDownloadPage, logger, (payload) => {
    const version = parseOptionalStringPayload(
      payload,
      'Update download page version must be a string.',
      `ipc:${IPC_CHANNELS.updates.openUpdateDownloadPage}`
    )

    return updateManager.openUpdateDownloadPage(version)
  })

  handleIpc<void>(IPC_CHANNELS.updates.quitAndInstallUpdate, logger, () => {
    updateManager.quitAndInstallUpdate()
  })

  handleIpc<DeviceStatus>(IPC_CHANNELS.devices.connect, logger, () => deviceManager.connectDevice())

  handleIpc<DeviceStatus>(IPC_CHANNELS.devices.disconnect, logger, () => deviceManager.disconnectDevice())

  handleIpc<DeviceStatus>(IPC_CHANNELS.devices.getStatus, logger, () => deviceManager.getDeviceStatus())

  handleIpc<DeviceStatus>(IPC_CHANNELS.devices.updateConfig, logger, (payload) => (
    deviceManager.updateDeviceConfig(parseDeviceConfigUpdateRequest(payload, `ipc:${IPC_CHANNELS.devices.updateConfig}`))
  ))

  handleIpc<void>(IPC_CHANNELS.devices.subscribeState, logger, (_payload, event) => {
    deviceStateSubscription.addSubscriber(event.sender)
  })

  handleIpc<void>(IPC_CHANNELS.devices.unsubscribeState, logger, (_payload, event) => {
    deviceStateSubscription.removeSubscriber(event.sender.id)
  })

  handleIpc<DeviceReadResponse>(IPC_CHANNELS.devices.readRegisters, logger, (payload) => (
    deviceManager.readDeviceRegisters(parseDeviceReadRequest(payload, `ipc:${IPC_CHANNELS.devices.readRegisters}`))
  ))

  handleIpc<DeviceWriteResponse>(IPC_CHANNELS.devices.writeRegisters, logger, (payload) => (
    commandManager.writeDeviceRegisters(parseDeviceWriteRequest(payload, `ipc:${IPC_CHANNELS.devices.writeRegisters}`))
  ))

  handleIpc<DeviceCommandResult>(IPC_CHANNELS.commands.execute, logger, (payload) => (
    commandManager.executeCommand(parseDeviceCommandRequest(payload, `ipc:${IPC_CHANNELS.commands.execute}`))
  ))

  handleIpc<CurrentUserSnapshot>(IPC_CHANNELS.auth.getCurrentUser, logger, () => authManager.getCurrentUser())

  handleIpc<UserDto>(IPC_CHANNELS.auth.createFirstAdmin, logger, (payload) => (
    authManager.createFirstAdmin(parseCreateFirstAdminRequest(payload, `ipc:${IPC_CHANNELS.auth.createFirstAdmin}`))
  ))

  handleIpc<CurrentUserSnapshot>(IPC_CHANNELS.auth.login, logger, (payload) => (
    authManager.login(parseLoginRequest(payload, `ipc:${IPC_CHANNELS.auth.login}`))
  ))

  handleIpc<CurrentUserSnapshot>(IPC_CHANNELS.auth.logout, logger, () => authManager.logout())

  handleIpc<UserListResult>(IPC_CHANNELS.auth.listUsers, logger, () => authManager.listUsers())

  handleIpc<UserDto>(IPC_CHANNELS.auth.createUser, logger, (payload) => (
    authManager.createUser(parseCreateUserRequest(payload, `ipc:${IPC_CHANNELS.auth.createUser}`))
  ))

  handleIpc<UserDto>(IPC_CHANNELS.auth.updateUserRole, logger, (payload) => (
    authManager.updateUserRole(parseUpdateUserRoleRequest(payload, `ipc:${IPC_CHANNELS.auth.updateUserRole}`))
  ))

  handleIpc<UserDto>(IPC_CHANNELS.auth.setUserEnabled, logger, (payload) => (
    authManager.setUserEnabled(parseSetUserEnabledRequest(payload, `ipc:${IPC_CHANNELS.auth.setUserEnabled}`))
  ))

  handleIpc<RecipeListResult>(IPC_CHANNELS.recipes.list, logger, () => recipeManager.listRecipes())

  handleIpc<RecipeParameterDefinition[]>(
    IPC_CHANNELS.recipes.getParameterDefinitions,
    logger,
    () => recipeManager.getRecipeParameterDefinitions()
  )

  handleIpc<RecipeValidationResult>(IPC_CHANNELS.recipes.validate, logger, (payload) => (
    recipeManager.validateRecipe(parseRecipeDraft(payload, `ipc:${IPC_CHANNELS.recipes.validate}`))
  ))

  handleIpc<RecipeDto>(IPC_CHANNELS.recipes.create, logger, (payload) => (
    recipeManager.createRecipe(parseRecipeDraft(payload, `ipc:${IPC_CHANNELS.recipes.create}`))
  ))

  handleIpc<RecipeDto>(IPC_CHANNELS.recipes.update, logger, (payload) => (
    recipeManager.updateRecipe(parseUpdateRecipeRequest(payload, `ipc:${IPC_CHANNELS.recipes.update}`))
  ))

  handleIpc<RecipeDto>(IPC_CHANNELS.recipes.copy, logger, (payload) => (
    recipeManager.copyRecipe(parseRecipeIdPayload(payload, `ipc:${IPC_CHANNELS.recipes.copy}`))
  ))

  handleIpc<void>(IPC_CHANNELS.recipes.delete, logger, (payload) => {
    recipeManager.deleteRecipe(parseRecipeIdPayload(payload, `ipc:${IPC_CHANNELS.recipes.delete}`))
  })

  handleIpc<RecipeDownloadResult>(IPC_CHANNELS.recipes.download, logger, (payload) => (
    recipeManager.downloadRecipe(parseRecipeDownloadRequest(payload, `ipc:${IPC_CHANNELS.recipes.download}`))
  ))

  handleIpc<AuditLogResult>(IPC_CHANNELS.audit.query, logger, (payload) => (
    auditManager.queryAuditLog(parseAuditQuery(payload, `ipc:${IPC_CHANNELS.audit.query}`))
  ))

  handleIpc<TagSnapshot>(IPC_CHANNELS.tags.getSnapshot, logger, () => tagManager.getTagSnapshot())

  handleIpc<void>(IPC_CHANNELS.tags.subscribe, logger, (_payload, event) => {
    tagSubscription.addSubscriber(event.sender)
  })

  handleIpc<void>(IPC_CHANNELS.tags.unsubscribe, logger, (_payload, event) => {
    tagSubscription.removeSubscriber(event.sender.id)
  })

  handleIpc<AlarmSnapshot>(IPC_CHANNELS.alarms.getSnapshot, logger, () => alarmManager.getAlarmSnapshot())

  handleIpc<void>(IPC_CHANNELS.alarms.subscribe, logger, (_payload, event) => {
    alarmSubscription.addSubscriber(event.sender)
  })

  handleIpc<void>(IPC_CHANNELS.alarms.unsubscribe, logger, (_payload, event) => {
    alarmSubscription.removeSubscriber(event.sender.id)
  })

  handleIpc<AlarmOccurrence>(IPC_CHANNELS.alarms.acknowledge, logger, (payload) => (
    alarmManager.acknowledgeAlarm(parseAlarmAcknowledgeRequest(payload, `ipc:${IPC_CHANNELS.alarms.acknowledge}`))
  ))

  handleIpc<AlarmHistoryResult>(IPC_CHANNELS.alarms.queryHistory, logger, (payload) => (
    alarmManager.queryAlarmHistory(parseAlarmHistoryQuery(payload, `ipc:${IPC_CHANNELS.alarms.queryHistory}`))
  ))

  handleIpc<RealtimeTrendSnapshot>(IPC_CHANNELS.trends.getRealtimeSnapshot, logger, (payload) => (
    trendManager.getRealtimeTrendSnapshot(
      parseRealtimeTrendRequest(payload, `ipc:${IPC_CHANNELS.trends.getRealtimeSnapshot}`)
    )
  ))

  handleIpc<void>(IPC_CHANNELS.trends.subscribeRealtime, logger, (payload, event) => {
    const request = parseRealtimeTrendRequest(payload, `ipc:${IPC_CHANNELS.trends.subscribeRealtime}`)
    trendSubscription.addSubscriber(event.sender, request.tagIds)
  })

  handleIpc<void>(IPC_CHANNELS.trends.unsubscribeRealtime, logger, (_payload, event) => {
    trendSubscription.removeSubscriber(event.sender.id)
  })

  handleIpc<HistoricalTrendResult>(IPC_CHANNELS.trends.queryHistorical, logger, (payload) => (
    trendManager.queryHistoricalTrend(parseHistoricalTrendQuery(payload, `ipc:${IPC_CHANNELS.trends.queryHistorical}`))
  ))
}

function handleIpc<TResult>(
  channel: string,
  logger: Logger,
  handler: Handler<TResult>
): void {
  ipcMain.handle(channel, async (event, payload: unknown): Promise<HmiResult<TResult>> => {
    try {
      const data = await handler(payload, event)
      return {
        ok: true,
        data
      }
    } catch (error) {
      const appError = toAppError(error, `ipc:${channel}`)
      logger.write({
        category: 'error',
        level: 'error',
        message: appError.message,
        source: appError.source,
        context: {
          code: appError.code,
          detail: appError.detail ?? null,
          cause: appError.cause ?? null
        }
      })

      return {
        ok: false,
        error: appError
      }
    }
  })
}

function createDefaultTagCache(): TagCache {
  const tagService = new TagService()
  return new TagCache(tagService.listTagDefinitions())
}

function createDefaultTagManager(): TagManagerApi {
  const tagCache = createDefaultTagCache()
  return {
    getTagSnapshot: () => tagCache.getSnapshot('simulated-mixer-plc')
  }
}

function createNoopTagSubscription(): TagSubscriptionApi {
  return {
    addSubscriber: () => undefined,
    removeSubscriber: () => undefined
  }
}

function createDefaultCommandManager(): CommandManagerApi {
  const createNotConfiguredError = () => createDeviceError(
    DEVICE_ERROR_CODES.commandRejected,
    'CommandService is not configured.',
    'main:ipc-register'
  )

  return {
    executeCommand: async () => ({
      commandId: 'start',
      deviceId: 'simulated-mixer-plc',
      targetPointId: 'deviceStartCommand',
      status: 'rejected',
      writeAccepted: false,
      verificationStatus: 'failed',
      durationMs: 0,
      message: 'CommandService is not configured.',
      error: createNotConfiguredError(),
      timestamp: new Date().toISOString()
    }),
    writeDeviceRegisters: () => {
      throw createNotConfiguredError()
    }
  }
}

function createDefaultAuthManager(): AuthManagerApi {
  const createNotConfiguredError = () => createAppError({
    code: 'AUTH_SERVICE_NOT_CONFIGURED',
    message: 'User service is not configured.',
    source: 'main:ipc-register'
  })

  return {
    getCurrentUser: () => ({
      user: null,
      permissions: [],
      requiresInitialization: true
    }),
    createFirstAdmin: () => {
      throw createNotConfiguredError()
    },
    login: () => {
      throw createNotConfiguredError()
    },
    logout: () => ({
      user: null,
      permissions: [],
      requiresInitialization: true
    }),
    listUsers: () => {
      throw createNotConfiguredError()
    },
    createUser: () => {
      throw createNotConfiguredError()
    },
    updateUserRole: () => {
      throw createNotConfiguredError()
    },
    setUserEnabled: () => {
      throw createNotConfiguredError()
    }
  }
}

function createDefaultRecipeManager(): RecipeManagerApi {
  const createNotConfiguredError = () => createAppError({
    code: 'RECIPE_SERVICE_NOT_CONFIGURED',
    message: 'RecipeService is not configured.',
    source: 'main:ipc-register'
  })

  return {
    listRecipes: () => ({
      recipes: [],
      emittedAt: new Date().toISOString()
    }),
    getRecipeParameterDefinitions: () => [],
    validateRecipe: () => ({
      valid: false,
      issues: []
    }),
    createRecipe: () => {
      throw createNotConfiguredError()
    },
    updateRecipe: () => {
      throw createNotConfiguredError()
    },
    copyRecipe: () => {
      throw createNotConfiguredError()
    },
    deleteRecipe: () => {
      throw createNotConfiguredError()
    },
    downloadRecipe: () => {
      throw createNotConfiguredError()
    }
  }
}

function createDefaultAuditManager(): AuditManagerApi {
  return {
    queryAuditLog: () => ({
      rows: [],
      emittedAt: new Date().toISOString()
    })
  }
}

function createNoopDeviceStateSubscription(): DeviceStateSubscriptionApi {
  return {
    addSubscriber: () => undefined,
    removeSubscriber: () => undefined
  }
}

function createDefaultAlarmManager(): AlarmManagerApi {
  const createNotConfiguredError = () => createAppError({
    code: 'ALARM_SERVICE_NOT_CONFIGURED',
    message: 'AlarmEngine is not configured.',
    source: 'main:ipc-register'
  })

  return {
    getAlarmSnapshot: () => ({
      occurrences: [],
      emittedAt: new Date().toISOString()
    }),
    acknowledgeAlarm: () => {
      throw createNotConfiguredError()
    },
    queryAlarmHistory: () => ({
      rows: [],
      emittedAt: new Date().toISOString()
    })
  }
}

function createNoopAlarmSubscription(): AlarmSubscriptionApi {
  return {
    addSubscriber: () => undefined,
    removeSubscriber: () => undefined
  }
}

function createDefaultTrendManager(): TrendManagerApi {
  return {
    getRealtimeTrendSnapshot: () => ({
      points: [],
      emittedAt: new Date().toISOString()
    }),
    queryHistoricalTrend: (query) => {
      const now = new Date().toISOString()
      return {
        points: [],
        aggregated: false,
        startTime: query.startTime ?? now,
        endTime: query.endTime ?? now,
        emittedAt: now
      }
    }
  }
}

function createNoopTrendSubscription(): TrendSubscriptionApi {
  return {
    addSubscriber: () => undefined,
    removeSubscriber: () => undefined
  }
}
