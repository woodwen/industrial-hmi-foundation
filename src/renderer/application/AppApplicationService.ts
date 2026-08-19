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
  DeviceConfigUpdateRequest,
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
  SimulatorLifecycleListener,
  SimulatorLifecycleRequest,
  SimulatorRuntimeStatus,
  SimulatorStatusSnapshot,
  TagSnapshot,
  TagValuesListener,
  UpdateRecipeRequest,
  UpdateUserRoleRequest,
  UserDto,
  UserListResult,
  Unsubscribe
} from '../../shared/hmi-api'

export interface HmiApiClient {
  getAppInfo(): Promise<HmiResult<AppInfo>>
  writeLog(entry: LogEntryInput): Promise<HmiResult<void>>
  reportError(error: ErrorReportInput): Promise<HmiResult<void>>
  checkForUpdates(): Promise<HmiResult<void>>
  downloadUpdate(): Promise<HmiResult<void>>
  cancelUpdateDownload(): Promise<HmiResult<void>>
  openUpdateDownloadPage(version?: string): Promise<HmiResult<void>>
  quitAndInstallUpdate(): Promise<HmiResult<void>>
  onUpdateEvent(listener: AppUpdateListener): Unsubscribe
  connectDevice(): Promise<HmiResult<DeviceStatus>>
  disconnectDevice(): Promise<HmiResult<DeviceStatus>>
  getDeviceStatus(): Promise<HmiResult<DeviceStatus>>
  updateDeviceConfig(request: DeviceConfigUpdateRequest): Promise<HmiResult<DeviceStatus>>
  subscribeDeviceState(listener: DeviceStateListener): Unsubscribe
  readDeviceRegisters(request: DeviceReadRequest): Promise<HmiResult<DeviceReadResponse>>
  writeDeviceRegisters(request: DeviceWriteRequest): Promise<HmiResult<DeviceWriteResponse>>
  executeCommand(request: DeviceCommandRequest): Promise<HmiResult<DeviceCommandResult>>
  getCurrentUser(): Promise<HmiResult<CurrentUserSnapshot>>
  createFirstAdmin(request: CreateFirstAdminRequest): Promise<HmiResult<UserDto>>
  login(request: LoginRequest): Promise<HmiResult<CurrentUserSnapshot>>
  logout(): Promise<HmiResult<CurrentUserSnapshot>>
  listUsers(): Promise<HmiResult<UserListResult>>
  createUser(request: CreateUserRequest): Promise<HmiResult<UserDto>>
  updateUserRole(request: UpdateUserRoleRequest): Promise<HmiResult<UserDto>>
  setUserEnabled(request: SetUserEnabledRequest): Promise<HmiResult<UserDto>>
  listRecipes(): Promise<HmiResult<RecipeListResult>>
  getRecipeParameterDefinitions(): Promise<HmiResult<RecipeParameterDefinition[]>>
  validateRecipe(draft: RecipeDraft): Promise<HmiResult<RecipeValidationResult>>
  createRecipe(draft: RecipeDraft): Promise<HmiResult<RecipeDto>>
  updateRecipe(request: UpdateRecipeRequest): Promise<HmiResult<RecipeDto>>
  copyRecipe(recipeId: string): Promise<HmiResult<RecipeDto>>
  deleteRecipe(recipeId: string): Promise<HmiResult<void>>
  downloadRecipe(request: RecipeDownloadRequest): Promise<HmiResult<RecipeDownloadResult>>
  queryAuditLog(query: AuditQuery): Promise<HmiResult<AuditLogResult>>
  getTagSnapshot(): Promise<HmiResult<TagSnapshot>>
  subscribeTagValues(listener: TagValuesListener): Unsubscribe
  getAlarmSnapshot(): Promise<HmiResult<AlarmSnapshot>>
  subscribeAlarms(listener: AlarmListener): Unsubscribe
  acknowledgeAlarm(request: AlarmAcknowledgeRequest): Promise<HmiResult<AlarmOccurrence>>
  queryAlarmHistory(query: AlarmHistoryQuery): Promise<HmiResult<AlarmHistoryResult>>
  getRealtimeTrendSnapshot(request: RealtimeTrendRequest): Promise<HmiResult<RealtimeTrendSnapshot>>
  subscribeRealtimeTrend(request: RealtimeTrendRequest, listener: RealtimeTrendListener): Unsubscribe
  queryHistoricalTrend(query: HistoricalTrendQuery): Promise<HmiResult<HistoricalTrendResult>>
  getSimulatorStatus(): Promise<HmiResult<SimulatorStatusSnapshot>>
  startSimulator(request: SimulatorLifecycleRequest): Promise<HmiResult<SimulatorRuntimeStatus>>
  stopSimulator(request: SimulatorLifecycleRequest): Promise<HmiResult<SimulatorRuntimeStatus>>
  subscribeSimulatorStatus(listener: SimulatorLifecycleListener): Unsubscribe
}

