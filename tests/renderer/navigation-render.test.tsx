import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { App } from '../../src/renderer/App'
import type { HmiApiClient } from '../../src/renderer/application/AppApplicationService'
import { createRootViewModel } from '../../src/renderer/viewmodels/RootViewModel'
import { ViewModelProvider } from '../../src/renderer/viewmodels/ViewModelContext'
import type { AppInfo, HmiResult } from '../../src/shared/hmi-api'

function createApiClientStub(): HmiApiClient {
  return {
    getAppInfo: vi.fn<() => Promise<HmiResult<AppInfo>>>().mockResolvedValue({
      ok: true,
      data: {
        name: 'Industrial HMI Foundation',
        version: '0.1.0',
        environment: 'development'
      }
    }),
    writeLog: vi.fn<() => Promise<HmiResult<void>>>().mockResolvedValue({
      ok: true,
      data: undefined
    }),
    reportError: vi.fn<() => Promise<HmiResult<void>>>().mockResolvedValue({
      ok: true,
      data: undefined
    })
  }
}

describe('Renderer navigation rendering', () => {
  it('renders dashboard frame by default', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    const markup = renderApp(rootViewModel)

    expect(markup).toContain('Dashboard')
    expect(markup).toContain('Realtime collection is not configured')
  })

  it('renders selected device frame after active page changes', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.navigate('device')

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('Device')
    expect(markup).toContain('No device connections configured')
  })
})

function renderApp(rootViewModel: ReturnType<typeof createRootViewModel>): string {
  return renderToStaticMarkup(
    <ViewModelProvider value={rootViewModel}>
      <App />
    </ViewModelProvider>
  )
}
