import type { RecipeParameterDefinition, RecipeParameterKey } from '../../shared/recipe'

export const DEFAULT_RECIPE_PARAMETER_DEFINITIONS: readonly RecipeParameterDefinition[] = [
  {
    key: 'targetTemperature',
    label: 'Target Temperature',
    unit: '°C',
    dataType: 'number',
    required: true,
    min: 20,
    max: 90,
    commandId: 'setTargetTemperature'
  },
  {
    key: 'rpmSetpoint',
    label: 'RPM Setpoint',
    unit: 'rpm',
    dataType: 'number',
    required: true,
    min: 0,
    max: 1800,
    commandId: 'setRpmSetpoint'
  },
  {
    key: 'mixDuration',
    label: 'Mix Duration',
    unit: 's',
    dataType: 'number',
    required: true,
    min: 1,
    max: 3600
  },
  {
    key: 'feedDuration',
    label: 'Feed Duration',
    unit: 's',
    dataType: 'number',
    required: true,
    min: 1,
    max: 1800
  }
]

export function getRecipeParameterDefinition(key: RecipeParameterKey): RecipeParameterDefinition {
  const definition = DEFAULT_RECIPE_PARAMETER_DEFINITIONS.find((candidate) => candidate.key === key)
  if (!definition) {
    throw new Error(`Recipe parameter definition is missing: ${key}`)
  }

  return definition
}
