import { UNKNOWN_ERROR_CODE, createAppError, toAppError, type AppErrorShape } from '../../shared/app-error'
import type { AuditResult } from '../../shared/audit'
import type {
  DeviceCommandId,
  DeviceCommandRequest,
  DeviceCommandResult,
  DeviceWriteRequest,
  DeviceWriteResponse
} from '../../shared/hmi-api'
import type { Permission, UserDto } from '../../shared/security'
import {
  SIMULATED_MIXER_DEVICE_ID,
  decodeModbusPointValue,
  getModbusPoint,
  type ModbusEngineeringValue,
  type ModbusPointDefinition,
  type ModbusPointId
} from '../../shared/modbus'
import type { DeviceManager, DeviceOperationGate } from '../device'
import { DeviceOperationBusyError } from '../device'
import { createPointValue, encodeWritablePoint } from '../device/DeviceManager'
import type { Logger } from '../logging/logger'
import { createProtocolBinding } from '../protocol/bindings'
import { createDeviceError, DEVICE_ERROR_CODES } from '../protocol/errors'
import type { IProtocolAdapter, ProtocolReadResult } from '../protocol/types'
import type { AuditService } from '../audit'
import type { PermissionService } from '../security'

const NORMAL_COMMAND_TIMEOUT_MS = 3000
const FEEDBACK_COMMAND_TIMEOUT_MS = 5000
const VERIFY_RETRY_INTERVAL_MS = 100
const TARGET_TEMPERATURE_TOLERANCE = 0.1

interface CommandDefinition {
  commandId: DeviceCommandId
  targetPointId: ModbusPointId
  timeoutMs: number
  fixedValue?: ModbusEngineeringValue
  feedbackPointId?: ModbusPointId
  tolerance?: number
}

export interface CommandServiceDependencies {
  adapter?: IProtocolAdapter
  adapterProvider?: () => IProtocolAdapter
  deviceManager: DeviceManager
  operationGate: DeviceOperationGate
  logger: Logger
  permissionService?: PermissionService
  auditService?: AuditService
  currentUserProvider?: () => UserDto | null
  auditValueProvider?: (pointId: ModbusPointId) => unknown
  now?: () => number
}

export interface CommandExecutionOptions {
  user?: UserDto | null
  suppressAudit?: boolean
  parentAuditId?: string
}

export class CommandService {
  private readonly activeCommandDevices = new Set<string>()

  constructor(private readonly dependencies: CommandServiceDependencies) {}

  executeCommand(
    request: DeviceCommandRequest,
    options: CommandExecutionOptions = {}
  ): Promise<DeviceCommandResult> {
    const definition = COMMAND_DEFINITIONS[request.commandId]
    return this.executeDefinition(definition, request, options)
  }

  async writeDeviceRegisters(request: DeviceWriteRequest): Promise<DeviceWriteResponse> {
    const commandRequest = mapWriteRequestToCommand(request)
    const result = await this.executeCommand(commandRequest)

    if (result.status === 'succeeded' && result.point) {
      return {
        deviceId: result.deviceId,
        point: result.point,
        timestamp: result.timestamp
      }
    }

    throw result.error ?? createDeviceError(
      DEVICE_ERROR_CODES.commandRejected,
      result.message,
      'main:command-service',
      `commandId=${result.commandId}`
    )
  }

  dispose(): void {
    this.activeCommandDevices.clear()
  }

