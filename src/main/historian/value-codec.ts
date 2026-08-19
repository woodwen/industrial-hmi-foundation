import type { AlarmValue } from '../../shared/alarm'
import type { TagValueData } from '../../shared/tag'

export type PersistedValueType = 'number' | 'boolean' | 'string' | 'null'

export interface EncodedValue {
  valueType: PersistedValueType
  valueNumeric: number | null
  valueText: string | null
  valueBool: number | null
}

export function encodePersistedValue(value: TagValueData | AlarmValue | undefined): EncodedValue {
  if (typeof value === 'number') {
    return {
      valueType: 'number',
      valueNumeric: value,
      valueText: null,
      valueBool: null
    }
  }

  if (typeof value === 'boolean') {
    return {
      valueType: 'boolean',
      valueNumeric: null,
      valueText: null,
      valueBool: value ? 1 : 0
    }
  }

  if (typeof value === 'string') {
    return {
      valueType: 'string',
      valueNumeric: null,
      valueText: value,
      valueBool: null
    }
  }

  return {
    valueType: 'null',
    valueNumeric: null,
    valueText: null,
    valueBool: null
  }
}

export function decodePersistedValue(
  valueType: string | null | undefined,
  valueNumeric: number | null | undefined,
  valueText: string | null | undefined,
  valueBool: number | null | undefined
): AlarmValue {
  if (valueType === 'number') {
    return valueNumeric ?? null
  }

  if (valueType === 'boolean') {
    return valueBool === null || valueBool === undefined ? null : valueBool === 1
  }

  if (valueType === 'string') {
    return valueText ?? null
  }

  return null
}
