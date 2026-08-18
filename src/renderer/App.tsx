import { useEffect } from 'react'
import { observer } from 'mobx-react-lite'

import { AppLayout } from './components/AppLayout'
import { AlarmPage } from './pages/AlarmPage'
import { DashboardPage } from './pages/DashboardPage'
import { DevicePage } from './pages/DevicePage'
import { RecipePage } from './pages/RecipePage'
import { SettingsPage } from './pages/SettingsPage'
import { TagManagementPage } from './pages/TagManagementPage'
import { TrendPage } from './pages/TrendPage'
import { useViewModels } from './viewmodels/ViewModelContext'

export const App = observer(() => {
  const { alarm, app, device, tags, trend } = useViewModels()

  useEffect(() => {
    void tags.initialize()
    void device.initialize()
    void alarm.initialize()
    void trend.initialize()
    return () => {
      alarm.dispose()
      tags.dispose()
      trend.dispose()
      device.dispose()
    }
  }, [alarm, device, tags, trend])

  return (
    <AppLayout>
      {app.activePage === 'dashboard' && <DashboardPage />}
      {app.activePage === 'device' && <DevicePage />}
      {app.activePage === 'alarm' && <AlarmPage />}
      {app.activePage === 'trend' && <TrendPage />}
      {app.activePage === 'recipe' && <RecipePage />}
      {app.activePage === 'tag-management' && <TagManagementPage />}
      {app.activePage === 'settings' && <SettingsPage />}
    </AppLayout>
  )
})
