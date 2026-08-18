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
    expect(markup).toContain('模拟混料设备实时监控已启用')
    expect(markup).toContain('Temperature')
  })

  it('renders selected device frame after active page changes', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.navigate('device')

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('设备')
    expect(markup).toContain('模拟 PLC 连接')
  })

  it('renders real-time alarm rows on the Alarm page', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.alarm.applyAlarmEvent({
      occurrences: [{
        id: 'alarm-temp-high-1787011200000',
        definitionId: 'alarm-temp-high',
        code: 'TEMP_HIGH',
        tagId: 'currentTemperature',
        level: 'High',
        message: 'Temperature is too high',
        status: 'Active',
        triggerTime: '2026-08-18T00:00:00.000Z',
        triggerValue: 82,
        conditionActive: true,
        updatedAt: '2026-08-18T00:00:00.000Z'
      }],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })
    rootViewModel.app.navigate('alarm')

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('Real-time Alarm')
    expect(markup).toContain('Temperature is too high')
    expect(markup).toContain('currentTemperature')
  })

  it('renders real-time trend data on the Trend page', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.trend.applyRealtimeTrendEvent({
      points: [{
        tagId: 'currentTemperature',
        timestamp: '2026-08-18T00:00:00.000Z',
        value: 26,
        quality: 'Good'
      }],
      emittedAt: '2026-08-18T00:00:00.000Z'
    })
    rootViewModel.app.navigate('trend')

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('Real-time Trend')
    expect(markup).toContain('Trend chart')
    expect(markup).toContain('Data Available')
  })
})

function renderApp(rootViewModel: ReturnType<typeof createRootViewModel>): string {
  return renderToStaticMarkup(
    <ViewModelProvider value={rootViewModel}>
      <App />
    </ViewModelProvider>
  )
}
