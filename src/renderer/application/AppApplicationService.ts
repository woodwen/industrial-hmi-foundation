import type { AppErrorShape } from '../../shared/app-error'
import type { AppInfo, ErrorReportInput, HmiResult, LogEntryInput } from '../../shared/hmi-api'

export interface HmiApiClient {
  getAppInfo(): Promise<HmiResult<AppInfo>>
  writeLog(entry: LogEntryInput): Promise<HmiResult<void>>
  reportError(error: ErrorReportInput): Promise<HmiResult<void>>
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

  reportError(error: AppErrorShape): Promise<HmiResult<void>> {
    return this.apiClient.reportError(error)
  }
}
