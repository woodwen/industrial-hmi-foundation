import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { AlarmHistoryRepository } from '../../../src/main/alarm'
import {
  HistorianDatabase,
  TagHistoryRepository
} from '../../../src/main/historian'
import type { AlarmOccurrence } from '../../../src/shared/alarm'

describe('SQLite historian persistence', () => {
  let tempDir: string | null = null

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, {
        recursive: true,
        force: true
      })
      tempDir = null
    }
  })

  it('persists Tag History across database reopen', () => {
    const databasePath = createDatabasePath()
    const firstDatabase = new HistorianDatabase(databasePath)
    const firstRepository = new TagHistoryRepository(firstDatabase.db)

    firstRepository.insertBatch([{
      tagId: 'currentTemperature',
      timestamp: '2026-08-18T01:00:00.000Z',
      value: 42.5,
      quality: 'Good'
    }])
    firstDatabase.close()

    const reopenedDatabase = new HistorianDatabase(databasePath)
    const reopenedRepository = new TagHistoryRepository(reopenedDatabase.db)

    try {
      expect(reopenedRepository.queryRaw({
        tagIds: ['currentTemperature'],
        startMs: Date.parse('2026-08-18T00:00:00.000Z'),
        endMs: Date.parse('2026-08-18T02:00:00.000Z')
      })).toEqual([{
        tagId: 'currentTemperature',
        timestamp: '2026-08-18T01:00:00.000Z',
        value: 42.5,
        quality: 'Good'
      }])
    } finally {
      reopenedDatabase.close()
    }
  })

  it('persists alarm acknowledge and recovery fields across database reopen', () => {
    const databasePath = createDatabasePath()
    const firstDatabase = new HistorianDatabase(databasePath)
    const firstRepository = new AlarmHistoryRepository(firstDatabase.db)
    const occurrence = createOccurrence()

    firstRepository.createOccurrence(occurrence)
    firstRepository.updateAcknowledge({
      ...occurrence,
      status: 'Acknowledged',
      acknowledgeTime: '2026-08-18T01:01:00.000Z',
      acknowledgeUser: 'operator',
      updatedAt: '2026-08-18T01:01:00.000Z'
    })
    firstRepository.updateRecovery({
      ...occurrence,
      status: 'Recovered',
      acknowledgeTime: '2026-08-18T01:01:00.000Z',
      acknowledgeUser: 'operator',
      recoverTime: '2026-08-18T01:02:00.000Z',
      recoverValue: 77,
      conditionActive: false,
      updatedAt: '2026-08-18T01:02:00.000Z'
    })
    firstDatabase.close()

    const reopenedDatabase = new HistorianDatabase(databasePath)
    const reopenedRepository = new AlarmHistoryRepository(reopenedDatabase.db)

    try {
      expect(reopenedRepository.queryHistory({
        tagId: 'currentTemperature'
      }).rows[0]).toMatchObject({
        id: occurrence.id,
        status: 'Recovered',
        acknowledgeTime: '2026-08-18T01:01:00.000Z',
        recoverTime: '2026-08-18T01:02:00.000Z',
        triggerValue: 82,
        recoverValue: 77,
        acknowledgeUser: 'operator',
        conditionActive: false
      })
      expect(reopenedRepository.queryHistory({
        level: 'High',
        status: 'Recovered',
        tagId: 'currentTemperature',
        acknowledgeUser: 'operator',
        startTime: '2026-08-18T00:59:00.000Z',
        endTime: '2026-08-18T01:01:00.000Z'
      }).rows).toHaveLength(1)
      expect(reopenedRepository.queryHistory({
        status: 'Active',
        tagId: 'currentTemperature'
      }).rows).toEqual([])
    } finally {
      reopenedDatabase.close()
    }
  })

  function createDatabasePath(): string {
    tempDir = mkdtempSync(join(tmpdir(), 'industrial-hmi-test-'))
    return join(tempDir, 'historian.sqlite')
  }
})

function createOccurrence(): AlarmOccurrence {
  return {
    id: 'alarm-temp-high-1787014800000',
    definitionId: 'alarm-temp-high',
    code: 'TEMP_HIGH',
    tagId: 'currentTemperature',
    level: 'High',
    message: 'Temperature is too high',
    status: 'Active',
    triggerTime: '2026-08-18T01:00:00.000Z',
    triggerValue: 82,
    conditionActive: true,
    updatedAt: '2026-08-18T01:00:00.000Z'
  }
}
