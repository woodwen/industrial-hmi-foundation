import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { App } from '../../src/renderer/App'
import { createRootViewModel } from '../../src/renderer/viewmodels/RootViewModel'
import { ViewModelProvider } from '../../src/renderer/viewmodels/ViewModelContext'
import { createApiClientStub } from '../support/hmi-api-client-stub'

describe('Renderer navigation rendering', () => {
  it('renders dashboard frame by default', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    const markup = renderApp(rootViewModel)

    expect(markup).toContain('仪表盘')
    expect(markup).toContain('基础架构阶段尚未配置实时采集')
  })

  it('renders selected device frame after active page changes', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.navigate('device')

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('设备')
    expect(markup).toContain('模拟 PLC 连接')
  })
})

function renderApp(rootViewModel: ReturnType<typeof createRootViewModel>): string {
  return renderToStaticMarkup(
    <ViewModelProvider value={rootViewModel}>
      <App />
    </ViewModelProvider>
  )
}
