import { createConnection, type Socket } from 'node:net'

import { MODBUS_EXCEPTION_CODES } from '../../../shared/modbus'

const MODBUS_PROTOCOL_ID = 0
const FUNCTION_READ_COILS = 0x01
const FUNCTION_READ_DISCRETE_INPUTS = 0x02
const FUNCTION_READ_HOLDING_REGISTERS = 0x03
const FUNCTION_READ_INPUT_REGISTERS = 0x04
const FUNCTION_WRITE_SINGLE_COIL = 0x05
const FUNCTION_WRITE_SINGLE_REGISTER = 0x06
const FUNCTION_WRITE_MULTIPLE_COILS = 0x0f
const FUNCTION_WRITE_MULTIPLE_REGISTERS = 0x10
const WRITE_ON = 0xff00
const WRITE_OFF = 0x0000

export type ModbusClientErrorKind =
  | 'timeout'
  | 'connection'
  | 'connection-lost'
  | 'illegal-address'
  | 'illegal-value'
  | 'protocol'

export class ModbusClientError extends Error {
  constructor(
    readonly kind: ModbusClientErrorKind,
    message: string,
    readonly exceptionCode?: number
  ) {
    super(message)
    this.name = 'ModbusClientError'
  }
}

export interface ModbusTcpClientConfig {
  host: string
  port: number
  unitId: number
}

interface PendingRequest {
  resolve(pdu: Buffer): void
  reject(error: ModbusClientError): void
  timer: NodeJS.Timeout
}

export class ModbusTcpClient {
  private socket: Socket | null = null
  private transactionId = 0
  private responseBuffer: Buffer = Buffer.alloc(0)
  private readonly pending = new Map<number, PendingRequest>()
  private expectedClose = false

  onConnectionLost?: (error: ModbusClientError) => void

  get connected(): boolean {
    return this.socket !== null && !this.socket.destroyed
  }

