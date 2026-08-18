import { describe, expect, it } from 'vitest'

import { DashboardViewModel } from '../../src/renderer/viewmodels/DashboardViewModel'
import { DeviceViewModel } from '../../src/renderer/viewmodels/DeviceViewModel'
import { AppApplicationService } from '../../src/renderer/application/AppApplicationService'
import { createApiClientStub } from '../support/hmi-api-client-stub'

describe('Foundation ViewModels', () => {
  it('provides dashboard frame state without live data collection', () => {
    const viewModel = new DashboardViewModel()

    expect(viewModel.summaryCards).toHaveLength(3)
    expect(viewModel.realtimeStateKey).toBe('dashboard.realtime.state')
  })

  it('provides device connection state for manual protocol verification', () => {
    const viewModel = new DeviceViewModel(new AppApplicationService(createApiClientStub()))

    expect(viewModel.descriptionKey).toBe('device.description')
    expect(viewModel.connectionStatusKey).toBe('device.status.disconnected')
    expect(viewModel.endpointLabel).toBe('127.0.0.1:1502 / Unit 1')
  })
})
