import { createAppError } from '../../shared/app-error'
import { isAuditResult, type AuditQuery } from '../../shared/audit'
import { isAlarmLevel, isAlarmStatus, type AlarmHistoryQuery, type AlarmAcknowledgeRequest } from '../../shared/alarm'
import type {
  DeviceCommandId,
  DeviceCommandRequest,
  DeviceConfigUpdateRequest,
  DeviceReadRequest,
  DeviceWriteRequest,
  ErrorReportInput,
  LogCategory,
  LogEntryInput,
  LogLevel
} from '../../shared/hmi-api'
import { isModbusPointId, type ModbusEngineeringValue, type ModbusPointId } from '../../shared/modbus'
import {
  isRecipeParameterKey,
  type RecipeDownloadRequest,
  type RecipeDraft,
  type UpdateRecipeRequest
} from '../../shared/recipe'
import {
  isUserRole,
  type CreateFirstAdminRequest,
  type CreateUserRequest,
  type LoginRequest,
  type SetUserEnabledRequest,
  type UpdateUserRoleRequest
} from '../../shared/security'
import {
  isTrendRangePreset,
  type HistoricalTrendQuery,
  type RealtimeTrendRequest,
  type TrendRangePreset
} from '../../shared/trend'
import { SIMULATOR_KINDS, type SimulatorLifecycleRequest } from '../../shared/simulator'

const LOG_CATEGORIES: readonly LogCategory[] = ['application', 'communication', 'error']
const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error']
const DEVICE_COMMAND_IDS: readonly DeviceCommandId[] = [
  'start',
  'stop',
  'motorStart',
  'motorStop',
  'setInletValve',
  'setOutletValve',
  'setTargetTemperature',
  'setRpmSetpoint'
]
const DEVICE_PROTOCOLS = ['modbusTcp', 'opcUa'] as const

export function parseLogEntryInput(payload: unknown, source: string): LogEntryInput {
  const record = requireRecord(payload, 'Log entry payload must be an object.', source)

  return {
    category: requireOneOf(record.category, LOG_CATEGORIES, 'Log entry category is invalid.', source),
    level: requireOneOf(record.level, LOG_LEVELS, 'Log entry level is invalid.', source),
    message: requireString(record.message, 'Log entry message must be a string.', source),
    context: parseLogContext(record.context, source),
    source: parseOptionalString(record.source, 'Log entry source must be a string.', source)
  }
}

export function parseErrorReportInput(payload: unknown, source: string): ErrorReportInput {
  const record = requireRecord(payload, 'Error report payload must be an object.', source)

  return {
    code: requireString(record.code, 'Error report code must be a string.', source),
    message: requireString(record.message, 'Error report message must be a string.', source),
    detail: parseOptionalString(record.detail, 'Error report detail must be a string.', source),
    source: parseOptionalString(record.source, 'Error report source must be a string.', source),
    cause: parseOptionalString(record.cause, 'Error report cause must be a string.', source),
    componentStack: parseOptionalString(
      record.componentStack,
      'Error report componentStack must be a string.',
      source
    )
  }
}

export function parseOptionalStringPayload(payload: unknown, message: string, source: string): string | undefined {
  return parseOptionalString(payload, message, source)
}

export function parseDeviceReadRequest(payload: unknown, source: string): DeviceReadRequest {
  const record = requireRecord(payload, 'Device read payload must be an object.', source)
  const pointIds = requirePointIdArray(record.pointIds, source)

  return {
    pointIds
  }
}

export function parseDeviceWriteRequest(payload: unknown, source: string): DeviceWriteRequest {
  const record = requireRecord(payload, 'Device write payload must be an object.', source)

  return {
    pointId: requirePointId(record.pointId, source),
    value: requireEngineeringValue(record.value, source)
  }
}

export function parseDeviceCommandRequest(payload: unknown, source: string): DeviceCommandRequest {
  const record = requireRecord(payload, 'Device command payload must be an object.', source)
  const commandId = requireOneOf(record.commandId, DEVICE_COMMAND_IDS, 'Device command id is invalid.', source)
  const value = record.value === undefined
    ? undefined
    : requireEngineeringValue(record.value, source)

  return {
    commandId,
    value
  }
}

