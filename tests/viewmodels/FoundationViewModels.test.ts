import { describe, expect, it } from 'vitest'

import { DashboardViewModel } from '../../src/renderer/viewmodels/DashboardViewModel'
import { DeviceViewModel } from '../../src/renderer/viewmodels/DeviceViewModel'

describe('Foundation ViewModels', () => {
  it('provides dashboard frame state without live data collection', () => {
    const viewModel = new DashboardViewModel()

    expect(viewModel.summaryCards).toHaveLength(3)
    expect(viewModel.realtimeStateLabel).toContain('not configured')
  })

  it('provides device frame state without real connections', () => {
    const viewModel = new DeviceViewModel()

    expect(viewModel.connectionStateLabel).toBe('No device connections configured')
    expect(viewModel.emptyStateMessage).toContain('intentionally not implemented')
  })
})
