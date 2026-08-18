import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuditRepository, AuditService } from '../../src/main/audit'
import { CommandService } from '../../src/main/command'
import { DeviceManager, DeviceOperationGate } from '../../src/main/device'
import { HistorianDatabase } from '../../src/main/historian'
import type { Logger } from '../../src/main/logging/logger'
import { DEVICE_ERROR_CODES } from '../../src/main/protocol/errors'
import type {
  IProtocolAdapter,
  ProtocolAdapterStatus,
  ProtocolConnectionConfig,
  ProtocolReadRequest,
  ProtocolReadResult,
  ProtocolWriteRequest,
  ProtocolWriteResult
} from '../../src/main/protocol/types'
import { RecipeDownloadService, RecipeRepository, RecipeService } from '../../src/main/recipe'
import { createMainRuntime } from '../../src/main/runtime'
import { PermissionService, UserRepository, UserService } from '../../src/main/security'
import type { AppErrorShape } from '../../src/shared/app-error'
import type { ModbusRawValue } from '../../src/shared/modbus'
import type { RecipeDraft } from '../../src/shared/recipe'
import type { TagValue } from '../../src/shared/tag'

describe('Recipe, local user permission, and audit integration', () => {
  let tempDir: string | null = null

  afterEach(() => {
    vi.useRealTimers()
    if (tempDir) {
      rmSync(tempDir, {
        recursive: true,
        force: true
      })
      tempDir = null
    }
  })

  it('initializes schema idempotently and persists sanitized Audit Log after reopen', () => {
    const databasePath = createDatabasePath()
    const firstDatabase = new HistorianDatabase(databasePath)
    const auditService = new AuditService(new AuditRepository(firstDatabase.db), createLogger(), fixedNow)

    auditService.record({
      user: null,
      action: 'User Create',
      target: 'user:operator',
      oldValue: null,
      newValue: {
        username: 'operator',
        password: 'plain-text',
        credentialHash: 'hash',
        credentialSalt: 'salt'
      },
      result: 'Succeeded'
    })
    firstDatabase.close()

    const reopenedDatabase = new HistorianDatabase(databasePath)
    const reopenedAudit = new AuditService(new AuditRepository(reopenedDatabase.db), createLogger(), fixedNow)

    try {
      const rows = reopenedAudit.query({
        action: 'User Create'
      }).rows

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        user: 'anonymous',
        action: 'User Create',
        target: 'user:operator',
        result: 'Succeeded',
        newValue: {
          username: 'operator',
          password: '[redacted]',
          credentialHash: '[redacted]',
          credentialSalt: '[redacted]'
        }
      })
    } finally {
      reopenedDatabase.close()
    }
  })

  it('enforces role permissions for Recipe and user management', () => {
    const harness = createServiceHarness()
    try {
      harness.userService.createFirstAdmin({
        username: 'admin',
        displayName: 'Admin',
        password: 'secret1'
      })
      const operator = harness.userService.createUser({
        username: 'operator',
        displayName: 'Operator',
        role: 'Operator',
        password: 'secret1'
      })
      harness.userService.createUser({
        username: 'engineer',
        displayName: 'Engineer',
        role: 'Engineer',
        password: 'secret1'
      })

      harness.userService.login({
        username: 'operator',
        password: 'secret1'
      })
      expectThrowsAppError(() => harness.recipeService.createRecipe(validRecipeDraft()), 'SECURITY_FORBIDDEN')
      expect(harness.auditService.query({
        action: 'Recipe Create',
        result: 'Rejected'
      }).rows).toHaveLength(1)

      harness.userService.login({
        username: 'engineer',
        password: 'secret1'
      })
      const created = harness.recipeService.createRecipe(validRecipeDraft())
      const updated = harness.recipeService.updateRecipe({
        recipeId: created.id,
        draft: {
          ...validRecipeDraft(),
          name: 'Updated Recipe'
        }
      })
      expect(updated).toMatchObject({
        name: 'Updated Recipe',
        version: 2
      })

      expectThrowsAppError(() => harness.userService.createUser({
        username: 'blocked',
        displayName: 'Blocked',
        role: 'Operator',
        password: 'secret1'
      }), 'SECURITY_FORBIDDEN')
      expect(harness.auditService.query({
        action: 'User Create',
        result: 'Rejected'
      }).rows).toHaveLength(1)

      harness.userService.login({
        username: 'admin',
        password: 'secret1'
      })
      harness.userService.setUserEnabled({
        userId: operator.id,
        enabled: false
      })
      expectThrowsAppError(() => harness.userService.login({
        username: 'operator',
        password: 'secret1'
      }), 'SECURITY_INVALID_CREDENTIALS')
    } finally {
      harness.dispose()
    }
  })

  it('audits CommandService permission rejection and successful start command', async () => {
    const harness = createServiceHarness()
    try {
      await harness.deviceManager.connectDevice()
      harness.userService.createFirstAdmin({
        username: 'admin',
        displayName: 'Admin',
        password: 'secret1'
      })
      harness.userService.createUser({
        username: 'operator',
        displayName: 'Operator',
        role: 'Operator',
        password: 'secret1'
      })
      harness.userService.login({
        username: 'operator',
        password: 'secret1'
      })

      const rejected = await harness.commandService.executeCommand({
        commandId: 'setTargetTemperature',
        value: 62.5
      })
      expect(rejected).toMatchObject({
        status: 'rejected',
        writeAccepted: false,
        authorizationStatus: 'rejected'
      })
      expect(harness.adapter.writeRequests).toHaveLength(0)
      expect(harness.auditService.query({
        action: 'Setpoint Change',
        result: 'Rejected'
      }).rows[0]).toMatchObject({
        oldValue: {
          source: 'tag-cache',
          tagId: 'targetTemperature',
          value: 60,
          quality: 'Good'
        }
      })

      const started = await harness.commandService.executeCommand({
        commandId: 'start'
      })
      expect(started).toMatchObject({
        status: 'succeeded',
        auditStatus: 'finalized',
        authorizationStatus: 'authorized'
      })
      expect(harness.auditService.query({
        action: 'Start',
        result: 'Succeeded'
      }).rows[0]).toMatchObject({
        oldValue: {
          source: 'tag-cache',
          tagId: 'deviceRunningStatus',
          value: false,
          quality: 'Good'
        }
      })
    } finally {
      harness.dispose()
    }
  })

  it('audits unauthorized Recipe Download before command execution', async () => {
    const harness = createServiceHarness()
    try {
      await harness.deviceManager.connectDevice()
      harness.userService.createFirstAdmin({
        username: 'admin',
        displayName: 'Admin',
        password: 'secret1'
      })
      harness.userService.createUser({
        username: 'operator',
        displayName: 'Operator',
        role: 'Operator',
        password: 'secret1'
      })
      const recipe = harness.recipeService.createRecipe(validRecipeDraft())

      harness.userService.login({
        username: 'operator',
        password: 'secret1'
      })
      await expect(harness.recipeDownloadService.download({
        recipeId: recipe.id
      })).rejects.toMatchObject({
        code: 'SECURITY_FORBIDDEN'
      })

      expect(harness.adapter.writeRequests).toHaveLength(0)
      expect(harness.auditService.query({
        action: 'Recipe Download',
        result: 'Rejected'
      }).rows[0]).toMatchObject({
        user: 'operator',
        target: `recipe:${recipe.id}`,
        newValue: {
          recipeId: recipe.id
        }
      })
    } finally {
      harness.dispose()
    }
  })

  it('rejects invalid Recipe parameters before any device write', async () => {
    const harness = createServiceHarness()
    try {
      await harness.deviceManager.connectDevice()
      harness.userService.createFirstAdmin({
        username: 'admin',
        displayName: 'Admin',
        password: 'secret1'
      })
      harness.userService.createUser({
        username: 'engineer',
        displayName: 'Engineer',
        role: 'Engineer',
        password: 'secret1'
      })
      harness.userService.login({
        username: 'engineer',
        password: 'secret1'
      })

      expectThrowsAppError(() => harness.recipeService.createRecipe({
        ...validRecipeDraft(),
        parameters: {
          ...validRecipeDraft().parameters,
          targetTemperature: 120
        }
      }), 'RECIPE_INVALID_PARAMETERS')
      expect(harness.adapter.writeRequests).toEqual([])

      const invalidPersistedRecipe = harness.recipeRepository.insert({
        id: 'invalid-recipe',
        name: 'Invalid Persisted Recipe',
        description: 'Bypasses service validation for test coverage',
        version: 1,
        parameters: {
          targetTemperature: 120,
          rpmSetpoint: 900,
          mixDuration: 300,
          feedDuration: 120
        },
        createdAt: fixedNow(),
        updatedAt: fixedNow()
      })

      await expect(harness.recipeDownloadService.download({
        recipeId: invalidPersistedRecipe.id
      })).rejects.toMatchObject({
        code: 'RECIPE_INVALID_PARAMETERS'
      })
      expect(harness.adapter.writeRequests).toEqual([])
    } finally {
      harness.dispose()
    }
  })

  it('summarizes partial Recipe Download failure without silent success', async () => {
    const harness = createServiceHarness()
    try {
      await harness.deviceManager.connectDevice()
      harness.userService.createFirstAdmin({
        username: 'admin',
        displayName: 'Admin',
        password: 'secret1'
      })
      harness.userService.createUser({
        username: 'engineer',
        displayName: 'Engineer',
        role: 'Engineer',
        password: 'secret1'
      })
      harness.userService.login({
        username: 'engineer',
        password: 'secret1'
      })
      const recipe = harness.recipeService.createRecipe(validRecipeDraft())
      harness.adapter.failRpmWrite = true

      const result = await harness.recipeDownloadService.download({
        recipeId: recipe.id
      })

      expect(result).toMatchObject({
        status: 'PartialFailed',
        steps: [
          expect.objectContaining({
            parameterKey: 'targetTemperature',
            status: 'Verified'
          }),
          expect.objectContaining({
            parameterKey: 'rpmSetpoint',
            status: 'WriteFailed'
          })
        ]
      })
      expect(harness.auditService.query({
        action: 'Recipe Download',
        result: 'PartialFailed'
      }).rows[0]).toMatchObject({
        user: 'engineer',
        target: `recipe:${recipe.id}`
      })
    } finally {
      harness.dispose()
    }
  })

  it('authorizes and audits Alarm Acknowledge through the Main runtime session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(fixedNow()))
    const runtime = createMainRuntime(createLogger())

    try {
      runtime.tagCache.setValues([tagValue('currentTemperature', 81)])
      await vi.advanceTimersByTimeAsync(3000)

      const active = runtime.getAlarmSnapshot().occurrences[0]
      expect(active).toMatchObject({
        code: 'TEMP_HIGH',
        status: 'Active'
      })

      expectThrowsAppError(() => runtime.acknowledgeAlarm({
        occurrenceId: active.id
      }), 'SECURITY_UNAUTHORIZED')
      expect(runtime.getAlarmSnapshot().occurrences[0]).toMatchObject({
        id: active.id,
        status: 'Active'
      })
      expect(runtime.auditService.query({
        action: 'Alarm Acknowledge',
        result: 'Rejected'
      }).rows[0]).toMatchObject({
        oldValue: {
          occurrenceId: active.id,
          status: 'Active'
        }
      })

      runtime.createFirstAdmin({
        username: 'admin',
        displayName: 'Admin',
        password: 'secret1'
      })
      runtime.createUser({
        username: 'operator',
        displayName: 'Operator',
        role: 'Operator',
        password: 'secret1'
      })
      runtime.login({
        username: 'operator',
        password: 'secret1'
      })
      const acknowledged = runtime.acknowledgeAlarm({
        occurrenceId: active.id
      })

      expect(acknowledged).toMatchObject({
        id: active.id,
        status: 'Acknowledged',
        acknowledgeUser: 'operator',
        auditStatus: 'finalized'
      })
      expect(runtime.auditService.query({
        action: 'Alarm Acknowledge',
        result: 'Succeeded'
      }).rows[0]).toMatchObject({
        oldValue: {
          occurrenceId: active.id,
          status: 'Active'
        },
        newValue: {
          occurrenceId: active.id,
          status: 'Acknowledged',
          acknowledgeUser: 'operator'
        }
      })
    } finally {
      runtime.dispose()
    }
  })

  function createDatabasePath(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'industrial-hmi-test-'))
    return join(tempDir, 'historian.sqlite')
  }
})