  connect(config: ModbusTcpClientConfig, timeoutMs: number): Promise<void> {
    this.disconnect()

    return new Promise<void>((resolve, reject) => {
      const socket = createConnection({
        host: config.host,
        port: config.port
      })
      let settled = false
      const timer = setTimeout(() => {
        if (settled) {
          return
        }
        settled = true
        socket.destroy()
        reject(new ModbusClientError('timeout', `Timed out connecting to ${config.host}:${config.port}.`))
      }, timeoutMs)

      const handleConnect = (): void => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        socket.off('error', handleError)
        this.socket = socket
        this.attachSocketHandlers(socket)
        resolve()
      }

      const handleError = (error: Error): void => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        socket.destroy()
        reject(new ModbusClientError('connection', error.message))
      }

      socket.once('connect', handleConnect)
      socket.once('error', handleError)
    })
  }

  disconnect(): void {
    const socket = this.socket
    this.socket = null
    this.responseBuffer = Buffer.alloc(0)
    this.expectedClose = Boolean(socket)
    this.rejectAllPending(new ModbusClientError('connection-lost', 'Modbus TCP connection was closed.'))

    if (socket && !socket.destroyed) {
      socket.destroy()
      return
    }

    this.expectedClose = false
  }

  readCoils(address: number, quantity: number, unitId: number, timeoutMs: number): Promise<boolean[]> {
    return this.readBooleans(FUNCTION_READ_COILS, address, quantity, unitId, timeoutMs)
  }

  readDiscreteInputs(address: number, quantity: number, unitId: number, timeoutMs: number): Promise<boolean[]> {
    return this.readBooleans(FUNCTION_READ_DISCRETE_INPUTS, address, quantity, unitId, timeoutMs)
  }

  async readHoldingRegisters(address: number, quantity: number, unitId: number, timeoutMs: number): Promise<number[]> {
    return this.readRegisters(FUNCTION_READ_HOLDING_REGISTERS, address, quantity, unitId, timeoutMs)
  }

  async readInputRegisters(address: number, quantity: number, unitId: number, timeoutMs: number): Promise<number[]> {
    return this.readRegisters(FUNCTION_READ_INPUT_REGISTERS, address, quantity, unitId, timeoutMs)
  }

  async writeCoils(address: number, values: readonly boolean[], unitId: number, timeoutMs: number): Promise<void> {
    if (values.length === 1) {
      const pdu = Buffer.alloc(5)
      pdu.writeUInt8(FUNCTION_WRITE_SINGLE_COIL, 0)
      pdu.writeUInt16BE(address, 1)
      pdu.writeUInt16BE(values[0] ? WRITE_ON : WRITE_OFF, 3)
      await this.request(pdu, unitId, timeoutMs)
      return
    }

    const packedValues = packBooleans(values)
    const pdu = Buffer.alloc(6 + packedValues.length)
    pdu.writeUInt8(FUNCTION_WRITE_MULTIPLE_COILS, 0)
    pdu.writeUInt16BE(address, 1)
    pdu.writeUInt16BE(values.length, 3)
    pdu.writeUInt8(packedValues.length, 5)
    Buffer.from(packedValues).copy(pdu, 6)
    await this.request(pdu, unitId, timeoutMs)
  }

  async writeHoldingRegisters(address: number, values: readonly number[], unitId: number, timeoutMs: number): Promise<void> {
    if (values.length === 1) {
      const pdu = Buffer.alloc(5)
      pdu.writeUInt8(FUNCTION_WRITE_SINGLE_REGISTER, 0)
      pdu.writeUInt16BE(address, 1)
      pdu.writeUInt16BE(values[0], 3)
      await this.request(pdu, unitId, timeoutMs)
      return
    }

    const pdu = Buffer.alloc(6 + values.length * 2)
    pdu.writeUInt8(FUNCTION_WRITE_MULTIPLE_REGISTERS, 0)
    pdu.writeUInt16BE(address, 1)
    pdu.writeUInt16BE(values.length, 3)
    pdu.writeUInt8(values.length * 2, 5)
    values.forEach((value, index) => {
      pdu.writeUInt16BE(value, 6 + index * 2)
    })
    await this.request(pdu, unitId, timeoutMs)
  }

  private async readBooleans(
    functionCode: number,
    address: number,
    quantity: number,
    unitId: number,
    timeoutMs: number
  ): Promise<boolean[]> {
    const pdu = createReadPdu(functionCode, address, quantity)
    const response = await this.request(pdu, unitId, timeoutMs)
    this.assertFunction(response, functionCode)
    const byteCount = response.readUInt8(1)
    const expectedByteCount = Math.ceil(quantity / 8)

    if (byteCount !== expectedByteCount || response.length !== 2 + byteCount) {
      throw new ModbusClientError('protocol', 'Modbus boolean response byte count is invalid.')
    }

    return unpackBooleans(response.subarray(2), quantity)
  }

  private async readRegisters(
    functionCode: number,
    address: number,
    quantity: number,
    unitId: number,
    timeoutMs: number
  ): Promise<number[]> {
    const pdu = createReadPdu(functionCode, address, quantity)
    const response = await this.request(pdu, unitId, timeoutMs)
    this.assertFunction(response, functionCode)
    const byteCount = response.readUInt8(1)

    if (byteCount !== quantity * 2 || response.length !== 2 + byteCount) {
      throw new ModbusClientError('protocol', 'Modbus register response byte count is invalid.')
    }

    return Array.from({ length: quantity }, (_, index) => response.readUInt16BE(2 + index * 2))
  }

  private request(pdu: Buffer, unitId: number, timeoutMs: number): Promise<Buffer> {
    const socket = this.socket
    if (!socket || socket.destroyed) {
      return Promise.reject(new ModbusClientError('connection-lost', 'Modbus TCP connection is not open.'))
    }

    const transactionId = this.nextTransactionId()
    const frame = Buffer.alloc(7 + pdu.length)

    frame.writeUInt16BE(transactionId, 0)
    frame.writeUInt16BE(MODBUS_PROTOCOL_ID, 2)
    frame.writeUInt16BE(pdu.length + 1, 4)
    frame.writeUInt8(unitId, 6)
    pdu.copy(frame, 7)

    return new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(transactionId)
        reject(new ModbusClientError('timeout', `Modbus request ${transactionId} timed out.`))
      }, timeoutMs)

      this.pending.set(transactionId, {
        resolve,
        reject,
        timer
      })

      socket.write(frame, (error) => {
        if (error) {
          const pending = this.pending.get(transactionId)
          if (pending) {
            clearTimeout(pending.timer)
            this.pending.delete(transactionId)
          }
          reject(new ModbusClientError('connection', error.message))
        }
      })
    })
  }

  private attachSocketHandlers(socket: Socket): void {
    socket.on('data', (chunk) => {
      try {
        this.responseBuffer = Buffer.concat([this.responseBuffer, chunk])
        this.responseBuffer = this.handleBufferedResponses(this.responseBuffer)
      } catch (error) {
        const clientError = error instanceof ModbusClientError
          ? error
          : new ModbusClientError('protocol', error instanceof Error ? error.message : String(error))
        this.rejectAllPending(clientError)
        if (!this.expectedClose) {
          this.onConnectionLost?.(clientError)
        }
        this.expectedClose = true
        socket.destroy()
      }
    })

    socket.on('close', () => {
      const wasExpectedClose = this.expectedClose
      this.expectedClose = false
      if (this.socket === socket) {
        this.socket = null
      }
      const error = new ModbusClientError('connection-lost', 'Modbus TCP connection was closed.')
      this.rejectAllPending(error)
      if (!wasExpectedClose) {
        this.onConnectionLost?.(error)
      }
    })

    socket.on('error', (error) => {
      const clientError = new ModbusClientError('connection-lost', error.message)
      this.rejectAllPending(clientError)
      if (!this.expectedClose) {
        this.onConnectionLost?.(clientError)
      }
    })
  }

  private handleBufferedResponses(buffer: Buffer): Buffer {
    let remaining = buffer

    while (remaining.length >= 7) {
      const length = remaining.readUInt16BE(4)
      const totalLength = 6 + length

      if (length < 2) {
        throw new ModbusClientError('protocol', 'Modbus response length is invalid.')
      }

      if (remaining.length < totalLength) {
        break
      }

      const frame = remaining.subarray(0, totalLength)
      remaining = remaining.subarray(totalLength)
      this.handleResponseFrame(frame)
    }

    return remaining
  }

  private handleResponseFrame(frame: Buffer): void {
    const transactionId = frame.readUInt16BE(0)
    const protocolId = frame.readUInt16BE(2)
    const pdu = frame.subarray(7)
    const pending = this.pending.get(transactionId)

    if (!pending) {
      return
    }

    clearTimeout(pending.timer)
    this.pending.delete(transactionId)

    if (protocolId !== MODBUS_PROTOCOL_ID || pdu.length < 1) {
      pending.reject(new ModbusClientError('protocol', 'Modbus response header is invalid.'))
      return
    }

    const functionCode = pdu.readUInt8(0)
    if ((functionCode & 0x80) !== 0) {
      const exceptionCode = pdu.length >= 2 ? pdu.readUInt8(1) : MODBUS_EXCEPTION_CODES.serverDeviceFailure
      pending.reject(toExceptionError(exceptionCode))
      return
    }

    pending.resolve(pdu)
  }

  private assertFunction(response: Buffer, expectedFunctionCode: number): void {
    if (response.length < 1 || response.readUInt8(0) !== expectedFunctionCode) {
      throw new ModbusClientError('protocol', 'Modbus response function code does not match request.')
    }
  }

  private rejectAllPending(error: ModbusClientError): void {
    for (const [transactionId, pending] of this.pending.entries()) {
      clearTimeout(pending.timer)
      pending.reject(error)
      this.pending.delete(transactionId)
    }
  }

  private nextTransactionId(): number {
    this.transactionId = (this.transactionId + 1) & 0xffff
    return this.transactionId === 0 ? this.nextTransactionId() : this.transactionId
  }
}