export function parseDeviceConfigUpdateRequest(payload: unknown, source: string): DeviceConfigUpdateRequest {
  const record = requireRecord(payload, 'Device configuration payload must be an object.', source)
  const connection = requireRecord(record.connection, 'Device connection configuration must be an object.', source)
  const protocol = requireOneOf(connection.protocol, DEVICE_PROTOCOLS, 'Device protocol is invalid.', source)

  if (protocol === 'opcUa') {
    return {
      deviceId: requireNonEmptyString(record.deviceId, 'Device id is required.', source),
      connection: {
        protocol,
        endpointUrl: requireNonEmptyString(connection.endpointUrl, 'OPC UA endpointUrl is required.', source)
      }
    }
  }

  return {
    deviceId: requireNonEmptyString(record.deviceId, 'Device id is required.', source),
    connection: {
      protocol,
      host: requireNonEmptyString(connection.host, 'Modbus host is required.', source),
      port: requirePositiveInteger(connection.port, 'Modbus port must be a positive integer.', source),
      unitId: requirePositiveInteger(connection.unitId, 'Modbus unitId must be a positive integer.', source)
    }
  }
}

export function parseSimulatorLifecycleRequest(payload: unknown, source: string): SimulatorLifecycleRequest {
  const record = requireRecord(payload, 'Simulator lifecycle payload must be an object.', source)
  if (Object.keys(record).some((key) => key !== 'kind')) {
    throwInvalidPayload('Simulator lifecycle payload contains unsupported fields.', source)
  }

  return {
    kind: requireOneOf(record.kind, SIMULATOR_KINDS, 'Simulator kind is invalid.', source)
  }
}

export function parseLoginRequest(payload: unknown, source: string): LoginRequest {
  const record = requireRecord(payload, 'Login payload must be an object.', source)
  return {
    username: requireNonEmptyString(record.username, 'Username is required.', source),
    password: requireString(record.password, 'Password is required.', source)
  }
}

export function parseCreateFirstAdminRequest(payload: unknown, source: string): CreateFirstAdminRequest {
  const record = requireRecord(payload, 'First Admin payload must be an object.', source)
  return {
    username: requireNonEmptyString(record.username, 'Admin username is required.', source),
    displayName: requireNonEmptyString(record.displayName, 'Admin display name is required.', source),
    password: requireString(record.password, 'Admin password is required.', source)
  }
}

export function parseCreateUserRequest(payload: unknown, source: string): CreateUserRequest {
  const record = requireRecord(payload, 'Create user payload must be an object.', source)
  return {
    username: requireNonEmptyString(record.username, 'Username is required.', source),
    displayName: requireNonEmptyString(record.displayName, 'Display name is required.', source),
    role: requireUserRole(record.role, source),
    password: requireString(record.password, 'Password is required.', source)
  }
}

export function parseUpdateUserRoleRequest(payload: unknown, source: string): UpdateUserRoleRequest {
  const record = requireRecord(payload, 'Update user role payload must be an object.', source)
  return {
    userId: requireNonEmptyString(record.userId, 'User id is required.', source),
    role: requireUserRole(record.role, source)
  }
}

export function parseSetUserEnabledRequest(payload: unknown, source: string): SetUserEnabledRequest {
  const record = requireRecord(payload, 'Set user enabled payload must be an object.', source)
  return {
    userId: requireNonEmptyString(record.userId, 'User id is required.', source),
    enabled: requireBoolean(record.enabled, 'User enabled flag must be a boolean.', source)
  }
}

export function parseRecipeDraft(payload: unknown, source: string): RecipeDraft {
  const record = requireRecord(payload, 'Recipe draft payload must be an object.', source)
  return {
    name: requireString(record.name, 'Recipe name must be a string.', source),
    description: parseOptionalString(record.description, 'Recipe description must be a string.', source),
    parameters: parseRecipeParameters(record.parameters, source)
  }
}

export function parseUpdateRecipeRequest(payload: unknown, source: string): UpdateRecipeRequest {
  const record = requireRecord(payload, 'Update Recipe payload must be an object.', source)
  return {
    recipeId: requireNonEmptyString(record.recipeId, 'Recipe id is required.', source),
    draft: parseRecipeDraft(record.draft, source)
  }
}

export function parseRecipeIdPayload(payload: unknown, source: string): string {
  return requireNonEmptyString(payload, 'Recipe id is required.', source)
}

export function parseRecipeDownloadRequest(payload: unknown, source: string): RecipeDownloadRequest {
  const record = requireRecord(payload, 'Recipe download payload must be an object.', source)
  return {
    recipeId: requireNonEmptyString(record.recipeId, 'Recipe id is required.', source)
  }
}

