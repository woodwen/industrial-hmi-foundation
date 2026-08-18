import { createAppError, type AppErrorShape } from '../../shared/app-error'

export const DEVICE_ERROR_CODES = {
  connectionFailed: 'DEVICE_CONNECTION_FAILED',
  notConnected: 'DEVICE_NOT_CONNECTED',
  requestTimeout: 'DEVICE_REQUEST_TIMEOUT',
  illegalAddress: 'DEVICE_ILLEGAL_ADDRESS',
  writeRejected: 'DEVICE_WRITE_REJECTED',
  connectionLost: 'DEVICE_CONNECTION_LOST',
  protocolError: 'PROTOCOL_ERROR'
} as const

export type DeviceErrorCode = (typeof DEVICE_ERROR_CODES)[keyof typeof DEVICE_ERROR_CODES]

export function createDeviceError(
  code: DeviceErrorCode,
  message: string,
  source: string,
  detail?: string,
  cause?: unknown
): AppErrorShape {
  return createAppError({
    code,
    message,
    detail,
    source,
    cause
  })
}
