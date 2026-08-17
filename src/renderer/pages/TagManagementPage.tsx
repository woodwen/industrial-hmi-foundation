import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const TagManagementPage = observer(() => {
  const { app } = useViewModels()

  return (
    <PageFrame
      title={app.t('navigation.tagManagement')}
      description={app.t('tag.description')}
      eyebrow={app.t('common.moduleFrame')}
    >
      <div className="module-table" role="table" aria-label={app.t('tag.table.aria')}>
        <div role="row" className="module-table-header">
          <span role="columnheader">{app.t('tag.table.tag')}</span>
          <span role="columnheader">{app.t('tag.table.address')}</span>
          <span role="columnheader">{app.t('tag.table.quality')}</span>
        </div>
        <div role="row" className="module-table-row">
          <span role="cell">{app.t('device.table.reserved')}</span>
          <span role="cell">{app.t('tag.table.notMapped')}</span>
          <span role="cell">{app.t('tag.table.noPolling')}</span>
        </div>
      </div>
    </PageFrame>
  )
})
