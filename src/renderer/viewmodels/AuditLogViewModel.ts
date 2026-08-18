import { makeAutoObservable, runInAction } from 'mobx'

import { toAppError, type AppErrorShape } from '../../shared/app-error'
import type { AuditQuery, AuditRecord, AuditResult } from '../../shared/audit'
import type { AppApplicationService } from '../application/AppApplicationService'
import type { AuthViewModel } from './AuthViewModel'
import { createPermissionError } from './AuthViewModel'

export type AuditResultFilter = 'all' | AuditResult

export const AUDIT_RESULT_OPTIONS: readonly AuditResult[] = [
  'Pending',
  'Succeeded',
  'Rejected',
  'Failed',
  'PartialFailed',
  'TimedOut',
  'Cancelled'
]

const DEFAULT_LIMIT = 100

export class AuditLogViewModel {
  rows: AuditRecord[] = []
  startTime = ''
  endTime = ''
  userFilter = ''
  actionFilter = ''
  targetFilter = ''
  resultFilter: AuditResultFilter = 'all'
  offset = 0
  limit = DEFAULT_LIMIT
  isQuerying = false
  error: AppErrorShape | null = null

  constructor(
    private readonly appService: AppApplicationService,
    private readonly auth: AuthViewModel
  ) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get canRead(): boolean {
    return this.auth.hasPermission('audit:read')
  }

  get hasRows(): boolean {
    return this.rows.length > 0
  }

  get canPreviousPage(): boolean {
    return this.offset > 0 && !this.isQuerying
  }

  get canNextPage(): boolean {
    return this.rows.length >= this.limit && !this.isQuerying
  }

  async initialize(): Promise<void> {
    if (this.canRead && this.rows.length === 0 && !this.isQuerying) {
      await this.query()
    }
  }

  async query(): Promise<void> {
    if (!this.canRead) {
      this.error = createPermissionError('audit:read')
      return
    }

    this.isQuerying = true
    this.error = null
    try {
      const result = await this.appService.queryAuditLog(this.buildQuery())
      runInAction(() => {
        if (result.ok) {
          this.rows = result.data.rows
          this.error = null
          return
        }

        this.error = result.error
      })
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:audit-query')
      })
    } finally {
      runInAction(() => {
        this.isQuerying = false
      })
    }
  }

  async nextPage(): Promise<void> {
    this.offset += this.limit
    await this.query()
  }

  async previousPage(): Promise<void> {
    this.offset = Math.max(0, this.offset - this.limit)
    await this.query()
  }

  setStartTime(value: string): void {
    this.startTime = value
  }

  setEndTime(value: string): void {
    this.endTime = value
  }

  setUserFilter(value: string): void {
    this.userFilter = value
  }

  setActionFilter(value: string): void {
    this.actionFilter = value
  }

  setTargetFilter(value: string): void {
    this.targetFilter = value
  }

  setResultFilter(value: AuditResultFilter): void {
    this.resultFilter = value
  }

  private buildQuery(): AuditQuery {
    return {
      startTime: normalizeDateTimeInput(this.startTime),
      endTime: normalizeDateTimeInput(this.endTime),
      user: normalizeOptionalFilter(this.userFilter),
      action: normalizeOptionalFilter(this.actionFilter),
      target: normalizeOptionalFilter(this.targetFilter),
      result: this.resultFilter === 'all' ? undefined : this.resultFilter,
      limit: this.limit,
      offset: this.offset
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
