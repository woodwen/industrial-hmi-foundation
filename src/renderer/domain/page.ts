import type { MessageKey } from '../localization/messages'

export type PageId =
  | 'dashboard'
  | 'device'
  | 'alarm'
  | 'trend'
  | 'recipe'
  | 'tag-management'
  | 'settings'

export interface PageDefinition {
  id: PageId
  titleKey: MessageKey
  shortLabel: string
}