  private async executeDefinition(
    definition: CommandDefinition | undefined,
    request: DeviceCommandRequest,
    options: CommandExecutionOptions
  ): Promise<DeviceCommandResult> {
    const startedAt = this.now()
    if (!definition) {
      return this.createResult(request.commandId, 'rejected', false, 'failed', startedAt, {
        targetPointId: 'deviceStartCommand',
        error: createDeviceError(
          DEVICE_ERROR_CODES.commandRejected,
          'Device command is not supported.',
          'main:command-service',
          `commandId=${request.commandId}`
        )
      })
    }

    const user = options.user ?? this.dependencies.currentUserProvider?.() ?? null
    const authorization = this.authorizeCommand(definition, request, user)
    if (authorization) {
      this.recordRejectedAudit(definition, request, user, authorization, options)
      return this.createResult(request.commandId, 'rejected', false, 'failed', startedAt, {
        targetPointId: definition.targetPointId,
        error: authorization,
        authorizationStatus: 'rejected'
      })
    }

    const validation = this.validateRequest(definition, request)
    if (validation) {
      this.recordRejectedAudit(definition, request, user, validation, options)
      return this.createResult(request.commandId, 'rejected', false, 'failed', startedAt, {
        targetPointId: definition.targetPointId,
        error: validation,
        authorizationStatus: 'authorized'
      })
    }

    if (this.activeCommandDevices.has(SIMULATED_MIXER_DEVICE_ID)) {
      return this.createResult(request.commandId, 'busy', false, 'failed', startedAt, {
        targetPointId: definition.targetPointId,
        error: createDeviceError(
          DEVICE_ERROR_CODES.commandBusy,
          'Device already has an active command.',
          'main:command-service',
          `deviceId=${SIMULATED_MIXER_DEVICE_ID}`
        )
      })
    }

    const value = this.resolveCommandValue(definition, request)
    const audit = this.createPendingAudit(definition, request, user, value, options, startedAt)
    if (audit.status === 'failed') {
      return this.createResult(request.commandId, 'rejected', false, 'failed', startedAt, {
        targetPointId: definition.targetPointId,
        error: audit.error,
        auditStatus: 'failed',
        authorizationStatus: 'authorized'
      })
    }
    this.activeCommandDevices.add(SIMULATED_MIXER_DEVICE_ID)

    let result: DeviceCommandResult
    try {
      result = await this.dependencies.operationGate.runExclusive(SIMULATED_MIXER_DEVICE_ID, async () => (
        this.executeWithGate(definition, request.commandId, value, startedAt)
      ))
    } catch (error) {
      if (error instanceof DeviceOperationBusyError) {
        result = this.createResult(request.commandId, 'busy', false, 'failed', startedAt, {
          targetPointId: definition.targetPointId,
          error: createDeviceError(
            DEVICE_ERROR_CODES.commandBusy,
            'Device protocol operation is busy.',
            'main:command-service',
            `deviceId=${error.deviceId}`
          ),
          authorizationStatus: 'authorized'
        })
      } else {
        const appError = toCommandProtocolError(error, 'Device command failed.')
        this.dependencies.deviceManager.handleCommunicationFailure(appError)
        if (isRequestTimeoutError(appError)) {
          result = this.createResult(request.commandId, 'timeout', false, 'timeout', startedAt, {
            targetPointId: definition.targetPointId,
            error: createCommandTimeoutError(request.commandId, 'Device command timed out before write acceptance.'),
            authorizationStatus: 'authorized'
          })
        } else {
          result = this.createResult(request.commandId, 'failed', false, 'failed', startedAt, {
            targetPointId: definition.targetPointId,
            error: appError,
            authorizationStatus: 'authorized'
          })
        }
      }
    } finally {
      this.activeCommandDevices.delete(SIMULATED_MIXER_DEVICE_ID)
    }

    return this.finalizeAuditResult(audit.id, result, value)
  }

