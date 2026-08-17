import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const DashboardPage = observer(() => {
  const { dashboard } = useViewModels()

  return (
    <PageFrame title="Dashboard" description={dashboard.description}>
      <div className="metrics-grid">
        {dashboard.summaryCards.map((card) => (
          <div className="metric" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </div>
        ))}
      </div>
      <div className="placeholder-panel">
        <h3>Realtime Overview</h3>
        <p>{dashboard.realtimeStateLabel}</p>
      </div>
    </PageFrame>
  )
})
