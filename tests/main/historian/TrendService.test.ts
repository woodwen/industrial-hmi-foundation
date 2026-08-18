import { describe, expect, it, vi } from 'vitest'

import { RingBuffer, TrendService } from '../../../src/main/historian'
import { TagCache } from '../../../src/main/tag'
import { DEFAULT_TAG_DEFINITIONS } from '../../../src/shared/tag'

describe('TrendService', () => {
  it('evicts oldest realtime points from the Ring Buffer', () => {
    const buffer = new RingBuffer<number>(2)

    buffer.push(1)
    buffer.push(2)
    buffer.push(3)

    expect(buffer.toArray()).toEqual([2, 3])
  })

  it('samples numeric trend tags without exceeding the per-tag point cap', () => {
    let nowMs = Date.parse('2026-08-18T00:00:00.000Z')
    const cache = new TagCache(DEFAULT_TAG_DEFINITIONS, () => new Date(nowMs).toISOString())
    const service = new TrendService(cache, {
      autoStart: false,
      maxPointsPerTag: 2,
      now: () => new Date(nowMs).toISOString()
    })
    const listener = vi.fn()

    service.subscribe(listener)

    try {
      setTemperature(cache, 25, nowMs)
      service.sampleOnce()

      nowMs += 1000
      setTemperature(cache, 26, nowMs)
      service.sampleOnce()

      nowMs += 1000
      setTemperature(cache, 27, nowMs)
      service.sampleOnce()

      expect(service.getSnapshot(['currentTemperature']).points).toEqual([
        {
          tagId: 'currentTemperature',
          timestamp: '2026-08-18T00:00:01.000Z',
          value: 26,
          quality: 'Good'
        },
        {
          tagId: 'currentTemperature',
          timestamp: '2026-08-18T00:00:02.000Z',
          value: 27,
          quality: 'Good'
        }
      ])
      expect(listener).toHaveBeenCalledTimes(3)
    } finally {
      service.dispose()
    }
  })
})

function setTemperature(cache: TagCache, value: number, timestampMs: number): void {
  cache.setValues([{
    tagId: 'currentTemperature',
    value,
    quality: 'Good',
    timestamp: new Date(timestampMs).toISOString()
  }])
}
