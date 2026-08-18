import { makeAutoObservable, runInAction } from 'mobx'

import { toAppError, type AppErrorShape } from '../../shared/app-error'
import type { AlarmHistoryRow, AlarmLevel, AlarmStatus } from '../../shared/alarm'
import type {
  AlarmChangedEvent,
  AlarmHistoryQuery,
  AlarmOccurrence,
  Unsubscribe
} from '../../shared/hmi-api'
import type { AppApplicationService } from '../application/AppApplicationService'

export type AlarmTab = 'realtime' | 'history'
export type AlarmFilterValue<T extends string> = 'all' | T

export class AlarmViewModel {
  activeTab: AlarmTab = 'realtime'
  occurrences: AlarmOccurrence[] = []
  historyRows: AlarmHistoryRow[] = []
  levelFilter: AlarmFilterValue<AlarmLevel> = 'all'
  statusFilter: AlarmFilterValue<Exclude<AlarmStatus, 'Inactive'>> = 'all'
  tagFilter = ''
  acknowledgeUserFilter = ''
  startTime = ''
  endTime = ''
  isInitialized = false
  isLoading = false
  isAcknowledging = false
  isQueryingHistory = false
  error: AppErrorShape | null = null
  private unsubscribe: Unsubscribe | null = null

  constructor(private readonly appService: AppApplicationService) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get realtimeRows(): AlarmOccurrence[] {
    return this.occurrences
  }

  get hasRealtimeRows(): boolean {
    return this.realtimeRows.length > 0
  }

  get hasHistoryRows(): boolean {
    return this.historyRows.length > 0
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || this.isLoading) {
      return
    }

    this.isLoading = true
    try {
      const snapshot = await this.appService.getAlarmSnapshot()
      if (!snapshot.ok) {
        runInAction(() => {
          this.error = snapshot.error
        })
        return
      }

      runInAction(() => {
        this.occurrences = snapshot.data.occurrences
        this.isInitialized = true
        this.error = null
      })

      this.unsubscribe = this.appService.subscribeAlarms(this.applyAlarmEvent)
      await this.queryHistory()
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:alarms-initialize')
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  dispose(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.isInitialized = false
  }

  setActiveTab(tab: AlarmTab): void {
    this.activeTab = tab
  }

  setLevelFilter(value: AlarmFilterValue<AlarmLevel>): void {
    this.levelFilter = value
  }

  setStatusFilter(value: AlarmFilterValue<Exclude<AlarmStatus, 'Inactive'>>): void {
    this.statusFilter = value
  }

  setTagFilter(value: string): void {
    this.tagFilter = value
  }

  setAcknowledgeUserFilter(value: string): void {
    this.acknowledgeUserFilter = value
  }

  setStartTime(value: string): void {
    this.startTime = value
  }

  setEndTime(value: string): void {
    this.endTime = value
  }

  async acknowledge(occurrenceId: string): Promise<void> {
    this.isAcknowledging = true
    this.error = null

    try {
      const result = await this.appService.acknowledgeAlarm({
        occurrenceId
      })
      if (!result.ok) {
        runInAction(() => {
          this.error = result.error
        })
        return
      }

      runInAction(() => {
        this.upsertOccurrence(result.data)
      })
      await this.queryHistory()
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:alarm-acknowledge')
      })
    } finally {
      runInAction(() => {
        this.isAcknowledging = false
      })
    }
  }

  async queryHistory(): Promise<void> {
    this.isQueryingHistory = true
    this.error = null

    try {
      const result = await this.appService.queryAlarmHistory(this.buildHistoryQuery())
      runInAction(() => {
        if (result.ok) {
          this.historyRows = result.data.rows
          this.error = null
          return
        }

        this.error = result.error
      })
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:alarm-history')
      })
    } finally {
      runInAction(() => {
        this.isQueryingHistory = false
      })
    }
  }

  applyAlarmEvent(event: AlarmChangedEvent): void {
    runInAction(() => {
      this.occurrences = event.occurrences
      this.error = null
    })
  }

  private upsertOccurrence(occurrence: AlarmOccurrence): void {
    const index = this.occurrences.findIndex((row) => row.id === occurrence.id)
    if (index >= 0) {
      this.occurrences.splice(index, 1, occurrence)
      return
    }

    this.occurrences.unshift(occurrence)
  }

  private buildHistoryQuery(): AlarmHistoryQuery {
    return {
      level: this.levelFilter === 'all' ? undefined : this.levelFilter,
      status: this.statusFilter === 'all' ? undefined : this.statusFilter,
      tagId: normalizeOptionalFilter(this.tagFilter),
      acknowledgeUser: normalizeOptionalFilter(this.acknowledgeUserFilter),
      startTime: normalizeDateTimeInput(this.startTime),
      endTime: normalizeDateTimeInput(this.endTime),
      limit: 200
    }
  }
}

function normalizeOptionalFilter(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeDateTimeInput(value: string): string | undefined {
  if (!value) {
    return undefined
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}