function createServiceHarness(): {
  adapter: FakeProtocolAdapter
  auditService: AuditService
  commandService: CommandService
  deviceManager: DeviceManager
  recipeDownloadService: RecipeDownloadService
  recipeRepository: RecipeRepository
  recipeService: RecipeService
  userService: UserService
  dispose(): void
} {
  const database = new HistorianDatabase(':memory:')
  const logger = createLogger()
  const adapter = new FakeProtocolAdapter()
  const gate = new DeviceOperationGate()
  const deviceManager = new DeviceManager({
    adapter,
    logger,
    operationGate: gate,
    reconnectBackoffMs: [10000]
  })
  const auditService = new AuditService(new AuditRepository(database.db), logger, fixedNow)
  const permissionService = new PermissionService()
  const userService = new UserService(
    new UserRepository(database.db),
    permissionService,
    auditService,
    fixedNow,
    logger
  )
  const recipeRepository = new RecipeRepository(database.db)
  const commandService = new CommandService({
    adapter,
    deviceManager,
    operationGate: gate,
    logger,
    permissionService,
    auditService,
    currentUserProvider: () => userService.getCurrentUser(),
    auditValueProvider: (pointId) => {
      if (pointId === 'targetTemperature') {
        return auditTagValue('targetTemperature', 60)
      }

      if (pointId === 'deviceRunningStatus') {
        return auditTagValue('deviceRunningStatus', false)
      }

      return undefined
    },
    now: () => Date.parse(fixedNow())
  })
  const recipeService = new RecipeService(
    recipeRepository,
    userService,
    permissionService,
    auditService,
    fixedNow,
    logger
  )
  const recipeDownloadService = new RecipeDownloadService(
    recipeService,
    commandService,
    deviceManager,
    userService,
    permissionService,
    auditService,
    fixedNow,
    logger
  )

  return {
    adapter,
    auditService,
    commandService,
    deviceManager,
    recipeDownloadService,
    recipeRepository,
    recipeService,
    userService,
    dispose: () => {
      commandService.dispose()
      deviceManager.dispose()
      gate.dispose()
      database.close()
    }
  }
}