  private async executeWithGate(
    definition: CommandDefinition,
    commandId: DeviceCommandId,
    value: ModbusEngineeringValue,
    startedAt: number
  ): Promise<DeviceCommandResult> {
    const targetPoint = getModbusPoint(definition.targetPointId)
    const rawValues = encodeWritablePoint(targetPoint, value)

    try {
      await this.getAdapter().write({
        binding: this.createBinding(definition.targetPointId, Math.min(definition.timeoutMs, 2000)),
        area: targetPoint.area,
        address: targetPoint.pduAddress,
        values: rawValues,
        timeoutMs: Math.min(definition.timeoutMs, 2000)
      })
    } catch (error) {
      const appError = toCommandProtocolError(error, 'Device command write failed.')
      this.dependencies.deviceManager.handleCommunicationFailure(appError)
      if (isRequestTimeoutError(appError)) {
        return this.createResult(commandId, 'timeout', false, 'timeout', startedAt, {
          targetPointId: definition.targetPointId,
          error: createCommandTimeoutError(commandId, 'Device command write timed out.')
        })
      }

      return this.createResult(commandId, 'failed', false, 'failed', startedAt, {
        targetPointId: definition.targetPointId,
        error: appError
      })
    }

    const verification = await this.verifyCommand(definition, value, startedAt)
    if (verification.status === 'timeout') {
      return this.createResult(commandId, 'timeout', true, 'timeout', startedAt, {
        targetPointId: definition.targetPointId,
        error: createCommandTimeoutError(commandId, 'Device command verification timed out.')
      })
    }

    if (verification.status === 'failed') {
      return this.createResult(commandId, 'failed', true, 'failed', startedAt, {
        targetPointId: definition.targetPointId,
        error: verification.error
      })
    }

    let point: DeviceCommandResult['point']
    try {
      point = await this.readPoint(targetPoint)
    } catch (error) {
      this.dependencies.deviceManager.handleCommunicationFailure(error)
      const appError = createDeviceError(
        DEVICE_ERROR_CODES.protocolError,
        'Device command read-back refresh failed.',
        'main:command-service',
        error instanceof Error ? error.message : String(error),
        error
      )
      return this.createResult(commandId, 'failed', true, 'failed', startedAt, {
        targetPointId: definition.targetPointId,
        error: appError
      })
    }

    this.dependencies.logger.write({
      category: 'communication',
      level: 'info',
      message: 'Device command verified',
      source: 'main:command-service',
      context: {
        deviceId: SIMULATED_MIXER_DEVICE_ID,
        commandId,
        targetPointId: definition.targetPointId
      }
    })

    return this.createResult(commandId, 'succeeded', true, 'verified', startedAt, {
      targetPointId: definition.targetPointId,
      point
    })
  }

  private authorizeCommand(
    definition: CommandDefinition,
    request: DeviceCommandRequest,
    user: UserDto | null
  ): AppErrorShape | null {
    if (!this.dependencies.permissionService) {
      return null
    }

    const permission = getCommandPermission(request.commandId)
    try {
      this.dependencies.permissionService.authorize(
        user,
        permission,
        `${SIMULATED_MIXER_DEVICE_ID}:${definition.targetPointId}`
      )
      return null
    } catch (error) {
      return toAppError(error, 'main:command-service')
    }
  }

  private recordRejectedAudit(
    definition: CommandDefinition,
    request: DeviceCommandRequest,
    user: UserDto | null,
    error: AppErrorShape,
    options: CommandExecutionOptions
  ): void {
    if (options.suppressAudit || !this.dependencies.auditService) {
      return
    }

    try {
      this.dependencies.auditService.record({
        user,
        action: getCommandAuditAction(request.commandId),
        target: `${SIMULATED_MIXER_DEVICE_ID}:${definition.targetPointId}`,
        oldValue: this.getAuditOldValue(definition),
        newValue: request.value ?? definition.fixedValue ?? null,
        result: 'Rejected',
        correlationId: options.parentAuditId,
        metadata: {
          error: error.message
        }
      })
    } catch (auditError) {
      this.dependencies.logger.write({
        category: 'error',
        level: 'error',
        message: 'Failed to audit rejected command',
        source: 'main:command-service',
        context: {
          commandId: request.commandId,
          error: auditError instanceof Error ? auditError.message : String(auditError)
        }
      })
    }
  }

  private createPendingAudit(
    definition: CommandDefinition,
    request: DeviceCommandRequest,
    user: UserDto | null,
    value: ModbusEngineeringValue,
    options: CommandExecutionOptions,
    startedAt: number
  ): { status: 'notRequired' | 'created'; id?: string } | { status: 'failed'; error: AppErrorShape } {
    if (options.suppressAudit || !this.dependencies.auditService) {
      return { status: 'notRequired' }
    }

    try {
      const record = this.dependencies.auditService.createPending({
        user,
        action: getCommandAuditAction(request.commandId),
        target: `${SIMULATED_MIXER_DEVICE_ID}:${definition.targetPointId}`,
        oldValue: this.getAuditOldValue(definition),
        newValue: value,
        correlationId: options.parentAuditId,
        metadata: {
          commandId: request.commandId,
          startedAt
        }
      })
      return {
        status: 'created',
        id: record.id
      }
    } catch (error) {
      return {
        status: 'failed',
        error: createAppError({
          code: 'AUDIT_WRITE_FAILED',
          message: 'Command audit record could not be created.',
          source: 'main:command-service',
          cause: error
        })
      }
    }
  }

