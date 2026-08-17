import { observer } from 'mobx-react-lite'

import type { MessageKey } from '../localization/messages'
import type { AppViewModel } from '../viewmodels/AppViewModel'
import type { AppUpdateViewModel } from '../viewmodels/AppUpdateViewModel'
import { Dialog } from '../components/Dialog'

interface UpdateStatusViewProps {
  viewModel: AppUpdateViewModel
  t: AppViewModel['t']
}

export const UpdateStatusView = observer(({ viewModel, t }: UpdateStatusViewProps) => {
  const { state } = viewModel

  if (state.status === 'idle' || !viewModel.isDialogVisible) {
    return null
  }

  const progress = Math.round(state.progress?.percent ?? 0)

  return (
    <Dialog
      open
      title={t(getTitleKey(state.status))}
      onClose={viewModel.dismiss}
      closeLabel={t('common.close')}
      className="update-dialog"
      footer={renderFooter(viewModel, t)}
    >
      <p>{state.message}</p>
      {state.status === 'downloading' ? (
        <div className="progress-meter" aria-label={t('update.title.downloading')}>
          <div style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      ) : null}
    </Dialog>
  )
})

function renderFooter(viewModel: AppUpdateViewModel, t: AppViewModel['t']): JSX.Element {
  switch (viewModel.state.status) {
    case 'available':
      return (
        <>
          <button className="secondary-button" type="button" onClick={viewModel.dismiss}>
            {t('common.dismiss')}
          </button>
          <button className="primary-button" type="button" onClick={() => void viewModel.downloadUpdate()}>
            {t('update.action.download')}
          </button>
        </>
      )
    case 'manual-download':
      return (
        <>
          <button className="secondary-button" type="button" onClick={viewModel.dismiss}>
            {t('common.dismiss')}
          </button>
          <button className="primary-button" type="button" onClick={() => void viewModel.openManualDownloadPage()}>
            {t('update.action.openDownloadPage')}
          </button>
        </>
      )
    case 'downloading':
      return (
        <>
          <button className="secondary-button" type="button" onClick={() => void viewModel.cancelDownload()}>
            {t('update.action.cancelDownload')}
          </button>
          <button className="primary-button" type="button" onClick={viewModel.downloadInBackground}>
            {t('update.action.background')}
          </button>
        </>
      )
    case 'downloaded':
      return (
        <>
          <button className="secondary-button" type="button" onClick={viewModel.dismiss}>
            {t('common.dismiss')}
          </button>
          <button className="primary-button" type="button" onClick={() => void viewModel.quitAndInstall()}>
            {t('update.action.install')}
          </button>
        </>
      )
    default:
      return (
        <button className="primary-button" type="button" onClick={viewModel.dismiss}>
          {t('common.dismiss')}
        </button>
      )
  }
}

function getTitleKey(status: Exclude<AppUpdateViewModel['state']['status'], 'idle'>): MessageKey {
  switch (status) {
    case 'checking':
      return 'update.title.checking'
    case 'available':
      return 'update.title.available'
    case 'manual-download':
      return 'update.title.manualDownload'
    case 'not-available':
      return 'update.title.notAvailable'
    case 'downloading':
      return 'update.title.downloading'
    case 'downloaded':
      return 'update.title.downloaded'
    case 'cancelled':
      return 'update.title.cancelled'
    case 'error':
      return 'update.title.error'
  }
}
