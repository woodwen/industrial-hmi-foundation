import { SIMULATED_MIXER_DEVICE_ID } from '../shared/modbus'
import type { TagSnapshot } from '../shared/tag'
import { CommandService } from './command'
import { DeviceManager, DeviceOperationGate } from './device'
import { DeviceStateIpcPublisher } from './ipc/device-state-publisher'
import { TagIpcPublisher } from './ipc/tag-publisher'
import type { Logger } from './logging/logger'
import { ModbusAdapter } from './protocol/modbus/ModbusAdapter'
import { PollingScheduler, TagCache, TagService } from './tag'

export interface MainRuntime {
  deviceManager: DeviceManager
  commandService: CommandService
  tagService: TagService
  tagCache: TagCache
  pollingScheduler: PollingScheduler
  tagIpcPublisher: TagIpcPublisher
  deviceStateIpcPublisher: DeviceStateIpcPublisher
  getTagSnapshot(): TagSnapshot
  dispose(): void
}

export function createMainRuntime(logger: Logger): MainRuntime {
  const adapter = new ModbusAdapter(logger)
  const operationGate = new DeviceOperationGate()
  const tagService = new TagService(undefined, logger)
  const tagCache = new TagCache(tagService.listTagDefinitions())
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
  const tagIpcPublisher = new TagIpcPublisher(tagCache, logger)
  const deviceStateIpcPublisher = new DeviceStateIpcPublisher(deviceManager, logger)

  return {
    deviceManager,
    commandService,
    tagService,
    tagCache,
    pollingScheduler,
    tagIpcPublisher,
    deviceStateIpcPublisher,
    getTagSnapshot: () => tagCache.getSnapshot(SIMULATED_MIXER_DEVICE_ID),
    dispose: () => {
      pollingScheduler.dispose()
      tagIpcPublisher.dispose()
      deviceStateIpcPublisher.dispose()
      commandService.dispose()
      deviceManager.dispose()
      tagCache.dispose()
      operationGate.dispose()
    }
  }
}
