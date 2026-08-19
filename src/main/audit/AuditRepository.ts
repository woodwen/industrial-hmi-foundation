import type Database from 'better-sqlite3'

import type { AuditLogResult, AuditQuery, AuditRecord, AuditResult, AuditValue } from '../../shared/audit'

interface AuditRecordRow {
  id: string
  timestamp_ms: number
  user: string
  role: string | null
  action: string
  target: string
  old_value_json: string
  new_value_json: string
  result: AuditResult
  correlation_id: string | null
  duration_ms: number | null
  error_summary: string | null
  metadata_json: string | null
}

export interface AuditRecordInput {
  id: string
  timestamp: string
  user: string
  role?: string
  action: string
  target: string
  oldValue: AuditValue
  newValue: AuditValue
  result: AuditResult
  correlationId?: string
  durationMs?: number
  errorSummary?: string
  metadata?: Record<string, unknown>
}

export interface AuditFinalizeInput {
  id: string
  result: AuditResult
  oldValue?: AuditValue
  newValue?: AuditValue
  durationMs?: number
  errorSummary?: string
  metadata?: Record<string, unknown>
}

export class AuditRepository {
  private readonly insertStatement: Database.Statement
  private readonly updateStatement: Database.Statement

  constructor(private readonly db: Database.Database) {
    this.insertStatement = this.db.prepare(`
      INSERT INTO audit_logs (
        id,
        timestamp_ms,
        user,
        role,
        action,
        target,
        old_value_json,
        new_value_json,
        result,
        correlation_id,
        duration_ms,
        error_summary,
        metadata_json
      ) VALUES (
        @id,
        @timestampMs,
        @user,
        @role,
        @action,
        @target,
        @oldValueJson,
        @newValueJson,
        @result,
        @correlationId,
        @durationMs,
        @errorSummary,
        @metadataJson
      )
    `)

    this.updateStatement = this.db.prepare(`
      UPDATE audit_logs
      SET old_value_json = COALESCE(@oldValueJson, old_value_json),
        new_value_json = COALESCE(@newValueJson, new_value_json),
        result = @result,
        duration_ms = COALESCE(@durationMs, duration_ms),
        error_summary = @errorSummary,
        metadata_json = COALESCE(@metadataJson, metadata_json)
      WHERE id = @id
    `)
  }

  insert(input: AuditRecordInput): AuditRecord {
    this.insertStatement.run(toInsertParams(input))
    return {
      id: input.id,
      timestamp: input.timestamp,
      user: input.user,
      action: input.action,
      target: input.target,
      oldValue: input.oldValue,
      newValue: input.newValue,
      result: input.result,
      correlationId: input.correlationId,
      role: input.role,
      durationMs: input.durationMs,
      errorSummary: input.errorSummary,
      metadata: input.metadata
    }
  }

  finalize(input: AuditFinalizeInput): void {
    const result = this.updateStatement.run({
      id: input.id,
      oldValueJson: input.oldValue === undefined ? null : stringifyAuditValue(input.oldValue),
      newValueJson: input.newValue === undefined ? null : stringifyAuditValue(input.newValue),
      result: input.result,
      durationMs: input.durationMs ?? null,
      errorSummary: input.errorSummary ?? null,
      metadataJson: input.metadata === undefined ? null : JSON.stringify(input.metadata)
    })

    if (result.changes === 0) {
      throw new Error(`Audit record was not found: ${input.id}`)
    }
  }

  query(query: AuditQuery): AuditLogResult {
    const { where, params } = buildWhere(query)
    const limit = normalizeLimit(query.limit)
    const offset = normalizeOffset(query.offset)
    const rows = this.db.prepare<Record<string, unknown>, AuditRecordRow>(`
      SELECT *
      FROM audit_logs
      ${where}
      ORDER BY timestamp_ms DESC, id DESC
      LIMIT @limit OFFSET @offset
    `).all({
      ...params,
      limit,
      offset
    })

    return {
      rows: rows.map(toAuditRecord),
      emittedAt: new Date().toISOString()
    }
  }
}

function toInsertParams(input: AuditRecordInput): Record<string, string | number | null> {
  return {
    id: input.id,
    timestampMs: toEpochMs(input.timestamp),
    user: input.user,
    role: input.role ?? null,
    action: input.action,
    target: input.target,
    oldValueJson: stringifyAuditValue(input.oldValue),
    newValueJson: stringifyAuditValue(input.newValue),
    result: input.result,
    correlationId: input.correlationId ?? null,
    durationMs: input.durationMs ?? null,
    errorSummary: input.errorSummary ?? null,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null
  }
}

function buildWhere(query: AuditQuery): { where: string; params: Record<string, string | number> } {
  const clauses: string[] = []
  const params: Record<string, string | number> = {}

  if (query.startTime) {
    clauses.push('timestamp_ms >= @startMs')
    params.startMs = toEpochMs(query.startTime)
  }

  if (query.endTime) {
    clauses.push('timestamp_ms <= @endMs')
    params.endMs = toEpochMs(query.endTime)
  }

  if (query.user) {
    clauses.push('user = @user')
    params.user = query.user
  }

  if (query.action) {
    clauses.push('action = @action')
    params.action = query.action
  }

  if (query.target) {
    clauses.push('target = @target')
    params.target = query.target
  }

  if (query.result) {
    clauses.push('result = @result')
    params.result = query.result
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  }
}

function toAuditRecord(row: AuditRecordRow): AuditRecord {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp_ms).toISOString(),
    user: row.user,
    role: row.role ?? undefined,
    action: row.action,
    target: row.target,
    oldValue: parseAuditValue(row.old_value_json),
    newValue: parseAuditValue(row.new_value_json),
    result: row.result,
    correlationId: row.correlation_id ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    errorSummary: row.error_summary ?? undefined,
    metadata: row.metadata_json ? parseRecord(row.metadata_json) : undefined
  }
}

function stringifyAuditValue(value: AuditValue): string {
  return JSON.stringify(value)
}

function parseAuditValue(value: string): AuditValue {
  return JSON.parse(value) as AuditValue
}

function parseRecord(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {}
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return 100
  }

  return Math.max(1, Math.min(500, Math.floor(limit ?? 100)))
}

function normalizeOffset(offset: number | undefined): number {
  if (!Number.isFinite(offset)) {
    return 0
  }

  return Math.max(0, Math.floor(offset ?? 0))
}

function toEpochMs(timestamp: string): number {
  const ms = Date.parse(timestamp)
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid audit timestamp: ${timestamp}`)
  }

  return ms
}
