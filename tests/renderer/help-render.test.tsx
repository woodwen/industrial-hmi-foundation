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
    expect(markup).toContain('项目说明书')
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
    expect(markup).toContain('Modbus RTU 当前未实现 runtime')
    expect(markup).toContain('Audit Log 记录 Start、Stop')
  })

  it('renders the English user manual after language switch', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.setLanguage('en-US')
    rootViewModel.app.openUserManual()

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('User Manual')
    expect(markup).toContain('Current Scope')
    expect(markup).toContain('in-app Simulator control')
    expect(markup).toContain('Modbus RTU runtime is not implemented')
    expect(markup).toContain('Permissions distinguish Operator, Engineer, and Admin')
  })

  it('renders bundled changelog entries as version update notes', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.openVersionUpdates()

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('版本更新说明')
    expect(markup).toContain('当前版本 0.1.1')
    expect(markup).toContain('Industrial HMI Foundation 的产品可交付基础')
    expect(markup).toContain('新增跨平台应用图标资产')
  })

  it('renders the detailed project manual inside the Help dialog', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.openProjectManual()

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('项目说明书')
    expect(markup).toContain('自动化恒温混料设备监控与控制系统')
    expect(markup).toContain('Modbus TCP Simulator')
    expect(markup).toContain('怎么和 PLC / 设备通信？')
    expect(markup).toContain('不替代 Safety PLC')
  })
})

function renderApp(rootViewModel: ReturnType<typeof createRootViewModel>): string {
  return renderToStaticMarkup(
    <ViewModelProvider value={rootViewModel}>
      <App />
    </ViewModelProvider>
  )
}
