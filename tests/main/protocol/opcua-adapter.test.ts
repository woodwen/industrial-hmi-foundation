import { afterEach, describe, expect, it } from 'vitest'

import { OpcUaAdapter } from '../../../src/main/protocol/opcua/OpcUaAdapter'
import { createOpcUaBinding } from '../../../src/main/protocol/bindings'
import type { Logger } from '../../../src/main/logging/logger'
import { OpcUaSimulator } from '../../../src/simulator/opcua-simulator'
import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  decodeModbusPointValue,
  encodeModbusPointValue,
  getModbusPoint,
  SIMULATED_MIXER_DEVICE_ID
} from '../../../src/shared/modbus'

describe('OpcUaAdapter with OPC UA Simulator', () => {
  const port = 24840
  const endpointUrl = `opc.tcp://127.0.0.1:${port}/industrial-hmi-simulator`
  let simulator: OpcUaSimulator | null = null
  let adapter: OpcUaAdapter | null = null

  afterEach(async () => {
    await adapter?.disconnect()
    await simulator?.stop()
    adapter = null
    simulator = null
  })

  it('connects, subscribes, writes, reads back, and cleans up', async () => {
    simulator = new OpcUaSimulator({
      endpointUrl,
      host: '127.0.0.1',
      port,
      resourcePath: '/industrial-hmi-simulator',
      tickMs: 100
    })
    await simulator.start()

    adapter = new OpcUaAdapter(createLogger())
    await adapter.connect({
      deviceId: SIMULATED_MIXER_DEVICE_ID,
      protocol: 'opcUa',
      endpointUrl,
      securityMode: 'None',
      securityPolicy: 'None',
      anonymous: true,
      connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
      requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS
    })

    expect(adapter.getCapabilities()).toMatchObject({
      protocol: 'opcUa',
      preferredAcquisition: 'subscription',
      supportsSubscription: true
    })
    expect(adapter.getStatus().connectionStatus).toBe('Connected')

    const notifications: unknown[] = []
    const subscription = await adapter.subscribe([
      {
        tagId: 'currentTemperature',
        binding: createOpcUaBinding('currentTemperature', 100)
      }
    ], (values) => {
      notifications.push(...values)
    })

    simulator.tick(1000)
    await waitFor(() => notifications.length > 0)
    await subscription.dispose()

    const setpoint = getModbusPoint('targetTemperature')
    await adapter.write({
      binding: createOpcUaBinding('targetTemperature', 100),
      area: setpoint.area,
      address: setpoint.pduAddress,
      values: encodeModbusPointValue(setpoint, 65)
    })
    const readBack = await adapter.read({
      binding: createOpcUaBinding('targetTemperature', 100),
      area: setpoint.area,
      address: setpoint.pduAddress,
      quantity: setpoint.quantity
    })

    expect(decodeModbusPointValue(setpoint, readBack.values)).toBe(65)

    await adapter.disconnect()
    expect(adapter.getStatus().connectionStatus).toBe('Disconnected')
  }, 30000)
})

function createLogger(): Logger {
  return {
    write: () => undefined
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    if (predicate()) {
      return
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 50)
    })
  }

  throw new Error('Timed out waiting for condition.')
}
