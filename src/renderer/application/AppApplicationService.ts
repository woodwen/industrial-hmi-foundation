import type {
  AppInfo,
  AppUpdateListener,
  ErrorReportInput,
  HmiResult,
  LogEntryInput,
  Unsubscribe
} from '../../shared/hmi-api'

export interface HmiApiClient {
  getAppInfo(): Promise<HmiResult<AppInfo>>
  writeLog(entry: LogEntryInput): Promise<HmiResult<void>>
  reportError(error: ErrorReportInput): Promise<HmiResult<void>>
  checkForUpdates(): Promise<HmiResult<void>>
  downloadUpdate(): Promise<HmiResult<void>>
  cancelUpdateDownload(): Promise<HmiResult<void>>
  openUpdateDownloadPage(version?: string): Promise<HmiResult<void>>
  quitAndInstallUpdate(): Promise<HmiResult<void>>
  onUpdateEvent(listener: AppUpdateListener): Unsubscribe
}

export class AppApplicationService {
  constructor(private readonly apiClient: HmiApiClient) {}

  getAppInfo(): Promise<HmiResult<AppInfo>> {
    return this.apiClient.getAppInfo()
  }

  writeApplicationLog(message: string, context?: LogEntryInput['context']): Promise<HmiResult<void>> {
    return this.apiClient.writeLog({
      category: 'application',
      level: 'info',
      message,
      context,
      source: 'renderer'
    })
  }

  reportError(error: ErrorReportInput): Promise<HmiResult<void>> {
    return this.apiClient.reportError(error)
  }

  checkForUpdates(): Promise<HmiResult<void>> {
    return this.apiClient.checkForUpdates()
  }

  downloadUpdate(): Promise<HmiResult<void>> {
    return this.apiClient.downloadUpdate()
  }

  cancelUpdateDownload(): Promise<HmiResult<void>> {
    return this.apiClient.cancelUpdateDownload()
  }

  openUpdateDownloadPage(version?: string): Promise<HmiResult<void>> {
    return this.apiClient.openUpdateDownloadPage(version)
  }

  quitAndInstallUpdate(): Promise<HmiResult<void>> {
    return this.apiClient.quitAndInstallUpdate()
  }

  onUpdateEvent(listener: AppUpdateListener): Unsubscribe {
    return this.apiClient.onUpdateEvent(listener)
  }
}
