import type Database from 'better-sqlite3'

import type {
  AlarmHistoryQuery,
  AlarmHistoryResult,
  AlarmHistoryRow,
  AlarmOccurrence
} from '../../shared/alarm'
import type { AlarmLevel, AlarmStatus } from '../../shared/alarm'
import { decodePersistedValue, encodePersistedValue } from '../historian/value-codec'

interface AlarmHistoryRecord {
  id: string
  definition_id: string
  code: string
  tag_id: string
  level: AlarmLevel
  message: string
  status: Exclude<AlarmStatus, 'Inactive'>
  trigger_time_ms: number
  acknowledge_time_ms: number | null
  recover_time_ms: number | null
  trigger_value_type: string | null
  trigger_value_numeric: number | null
  trigger_value_text: string | null
  trigger_value_bool: number | null
  recover_value_type: string | null
  recover_value_numeric: number | null
  recover_value_text: string | null
  recover_value_bool: number | null
  acknowledge_user: string | null
  condition_active: number
  created_at_ms: number
  updated_at_ms: number
}

export class AlarmHistoryRepository {
  private readonly insertStatement: Database.Statement
  private readonly updateAcknowledgeStatement: Database.Statement
  private readonly updateRecoveryStatement: Database.Statement

  constructor(private readonly db: Database.Database) {
    this.insertStatement = this.db.prepare(`
      INSERT INTO alarm_history (
        id,
        definition_id,
        code,
        tag_id,
        level,
        message,
        status,
        trigger_time_ms,
        acknowledge_time_ms,
        recover_time_ms,
        trigger_value_type,
        trigger_value_numeric,
        trigger_value_text,
        trigger_value_bool,
        recover_value_type,
        recover_value_numeric,
        recover_value_text,
        recover_value_bool,
        acknowledge_user,
        condition_active,
        created_at_ms,
        updated_at_ms
      ) VALUES (
        @id,
        @definitionId,
        @code,
        @tagId,
        @level,
        @message,
        @status,
        @triggerTimeMs,
        @acknowledgeTimeMs,
        @recoverTimeMs,
        @triggerValueType,
        @triggerValueNumeric,
        @triggerValueText,
        @triggerValueBool,
        @recoverValueType,
        @recoverValueNumeric,
        @recoverValueText,
        @recoverValueBool,
        @acknowledgeUser,
        @conditionActive,
        @createdAtMs,
        @updatedAtMs
      )
    `)

    this.updateAcknowledgeStatement = this.db.prepare(`
      UPDATE alarm_history
      SET status = @status,
        acknowledge_time_ms = @acknowledgeTimeMs,
        acknowledge_user = @acknowledgeUser,
        condition_active = @conditionActive,
        updated_at_ms = @updatedAtMs
      WHERE id = @id
    `)

    this.updateRecoveryStatement = this.db.prepare(`
      UPDATE alarm_history
      SET status = @status,
        recover_time_ms = @recoverTimeMs,
        recover_value_type = @recoverValueType,
        recover_value_numeric = @recoverValueNumeric,
        recover_value_text = @recoverValueText,
        recover_value_bool = @recoverValueBool,
        condition_active = @conditionActive,
        updated_at_ms = @updatedAtMs
      WHERE id = @id
    `)
  }

  createOccurrence(occurrence: AlarmOccurrence): void {
    const triggerValue = encodePersistedValue(occurrence.triggerValue)
    const recoverValue = encodePersistedValue(occurrence.recoverValue)
    this.insertStatement.run({
      id: occurrence.id,
      definitionId: occurrence.definitionId,
      code: occurrence.code,
      tagId: occurrence.tagId,
      level: occurrence.level,
      message: occurrence.message,
      status: occurrence.status,
      triggerTimeMs: toEpochMs(occurrence.triggerTime),
      acknowledgeTimeMs: occurrence.acknowledgeTime ? toEpochMs(occurrence.acknowledgeTime) : null,
      recoverTimeMs: occurrence.recoverTime ? toEpochMs(occurrence.recoverTime) : null,
      triggerValueType: triggerValue.valueType,
      triggerValueNumeric: triggerValue.valueNumeric,
      triggerValueText: triggerValue.valueText,
      triggerValueBool: triggerValue.valueBool,
      recoverValueType: occurrence.recoverValue === undefined ? null : recoverValue.valueType,
      recoverValueNumeric: recoverValue.valueNumeric,
      recoverValueText: recoverValue.valueText,
      recoverValueBool: recoverValue.valueBool,
      acknowledgeUser: occurrence.acknowledgeUser ?? null,
      conditionActive: occurrence.conditionActive ? 1 : 0,
      createdAtMs: toEpochMs(occurrence.triggerTime),
      updatedAtMs: toEpochMs(occurrence.updatedAt)
    })
  }

