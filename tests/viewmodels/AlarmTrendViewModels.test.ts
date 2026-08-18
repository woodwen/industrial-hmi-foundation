import { describe, expect, it, vi } from 'vitest'

import { AppApplicationService, type HmiApiClient } from '../../src/renderer/application/AppApplicationService'
import { AlarmViewModel } from '../../src/renderer/viewmodels/AlarmViewModel'
import {
  DEFAULT_REALTIME_TREND_MAX_POINTS,
  type TrendPoint
} from '../../src/shared/trend'
import { DEFAULT_TREND_TAG_IDS, TrendViewModel } from '../../src/renderer/viewmodels/TrendViewModel'
import type {
  AlarmChangedEvent,
  AlarmOccurrence,
  HmiResult,
  RealtimeTrendChangedEvent
} from '../../src/shared/hmi-api'
import { createApiClientStub } from '../support/hmi-api-client-stub'

describe('AlarmViewModel', () => {
  it('loads realtime and history alarms, subscribes to updates, and acknowledges alarms', async () => {
    const unsubscribe = vi.fn()
    let listener: ((event: AlarmChangedEvent) => void) | undefined
    const activeOccurrence = createAlarmOccurrence('Active')
    const acknowledgedOccurrence = {
      ...activeOccurrence,
      status: 'Acknowledged' as const,
      acknowledgeTime: '2026-08-18T00:01:00.000Z',
      acknowledgeUser: 'operator',
      updatedAt: '2026-08-18T00:01:00.000Z'
    }
    const apiClient = createApiClientStub({
      getAlarmSnapshot: vi.fn<HmiApiClient['getAlarmSnapshot']>().mockResolvedValue(success({
        occurrences: [activeOccurrence],
        emittedAt: '2026-08-18T00:00:00.000Z'
      })),
      subscribeAlarms: vi.fn<HmiApiClient['subscribeAlarms']>((nextListener) => {
        listener = nextListener
        return unsubscribe
      }),
      acknowledgeAlarm: vi.fn<HmiApiClient['acknowledgeAlarm']>().mockResolvedValue(success(acknowledgedOccurrence)),
      queryAlarmHistory: vi.fn<HmiApiClient['queryAlarmHistory']>().mockResolvedValue(success({
        rows: [{
          ...acknowledgedOccurrence,
          createdAt: activeOccurrence.triggerTime
        }],
        emittedAt: '2026-08-18T00:01:00.000Z'
      }))
    })
    const viewModel = new AlarmViewModel(new AppApplicationService(apiClient))

    await viewModel.initialize()

    expect(viewModel.realtimeRows).toEqual([activeOccurrence])
    expect(viewModel.historyRows).toHaveLength(1)
    expect(apiClient.subscribeAlarms).toHaveBeenCalled()

    await viewModel.acknowledge(activeOccurrence.id)

    expect(apiClient.acknowledgeAlarm).toHaveBeenCalledWith({
      occurrenceId: activeOccurrence.id
    })
    expect(viewModel.realtimeRows[0]).toMatchObject({
      status: 'Acknowledged',
      acknowledgeUser: 'operator'
    })

    viewModel.setLevelFilter('High')
    viewModel.setStatusFilter('Recovered')
    viewModel.setTagFilter(' currentTemperature ')
    viewModel.setAcknowledgeUserFilter(' operator ')
    viewModel.setStartTime('2026-08-18T00:00:00.000Z')
    viewModel.setEndTime('2026-08-18T01:00:00.000Z')
    await viewModel.queryHistory()

    expect(apiClient.queryAlarmHistory).toHaveBeenLastCalledWith({
      level: 'High',
      status: 'Recovered',
      tagId: 'currentTemperature',
      acknowledgeUser: 'operator',
      startTime: '2026-08-18T00:00:00.000Z',
      endTime: '2026-08-18T01:00:00.000Z',
      limit: 200
    })

    listener?.({
      occurrences: [{
        ...acknowledgedOccurrence,
        status: 'Recovered',
        recoverTime: '2026-08-18T00:02:00.000Z',
        recoverValue: 79,
        conditionActive: false,
        updatedAt: '2026-08-18T00:02:00.000Z'
      }],
      emittedAt: '2026-08-18T00:02:00.000Z'
    })

    expect(viewModel.realtimeRows[0]).toMatchObject({
      status: 'Recovered',
      conditionActive: false
    })

    viewModel.dispose()
    expect(unsubscribe).toHaveBeenCalled()
  })
})

