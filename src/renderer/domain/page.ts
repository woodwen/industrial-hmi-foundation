import type { MessageKey } from '../localization/messages'
import type { Permission } from '../../shared/security'

export type PageId =
  | 'dashboard'
  | 'device'
  | 'alarm'
  | 'trend'
  | 'recipe'
  | 'user-management'
  | 'audit-log'
  | 'tag-management'
  | 'settings'

export interface PageDefinition {
  id: PageId
  titleKey: MessageKey
  shortLabel: string
  requiredPermission?: Permission
}
