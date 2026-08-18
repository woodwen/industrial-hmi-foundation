import { makeAutoObservable, runInAction } from 'mobx'

import { createAppError, toAppError, type AppErrorShape } from '../../shared/app-error'
import {
  RECIPE_PARAMETER_KEYS,
  type RecipeDownloadResult,
  type RecipeDraft,
  type RecipeDto,
  type RecipeParameterDefinition,
  type RecipeParameterKey,
  type RecipeValidationIssue,
  type RecipeValidationResult
} from '../../shared/recipe'
import type { AppApplicationService } from '../application/AppApplicationService'
import type { AuthViewModel } from './AuthViewModel'
import { createPermissionError } from './AuthViewModel'

type RecipeParameterInputs = Record<RecipeParameterKey, string>

const DEFAULT_RECIPE_INPUTS: RecipeParameterInputs = {
  targetTemperature: '60',
  rpmSetpoint: '900',
  mixDuration: '300',
  feedDuration: '120'
}

export class RecipeViewModel {
  recipes: RecipeDto[] = []
  parameterDefinitions: RecipeParameterDefinition[] = []
  selectedRecipeId: string | null = null
  nameInput = ''
  descriptionInput = ''
  parameterInputs: RecipeParameterInputs = { ...DEFAULT_RECIPE_INPUTS }
  validationResult: RecipeValidationResult | null = null
  downloadResult: RecipeDownloadResult | null = null
  isLoading = false
  isSaving = false
  isDownloading = false
  error: AppErrorShape | null = null

  constructor(
    private readonly appService: AppApplicationService,
    private readonly auth: AuthViewModel
  ) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get selectedRecipe(): RecipeDto | null {
    return this.recipes.find((recipe) => recipe.id === this.selectedRecipeId) ?? null
  }

  get canRead(): boolean {
    return this.auth.hasPermission('recipe:read')
  }

  get canWrite(): boolean {
    return this.auth.hasPermission('recipe:write')
  }

  get canDownload(): boolean {
    return this.auth.hasPermission('recipe:download')
  }

  get canSave(): boolean {
    return this.canWrite && !this.isSaving
  }

  get validationIssues(): readonly RecipeValidationIssue[] {
    return this.validationResult?.issues ?? []
  }

  get hasRecipes(): boolean {
    return this.recipes.length > 0
  }

  async initialize(): Promise<void> {
    if (this.isLoading) {
      return
    }

    this.isLoading = true
    this.error = null
    try {
      const [definitions, recipes] = await Promise.all([
        this.appService.getRecipeParameterDefinitions(),
        this.canRead ? this.appService.listRecipes() : Promise.resolve(null)
      ])

      runInAction(() => {
        if (definitions.ok) {
          this.parameterDefinitions = definitions.data
        } else {
          this.error = definitions.error
        }

        if (recipes?.ok) {
          this.recipes = recipes.data.recipes
          if (!this.selectedRecipeId && this.recipes.length > 0) {
            this.loadRecipe(this.recipes[0].id)
          }
        } else if (recipes && !recipes.ok) {
          this.error = recipes.error
        }
      })
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:recipe-initialize')
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  async refreshRecipes(): Promise<void> {
    if (!this.canRead) {
      this.error = createPermissionError('recipe:read')
      return
    }

    const result = await this.appService.listRecipes()
    runInAction(() => {
      if (result.ok) {
        this.recipes = result.data.recipes
        if (this.selectedRecipeId && !this.recipes.some((recipe) => recipe.id === this.selectedRecipeId)) {
          this.startNewRecipe()
        }
        return
      }

      this.error = result.error
    })
  }

  startNewRecipe(): void {
    this.selectedRecipeId = null
    this.nameInput = ''
    this.descriptionInput = ''
    this.parameterInputs = { ...DEFAULT_RECIPE_INPUTS }
    this.validationResult = null
    this.downloadResult = null
    this.error = null
  }

  loadRecipe(recipeId: string): void {
    const recipe = this.recipes.find((candidate) => candidate.id === recipeId)
    if (!recipe) {
      this.error = createAppError({
        code: 'RECIPE_NOT_FOUND',
        message: 'Recipe was not found in the current list.',
        source: 'renderer:recipe-load',
        detail: `recipeId=${recipeId}`
      })
      return
    }

    this.selectedRecipeId = recipe.id
    this.nameInput = recipe.name
    this.descriptionInput = recipe.description
    this.parameterInputs = {
      targetTemperature: String(recipe.parameters.targetTemperature),
      rpmSetpoint: String(recipe.parameters.rpmSetpoint),
      mixDuration: String(recipe.parameters.mixDuration),
      feedDuration: String(recipe.parameters.feedDuration)
    }
    this.validationResult = null
    this.downloadResult = null
    this.error = null
  }

  async validateCurrentDraft(): Promise<RecipeValidationResult | null> {
    const draft = this.buildDraft()
    if (!draft) {
      return null
    }

    try {
      const result = await this.appService.validateRecipe(draft)
      runInAction(() => {
        if (result.ok) {
          this.validationResult = result.data
          this.error = null
          return
        }

        this.error = result.error
      })
      return result.ok ? result.data : null
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:recipe-validate')
      })
      return null
    }
  }

