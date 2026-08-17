import { makeAutoObservable } from 'mobx'

import { toAppError, type AppErrorShape } from '../../shared/app-error'
import type { ErrorReportInput } from '../../shared/hmi-api'
import type { AppApplicationService } from '../application/AppApplicationService'
import {
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  translate,
  type LanguageCode,
  type MessageKey
} from '../localization/messages'
import { getPageTitle, type PageId } from './pages'

type HelpDialog = 'manual' | 'version-updates' | null

interface LanguageStorage {
  getLanguage(): LanguageCode | null
  setLanguage(language: LanguageCode): void
}

export class AppViewModel {
  activePage: PageId = 'dashboard'
  appName = 'Industrial HMI'
  appVersion = '0.1.0'
  environment: 'development' | 'production' | 'test' = 'development'
  error: AppErrorShape | null = null
  language: LanguageCode
  isHelpMenuOpen = false
  activeHelpDialog: HelpDialog = null

  constructor(
    private readonly appService: AppApplicationService,
    private readonly languageStorage: LanguageStorage = createBrowserLanguageStorage()
  ) {
    this.language = languageStorage.getLanguage() ?? DEFAULT_LANGUAGE
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get activePageTitle(): string {
    return getPageTitle(this.activePage, this.language)
  }

  get environmentLabel(): string {
    switch (this.environment) {
      case 'development':
        return this.t('environment.development')
      case 'production':
        return this.t('environment.production')
      case 'test':
        return this.t('environment.test')
    }
  }

  t(key: MessageKey, params?: Record<string, string | number>): string {
    return translate(this.language, key, params)
  }

  navigate(page: PageId): void {
    this.activePage = page
    void this.writeNavigationLog(page)
  }

  async loadAppInfo(): Promise<void> {
    try {
      const result = await this.appService.getAppInfo()
      if (result.ok) {
        this.appName = result.data.name
        this.appVersion = result.data.version
        this.environment = result.data.environment
        return
      }

      this.setError(result.error)
    } catch (error) {
      this.setError(toAppError(error, 'renderer:app-info'))
    }
  }

  setLanguage(language: LanguageCode): void {
    this.language = normalizeLanguage(language)
    this.languageStorage.setLanguage(this.language)
  }

  getPageTitle(page: PageId): string {
    return getPageTitle(page, this.language)
  }

  toggleHelpMenu(): void {
    this.isHelpMenuOpen = !this.isHelpMenuOpen
  }

  closeHelpMenu(): void {
    this.isHelpMenuOpen = false
  }

  openUserManual(): void {
    this.activeHelpDialog = 'manual'
    this.closeHelpMenu()
  }

  openVersionUpdates(): void {
    this.activeHelpDialog = 'version-updates'
    this.closeHelpMenu()
  }

  closeHelpDialog(): void {
    this.activeHelpDialog = null
  }

  setError(error: AppErrorShape): void {
    this.error = error
  }

  reportError(error: AppErrorShape, componentStack?: string): void {
    this.setError(error)
    void this.reportRendererError({
      ...error,
      componentStack
    })
  }

  private async writeNavigationLog(page: PageId): Promise<void> {
    try {
      const result = await this.appService.writeApplicationLog('Navigation changed', {
        page
      })
      if (!result.ok) {
        this.setError(result.error)
      }
    } catch (error) {
      this.setError(toAppError(error, 'renderer:navigation-log'))
    }
  }

  private async reportRendererError(error: ErrorReportInput): Promise<void> {
    try {
      const result = await this.appService.reportError(error)
      if (!result.ok) {
        this.setError(result.error)
      }
    } catch (reportError) {
      this.setError(toAppError(reportError, 'renderer:error-report'))
    }
  }
}

function createBrowserLanguageStorage(): LanguageStorage {
  return {
    getLanguage: () => {
      if (typeof window === 'undefined') {
        return null
      }

      return normalizeLanguage(window.localStorage.getItem('hmi.language'))
    },
    setLanguage: (language) => {
      if (typeof window === 'undefined') {
        return
      }

      window.localStorage.setItem('hmi.language', language)
    }
  }
}
