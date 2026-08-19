import { describe, expect, it } from 'vitest'

import {
  MODBUS_POINTS,
  decodeModbusPointValue,
  encodeModbusPointValue,
  getModbusPoint
} from '../../src/shared/modbus'

describe('Modbus address mapping', () => {
  it('maps writable coil commands to zero-based PDU addresses', () => {
    expect(MODBUS_POINTS.deviceStartCommand).toMatchObject({
      area: 'coil',
      referenceAddress: '00001',
      pduAddress: 0,
      access: 'readWrite'
    })
    expect(MODBUS_POINTS.autoModeCommand).toMatchObject({
      area: 'coil',
      referenceAddress: '00005',
      pduAddress: 4,
      access: 'readWrite'
    })
  })

  it('maps discrete input feedback separately from writable coils', () => {
    expect(MODBUS_POINTS.deviceRunningStatus).toMatchObject({
      area: 'discreteInput',
      referenceAddress: '10001',
      pduAddress: 0,
      access: 'read'
    })
    expect(MODBUS_POINTS.autoModeStatus).toMatchObject({
      area: 'discreteInput',
      referenceAddress: '10005',
      pduAddress: 4,
      access: 'read'
    })
  })

  it('maps input registers and production count word order', () => {
    expect(MODBUS_POINTS.currentTemperature).toMatchObject({
      area: 'inputRegister',
      referenceAddress: '30001',
      pduAddress: 0,
      scale: 0.1,
      unit: '°C'
    })
    expect(MODBUS_POINTS.productionCount).toMatchObject({
      area: 'inputRegister',
      referenceAddress: '30005-30006',
      pduAddress: 4,
      quantity: 2,
      dataType: 'uint32'
    })
    expect(decodeModbusPointValue(getModbusPoint('productionCount'), [0x0001, 0x0002])).toBe(65538)
  })

  it('maps writable holding registers with configured ranges', () => {
    expect(MODBUS_POINTS.targetTemperature).toMatchObject({
      area: 'holdingRegister',
      referenceAddress: '40001',
      pduAddress: 0,
      access: 'readWrite',
      min: 20,
      max: 90,
      scale: 0.1
    })
    expect(MODBUS_POINTS.manualMotorRpmSetpoint).toMatchObject({
      area: 'holdingRegister',
      referenceAddress: '40002',
      pduAddress: 1,
      access: 'readWrite',
      min: 0,
      max: 1800
    })
  })

  it('encodes and decodes engineering values using mapping scale metadata', () => {
    const targetTemperature = getModbusPoint('targetTemperature')
    const manualRpm = getModbusPoint('manualMotorRpmSetpoint')

    expect(encodeModbusPointValue(targetTemperature, 60.5)).toEqual([605])
    expect(decodeModbusPointValue(targetTemperature, [605])).toBe(60.5)
    expect(encodeModbusPointValue(manualRpm, 1200)).toEqual([1200])
    expect(decodeModbusPointValue(manualRpm, [1200])).toBe(1200)
  })

  it('rejects writes outside writable ranges and read-only points', () => {
    expect(() => encodeModbusPointValue(getModbusPoint('targetTemperature'), 91)).toThrow('above 90')
    expect(() => encodeModbusPointValue(getModbusPoint('currentTemperature'), 60)).toThrow('read-only')
  })
})
