import { createServer, type Server, type Socket } from 'node:net'

import { ModbusException, MODBUS_EXCEPTION, type ModbusMemoryMap } from './memory-map'

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

export interface ModbusTcpServerConfig {
  host: string
  port: number
  unitId: number
}

export type WriteFailureMode = 'off' | 'once' | 'always'

export class ModbusTcpServer {
  private server: Server | null = null
  private readonly sockets = new Set<Socket>()
  private readonly responseTimers = new Set<NodeJS.Timeout>()
  private responseDelayMs = 0
  private writeFailureMode: WriteFailureMode = 'off'
  private networkErrorPending = false

  constructor(
    private readonly config: ModbusTcpServerConfig,
    private readonly memoryMap: ModbusMemoryMap
  ) {}

  get listening(): boolean {
    return this.server?.listening ?? false
  }

  getFaultStatus(): {
    responseDelayMs: number
    writeFailureMode: WriteFailureMode
    networkErrorPending: boolean
  } {
    return {
      responseDelayMs: this.responseDelayMs,
      writeFailureMode: this.writeFailureMode,
      networkErrorPending: this.networkErrorPending
    }
  }

  setResponseDelay(responseDelayMs: number): void {
    this.responseDelayMs = Math.max(0, Math.floor(responseDelayMs))
  }

  setWriteFailureMode(mode: WriteFailureMode): void {
    this.writeFailureMode = mode
  }

  triggerNetworkError(): void {
    if (this.sockets.size === 0) {
      this.networkErrorPending = true
      return
    }

    for (const socket of this.sockets) {
      socket.destroy()
    }
  }

  clearFaults(): void {
    this.responseDelayMs = 0
    this.writeFailureMode = 'off'
    this.networkErrorPending = false
  }

  async start(): Promise<void> {
    if (this.listening) {
      return
    }

    const server = createServer((socket) => this.handleConnection(socket))
    this.server = server

    try {
      await new Promise<void>((resolve, reject) => {
        const handleError = (error: Error): void => {
          server.off('listening', handleListening)
          reject(error)
        }
        const handleListening = (): void => {
          server.off('error', handleError)
          resolve()
        }

        server.once('error', handleError)
        server.once('listening', handleListening)
        server.listen(this.config.port, this.config.host)
      })
    } catch (error) {
      if (this.server === server) {
        this.server = null
      }
      throw error
    }
  }

  async stop(): Promise<void> {
    const server = this.server
    this.server = null

    for (const socket of this.sockets) {
      socket.destroy()
    }
    this.sockets.clear()
    for (const timer of this.responseTimers) {
      clearTimeout(timer)
    }
    this.responseTimers.clear()

    if (!server || !server.listening) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }

