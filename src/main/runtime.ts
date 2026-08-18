import { SIMULATED_MIXER_DEVICE_ID } from '../shared/modbus'
import type {
  AlarmAcknowledgeRequest,
  AlarmHistoryQuery,
  AlarmHistoryResult,
  AlarmOccurrence,
  AlarmSnapshot
} from '../shared/alarm'
import type { TagSnapshot } from '../shared/tag'
import type {
  HistoricalTrendQuery,
  HistoricalTrendResult,
  RealtimeTrendRequest,
  RealtimeTrendSnapshot
} from '../shared/trend'
import { AlarmEngine, AlarmHistoryRepository } from './alarm'
import { CommandService } from './command'
import { DeviceManager, DeviceOperationGate } from './device'
import { HistorianDatabase, HistorianService, TagHistoryRepository, TrendQueryService, TrendService } from './historian'
import { AlarmIpcPublisher } from './ipc/alarm-publisher'
import { DeviceStateIpcPublisher } from './ipc/device-state-publisher'
import { TagIpcPublisher } from './ipc/tag-publisher'
import { TrendIpcPublisher } from './ipc/trend-publisher'
import type { Logger } from './logging/logger'
import { ModbusAdapter } from './protocol/modbus/ModbusAdapter'
import { PollingScheduler, TagCache, TagService } from './tag'

export interface MainRuntimeOptions {
  databasePath?: string
}

export interface MainRuntime {
  deviceManager: DeviceManager
  commandService: CommandService
  tagService: TagService
  tagCache: TagCache
  pollingScheduler: PollingScheduler
  historianDatabase: HistorianDatabase
  historianService: HistorianService
  trendService: TrendService
  trendQueryService: TrendQueryService
  alarmEngine: AlarmEngine
  tagIpcPublisher: TagIpcPublisher
  deviceStateIpcPublisher: DeviceStateIpcPublisher
  alarmIpcPublisher: AlarmIpcPublisher
  trendIpcPublisher: TrendIpcPublisher
  getTagSnapshot(): TagSnapshot
  getAlarmSnapshot(): AlarmSnapshot
  acknowledgeAlarm(request: AlarmAcknowledgeRequest): AlarmOccurrence
  queryAlarmHistory(query: AlarmHistoryQuery): AlarmHistoryResult
  getRealtimeTrendSnapshot(request: RealtimeTrendRequest): RealtimeTrendSnapshot
  queryHistoricalTrend(query: HistoricalTrendQuery): HistoricalTrendResult
  dispose(): void
}

export function createMainRuntime(logger: Logger, options: MainRuntimeOptions = {}): MainRuntime {
  const adapter = new ModbusAdapter(logger)
  const operationGate = new DeviceOperationGate()
  const tagService = new TagService(undefined, logger)
  const tagCache = new TagCache(tagService.listTagDefinitions())
  const historianDatabase = new HistorianDatabase(options.databasePath ?? ':memory:', logger)
  const tagHistoryRepository = new TagHistoryRepository(historianDatabase.db)
  const alarmHistoryRepository = new AlarmHistoryRepository(historianDatabase.db)
  const pollingSchedulerRef: {
    current?: PollingScheduler
  } = {}

  const deviceManager = new DeviceManager({
    adapter,
    logger,
    operationGate,
    lifecycle: {
      onConnected: (deviceId) => {
        pollingSchedulerRef.current?.start(deviceId)
      },
      onReconnecting: (deviceId) => {
        pollingSchedulerRef.current?.stop(deviceId)
        tagCache.markDeviceQuality(deviceId, 'Bad')
      },
      onDisconnected: (deviceId, manual) => {
        pollingSchedulerRef.current?.stop(deviceId)
        tagCache.markDeviceQuality(deviceId, manual ? 'Uncertain' : 'Bad')
      },
      onFault: (deviceId) => {
        pollingSchedulerRef.current?.stop(deviceId)
        tagCache.markDeviceQuality(deviceId, 'Bad')
      }
    }
  })

  const pollingScheduler = new PollingScheduler({
    adapter,
    tagService,
    tagCache,
    logger,
    operationGate,
    onDeviceCommunicationFailure: (_deviceId, error) => {
      deviceManager.handleCommunicationFailure(error)
    }
  })
  pollingSchedulerRef.current = pollingScheduler

  const commandService = new CommandService({
    adapter,
    deviceManager,
    operationGate,
    logger
  })
  const historianService = new HistorianService(tagCache, tagHistoryRepository, logger)
  const trendService = new TrendService(tagCache)
  const trendQueryService = new TrendQueryService(tagHistoryRepository)
  const alarmEngine = new AlarmEngine(tagCache, deviceManager, alarmHistoryRepository, logger)
  const tagIpcPublisher = new TagIpcPublisher(tagCache, logger)
  const deviceStateIpcPublisher = new DeviceStateIpcPublisher(deviceManager, logger)
  const alarmIpcPublisher = new AlarmIpcPublisher(alarmEngine, logger)
  const trendIpcPublisher = new TrendIpcPublisher(trendService, logger)

  return {
    deviceManager,
    commandService,
    tagService,
    tagCache,
    pollingScheduler,
    historianDatabase,
    historianService,
    trendService,
    trendQueryService,
    alarmEngine,
    tagIpcPublisher,
    deviceStateIpcPublisher,
    alarmIpcPublisher,
    trendIpcPublisher,
    getTagSnapshot: () => tagCache.getSnapshot(SIMULATED_MIXER_DEVICE_ID),
    getAlarmSnapshot: () => alarmEngine.getSnapshot(),
    acknowledgeAlarm: (request) => alarmEngine.acknowledge(request),
    queryAlarmHistory: (query) => alarmHistoryRepository.queryHistory(query),
    getRealtimeTrendSnapshot: (request) => trendService.getSnapshot(request.tagIds),
    queryHistoricalTrend: (query) => trendQueryService.queryHistorical(query),
    dispose: () => {
      pollingScheduler.dispose()
      tagIpcPublisher.dispose()
      deviceStateIpcPublisher.dispose()
      alarmIpcPublisher.dispose()
      trendIpcPublisher.dispose()
      alarmEngine.dispose()
      trendService.dispose()
      historianService.flush()
      historianService.dispose()
      commandService.dispose()
      deviceManager.dispose()
      tagCache.dispose()
      historianDatabase.close()
      operationGate.dispose()
    }
  }
}
