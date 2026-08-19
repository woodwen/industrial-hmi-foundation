import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { App } from '../../src/renderer/App'
import { createRootViewModel } from '../../src/renderer/viewmodels/RootViewModel'
import { ViewModelProvider } from '../../src/renderer/viewmodels/ViewModelContext'
import { createApiClientStub, createAuditRecord, createDeviceStatus, createRecipe } from '../support/hmi-api-client-stub'

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
    expect(markup).toContain('Simulator 状态')
    expect(markup).toContain('启动后再 Connect')
  })

  it('renders app-managed Simulator controls on the Settings page', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.app.navigate('settings')

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('Simulator')
    expect(markup).toContain('127.0.0.1:1502/unit-1')
    expect(markup).toContain('opc.tcp://127.0.0.1:4840/industrial-hmi-simulator')
    expect(markup).toContain('Start')
    expect(markup).toContain('Stop')
  })

  it('renders the Device simulator summary for the current device protocol', () => {
    const rootViewModel = createRootViewModel(createApiClientStub())
    rootViewModel.device.status = {
      ...createDeviceStatus(),
      protocol: 'opcUa',
      endpoint: {
        endpointUrl: 'opc.tcp://127.0.0.1:4840/industrial-hmi-simulator'
      }
    }
    rootViewModel.simulators.applyStatusEvent({
      simulators: [
        {
          kind: 'modbusTcp',
          status: 'Running',
          endpoint: {
            label: '127.0.0.1:1502/unit-1'
          },
          managed: true,
          updatedAt: '2026-08-19T00:00:00.000Z'
        },
        {
          kind: 'opcUa',
          status: 'Stopped',
          endpoint: {
            label: 'opc.tcp://127.0.0.1:4840/industrial-hmi-simulator'
          },
          managed: false,
          updatedAt: '2026-08-19T00:00:00.000Z'
        }
      ],
      changed: {
        kind: 'modbusTcp',
        status: 'Running',
        endpoint: {
          label: '127.0.0.1:1502/unit-1'
        },
        managed: true,
        updatedAt: '2026-08-19T00:00:00.000Z'
      },
      emittedAt: '2026-08-19T00:00:00.000Z'
    })
    rootViewModel.app.navigate('device')

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('OPC UA')
    expect(markup).toContain('opc.tcp://127.0.0.1:4840/industrial-hmi-simulator')
    expect(markup).toContain('Stopped')
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

  it('renders Recipe Management after Recipe ViewModel initialization', async () => {
    const rootViewModel = createRootViewModel(createApiClientStub({
      listRecipes: async () => ({
        ok: true,
        data: {
          recipes: [createRecipe()],
          emittedAt: '2026-08-18T00:00:00.000Z'
        }
      })
    }))
    await rootViewModel.auth.initialize()
    await rootViewModel.recipes.initialize()
    rootViewModel.app.navigate('recipe')

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('Recipe Management')
    expect(markup).toContain('Standard Mixer Recipe')
    expect(markup).toContain('Target Temperature')
  })

  it('renders User Management for Admin users', async () => {
    const rootViewModel = createRootViewModel(createApiClientStub({
      listUsers: async () => ({
        ok: true,
        data: {
          users: [{
            id: 'user-admin',
            username: 'admin',
            displayName: 'Admin',
            role: 'Admin',
            enabled: true,
            createdAt: '2026-08-18T00:00:00.000Z',
            updatedAt: '2026-08-18T00:00:00.000Z'
          }],
          emittedAt: '2026-08-18T00:00:00.000Z'
        }
      })
    }))
    await rootViewModel.auth.initialize()
    rootViewModel.app.navigate('user-management')

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('用户管理')
    expect(markup).toContain('Create User')
    expect(markup).toContain('admin')
  })

  it('renders Audit Log rows and Recipe Download step summaries', async () => {
    const rootViewModel = createRootViewModel(createApiClientStub({
      queryAuditLog: async () => ({
        ok: true,
        data: {
          rows: [createAuditRecord()],
          emittedAt: '2026-08-18T00:00:00.000Z'
        }
      })
    }))
    await rootViewModel.auth.initialize()
    await rootViewModel.auditLog.query()
    rootViewModel.app.navigate('audit-log')

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('Audit Log')
    expect(markup).toContain('Recipe Download')
    expect(markup).toContain('targetTemperature:Verified')
    expect(markup).toContain('rpmSetpoint:WriteFailed')
  })

  it('filters navigation entries from the current permission snapshot', async () => {
    const rootViewModel = createRootViewModel(createApiClientStub({
      getCurrentUser: async () => ({
        ok: true,
        data: {
          user: {
            id: 'user-operator',
            username: 'operator',
            displayName: 'Operator',
            role: 'Operator',
            enabled: true,
            createdAt: '2026-08-18T00:00:00.000Z',
            updatedAt: '2026-08-18T00:00:00.000Z'
          },
          permissions: [
            'device:view',
            'device:start-stop',
            'alarm:acknowledge',
            'recipe:read'
          ],
          requiresInitialization: false
        }
      })
    }))
    await rootViewModel.auth.initialize()

    const markup = renderApp(rootViewModel)

    expect(markup).toContain('配方')
    expect(markup).not.toContain('用户管理')
    expect(markup).not.toContain('审计日志')
    expect(markup).not.toContain('标签管理')
  })
})

function renderApp(rootViewModel: ReturnType<typeof createRootViewModel>): string {
  return renderToStaticMarkup(
    <ViewModelProvider value={rootViewModel}>
      <App />
    </ViewModelProvider>
  )
}
