import { randomUUID } from 'node:crypto'

import { createAppError } from '../../shared/app-error'
import type {
  RecipeDraft,
  RecipeDto,
  RecipeListResult,
  RecipeParameterDefinition,
  RecipeParameterKey,
  RecipeParameters,
  RecipeValidationIssue,
  RecipeValidationResult,
  UpdateRecipeRequest
} from '../../shared/recipe'
import { RECIPE_PARAMETER_KEYS } from '../../shared/recipe'
import type { Permission, UserDto } from '../../shared/security'
import type { AuditService } from '../audit'
import type { Logger } from '../logging/logger'
import type { PermissionService, UserService } from '../security'
import { DEFAULT_RECIPE_PARAMETER_DEFINITIONS } from './default-parameters'
import type { RecipeRepository } from './RecipeRepository'

export class RecipeService {
  constructor(
    private readonly repository: RecipeRepository,
    private readonly userService: UserService,
    private readonly permissions: PermissionService,
    private readonly auditService: AuditService,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly logger?: Logger
  ) {}

  listRecipes(): RecipeListResult {
    this.permissions.authorize(this.userService.getCurrentUser(), 'recipe:read', 'recipes')
    return {
      recipes: this.repository.listActive(),
      emittedAt: this.now()
    }
  }

  getParameterDefinitions(): RecipeParameterDefinition[] {
    return DEFAULT_RECIPE_PARAMETER_DEFINITIONS.map((definition) => ({ ...definition }))
  }

  validateDraft(draft: RecipeDraft): RecipeValidationResult {
    return validateRecipeDraft(draft)
  }

  createRecipe(draft: RecipeDraft): RecipeDto {
    const user = this.userService.getCurrentUser()
    this.authorizeRecipeOperation(user, 'recipe:write', 'recipes', 'Recipe Create', null, toAuditedRecipeDraft(draft))
    const validation = this.validateDraft(draft)
    if (!validation.valid) {
      throwRecipeValidationError(validation)
    }

    const timestamp = this.now()
    const recipe = this.repository.insert({
      id: randomUUID(),
      name: normalizeName(draft.name),
      description: draft.description?.trim() ?? '',
      version: 1,
      parameters: normalizeParameters(draft),
      createdAt: timestamp,
      updatedAt: timestamp
    })
    this.auditService.record({
      user,
      action: 'Recipe Create',
      target: `recipe:${recipe.id}`,
      oldValue: null,
      newValue: recipe,
      result: 'Succeeded'
    })
    return recipe
  }

  updateRecipe(request: UpdateRecipeRequest): RecipeDto {
    const user = this.userService.getCurrentUser()
    this.authorizeRecipeOperation(
      user,
      'recipe:write',
      `recipe:${request.recipeId}`,
      'Recipe Update',
      null,
      {
        recipeId: request.recipeId,
        draft: toAuditedRecipeDraft(request.draft)
      }
    )
    const current = this.requireActiveRecipe(request.recipeId)
    const validation = this.validateDraft(request.draft)
    if (!validation.valid) {
      throwRecipeValidationError(validation)
    }

    const updated = this.repository.update({
      id: current.id,
      name: normalizeName(request.draft.name),
      description: request.draft.description?.trim() ?? '',
      version: current.version + 1,
      parameters: normalizeParameters(request.draft),
      updatedAt: this.now()
    })
    this.auditService.record({
      user,
      action: 'Recipe Update',
      target: `recipe:${updated.id}`,
      oldValue: current,
      newValue: updated,
      result: 'Succeeded'
    })
    return updated
  }

  copyRecipe(recipeId: string): RecipeDto {
    const user = this.userService.getCurrentUser()
    this.authorizeRecipeOperation(user, 'recipe:write', `recipe:${recipeId}`, 'Recipe Copy', null, { recipeId })
    const source = this.requireActiveRecipe(recipeId)
    const timestamp = this.now()
    const copy = this.repository.insert({
      id: randomUUID(),
      name: `${source.name} Copy`,
      description: source.description,
      version: 1,
      parameters: source.parameters,
      createdAt: timestamp,
      updatedAt: timestamp,
      sourceRecipeId: source.id,
      sourceVersion: source.version
    })
    this.auditService.record({
      user,
      action: 'Recipe Copy',
      target: `recipe:${copy.id}`,
      oldValue: source,
      newValue: copy,
      result: 'Succeeded'
    })
    return copy
  }