class FakeProtocolAdapter implements IProtocolAdapter {
  failRpmWrite = false
  writeRequests: ProtocolWriteRequest[] = []
  private readonly coils = new Map<number, boolean>([
    [0, false],
    [1, false],
    [2, false],
    [3, false]
  ])
  private readonly discreteInputs = new Map<number, boolean>([
    [0, false],
    [1, false],
    [2, false],
    [3, false]
  ])
  private readonly holdingRegisters = new Map<number, number>([
    [0, 600],
    [1, 0]
  ])
  private status: ProtocolAdapterStatus = {
    connectionStatus: 'Disconnected'
  }

  async connect(config: ProtocolConnectionConfig): Promise<void> {
    this.status = {
      connectionStatus: 'Connected',
      endpoint: `${config.host}:${config.port}`,
      unitId: config.unitId,
      lastSuccessfulAt: fixedNow()
    }
  }

  async disconnect(): Promise<void> {
    this.status = {
      connectionStatus: 'Disconnected'
    }
  }

  async read(request: ProtocolReadRequest): Promise<ProtocolReadResult> {
    return {
      area: request.area,
      address: request.address,
      quantity: request.quantity,
      values: readValues(request, this.coils, this.discreteInputs, this.holdingRegisters)
    }
  }

  async write(request: ProtocolWriteRequest): Promise<ProtocolWriteResult> {
    this.writeRequests.push(request)
    if (this.failRpmWrite && request.area === 'holdingRegister' && request.address === 1) {
      const error: AppErrorShape = {
        code: DEVICE_ERROR_CODES.protocolError,
        message: 'Simulated RPM write failure.',
        source: 'test'
      }
      throw error
    }

    if (request.area === 'coil') {
      request.values.forEach((value, index) => {
        if (typeof value !== 'boolean') {
          throw new Error('coil write expects boolean')
        }

        const address = request.address + index
        this.coils.set(address, value)
        this.discreteInputs.set(address, value)
      })
    }

    if (request.area === 'holdingRegister') {
      request.values.forEach((value, index) => {
        if (typeof value !== 'number') {
          throw new Error('holding register write expects number')
        }

        this.holdingRegisters.set(request.address + index, value)
      })
    }

    return {
      area: request.area,
      address: request.address,
      quantity: request.values.length
    }
  }

