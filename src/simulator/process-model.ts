import type { ModbusMemoryMap, ProcessValues } from './memory-map'

const AMBIENT_TEMPERATURE = 25
const DEFAULT_RUNNING_RPM = 900
const PRODUCTION_CYCLE_MS = 3000

export class ProcessModel {
  private productionElapsedMs = 0

  constructor(private readonly memoryMap: ModbusMemoryMap) {}

  tick(deltaMs: number): ProcessValues {
    const seconds = Math.max(deltaMs, 0) / 1000
    const commands = this.memoryMap.getCommands()
    const current = this.memoryMap.getProcessValues()
    const deviceRunning = commands.deviceStartCommand
    const motorRunning = deviceRunning || commands.mixerMotorCommand
    const rpmSetpoint = this.memoryMap.getManualMotorRpmSetpoint()
    const targetRpm = motorRunning
      ? rpmSetpoint > 0
        ? rpmSetpoint
        : DEFAULT_RUNNING_RPM
      : 0

    const nextValues: ProcessValues = {
      currentTemperature: moveToward(
        current.currentTemperature,
        deviceRunning ? current.targetTemperature : AMBIENT_TEMPERATURE,
        1.6 * seconds
      ),
      targetTemperature: current.targetTemperature,
      currentLevel: clamp(
        current.currentLevel +
          (commands.inletValveCommand ? 5.0 * seconds : 0) -
          (commands.outletValveCommand ? 6.0 * seconds : 0) +
          (deviceRunning && !commands.outletValveCommand ? 0.25 * seconds : 0),
        0,
        100
      ),
      currentPressure: current.currentPressure,
      motorRpm: Math.round(moveToward(current.motorRpm, targetRpm, 320 * seconds)),
      productionCount: current.productionCount
    }

    nextValues.currentPressure = roundTo(
      clamp(0.04 + nextValues.currentLevel * 0.0018 + nextValues.motorRpm * 0.00004, 0.04, 0.35),
      2
    )

    if (deviceRunning && nextValues.motorRpm > 100) {
      this.productionElapsedMs += deltaMs
      while (this.productionElapsedMs >= PRODUCTION_CYCLE_MS) {
        nextValues.productionCount += 1
        this.productionElapsedMs -= PRODUCTION_CYCLE_MS
      }
    } else {
      this.productionElapsedMs = 0
    }

    const roundedValues = {
      ...nextValues,
      currentTemperature: roundTo(nextValues.currentTemperature, 1),
      currentLevel: roundTo(nextValues.currentLevel, 1)
    }

    this.memoryMap.setProcessValues(roundedValues)
    this.memoryMap.setFeedbacks({
      deviceRunningStatus: deviceRunning,
      mixerMotorRunningStatus: motorRunning,
      inletValveOpenStatus: commands.inletValveCommand,
      outletValveOpenStatus: commands.outletValveCommand,
      autoModeStatus: commands.autoModeCommand
    })

    return roundedValues
  }
}

function moveToward(current: number, target: number, step: number): number {
  if (current < target) {
    return Math.min(current + step, target)
  }

  if (current > target) {
    return Math.max(current - step, target)
  }

  return current
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
