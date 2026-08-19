import type { AppErrorShape } from './app-error'
import type {
  AlarmAcknowledgeRequest,
  AlarmChangedEvent,
  AlarmHistoryQuery,
  AlarmHistoryResult,
  AlarmOccurrence,
  AlarmSnapshot
} from './alarm'
import type { ModbusEngineeringValue, ModbusPointId, ModbusRawValue, ModbusRegisterArea } from './modbus'
import type { TagSnapshot, TagValuesChangedEvent } from './tag'
import type {
  HistoricalTrendQuery,
  HistoricalTrendResult,
  RealtimeTrendChangedEvent,
  RealtimeTrendRequest,
  RealtimeTrendSnapshot
} from './trend'
import type {
  CreateFirstAdminRequest,
  CreateUserRequest,
  CurrentUserSnapshot,
  LoginRequest,
  SetUserEnabledRequest,
  UpdateUserRoleRequest,
  UserDto,
  UserListResult
} from './security'
import type {
  RecipeDownloadRequest,
  RecipeDownloadResult,
  RecipeDraft,
  RecipeDto,
  RecipeListResult,
  RecipeParameterDefinition,
  RecipeValidationResult,
  UpdateRecipeRequest
} from './recipe'
import type {
  AuditLogResult,
  AuditQuery
} from './audit'

export type { TagSnapshot, TagValuesChangedEvent } from './tag'
export type {
  AlarmAcknowledgeRequest,
  AlarmChangedEvent,
  AlarmHistoryQuery,
  AlarmHistoryResult,
  AlarmOccurrence,
  AlarmSnapshot
} from './alarm'
export type {
  HistoricalTrendQuery,
  HistoricalTrendResult,
  RealtimeTrendChangedEvent,
  RealtimeTrendRequest,
  RealtimeTrendSnapshot
} from './trend'
export type {
  CreateFirstAdminRequest,
  CreateUserRequest,
  CurrentUserSnapshot,
  LoginRequest,
  Permission,
  SetUserEnabledRequest,
  UpdateUserRoleRequest,
  UserDto,
  UserListResult,
  UserRole
} from './security'
export type {
  RecipeDownloadRequest,
  RecipeDownloadResult,
  RecipeDraft,
  RecipeDto,
  RecipeListResult,
  RecipeParameterDefinition,
  RecipeValidationResult,
  UpdateRecipeRequest
} from './recipe'
export type {
  AuditLogResult,
  AuditQuery,
  AuditRecord,
  AuditResult
} from './audit'

export type LogCategory = 'application' | 'communication' | 'error'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface AppInfo {
  name: string
  version: string
  environment: 'development' | 'production' | 'test'
}

export interface LogEntryInput {
  category: LogCategory
  level: LogLevel
  message: string
  context?: Record<string, string | number | boolean | null>
  source?: string
}

export interface ErrorReportInput extends AppErrorShape {
  componentStack?: string
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'manual-download'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'cancelled'
  | 'error'

export type UpdateErrorReason =
  | 'development-download'
  | 'incomplete-package'
  | 'network'
  | 'unknown'

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface AppUpdateState {
  status: UpdateStatus
  version?: string
  message?: string
  progress?: UpdateProgress
}

export type DeviceConnectionStatus =
  | 'Disconnected'
  | 'Connecting'
  | 'Connected'
  | 'Reconnecting'
  | 'Fault'

export const DEFAULT_OPCUA_SIMULATOR_ENDPOINT_URL = 'opc.tcp://127.0.0.1:4840/industrial-hmi-simulator'
export type DeviceProtocolKind = 'modbusTcp' | 'opcUa'

export interface DeviceEndpoint {
  host?: string
  port?: number
  unitId?: number
  endpointUrl?: string
}

export interface ModbusTcpDeviceConnectionInput {
  protocol: 'modbusTcp'
  host: string
  port: number
  unitId: number
}

export interface OpcUaDeviceConnectionInput {
  protocol: 'opcUa'
  endpointUrl: string
}

export type DeviceConnectionInput = ModbusTcpDeviceConnectionInput | OpcUaDeviceConnectionInput

export interface DeviceConfigUpdateRequest {
  deviceId: string
  connection: DeviceConnectionInput
}

export interface DeviceStatus {
  deviceId: string
  name: string
  protocol: DeviceProtocolKind
  connectionStatus: DeviceConnectionStatus
  endpoint: DeviceEndpoint
  lastTransitionAt?: string
  transitionReason?: string
  lastSuccessfulAt?: string
  lastError?: AppErrorShape
}

export interface DeviceStateChangedEvent extends DeviceStatus {
  emittedAt: string
}

export interface DeviceReadRequest {
  pointIds: ModbusPointId[]
}

export interface DevicePointValue {
  pointId: ModbusPointId
  area: ModbusRegisterArea
  referenceAddress: string
  pduAddress: number
  value: ModbusEngineeringValue
  rawValues: ModbusRawValue[]
  formattedValue: string
  unit: string
  writable: boolean
  timestamp: string
}

export interface DeviceReadResponse {
  deviceId: string
  values: DevicePointValue[]
  timestamp: string
}

export interface DeviceWriteRequest {
  pointId: ModbusPointId
  value: ModbusEngineeringValue
}

export interface DeviceWriteResponse {
  deviceId: string
  point: DevicePointValue
  timestamp: string
}

export type DeviceCommandId =
  | 'start'
  | 'stop'
  | 'motorStart'
  | 'motorStop'
  | 'setInletValve'
  | 'setOutletValve'
  | 'setTargetTemperature'
  | 'setRpmSetpoint'

export type CommandStatus = 'succeeded' | 'rejected' | 'busy' | 'timeout' | 'failed'
export type CommandVerificationStatus = 'notRequired' | 'verified' | 'failed' | 'timeout'

export interface DeviceCommandRequest {
  commandId: DeviceCommandId
  value?: ModbusEngineeringValue
}

export interface DeviceCommandResult {
  commandId: DeviceCommandId
  deviceId: string
  targetPointId: ModbusPointId
  status: CommandStatus
  writeAccepted: boolean
  verificationStatus: CommandVerificationStatus
  durationMs: number
  message: string
  point?: DevicePointValue
  error?: AppErrorShape
  auditStatus?: 'notRequired' | 'pending' | 'finalized' | 'failed'
  authorizationStatus?: 'authorized' | 'rejected'
  timestamp: string
}

export type AppUpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'manual-download'; version?: string }
  | { type: 'not-available'; version?: string; development?: boolean }
  | { type: 'progress'; progress: UpdateProgress }
  | { type: 'downloaded'; version: string }
  | { type: 'cancelled' }
  | { type: 'error'; reason: UpdateErrorReason; message: string }