function createReadPdu(functionCode: number, address: number, quantity: number): Buffer {
  const pdu = Buffer.alloc(5)
  pdu.writeUInt8(functionCode, 0)
  pdu.writeUInt16BE(address, 1)
  pdu.writeUInt16BE(quantity, 3)
  return pdu
}

function toExceptionError(exceptionCode: number): ModbusClientError {
  if (exceptionCode === MODBUS_EXCEPTION_CODES.illegalDataAddress) {
    return new ModbusClientError('illegal-address', 'Modbus illegal data address.', exceptionCode)
  }

  if (exceptionCode === MODBUS_EXCEPTION_CODES.illegalDataValue) {
    return new ModbusClientError('illegal-value', 'Modbus illegal data value.', exceptionCode)
  }

  return new ModbusClientError('protocol', `Modbus exception ${exceptionCode}.`, exceptionCode)
}

function packBooleans(values: readonly boolean[]): number[] {
  const bytes = Array.from({ length: Math.ceil(values.length / 8) }, () => 0)
  values.forEach((value, index) => {
    if (value) {
      bytes[Math.floor(index / 8)] |= 1 << (index % 8)
    }
  })
  return bytes
}

function unpackBooleans(bytes: Buffer, quantity: number): boolean[] {
  return Array.from({ length: quantity }, (_, index) => (
    (bytes[Math.floor(index / 8)] & (1 << (index % 8))) !== 0
  ))
}