  getStatus(): ProtocolAdapterStatus {
    return this.status
  }
}

function readValues(
  request: ProtocolReadRequest,
  coils: ReadonlyMap<number, boolean>,
  discreteInputs: ReadonlyMap<number, boolean>,
  holdingRegisters: ReadonlyMap<number, number>
): ModbusRawValue[] {
  return Array.from({ length: request.quantity }, (_, index) => {
    const address = request.address + index

    if (request.area === 'coil') {
      return coils.get(address) ?? false
    }

    if (request.area === 'discreteInput') {
      return discreteInputs.get(address) ?? false
    }

    if (request.area === 'holdingRegister') {
      return holdingRegisters.get(address) ?? 0
    }

    return 0
  })
}

function validRecipeDraft(): RecipeDraft {
  return {
    name: 'Standard Mixer Recipe',
    description: 'Simulator recipe',
    parameters: {
      targetTemperature: 60,
      rpmSetpoint: 900,
      mixDuration: 300,
      feedDuration: 120
    }
  }
}

function tagValue(tagId: string, value: TagValue['value']): TagValue {
  return {
    tagId,
    value,
    quality: 'Good',
    timestamp: fixedNow()
  }
}

function auditTagValue(tagId: string, value: TagValue['value']): Record<string, unknown> {
  return {
    source: 'tag-cache',
    tagId,
    value,
    quality: 'Good',
    timestamp: fixedNow()
  }
}

function fixedNow(): string {
  return '2026-08-18T00:00:00.000Z'
}

function createLogger(): Logger {
  return {
    write: vi.fn()
  }
}

function expectThrowsAppError(action: () => void, code: string): void {
  try {
    action()
  } catch (error) {
    expect(error).toMatchObject({
      code
    })
    return
  }

  throw new Error(`Expected AppError ${code}.`)
}
