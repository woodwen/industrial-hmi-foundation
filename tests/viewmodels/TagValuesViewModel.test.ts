import { describe, expect, it, vi } from 'vitest'

import { AppApplicationService, type HmiApiClient } from '../../src/renderer/application/AppApplicationService'
import { TagValuesViewModel } from '../../src/renderer/viewmodels/TagValuesViewModel'
import { DEFAULT_TAG_DEFINITIONS, type TagValuesChangedEvent } from '../../src/shared/tag'
import { createApiClientStub } from '../support/hmi-api-client-stub'

describe('TagValuesViewModel', () => {
  it('loads an initial snapshot and subscribes to batched updates', async () => {
    const unsubscribe = vi.fn()
    const listeners: Array<(event: TagValuesChangedEvent) => void> = []
    const apiClient = createApiClientStub({
      subscribeTagValues: vi.fn<HmiApiClient['subscribeTagValues']>((nextListener) => {
        listeners.push(nextListener)
        return unsubscribe
      })
    })
    const viewModel = new TagValuesViewModel(new AppApplicationService(apiClient))

    await viewModel.initialize()

    expect(viewModel.isInitialized).toBe(true)
    expect(apiClient.getTagSnapshot).toHaveBeenCalled()
    expect(apiClient.subscribeTagValues).toHaveBeenCalled()
    expect(viewModel.tagMonitorRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tagId: 'targetTemperature',
        quality: 'Uncertain'
      })
    ]))

    emit(listeners, {
      deviceId: 'simulated-mixer-plc',
      values: [
        {
          tagId: 'currentTemperature',
          value: 25.5,
          quality: 'Good',
          timestamp: '2026-08-18T00:00:01.000Z'
        },
        {
          tagId: 'deviceRunningStatus',
          value: true,
          quality: 'Good',
          timestamp: '2026-08-18T00:00:01.000Z'
        }
      ],
      emittedAt: '2026-08-18T00:00:01.000Z'
    })

    expect(viewModel.dashboardMetrics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'temperature',
        value: '25.5 °C',
        quality: 'Good'
      }),
      expect.objectContaining({
        id: 'runningState',
        value: 'ON',
        quality: 'Good'
      })
    ]))

    viewModel.dispose()
    expect(unsubscribe).toHaveBeenCalled()
  })

  it('derives Bad quality for Dashboard and monitor rows from batch events', async () => {
    const apiClient = createApiClientStub()
    const viewModel = new TagValuesViewModel(new AppApplicationService(apiClient))

    await viewModel.initialize()
    viewModel.applyTagEvent({
      deviceId: 'simulated-mixer-plc',
      values: [{
        tagId: DEFAULT_TAG_DEFINITIONS[0].id,
        value: 25.5,
        quality: 'Bad',
        timestamp: '2026-08-18T00:00:02.000Z'
      }],
      emittedAt: '2026-08-18T00:00:02.000Z'
    })

    expect(viewModel.dashboardMetrics[0]).toMatchObject({
      quality: 'Bad',
      timestamp: '2026-08-18T00:00:02.000Z'
    })
    expect(viewModel.tagMonitorRows[0]).toMatchObject({
      quality: 'Bad',
      timestamp: '2026-08-18T00:00:02.000Z'
    })
  })
})

function emit(listeners: Array<(event: TagValuesChangedEvent) => void>, event: TagValuesChangedEvent): void {
  const listener = listeners[0]
  if (!listener) {
    throw new Error('Tag listener was not registered.')
  }
  listener(event)
}
