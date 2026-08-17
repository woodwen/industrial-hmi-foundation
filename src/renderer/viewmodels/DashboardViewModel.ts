import { makeAutoObservable } from 'mobx'

interface DashboardSummaryCard {
  label: string
  value: string
  hint: string
}

export class DashboardViewModel {
  description = 'Application overview frame for future live plant state.'
  realtimeStateLabel = 'Realtime collection is not configured in this foundation change.'
  summaryCards: DashboardSummaryCard[] = [
    {
      label: 'Devices',
      value: 'Reserved',
      hint: 'No live connection'
    },
    {
      label: 'Tags',
      value: 'Reserved',
      hint: 'No polling'
    },
    {
      label: 'Alarms',
      value: 'Reserved',
      hint: 'No alarm engine'
    }
  ]

  constructor() {
    makeAutoObservable(this)
  }
}
