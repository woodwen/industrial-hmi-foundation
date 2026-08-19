import { createAppError } from '../../shared/app-error'
import type { Permission, UserDto, UserRole } from '../../shared/security'

export const SECURITY_ERROR_CODES = {
  unauthorized: 'SECURITY_UNAUTHORIZED',
  forbidden: 'SECURITY_FORBIDDEN',
  invalidCredentials: 'SECURITY_INVALID_CREDENTIALS',
  initializationRequired: 'SECURITY_INITIALIZATION_REQUIRED',
  userNotFound: 'SECURITY_USER_NOT_FOUND'
} as const

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  Operator: [
    'device:view',
    'device:start-stop',
    'alarm:acknowledge',
    'recipe:read'
  ],
  Engineer: [
    'device:view',
    'device:start-stop',
    'device:advanced-control',
    'alarm:acknowledge',
    'recipe:read',
    'recipe:write',
    'recipe:download',
    'parameter:write',
    'tag-config:write',
    'audit:read'
  ],
  Admin: [
    'device:view',
    'device:start-stop',
    'device:advanced-control',
    'alarm:acknowledge',
    'recipe:read',
    'recipe:write',
    'recipe:download',
    'parameter:write',
    'tag-config:write',
    'audit:read',
    'user:manage',
    'system-config:write'
  ]
}

export class PermissionService {
  listPermissions(user: UserDto | null): Permission[] {
    if (!user || !user.enabled) {
      return []
    }

    return [...ROLE_PERMISSIONS[user.role]]
  }

  hasPermission(user: UserDto | null, permission: Permission): boolean {
    return this.listPermissions(user).includes(permission)
  }

  authorize(user: UserDto | null, permission: Permission, target: string): void {
    if (!user) {
      throw createAppError({
        code: SECURITY_ERROR_CODES.unauthorized,
        message: 'A local user session is required.',
        source: 'main:permission-service',
        detail: `permission=${permission}; target=${target}`
      })
    }

    if (!user.enabled || !this.hasPermission(user, permission)) {
      throw createAppError({
        code: SECURITY_ERROR_CODES.forbidden,
        message: 'Current user is not allowed to perform this operation.',
        source: 'main:permission-service',
        detail: `user=${user.username}; permission=${permission}; target=${target}`
      })
    }
  }
}