export type AppUpdateListener = (event: AppUpdateEvent) => void
export type DeviceStateListener = (event: DeviceStateChangedEvent) => void
export type TagValuesListener = (event: TagValuesChangedEvent) => void
export type AlarmListener = (event: AlarmChangedEvent) => void
export type RealtimeTrendListener = (event: RealtimeTrendChangedEvent) => void
export type Unsubscribe = () => void

export type HmiResult<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: AppErrorShape
    }

export interface HmiApi {
  app: {
    getInfo(): Promise<HmiResult<AppInfo>>
  }
  log: {
    write(entry: LogEntryInput): Promise<HmiResult<void>>
  }
  errors: {
    report(error: ErrorReportInput): Promise<HmiResult<void>>
  }
  updates: {
    checkForUpdates(): Promise<HmiResult<void>>
    downloadUpdate(): Promise<HmiResult<void>>
    cancelUpdateDownload(): Promise<HmiResult<void>>
    openUpdateDownloadPage(version?: string): Promise<HmiResult<void>>
    quitAndInstallUpdate(): Promise<HmiResult<void>>
    onUpdateEvent(listener: AppUpdateListener): Unsubscribe
  }
  devices: {
    connect(): Promise<HmiResult<DeviceStatus>>
    disconnect(): Promise<HmiResult<DeviceStatus>>
    getStatus(): Promise<HmiResult<DeviceStatus>>
    updateConfig(request: DeviceConfigUpdateRequest): Promise<HmiResult<DeviceStatus>>
    subscribeState(listener: DeviceStateListener): Unsubscribe
    readRegisters(request: DeviceReadRequest): Promise<HmiResult<DeviceReadResponse>>
    writeRegisters(request: DeviceWriteRequest): Promise<HmiResult<DeviceWriteResponse>>
  }
  commands: {
    execute(request: DeviceCommandRequest): Promise<HmiResult<DeviceCommandResult>>
  }
  auth: {
    getCurrentUser(): Promise<HmiResult<CurrentUserSnapshot>>
    createFirstAdmin(request: CreateFirstAdminRequest): Promise<HmiResult<UserDto>>
    login(request: LoginRequest): Promise<HmiResult<CurrentUserSnapshot>>
    logout(): Promise<HmiResult<CurrentUserSnapshot>>
    listUsers(): Promise<HmiResult<UserListResult>>
    createUser(request: CreateUserRequest): Promise<HmiResult<UserDto>>
    updateUserRole(request: UpdateUserRoleRequest): Promise<HmiResult<UserDto>>
    setUserEnabled(request: SetUserEnabledRequest): Promise<HmiResult<UserDto>>
  }
  recipes: {
    list(): Promise<HmiResult<RecipeListResult>>
    getParameterDefinitions(): Promise<HmiResult<RecipeParameterDefinition[]>>
    validate(draft: RecipeDraft): Promise<HmiResult<RecipeValidationResult>>
    create(draft: RecipeDraft): Promise<HmiResult<RecipeDto>>
    update(request: UpdateRecipeRequest): Promise<HmiResult<RecipeDto>>
    copy(recipeId: string): Promise<HmiResult<RecipeDto>>
    delete(recipeId: string): Promise<HmiResult<void>>
    download(request: RecipeDownloadRequest): Promise<HmiResult<RecipeDownloadResult>>
  }
  audit: {
    query(query: AuditQuery): Promise<HmiResult<AuditLogResult>>
  }
  tags: {
    getSnapshot(): Promise<HmiResult<TagSnapshot>>
    subscribeValues(listener: TagValuesListener): Unsubscribe
  }
  alarms: {
    getSnapshot(): Promise<HmiResult<AlarmSnapshot>>
    subscribe(listener: AlarmListener): Unsubscribe
    acknowledge(request: AlarmAcknowledgeRequest): Promise<HmiResult<AlarmOccurrence>>
    queryHistory(query: AlarmHistoryQuery): Promise<HmiResult<AlarmHistoryResult>>
  }
  trends: {
    getRealtimeSnapshot(request: RealtimeTrendRequest): Promise<HmiResult<RealtimeTrendSnapshot>>
    subscribeRealtime(request: RealtimeTrendRequest, listener: RealtimeTrendListener): Unsubscribe
    queryHistorical(query: HistoricalTrendQuery): Promise<HmiResult<HistoricalTrendResult>>
  }
}
