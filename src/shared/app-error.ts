export interface AppErrorShape {
  code: string
  message: string
  detail?: string
  source?: string
  cause?: string
}

export interface CreateAppErrorInput {
  code: string
  message: string
  detail?: string
  source?: string
  cause?: unknown
}

export const UNKNOWN_ERROR_CODE = 'APP_UNKNOWN_ERROR'

export function createAppError(input: CreateAppErrorInput): AppErrorShape {
  return {
    code: input.code,
    message: input.message,
    detail: input.detail,
    source: input.source,
    cause: normalizeCause(input.cause)
  }
}

export function toAppError(error: unknown, source = 'application'): AppErrorShape {
  if (isAppErrorShape(error)) {
    return {
      ...error,
      source: error.source ?? source
    }
  }

  if (error instanceof Error) {
    return createAppError({
      code: UNKNOWN_ERROR_CODE,
      message: error.message || 'Unknown application error',
      detail: error.stack,
      source,
      cause: error.cause
    })
  }

  return createAppError({
    code: UNKNOWN_ERROR_CODE,
    message: 'Unknown application error',
    detail: String(error),
    source
  })
}

function isAppErrorShape(value: unknown): value is AppErrorShape {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<AppErrorShape>
  return typeof candidate.code === 'string' && typeof candidate.message === 'string'
}

function normalizeCause(cause: unknown): string | undefined {
  if (cause === undefined) {
    return undefined
  }

  if (cause instanceof Error) {
    return cause.message
  }

  return String(cause)
}
