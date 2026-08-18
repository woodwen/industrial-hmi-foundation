import { SIMULATED_MIXER_DEVICE_ID } from '../shared/modbus'
import type {
  AlarmAcknowledgeRequest,
  AlarmHistoryQuery,
  AlarmHistoryResult,
  AlarmOccurrence,
  AlarmSnapshot
} from '../shared/alarm'
import type { TagSnapshot, TagValue } from '../shared/tag'
import type {
  CreateFirstAdminRequest,
  CreateUserRequest,
  CurrentUserSnapshot,
  LoginRequest,
  SetUserEnabledRequest,
  UpdateUserRoleRequest,
  UserDto,
  UserListResult
} from '../shared/security'
import type {
  RecipeDownloadRequest,
  RecipeDownloadResult,
  RecipeDraft,
  RecipeDto,
  RecipeListResult,
  RecipeParameterDefinition,
  RecipeValidationResult,
  UpdateRecipeRequest
} from '../shared/recipe'
import type { AuditLogResult, AuditQuery } from '../shared/audit'
import type {
  HistoricalTrendQuery,
  HistoricalTrendResult,
  RealtimeTrendRequest,
  RealtimeTrendSnapshot
} from '../shared/trend'
import { AlarmEngine, AlarmHistoryRepository } from './alarm'
import { AuditRepository, AuditService } from './audit'
import { CommandService } from './command'
import { DeviceManager, DeviceOperationGate } from './device'
import { HistorianDatabase, HistorianService, TagHistoryRepository, TrendQueryService, TrendService } from './historian'
import { AlarmIpcPublisher } from './ipc/alarm-publisher'
import { DeviceStateIpcPublisher } from './ipc/device-state-publisher'
import { TagIpcPublisher } from './ipc/tag-publisher'
import { TrendIpcPublisher } from './ipc/trend-publisher'
import type { Logger } from './logging/logger'
import { ModbusAdapter } from './protocol/modbus/ModbusAdapter'
import { RecipeDownloadService, RecipeRepository, RecipeService } from './recipe'
import { PermissionService, UserRepository, UserService } from './security'
import { PollingScheduler, TagCache, TagService } from './tag'

export interface MainRuntimeOptions {
  databasePath?: string
}

export interface MainRuntime {
  deviceManager: DeviceManager
  commandService: CommandService
  tagService: TagService
  tagCache: TagCache
  pollingScheduler: PollingScheduler
  historianDatabase: HistorianDatabase
  historianService: HistorianService
  trendService: TrendService
  trendQueryService: TrendQueryService
  auditService: AuditService
  userService: UserService
  permissionService: PermissionService
  recipeService: RecipeService
  recipeDownloadService: RecipeDownloadService
  alarmEngine: AlarmEngine
  tagIpcPublisher: TagIpcPublisher
  deviceStateIpcPublisher: DeviceStateIpcPublisher
  alarmIpcPublisher: AlarmIpcPublisher
  trendIpcPublisher: TrendIpcPublisher
  getTagSnapshot(): TagSnapshot
  getCurrentUser(): CurrentUserSnapshot
  createFirstAdmin(request: CreateFirstAdminRequest): UserDto
  login(request: LoginRequest): CurrentUserSnapshot
  logout(): CurrentUserSnapshot
  listUsers(): UserListResult
  createUser(request: CreateUserRequest): UserDto
  updateUserRole(request: UpdateUserRoleRequest): UserDto
  setUserEnabled(request: SetUserEnabledRequest): UserDto
  listRecipes(): RecipeListResult
  getRecipeParameterDefinitions(): RecipeParameterDefinition[]
  validateRecipe(draft: RecipeDraft): RecipeValidationResult
  createRecipe(draft: RecipeDraft): RecipeDto
  updateRecipe(request: UpdateRecipeRequest): RecipeDto
  copyRecipe(recipeId: string): RecipeDto
  deleteRecipe(recipeId: string): void
  downloadRecipe(request: RecipeDownloadRequest): Promise<RecipeDownloadResult>
  queryAuditLog(query: AuditQuery): AuditLogResult
  getAlarmSnapshot(): AlarmSnapshot
  acknowledgeAlarm(request: AlarmAcknowledgeRequest): AlarmOccurrence
  queryAlarmHistory(query: AlarmHistoryQuery): AlarmHistoryResult
  getRealtimeTrendSnapshot(request: RealtimeTrendRequest): RealtimeTrendSnapshot
  queryHistoricalTrend(query: HistoricalTrendQuery): HistoricalTrendResult
  dispose(): void
}

