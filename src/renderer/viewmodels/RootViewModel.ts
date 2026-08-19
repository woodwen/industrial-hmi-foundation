import { AppApplicationService, type HmiApiClient } from '../application/AppApplicationService'
import { HmiApiBrowserClient } from '../infrastructure/HmiApiBrowserClient'
import { AppViewModel } from './AppViewModel'
import { AppUpdateViewModel } from './AppUpdateViewModel'
import { AlarmViewModel } from './AlarmViewModel'
import { DashboardViewModel } from './DashboardViewModel'
import { DeviceViewModel } from './DeviceViewModel'
import { AuthViewModel } from './AuthViewModel'
import { AuditLogViewModel } from './AuditLogViewModel'
import { RecipeViewModel } from './RecipeViewModel'
import { SimulatorViewModel } from './SimulatorViewModel'
import { TagValuesViewModel } from './TagValuesViewModel'
import { TrendViewModel } from './TrendViewModel'

export interface RootViewModel {
  app: AppViewModel
  updates: AppUpdateViewModel
  tags: TagValuesViewModel
  auth: AuthViewModel
  recipes: RecipeViewModel
  auditLog: AuditLogViewModel
  alarm: AlarmViewModel
  trend: TrendViewModel
  dashboard: DashboardViewModel
  device: DeviceViewModel
  simulators: SimulatorViewModel
}

export function createRootViewModel(apiClient: HmiApiClient = new HmiApiBrowserClient()): RootViewModel {
  const appService = new AppApplicationService(apiClient)
  const app = new AppViewModel(appService)
  const tags = new TagValuesViewModel(appService)
  const auth = new AuthViewModel(appService)

  return {
    app,
    updates: new AppUpdateViewModel(appService, () => app.language),
    tags,
    auth,
    recipes: new RecipeViewModel(appService, auth),
    auditLog: new AuditLogViewModel(appService, auth),
    alarm: new AlarmViewModel(appService),
    trend: new TrendViewModel(appService),
    dashboard: new DashboardViewModel(tags),
    device: new DeviceViewModel(appService, () => app.language, tags, auth),
    simulators: new SimulatorViewModel(appService)
  }
}
