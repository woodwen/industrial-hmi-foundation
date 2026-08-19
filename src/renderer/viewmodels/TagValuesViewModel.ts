import { makeAutoObservable, runInAction } from 'mobx'

import { toAppError, type AppErrorShape } from '../../shared/app-error'
import { SIMULATED_MIXER_DEVICE_ID } from '../../shared/modbus'
import {
  formatTagValue,
  type DashboardTagRole,
  type TagDefinition,
  type TagValue,
  type TagValuesChangedEvent
} from '../../shared/tag'
import type { AppApplicationService } from '../application/AppApplicationService'

export interface DashboardMetric {
  id: DashboardTagRole
  label: string
  value: string
  quality: TagValue['quality']
  timestamp?: string
}

export interface TagMonitorRow {
  tagId: string
  name: string
  value: string
  unit: string
  quality: TagValue['quality']
  timestamp?: string
}

const DASHBOARD_ROLE_ORDER: DashboardTagRole[] = [
  'temperature',
  'level',
  'pressure',
  'rpm',
  'runningState',
  'mode',
  'productionCount'
]

const DASHBOARD_ROLE_LABELS: Record<DashboardTagRole, string> = {
  temperature: 'Temperature',
  level: 'Level',
  pressure: 'Pressure',
  rpm: 'RPM',
  runningState: 'Running State',
  mode: 'Mode',
  productionCount: 'Production Count'
}

export class TagValuesViewModel {
  definitions = new Map<string, TagDefinition>()
  values = new Map<string, TagValue>()
  isInitialized = false
  error: AppErrorShape | null = null
  private unsubscribe: (() => void) | null = null

  constructor(private readonly appService: AppApplicationService) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get dashboardMetrics(): DashboardMetric[] {
    return DASHBOARD_ROLE_ORDER.map((role) => {
      const definition = this.findDashboardDefinition(role)
      if (!definition) {
        return {
          id: role,
          label: DASHBOARD_ROLE_LABELS[role],
          value: '-',
          quality: 'Uncertain'
        }
      }

      const value = this.values.get(definition.id)
      return {
        id: role,
        label: DASHBOARD_ROLE_LABELS[role],
        value: formatTagValue(definition, value?.value ?? null),
        quality: value?.quality ?? 'Uncertain',
        timestamp: value?.timestamp
      }
    })
  }

  get tagMonitorRows(): TagMonitorRow[] {
    return Array.from(this.definitions.values())
      .filter((definition) => definition.deviceId === SIMULATED_MIXER_DEVICE_ID)
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((definition) => {
        const value = this.values.get(definition.id)
        return {
          tagId: definition.id,
          name: definition.name,
          value: formatTagValue(definition, value?.value ?? null),
          unit: definition.unit,
          quality: value?.quality ?? 'Uncertain',
          timestamp: value?.timestamp
        }
      })
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      const snapshot = await this.appService.getTagSnapshot()
      if (!snapshot.ok) {
        runInAction(() => {
          this.error = snapshot.error
        })
        return
      }

      runInAction(() => {
        this.applyDefinitions(snapshot.data.definitions)
        this.applyValues(snapshot.data.values)
        this.isInitialized = true
        this.error = null
      })

      this.unsubscribe = this.appService.subscribeTagValues(this.applyTagEvent)
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:tags-initialize')
      })
    }
  }

  dispose(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.isInitialized = false
  }

  applyTagEvent(event: TagValuesChangedEvent): void {
    runInAction(() => {
      this.applyValues(event.values)
      this.error = null
    })
  }

  private applyDefinitions(definitions: readonly TagDefinition[]): void {
    definitions.forEach((definition) => {
      this.definitions.set(definition.id, definition)
    })
  }

  private applyValues(values: readonly TagValue[]): void {
    values.forEach((value) => {
      this.values.set(value.tagId, value)
    })
  }

  private findDashboardDefinition(role: DashboardTagRole): TagDefinition | undefined {
    return Array.from(this.definitions.values()).find((definition) => definition.dashboardRole === role)
  }
}
