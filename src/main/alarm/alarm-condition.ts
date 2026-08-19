import type { AlarmDefinition, AlarmValue } from '../../shared/alarm'
import type { TagQuality } from '../../shared/tag'

export interface AlarmSignal {
  id: string
  value: AlarmValue
  quality: TagQuality
  timestamp: string
}

export type AlarmConditionState = boolean | null

export function evaluateAlarmCondition(
  definition: AlarmDefinition,
  signal: AlarmSignal | undefined,
  recovering = false
): AlarmConditionState {
  if (!definition.enabled || !signal) {
    return false
  }

  if (definition.condition === 'BooleanState') {
    return typeof signal.value === 'boolean' && signal.value === definition.threshold
  }

  if (signal.quality !== 'Good') {
    return null
  }

  if (typeof signal.value !== 'number' || typeof definition.threshold !== 'number') {
    return false
  }

  const deadband = recovering ? definition.deadband ?? 0 : 0
  if (definition.condition === 'High' || definition.condition === 'HighHigh') {
    return recovering
      ? signal.value > definition.threshold - deadband
      : signal.value > definition.threshold
  }

  return recovering
    ? signal.value < definition.threshold + deadband
    : signal.value < definition.threshold
}
