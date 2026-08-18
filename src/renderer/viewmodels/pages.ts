import { DEFAULT_LANGUAGE, translate, type LanguageCode } from '../localization/messages'
import type { PageDefinition, PageId } from '../domain/page'

export type { PageId }

export const pageDefinitions: PageDefinition[] = [
  { id: 'dashboard', titleKey: 'navigation.dashboard', shortLabel: 'DB' },
  { id: 'device', titleKey: 'navigation.device', shortLabel: 'DV', requiredPermission: 'device:view' },
  { id: 'alarm', titleKey: 'navigation.alarm', shortLabel: 'AL', requiredPermission: 'alarm:acknowledge' },
  { id: 'trend', titleKey: 'navigation.trend', shortLabel: 'TR', requiredPermission: 'device:view' },
  { id: 'recipe', titleKey: 'navigation.recipe', shortLabel: 'RC', requiredPermission: 'recipe:read' },
  { id: 'audit-log', titleKey: 'navigation.auditLog', shortLabel: 'AU', requiredPermission: 'audit:read' },
  { id: 'user-management', titleKey: 'navigation.userManagement', shortLabel: 'US', requiredPermission: 'user:manage' },
  { id: 'tag-management', titleKey: 'navigation.tagManagement', shortLabel: 'TG', requiredPermission: 'tag-config:write' },
  { id: 'settings', titleKey: 'navigation.settings', shortLabel: 'ST', requiredPermission: 'system-config:write' }
]

export function getPageTitle(pageId: PageId, language: LanguageCode = DEFAULT_LANGUAGE): string {
  const page = pageDefinitions.find((definition) => definition.id === pageId)
  return page ? translate(language, page.titleKey) : translate(language, 'navigation.dashboard')
}
