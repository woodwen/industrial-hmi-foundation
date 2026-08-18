import type { TagValueData } from './tag'

export const ALARM_CONDITIONS = ['High', 'HighHigh', 'Low', 'LowLow', 'BooleanState'] as const
export const ALARM_LEVELS = ['Info', 'Warning', 'High', 'Critical'] as const
export const ALARM_STATUSES = ['Inactive', 'Active', 'Acknowledged', 'Recovered'] as const

export type AlarmCondition = (typeof ALARM_CONDITIONS)[number]
export type AlarmLevel = (typeof ALARM_LEVELS)[number]
export type AlarmStatus = (typeof ALARM_STATUSES)[number]
export type AlarmValue = number | boolean | string | null

export interface AlarmDefinition {
  id: string
  code: string
  tagId: string
  condition: AlarmCondition
  threshold: number | boolean
  delay: number
  level: AlarmLevel
  message: string
  enabled: boolean
  deadband?: number
  recoveryDelay?: number
}

export interface AlarmOccurrence {
  id: string
  definitionId: string
  code: string
  tagId: string
  level: AlarmLevel
  message: string
  status: Exclude<AlarmStatus, 'Inactive'>
  triggerTime: string
  acknowledgeTime?: string
  recoverTime?: string
  triggerValue: AlarmValue
  recoverValue?: AlarmValue
  acknowledgeUser?: string
  conditionActive: boolean
  updatedAt: string
}

export interface AlarmSnapshot {
  occurrences: AlarmOccurrence[]
  emittedAt: string
}

export type AlarmChangedEvent = AlarmSnapshot

export interface AlarmAcknowledgeRequest {
  occurrenceId: string
  user?: string
}

export interface AlarmHistoryQuery {
  level?: AlarmLevel
  status?: Exclude<AlarmStatus, 'Inactive'>
  tagId?: string
  acknowledgeUser?: string
  startTime?: string
  endTime?: string
  limit?: number
}

export interface AlarmHistoryRow extends AlarmOccurrence {
  createdAt: string
}

export interface AlarmHistoryResult {
  rows: AlarmHistoryRow[]
  emittedAt: string
}

export function isAlarmLevel(value: unknown): value is AlarmLevel {
  return typeof value === 'string' && (ALARM_LEVELS as readonly string[]).includes(value)
}

export function isAlarmStatus(value: unknown): value is AlarmStatus {
  return typeof value === 'string' && (ALARM_STATUSES as readonly string[]).includes(value)
}

export function normalizeAlarmValue(value: TagValueData | boolean | null): AlarmValue {
  return value
}
