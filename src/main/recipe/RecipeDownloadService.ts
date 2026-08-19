import { randomUUID } from 'node:crypto'

import type { AuditResult } from '../../shared/audit'
import { createAppError } from '../../shared/app-error'
import type { DeviceCommandResult } from '../../shared/hmi-api'
import type { UserDto } from '../../shared/security'
import type {
  RecipeDownloadRequest,
  RecipeDownloadResult,
  RecipeDownloadStatus,
  RecipeDownloadStepResult,
  RecipeParameterKey,
  RecipeParameters
} from '../../shared/recipe'
import type { AuditService } from '../audit'
import type { CommandService } from '../command'
import type { DeviceManager } from '../device'
import type { Logger } from '../logging/logger'
import type { PermissionService, UserService } from '../security'
import { getRecipeParameterDefinition } from './default-parameters'
import { validateRecipeDraft, type RecipeService } from './RecipeService'

const DOWNLOAD_STEP_KEYS: readonly RecipeParameterKey[] = ['targetTemperature', 'rpmSetpoint']

export class RecipeDownloadService {
  constructor(
    private readonly recipeService: RecipeService,
    private readonly commandService: CommandService,
    private readonly deviceManager: DeviceManager,
    private readonly userService: UserService,
    private readonly permissions: PermissionService,
    private readonly auditService: AuditService,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly logger?: Logger
  ) {}

  async download(request: RecipeDownloadRequest): Promise<RecipeDownloadResult> {
    const user = this.userService.getCurrentUser()
    try {
      this.permissions.authorize(user, 'recipe:download', `recipe:${request.recipeId}`)
    } catch (error) {
      this.recordRejectedDownloadAudit(user, request.recipeId, error)
      throw error
    }
    const recipe = this.recipeService.requireActiveRecipe(request.recipeId)
    const validation = validateRecipeDraft(recipe)
    if (!validation.valid) {
      throw createAppError({
        code: 'RECIPE_INVALID_PARAMETERS',
        message: 'Recipe parameters are invalid.',
        source: 'main:recipe-download-service',
        detail: validation.issues.map((issue) => `${issue.key}: ${issue.message}`).join('; ')
      })
    }

    const deviceStatus = this.deviceManager.getDeviceStatus()
    if (deviceStatus.connectionStatus !== 'Connected') {
      const rejected = this.createRejectedResult(recipe.id, recipe.version, 'Device is not connected.')
      this.auditService.record({
        user,
        action: 'Recipe Download',
        target: `recipe:${recipe.id}`,
        oldValue: null,
        newValue: {
          recipeId: recipe.id,
          version: recipe.version
        },
        result: 'Rejected',
        correlationId: rejected.downloadId,
        metadata: {
          reason: 'device-not-connected',
          deviceState: deviceStatus.connectionStatus
        }
      })
      return rejected
    }

    const startedAt = this.now()
    const downloadId = randomUUID()
    const audit = this.auditService.createPending({
      user,
      action: 'Recipe Download',
      target: `recipe:${recipe.id}`,
      oldValue: null,
      newValue: {
        recipeId: recipe.id,
        version: recipe.version,
        parameters: recipe.parameters
      },
      correlationId: downloadId
    })
    const steps: RecipeDownloadStepResult[] = []

    for (const key of DOWNLOAD_STEP_KEYS) {
      const definition = getRecipeParameterDefinition(key)
      if (!definition.commandId) {
        continue
      }

      const commandResult = await this.commandService.executeCommand({
        commandId: definition.commandId,
        value: recipe.parameters[key]
      }, {
        user,
        parentAuditId: audit.id,
        suppressAudit: true
      })
      steps.push(toDownloadStep(key, recipe.parameters[key], commandResult))
      if (commandResult.status !== 'succeeded') {
        break
      }
    }

    const completedAt = this.now()
    const status = summarizeStatus(steps)
    const result: RecipeDownloadResult = {
      downloadId,
      recipeId: recipe.id,
      recipeVersion: recipe.version,
      status,
      message: createDownloadMessage(status),
      steps: appendSkippedSteps(steps, recipe.parameters),
      startedAt,
      completedAt
    }
    const auditFinalize = this.auditService.finalize({
      id: audit.id,
      result: toAuditResult(status),
      newValue: {
        recipeId: recipe.id,
        version: recipe.version,
        steps: result.steps
      },
      durationMs: Date.parse(completedAt) - Date.parse(startedAt),
      metadata: {
        status
      }
    })
    if (!auditFinalize.ok) {
      result.message = `${result.message} Audit finalization failed: ${auditFinalize.errorSummary ?? 'unknown error'}`
    }

    return result
  }

