import type {
  AlarmAcknowledgeRequest,
  AlarmHistoryQuery,
  AlarmHistoryResult,
  AlarmListener,
  AlarmOccurrence,
  AlarmSnapshot,
  AppInfo,
  AppUpdateListener,
  AuditLogResult,
  AuditQuery,
  CreateFirstAdminRequest,
  CreateUserRequest,
  CurrentUserSnapshot,
  DeviceCommandRequest,
  DeviceCommandResult,
  DeviceReadRequest,
  DeviceReadResponse,
  DeviceStateListener,
  DeviceStatus,
  DeviceWriteRequest,
  DeviceWriteResponse,
  ErrorReportInput,
  HistoricalTrendQuery,
  HistoricalTrendResult,
  HmiResult,
  LoginRequest,
  LogEntryInput,
  RecipeDownloadRequest,
  RecipeDownloadResult,
  RecipeDraft,
  RecipeDto,
  RecipeListResult,
  RecipeParameterDefinition,
  RecipeValidationResult,
  RealtimeTrendListener,
  RealtimeTrendRequest,
  RealtimeTrendSnapshot,
  SetUserEnabledRequest,
  TagSnapshot,
  TagValuesListener,
  UpdateRecipeRequest,
  UpdateUserRoleRequest,
  UserDto,
  UserListResult,
  Unsubscribe
} from '../../shared/hmi-api'
import type { HmiApiClient } from '../application/AppApplicationService'

export class HmiApiBrowserClient implements HmiApiClient {
  getAppInfo(): Promise<HmiResult<AppInfo>> {
    return window.hmi.app.getInfo()
  }

  writeLog(entry: LogEntryInput): Promise<HmiResult<void>> {
    return window.hmi.log.write(entry)
  }

  reportError(error: ErrorReportInput): Promise<HmiResult<void>> {
    return window.hmi.errors.report(error)
  }

  checkForUpdates(): Promise<HmiResult<void>> {
    return window.hmi.updates.checkForUpdates()
  }

  downloadUpdate(): Promise<HmiResult<void>> {
    return window.hmi.updates.downloadUpdate()
  }

  cancelUpdateDownload(): Promise<HmiResult<void>> {
    return window.hmi.updates.cancelUpdateDownload()
  }

  openUpdateDownloadPage(version?: string): Promise<HmiResult<void>> {
    return window.hmi.updates.openUpdateDownloadPage(version)
  }

  quitAndInstallUpdate(): Promise<HmiResult<void>> {
    return window.hmi.updates.quitAndInstallUpdate()
  }

  onUpdateEvent(listener: AppUpdateListener): Unsubscribe {
    return window.hmi.updates.onUpdateEvent(listener)
  }

  connectDevice(): Promise<HmiResult<DeviceStatus>> {
    return window.hmi.devices.connect()
  }

  disconnectDevice(): Promise<HmiResult<DeviceStatus>> {
    return window.hmi.devices.disconnect()
  }

  getDeviceStatus(): Promise<HmiResult<DeviceStatus>> {
    return window.hmi.devices.getStatus()
  }

  subscribeDeviceState(listener: DeviceStateListener): Unsubscribe {
    return window.hmi.devices.subscribeState(listener)
  }

  readDeviceRegisters(request: DeviceReadRequest): Promise<HmiResult<DeviceReadResponse>> {
    return window.hmi.devices.readRegisters(request)
  }

  writeDeviceRegisters(request: DeviceWriteRequest): Promise<HmiResult<DeviceWriteResponse>> {
    return window.hmi.devices.writeRegisters(request)
  }

  executeCommand(request: DeviceCommandRequest): Promise<HmiResult<DeviceCommandResult>> {
    return window.hmi.commands.execute(request)
  }

  getCurrentUser(): Promise<HmiResult<CurrentUserSnapshot>> {
    return window.hmi.auth.getCurrentUser()
  }

