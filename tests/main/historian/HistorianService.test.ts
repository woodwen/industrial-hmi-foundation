import { describe, expect, it, vi } from 'vitest'

import {
  HistorianDatabase,
  HistorianService,
  TagHistoryRepository
} from '../../../src/main/historian'
import type { Logger } from '../../../src/main/logging/logger'
import { TagCache } from '../../../src/main/tag'
import { DEFAULT_TAG_DEFINITIONS, type TagQuality, type TagValue } from '../../../src/shared/tag'

describe('HistorianService', () => {
  it('persists first sample, deadband changes, quality changes, and fixed interval samples only', () => {
    let nowMs = Date.parse('2026-08-18T00:00:00.000Z')
    const database = new HistorianDatabase(':memory:')
    const repository = new TagHistoryRepository(database.db)
    const service = new HistorianService(
      new TagCache(DEFAULT_TAG_DEFINITIONS, () => new Date(nowMs).toISOString()),
      repository,
      createLogger(),
      {
        now: () => new Date(nowMs).toISOString()
      }
    )

    try {
      expect(service.handleTagValues([tagValue('currentTemperature', 25, 'Good', nowMs)])).toHaveLength(1)

      nowMs += 1000
      expect(service.handleTagValues([tagValue('currentTemperature', 25.1, 'Good', nowMs)])).toHaveLength(0)

      nowMs += 1000
      expect(service.handleTagValues([tagValue('currentTemperature', 25.3, 'Good', nowMs)])).toHaveLength(1)

      nowMs += 1000
      expect(service.handleTagValues([tagValue('currentTemperature', 25.31, 'Bad', nowMs)])).toHaveLength(1)

      nowMs += 5000
      expect(service.handleTagValues([tagValue('currentTemperature', 25.31, 'Bad', nowMs)])).toHaveLength(1)

      expect(repository.queryRaw({
        tagIds: ['currentTemperature'],
        startMs: Date.parse('2026-08-18T00:00:00.000Z'),
        endMs: Date.parse('2026-08-18T00:00:08.000Z')
      })).toHaveLength(4)
    } finally {
      service.dispose()
      database.close()
    }
  })

  it('logs and drops a failed history write without throwing into the realtime Tag path', () => {
    const logger = createLogger()
    const repository = {
      insertBatch: vi.fn(() => {
        throw new Error('database is locked')
      })
    } as unknown as TagHistoryRepository
    const service = new HistorianService(
      new TagCache(DEFAULT_TAG_DEFINITIONS),
      repository,
      logger,
      {
        now: () => '2026-08-18T00:00:00.000Z'
      }
    )

    try {
      expect(service.handleTagValues([
        tagValue('currentTemperature', 25, 'Good', Date.parse('2026-08-18T00:00:00.000Z'))
      ])).toEqual([])
      expect(logger.write).toHaveBeenCalledWith(expect.objectContaining({
        category: 'error',
        message: 'Failed to persist Tag History batch'
      }))
    } finally {
      service.dispose()
    }
  })
})

function tagValue(tagId: string, value: TagValue['value'], quality: TagQuality, timestampMs: number): TagValue {
  return {
    tagId,
    value,
    quality,
    timestamp: new Date(timestampMs).toISOString()
  }
}

function createLogger(): Logger {
  return {
    write: vi.fn()
  }
}
