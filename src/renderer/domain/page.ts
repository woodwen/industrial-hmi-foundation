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
  title: string
  shortLabel: string
}