export function parseAuditQuery(payload: unknown, source: string): AuditQuery {
  const record = requireRecord(payload, 'Audit query payload must be an object.', source)
  return {
    startTime: parseOptionalIsoTime(record.startTime, 'Audit startTime must be an ISO timestamp.', source),
    endTime: parseOptionalIsoTime(record.endTime, 'Audit endTime must be an ISO timestamp.', source),
    user: parseOptionalNonEmptyString(record.user, 'Audit user filter must be a string.', source),
    action: parseOptionalNonEmptyString(record.action, 'Audit action filter must be a string.', source),
    target: parseOptionalNonEmptyString(record.target, 'Audit target filter must be a string.', source),
    result: record.result === undefined || record.result === null
      ? undefined
      : requireAuditResult(record.result, source),
    limit: parseOptionalPositiveInteger(record.limit, 'Audit limit must be a positive integer.', source),
    offset: parseOptionalNonNegativeInteger(record.offset, 'Audit offset must be a non-negative integer.', source)
  }
}

export function parseAlarmAcknowledgeRequest(payload: unknown, source: string): AlarmAcknowledgeRequest {
  const record = requireRecord(payload, 'Alarm acknowledge payload must be an object.', source)

  return {
    occurrenceId: requireNonEmptyString(record.occurrenceId, 'Alarm occurrence id is required.', source),
    user: parseOptionalString(record.user, 'Alarm acknowledge user must be a string.', source)
  }
}

export function parseAlarmHistoryQuery(payload: unknown, source: string): AlarmHistoryQuery {
  const record = requireRecord(payload, 'Alarm history query payload must be an object.', source)
  const status = record.status === undefined || record.status === null
    ? undefined
    : requireAlarmHistoryStatus(record.status, source)

  return {
    level: record.level === undefined || record.level === null
      ? undefined
      : requireAlarmLevel(record.level, source),
    status,
    tagId: parseOptionalNonEmptyString(record.tagId, 'Alarm history tag id must be a string.', source),
    acknowledgeUser: parseOptionalNonEmptyString(
      record.acknowledgeUser,
      'Alarm acknowledge user filter must be a string.',
      source
    ),
    startTime: parseOptionalIsoTime(record.startTime, 'Alarm history startTime must be an ISO timestamp.', source),
    endTime: parseOptionalIsoTime(record.endTime, 'Alarm history endTime must be an ISO timestamp.', source),
    limit: parseOptionalPositiveInteger(record.limit, 'Alarm history limit must be a positive integer.', source)
  }
}

export function parseRealtimeTrendRequest(payload: unknown, source: string): RealtimeTrendRequest {
  const record = requireRecord(payload, 'Realtime trend payload must be an object.', source)
  return {
    tagIds: requireNonEmptyStringArray(record.tagIds, 'Realtime trend tagIds must be a non-empty array.', source)
  }
}

export function parseHistoricalTrendQuery(payload: unknown, source: string): HistoricalTrendQuery {
  const record = requireRecord(payload, 'Historical trend query payload must be an object.', source)
  const preset = requireTrendRangePreset(record.preset, source)
  const startTime = preset === 'custom'
    ? requireIsoTime(record.startTime, 'Custom trend startTime must be an ISO timestamp.', source)
    : parseOptionalIsoTime(record.startTime, 'Trend startTime must be an ISO timestamp.', source)
  const endTime = preset === 'custom'
    ? requireIsoTime(record.endTime, 'Custom trend endTime must be an ISO timestamp.', source)
    : parseOptionalIsoTime(record.endTime, 'Trend endTime must be an ISO timestamp.', source)

  if (preset === 'custom') {
    if (startTime === undefined || endTime === undefined || Date.parse(startTime) > Date.parse(endTime)) {
      throwInvalidPayload('Custom trend startTime must be before or equal to endTime.', source)
    }
  }

  return {
    tagIds: requireNonEmptyStringArray(record.tagIds, 'Historical trend tagIds must be a non-empty array.', source),
    preset,
    startTime,
    endTime,
    maxPointsPerTag: parseOptionalPositiveInteger(
      record.maxPointsPerTag,
      'Trend maxPointsPerTag must be a positive integer.',
      source
    )
  }
}

function requireRecord(payload: unknown, message: string, source: string): Record<string, unknown> {
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    return payload as Record<string, unknown>
  }

  throwInvalidPayload(message, source)
}

function requireString(value: unknown, message: string, source: string): string {
  if (typeof value === 'string') {
    return value
  }

  throwInvalidPayload(message, source)
}

function requireNonEmptyString(value: unknown, message: string, source: string): string {
  const text = requireString(value, message, source).trim()
  if (text.length > 0) {
    return text
  }

  throwInvalidPayload(message, source)
}

function parseOptionalString(value: unknown, message: string, source: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === 'string') {
    return value
  }

  throwInvalidPayload(message, source)
}

