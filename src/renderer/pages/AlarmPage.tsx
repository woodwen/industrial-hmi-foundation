import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const AlarmPage = observer(() => {
  const { app } = useViewModels()

  return (
    <PageFrame
      title={app.t('navigation.alarm')}
      description={app.t('alarm.description')}
      eyebrow={app.t('common.moduleFrame')}
    >
      <div className="placeholder-panel">
        <h3>{app.t('alarm.empty.title')}</h3>
        <p>{app.t('alarm.empty.body')}</p>
      </div>
    </PageFrame>
  )
})
