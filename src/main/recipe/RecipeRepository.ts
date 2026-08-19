import type Database from 'better-sqlite3'

import type { RecipeDto, RecipeParameters } from '../../shared/recipe'

interface RecipeRow {
  id: string
  name: string
  description: string
  version: number
  parameters_json: string
  created_at_ms: number
  updated_at_ms: number
  deleted_at_ms: number | null
  source_recipe_id: string | null
  source_version: number | null
}

export interface RecipeInsertInput {
  id: string
  name: string
  description: string
  version: number
  parameters: RecipeParameters
  createdAt: string
  updatedAt: string
  sourceRecipeId?: string
  sourceVersion?: number
}

export interface RecipeUpdateInput {
  id: string
  name: string
  description: string
  version: number
  parameters: RecipeParameters
  updatedAt: string
}

export class RecipeRepository {
  constructor(private readonly db: Database.Database) {}

  listActive(): RecipeDto[] {
    return this.db.prepare<[], RecipeRow>(`
      SELECT *
      FROM recipes
      WHERE deleted_at_ms IS NULL
      ORDER BY updated_at_ms DESC, name ASC
    `).all().map(toRecipeDto)
  }

  findById(recipeId: string): RecipeDto | null {
    const row = this.db.prepare<[string], RecipeRow>('SELECT * FROM recipes WHERE id = ?').get(recipeId)
    return row ? toRecipeDto(row) : null
  }

  findActiveById(recipeId: string): RecipeDto | null {
    const row = this.db.prepare<[string], RecipeRow>(`
      SELECT *
      FROM recipes
      WHERE id = ?
        AND deleted_at_ms IS NULL
    `).get(recipeId)
    return row ? toRecipeDto(row) : null
  }

  insert(input: RecipeInsertInput): RecipeDto {
    this.db.prepare(`
      INSERT INTO recipes (
        id,
        name,
        description,
        version,
        parameters_json,
        created_at_ms,
        updated_at_ms,
        deleted_at_ms,
        source_recipe_id,
        source_version
      ) VALUES (
        @id,
        @name,
        @description,
        @version,
        @parametersJson,
        @createdAtMs,
        @updatedAtMs,
        NULL,
        @sourceRecipeId,
        @sourceVersion
      )
    `).run({
      id: input.id,
      name: input.name,
      description: input.description,
      version: input.version,
      parametersJson: JSON.stringify(input.parameters),
      createdAtMs: toEpochMs(input.createdAt),
      updatedAtMs: toEpochMs(input.updatedAt),
      sourceRecipeId: input.sourceRecipeId ?? null,
      sourceVersion: input.sourceVersion ?? null
    })

    const created = this.findById(input.id)
    if (!created) {
      throw new Error(`Created Recipe was not found: ${input.id}`)
    }

    return created
  }

  update(input: RecipeUpdateInput): RecipeDto {
    this.db.prepare(`
      UPDATE recipes
      SET name = @name,
        description = @description,
        version = @version,
        parameters_json = @parametersJson,
        updated_at_ms = @updatedAtMs
      WHERE id = @id
        AND deleted_at_ms IS NULL
    `).run({
      id: input.id,
      name: input.name,
      description: input.description,
      version: input.version,
      parametersJson: JSON.stringify(input.parameters),
      updatedAtMs: toEpochMs(input.updatedAt)
    })

    const updated = this.findById(input.id)
    if (!updated) {
      throw new Error(`Updated Recipe was not found: ${input.id}`)
    }

    return updated
  }

  softDelete(recipeId: string, deletedAt: string): void {
    this.db.prepare(`
      UPDATE recipes
      SET deleted_at_ms = @deletedAtMs,
        updated_at_ms = @deletedAtMs
      WHERE id = @recipeId
        AND deleted_at_ms IS NULL
    `).run({
      recipeId,
      deletedAtMs: toEpochMs(deletedAt)
    })
  }
}

function toRecipeDto(row: RecipeRow): RecipeDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.version,
    parameters: JSON.parse(row.parameters_json) as RecipeParameters,
    createdAt: new Date(row.created_at_ms).toISOString(),
    updatedAt: new Date(row.updated_at_ms).toISOString(),
    deletedAt: row.deleted_at_ms === null ? undefined : new Date(row.deleted_at_ms).toISOString(),
    sourceRecipeId: row.source_recipe_id ?? undefined,
    sourceVersion: row.source_version ?? undefined
  }
}

function toEpochMs(timestamp: string): number {
  const ms = Date.parse(timestamp)
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid Recipe timestamp: ${timestamp}`)
  }

  return ms
}
