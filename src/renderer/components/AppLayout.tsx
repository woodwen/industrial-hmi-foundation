import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { observer } from 'mobx-react-lite'

import { useViewModels } from '../viewmodels/ViewModelContext'
import { Navigation } from './Navigation'

export const AppLayout = observer(({ children }: PropsWithChildren) => {
  const { app } = useViewModels()

  useEffect(() => {
    void app.loadAppInfo()
  }, [app])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">IH</span>
          <div>
            <strong>{app.appName}</strong>
            <span>Foundation</span>
          </div>
        </div>
        <Navigation />
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Industrial HMI</span>
            <h1>{app.activePageTitle}</h1>
          </div>
          <div className="runtime-status">
            <span className="status-dot" />
            <span>{app.environmentLabel}</span>
            <span>{app.appVersion}</span>
          </div>
        </header>

        {app.error && (
          <section className="error-banner" role="alert">
            <strong>{app.error.code}</strong>
            <span>{app.error.message}</span>
          </section>
        )}

        <section className="page-surface">{children}</section>
      </main>
    </div>
  )
})
