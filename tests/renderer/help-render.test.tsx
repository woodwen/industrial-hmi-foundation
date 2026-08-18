import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { App } from '../../src/renderer/App'
import { createRootViewModel } from '../../src/renderer/viewmodels/RootViewModel'
import { ViewModelProvider } from '../../src/renderer/viewmodels/ViewModelContext'
import { createApiClientStub } from '../support/hmi-api-client-stub'

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
    expect(markup).toContain('已实现独立 PLC Simulator')
  })

  it('renders the English user manual after language switch', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.setLanguage('en-US')
    rootViewModel.app.openUserManual()

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('User Manual')
    expect(markup).toContain('Current Scope')
    expect(markup).toContain('PLC Simulator, Modbus TCP adapter')
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

function renderApp(rootViewModel: ReturnType<typeof createRootViewModel>): string {
  return renderToStaticMarkup(
    <ViewModelProvider value={rootViewModel}>
      <App />
    </ViewModelProvider>
  )
}
