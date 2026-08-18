import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const DashboardPage = observer(() => {
  const { app, dashboard } = useViewModels()

  return (
    <PageFrame
      title={app.t('navigation.dashboard')}
      description={app.t(dashboard.descriptionKey)}
      eyebrow={app.t('common.moduleFrame')}
    >
      <div className="metrics-grid">
        {dashboard.realtimeMetrics.length > 0 ? dashboard.realtimeMetrics.map((metric) => (
          <div className={`metric quality-${metric.quality.toLowerCase()}`} key={metric.id}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.quality}{metric.timestamp ? ` / ${metric.timestamp}` : ''}</small>
          </div>
        )) : dashboard.summaryCards.map((card) => (
          <div className="metric" key={card.id}>
            <span>{app.t(card.labelKey)}</span>
            <strong>{app.t(card.valueKey)}</strong>
            <small>{app.t(card.hintKey)}</small>
          </div>
        ))}
      </div>
      <div className="placeholder-panel realtime-panel">
        <h3>{app.t('dashboard.realtime.title')}</h3>
        <p>{dashboard.realtimeMetrics.length > 0 ? app.t('dashboard.realtime.live') : app.t(dashboard.realtimeStateKey)}</p>
      </div>
    </PageFrame>
  )
})
