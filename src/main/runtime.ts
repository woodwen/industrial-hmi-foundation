import { SIMULATED_MIXER_DEVICE_ID } from '../shared/modbus'
import type { DeviceReadRequest, DeviceReadResponse, DeviceStatus, DeviceWriteRequest, DeviceWriteResponse } from '../shared/hmi-api'
import type { TagSnapshot } from '../shared/tag'
import { DeviceManager } from './device'
import type { Logger } from './logging/logger'
import { ModbusAdapter } from './protocol/modbus/ModbusAdapter'
import { PollingScheduler, TagCache, TagService } from './tag'
import { TagIpcPublisher } from './ipc/tag-publisher'

export interface MainRuntime {
  deviceManager: RuntimeDeviceManager
  tagService: TagService
  tagCache: TagCache
  pollingScheduler: PollingScheduler
  tagIpcPublisher: TagIpcPublisher
  getTagSnapshot(): TagSnapshot
  dispose(): void
}

export class RuntimeDeviceManager {
  constructor(
    private readonly delegate: DeviceManager,
    private readonly scheduler: PollingScheduler,
    private readonly tagCache: TagCache
  ) {}

  async connectDevice(): Promise<DeviceStatus> {
    const status = await this.delegate.connectDevice()
    this.scheduler.start(status.deviceId)
    return status
  }

  async disconnectDevice(): Promise<DeviceStatus> {
    const currentStatus = this.delegate.getDeviceStatus()
    this.scheduler.stop(currentStatus.deviceId)
    const status = await this.delegate.disconnectDevice()
    this.tagCache.markDeviceQuality(status.deviceId, 'Uncertain')
    return status
  }

  getDeviceStatus(): DeviceStatus {
    return this.delegate.getDeviceStatus()
  }

  readDeviceRegisters(request: DeviceReadRequest): Promise<DeviceReadResponse> {
    return this.delegate.readDeviceRegisters(request)
  }

  writeDeviceRegisters(request: DeviceWriteRequest): Promise<DeviceWriteResponse> {
    return this.delegate.writeDeviceRegisters(request)
  }
}

export function createMainRuntime(logger: Logger): MainRuntime {
  const adapter = new ModbusAdapter(logger)
  const tagService = new TagService(undefined, logger)
  const tagCache = new TagCache(tagService.listTagDefinitions())
  const pollingScheduler = new PollingScheduler({
    adapter,
    tagService,
    tagCache,
    logger
  })
  const deviceManager = new RuntimeDeviceManager(
    new DeviceManager({
      adapter,
      logger
    }),
    pollingScheduler,
    tagCache
  )
  const tagIpcPublisher = new TagIpcPublisher(tagCache, logger)

  return {
    deviceManager,
    tagService,
    tagCache,
    pollingScheduler,
    tagIpcPublisher,
    getTagSnapshot: () => tagCache.getSnapshot(SIMULATED_MIXER_DEVICE_ID),
    dispose: () => {
      pollingScheduler.dispose()
      tagIpcPublisher.dispose()
      tagCache.dispose()
    }
  }
}