  private getAuditOldValue(definition: CommandDefinition): unknown {
    const auditPointId = definition.feedbackPointId ?? definition.targetPointId
    const value = this.dependencies.auditValueProvider?.(auditPointId)
    if (value !== undefined) {
      return value
    }

    return {
      source: 'main-process',
      pointId: auditPointId,
      value: null,
      quality: 'Uncertain',
      unavailable: true
    }
  }

  private finalizeAuditResult(
    auditId: string | undefined,
    result: DeviceCommandResult,
    value: ModbusEngineeringValue
  ): DeviceCommandResult {
    if (!auditId || !this.dependencies.auditService) {
      return {
        ...result,
        auditStatus: result.auditStatus ?? 'notRequired',
        authorizationStatus: result.authorizationStatus ?? 'authorized'
      }
    }

    const auditResult = this.dependencies.auditService.finalize({
      id: auditId,
      result: toAuditResult(result),
      newValue: {
        requested: value,
        verified: result.point?.value ?? null
      },
      durationMs: result.durationMs,
      errorSummary: result.error?.message,
      metadata: {
        commandId: result.commandId,
        writeAccepted: result.writeAccepted,
        verificationStatus: result.verificationStatus
      }
    })

    return {
      ...result,
      auditStatus: auditResult.ok ? 'finalized' : 'failed',
      authorizationStatus: result.authorizationStatus ?? 'authorized',
      message: auditResult.ok
        ? result.message
        : `${result.message} Audit finalization failed: ${auditResult.errorSummary ?? 'unknown error'}`
    }
  }

  private async verifyCommand(
    definition: CommandDefinition,
    expectedValue: ModbusEngineeringValue,
    startedAt: number
  ): Promise<{ status: 'verified' | 'failed' | 'timeout'; error?: AppErrorShape }> {
    const verificationPoint = getModbusPoint(definition.feedbackPointId ?? definition.targetPointId)
    const deadline = startedAt + definition.timeoutMs

    while (this.now() <= deadline) {
      try {
        const readBack = await this.getAdapter().read({
          binding: this.createBinding(definition.feedbackPointId ?? definition.targetPointId, Math.min(1000, Math.max(1, deadline - this.now()))),
          area: verificationPoint.area,
          address: verificationPoint.pduAddress,
          quantity: verificationPoint.quantity,
          timeoutMs: Math.min(1000, Math.max(1, deadline - this.now()))
        })
        const actual = decodeModbusPointValue(verificationPoint, readBack.values)
        if (matchesExpectedValue(actual, expectedValue, definition.tolerance)) {
          return {
            status: 'verified'
          }
        }
      } catch (error) {
        const appError = toCommandProtocolError(error, 'Device command verification failed.')
        this.dependencies.deviceManager.handleCommunicationFailure(appError)
        if (isRequestTimeoutError(appError)) {
          return {
            status: 'timeout'
          }
        }

        return {
          status: 'failed',
          error: appError
        }
      }

      await delay(VERIFY_RETRY_INTERVAL_MS)
    }

    return {
      status: 'timeout'
    }
  }

  private async readPoint(point: ModbusPointDefinition) {
    const readBack: ProtocolReadResult = await this.getAdapter().read({
      binding: this.createBinding(point.id as ModbusPointId),
      area: point.area,
      address: point.pduAddress,
      quantity: point.quantity
    })
    return createPointValue(point, readBack, new Date().toISOString())
  }

  private validateRequest(definition: CommandDefinition, request: DeviceCommandRequest): AppErrorShape | null {
    const status = this.dependencies.deviceManager.getDeviceStatus()
    if (status.connectionStatus !== 'Connected') {
      return createDeviceError(
        DEVICE_ERROR_CODES.commandRejected,
        'Device is not connected for command execution.',
        'main:command-service',
        `state=${status.connectionStatus}`
      )
    }

    const point = getModbusPoint(definition.targetPointId)
    if (point.access !== 'readWrite') {
      return createDeviceError(
        DEVICE_ERROR_CODES.commandRejected,
        'Target Tag is read-only.',
        'main:command-service',
        `pointId=${point.id}`
      )
    }

    try {
      encodeWritablePoint(point, this.resolveCommandValue(definition, request))
    } catch (error) {
      return createDeviceError(
        DEVICE_ERROR_CODES.commandRejected,
        'Device command value was rejected.',
        'main:command-service',
        error instanceof Error ? error.message : String(error),
        error
      )
    }

    return null
  }

