import type { TagScanRate } from '../../shared/tag'
import type { AppErrorShape } from '../../shared/app-error'
import type { DeviceOperationGate } from '../device'
import type { Logger } from '../logging/logger'
import type { IProtocolAdapter } from '../protocol/types'
import type { TagCache } from './TagCache'
import type { TagService } from './TagService'
import { buildScanGroups, type ScanGroup } from './scan-groups'

interface PollingSchedulerDependencies {
  adapter: IProtocolAdapter
  tagService: TagService
  tagCache: TagCache
  logger: Logger
  operationGate?: DeviceOperationGate
  onDeviceCommunicationFailure?: (deviceId: string, error: unknown) => void
}

interface TimerState {
  timer: ReturnType<typeof setInterval>
  running: boolean
  lastSkipLoggedAt: number
  generation: number
}

export class PollingScheduler {
  private readonly groups: ScanGroup[]
  private readonly timers = new Map<string, TimerState>()
  private readonly runningDevices = new Set<string>()
  private readonly lastDeviceSkipLoggedAt = new Map<string, number>()
  private readonly deviceGenerations = new Map<string, number>()

  constructor(private readonly dependencies: PollingSchedulerDependencies) {
    this.groups = buildScanGroups(dependencies.tagService.listTagDefinitions())
  }

  getScanGroups(): ScanGroup[] {
    return this.groups.map((group) => ({
      ...group,
      tags: group.tags.map((tag) => ({ ...tag }))
    }))
  }

  start(deviceId: string): void {
    this.stop(deviceId)
    const generation = this.nextDeviceGeneration(deviceId)
    const groupsByRate = this.getDeviceGroupsByRate(deviceId)

    for (const [scanRate, groups] of groupsByRate) {
      const key = timerKey(deviceId, scanRate)
      const state: TimerState = {
        timer: setInterval(() => {
          void this.tick(deviceId, scanRate, groups, generation)
        }, scanRate),
        running: false,
        lastSkipLoggedAt: 0,
        generation
      }
      this.timers.set(key, state)

      this.dependencies.logger.write({
        category: 'communication',
        level: 'info',
        message: 'Started Tag polling scan rate',
        source: 'main:polling-scheduler',
        context: {
          deviceId,
          scanRate,
          groupCount: groups.length
        }
      })
      groups.forEach((group) => {
        this.dependencies.logger.write({
          category: 'communication',
          level: 'debug',
          message: 'Configured Tag scan group',
          source: 'main:polling-scheduler',
          context: createGroupContext(group, 'configured')
        })
      })

      void this.tick(deviceId, scanRate, groups, generation)
    }
  }

  stop(deviceId?: string): void {
    if (deviceId) {
      this.nextDeviceGeneration(deviceId)
      this.runningDevices.delete(deviceId)
    } else {
      const deviceIds = new Set([
        ...this.groups.map((group) => group.deviceId),
        ...this.deviceGenerations.keys()
      ])
      deviceIds.forEach((entry) => {
        this.nextDeviceGeneration(entry)
      })
      this.runningDevices.clear()
    }

    for (const [key, state] of this.timers) {
      if (!deviceId || key.startsWith(`${deviceId}:`)) {
        clearInterval(state.timer)
        this.timers.delete(key)
      }
    }
  }

  dispose(): void {
    this.stop()
  }

  private async tick(
    deviceId: string,
    scanRate: TagScanRate,
    groups: readonly ScanGroup[],
    generation: number
  ): Promise<void> {
    const key = timerKey(deviceId, scanRate)
    const state = this.timers.get(key)
    if (!state || state.generation !== generation) {
      return
    }

    if (state.running || this.runningDevices.has(deviceId)) {
      this.logSkip(deviceId, scanRate, state)
      return
    }

    if (this.dependencies.adapter.getStatus().connectionStatus !== 'Connected') {
      if (this.isDeviceGenerationCurrent(deviceId, generation)) {
        this.dependencies.tagCache.markDeviceQuality(deviceId, 'Bad')
        this.dependencies.onDeviceCommunicationFailure?.(deviceId, {
          code: 'DEVICE_NOT_CONNECTED',
          message: 'Device is not connected for polling.',
          source: 'main:polling-scheduler'
        } satisfies AppErrorShape)
        this.stop(deviceId)
      }
      return
    }

    this.dependencies.tagCache.markStaleTags(deviceId)

    if (this.dependencies.operationGate?.isBusy(deviceId)) {
      this.logSkip(deviceId, scanRate, state)
      return
    }

    state.running = true
    this.runningDevices.add(deviceId)
    try {
      for (const group of groups) {
        if (!this.isDeviceGenerationCurrent(deviceId, generation)) {
          break
        }

        const success = await this.readGroup(group, generation)
        if (!success) {
          break
        }
      }
    } finally {
      state.running = false
      this.runningDevices.delete(deviceId)
    }
  }

