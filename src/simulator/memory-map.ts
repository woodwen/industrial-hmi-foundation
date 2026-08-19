import {
  decodeModbusPointValue,
  encodeModbusPointValue,
  getModbusPoint,
  INITIAL_PROCESS_VALUES,
  MODBUS_EXCEPTION_CODES,
  MODBUS_POINT_LIST,
  type ModbusEngineeringValue,
  type ModbusPointId,
  type ModbusRegisterArea
} from '../shared/modbus'

export const MODBUS_EXCEPTION = MODBUS_EXCEPTION_CODES

export class ModbusException extends Error {
  constructor(
    readonly exceptionCode: number,
    message: string
  ) {
    super(message)
    this.name = 'ModbusException'
  }
}

export interface ProcessValues {
  currentTemperature: number
  targetTemperature: number
  currentLevel: number
  currentPressure: number
  motorRpm: number
  productionCount: number
}

export interface DigitalCommands {
  deviceStartCommand: boolean
  mixerMotorCommand: boolean
  inletValveCommand: boolean
  outletValveCommand: boolean
  autoModeCommand: boolean
}

export interface DigitalFeedbacks {
  deviceRunningStatus: boolean
  mixerMotorRunningStatus: boolean
  inletValveOpenStatus: boolean
  outletValveOpenStatus: boolean
  autoModeStatus: boolean
}

export class ModbusMemoryMap {
  private readonly coils = new Map<number, boolean>()
  private readonly discreteInputs = new Map<number, boolean>()
  private readonly holdingRegisters = new Map<number, number>()
  private readonly inputRegisters = new Map<number, number>()

  constructor() {
    this.initializeBooleans()
    this.setHoldingValue('targetTemperature', INITIAL_PROCESS_VALUES.targetTemperature)
    this.setHoldingValue('manualMotorRpmSetpoint', INITIAL_PROCESS_VALUES.motorRpm)
    this.setProcessValues(INITIAL_PROCESS_VALUES)
    this.setFeedbacks({
      deviceRunningStatus: false,
      mixerMotorRunningStatus: false,
      inletValveOpenStatus: false,
      outletValveOpenStatus: false,
      autoModeStatus: false
    })
  }

  readBooleans(area: Extract<ModbusRegisterArea, 'coil' | 'discreteInput'>, address: number, quantity: number): boolean[] {
    this.assertQuantity(quantity, 1, 2000)
    const memory = area === 'coil' ? this.coils : this.discreteInputs
    return Array.from({ length: quantity }, (_, offset) => this.requireBoolean(memory, address + offset))
  }

  readRegisters(
    area: Extract<ModbusRegisterArea, 'holdingRegister' | 'inputRegister'>,
    address: number,
    quantity: number
  ): number[] {
    this.assertQuantity(quantity, 1, 125)
    const memory = area === 'holdingRegister' ? this.holdingRegisters : this.inputRegisters
    return Array.from({ length: quantity }, (_, offset) => this.requireRegister(memory, address + offset))
  }

  writeCoils(address: number, values: readonly boolean[]): void {
    this.assertQuantity(values.length, 1, 1968)

    const updates = values.map((value, offset) => {
      const pduAddress = address + offset
      if (!this.coils.has(pduAddress)) {
        throw new ModbusException(MODBUS_EXCEPTION.illegalDataAddress, `Coil address ${pduAddress} is not mapped.`)
      }
      return {
        pduAddress,
        value
      }
    })

    updates.forEach(({ pduAddress, value }) => {
      this.coils.set(pduAddress, value)
    })
  }

  writeHoldingRegisters(address: number, values: readonly number[]): void {
    this.assertQuantity(values.length, 1, 123)

    const updates = values.map((value, offset) => {
      if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
        throw new ModbusException(MODBUS_EXCEPTION.illegalDataValue, `Register value ${value} is invalid.`)
      }

      const pduAddress = address + offset
      const point = MODBUS_POINT_LIST.find((candidate) => (
        candidate.area === 'holdingRegister' &&
        candidate.pduAddress === pduAddress &&
        candidate.quantity === 1
      ))

      if (!point) {
        throw new ModbusException(
          MODBUS_EXCEPTION.illegalDataAddress,
          `Holding register address ${pduAddress} is not mapped.`
        )
      }

      try {
        const engineeringValue = decodeModbusPointValue(point, [value])
        if (typeof engineeringValue !== 'number') {
          throw new Error('Holding register decoded to a non-numeric value.')
        }
        if (point.min !== undefined && engineeringValue < point.min) {
          throw new Error(`Value is below ${point.min}.`)
        }
        if (point.max !== undefined && engineeringValue > point.max) {
          throw new Error(`Value is above ${point.max}.`)
        }
      } catch (error) {
        throw new ModbusException(
          MODBUS_EXCEPTION.illegalDataValue,
          error instanceof Error ? error.message : String(error)
        )
      }

      return {
        pduAddress,
        value
      }
    })

