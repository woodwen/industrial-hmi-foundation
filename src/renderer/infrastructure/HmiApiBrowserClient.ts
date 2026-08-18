import type {
  AlarmAcknowledgeRequest,
  AlarmHistoryQuery,
  AlarmHistoryResult,
  AlarmListener,
  AlarmOccurrence,
  AlarmSnapshot,
  AppInfo,
  AppUpdateListener,
  DeviceCommandRequest,
  DeviceCommandResult,
  DeviceReadRequest,
  DeviceReadResponse,
  DeviceStateListener,
  DeviceStatus,
  DeviceWriteRequest,
  DeviceWriteResponse,
  ErrorReportInput,
  HistoricalTrendQuery,
  HistoricalTrendResult,
  HmiResult,
  LogEntryInput,
  RealtimeTrendListener,
  RealtimeTrendRequest,
  RealtimeTrendSnapshot,
  TagSnapshot,
  TagValuesListener,
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

  subscribeDeviceState(listener: DeviceStateListener): Unsubscribe {
    return window.hmi.devices.subscribeState(listener)
  }

  readDeviceRegisters(request: DeviceReadRequest): Promise<HmiResult<DeviceReadResponse>> {
    return window.hmi.devices.readRegisters(request)
  }

  writeDeviceRegisters(request: DeviceWriteRequest): Promise<HmiResult<DeviceWriteResponse>> {
    return window.hmi.devices.writeRegisters(request)
  }

  executeCommand(request: DeviceCommandRequest): Promise<HmiResult<DeviceCommandResult>> {
    return window.hmi.commands.execute(request)
  }

  getTagSnapshot(): Promise<HmiResult<TagSnapshot>> {
    return window.hmi.tags.getSnapshot()
  }

  subscribeTagValues(listener: TagValuesListener): Unsubscribe {
    return window.hmi.tags.subscribeValues(listener)
  }

  getAlarmSnapshot(): Promise<HmiResult<AlarmSnapshot>> {
    return window.hmi.alarms.getSnapshot()
  }

  subscribeAlarms(listener: AlarmListener): Unsubscribe {
    return window.hmi.alarms.subscribe(listener)
  }

  acknowledgeAlarm(request: AlarmAcknowledgeRequest): Promise<HmiResult<AlarmOccurrence>> {
    return window.hmi.alarms.acknowledge(request)
  }

  queryAlarmHistory(query: AlarmHistoryQuery): Promise<HmiResult<AlarmHistoryResult>> {
    return window.hmi.alarms.queryHistory(query)
  }

  getRealtimeTrendSnapshot(request: RealtimeTrendRequest): Promise<HmiResult<RealtimeTrendSnapshot>> {
    return window.hmi.trends.getRealtimeSnapshot(request)
  }

  subscribeRealtimeTrend(request: RealtimeTrendRequest, listener: RealtimeTrendListener): Unsubscribe {
    return window.hmi.trends.subscribeRealtime(request, listener)
  }

  queryHistoricalTrend(query: HistoricalTrendQuery): Promise<HmiResult<HistoricalTrendResult>> {
    return window.hmi.trends.queryHistorical(query)
  }
}