  private recordRejectedDownloadAudit(user: UserDto | null, recipeId: string, error: unknown): void {
    try {
      this.auditService.record({
        user,
        action: 'Recipe Download',
        target: `recipe:${recipeId}`,
        oldValue: null,
        newValue: {
          recipeId
        },
        result: 'Rejected',
        metadata: {
          error: error instanceof Error ? error.message : String(error)
        }
      })
    } catch (auditError) {
      if (!this.logger) {
        throw auditError
      }

      this.logger.write({
        category: 'error',
        level: 'error',
        message: 'Failed to audit rejected Recipe Download',
        source: 'main:recipe-download-service',
        context: {
          recipeId,
          error: auditError instanceof Error ? auditError.message : String(auditError)
        }
      })
    }
  }

  private createRejectedResult(recipeId: string, recipeVersion: number, message: string): RecipeDownloadResult {
    const timestamp = this.now()
    return {
      downloadId: randomUUID(),
      recipeId,
      recipeVersion,
      status: 'Rejected',
      message,
      steps: [],
      startedAt: timestamp,
      completedAt: timestamp
    }
  }
}

function toDownloadStep(
  parameterKey: RecipeParameterKey,
  requestedValue: number,
  result: DeviceCommandResult
): RecipeDownloadStepResult {
  return {
    parameterKey,
    commandId: result.commandId as 'setTargetTemperature' | 'setRpmSetpoint',
    targetPointId: result.targetPointId,
    requestedValue,
    verifiedValue: result.point?.value,
    status: toStepStatus(result),
    message: result.message,
    durationMs: result.durationMs
  }
}

function toStepStatus(result: DeviceCommandResult): RecipeDownloadStepResult['status'] {
  if (result.status === 'succeeded') {
    return 'Verified'
  }

  if (result.status === 'rejected') {
    return 'Rejected'
  }

  if (result.status === 'timeout') {
    return 'TimedOut'
  }

  if (result.writeAccepted && result.verificationStatus === 'failed') {
    return 'VerifyFailed'
  }

  return 'WriteFailed'
}

function appendSkippedSteps(
  steps: RecipeDownloadStepResult[],
  parameters: RecipeParameters
): RecipeDownloadStepResult[] {
  const completed = new Set(steps.map((step) => step.parameterKey))
  const skipped = DOWNLOAD_STEP_KEYS.filter((key) => !completed.has(key)).map((key) => {
    const definition = getRecipeParameterDefinition(key)
    return {
      parameterKey: key,
      commandId: definition.commandId ?? 'setTargetTemperature',
      targetPointId: definition.commandId === 'setRpmSetpoint' ? 'manualMotorRpmSetpoint' : 'targetTemperature',
      requestedValue: parameters[key],
      status: 'Skipped',
      message: 'Step was not executed because a previous step failed.',
      durationMs: 0
    } satisfies RecipeDownloadStepResult
  })

  return [...steps, ...skipped]
}

function summarizeStatus(steps: readonly RecipeDownloadStepResult[]): RecipeDownloadStatus {
  if (steps.length === 0) {
    return 'Rejected'
  }

  if (steps.every((step) => step.status === 'Verified')) {
    return 'Succeeded'
  }

  if (steps.some((step) => step.status === 'Verified')) {
    return 'PartialFailed'
  }

  if (steps.some((step) => step.status === 'TimedOut')) {
    return 'TimedOut'
  }

  return 'Failed'
}

function createDownloadMessage(status: RecipeDownloadStatus): string {
  if (status === 'Succeeded') {
    return 'Recipe download succeeded.'
  }

  if (status === 'PartialFailed') {
    return 'Recipe download partially failed. Device may contain a partial parameter set.'
  }

  return `Recipe download ${status}.`
}

function toAuditResult(status: RecipeDownloadStatus): AuditResult {
  return status === 'Succeeded' ? 'Succeeded' : status
}
