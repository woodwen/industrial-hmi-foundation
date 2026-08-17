import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const SettingsPage = observer(() => {
  const { app } = useViewModels()

  return (
    <PageFrame
      title={app.t('navigation.settings')}
      description={app.t('settings.description')}
      eyebrow={app.t('common.moduleFrame')}
    >
      <div className="settings-list">
        <label>
          <span>{app.t('settings.applicationLogs')}</span>
          <input type="checkbox" checked readOnly />
        </label>
        <label>
          <span>{app.t('settings.communicationLogs')}</span>
          <input type="checkbox" checked readOnly />
        </label>
        <label>
          <span>{app.t('settings.errorReporting')}</span>
          <input type="checkbox" checked readOnly />
        </label>
      </div>
    </PageFrame>
  )
})
