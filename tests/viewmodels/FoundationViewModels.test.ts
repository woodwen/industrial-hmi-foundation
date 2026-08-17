import { describe, expect, it } from 'vitest'

import { DashboardViewModel } from '../../src/renderer/viewmodels/DashboardViewModel'
import { DeviceViewModel } from '../../src/renderer/viewmodels/DeviceViewModel'

describe('Foundation ViewModels', () => {
  it('provides dashboard frame state without live data collection', () => {
    const viewModel = new DashboardViewModel()

    expect(viewModel.summaryCards).toHaveLength(3)
    expect(viewModel.realtimeStateKey).toBe('dashboard.realtime.state')
  })

  it('provides device frame state without real connections', () => {
    const viewModel = new DeviceViewModel()

    expect(viewModel.connectionStateKey).toBe('device.connection.title')
    expect(viewModel.emptyStateKey).toBe('device.connection.empty')
  })
})
