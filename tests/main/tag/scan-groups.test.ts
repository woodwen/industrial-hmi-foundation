import { describe, expect, it } from 'vitest'

import { buildScanGroups } from '../../../src/main/tag'
import { DEFAULT_TAG_DEFINITIONS, type TagDefinition } from '../../../src/shared/tag'

describe('Scan Group builder', () => {
  it('groups Tags by device, scan rate, register type, and continuous addresses', () => {
    const groups = buildScanGroups(DEFAULT_TAG_DEFINITIONS)

    expect(groups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        deviceId: 'simulated-mixer-plc',
        scanRate: 500,
        registerType: 'inputRegister',
        startAddress: 0,
        quantity: 4,
        tags: expect.arrayContaining([
          expect.objectContaining({ id: 'currentTemperature' }),
          expect.objectContaining({ id: 'motorRpm' })
        ])
      }),
      expect.objectContaining({
        scanRate: 1000,
        registerType: 'holdingRegister',
        startAddress: 0,
        quantity: 2,
        tags: expect.arrayContaining([
          expect.objectContaining({ id: 'targetTemperature' }),
          expect.objectContaining({ id: 'manualMotorRpmSetpoint' })
        ])
      })
    ]))

    const tagCount = DEFAULT_TAG_DEFINITIONS.length
    expect(groups.length).toBeLessThan(tagCount)
  })

  it('can batch continuous input registers 30001 through 30006 when scan rates match', () => {
    const definitions = DEFAULT_TAG_DEFINITIONS.map((definition) => (
      definition.registerType === 'inputRegister' ? { ...definition, scanRate: 500 as const } : definition
    ))

    expect(buildScanGroups(definitions)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scanRate: 500,
        registerType: 'inputRegister',
        startAddress: 0,
        quantity: 6,
        tags: expect.arrayContaining([
          expect.objectContaining({ id: 'currentTemperature' }),
          expect.objectContaining({ id: 'productionCount' })
        ])
      })
    ]))
  })

  it('can batch continuous discrete inputs 10001 through 10005 when all statuses are configured', () => {
    const base = DEFAULT_TAG_DEFINITIONS.find((definition) => definition.id === 'deviceRunningStatus')!
    const definitions: TagDefinition[] = Array.from({ length: 5 }, (_, index) => ({
      ...base,
      id: `discreteStatus${index + 1}`,
      address: index,
      referenceAddress: `1000${index + 1}`,
      displayOrder: index + 1
    }))

    expect(buildScanGroups(definitions)).toEqual([
      expect.objectContaining({
        scanRate: 500,
        registerType: 'discreteInput',
        startAddress: 0,
        quantity: 5,
        tags: expect.arrayContaining([
          expect.objectContaining({ id: 'discreteStatus1' }),
          expect.objectContaining({ id: 'discreteStatus5' })
        ])
      })
    ])
  })

  it('splits address gaps instead of blindly reading undefined ranges', () => {
    const base = DEFAULT_TAG_DEFINITIONS[0]
    const definitions: TagDefinition[] = [
      {
        ...base,
        id: 'first',
        address: 0,
        quantity: 1
      },
      {
        ...base,
        id: 'second',
        address: 2,
        quantity: 1
      }
    ]

    const groups = buildScanGroups(definitions)

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.startAddress)).toEqual([0, 2])
  })
})
