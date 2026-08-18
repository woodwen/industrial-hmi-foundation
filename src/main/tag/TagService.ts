import type { ModbusRawValue } from '../../shared/modbus'
import {
  DEFAULT_TAG_DEFINITIONS,
  type TagDefinition,
  type TagValue,
  type TagValueData
} from '../../shared/tag'
import type { Logger } from '../logging/logger'
import type { ProtocolReadResult } from '../protocol/types'
import type { ScanGroup } from './scan-groups'

export class TagService {
  private readonly definitions: TagDefinition[]

  constructor(
    definitions: readonly TagDefinition[] = DEFAULT_TAG_DEFINITIONS,
    private readonly logger?: Logger
  ) {
    this.definitions = [...definitions].sort((left, right) => left.displayOrder - right.displayOrder)
  }

  listTagDefinitions(): TagDefinition[] {
    return this.definitions.map((definition) => ({ ...definition }))
  }

  getTagDefinition(tagId: string): TagDefinition | undefined {
    const definition = this.definitions.find((tag) => tag.id === tagId)
    return definition ? { ...definition } : undefined
  }

  getTagsByDevice(deviceId: string): TagDefinition[] {
    return this.definitions
      .filter((definition) => definition.deviceId === deviceId)
      .map((definition) => ({ ...definition }))
  }

  decodeGroupResult(group: ScanGroup, result: ProtocolReadResult, timestamp = new Date().toISOString()): TagValue[] {
    return group.tags.map((definition) => this.decodeTagFromGroup(definition, group, result, timestamp))
  }

  createFailureValues(tags: readonly TagDefinition[], timestamp = new Date().toISOString()): TagValue[] {
    return tags.map((definition) => ({
      tagId: definition.id,
      value: null,
      quality: 'Bad',
      timestamp
    }))
  }

  private decodeTagFromGroup(
    definition: TagDefinition,
    group: ScanGroup,
    result: ProtocolReadResult,
    timestamp: string
  ): TagValue {
    try {
      const offset = definition.address - group.startAddress
      const rawValues = result.values.slice(offset, offset + definition.quantity)
      const value = decodeTagRawValue(definition, rawValues)

      return {
        tagId: definition.id,
        value,
        quality: 'Good',
        timestamp
      }
    } catch (error) {
      this.logger?.write({
        category: 'error',
        level: 'warn',
        message: 'Failed to decode Tag value',
        source: 'main:tag-service',
        context: {
          tagId: definition.id,
          registerType: definition.registerType,
          address: definition.address,
          error: error instanceof Error ? error.message : String(error)
        }
      })

      return {
        tagId: definition.id,
        value: null,
        quality: 'Bad',
        timestamp
      }
    }
  }
}

export function decodeTagRawValue(definition: TagDefinition, rawValues: readonly ModbusRawValue[]): TagValueData {
  if (rawValues.length !== definition.quantity) {
    throw new Error(`Tag ${definition.id} expects ${definition.quantity} raw values.`)
  }

  if (definition.dataType === 'boolean') {
    const value = rawValues[0]
    if (typeof value !== 'boolean') {
      throw new Error(`Tag ${definition.id} expects a boolean raw value.`)
    }
    return value
  }

  const registers = rawValues.map((value) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new Error(`Tag ${definition.id} expects uint16 register raw values.`)
    }
    return value
  })

  let decoded: number
  if (definition.dataType === 'int16') {
    decoded = registers[0] & 0x8000 ? registers[0] - 0x10000 : registers[0]
  } else if (definition.dataType === 'uint16') {
    decoded = registers[0]
  } else {
    decoded = registers[0] * 0x10000 + registers[1]
  }

  return roundEngineeringValue(decoded * definition.scale + definition.offset)
}

function roundEngineeringValue(value: number): number {
  return Math.round(value * 1000) / 1000
}
