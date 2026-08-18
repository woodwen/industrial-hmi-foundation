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
  const { app, tags } = useViewModels()

  useEffect(() => {
    void tags.initialize()
    return () => {
      tags.dispose()
    }
  }, [tags])

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
