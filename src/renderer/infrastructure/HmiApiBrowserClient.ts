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
  Unsubscribe
} from '../../shared/hmi-api'
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

  checkForUpdates(): Promise<HmiResult<void>> {
    return window.hmi.updates.checkForUpdates()
  }

  downloadUpdate(): Promise<HmiResult<void>> {
    return window.hmi.updates.downloadUpdate()
  }

  cancelUpdateDownload(): Promise<HmiResult<void>> {
    return window.hmi.updates.cancelUpdateDownload()
  }

  openUpdateDownloadPage(version?: string): Promise<HmiResult<void>> {
    return window.hmi.updates.openUpdateDownloadPage(version)
  }

  quitAndInstallUpdate(): Promise<HmiResult<void>> {
    return window.hmi.updates.quitAndInstallUpdate()
  }

  onUpdateEvent(listener: AppUpdateListener): Unsubscribe {
    return window.hmi.updates.onUpdateEvent(listener)
  }

  connectDevice(): Promise<HmiResult<DeviceStatus>> {
    return window.hmi.devices.connect()
  }

  disconnectDevice(): Promise<HmiResult<DeviceStatus>> {
    return window.hmi.devices.disconnect()
  }

  getDeviceStatus(): Promise<HmiResult<DeviceStatus>> {
    return window.hmi.devices.getStatus()
  }

  readDeviceRegisters(request: DeviceReadRequest): Promise<HmiResult<DeviceReadResponse>> {
    return window.hmi.devices.readRegisters(request)
  }

  writeDeviceRegisters(request: DeviceWriteRequest): Promise<HmiResult<DeviceWriteResponse>> {
    return window.hmi.devices.writeRegisters(request)
  }
}