  async saveRecipe(): Promise<void> {
    if (!this.canWrite) {
      this.error = createPermissionError('recipe:write')
      return
    }

    const draft = this.buildDraft()
    if (!draft) {
      return
    }

    this.isSaving = true
    this.error = null
    try {
      const validation = await this.appService.validateRecipe(draft)
      if (!validation.ok) {
        runInAction(() => {
          this.error = validation.error
        })
        return
      }

      if (!validation.data.valid) {
        runInAction(() => {
          this.validationResult = validation.data
        })
        return
      }

      const saved = this.selectedRecipeId
        ? await this.appService.updateRecipe({ recipeId: this.selectedRecipeId, draft })
        : await this.appService.createRecipe(draft)

      runInAction(() => {
        if (saved.ok) {
          this.validationResult = validation.data
          this.selectedRecipeId = saved.data.id
          this.loadSavedRecipe(saved.data)
          return
        }

        this.error = saved.error
      })
      await this.refreshRecipes()
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:recipe-save')
      })
    } finally {
      runInAction(() => {
        this.isSaving = false
      })
    }
  }

  async copySelectedRecipe(): Promise<void> {
    if (!this.canWrite) {
      this.error = createPermissionError('recipe:write')
      return
    }

    if (!this.selectedRecipeId) {
      this.setSelectionRequiredError('copy')
      return
    }

    const result = await this.appService.copyRecipe(this.selectedRecipeId)
    runInAction(() => {
      if (result.ok) {
        this.loadSavedRecipe(result.data)
        return
      }

      this.error = result.error
    })
    await this.refreshRecipes()
  }

  async deleteSelectedRecipe(): Promise<void> {
    if (!this.canWrite) {
      this.error = createPermissionError('recipe:write')
      return
    }

    if (!this.selectedRecipeId) {
      this.setSelectionRequiredError('delete')
      return
    }

    const recipeId = this.selectedRecipeId
    const result = await this.appService.deleteRecipe(recipeId)
    runInAction(() => {
      if (result.ok) {
        this.startNewRecipe()
        return
      }

      this.error = result.error
    })
    await this.refreshRecipes()
  }

  async downloadSelectedRecipe(): Promise<void> {
    if (!this.canDownload) {
      this.error = createPermissionError('recipe:download')
      return
    }

    if (!this.selectedRecipeId) {
      this.setSelectionRequiredError('download')
      return
    }

    this.isDownloading = true
    this.error = null
    try {
      const result = await this.appService.downloadRecipe({
        recipeId: this.selectedRecipeId
      })
      runInAction(() => {
        if (result.ok) {
          this.downloadResult = result.data
          return
        }

        this.error = result.error
      })
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:recipe-download')
      })
    } finally {
      runInAction(() => {
        this.isDownloading = false
      })
    }
  }

  setNameInput(value: string): void {
    this.nameInput = value
  }

  setDescriptionInput(value: string): void {
    this.descriptionInput = value
  }

  setParameterInput(key: RecipeParameterKey, value: string): void {
    this.parameterInputs[key] = value
  }

  getIssueForKey(key: RecipeParameterKey | 'name'): string | null {
    return this.validationIssues.find((issue) => issue.key === key)?.message ?? null
  }

  private loadSavedRecipe(recipe: RecipeDto): void {
    const existingIndex = this.recipes.findIndex((candidate) => candidate.id === recipe.id)
    if (existingIndex >= 0) {
      this.recipes.splice(existingIndex, 1, recipe)
    } else {
      this.recipes.unshift(recipe)
    }
    this.loadRecipe(recipe.id)
  }

  private buildDraft(): RecipeDraft | null {
    const issues: RecipeValidationIssue[] = []
    const parameters = RECIPE_PARAMETER_KEYS.reduce<RecipeDraft['parameters']>((draftParameters, key) => {
      const value = Number(this.parameterInputs[key])
      if (!Number.isFinite(value)) {
        issues.push({
          key,
          message: `${key} must be a finite number.`
        })
      } else {
        draftParameters[key] = value
      }

      return draftParameters
    }, {})

    if (issues.length > 0) {
      this.validationResult = {
        valid: false,
        issues
      }
      return null
    }

    return {
      name: this.nameInput,
      description: this.descriptionInput,
      parameters
    }
  }

  private setSelectionRequiredError(action: string): void {
    this.error = createAppError({
      code: 'RECIPE_SELECTION_REQUIRED',
      message: 'Please load a Recipe before running this action.',
      source: 'renderer:recipe-selection',
      detail: `action=${action}`
    })
  }
}