export function createMainRuntime(logger: Logger, options: MainRuntimeOptions = {}): MainRuntime {
  const adapter = new ModbusAdapter(logger)
  const operationGate = new DeviceOperationGate()
  const tagService = new TagService(undefined, logger)
  const tagCache = new TagCache(tagService.listTagDefinitions())
  const historianDatabase = new HistorianDatabase(options.databasePath ?? ':memory:', logger)
  const tagHistoryRepository = new TagHistoryRepository(historianDatabase.db)
  const alarmHistoryRepository = new AlarmHistoryRepository(historianDatabase.db)
  const auditRepository = new AuditRepository(historianDatabase.db)
  const auditService = new AuditService(auditRepository, logger)
  const permissionService = new PermissionService()
  const userRepository = new UserRepository(historianDatabase.db)
  const userService = new UserService(userRepository, permissionService, auditService, undefined, logger)
  const recipeRepository = new RecipeRepository(historianDatabase.db)
  const pollingSchedulerRef: {
    current?: PollingScheduler
  } = {}

  const deviceManager = new DeviceManager({
    adapter,
    logger,
    operationGate,
    lifecycle: {
      onConnected: (deviceId) => {
        pollingSchedulerRef.current?.start(deviceId)
      },
      onReconnecting: (deviceId) => {
        pollingSchedulerRef.current?.stop(deviceId)
        tagCache.markDeviceQuality(deviceId, 'Bad')
      },
      onDisconnected: (deviceId, manual) => {
        pollingSchedulerRef.current?.stop(deviceId)
        tagCache.markDeviceQuality(deviceId, manual ? 'Uncertain' : 'Bad')
      },
      onFault: (deviceId) => {
        pollingSchedulerRef.current?.stop(deviceId)
        tagCache.markDeviceQuality(deviceId, 'Bad')
      }
    }
  })

  const pollingScheduler = new PollingScheduler({
    adapter,
    tagService,
    tagCache,
    logger,
    operationGate,
    onDeviceCommunicationFailure: (_deviceId, error) => {
      deviceManager.handleCommunicationFailure(error)
    }
  })
  pollingSchedulerRef.current = pollingScheduler

  const commandService = new CommandService({
    adapter,
    deviceManager,
    operationGate,
    logger,
    permissionService,
    auditService,
    currentUserProvider: () => userService.getCurrentUser(),
    auditValueProvider: (pointId) => toAuditTagValue(tagCache.getValue(pointId), pointId)
  })
  const historianService = new HistorianService(tagCache, tagHistoryRepository, logger)
  const trendService = new TrendService(tagCache)
  const trendQueryService = new TrendQueryService(tagHistoryRepository)
  const alarmEngine = new AlarmEngine(tagCache, deviceManager, alarmHistoryRepository, logger)
  const recipeService = new RecipeService(recipeRepository, userService, permissionService, auditService, undefined, logger)
  const recipeDownloadService = new RecipeDownloadService(
    recipeService,
    commandService,
    deviceManager,
    userService,
    permissionService,
    auditService,
    undefined,
    logger
  )
  const tagIpcPublisher = new TagIpcPublisher(tagCache, logger)
  const deviceStateIpcPublisher = new DeviceStateIpcPublisher(deviceManager, logger)
  const alarmIpcPublisher = new AlarmIpcPublisher(alarmEngine, logger)
  const trendIpcPublisher = new TrendIpcPublisher(trendService, logger)

  return {
    deviceManager,
    commandService,
    tagService,
    tagCache,
    pollingScheduler,
    historianDatabase,
    historianService,
    trendService,
    trendQueryService,
    auditService,
    userService,
    permissionService,
    recipeService,
    recipeDownloadService,
    alarmEngine,
    tagIpcPublisher,
    deviceStateIpcPublisher,
    alarmIpcPublisher,
    trendIpcPublisher,
    getTagSnapshot: () => tagCache.getSnapshot(SIMULATED_MIXER_DEVICE_ID),
    getCurrentUser: () => userService.getCurrentSnapshot(),
    createFirstAdmin: (request) => userService.createFirstAdmin(request),
    login: (request) => userService.login(request),
    logout: () => userService.logout(),
    listUsers: () => userService.listUsers(),
    createUser: (request) => userService.createUser(request),
    updateUserRole: (request) => userService.updateUserRole(request),
    setUserEnabled: (request) => userService.setUserEnabled(request),
    listRecipes: () => recipeService.listRecipes(),
    getRecipeParameterDefinitions: () => recipeService.getParameterDefinitions(),
    validateRecipe: (draft) => recipeService.validateDraft(draft),
    createRecipe: (draft) => recipeService.createRecipe(draft),
    updateRecipe: (request) => recipeService.updateRecipe(request),
    copyRecipe: (recipeId) => recipeService.copyRecipe(recipeId),
    deleteRecipe: (recipeId) => {
      recipeService.deleteRecipe(recipeId)
    },
    downloadRecipe: (request) => recipeDownloadService.download(request),
    queryAuditLog: (query) => {
      permissionService.authorize(userService.getCurrentUser(), 'audit:read', 'audit-log')
      return auditService.query(query)
    },
    getAlarmSnapshot: () => alarmEngine.getSnapshot(),
    acknowledgeAlarm: (request) => acknowledgeAlarmWithAuthorization(
      request,
      alarmEngine,
      userService,
      permissionService,
      auditService,
      logger
    ),
    queryAlarmHistory: (query) => alarmHistoryRepository.queryHistory(query),
    getRealtimeTrendSnapshot: (request) => trendService.getSnapshot(request.tagIds),
    queryHistoricalTrend: (query) => trendQueryService.queryHistorical(query),
    dispose: () => {
      pollingScheduler.dispose()
      tagIpcPublisher.dispose()
      deviceStateIpcPublisher.dispose()
      alarmIpcPublisher.dispose()
      trendIpcPublisher.dispose()
      alarmEngine.dispose()
      trendService.dispose()
      historianService.flush()
      historianService.dispose()
      commandService.dispose()
      deviceManager.dispose()
      tagCache.dispose()
      historianDatabase.close()
      operationGate.dispose()
    }
  }
}

