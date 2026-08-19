import { describe, expect, it } from 'vitest'

import { evaluateAlarmCondition, type AlarmSignal } from '../../../src/main/alarm/alarm-condition'
import type { AlarmCondition, AlarmDefinition } from '../../../src/shared/alarm'

describe('evaluateAlarmCondition', () => {
  it('evaluates all explicit alarm condition types at their threshold boundaries', () => {
    expect(evaluate('High', 10, 10)).toBe(false)
    expect(evaluate('High', 10.1, 10)).toBe(true)
    expect(evaluate('HighHigh', 20, 20)).toBe(false)
    expect(evaluate('HighHigh', 20.1, 20)).toBe(true)
    expect(evaluate('Low', 10, 10)).toBe(false)
    expect(evaluate('Low', 9.9, 10)).toBe(true)
    expect(evaluate('LowLow', 5, 5)).toBe(false)
    expect(evaluate('LowLow', 4.9, 5)).toBe(true)
    expect(evaluate('BooleanState', true, true)).toBe(true)
    expect(evaluate('BooleanState', false, true)).toBe(false)
  })

  it('ignores non-Good analog values while allowing BooleanState signals', () => {
    expect(evaluateAlarmCondition(createDefinition('High', 10), {
      id: 'currentTemperature',
      value: 20,
      quality: 'Bad',
      timestamp: '2026-08-18T00:00:00.000Z'
    })).toBeNull()

    expect(evaluateAlarmCondition(createDefinition('BooleanState', true), {
      id: 'device.simulated-plc.connectionLost',
      value: true,
      quality: 'Bad',
      timestamp: '2026-08-18T00:00:00.000Z'
    })).toBe(true)
  })

  it('uses deadband only while evaluating recovery', () => {
    const definition = createDefinition('High', 80, {
      deadband: 0.5
    })

    expect(evaluateAlarmCondition(definition, signal(79.7))).toBe(false)
    expect(evaluateAlarmCondition(definition, signal(79.7), true)).toBe(true)
    expect(evaluateAlarmCondition(definition, signal(79.4), true)).toBe(false)
  })
})

function evaluate(condition: AlarmCondition, value: number | boolean, threshold: number | boolean): boolean | null {
  return evaluateAlarmCondition(createDefinition(condition, threshold), signal(value))
}

function createDefinition(
  condition: AlarmCondition,
  threshold: number | boolean,
  overrides: Partial<AlarmDefinition> = {}
): AlarmDefinition {
  return {
    id: `alarm-${condition}`,
    code: `TEST_${condition}`,
    tagId: condition === 'BooleanState' ? 'device.simulated-plc.connectionLost' : 'currentTemperature',
    condition,
    threshold,
    delay: 1000,
    level: 'Warning',
    message: 'Test alarm',
    enabled: true,
    ...overrides
  }
}

function signal(value: number | boolean): AlarmSignal {
  return {
    id: typeof value === 'boolean' ? 'device.simulated-plc.connectionLost' : 'currentTemperature',
    value,
    quality: 'Good',
    timestamp: '2026-08-18T00:00:00.000Z'
  }
}
