import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { observer } from 'mobx-react-lite'

import { useViewModels } from '../viewmodels/ViewModelContext'
import { HelpPanel } from './HelpPanel'
import { Navigation } from './Navigation'

export const AppLayout = observer(({ children }: PropsWithChildren) => {
  const { app, auth, updates } = useViewModels()

  useEffect(() => {
    void app.loadAppInfo()
    updates.initialize()

    return () => {
      updates.dispose()
    }
  }, [app, updates])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">IH</span>
          <div>
            <strong>{app.appName}</strong>
            <span>{app.t('brand.foundation')}</span>
          </div>
        </div>
        <Navigation />
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{app.t('app.eyebrow')}</span>
            <h1>{app.activePageTitle}</h1>
          </div>
          <div className="topbar-actions">
            <section className="auth-strip" aria-label="Local user">
              <span>{auth.currentUserLabel}</span>
              {auth.requiresInitialization ? (
                <>
                  <input
                    aria-label="Admin username"
                    value={auth.initializeUsername}
                    onChange={(event) => auth.setInitializeUsername(event.currentTarget.value)}
                  />
                  <input
                    aria-label="Admin display name"
                    value={auth.initializeDisplayName}
                    onChange={(event) => auth.setInitializeDisplayName(event.currentTarget.value)}
                  />
                  <input
                    aria-label="Admin password"
                    type="password"
                    value={auth.initializePassword}
                    onChange={(event) => auth.setInitializePassword(event.currentTarget.value)}
                  />
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={auth.isSubmitting}
                    onClick={() => {
                      void auth.createFirstAdmin()
                    }}
                  >
                    初始化
                  </button>
                </>
              ) : auth.currentUser ? (
                <button
                  type="button"
                  className="secondary-action"
                  disabled={auth.isSubmitting}
                  onClick={() => {
                    void auth.logout()
                  }}
                >
                  Logout
                </button>
              ) : (
                <>
                  <input
                    aria-label="Username"
                    value={auth.loginUsername}
                    onChange={(event) => auth.setLoginUsername(event.currentTarget.value)}
                  />
                  <input
                    aria-label="Password"
                    type="password"
                    value={auth.loginPassword}
                    onChange={(event) => auth.setLoginPassword(event.currentTarget.value)}
                  />
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={auth.isSubmitting}
                    onClick={() => {
                      void auth.login()
                    }}
                  >
                    Login
                  </button>
                </>
              )}
            </section>
            <HelpPanel />
            <div className="runtime-status">
              <span className="status-dot" />
              <span>{app.environmentLabel}</span>
              <span>{app.appVersion}</span>
            </div>
          </div>
        </header>

        {app.error && (
          <section className="error-banner" role="alert">
            <strong>{app.error.code}</strong>
            <span>{app.error.message}</span>
          </section>
        )}
        {auth.error && (
          <section className="error-banner" role="alert">
            <strong>{auth.error.code}</strong>
            <span>{auth.error.message}</span>
          </section>
        )}

        <section className="page-surface">{children}</section>
      </main>
    </div>
  )
})