  private async readGroup(group: ScanGroup, generation: number): Promise<boolean> {
    try {
      const result = await this.readGroupThroughGate(group)
      if (!this.isDeviceGenerationCurrent(group.deviceId, generation)) {
        return false
      }

      const values = this.dependencies.tagService.decodeGroupResult(group, result)
      this.dependencies.tagCache.setValues(values)
      this.dependencies.logger.write({
        category: 'communication',
        level: 'debug',
        message: 'Polled Tag scan group',
        source: 'main:polling-scheduler',
        context: createGroupContext(group, 'success')
      })
      return true
    } catch (error) {
      if (!this.isDeviceGenerationCurrent(group.deviceId, generation)) {
        return false
      }

      const timestamp = new Date().toISOString()
      this.dependencies.tagCache.markDeviceQuality(group.deviceId, 'Bad', timestamp)
      this.dependencies.onDeviceCommunicationFailure?.(group.deviceId, error)
      this.dependencies.logger.write({
        category: 'communication',
        level: 'warn',
        message: 'Failed to poll Tag scan group',
        source: 'main:polling-scheduler',
        context: {
          ...createGroupContext(group, 'error'),
          error: error instanceof Error ? error.message : String(error)
        }
      })
      this.stop(group.deviceId)
      return false
    }
  }

  private readGroupThroughGate(group: ScanGroup) {
    const read = () => this.dependencies.adapter.read({
      area: group.registerType,
      address: group.startAddress,
      quantity: group.quantity
    })

    return this.dependencies.operationGate
      ? this.dependencies.operationGate.runExclusive(group.deviceId, read)
      : read()
  }

  private getDeviceGroupsByRate(deviceId: string): Map<TagScanRate, ScanGroup[]> {
    const groupsByRate = new Map<TagScanRate, ScanGroup[]>()

    for (const group of this.groups.filter((entry) => entry.deviceId === deviceId)) {
      const groups = groupsByRate.get(group.scanRate) ?? []
      groups.push(group)
      groupsByRate.set(group.scanRate, groups)
    }

    return groupsByRate
  }

  private nextDeviceGeneration(deviceId: string): number {
    const nextGeneration = (this.deviceGenerations.get(deviceId) ?? 0) + 1
    this.deviceGenerations.set(deviceId, nextGeneration)
    return nextGeneration
  }

  private isDeviceGenerationCurrent(deviceId: string, generation: number): boolean {
    return this.deviceGenerations.get(deviceId) === generation
  }

  private logSkip(deviceId: string, scanRate: TagScanRate, state: TimerState): void {
    const now = Date.now()
    const lastDeviceSkipLoggedAt = this.lastDeviceSkipLoggedAt.get(deviceId) ?? 0
    if (now - state.lastSkipLoggedAt < 2000 || now - lastDeviceSkipLoggedAt < 2000) {
      return
    }

    state.lastSkipLoggedAt = now
    this.lastDeviceSkipLoggedAt.set(deviceId, now)
    this.dependencies.logger.write({
      category: 'communication',
      level: 'warn',
      message: 'Skipped overlapping Tag polling tick',
      source: 'main:polling-scheduler',
      context: {
        deviceId,
        scanRate
      }
    })
  }
}

function timerKey(deviceId: string, scanRate: TagScanRate): string {
  return `${deviceId}:${scanRate}`
}

function createGroupContext(group: ScanGroup, result: string): Record<string, string | number | boolean | null> {
  return {
    result,
    scanGroupId: group.id,
    deviceId: group.deviceId,
    scanRate: group.scanRate,
    registerType: group.registerType,
    address: group.startAddress,
    quantity: group.quantity,
    tagCount: group.tags.length
  }
}
