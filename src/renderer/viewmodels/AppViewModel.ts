import { makeAutoObservable } from 'mobx'

import { toAppError, type AppErrorShape } from '../../shared/app-error'
import type { ErrorReportInput } from '../../shared/hmi-api'
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