function parseOptionalNonEmptyString(value: unknown, message: string, source: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  return requireNonEmptyString(value, message, source)
}

function requireIsoTime(value: unknown, message: string, source: string): string {
  const timestamp = requireString(value, message, source)
  if (Number.isFinite(Date.parse(timestamp))) {
    return timestamp
  }

  throwInvalidPayload(message, source)
}

function parseOptionalIsoTime(value: unknown, message: string, source: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  return requireIsoTime(value, message, source)
}

function parseOptionalPositiveInteger(value: unknown, message: string, source: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  throwInvalidPayload(message, source)
}

function requirePositiveInteger(value: unknown, message: string, source: string): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  throwInvalidPayload(message, source)
}

function parseOptionalNonNegativeInteger(value: unknown, message: string, source: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value
  }

  throwInvalidPayload(message, source)
}

function requireBoolean(value: unknown, message: string, source: string): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  throwInvalidPayload(message, source)
}

function requireOneOf<TAllowed extends string>(
  value: unknown,
  allowedValues: readonly TAllowed[],
  message: string,
  source: string
): TAllowed {
  if (typeof value === 'string' && (allowedValues as readonly string[]).includes(value)) {
    return value as TAllowed
  }

  throwInvalidPayload(message, source)
}

function requirePointId(value: unknown, source: string): ModbusPointId {
  if (isModbusPointId(value)) {
    return value
  }

  throwInvalidPayload('Device point id is invalid.', source)
}

function requirePointIdArray(value: unknown, source: string): ModbusPointId[] {
  if (!Array.isArray(value) || value.length === 0) {
    throwInvalidPayload('Device read pointIds must be a non-empty array.', source)
  }

  const pointIds = value.map((entry) => requirePointId(entry, source))
  return Array.from(new Set(pointIds))
}

function requireNonEmptyStringArray(value: unknown, message: string, source: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throwInvalidPayload(message, source)
  }

  return Array.from(new Set(value.map((entry) => requireNonEmptyString(entry, message, source))))
}

function requireAlarmLevel(value: unknown, source: string) {
  if (isAlarmLevel(value)) {
    return value
  }

  throwInvalidPayload('Alarm level filter is invalid.', source)
}

function requireAlarmHistoryStatus(value: unknown, source: string) {
  if (isAlarmStatus(value) && value !== 'Inactive') {
    return value
  }

  throwInvalidPayload('Alarm status filter is invalid.', source)
}

function requireUserRole(value: unknown, source: string) {
  if (isUserRole(value)) {
    return value
  }

  throwInvalidPayload('User role is invalid.', source)
}

function requireAuditResult(value: unknown, source: string) {
  if (isAuditResult(value)) {
    return value
  }

  throwInvalidPayload('Audit result filter is invalid.', source)
}

function parseRecipeParameters(value: unknown, source: string): RecipeDraft['parameters'] {
  const record = requireRecord(value, 'Recipe parameters must be an object.', source)
  return Object.entries(record).reduce<RecipeDraft['parameters']>((parameters, [key, entry]) => {
    if (!isRecipeParameterKey(key)) {
      throwInvalidPayload(`Recipe parameter key is invalid: ${key}`, source)
    }

    parameters[key] = requireNumber(entry, `Recipe parameter ${key} must be a finite number.`, source)
    return parameters
  }, {})
}

function requireNumber(value: unknown, message: string, source: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  throwInvalidPayload(message, source)
}

function requireTrendRangePreset(value: unknown, source: string): TrendRangePreset {
  if (isTrendRangePreset(value)) {
    return value
  }

  throwInvalidPayload('Trend range preset is invalid.', source)
}

function requireEngineeringValue(value: unknown, source: string): ModbusEngineeringValue {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  throwInvalidPayload('Device write value must be a finite number or boolean.', source)
}

function parseLogContext(value: unknown, source: string): LogEntryInput['context'] {
  if (value === undefined || value === null) {
    return undefined
  }

  const record = requireRecord(value, 'Log entry context must be an object.', source)
  const context: NonNullable<LogEntryInput['context']> = {}

  for (const [key, entry] of Object.entries(record)) {
    if (
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'boolean' ||
      (typeof entry === 'number' && Number.isFinite(entry))
    ) {
      context[key] = entry
      continue
    }

    throwInvalidPayload('Log entry context values must be string, number, boolean, or null.', source)
  }

  return context
}

function throwInvalidPayload(message: string, source: string): never {
  throw createAppError({
    code: 'IPC_INVALID_PAYLOAD',
    message,
    source
  })
}
