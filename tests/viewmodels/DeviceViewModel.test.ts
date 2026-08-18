import { describe, expect, it, vi } from 'vitest'

import { AppApplicationService, type HmiApiClient } from '../../src/renderer/application/AppApplicationService'
import { DeviceViewModel } from '../../src/renderer/viewmodels/DeviceViewModel'
import type { AppErrorShape } from '../../src/shared/app-error'
import type { DevicePointValue, HmiResult } from '../../src/shared/hmi-api'
import type { ModbusPointId } from '../../src/shared/modbus'
import { createApiClientStub, createDeviceStatus } from '../support/hmi-api-client-stub'

describe('DeviceViewModel', () => {
  it('connects and performs one manual read', async () => {
    const apiClient = createApiClientStub({
      readDeviceRegisters: vi.fn<HmiApiClient['readDeviceRegisters']>().mockResolvedValue(success({
        deviceId: 'simulated-mixer-plc',
        values: [createPointValue('currentTemperature', 25.5, [255], '25.5 °C')],
        timestamp: '2026-08-18T00:00:00.000Z'
      }))
    })
    const viewModel = createViewModel(apiClient)

    await viewModel.connect()

    expect(apiClient.connectDevice).toHaveBeenCalled()
    expect(apiClient.readDeviceRegisters).toHaveBeenCalled()
    expect(viewModel.status.connectionStatus).toBe('Connected')
    expect(viewModel.values.get('currentTemperature')?.value).toBe(25.5)
  })

  it('disconnects through the typed application service', async () => {
    const apiClient = createApiClientStub()
    const viewModel = createViewModel(apiClient)

    viewModel.status = createDeviceStatus('Connected')
    await viewModel.disconnect()

    expect(apiClient.disconnectDevice).toHaveBeenCalled()
    expect(viewModel.status.connectionStatus).toBe('Disconnected')
    expect(viewModel.operationMessageKey).toBe('device.operation.disconnected')
  })

  it('reads configured values and updates display rows', async () => {
    const apiClient = createApiClientStub({
      readDeviceRegisters: vi.fn<HmiApiClient['readDeviceRegisters']>().mockResolvedValue(success({
        deviceId: 'simulated-mixer-plc',
        values: [
          createPointValue('currentTemperature', 26.1, [261], '26.1 °C'),
          createPointValue('currentLevel', 41.2, [412], '41.2 %'),
          createPointValue('motorRpm', 900, [900], '900 rpm')
        ],
        timestamp: '2026-08-18T00:00:00.000Z'
      }))
    })
    const viewModel = createViewModel(apiClient)
    viewModel.status = createDeviceStatus('Connected')

    await viewModel.readConfiguredPoints()

    expect(viewModel.valueRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pointId: 'currentTemperature',
        value: '26.1 °C'
      }),
      expect.objectContaining({
        pointId: 'motorRpm',
        value: '900 rpm'
      })
    ]))
  })

  it('writes target temperature and updates the input from read-back', async () => {
    const apiClient = createApiClientStub({
      writeDeviceRegisters: vi.fn<HmiApiClient['writeDeviceRegisters']>().mockResolvedValue(success({
        deviceId: 'simulated-mixer-plc',
        point: createPointValue('targetTemperature', 62.5, [625], '62.5 °C'),
        timestamp: '2026-08-18T00:00:00.000Z'
      }))
    })
    const viewModel = createViewModel(apiClient)
    viewModel.status = createDeviceStatus('Connected')
    viewModel.setTargetTemperatureInput('62.5')

    await viewModel.writeTargetTemperature()

    expect(apiClient.writeDeviceRegisters).toHaveBeenCalledWith({
      pointId: 'targetTemperature',
      value: 62.5
    })
    expect(viewModel.targetTemperatureInput).toBe('62.5')
    expect(viewModel.operationMessageKey).toBe('device.operation.write')
  })

  it('controls writable coils through predefined point ids', async () => {
    const apiClient = createApiClientStub({
      writeDeviceRegisters: vi.fn<HmiApiClient['writeDeviceRegisters']>().mockResolvedValue(success({
        deviceId: 'simulated-mixer-plc',
        point: createPointValue('deviceStartCommand', true, [true], 'ON'),
        timestamp: '2026-08-18T00:00:00.000Z'
      }))
    })
    const viewModel = createViewModel(apiClient)
    viewModel.status = createDeviceStatus('Connected')

    await viewModel.writeCoil('deviceStartCommand', true)

    expect(apiClient.writeDeviceRegisters).toHaveBeenCalledWith({
      pointId: 'deviceStartCommand',
      value: true
    })
    expect(viewModel.coilControls[0]).toMatchObject({
      pointId: 'deviceStartCommand',
      checked: true
    })
  })

  it('refreshes status after a failed read and clears loading state', async () => {
    const error: AppErrorShape = {
      code: 'DEVICE_CONNECTION_LOST',
      message: 'Device connection was lost.',
      source: 'test'
    }
    const state: {
      viewModel?: DeviceViewModel
    } = {}
    const apiClient = createApiClientStub({
      readDeviceRegisters: vi.fn<HmiApiClient['readDeviceRegisters']>().mockImplementation(async () => {
        expect(state.viewModel?.isReading).toBe(true)
        return {
          ok: false,
          error
        }
      }),
      getDeviceStatus: vi.fn<HmiApiClient['getDeviceStatus']>().mockResolvedValue(success({
        ...createDeviceStatus('Fault'),
        lastError: error
      }))
    })
    const viewModel = createViewModel(apiClient)
    state.viewModel = viewModel

    await viewModel.readConfiguredPoints()

    expect(viewModel.isReading).toBe(false)
    expect(viewModel.error).toStrictEqual(error)
    expect(viewModel.status.connectionStatus).toBe('Fault')
  })
})