  private resolveCommandValue(
    definition: CommandDefinition,
    request: DeviceCommandRequest
  ): ModbusEngineeringValue {
    if (definition.fixedValue !== undefined) {
      return definition.fixedValue
    }

    if (request.value === undefined) {
      throw createDeviceError(
        DEVICE_ERROR_CODES.commandRejected,
        'Device command value is required.',
        'main:command-service',
        `commandId=${request.commandId}`
      )
    }

    return request.value
  }

  private createResult(
    commandId: DeviceCommandId,
    status: DeviceCommandResult['status'],
    writeAccepted: boolean,
    verificationStatus: DeviceCommandResult['verificationStatus'],
    startedAt: number,
    options: {
      targetPointId: ModbusPointId
      point?: DeviceCommandResult['point']
      error?: AppErrorShape
      auditStatus?: DeviceCommandResult['auditStatus']
      authorizationStatus?: DeviceCommandResult['authorizationStatus']
    }
  ): DeviceCommandResult {
    return {
      commandId,
      deviceId: SIMULATED_MIXER_DEVICE_ID,
      targetPointId: options.targetPointId,
      status,
      writeAccepted,
      verificationStatus,
      durationMs: this.now() - startedAt,
      message: options.error?.message ?? `Command ${commandId} ${status}.`,
      point: options.point,
      error: options.error,
      auditStatus: options.auditStatus,
      authorizationStatus: options.authorizationStatus,
      timestamp: new Date().toISOString()
    }
  }

  private now(): number {
    return this.dependencies.now?.() ?? Date.now()
  }

  private getAdapter(): IProtocolAdapter {
    const adapter = this.dependencies.adapterProvider?.() ?? this.dependencies.adapter
    if (!adapter) {
      throw createDeviceError(
        DEVICE_ERROR_CODES.configurationInvalid,
        'CommandService requires a protocol adapter.',
        'main:command-service'
      )
    }

    return adapter
  }

  private createBinding(pointId: ModbusPointId, samplingIntervalMs = 1000) {
    return createProtocolBinding(
      this.dependencies.deviceManager.getDeviceStatus().protocol,
      pointId,
      samplingIntervalMs
    )
  }
}

const COMMAND_DEFINITIONS: Partial<Record<DeviceCommandId, CommandDefinition>> = {
  start: {
    commandId: 'start',
    targetPointId: 'deviceStartCommand',
    fixedValue: true,
    feedbackPointId: 'deviceRunningStatus',
    timeoutMs: FEEDBACK_COMMAND_TIMEOUT_MS
  },
  stop: {
    commandId: 'stop',
    targetPointId: 'deviceStartCommand',
    fixedValue: false,
    feedbackPointId: 'deviceRunningStatus',
    timeoutMs: FEEDBACK_COMMAND_TIMEOUT_MS
  },
  motorStart: {
    commandId: 'motorStart',
    targetPointId: 'mixerMotorCommand',
    fixedValue: true,
    feedbackPointId: 'mixerMotorRunningStatus',
    timeoutMs: FEEDBACK_COMMAND_TIMEOUT_MS
  },
  motorStop: {
    commandId: 'motorStop',
    targetPointId: 'mixerMotorCommand',
    fixedValue: false,
    feedbackPointId: 'mixerMotorRunningStatus',
    timeoutMs: FEEDBACK_COMMAND_TIMEOUT_MS
  },
  setInletValve: {
    commandId: 'setInletValve',
    targetPointId: 'inletValveCommand',
    feedbackPointId: 'inletValveOpenStatus',
    timeoutMs: FEEDBACK_COMMAND_TIMEOUT_MS
  },
  setOutletValve: {
    commandId: 'setOutletValve',
    targetPointId: 'outletValveCommand',
    feedbackPointId: 'outletValveOpenStatus',
    timeoutMs: FEEDBACK_COMMAND_TIMEOUT_MS
  },
  setTargetTemperature: {
    commandId: 'setTargetTemperature',
    targetPointId: 'targetTemperature',
    tolerance: TARGET_TEMPERATURE_TOLERANCE,
    timeoutMs: NORMAL_COMMAND_TIMEOUT_MS
  },
  setRpmSetpoint: {
    commandId: 'setRpmSetpoint',
    targetPointId: 'manualMotorRpmSetpoint',
    tolerance: 0,
    timeoutMs: NORMAL_COMMAND_TIMEOUT_MS
  }
}

