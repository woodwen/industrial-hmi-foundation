import { makeAutoObservable } from 'mobx'

import type { AppErrorShape } from '../../shared/app-error'
import type { AppApplicationService } from '../application/AppApplicationService'
import { getPageTitle, type PageId } from './pages'

export class AppViewModel {
  activePage: PageId = 'dashboard'
  appName = 'Industrial HMI'
  appVersion = '0.1.0'
  environment: 'development' | 'production' | 'test' = 'development'
  error: AppErrorShape | null = null

  constructor(private readonly appService: AppApplicationService) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get activePageTitle(): string {
    return getPageTitle(this.activePage)
  }

  get environmentLabel(): string {
    return this.environment.toUpperCase()
  }

  navigate(page: PageId): void {
    this.activePage = page
    void this.appService.writeApplicationLog('Navigation changed', {
      page
    })
  }

  async loadAppInfo(): Promise<void> {
    const result = await this.appService.getAppInfo()
    if (result.ok) {
      this.appName = result.data.name
      this.appVersion = result.data.version
      this.environment = result.data.environment
      return
    }

    this.setError(result.error)
  }

  setError(error: AppErrorShape): void {
    this.error = error
  }

  reportError(error: AppErrorShape): void {
    this.setError(error)
    void this.appService.reportError(error)
  }
}
