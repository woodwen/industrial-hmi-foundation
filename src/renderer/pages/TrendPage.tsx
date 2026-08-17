import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const TrendPage = observer(() => {
  const { app } = useViewModels()

  return (
    <PageFrame
      title={app.t('navigation.trend')}
      description={app.t('trend.description')}
      eyebrow={app.t('common.moduleFrame')}
    >
      <div className="placeholder-panel trend-grid">
        <div className="trend-line trend-line-a" />
        <div className="trend-line trend-line-b" />
        <p>{app.t('trend.empty.body')}</p>
      </div>
    </PageFrame>
  )
})
