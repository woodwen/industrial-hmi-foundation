import { describe, expect, it } from 'vitest'

import {
  HistorianDatabase,
  TagHistoryRepository,
  TrendQueryService
} from '../../../src/main/historian'

describe('TrendQueryService', () => {
  it('returns raw historical trend points when the range is below the query cap', () => {
    const database = new HistorianDatabase(':memory:')
    const repository = new TagHistoryRepository(database.db)
    const service = new TrendQueryService(repository, () => Date.parse('2026-08-18T01:00:00.000Z'))

    try {
      repository.insertBatch([
        sample('currentTemperature', '2026-08-18T00:00:00.000Z', 10),
        sample('currentTemperature', '2026-08-18T00:00:01.000Z', 20)
      ])

      expect(service.queryHistorical({
        tagIds: ['currentTemperature'],
        preset: 'custom',
        startTime: '2026-08-18T00:00:00.000Z',
        endTime: '2026-08-18T00:00:02.000Z',
        maxPointsPerTag: 2
      })).toMatchObject({
        aggregated: false,
        points: [
          expect.objectContaining({
            tagId: 'currentTemperature',
            value: 10,
            quality: 'Good'
          }),
          expect.objectContaining({
            tagId: 'currentTemperature',
            value: 20,
            quality: 'Good'
          })
        ]
      })
    } finally {
      database.close()
    }
  })

  it('aggregates historical trend points in SQLite when a tag exceeds the query cap', () => {
    const database = new HistorianDatabase(':memory:')
    const repository = new TagHistoryRepository(database.db)
    const service = new TrendQueryService(repository, () => Date.parse('2026-08-18T01:00:00.000Z'))

    try {
      repository.insertBatch([
        sample('currentTemperature', '2026-08-18T00:00:00.000Z', 1),
        sample('currentTemperature', '2026-08-18T00:00:01.000Z', 3, 'Bad'),
        sample('currentTemperature', '2026-08-18T00:00:02.000Z', 5),
        sample('currentTemperature', '2026-08-18T00:00:03.000Z', 7)
      ])

      expect(service.queryHistorical({
        tagIds: ['currentTemperature'],
        preset: 'custom',
        startTime: '2026-08-18T00:00:00.000Z',
        endTime: '2026-08-18T00:00:03.999Z',
        maxPointsPerTag: 2
      })).toEqual({
        aggregated: true,
        bucketMs: 2000,
        startTime: '2026-08-18T00:00:00.000Z',
        endTime: '2026-08-18T00:00:03.999Z',
        emittedAt: '2026-08-18T01:00:00.000Z',
        points: [
          {
            tagId: 'currentTemperature',
            timestamp: '2026-08-18T00:00:00.000Z',
            value: 2,
            min: 1,
            max: 3,
            last: 3,
            quality: 'Bad'
          },
          {
            tagId: 'currentTemperature',
            timestamp: '2026-08-18T00:00:02.000Z',
            value: 6,
            min: 5,
            max: 7,
            last: 7,
            quality: 'Good'
          }
        ]
      })
    } finally {
      database.close()
    }
  })

  it('keeps aggregated results within the per-tag cap when a point falls on the range end', () => {
    const database = new HistorianDatabase(':memory:')
    const repository = new TagHistoryRepository(database.db)
    const service = new TrendQueryService(repository, () => Date.parse('2026-08-18T01:00:00.000Z'))

    try {
      repository.insertBatch([
        sample('currentTemperature', '2026-08-18T00:00:00.000Z', 1),
        sample('currentTemperature', '2026-08-18T00:00:01.000Z', 3),
        sample('currentTemperature', '2026-08-18T00:00:02.000Z', 5)
      ])

      const result = service.queryHistorical({
        tagIds: ['currentTemperature'],
        preset: 'custom',
        startTime: '2026-08-18T00:00:00.000Z',
        endTime: '2026-08-18T00:00:02.000Z',
        maxPointsPerTag: 2
      })

      expect(result.aggregated).toBe(true)
      expect(result.points).toHaveLength(2)
      expect(result.points).toEqual([
        expect.objectContaining({
          value: 2,
          min: 1,
          max: 3,
          last: 3
        }),
        expect.objectContaining({
          value: 5,
          min: 5,
          max: 5,
          last: 5
        })
      ])
    } finally {
      database.close()
    }
  })

  it('does not let callers raise the default historical query cap above 1000 points per tag', () => {
    const database = new HistorianDatabase(':memory:')
    const repository = new TagHistoryRepository(database.db)
    const service = new TrendQueryService(repository, () => Date.parse('2026-08-18T01:00:00.000Z'))

    try {
      repository.insertBatch(Array.from({ length: 1001 }, (_entry, index) => (
        sample('currentTemperature', timestampAtSecond(index), index)
      )))

      const result = service.queryHistorical({
        tagIds: ['currentTemperature'],
        preset: 'custom',
        startTime: timestampAtSecond(0),
        endTime: timestampAtSecond(1000),
        maxPointsPerTag: 5000
      })

      expect(result.aggregated).toBe(true)
      expect(result.points).toHaveLength(1000)
    } finally {
      database.close()
    }
  })
})

function sample(
  tagId: string,
  timestamp: string,
  value: number,
  quality: 'Good' | 'Bad' | 'Uncertain' = 'Good'
) {
  return {
    tagId,
    timestamp,
    value,
    quality
  }
}

function timestampAtSecond(offsetSeconds: number): string {
  return new Date(Date.parse('2026-08-18T00:00:00.000Z') + offsetSeconds * 1000).toISOString()
}