  deleteRecipe(recipeId: string): void {
    const user = this.userService.getCurrentUser()
    this.authorizeRecipeOperation(user, 'recipe:write', `recipe:${recipeId}`, 'Recipe Delete', null, { recipeId })
    const current = this.requireActiveRecipe(recipeId)
    const deletedAt = this.now()
    this.repository.softDelete(recipeId, deletedAt)
    this.auditService.record({
      user,
      action: 'Recipe Delete',
      target: `recipe:${recipeId}`,
      oldValue: current,
      newValue: { deletedAt },
      result: 'Succeeded'
    })
  }

  requireActiveRecipe(recipeId: string): RecipeDto {
    const recipe = this.repository.findActiveById(recipeId)
    if (!recipe) {
      throw createAppError({
        code: 'RECIPE_NOT_FOUND',
        message: 'Recipe was not found.',
        source: 'main:recipe-service',
        detail: `recipeId=${recipeId}`
      })
    }

    return recipe
  }

  private authorizeRecipeOperation(
    user: UserDto | null,
    permission: Permission,
    target: string,
    action: string,
    oldValue: unknown,
    newValue: unknown
  ): void {
    try {
      this.permissions.authorize(user, permission, target)
    } catch (error) {
      this.recordRejectedAudit(user, action, target, oldValue, newValue, error)
      throw error
    }
  }

  private recordRejectedAudit(
    user: UserDto | null,
    action: string,
    target: string,
    oldValue: unknown,
    newValue: unknown,
    error: unknown
  ): void {
    try {
      this.auditService.record({
        user,
        action,
        target,
        oldValue,
        newValue,
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
        message: 'Failed to audit rejected Recipe operation',
        source: 'main:recipe-service',
        context: {
          action,
          target,
          error: auditError instanceof Error ? auditError.message : String(auditError)
        }
      })
    }
  }
}

export function validateRecipeDraft(draft: RecipeDraft): RecipeValidationResult {
  const issues: RecipeValidationIssue[] = []
  if (!normalizeName(draft.name)) {
    issues.push({
      key: 'name',
      message: 'Recipe name is required.'
    })
  }

  for (const definition of DEFAULT_RECIPE_PARAMETER_DEFINITIONS) {
    const value = draft.parameters[definition.key]
    if (value === undefined || value === null || value === '') {
      issues.push({
        key: definition.key,
        message: `${definition.label} is required.`
      })
      continue
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({
        key: definition.key,
        message: `${definition.label} must be a finite number.`
      })
      continue
    }

    if (value < definition.min || value > definition.max) {
      issues.push({
        key: definition.key,
        message: `${definition.label} must be between ${definition.min} and ${definition.max} ${definition.unit}.`
      })
    }
  }

  return {
    valid: issues.length === 0,
    issues
  }
}

function normalizeParameters(draft: RecipeDraft): RecipeParameters {
  return RECIPE_PARAMETER_KEYS.reduce<RecipeParameters>((parameters, key: RecipeParameterKey) => {
    parameters[key] = Number(draft.parameters[key])
    return parameters
  }, {} as RecipeParameters)
}

function normalizeName(name: string): string {
  return name.trim()
}

function toAuditedRecipeDraft(draft: RecipeDraft): Record<string, unknown> {
  return {
    name: draft.name,
    description: draft.description ?? '',
    parameters: draft.parameters
  }
}

function throwRecipeValidationError(validation: RecipeValidationResult): never {
  throw createAppError({
    code: 'RECIPE_INVALID_PARAMETERS',
    message: 'Recipe parameters are invalid.',
    source: 'main:recipe-service',
    detail: validation.issues.map((issue) => `${issue.key}: ${issue.message}`).join('; ')
  })
}