describe('TrendViewModel', () => {
  it('loads realtime and historical trend points and subscribes to realtime updates', async () => {
    const unsubscribe = vi.fn()
    let listener: ((event: RealtimeTrendChangedEvent) => void) | undefined
    const initialPoint = trendPoint('currentTemperature', 25, 0)
    const historicalPoint = trendPoint('currentTemperature', 24, -3600)
    const apiClient = createApiClientStub({
      getRealtimeTrendSnapshot: vi.fn<HmiApiClient['getRealtimeTrendSnapshot']>().mockResolvedValue(success({
        points: [initialPoint],
        emittedAt: '2026-08-18T00:00:00.000Z'
      })),
      subscribeRealtimeTrend: vi.fn<HmiApiClient['subscribeRealtimeTrend']>((_request, nextListener) => {
        listener = nextListener
        return unsubscribe
      }),
      queryHistoricalTrend: vi.fn<HmiApiClient['queryHistoricalTrend']>().mockResolvedValue(success({
        points: [historicalPoint],
        aggregated: false,
        startTime: '2026-08-17T23:00:00.000Z',
        endTime: '2026-08-18T00:00:00.000Z',
        emittedAt: '2026-08-18T00:00:00.000Z'
      }))
    })
    const viewModel = new TrendViewModel(new AppApplicationService(apiClient))

    await viewModel.initialize()

    expect(apiClient.getRealtimeTrendSnapshot).toHaveBeenCalledWith({
      tagIds: [...DEFAULT_TREND_TAG_IDS]
    })
    expect(viewModel.realtimePoints.get('currentTemperature')).toEqual([initialPoint])
    expect(viewModel.historicalPoints.get('currentTemperature')).toEqual([historicalPoint])

    listener?.({
      points: [trendPoint('currentTemperature', 26, 1)],
      emittedAt: '2026-08-18T00:00:01.000Z'
    })

    expect(viewModel.realtimePoints.get('currentTemperature')).toHaveLength(2)

    viewModel.setPreset('custom')
    viewModel.setCustomStartTime('2026-08-17T23:00:00.000Z')
    viewModel.setCustomEndTime('2026-08-18T00:00:00.000Z')
    await viewModel.queryHistorical()

    expect(apiClient.queryHistoricalTrend).toHaveBeenLastCalledWith({
      tagIds: [...DEFAULT_TREND_TAG_IDS],
      preset: 'custom',
      startTime: '2026-08-17T23:00:00.000Z',
      endTime: '2026-08-18T00:00:00.000Z',
      maxPointsPerTag: 1000
    })

    viewModel.dispose()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('trims realtime points to the configured per-tag maximum', () => {
    const viewModel = new TrendViewModel(new AppApplicationService(createApiClientStub()))

    for (let index = 0; index <= DEFAULT_REALTIME_TREND_MAX_POINTS; index += 1) {
      viewModel.applyRealtimeTrendEvent({
        points: [trendPoint('currentTemperature', index, index)],
        emittedAt: new Date(Date.parse('2026-08-18T00:00:00.000Z') + index * 1000).toISOString()
      })
    }

    const points = viewModel.realtimePoints.get('currentTemperature') ?? []
    expect(points).toHaveLength(DEFAULT_REALTIME_TREND_MAX_POINTS)
    expect(points[0]?.value).toBe(1)
    expect(points[points.length - 1]?.value).toBe(DEFAULT_REALTIME_TREND_MAX_POINTS)
  })
})

function createAlarmOccurrence(status: AlarmOccurrence['status']): AlarmOccurrence {
  return {
    id: 'alarm-temp-high-1787011200000',
    definitionId: 'alarm-temp-high',
    code: 'TEMP_HIGH',
    tagId: 'currentTemperature',
    level: 'High',
    message: 'Temperature is too high',
    status,
    triggerTime: '2026-08-18T00:00:00.000Z',
    triggerValue: 82,
    conditionActive: true,
    updatedAt: '2026-08-18T00:00:00.000Z'
  }
}

function trendPoint(tagId: string, value: number, offsetSeconds: number): TrendPoint {
  return {
    tagId,
    value,
    quality: 'Good',
    timestamp: new Date(Date.parse('2026-08-18T00:00:00.000Z') + offsetSeconds * 1000).toISOString()
  }
}

function success<T>(data: T): HmiResult<T> {
  return {
    ok: true,
    data
  }
}