function mapWriteRequestToCommand(request: DeviceWriteRequest): DeviceCommandRequest {
  if (request.pointId === 'targetTemperature') {
    return {
      commandId: 'setTargetTemperature',
      value: request.value
    }
  }

  if (request.pointId === 'manualMotorRpmSetpoint') {
    return {
      commandId: 'setRpmSetpoint',
      value: request.value
    }
  }

  if (request.pointId === 'deviceStartCommand') {
    const value = requireBooleanWriteValue(request)
    return {
      commandId: value ? 'start' : 'stop'
    }
  }

  if (request.pointId === 'mixerMotorCommand') {
    const value = requireBooleanWriteValue(request)
    return {
      commandId: value ? 'motorStart' : 'motorStop'
    }
  }

  if (request.pointId === 'inletValveCommand') {
    const value = requireBooleanWriteValue(request)
    return {
      commandId: 'setInletValve',
      value
    }
  }

  if (request.pointId === 'outletValveCommand') {
    const value = requireBooleanWriteValue(request)
    return {
      commandId: 'setOutletValve',
      value
    }
  }

  throw createDeviceError(
    DEVICE_ERROR_CODES.commandRejected,
    'Device write point is not supported by CommandService.',
    'main:command-service',
    `pointId=${request.pointId}`
  )
}

function requireBooleanWriteValue(request: DeviceWriteRequest): boolean {
  if (typeof request.value === 'boolean') {
    return request.value
  }

  throw createDeviceError(
    DEVICE_ERROR_CODES.commandRejected,
    'Device command value was rejected.',
    'main:command-service',
    `pointId=${request.pointId}: expected boolean value`
  )
}

function matchesExpectedValue(
  actual: ModbusEngineeringValue,
  expected: ModbusEngineeringValue,
  tolerance = 0
): boolean {
  if (typeof actual === 'boolean' || typeof expected === 'boolean') {
    return actual === expected
  }

  return Math.abs(actual - expected) <= tolerance
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function toCommandProtocolError(error: unknown, fallbackMessage: string): AppErrorShape {
  const appError = toAppError(error, 'main:command-service')
  if (appError.code !== UNKNOWN_ERROR_CODE) {
    return appError
  }

  return createDeviceError(
    DEVICE_ERROR_CODES.protocolError,
    fallbackMessage,
    'main:command-service',
    error instanceof Error ? error.message : String(error),
    error
  )
}

function isRequestTimeoutError(error: AppErrorShape): boolean {
  return error.code === DEVICE_ERROR_CODES.requestTimeout
}

function createCommandTimeoutError(commandId: DeviceCommandId, message: string): AppErrorShape {
  return createDeviceError(
    DEVICE_ERROR_CODES.commandTimeout,
    message,
    'main:command-service',
    `commandId=${commandId}`
  )
}

function getCommandPermission(commandId: DeviceCommandId): Permission {
  if (commandId === 'start' || commandId === 'stop') {
    return 'device:start-stop'
  }

  if (commandId === 'setTargetTemperature' || commandId === 'setRpmSetpoint') {
    return 'parameter:write'
  }

  return 'device:advanced-control'
}

function getCommandAuditAction(commandId: DeviceCommandId): string {
  switch (commandId) {
    case 'start':
      return 'Start'
    case 'stop':
      return 'Stop'
    case 'setTargetTemperature':
      return 'Setpoint Change'
    case 'setRpmSetpoint':
      return 'RPM Setpoint Change'
    case 'setInletValve':
      return 'Valve Operation'
    case 'setOutletValve':
      return 'Valve Operation'
    case 'motorStart':
      return 'Motor Start'
    case 'motorStop':
      return 'Motor Stop'
  }
}

function toAuditResult(result: DeviceCommandResult): AuditResult {
  if (result.status === 'succeeded') {
    return 'Succeeded'
  }

  if (result.status === 'timeout') {
    return 'TimedOut'
  }

  if (result.status === 'rejected' || result.status === 'busy') {
    return 'Rejected'
  }

  return 'Failed'
}