export class AppApplicationService {
  constructor(private readonly apiClient: HmiApiClient) {}

  getAppInfo(): Promise<HmiResult<AppInfo>> {
    return this.apiClient.getAppInfo()
  }

  writeApplicationLog(message: string, context?: LogEntryInput['context']): Promise<HmiResult<void>> {
    return this.apiClient.writeLog({
      category: 'application',
      level: 'info',
      message,
      context,
      source: 'renderer'
    })
  }

  reportError(error: ErrorReportInput): Promise<HmiResult<void>> {
    return this.apiClient.reportError(error)
  }

  checkForUpdates(): Promise<HmiResult<void>> {
    return this.apiClient.checkForUpdates()
  }

  downloadUpdate(): Promise<HmiResult<void>> {
    return this.apiClient.downloadUpdate()
  }

  cancelUpdateDownload(): Promise<HmiResult<void>> {
    return this.apiClient.cancelUpdateDownload()
  }

  openUpdateDownloadPage(version?: string): Promise<HmiResult<void>> {
    return this.apiClient.openUpdateDownloadPage(version)
  }

  quitAndInstallUpdate(): Promise<HmiResult<void>> {
    return this.apiClient.quitAndInstallUpdate()
  }

  onUpdateEvent(listener: AppUpdateListener): Unsubscribe {
    return this.apiClient.onUpdateEvent(listener)
  }

  connectDevice(): Promise<HmiResult<DeviceStatus>> {
    return this.apiClient.connectDevice()
  }

  disconnectDevice(): Promise<HmiResult<DeviceStatus>> {
    return this.apiClient.disconnectDevice()
  }

  getDeviceStatus(): Promise<HmiResult<DeviceStatus>> {
    return this.apiClient.getDeviceStatus()
  }

  updateDeviceConfig(request: DeviceConfigUpdateRequest): Promise<HmiResult<DeviceStatus>> {
    return this.apiClient.updateDeviceConfig(request)
  }

  subscribeDeviceState(listener: DeviceStateListener): Unsubscribe {
    return this.apiClient.subscribeDeviceState(listener)
  }

  readDeviceRegisters(request: DeviceReadRequest): Promise<HmiResult<DeviceReadResponse>> {
    return this.apiClient.readDeviceRegisters(request)
  }

  writeDeviceRegisters(request: DeviceWriteRequest): Promise<HmiResult<DeviceWriteResponse>> {
    return this.apiClient.writeDeviceRegisters(request)
  }

  executeCommand(request: DeviceCommandRequest): Promise<HmiResult<DeviceCommandResult>> {
    return this.apiClient.executeCommand(request)
  }

  getCurrentUser(): Promise<HmiResult<CurrentUserSnapshot>> {
    return this.apiClient.getCurrentUser()
  }

  createFirstAdmin(request: CreateFirstAdminRequest): Promise<HmiResult<UserDto>> {
    return this.apiClient.createFirstAdmin(request)
  }

  login(request: LoginRequest): Promise<HmiResult<CurrentUserSnapshot>> {
    return this.apiClient.login(request)
  }

  logout(): Promise<HmiResult<CurrentUserSnapshot>> {
    return this.apiClient.logout()
  }

  listUsers(): Promise<HmiResult<UserListResult>> {
    return this.apiClient.listUsers()
  }

