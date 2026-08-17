import { describe, expect, it, vi } from 'vitest'

import type { AppApplicationService } from '../../src/renderer/application/AppApplicationService'
import { AppViewModel } from '../../src/renderer/viewmodels/AppViewModel'
import type { AppInfo, HmiResult } from '../../src/shared/hmi-api'

function createAppServiceStub(overrides: Partial<AppApplicationService> = {}): AppApplicationService {
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
    }),
    ...overrides
  } as unknown as AppApplicationService
}

describe('AppViewModel', () => {
  it('starts on the dashboard page', () => {
    const viewModel = new AppViewModel(createAppServiceStub())

    expect(viewModel.activePage).toBe('dashboard')
    expect(viewModel.activePageTitle).toBe('仪表盘')
    expect(viewModel.language).toBe('zh-CN')
  })

  it('updates active page through navigation action', () => {
    const service = createAppServiceStub()
    const viewModel = new AppViewModel(service)

    viewModel.navigate('device')

    expect(viewModel.activePage).toBe('device')
    expect(viewModel.activePageTitle).toBe('设备')
    expect(service.writeApplicationLog).toHaveBeenCalledWith('Navigation changed', {
      page: 'device'
    })
  })

  it('switches language and uses English page titles', () => {
    const viewModel = new AppViewModel(createAppServiceStub())

    viewModel.setLanguage('en-US')
    viewModel.navigate('device')

    expect(viewModel.language).toBe('en-US')
    expect(viewModel.activePageTitle).toBe('Device')
  })

  it('loads app info from the application service', async () => {
    const viewModel = new AppViewModel(createAppServiceStub())

    await viewModel.loadAppInfo()

    expect(viewModel.appName).toBe('Industrial HMI Foundation')
    expect(viewModel.appVersion).toBe('0.1.0')
    expect(viewModel.environmentLabel).toBe('开发环境')
  })

  it('stores app info load failures as unified error state', async () => {
    const viewModel = new AppViewModel(createAppServiceStub({
      getAppInfo: vi.fn<() => Promise<HmiResult<AppInfo>>>().mockRejectedValue(new Error('IPC unavailable'))
    }))

    await viewModel.loadAppInfo()

    expect(viewModel.error).toMatchObject({
      code: 'APP_UNKNOWN_ERROR',
      message: 'IPC unavailable',
      source: 'renderer:app-info'
    })
  })

  it('reports renderer errors through the application service with component stack context', () => {
    const service = createAppServiceStub()
    const viewModel = new AppViewModel(service)
    const error = {
      code: 'RENDERER_UNHANDLED_ERROR',
      message: 'Render failed',
      source: 'renderer:error-boundary'
    }

    viewModel.reportError(error, 'component stack')

    expect(viewModel.error).toEqual(error)
    expect(service.reportError).toHaveBeenCalledWith({
      ...error,
      componentStack: 'component stack'
    })
  })
})
