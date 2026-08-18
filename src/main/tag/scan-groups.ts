import type { TagDefinition, TagScanRate } from '../../shared/tag'
import type { ModbusRegisterArea } from '../../shared/modbus'

export interface ScanGroup {
  id: string
  deviceId: string
  scanRate: TagScanRate
  registerType: ModbusRegisterArea
  startAddress: number
  quantity: number
  tags: TagDefinition[]
}

interface MutableGroup {
  deviceId: string
  scanRate: TagScanRate
  registerType: ModbusRegisterArea
  startAddress: number
  endExclusive: number
  tags: TagDefinition[]
}

export function buildScanGroups(definitions: readonly TagDefinition[]): ScanGroup[] {
  const buckets = new Map<string, TagDefinition[]>()

  for (const definition of definitions) {
    const key = `${definition.deviceId}:${definition.scanRate}:${definition.registerType}`
    const bucket = buckets.get(key) ?? []
    bucket.push(definition)
    buckets.set(key, bucket)
  }

  const groups: ScanGroup[] = []
  for (const bucket of buckets.values()) {
    const sorted = [...bucket].sort((left, right) => left.address - right.address)
    const mutableGroups: MutableGroup[] = []

    for (const definition of sorted) {
      const lastGroup = mutableGroups.at(-1)
      const endExclusive = definition.address + definition.quantity

      if (lastGroup && definition.address <= lastGroup.endExclusive) {
        lastGroup.endExclusive = Math.max(lastGroup.endExclusive, endExclusive)
        lastGroup.tags.push(definition)
        continue
      }

      mutableGroups.push({
        deviceId: definition.deviceId,
        scanRate: definition.scanRate,
        registerType: definition.registerType,
        startAddress: definition.address,
        endExclusive,
        tags: [definition]
      })
    }

    groups.push(...mutableGroups.map(toScanGroup))
  }

  return groups.sort((left, right) => {
    if (left.deviceId !== right.deviceId) {
      return left.deviceId.localeCompare(right.deviceId)
    }
    if (left.scanRate !== right.scanRate) {
      return left.scanRate - right.scanRate
    }
    if (left.registerType !== right.registerType) {
      return left.registerType.localeCompare(right.registerType)
    }
    return left.startAddress - right.startAddress
  })
}

function toScanGroup(group: MutableGroup): ScanGroup {
  const quantity = group.endExclusive - group.startAddress
  return {
    id: `${group.deviceId}:${group.scanRate}:${group.registerType}:${group.startAddress}:${quantity}`,
    deviceId: group.deviceId,
    scanRate: group.scanRate,
    registerType: group.registerType,
    startAddress: group.startAddress,
    quantity,
    tags: [...group.tags].sort((left, right) => left.address - right.address)
  }
}
