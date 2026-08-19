# Alarm Module

Owns Main Process alarm rules, alarm signal evaluation, acknowledgement, and Alarm History persistence.

- Default alarms cover high temperature, low level, high pressure, motor abnormal, and PLC disconnect.
- AlarmEngine evaluates TagCache values and named synthetic domain signals.
- Activation and recovery use delay/debounce so transient process noise does not produce duplicate alarm records.
- `Acknowledged` means an operator confirmed the occurrence; `Recovered` means it has both been acknowledged and physically recovered.
