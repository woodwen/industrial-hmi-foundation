import { describe, expect, it } from 'vitest'

import { transitionDeviceState } from '../../../src/main/device'
import type { DeviceConnectionStatus } from '../../../src/shared/hmi-api'

describe('Device state machine', () => {
  it('accepts legal connection and reconnect transitions', () => {
    expect(transitionDeviceState('Disconnected', 'connectRequested')).toMatchObject({
      from: 'Disconnected',
      to: 'Connecting'
    })
    expect(transitionDeviceState('Connecting', 'connectSucceeded')).toMatchObject({
      from: 'Connecting',
      to: 'Connected'
    })
    expect(transitionDeviceState('Connected', 'communicationLost')).toMatchObject({
      from: 'Connected',
      to: 'Reconnecting'
    })
    expect(transitionDeviceState('Reconnecting', 'reconnectSucceeded')).toMatchObject({
      from: 'Reconnecting',
      to: 'Connected'
    })
  })

  it('rejects illegal transitions instead of inventing implicit states', () => {
    expect(transitionDeviceState('Disconnected', 'connectSucceeded')).toBeNull()
    expect(transitionDeviceState('Connected', 'connectRequested')).toBeNull()
    expect(transitionDeviceState('Fault', 'communicationLost')).toBeNull()
  })

  it('allows manual disconnect from every active state', () => {
    const stoppableStates: DeviceConnectionStatus[] = [
      'Connecting',
      'Connected',
      'Reconnecting',
      'Fault'
    ]

    stoppableStates.forEach((state) => {
      expect(transitionDeviceState(state, 'manualDisconnect')).toMatchObject({
        from: state,
        to: 'Disconnected'
      })
    })
    expect(transitionDeviceState('Disconnected', 'manualDisconnect')).toBeNull()
  })
})
