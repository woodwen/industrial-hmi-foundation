export const USER_ROLES = ['Operator', 'Engineer', 'Admin'] as const

export type UserRole = (typeof USER_ROLES)[number]

export const PERMISSIONS = [
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
] as const

export type Permission = (typeof PERMISSIONS)[number]

export interface UserDto {
  id: string
  username: string
  displayName: string
  role: UserRole
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CurrentUserSnapshot {
  user: UserDto | null
  permissions: Permission[]
  requiresInitialization: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface CreateFirstAdminRequest {
  username: string
  displayName: string
  password: string
}

export interface CreateUserRequest {
  username: string
  displayName: string
  role: UserRole
  password: string
}

export interface UpdateUserRoleRequest {
  userId: string
  role: UserRole
}

export interface SetUserEnabledRequest {
  userId: string
  enabled: boolean
}

export interface UserListResult {
  users: UserDto[]
  emittedAt: string
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value)
}
