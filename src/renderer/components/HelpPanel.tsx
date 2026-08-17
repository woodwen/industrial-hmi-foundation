import { observer } from 'mobx-react-lite'

import { UserManualDialog } from '../help/UserManualDialog'
import { VersionUpdatesDialog } from '../help/VersionUpdatesDialog'
import { UpdateStatusView } from '../updates/UpdateStatusView'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const HelpPanel = observer(() => {
  const { app, updates } = useViewModels()

  const checkForUpdates = (): void => {
    app.closeHelpMenu()
    void updates.checkForUpdates()
  }

  return (
    <>
      <div className="language-switch" role="group" aria-label={app.t('language.label')}>
        <button
          type="button"
          className={app.language === 'zh-CN' ? 'segmented-button is-active' : 'segmented-button'}
          onClick={() => app.setLanguage('zh-CN')}
        >
          {app.t('language.zh')}
        </button>
        <button
          type="button"
          className={app.language === 'en-US' ? 'segmented-button is-active' : 'segmented-button'}
          onClick={() => app.setLanguage('en-US')}
        >
          {app.t('language.en')}
        </button>
      </div>

      <div className="help-panel">
        <button className="help-button" type="button" onClick={app.toggleHelpMenu}>
          {app.t('help.button')}
        </button>
        {app.isHelpMenuOpen ? (
          <div className="help-menu" role="menu" aria-label={app.t('help.menu')}>
            <button type="button" role="menuitem" onClick={app.openUserManual}>
              {app.t('help.userManual')}
            </button>
            <button type="button" role="menuitem" onClick={app.openVersionUpdates}>
              {app.t('help.versionUpdates')}
            </button>
            <button type="button" role="menuitem" onClick={checkForUpdates}>
              {app.t('help.checkUpdates')}
            </button>
          </div>
        ) : null}
      </div>

      <UserManualDialog
        open={app.activeHelpDialog === 'manual'}
        language={app.language}
        title={app.t('help.userManual')}
        closeLabel={app.t('common.close')}
        onClose={app.closeHelpDialog}
      />
      <VersionUpdatesDialog
        open={app.activeHelpDialog === 'version-updates'}
        title={app.t('help.versionUpdates')}
        note={app.t('help.versionNote')}
        emptyLabel={app.t('help.noVersionNotes')}
        closeLabel={app.t('common.close')}
        onClose={app.closeHelpDialog}
      />
      <UpdateStatusView viewModel={updates} t={app.t} />
    </>
  )
})