    updates.forEach(({ pduAddress, value }) => {
      this.holdingRegisters.set(pduAddress, value)
    })
  }

  getCommands(): DigitalCommands {
    return {
      deviceStartCommand: this.readCoilPoint('deviceStartCommand'),
      mixerMotorCommand: this.readCoilPoint('mixerMotorCommand'),
      inletValveCommand: this.readCoilPoint('inletValveCommand'),
      outletValveCommand: this.readCoilPoint('outletValveCommand'),
      autoModeCommand: this.readCoilPoint('autoModeCommand')
    }
  }

  getProcessValues(): ProcessValues {
    return {
      currentTemperature: this.readNumericPoint('currentTemperature'),
      targetTemperature: this.readNumericPoint('targetTemperature'),
      currentLevel: this.readNumericPoint('currentLevel'),
      currentPressure: this.readNumericPoint('currentPressure'),
      motorRpm: this.readNumericPoint('motorRpm'),
      productionCount: this.readNumericPoint('productionCount')
    }
  }

  getManualMotorRpmSetpoint(): number {
    return this.readNumericPoint('manualMotorRpmSetpoint')
  }

  setProcessValues(values: ProcessValues): void {
    this.setInputValue('currentTemperature', values.currentTemperature)
    this.setInputValue('currentLevel', values.currentLevel)
    this.setInputValue('currentPressure', values.currentPressure)
    this.setInputValue('motorRpm', values.motorRpm)
    this.setInputValue('productionCount', values.productionCount)
  }

  setFeedbacks(feedbacks: DigitalFeedbacks): void {
    this.setDiscreteInputValue('deviceRunningStatus', feedbacks.deviceRunningStatus)
    this.setDiscreteInputValue('mixerMotorRunningStatus', feedbacks.mixerMotorRunningStatus)
    this.setDiscreteInputValue('inletValveOpenStatus', feedbacks.inletValveOpenStatus)
    this.setDiscreteInputValue('outletValveOpenStatus', feedbacks.outletValveOpenStatus)
    this.setDiscreteInputValue('autoModeStatus', feedbacks.autoModeStatus)
  }

  private initializeBooleans(): void {
    for (const point of MODBUS_POINT_LIST) {
      if (point.dataType !== 'boolean') {
        continue
      }

      if (point.area === 'coil') {
        this.coils.set(point.pduAddress, false)
      } else if (point.area === 'discreteInput') {
        this.discreteInputs.set(point.pduAddress, false)
      }
    }
  }

  private readCoilPoint(pointId: keyof DigitalCommands): boolean {
    const point = getModbusPoint(pointId)
    return this.requireBoolean(this.coils, point.pduAddress)
  }

  private readNumericPoint(pointId: ModbusPointId): number {
    const point = getModbusPoint(pointId)
    const rawValues = point.area === 'holdingRegister'
      ? this.readRegisters('holdingRegister', point.pduAddress, point.quantity)
      : this.readRegisters('inputRegister', point.pduAddress, point.quantity)
    const value = decodeModbusPointValue(point, rawValues)

    if (typeof value !== 'number') {
      throw new Error(`Point ${point.id} is not numeric.`)
    }

    return value
  }

  private setHoldingValue(pointId: 'targetTemperature' | 'manualMotorRpmSetpoint', value: number): void {
    this.writeRegistersToMemory(this.holdingRegisters, pointId, value)
  }

  private setInputValue(pointId: keyof Omit<ProcessValues, 'targetTemperature'>, value: number): void {
    this.writeRegistersToMemory(this.inputRegisters, pointId, value)
  }

  private setDiscreteInputValue(pointId: keyof DigitalFeedbacks, value: boolean): void {
    const point = getModbusPoint(pointId)
    this.discreteInputs.set(point.pduAddress, value)
  }

  private writeRegistersToMemory(
    memory: Map<number, number>,
    pointId: ModbusPointId,
    value: ModbusEngineeringValue
  ): void {
    const point = getModbusPoint(pointId)
    const rawValues = encodeModbusPointValue(
      {
        ...point,
        access: 'readWrite'
      },
      value
    )

    rawValues.forEach((rawValue, offset) => {
      if (typeof rawValue !== 'number') {
        throw new Error(`Point ${point.id} encoded to a non-register value.`)
      }
      memory.set(point.pduAddress + offset, rawValue)
    })
  }

  private requireBoolean(memory: Map<number, boolean>, address: number): boolean {
    const value = memory.get(address)
    if (value === undefined) {
      throw new ModbusException(MODBUS_EXCEPTION.illegalDataAddress, `Boolean address ${address} is not mapped.`)
    }
    return value
  }

  private requireRegister(memory: Map<number, number>, address: number): number {
    const value = memory.get(address)
    if (value === undefined) {
      throw new ModbusException(MODBUS_EXCEPTION.illegalDataAddress, `Register address ${address} is not mapped.`)
    }
    return value
  }

  private assertQuantity(quantity: number, min: number, max: number): void {
    if (!Number.isInteger(quantity) || quantity < min || quantity > max) {
      throw new ModbusException(MODBUS_EXCEPTION.illegalDataValue, `Quantity ${quantity} is invalid.`)
    }
  }
}
