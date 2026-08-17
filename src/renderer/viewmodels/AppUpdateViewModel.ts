import { makeAutoObservable, runInAction } from 'mobx'

import { toAppError } from '../../shared/app-error'
import type { AppUpdateEvent, AppUpdateState, Unsubscribe, UpdateErrorReason } from '../../shared/hmi-api'
import type { AppApplicationService } from '../application/AppApplicationService'
import { translate, type LanguageCode, type MessageKey } from '../localization/messages'

type LanguageProvider = () => LanguageCode

export class AppUpdateViewModel {
  state: AppUpdateState = {
    status: 'idle'
  }
  isDialogVisible = false
  private removeUpdateListener?: Unsubscribe

  constructor(
    private readonly appService: AppApplicationService,
    private readonly getLanguage: LanguageProvider
  ) {
    makeAutoObservable<this, 'appService' | 'getLanguage' | 'removeUpdateListener'>(
      this,
      {
        appService: false,
        getLanguage: false,
        removeUpdateListener: false
      },
      { autoBind: true }
    )
  }

  initialize(): void {
    if (this.removeUpdateListener) {
      return
    }

    this.removeUpdateListener = this.appService.onUpdateEvent(this.handleUpdateEvent)
  }

  dispose(): void {
    this.removeUpdateListener?.()
    this.removeUpdateListener = undefined
  }

  async checkForUpdates(): Promise<void> {
    this.isDialogVisible = true
    this.state = {
      status: 'checking',
      message: this.message('update.message.checking')
    }

    try {
      const result = await this.appService.checkForUpdates()
      if (!result.ok) {
        this.state = {
          status: 'error',
          message: result.error.message
        }
      }
    } catch (error) {
      this.state = {
        status: 'error',
        message: toAppError(error, 'renderer:updates:check').message
      }
    }
  }

  async downloadUpdate(): Promise<void> {
    this.isDialogVisible = true
    this.state = {
      status: 'downloading',
      message: this.message('update.message.downloading'),
      progress: createEmptyProgress()
    }

    try {
      const result = await this.appService.downloadUpdate()
      if (!result.ok) {
        runInAction(() => {
          this.state = {
            status: 'error',
            message: result.error.message
          }
        })
      }
    } catch (error) {
      runInAction(() => {
        this.state = {
          status: 'error',
          message: toAppError(error, 'renderer:updates:download').message
        }
      })
    }
  }

  async cancelDownload(): Promise<void> {
    try {
      const result = await this.appService.cancelUpdateDownload()
      if (!result.ok) {
        this.state = {
          status: 'error',
          message: result.error.message
        }
      }
    } finally {
      this.isDialogVisible = true
    }
  }

  downloadInBackground(): void {
    this.isDialogVisible = false
  }

  async openManualDownloadPage(): Promise<void> {
    try {
      const result = await this.appService.openUpdateDownloadPage(this.state.version)
      if (!result.ok) {
        this.state = {
          status: 'error',
          message: result.error.message
        }
        return
      }

      this.dismiss()
    } catch (error) {
      this.state = {
        status: 'error',
        message: toAppError(error, 'renderer:updates:open-download-page').message
      }
    }
  }

  async quitAndInstall(): Promise<void> {
    try {
      const result = await this.appService.quitAndInstallUpdate()
      if (!result.ok) {
        this.state = {
          status: 'error',
          message: result.error.message
        }
      }
    } catch (error) {
      this.state = {
        status: 'error',
        message: toAppError(error, 'renderer:updates:quit-and-install').message
      }
    }
  }

  dismiss(): void {
    this.isDialogVisible = false
    this.state = { status: 'idle' }
  }

  private handleUpdateEvent(event: AppUpdateEvent): void {
    runInAction(() => {
      this.isDialogVisible = true

      switch (event.type) {
        case 'checking':
          this.state = {
            status: 'checking',
            message: this.message('update.message.checking')
          }
          break
        case 'available':
          this.state = {
            status: 'available',
            version: event.version,
            message: this.message('update.message.available', { version: event.version })
          }
          break
        case 'manual-download':
          this.state = {
            status: 'manual-download',
            version: event.version,
            message: this.message('update.message.manualDownload')
          }
          break
        case 'not-available':
          this.state = {
            status: 'not-available',
            version: event.version,
            message: event.development
              ? this.message('update.message.development')
              : this.message('update.message.notAvailable')
          }
          break
        case 'progress':
          this.state = {
            status: 'downloading',
            message: this.message('update.message.downloading'),
            progress: event.progress
          }
          break
        case 'downloaded':
          this.state = {
            status: 'downloaded',
            version: event.version,
            message: this.message('update.message.downloaded', { version: event.version })
          }
          break
        case 'cancelled':
          this.state = {
            status: 'cancelled',
            message: this.message('update.message.cancelled')
          }
          break
        case 'error':
          this.state = {
            status: 'error',
            message: this.getUpdateErrorMessage(event.reason, event.message)
          }
          break
      }
    })
  }

  private getUpdateErrorMessage(reason: UpdateErrorReason, fallbackMessage: string): string {
    const messageByReason: Record<UpdateErrorReason, MessageKey> = {
      'development-download': 'update.message.error.developmentDownload',
      'incomplete-package': 'update.message.error.incompletePackage',
      network: 'update.message.error.network',
      unknown: 'update.message.error.unknown'
    }

    return this.message(messageByReason[reason]) || fallbackMessage
  }

  private message(key: MessageKey, params?: Record<string, string | number>): string {
    return translate(this.getLanguage(), key, params)
  }
}

function createEmptyProgress() {
  return {
    percent: 0,
    transferred: 0,
    total: 0,
    bytesPerSecond: 0
  }
}
