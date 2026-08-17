import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const DevicePage = observer(() => {
  const { app, device } = useViewModels()

  return (
    <PageFrame
      title={app.t('navigation.device')}
      description={app.t(device.descriptionKey)}
      eyebrow={app.t('common.moduleFrame')}
    >
      <div className="placeholder-panel">
        <h3>{app.t(device.connectionStateKey)}</h3>
        <p>{app.t(device.emptyStateKey)}</p>
      </div>
      <div className="module-table" role="table" aria-label={app.t('device.table.aria')}>
        <div role="row" className="module-table-header">
          <span role="columnheader">{app.t('device.table.name')}</span>
          <span role="columnheader">{app.t('device.table.protocol')}</span>
          <span role="columnheader">{app.t('device.table.status')}</span>
        </div>
        <div role="row" className="module-table-row">
          <span role="cell">{app.t('device.table.reserved')}</span>
          <span role="cell">{app.t('device.table.notConfigured')}</span>
          <span role="cell">{app.t('device.table.placeholder')}</span>
        </div>
      </div>
    </PageFrame>
  )
})
