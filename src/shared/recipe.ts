import type { ModbusEngineeringValue } from './modbus'

export const RECIPE_PARAMETER_KEYS = [
  'targetTemperature',
  'rpmSetpoint',
  'mixDuration',
  'feedDuration'
] as const

export type RecipeParameterKey = (typeof RECIPE_PARAMETER_KEYS)[number]

export type RecipeDownloadStatus =
  | 'Succeeded'
  | 'Rejected'
  | 'PartialFailed'
  | 'Failed'
  | 'TimedOut'
  | 'Cancelled'

export type RecipeDownloadStepStatus =
  | 'Skipped'
  | 'Rejected'
  | 'WriteAccepted'
  | 'WriteFailed'
  | 'VerifyFailed'
  | 'Verified'
  | 'TimedOut'

export type RecipeParameterValue = number
export type RecipeParameters = Record<RecipeParameterKey, RecipeParameterValue>

export interface RecipeParameterDefinition {
  key: RecipeParameterKey
  label: string
  unit: string
  dataType: 'number'
  required: boolean
  min: number
  max: number
  commandId?: 'setTargetTemperature' | 'setRpmSetpoint'
}

export interface RecipeDto {
  id: string
  name: string
  description: string
  version: number
  parameters: RecipeParameters
  createdAt: string
  updatedAt: string
  deletedAt?: string
  sourceRecipeId?: string
  sourceVersion?: number
}

export interface RecipeDraft {
  name: string
  description?: string
  parameters: Partial<Record<RecipeParameterKey, unknown>>
}

export interface UpdateRecipeRequest {
  recipeId: string
  draft: RecipeDraft
}

export interface RecipeListResult {
  recipes: RecipeDto[]
  emittedAt: string
}

export interface RecipeValidationIssue {
  key: RecipeParameterKey | 'name'
  message: string
}

export interface RecipeValidationResult {
  valid: boolean
  issues: RecipeValidationIssue[]
}

export interface RecipeDownloadRequest {
  recipeId: string
}

export interface RecipeDownloadStepResult {
  parameterKey: RecipeParameterKey
  commandId: 'setTargetTemperature' | 'setRpmSetpoint'
  targetPointId: string
  requestedValue: ModbusEngineeringValue
  verifiedValue?: ModbusEngineeringValue
  status: RecipeDownloadStepStatus
  message: string
  durationMs: number
}

export interface RecipeDownloadResult {
  downloadId: string
  recipeId: string
  recipeVersion: number
  status: RecipeDownloadStatus
  message: string
  steps: RecipeDownloadStepResult[]
  startedAt: string
  completedAt: string
}

export function isRecipeParameterKey(value: unknown): value is RecipeParameterKey {
  return typeof value === 'string' && (RECIPE_PARAMETER_KEYS as readonly string[]).includes(value)
}
