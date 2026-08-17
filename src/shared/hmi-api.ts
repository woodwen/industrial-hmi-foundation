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

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'manual-download'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'cancelled'
  | 'error'

export type UpdateErrorReason =
  | 'development-download'
  | 'incomplete-package'
  | 'network'
  | 'unknown'

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface AppUpdateState {
  status: UpdateStatus
  version?: string
  message?: string
  progress?: UpdateProgress
}

export type AppUpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'manual-download'; version?: string }
  | { type: 'not-available'; version?: string; development?: boolean }
  | { type: 'progress'; progress: UpdateProgress }
  | { type: 'downloaded'; version: string }
  | { type: 'cancelled' }
  | { type: 'error'; reason: UpdateErrorReason; message: string }

export type AppUpdateListener = (event: AppUpdateEvent) => void
export type Unsubscribe = () => void

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
  updates: {
    checkForUpdates(): Promise<HmiResult<void>>
    downloadUpdate(): Promise<HmiResult<void>>
    cancelUpdateDownload(): Promise<HmiResult<void>>
    openUpdateDownloadPage(version?: string): Promise<HmiResult<void>>
    quitAndInstallUpdate(): Promise<HmiResult<void>>
    onUpdateEvent(listener: AppUpdateListener): Unsubscribe
  }
}