  private handleConnection(socket: Socket): void {
    this.sockets.add(socket)

    let buffer: Buffer = Buffer.alloc(0)

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      buffer = this.handleBufferedFrames(socket, buffer)
    })

    socket.on('close', () => {
      this.sockets.delete(socket)
    })

    socket.on('error', () => {
      this.sockets.delete(socket)
    })
  }

  private handleBufferedFrames(socket: Socket, buffer: Buffer): Buffer {
    let remaining = buffer

    while (remaining.length >= 7) {
      const length = remaining.readUInt16BE(4)
      const totalLength = 6 + length

      if (length < 2) {
        socket.destroy()
        return Buffer.alloc(0)
      }

      if (remaining.length < totalLength) {
        break
      }

      const frame = remaining.subarray(0, totalLength)
      remaining = remaining.subarray(totalLength)
      this.handleFrame(socket, frame)
    }

    return remaining
  }

  private handleFrame(socket: Socket, frame: Buffer): void {
    const transactionId = frame.readUInt16BE(0)
    const protocolId = frame.readUInt16BE(2)
    const unitId = frame.readUInt8(6)
    const pdu = frame.subarray(7)

    if (protocolId !== MODBUS_PROTOCOL_ID || pdu.length < 1) {
      socket.destroy()
      return
    }

    const functionCode = pdu.readUInt8(0)
    const processFrame = (): void => {
      try {
        if (this.networkErrorPending) {
          this.networkErrorPending = false
          socket.destroy()
          return
        }

        if (unitId !== this.config.unitId) {
          throw new ModbusException(MODBUS_EXCEPTION.illegalDataAddress, `Unit id ${unitId} is not available.`)
        }

        this.writeResponse(socket, transactionId, unitId, this.handlePdu(functionCode, pdu))
      } catch (error) {
        const exceptionCode = error instanceof ModbusException
          ? error.exceptionCode
          : MODBUS_EXCEPTION.serverDeviceFailure
        this.writeResponse(socket, transactionId, unitId, Buffer.from([functionCode | 0x80, exceptionCode]))
      }
    }

    if (this.responseDelayMs <= 0) {
      processFrame()
      return
    }

    const timer = setTimeout(() => {
      this.responseTimers.delete(timer)
      processFrame()
    }, this.responseDelayMs)
    this.responseTimers.add(timer)
  }

  private handlePdu(functionCode: number, pdu: Buffer): Buffer {
    if (isWriteFunction(functionCode)) {
      this.assertWriteAllowed()
    }

    if (functionCode === FUNCTION_READ_COILS) {
      return this.handleReadBooleans(functionCode, pdu, 'coil')
    }

    if (functionCode === FUNCTION_READ_DISCRETE_INPUTS) {
      return this.handleReadBooleans(functionCode, pdu, 'discreteInput')
    }

    if (functionCode === FUNCTION_READ_HOLDING_REGISTERS) {
      return this.handleReadRegisters(functionCode, pdu, 'holdingRegister')
    }

    if (functionCode === FUNCTION_READ_INPUT_REGISTERS) {
      return this.handleReadRegisters(functionCode, pdu, 'inputRegister')
    }

    if (functionCode === FUNCTION_WRITE_SINGLE_COIL) {
      return this.handleWriteSingleCoil(pdu)
    }

    if (functionCode === FUNCTION_WRITE_SINGLE_REGISTER) {
      return this.handleWriteSingleRegister(pdu)
    }

    if (functionCode === FUNCTION_WRITE_MULTIPLE_COILS) {
      return this.handleWriteMultipleCoils(pdu)
    }

    if (functionCode === FUNCTION_WRITE_MULTIPLE_REGISTERS) {
      return this.handleWriteMultipleRegisters(pdu)
    }

    throw new ModbusException(MODBUS_EXCEPTION.illegalFunction, `Function ${functionCode} is not supported.`)
  }

  private handleReadBooleans(
    functionCode: number,
    pdu: Buffer,
    area: 'coil' | 'discreteInput'
  ): Buffer {
    this.assertPduLength(pdu, 5)
    const address = pdu.readUInt16BE(1)
    const quantity = pdu.readUInt16BE(3)
    const values = this.memoryMap.readBooleans(area, address, quantity)
    const packedValues = packBooleans(values)
    return Buffer.from([functionCode, packedValues.length, ...packedValues])
  }

  private handleReadRegisters(
    functionCode: number,
    pdu: Buffer,
    area: 'holdingRegister' | 'inputRegister'
  ): Buffer {
    this.assertPduLength(pdu, 5)
    const address = pdu.readUInt16BE(1)
    const quantity = pdu.readUInt16BE(3)
    const values = this.memoryMap.readRegisters(area, address, quantity)
    const response = Buffer.alloc(2 + values.length * 2)

    response.writeUInt8(functionCode, 0)
    response.writeUInt8(values.length * 2, 1)
    values.forEach((value, index) => {
      response.writeUInt16BE(value, 2 + index * 2)
    })

    return response
  }

  private handleWriteSingleCoil(pdu: Buffer): Buffer {
    this.assertPduLength(pdu, 5)
    const address = pdu.readUInt16BE(1)
    const rawValue = pdu.readUInt16BE(3)

    if (rawValue !== WRITE_ON && rawValue !== WRITE_OFF) {
      throw new ModbusException(MODBUS_EXCEPTION.illegalDataValue, `Coil value ${rawValue} is invalid.`)
    }

    this.memoryMap.writeCoils(address, [rawValue === WRITE_ON])
    return Buffer.from(pdu)
  }

  private handleWriteSingleRegister(pdu: Buffer): Buffer {
    this.assertPduLength(pdu, 5)
    const address = pdu.readUInt16BE(1)
    const value = pdu.readUInt16BE(3)
    this.memoryMap.writeHoldingRegisters(address, [value])
    return Buffer.from(pdu)
  }

  private handleWriteMultipleCoils(pdu: Buffer): Buffer {
    if (pdu.length < 6) {
      throw new ModbusException(MODBUS_EXCEPTION.illegalDataValue, 'Multiple coil write PDU is incomplete.')
    }

    const address = pdu.readUInt16BE(1)
    const quantity = pdu.readUInt16BE(3)
    const byteCount = pdu.readUInt8(5)
    const expectedByteCount = Math.ceil(quantity / 8)

    if (byteCount !== expectedByteCount || pdu.length !== 6 + byteCount) {
      throw new ModbusException(MODBUS_EXCEPTION.illegalDataValue, 'Multiple coil write byte count is invalid.')
    }

    this.memoryMap.writeCoils(address, unpackBooleans(pdu.subarray(6), quantity))
    return createWriteMultipleResponse(FUNCTION_WRITE_MULTIPLE_COILS, address, quantity)
  }

  private handleWriteMultipleRegisters(pdu: Buffer): Buffer {
    if (pdu.length < 6) {
      throw new ModbusException(MODBUS_EXCEPTION.illegalDataValue, 'Multiple register write PDU is incomplete.')
    }

    const address = pdu.readUInt16BE(1)
    const quantity = pdu.readUInt16BE(3)
    const byteCount = pdu.readUInt8(5)

    if (byteCount !== quantity * 2 || pdu.length !== 6 + byteCount) {
      throw new ModbusException(MODBUS_EXCEPTION.illegalDataValue, 'Multiple register write byte count is invalid.')
    }

    const values = Array.from({ length: quantity }, (_, index) => pdu.readUInt16BE(6 + index * 2))
    this.memoryMap.writeHoldingRegisters(address, values)
    return createWriteMultipleResponse(FUNCTION_WRITE_MULTIPLE_REGISTERS, address, quantity)
  }

  private assertPduLength(pdu: Buffer, expectedLength: number): void {
    if (pdu.length !== expectedLength) {
      throw new ModbusException(MODBUS_EXCEPTION.illegalDataValue, 'PDU length is invalid.')
    }
  }

  private assertWriteAllowed(): void {
    if (this.writeFailureMode === 'off') {
      return
    }

    if (this.writeFailureMode === 'once') {
      this.writeFailureMode = 'off'
    }

    throw new ModbusException(MODBUS_EXCEPTION.serverDeviceFailure, 'Simulator write failure is enabled.')
  }

  private writeResponse(socket: Socket, transactionId: number, unitId: number, pdu: Buffer): void {
    if (socket.destroyed) {
      return
    }

    const response = Buffer.alloc(7 + pdu.length)

    response.writeUInt16BE(transactionId, 0)
    response.writeUInt16BE(MODBUS_PROTOCOL_ID, 2)
    response.writeUInt16BE(pdu.length + 1, 4)
    response.writeUInt8(unitId, 6)
    pdu.copy(response, 7)
    socket.write(response)
  }
}

function isWriteFunction(functionCode: number): boolean {
  return functionCode === FUNCTION_WRITE_SINGLE_COIL ||
    functionCode === FUNCTION_WRITE_SINGLE_REGISTER ||
    functionCode === FUNCTION_WRITE_MULTIPLE_COILS ||
    functionCode === FUNCTION_WRITE_MULTIPLE_REGISTERS
}

function createWriteMultipleResponse(functionCode: number, address: number, quantity: number): Buffer {
  const response = Buffer.alloc(5)
  response.writeUInt8(functionCode, 0)
  response.writeUInt16BE(address, 1)
  response.writeUInt16BE(quantity, 3)
  return response
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
