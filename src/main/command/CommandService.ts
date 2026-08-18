import { UNKNOWN_ERROR_CODE, toAppError, type AppErrorShape } from '../../shared/app-error'
import type {
  DeviceCommandId,
  DeviceCommandRequest,
  DeviceCommandResult,
  DeviceWriteRequest,
  DeviceWriteResponse
} from '../../shared/hmi-api'
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
import { createDeviceError, DEVICE_ERROR_CODES } from '../protocol/errors'
import type { IProtocolAdapter, ProtocolReadResult } from '../protocol/types'

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
  adapter: IProtocolAdapter
  deviceManager: DeviceManager
  operationGate: DeviceOperationGate
  logger: Logger
  now?: () => number
}

export class CommandService {
  private readonly activeCommandDevices = new Set<string>()

  constructor(private readonly dependencies: CommandServiceDependencies) {}

  executeCommand(request: DeviceCommandRequest): Promise<DeviceCommandResult> {
    const definition = COMMAND_DEFINITIONS[request.commandId]
    return this.executeDefinition(definition, request)
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
    request: DeviceCommandRequest
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

    const validation = this.validateRequest(definition, request)
    if (validation) {
      return this.createResult(request.commandId, 'rejected', false, 'failed', startedAt, {
        targetPointId: definition.targetPointId,
        error: validation
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
    this.activeCommandDevices.add(SIMULATED_MIXER_DEVICE_ID)

    try {
      return await this.dependencies.operationGate.runExclusive(SIMULATED_MIXER_DEVICE_ID, async () => (
        this.executeWithGate(definition, request.commandId, value, startedAt)
      ))
    } catch (error) {
      if (error instanceof DeviceOperationBusyError) {
        return this.createResult(request.commandId, 'busy', false, 'failed', startedAt, {
          targetPointId: definition.targetPointId,
          error: createDeviceError(
            DEVICE_ERROR_CODES.commandBusy,
            'Device protocol operation is busy.',
            'main:command-service',
            `deviceId=${error.deviceId}`
          )
        })
      }

      const appError = toCommandProtocolError(error, 'Device command failed.')
      this.dependencies.deviceManager.handleCommunicationFailure(appError)
      if (isRequestTimeoutError(appError)) {
        return this.createResult(request.commandId, 'timeout', false, 'timeout', startedAt, {
          targetPointId: definition.targetPointId,
          error: createCommandTimeoutError(request.commandId, 'Device command timed out before write acceptance.')
        })
      }

      return this.createResult(request.commandId, 'failed', false, 'failed', startedAt, {
        targetPointId: definition.targetPointId,
        error: appError
      })
    } finally {
      this.activeCommandDevices.delete(SIMULATED_MIXER_DEVICE_ID)
    }
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
      await this.dependencies.adapter.write({
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

  private async verifyCommand(
    definition: CommandDefinition,
    expectedValue: ModbusEngineeringValue,
    startedAt: number
  ): Promise<{ status: 'verified' | 'failed' | 'timeout'; error?: AppErrorShape }> {
    const verificationPoint = getModbusPoint(definition.feedbackPointId ?? definition.targetPointId)
    const deadline = startedAt + definition.timeoutMs

    while (this.now() <= deadline) {
      try {
        const readBack = await this.dependencies.adapter.read({
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
    const readBack: ProtocolReadResult = await this.dependencies.adapter.read({
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
      timestamp: new Date().toISOString()
    }
  }

  private now(): number {
    return this.dependencies.now?.() ?? Date.now()
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
