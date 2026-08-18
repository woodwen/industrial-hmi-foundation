import { describe, expect, it, vi } from 'vitest'

import { TagCache, TagService, decodeTagRawValue } from '../../../src/main/tag'
import { DEFAULT_TAG_DEFINITIONS, TAG_QUALITIES, type TagDefinition, type TagValue } from '../../../src/shared/tag'

describe('Tag model defaults', () => {
  it('defines required fields, quality states, and default scan rates', () => {
    expect(TAG_QUALITIES).toEqual(['Good', 'Bad', 'Uncertain'])
    expect(DEFAULT_TAG_DEFINITIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'currentTemperature',
        name: '当前温度',
        deviceId: 'simulated-mixer-plc',
        address: 0,
        registerType: 'inputRegister',
        dataType: 'int16',
        scale: 0.1,
        offset: 0,
        unit: '°C',
        writable: false,
        scanRate: 500,
        dashboardRole: 'temperature'
      }),
      expect.objectContaining({
        id: 'productionCount',
        scanRate: 1000,
        dashboardRole: 'productionCount'
      }),
      expect.objectContaining({
        id: 'targetTemperature',
        writable: true,
        scanRate: 1000,
        dashboardRole: undefined
      })
    ]))
  })
})

describe('TagService', () => {
  it('decodes raw values, applies scale and offset, and produces Good TagValues', () => {
    const tagService = new TagService(undefined, createLogger())
    const temperature = requiredDefinition('currentTemperature')
    const productionCount = requiredDefinition('productionCount')

    expect(decodeTagRawValue(temperature, [255])).toBe(25.5)
    expect(decodeTagRawValue({
      ...temperature,
      offset: 2
    }, [255])).toBe(27.5)
    expect(decodeTagRawValue(productionCount, [0x0001, 0x0002])).toBe(65538)

    const values = tagService.decodeGroupResult({
      id: 'test',
      deviceId: 'simulated-mixer-plc',
      scanRate: 500,
      registerType: 'inputRegister',
      startAddress: 0,
      quantity: 4,
      tags: [
        requiredDefinition('currentTemperature'),
        requiredDefinition('currentLevel'),
        requiredDefinition('currentPressure'),
        requiredDefinition('motorRpm')
      ]
    }, {
      area: 'inputRegister',
      address: 0,
      quantity: 4,
      values: [255, 412, 12, 900]
    }, '2026-08-18T00:00:00.000Z')

    expect(values).toEqual([
      expect.objectContaining({ tagId: 'currentTemperature', value: 25.5, quality: 'Good' }),
      expect.objectContaining({ tagId: 'currentLevel', value: 41.2, quality: 'Good' }),
      expect.objectContaining({ tagId: 'currentPressure', value: 0.12, quality: 'Good' }),
      expect.objectContaining({ tagId: 'motorRpm', value: 900, quality: 'Good' })
    ])
  })

  it('turns decode failures into Bad TagValues without throwing', () => {
    const logger = createLogger()
    const tagService = new TagService(undefined, logger)
    const [value] = tagService.decodeGroupResult({
      id: 'test',
      deviceId: 'simulated-mixer-plc',
      scanRate: 500,
      registerType: 'inputRegister',
      startAddress: 0,
      quantity: 1,
      tags: [requiredDefinition('currentTemperature')]
    }, {
      area: 'inputRegister',
      address: 0,
      quantity: 1,
      values: [true]
    }, '2026-08-18T00:00:00.000Z')

    expect(value).toEqual({
      tagId: 'currentTemperature',
      value: null,
      quality: 'Bad',
      timestamp: '2026-08-18T00:00:00.000Z'
    })
    expect(logger.write).toHaveBeenCalledWith(expect.objectContaining({
      category: 'error',
      message: 'Failed to decode Tag value'
    }))
  })
})

describe('TagCache', () => {
  it('initializes all Tags as Uncertain and returns snapshots with timestamps', () => {
    const cache = new TagCache(DEFAULT_TAG_DEFINITIONS, () => '2026-08-18T00:00:00.000Z')
    const snapshot = cache.getSnapshot('simulated-mixer-plc')

    expect(snapshot.definitions).toHaveLength(DEFAULT_TAG_DEFINITIONS.length)
    expect(snapshot.values).toHaveLength(DEFAULT_TAG_DEFINITIONS.length)
    expect(snapshot.values.every((value) => value.quality === 'Uncertain' && value.timestamp)).toBe(true)
  })

  it('updates values in batches and only emits semantic changes', () => {
    const cache = new TagCache(DEFAULT_TAG_DEFINITIONS, () => '2026-08-18T00:00:00.000Z')
    const listener = vi.fn<(values: TagValue[]) => void>()
    cache.subscribe(listener)

    expect(cache.setValues([{
      tagId: 'currentTemperature',
      value: 25.5,
      quality: 'Good',
      timestamp: '2026-08-18T00:00:01.000Z'
    }])).toHaveLength(1)

    expect(cache.setValues([{
      tagId: 'currentTemperature',
      value: 25.5,
      quality: 'Good',
      timestamp: '2026-08-18T00:00:02.000Z'
    }])).toEqual([])

    expect(listener).toHaveBeenCalledTimes(1)
    expect(cache.getValue('currentTemperature')).toMatchObject({
      value: 25.5,
      quality: 'Good',
      timestamp: '2026-08-18T00:00:02.000Z'
    })
  })

  it('marks device values with requested quality while preserving last value', () => {
    const cache = new TagCache(DEFAULT_TAG_DEFINITIONS, () => '2026-08-18T00:00:00.000Z')
    cache.setValues([{
      tagId: 'currentTemperature',
      value: 25.5,
      quality: 'Good',
      timestamp: '2026-08-18T00:00:01.000Z'
    }])

    cache.markDeviceQuality('simulated-mixer-plc', 'Bad', '2026-08-18T00:00:02.000Z')

    expect(cache.getValue('currentTemperature')).toEqual({
      tagId: 'currentTemperature',
      value: 25.5,
      quality: 'Bad',
      timestamp: '2026-08-18T00:00:02.000Z'
    })
  })
})

function requiredDefinition(tagId: string): TagDefinition {
  const definition = DEFAULT_TAG_DEFINITIONS.find((tag) => tag.id === tagId)
  if (!definition) {
    throw new Error(`Missing test TagDefinition ${tagId}`)
  }
  return definition
}

function createLogger() {
  return {
    write: vi.fn()
  }
}
