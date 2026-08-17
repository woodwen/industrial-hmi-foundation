import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const DevicePage = observer(() => {
  const { device } = useViewModels()

  return (
    <PageFrame title="Device" description={device.description}>
      <div className="placeholder-panel">
        <h3>{device.connectionStateLabel}</h3>
        <p>{device.emptyStateMessage}</p>
      </div>
      <div className="module-table" role="table" aria-label="Device frame">
        <div role="row" className="module-table-header">
          <span role="columnheader">Name</span>
          <span role="columnheader">Protocol</span>
          <span role="columnheader">Status</span>
        </div>
        <div role="row" className="module-table-row">
          <span role="cell">Reserved</span>
          <span role="cell">Not configured</span>
          <span role="cell">Placeholder</span>
        </div>
      </div>
    </PageFrame>
  )
})