  updateAcknowledge(occurrence: AlarmOccurrence): void {
    this.updateAcknowledgeStatement.run({
      id: occurrence.id,
      status: occurrence.status,
      acknowledgeTimeMs: occurrence.acknowledgeTime ? toEpochMs(occurrence.acknowledgeTime) : null,
      acknowledgeUser: occurrence.acknowledgeUser ?? null,
      conditionActive: occurrence.conditionActive ? 1 : 0,
      updatedAtMs: toEpochMs(occurrence.updatedAt)
    })
  }

  updateRecovery(occurrence: AlarmOccurrence): void {
    const recoverValue = encodePersistedValue(occurrence.recoverValue)
    this.updateRecoveryStatement.run({
      id: occurrence.id,
      status: occurrence.status,
      recoverTimeMs: occurrence.recoverTime ? toEpochMs(occurrence.recoverTime) : null,
      recoverValueType: occurrence.recoverValue === undefined ? null : recoverValue.valueType,
      recoverValueNumeric: recoverValue.valueNumeric,
      recoverValueText: recoverValue.valueText,
      recoverValueBool: recoverValue.valueBool,
      conditionActive: occurrence.conditionActive ? 1 : 0,
      updatedAtMs: toEpochMs(occurrence.updatedAt)
    })
  }

  queryHistory(query: AlarmHistoryQuery): AlarmHistoryResult {
    const { where, params } = buildQueryWhere(query)
    const limit = normalizeLimit(query.limit)
    const rows = this.db
      .prepare<Record<string, unknown>, AlarmHistoryRecord>(`
        SELECT *
        FROM alarm_history
        ${where}
        ORDER BY trigger_time_ms DESC
        LIMIT @limit
      `)
      .all({
        ...params,
        limit
      })

    return {
      rows: rows.map(toAlarmHistoryRow),
      emittedAt: new Date().toISOString()
    }
  }
}

function buildQueryWhere(query: AlarmHistoryQuery): { where: string; params: Record<string, string | number> } {
  const clauses: string[] = []
  const params: Record<string, string | number> = {}

  if (query.level) {
    clauses.push('level = @level')
    params.level = query.level
  }

  if (query.status) {
    clauses.push('status = @status')
    params.status = query.status
  }

  if (query.tagId) {
    clauses.push('tag_id = @tagId')
    params.tagId = query.tagId
  }

  if (query.acknowledgeUser) {
    clauses.push('acknowledge_user = @acknowledgeUser')
    params.acknowledgeUser = query.acknowledgeUser
  }

  if (query.startTime) {
    clauses.push('trigger_time_ms >= @startMs')
    params.startMs = toEpochMs(query.startTime)
  }

  if (query.endTime) {
    clauses.push('trigger_time_ms <= @endMs')
    params.endMs = toEpochMs(query.endTime)
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  }
}

function toAlarmHistoryRow(row: AlarmHistoryRecord): AlarmHistoryRow {
  return {
    id: row.id,
    definitionId: row.definition_id,
    code: row.code,
    tagId: row.tag_id,
    level: row.level,
    message: row.message,
    status: row.status,
    triggerTime: new Date(row.trigger_time_ms).toISOString(),
    acknowledgeTime: row.acknowledge_time_ms === null ? undefined : new Date(row.acknowledge_time_ms).toISOString(),
    recoverTime: row.recover_time_ms === null ? undefined : new Date(row.recover_time_ms).toISOString(),
    triggerValue: decodePersistedValue(
      row.trigger_value_type,
      row.trigger_value_numeric,
      row.trigger_value_text,
      row.trigger_value_bool
    ),
    recoverValue: decodePersistedValue(
      row.recover_value_type,
      row.recover_value_numeric,
      row.recover_value_text,
      row.recover_value_bool
    ),
    acknowledgeUser: row.acknowledge_user ?? undefined,
    conditionActive: row.condition_active === 1,
    createdAt: new Date(row.created_at_ms).toISOString(),
    updatedAt: new Date(row.updated_at_ms).toISOString()
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return 200
  }

  return Math.max(1, Math.min(1000, Math.floor(limit)))
}

function toEpochMs(timestamp: string): number {
  const ms = Date.parse(timestamp)
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid alarm history timestamp: ${timestamp}`)
  }

  return ms
}
