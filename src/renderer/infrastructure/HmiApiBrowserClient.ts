import type { AppInfo, ErrorReportInput, HmiResult, LogEntryInput } from '../../shared/hmi-api'
import type { HmiApiClient } from '../application/AppApplicationService'

export class HmiApiBrowserClient implements HmiApiClient {
  getAppInfo(): Promise<HmiResult<AppInfo>> {
    return window.hmi.app.getInfo()
  }

  writeLog(entry: LogEntryInput): Promise<HmiResult<void>> {
    return window.hmi.log.write(entry)
  }

  reportError(error: ErrorReportInput): Promise<HmiResult<void>> {
    return window.hmi.errors.report(error)
  }
}
