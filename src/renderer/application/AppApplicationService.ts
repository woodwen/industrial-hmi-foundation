import type {
  AppInfo,
  AppUpdateListener,
  DeviceReadRequest,
  DeviceReadResponse,
  DeviceStatus,
  DeviceWriteRequest,
  DeviceWriteResponse,
  ErrorReportInput,
  HmiResult,
  LogEntryInput,
  TagSnapshot,
  TagValuesListener,
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
  connectDevice(): Promise<HmiResult<DeviceStatus>>
  disconnectDevice(): Promise<HmiResult<DeviceStatus>>
  getDeviceStatus(): Promise<HmiResult<DeviceStatus>>
  readDeviceRegisters(request: DeviceReadRequest): Promise<HmiResult<DeviceReadResponse>>
  writeDeviceRegisters(request: DeviceWriteRequest): Promise<HmiResult<DeviceWriteResponse>>
  getTagSnapshot(): Promise<HmiResult<TagSnapshot>>
  subscribeTagValues(listener: TagValuesListener): Unsubscribe
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

  connectDevice(): Promise<HmiResult<DeviceStatus>> {
    return this.apiClient.connectDevice()
  }

  disconnectDevice(): Promise<HmiResult<DeviceStatus>> {
    return this.apiClient.disconnectDevice()
  }

  getDeviceStatus(): Promise<HmiResult<DeviceStatus>> {
    return this.apiClient.getDeviceStatus()
  }

  readDeviceRegisters(request: DeviceReadRequest): Promise<HmiResult<DeviceReadResponse>> {
    return this.apiClient.readDeviceRegisters(request)
  }

  writeDeviceRegisters(request: DeviceWriteRequest): Promise<HmiResult<DeviceWriteResponse>> {
    return this.apiClient.writeDeviceRegisters(request)
  }

  getTagSnapshot(): Promise<HmiResult<TagSnapshot>> {
    return this.apiClient.getTagSnapshot()
  }

  subscribeTagValues(listener: TagValuesListener): Unsubscribe {
    return this.apiClient.subscribeTagValues(listener)
  }
}
