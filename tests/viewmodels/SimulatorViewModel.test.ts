import { describe, expect, it, vi } from 'vitest'

import { AppApplicationService, type HmiApiClient } from '../../src/renderer/application/AppApplicationService'
import { SimulatorViewModel } from '../../src/renderer/viewmodels/SimulatorViewModel'
import type { HmiResult, SimulatorLifecycleListener, SimulatorRuntimeStatus } from '../../src/shared/hmi-api'
import { createApiClientStub } from '../support/hmi-api-client-stub'

describe('SimulatorViewModel', () => {
  it('loads simulator status and subscribes to status changes', async () => {
    const listeners: SimulatorLifecycleListener[] = []
    const unsubscribe = vi.fn()
    const apiClient = createApiClientStub({
      getSimulatorStatus: vi.fn<HmiApiClient['getSimulatorStatus']>().mockResolvedValue(success({
        simulators: [createStatus('modbusTcp', 'Stopped', false)],
        emittedAt: '2026-08-19T00:00:00.000Z'
      })),
      subscribeSimulatorStatus: vi.fn<HmiApiClient['subscribeSimulatorStatus']>((listener) => {
        listeners.push(listener)
        return unsubscribe
      })
    })
    const viewModel = createViewModel(apiClient)

    await viewModel.initialize()
    listeners[0]?.({
      simulators: [createStatus('modbusTcp', 'Running', true)],
      changed: createStatus('modbusTcp', 'Running', true),
      emittedAt: '2026-08-19T00:00:01.000Z'
    })

    expect(viewModel.rows[0]).toMatchObject({
      kind: 'modbusTcp',
      status: 'Running',
      canStart: false,
      canStop: true
    })

    viewModel.dispose()

    expect(unsubscribe).toHaveBeenCalled()
  })

  it('starts and stops simulators through the application service', async () => {
    const apiClient = createApiClientStub({
      startSimulator: vi.fn<HmiApiClient['startSimulator']>().mockResolvedValue(success(
        createStatus('opcUa', 'Running', true)
      )),
      stopSimulator: vi.fn<HmiApiClient['stopSimulator']>().mockResolvedValue(success(
        createStatus('opcUa', 'Stopped', false)
      ))
    })
    const viewModel = createViewModel(apiClient)

    await viewModel.start('opcUa')
    expect(apiClient.startSimulator).toHaveBeenCalledWith({
      kind: 'opcUa'
    })
    expect(viewModel.rows[1]).toMatchObject({
      status: 'Running',
      canStop: true
    })

    await viewModel.stop('opcUa')
    expect(apiClient.stopSimulator).toHaveBeenCalledWith({
      kind: 'opcUa'
    })
    expect(viewModel.rows[1]).toMatchObject({
      status: 'Stopped',
      canStart: true
    })
  })

  it('surfaces readable lifecycle errors without exposing shell commands', async () => {
    const apiClient = createApiClientStub({
      startSimulator: vi.fn<HmiApiClient['startSimulator']>().mockResolvedValue({
        ok: false,
        error: {
          code: 'SIMULATOR_RUNTIME_MISSING',
          message: 'Simulator runtime entry was not found.',
          source: 'test'
        }
      })
    })
    const viewModel = createViewModel(apiClient)

    await viewModel.start('modbusTcp')

    expect(viewModel.error).toMatchObject({
      code: 'SIMULATOR_RUNTIME_MISSING'
    })
    expect(apiClient.startSimulator).toHaveBeenCalledWith({
      kind: 'modbusTcp'
    })
  })
})

function createViewModel(apiClient: HmiApiClient): SimulatorViewModel {
  return new SimulatorViewModel(new AppApplicationService(apiClient))
}

function createStatus(
  kind: SimulatorRuntimeStatus['kind'],
  status: SimulatorRuntimeStatus['status'],
  managed: boolean
): SimulatorRuntimeStatus {
  return {
    kind,
    status,
    endpoint: kind === 'opcUa'
      ? {
          label: 'opc.tcp://127.0.0.1:4840/industrial-hmi-simulator',
          endpointUrl: 'opc.tcp://127.0.0.1:4840/industrial-hmi-simulator'
        }
      : {
          label: '127.0.0.1:1502/unit-1',
          host: '127.0.0.1',
          port: 1502,
          unitId: 1
        },
    managed,
    pid: managed ? 4201 : undefined,
    updatedAt: '2026-08-19T00:00:00.000Z'
  }
}

function success<T>(data: T): HmiResult<T> {
  return {
    ok: true,
    data
  }
}
