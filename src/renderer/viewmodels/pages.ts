import { DEFAULT_LANGUAGE, translate, type LanguageCode } from '../localization/messages'
import type { PageDefinition, PageId } from '../domain/page'

export type { PageId }

export const pageDefinitions: PageDefinition[] = [
  { id: 'dashboard', titleKey: 'navigation.dashboard', shortLabel: 'DB' },
  { id: 'device', titleKey: 'navigation.device', shortLabel: 'DV' },
  { id: 'alarm', titleKey: 'navigation.alarm', shortLabel: 'AL' },
  { id: 'trend', titleKey: 'navigation.trend', shortLabel: 'TR' },
  { id: 'recipe', titleKey: 'navigation.recipe', shortLabel: 'RC' },
  { id: 'tag-management', titleKey: 'navigation.tagManagement', shortLabel: 'TG' },
  { id: 'settings', titleKey: 'navigation.settings', shortLabel: 'ST' }
]

export function getPageTitle(pageId: PageId, language: LanguageCode = DEFAULT_LANGUAGE): string {
  const page = pageDefinitions.find((definition) => definition.id === pageId)
  return page ? translate(language, page.titleKey) : translate(language, 'navigation.dashboard')
}