function acknowledgeAlarmWithAuthorization(
  request: AlarmAcknowledgeRequest,
  alarmEngine: AlarmEngine,
  userService: UserService,
  permissionService: PermissionService,
  auditService: AuditService,
  logger: Logger
): AlarmOccurrence {
  const user = userService.getCurrentUser()
  const previousOccurrence = alarmEngine.getSnapshot().occurrences.find((occurrence) => (
    occurrence.id === request.occurrenceId
  ))
  try {
    permissionService.authorize(user, 'alarm:acknowledge', `alarm:${request.occurrenceId}`)
  } catch (error) {
    try {
      auditService.record({
        user,
        action: 'Alarm Acknowledge',
        target: `alarm:${request.occurrenceId}`,
        oldValue: previousOccurrence ? toAuditAlarmOccurrence(previousOccurrence) : null,
        newValue: {
          occurrenceId: request.occurrenceId,
          attemptedBy: user?.username ?? 'anonymous'
        },
        result: 'Rejected',
        metadata: {
          error: error instanceof Error ? error.message : String(error)
        }
      })
    } catch (auditError) {
      logger.write({
        category: 'error',
        level: 'error',
        message: 'Failed to audit rejected alarm acknowledge',
        source: 'main:runtime',
        context: {
          occurrenceId: request.occurrenceId,
          error: auditError instanceof Error ? auditError.message : String(auditError)
        }
      })
    }
    throw error
  }

  const audit = auditService.createPending({
    user,
    action: 'Alarm Acknowledge',
    target: `alarm:${request.occurrenceId}`,
    oldValue: previousOccurrence ? toAuditAlarmOccurrence(previousOccurrence) : null,
    newValue: {
      occurrenceId: request.occurrenceId
    }
  })
  const acknowledged = alarmEngine.acknowledge({
    occurrenceId: request.occurrenceId,
    user: user?.username
  })
  const auditResult = auditService.finalize({
    id: audit.id,
    result: 'Succeeded',
    newValue: toAuditAlarmOccurrence(acknowledged)
  })

  return {
    ...acknowledged,
    auditStatus: auditResult.ok ? 'finalized' : 'failed',
    auditErrorSummary: auditResult.errorSummary
  }
}

function toAuditTagValue(value: TagValue | undefined, pointId: string): Record<string, unknown> {
  if (!value) {
    return {
      source: 'tag-cache',
      tagId: pointId,
      value: null,
      quality: 'Uncertain',
      unavailable: true
    }
  }

  return {
    source: 'tag-cache',
    tagId: value.tagId,
    value: value.value,
    quality: value.quality,
    timestamp: value.timestamp
  }
}

function toAuditAlarmOccurrence(occurrence: AlarmOccurrence): Record<string, unknown> {
  return {
    occurrenceId: occurrence.id,
    status: occurrence.status,
    acknowledgeTime: occurrence.acknowledgeTime ?? null,
    acknowledgeUser: occurrence.acknowledgeUser ?? null,
    recoverTime: occurrence.recoverTime ?? null
  }
}
