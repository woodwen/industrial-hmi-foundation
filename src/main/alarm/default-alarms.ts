import type { AlarmDefinition } from '../../shared/alarm'

export const MOTOR_ABNORMAL_SIGNAL_ID = 'mixer.motorAbnormal'
export const PLC_DISCONNECTED_SIGNAL_ID = 'device.simulated-plc.connectionLost'

export const DEFAULT_ALARM_RECOVERY_DEADBANDS: Record<string, number> = {
  currentTemperature: 0.5,
  currentLevel: 1,
  currentPressure: 0.02,
  motorRpm: 20
}

export const DEFAULT_ALARM_DEFINITIONS: AlarmDefinition[] = [
  {
    id: 'alarm-temp-high',
    code: 'TEMP_HIGH',
    tagId: 'currentTemperature',
    condition: 'High',
    threshold: 80,
    delay: 3000,
    level: 'High',
    message: 'Temperature is too high',
    enabled: true,
    deadband: DEFAULT_ALARM_RECOVERY_DEADBANDS.currentTemperature
  },
  {
    id: 'alarm-level-low',
    code: 'LEVEL_LOW',
    tagId: 'currentLevel',
    condition: 'Low',
    threshold: 15,
    delay: 3000,
    level: 'Warning',
    message: 'Level is too low',
    enabled: true,
    deadband: DEFAULT_ALARM_RECOVERY_DEADBANDS.currentLevel
  },
  {
    id: 'alarm-pressure-high',
    code: 'PRESSURE_HIGH',
    tagId: 'currentPressure',
    condition: 'High',
    threshold: 0.3,
    delay: 2000,
    level: 'High',
    message: 'Pressure is too high',
    enabled: true,
    deadband: DEFAULT_ALARM_RECOVERY_DEADBANDS.currentPressure
  },
  {
    id: 'alarm-motor-abnormal',
    code: 'MOTOR_ABNORMAL',
    tagId: MOTOR_ABNORMAL_SIGNAL_ID,
    condition: 'BooleanState',
    threshold: true,
    delay: 5000,
    level: 'Critical',
    message: 'Motor feedback is abnormal',
    enabled: true
  },
  {
    id: 'alarm-plc-disconnected',
    code: 'PLC_DISCONNECTED',
    tagId: PLC_DISCONNECTED_SIGNAL_ID,
    condition: 'BooleanState',
    threshold: true,
    delay: 1000,
    level: 'Critical',
    message: 'PLC communication is lost',
    enabled: true
  }
]