  createUser(request: CreateUserRequest): Promise<HmiResult<UserDto>> {
    return this.apiClient.createUser(request)
  }

  updateUserRole(request: UpdateUserRoleRequest): Promise<HmiResult<UserDto>> {
    return this.apiClient.updateUserRole(request)
  }

  setUserEnabled(request: SetUserEnabledRequest): Promise<HmiResult<UserDto>> {
    return this.apiClient.setUserEnabled(request)
  }

  listRecipes(): Promise<HmiResult<RecipeListResult>> {
    return this.apiClient.listRecipes()
  }

  getRecipeParameterDefinitions(): Promise<HmiResult<RecipeParameterDefinition[]>> {
    return this.apiClient.getRecipeParameterDefinitions()
  }

  validateRecipe(draft: RecipeDraft): Promise<HmiResult<RecipeValidationResult>> {
    return this.apiClient.validateRecipe(draft)
  }

  createRecipe(draft: RecipeDraft): Promise<HmiResult<RecipeDto>> {
    return this.apiClient.createRecipe(draft)
  }

  updateRecipe(request: UpdateRecipeRequest): Promise<HmiResult<RecipeDto>> {
    return this.apiClient.updateRecipe(request)
  }

  copyRecipe(recipeId: string): Promise<HmiResult<RecipeDto>> {
    return this.apiClient.copyRecipe(recipeId)
  }

  deleteRecipe(recipeId: string): Promise<HmiResult<void>> {
    return this.apiClient.deleteRecipe(recipeId)
  }

  downloadRecipe(request: RecipeDownloadRequest): Promise<HmiResult<RecipeDownloadResult>> {
    return this.apiClient.downloadRecipe(request)
  }

  queryAuditLog(query: AuditQuery): Promise<HmiResult<AuditLogResult>> {
    return this.apiClient.queryAuditLog(query)
  }

  getTagSnapshot(): Promise<HmiResult<TagSnapshot>> {
    return this.apiClient.getTagSnapshot()
  }

  subscribeTagValues(listener: TagValuesListener): Unsubscribe {
    return this.apiClient.subscribeTagValues(listener)
  }

  getAlarmSnapshot(): Promise<HmiResult<AlarmSnapshot>> {
    return this.apiClient.getAlarmSnapshot()
  }

  subscribeAlarms(listener: AlarmListener): Unsubscribe {
    return this.apiClient.subscribeAlarms(listener)
  }

  acknowledgeAlarm(request: AlarmAcknowledgeRequest): Promise<HmiResult<AlarmOccurrence>> {
    return this.apiClient.acknowledgeAlarm(request)
  }

  queryAlarmHistory(query: AlarmHistoryQuery): Promise<HmiResult<AlarmHistoryResult>> {
    return this.apiClient.queryAlarmHistory(query)
  }

  getRealtimeTrendSnapshot(request: RealtimeTrendRequest): Promise<HmiResult<RealtimeTrendSnapshot>> {
    return this.apiClient.getRealtimeTrendSnapshot(request)
  }

  subscribeRealtimeTrend(request: RealtimeTrendRequest, listener: RealtimeTrendListener): Unsubscribe {
    return this.apiClient.subscribeRealtimeTrend(request, listener)
  }

  queryHistoricalTrend(query: HistoricalTrendQuery): Promise<HmiResult<HistoricalTrendResult>> {
    return this.apiClient.queryHistoricalTrend(query)
  }

  getSimulatorStatus(): Promise<HmiResult<SimulatorStatusSnapshot>> {
    return this.apiClient.getSimulatorStatus()
  }

  startSimulator(request: SimulatorLifecycleRequest): Promise<HmiResult<SimulatorRuntimeStatus>> {
    return this.apiClient.startSimulator(request)
  }

  stopSimulator(request: SimulatorLifecycleRequest): Promise<HmiResult<SimulatorRuntimeStatus>> {
    return this.apiClient.stopSimulator(request)
  }

  subscribeSimulatorStatus(listener: SimulatorLifecycleListener): Unsubscribe {
    return this.apiClient.subscribeSimulatorStatus(listener)
  }
}
