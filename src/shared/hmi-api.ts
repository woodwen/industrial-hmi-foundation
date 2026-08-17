import type { AppErrorShape } from './app-error'

export type LogCategory = 'application' | 'communication' | 'error'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface AppInfo {
  name: string
  version: string
  environment: 'development' | 'production' | 'test'
}

export interface LogEntryInput {
  category: LogCategory
  level: LogLevel
  message: string
  context?: Record<string, string | number | boolean | null>
  source?: string
}

export interface ErrorReportInput extends AppErrorShape {
  componentStack?: string
}

export type HmiResult<T> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: AppErrorShape
    }

export interface HmiApi {
  app: {
    getInfo(): Promise<HmiResult<AppInfo>>
  }
  log: {
    write(entry: LogEntryInput): Promise<HmiResult<void>>
  }
  errors: {
    report(error: ErrorReportInput): Promise<HmiResult<void>>
  }
}