  createFirstAdmin(request: CreateFirstAdminRequest): Promise<HmiResult<UserDto>> {
    return window.hmi.auth.createFirstAdmin(request)
  }

  login(request: LoginRequest): Promise<HmiResult<CurrentUserSnapshot>> {
    return window.hmi.auth.login(request)
  }

  logout(): Promise<HmiResult<CurrentUserSnapshot>> {
    return window.hmi.auth.logout()
  }

  listUsers(): Promise<HmiResult<UserListResult>> {
    return window.hmi.auth.listUsers()
  }

  createUser(request: CreateUserRequest): Promise<HmiResult<UserDto>> {
    return window.hmi.auth.createUser(request)
  }

  updateUserRole(request: UpdateUserRoleRequest): Promise<HmiResult<UserDto>> {
    return window.hmi.auth.updateUserRole(request)
  }

  setUserEnabled(request: SetUserEnabledRequest): Promise<HmiResult<UserDto>> {
    return window.hmi.auth.setUserEnabled(request)
  }

  listRecipes(): Promise<HmiResult<RecipeListResult>> {
    return window.hmi.recipes.list()
  }

  getRecipeParameterDefinitions(): Promise<HmiResult<RecipeParameterDefinition[]>> {
    return window.hmi.recipes.getParameterDefinitions()
  }

  validateRecipe(draft: RecipeDraft): Promise<HmiResult<RecipeValidationResult>> {
    return window.hmi.recipes.validate(draft)
  }

  createRecipe(draft: RecipeDraft): Promise<HmiResult<RecipeDto>> {
    return window.hmi.recipes.create(draft)
  }

  updateRecipe(request: UpdateRecipeRequest): Promise<HmiResult<RecipeDto>> {
    return window.hmi.recipes.update(request)
  }

  copyRecipe(recipeId: string): Promise<HmiResult<RecipeDto>> {
    return window.hmi.recipes.copy(recipeId)
  }

  deleteRecipe(recipeId: string): Promise<HmiResult<void>> {
    return window.hmi.recipes.delete(recipeId)
  }

  downloadRecipe(request: RecipeDownloadRequest): Promise<HmiResult<RecipeDownloadResult>> {
    return window.hmi.recipes.download(request)
  }

  queryAuditLog(query: AuditQuery): Promise<HmiResult<AuditLogResult>> {
    return window.hmi.audit.query(query)
  }

  getTagSnapshot(): Promise<HmiResult<TagSnapshot>> {
    return window.hmi.tags.getSnapshot()
  }

  subscribeTagValues(listener: TagValuesListener): Unsubscribe {
    return window.hmi.tags.subscribeValues(listener)
  }

  getAlarmSnapshot(): Promise<HmiResult<AlarmSnapshot>> {
    return window.hmi.alarms.getSnapshot()
  }

  subscribeAlarms(listener: AlarmListener): Unsubscribe {
    return window.hmi.alarms.subscribe(listener)
  }

  acknowledgeAlarm(request: AlarmAcknowledgeRequest): Promise<HmiResult<AlarmOccurrence>> {
    return window.hmi.alarms.acknowledge(request)
  }

  queryAlarmHistory(query: AlarmHistoryQuery): Promise<HmiResult<AlarmHistoryResult>> {
    return window.hmi.alarms.queryHistory(query)
  }

  getRealtimeTrendSnapshot(request: RealtimeTrendRequest): Promise<HmiResult<RealtimeTrendSnapshot>> {
    return window.hmi.trends.getRealtimeSnapshot(request)
  }

  subscribeRealtimeTrend(request: RealtimeTrendRequest, listener: RealtimeTrendListener): Unsubscribe {
    return window.hmi.trends.subscribeRealtime(request, listener)
  }

  queryHistoricalTrend(query: HistoricalTrendQuery): Promise<HmiResult<HistoricalTrendResult>> {
    return window.hmi.trends.queryHistorical(query)
  }
}
