import type { AppErrorShape } from '../../shared/app-error'
import type { DeviceConnectionStatus } from '../../shared/hmi-api'

export type DeviceStateEvent =
  | 'connectRequested'
  | 'connectSucceeded'
  | 'connectFailed'
  | 'communicationLost'
  | 'reconnectSucceeded'
  | 'unrecoverableFailure'
  | 'manualDisconnect'
  | 'retryRequested'
  | 'reset'

export interface DeviceStateTransition {
  from: DeviceConnectionStatus
  to: DeviceConnectionStatus
  event: DeviceStateEvent
  reason?: string
  error?: AppErrorShape
}

const LEGAL_TRANSITIONS: ReadonlyMap<DeviceConnectionStatus, ReadonlySet<DeviceConnectionStatus>> = new Map([
  ['Disconnected', new Set<DeviceConnectionStatus>(['Connecting'])],
  ['Connecting', new Set<DeviceConnectionStatus>(['Connected', 'Fault', 'Disconnected'])],
  ['Connected', new Set<DeviceConnectionStatus>(['Reconnecting', 'Disconnected'])],
  ['Reconnecting', new Set<DeviceConnectionStatus>(['Connected', 'Fault', 'Disconnected'])],
  ['Fault', new Set<DeviceConnectionStatus>(['Connecting', 'Disconnected'])]
])

export function transitionDeviceState(
  from: DeviceConnectionStatus,
  event: DeviceStateEvent,
  reason?: string,
  error?: AppErrorShape
): DeviceStateTransition | null {
  const to = getTargetState(from, event)
  if (!to || !LEGAL_TRANSITIONS.get(from)?.has(to)) {
    return null
  }

  return {
    from,
    to,
    event,
    reason,
    error
  }
}

function getTargetState(
  from: DeviceConnectionStatus,
  event: DeviceStateEvent
): DeviceConnectionStatus | null {
  if (event === 'manualDisconnect' || event === 'reset') {
    return from === 'Disconnected' ? null : 'Disconnected'
  }

  if (event === 'connectRequested' || event === 'retryRequested') {
    return from === 'Disconnected' || from === 'Fault' ? 'Connecting' : null
  }

  if (event === 'connectSucceeded') {
    return from === 'Connecting' ? 'Connected' : null
  }

  if (event === 'connectFailed') {
    return from === 'Connecting' ? 'Fault' : null
  }

  if (event === 'communicationLost') {
    return from === 'Connected' ? 'Reconnecting' : null
  }

  if (event === 'reconnectSucceeded') {
    return from === 'Reconnecting' ? 'Connected' : null
  }

  if (event === 'unrecoverableFailure') {
    return from === 'Connecting' || from === 'Reconnecting' ? 'Fault' : null
  }

  return null
}
