import { createAppError } from '../../shared/app-error'
import type { ErrorReportInput, LogCategory, LogEntryInput, LogLevel } from '../../shared/hmi-api'

const LOG_CATEGORIES: readonly LogCategory[] = ['application', 'communication', 'error']
const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error']

export function parseLogEntryInput(payload: unknown, source: string): LogEntryInput {
  const record = requireRecord(payload, 'Log entry payload must be an object.', source)

  return {
    category: requireOneOf(record.category, LOG_CATEGORIES, 'Log entry category is invalid.', source),
    level: requireOneOf(record.level, LOG_LEVELS, 'Log entry level is invalid.', source),
    message: requireString(record.message, 'Log entry message must be a string.', source),
    context: parseLogContext(record.context, source),
    source: parseOptionalString(record.source, 'Log entry source must be a string.', source)
  }
}

export function parseErrorReportInput(payload: unknown, source: string): ErrorReportInput {
  const record = requireRecord(payload, 'Error report payload must be an object.', source)

  return {
    code: requireString(record.code, 'Error report code must be a string.', source),
    message: requireString(record.message, 'Error report message must be a string.', source),
    detail: parseOptionalString(record.detail, 'Error report detail must be a string.', source),
    source: parseOptionalString(record.source, 'Error report source must be a string.', source),
    cause: parseOptionalString(record.cause, 'Error report cause must be a string.', source),
    componentStack: parseOptionalString(
      record.componentStack,
      'Error report componentStack must be a string.',
      source
    )
  }
}

function requireRecord(payload: unknown, message: string, source: string): Record<string, unknown> {
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    return payload as Record<string, unknown>
  }

  throwInvalidPayload(message, source)
}

function requireString(value: unknown, message: string, source: string): string {
  if (typeof value === 'string') {
    return value
  }

  throwInvalidPayload(message, source)
}

function parseOptionalString(value: unknown, message: string, source: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === 'string') {
    return value
  }

  throwInvalidPayload(message, source)
}

function requireOneOf<TAllowed extends string>(
  value: unknown,
  allowedValues: readonly TAllowed[],
  message: string,
  source: string
): TAllowed {
  if (typeof value === 'string' && (allowedValues as readonly string[]).includes(value)) {
    return value as TAllowed
  }

  throwInvalidPayload(message, source)
}

function parseLogContext(value: unknown, source: string): LogEntryInput['context'] {
  if (value === undefined || value === null) {
    return undefined
  }

  const record = requireRecord(value, 'Log entry context must be an object.', source)
  const context: NonNullable<LogEntryInput['context']> = {}

  for (const [key, entry] of Object.entries(record)) {
    if (
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'boolean' ||
      (typeof entry === 'number' && Number.isFinite(entry))
    ) {
      context[key] = entry
      continue
    }

    throwInvalidPayload('Log entry context values must be string, number, boolean, or null.', source)
  }

  return context
}

function throwInvalidPayload(message: string, source: string): never {
  throw createAppError({
    code: 'IPC_INVALID_PAYLOAD',
    message,
    source
  })
}
