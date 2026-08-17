import type { PageDefinition, PageId } from '../domain/page'

export type { PageId }

export const pageDefinitions: PageDefinition[] = [
  { id: 'dashboard', title: 'Dashboard', shortLabel: 'DB' },
  { id: 'device', title: 'Device', shortLabel: 'DV' },
  { id: 'alarm', title: 'Alarm', shortLabel: 'AL' },
  { id: 'trend', title: 'Trend', shortLabel: 'TR' },
  { id: 'recipe', title: 'Recipe', shortLabel: 'RC' },
  { id: 'tag-management', title: 'Tag Management', shortLabel: 'TG' },
  { id: 'settings', title: 'Settings', shortLabel: 'ST' }
]

export function getPageTitle(pageId: PageId): string {
  return pageDefinitions.find((page) => page.id === pageId)?.title ?? 'Dashboard'
}
