import { randomUUID } from 'node:crypto'

import type { AuditLogResult, AuditQuery, AuditRecord, AuditResult, AuditValue } from '../../shared/audit'
import type { UserDto } from '../../shared/security'
import type { Logger } from '../logging/logger'
import type { AuditFinalizeInput, AuditRepository } from './AuditRepository'

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'credentialHash',
  'credentialSalt',
  'salt',
  'token'
])

export interface AuditStartInput {
  user: UserDto | null
  action: string
  target: string
  oldValue?: AuditValue
  newValue?: AuditValue
  result?: AuditResult
  correlationId?: string
  metadata?: Record<string, unknown>
}

export class AuditService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly logger: Logger,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  createPending(input: AuditStartInput): AuditRecord {
    return this.insert({
      ...input,
      result: input.result ?? 'Pending'
    })
  }

  record(input: AuditStartInput & { result: AuditResult }): AuditRecord {
    return this.insert(input)
  }

  finalize(input: AuditFinalizeInput): { ok: boolean; errorSummary?: string } {
    try {
      this.repository.finalize({
        ...input,
        oldValue: input.oldValue === undefined ? undefined : sanitizeAuditValue(input.oldValue),
        newValue: input.newValue === undefined ? undefined : sanitizeAuditValue(input.newValue),
        metadata: input.metadata ? sanitizeRecord(input.metadata) : undefined
      })
      return { ok: true }
    } catch (error) {
      const errorSummary = error instanceof Error ? error.message : String(error)
      this.logger.write({
        category: 'error',
        level: 'error',
        message: 'Failed to finalize audit record',
        source: 'main:audit-service',
        context: {
          auditId: input.id,
          error: errorSummary
        }
      })
      return {
        ok: false,
        errorSummary
      }
    }
  }

  query(query: AuditQuery): AuditLogResult {
    return this.repository.query(query)
  }

  private insert(input: AuditStartInput & { result: AuditResult }): AuditRecord {
    const timestamp = this.now()
    const user = input.user
    return this.repository.insert({
      id: randomUUID(),
      timestamp,
      user: user?.username ?? 'anonymous',
      role: user?.role,
      action: input.action,
      target: input.target,
      oldValue: sanitizeAuditValue(input.oldValue ?? null),
      newValue: sanitizeAuditValue(input.newValue ?? null),
      result: input.result,
      correlationId: input.correlationId,
      metadata: input.metadata ? sanitizeRecord(input.metadata) : undefined
    })
  }
}

function sanitizeAuditValue(value: AuditValue): AuditValue {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeUnknown(entry)) as readonly unknown[]
  }

  if (typeof value === 'object' && value !== null) {
    return sanitizeRecord(value as Record<string, unknown>)
  }

  return value
}

function sanitizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(record).reduce<Record<string, unknown>>((sanitized, [key, value]) => {
    sanitized[key] = SENSITIVE_KEYS.has(key) ? '[redacted]' : sanitizeUnknown(value)
    return sanitized
  }, {})
}

function sanitizeUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeUnknown)
  }

  if (typeof value === 'object' && value !== null) {
    return sanitizeRecord(value as Record<string, unknown>)
  }

  return value
}
