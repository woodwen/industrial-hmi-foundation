export const AUDIT_RESULTS = [
  'Pending',
  'Succeeded',
  'Rejected',
  'Failed',
  'PartialFailed',
  'TimedOut',
  'Cancelled'
] as const

export type AuditResult = (typeof AUDIT_RESULTS)[number]

export type AuditValue = unknown

export interface AuditRecord {
  id: string
  timestamp: string
  user: string
  action: string
  target: string
  oldValue: AuditValue
  newValue: AuditValue
  result: AuditResult
  correlationId?: string
  role?: string
  durationMs?: number
  errorSummary?: string
  metadata?: Record<string, unknown>
}

export interface AuditQuery {
  startTime?: string
  endTime?: string
  user?: string
  action?: string
  target?: string
  result?: AuditResult
  limit?: number
  offset?: number
}

export interface AuditLogResult {
  rows: AuditRecord[]
  emittedAt: string
}

export function isAuditResult(value: unknown): value is AuditResult {
  return typeof value === 'string' && (AUDIT_RESULTS as readonly string[]).includes(value)
}
