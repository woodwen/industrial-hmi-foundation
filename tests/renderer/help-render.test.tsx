import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { App } from '../../src/renderer/App'
import type { HmiApiClient } from '../../src/renderer/application/AppApplicationService'
import { createRootViewModel } from '../../src/renderer/viewmodels/RootViewModel'
import { ViewModelProvider } from '../../src/renderer/viewmodels/ViewModelContext'
import type { AppInfo, HmiResult } from '../../src/shared/hmi-api'

describe('Renderer help views', () => {
  it('renders the help menu actions when the menu is open', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.toggleHelpMenu()

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('使用说明书')
    expect(markup).toContain('版本更新说明')
    expect(markup).toContain('检查更新')
  })

  it('renders the help entry and Chinese user manual offline', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.openUserManual()

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('使用说明书')
    expect(markup).toContain('应用定位')
    expect(markup).toContain('尚未实现 Modbus TCP')
  })

  it('renders the English user manual after language switch', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.setLanguage('en-US')
    rootViewModel.app.openUserManual()

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('User Manual')
    expect(markup).toContain('Current Scope')
    expect(markup).toContain('Modbus TCP, OPC UA, and PLC Simulator are not implemented')
  })

  it('renders bundled changelog entries as version update notes', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.openVersionUpdates()

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('版本更新说明')
    expect(markup).toContain('当前版本 0.1.1')
    expect(markup).toContain('Industrial HMI Foundation 的产品可交付基础')
  })
})

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
    }),
    checkForUpdates: vi.fn<() => Promise<HmiResult<void>>>().mockResolvedValue({
      ok: true,
      data: undefined
    }),
    downloadUpdate: vi.fn<() => Promise<HmiResult<void>>>().mockResolvedValue({
      ok: true,
      data: undefined
    }),
    cancelUpdateDownload: vi.fn<() => Promise<HmiResult<void>>>().mockResolvedValue({
      ok: true,
      data: undefined
    }),
    openUpdateDownloadPage: vi.fn<() => Promise<HmiResult<void>>>().mockResolvedValue({
      ok: true,
      data: undefined
    }),
    quitAndInstallUpdate: vi.fn<() => Promise<HmiResult<void>>>().mockResolvedValue({
      ok: true,
      data: undefined
    }),
    onUpdateEvent: vi.fn(() => () => undefined)
  }
}

function renderApp(rootViewModel: ReturnType<typeof createRootViewModel>): string {
  return renderToStaticMarkup(
    <ViewModelProvider value={rootViewModel}>
      <App />
    </ViewModelProvider>
  )
}
