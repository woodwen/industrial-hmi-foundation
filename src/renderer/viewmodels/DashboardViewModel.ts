import { makeAutoObservable } from 'mobx'

import type { MessageKey } from '../localization/messages'
import type { DashboardMetric, TagValuesViewModel } from './TagValuesViewModel'

interface DashboardSummaryCard {
  id: 'devices' | 'tags' | 'alarms'
  labelKey: MessageKey
  valueKey: MessageKey
  hintKey: MessageKey
}

export class DashboardViewModel {
  descriptionKey: MessageKey = 'dashboard.description'
  realtimeStateKey: MessageKey = 'dashboard.realtime.state'
  summaryCards: DashboardSummaryCard[] = [
    {
      id: 'devices',
      labelKey: 'dashboard.metric.devices.label',
      valueKey: 'dashboard.metric.reserved',
      hintKey: 'dashboard.metric.devices.hint'
    },
    {
      id: 'tags',
      labelKey: 'dashboard.metric.tags.label',
      valueKey: 'dashboard.metric.reserved',
      hintKey: 'dashboard.metric.tags.hint'
    },
    {
      id: 'alarms',
      labelKey: 'dashboard.metric.alarms.label',
      valueKey: 'dashboard.metric.reserved',
      hintKey: 'dashboard.metric.alarms.hint'
    }
  ]

  constructor(private readonly tags?: TagValuesViewModel) {
    makeAutoObservable(this)
  }

  get realtimeMetrics(): DashboardMetric[] {
    return this.tags?.dashboardMetrics ?? []
  }
}
