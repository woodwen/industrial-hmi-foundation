import { describe, expect, it, vi } from 'vitest'

import type { AppApplicationService } from '../../src/renderer/application/AppApplicationService'
import { AppViewModel } from '../../src/renderer/viewmodels/AppViewModel'
import type { AppInfo, HmiResult } from '../../src/shared/hmi-api'

function createAppServiceStub(): AppApplicationService {
  return {
    getAppInfo: vi.fn<() => Promise<HmiResult<AppInfo>>>().mockResolvedValue({
      ok: true,
      data: {
        name: 'Industrial HMI Foundation',
        version: '0.1.0',
        environment: 'development'
      }
    }),
    writeApplicationLog: vi.fn<() => Promise<HmiResult<void>>>().mockResolvedValue({
      ok: true,
      data: undefined
    }),
    reportError: vi.fn<() => Promise<HmiResult<void>>>().mockResolvedValue({
      ok: true,
      data: undefined
    })
  } as unknown as AppApplicationService
}

describe('AppViewModel', () => {
  it('starts on the dashboard page', () => {
    const viewModel = new AppViewModel(createAppServiceStub())

    expect(viewModel.activePage).toBe('dashboard')
    expect(viewModel.activePageTitle).toBe('Dashboard')
  })

  it('updates active page through navigation action', () => {
    const service = createAppServiceStub()
    const viewModel = new AppViewModel(service)

    viewModel.navigate('device')

    expect(viewModel.activePage).toBe('device')
    expect(viewModel.activePageTitle).toBe('Device')
    expect(service.writeApplicationLog).toHaveBeenCalledWith('Navigation changed', {
      page: 'device'
    })
  })

  it('loads app info from the application service', async () => {
    const viewModel = new AppViewModel(createAppServiceStub())

    await viewModel.loadAppInfo()

    expect(viewModel.appName).toBe('Industrial HMI Foundation')
    expect(viewModel.appVersion).toBe('0.1.0')
    expect(viewModel.environmentLabel).toBe('DEVELOPMENT')
  })
})