function createViewModel(apiClient: HmiApiClient): DeviceViewModel {
  return new DeviceViewModel(new AppApplicationService(apiClient))
}

function createPointValue(
  pointId: ModbusPointId,
  value: DevicePointValue['value'],
  rawValues: DevicePointValue['rawValues'],
  formattedValue: string
): DevicePointValue {
  const registerMetadata = getPointMetadata(pointId)

  return {
    pointId,
    area: registerMetadata.area,
    referenceAddress: registerMetadata.referenceAddress,
    pduAddress: registerMetadata.pduAddress,
    value,
    rawValues,
    formattedValue,
    unit: registerMetadata.unit,
    writable: registerMetadata.writable,
    timestamp: '2026-08-18T00:00:00.000Z'
  }
}

function getPointMetadata(pointId: ModbusPointId): Pick<
  DevicePointValue,
  'area' | 'referenceAddress' | 'pduAddress' | 'unit' | 'writable'
> {
  if (pointId === 'currentTemperature') {
    return {
      area: 'inputRegister',
      referenceAddress: '30001',
      pduAddress: 0,
      unit: '°C',
      writable: false
    }
  }

  if (pointId === 'currentLevel') {
    return {
      area: 'inputRegister',
      referenceAddress: '30002',
      pduAddress: 1,
      unit: '%',
      writable: false
    }
  }

  if (pointId === 'motorRpm') {
    return {
      area: 'inputRegister',
      referenceAddress: '30004',
      pduAddress: 3,
      unit: 'rpm',
      writable: false
    }
  }

  if (pointId === 'deviceStartCommand') {
    return {
      area: 'coil',
      referenceAddress: '00001',
      pduAddress: 0,
      unit: '',
      writable: true
    }
  }

  return {
    area: 'holdingRegister',
    referenceAddress: '40001',
    pduAddress: 0,
    unit: '°C',
    writable: true
  }
}

function success<T>(data: T): HmiResult<T> {
  return {
    ok: true,
    data
  }
}
