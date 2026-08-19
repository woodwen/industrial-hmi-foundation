import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

import { createAppError } from '../../shared/app-error'
import type {
  CreateFirstAdminRequest,
  CreateUserRequest,
  CurrentUserSnapshot,
  LoginRequest,
  SetUserEnabledRequest,
  UpdateUserRoleRequest,
  UserDto,
  UserListResult
} from '../../shared/security'
import type { AuditService } from '../audit'
import type { Logger } from '../logging/logger'
import { SECURITY_ERROR_CODES } from './PermissionService'
import type { PermissionService } from './PermissionService'
import type { UserRecord, UserRepository } from './UserRepository'

const PASSWORD_KEY_LENGTH = 64

export class UserService {
  private currentUserId: string | null = null

  constructor(
    private readonly repository: UserRepository,
    private readonly permissions: PermissionService,
    private readonly auditService?: AuditService,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly logger?: Logger
  ) {}

  getCurrentSnapshot(): CurrentUserSnapshot {
    const user = this.getCurrentUser()
    return {
      user,
      permissions: this.permissions.listPermissions(user),
      requiresInitialization: this.requiresInitialization()
    }
  }

  requiresInitialization(): boolean {
    return this.repository.countUsers() === 0
  }

  createFirstAdmin(request: CreateFirstAdminRequest): UserDto {
    if (!this.requiresInitialization()) {
      throw createAppError({
        code: SECURITY_ERROR_CODES.forbidden,
        message: 'Local Admin has already been initialized.',
        source: 'main:user-service'
      })
    }

    const user = this.createUserRecord({
      username: request.username,
      displayName: request.displayName,
      role: 'Admin',
      password: request.password
    })
    this.currentUserId = user.id
    this.auditService?.record({
      user,
      action: 'User Initialize Admin',
      target: `user:${user.username}`,
      oldValue: null,
      newValue: toAuditedUser(user),
      result: 'Succeeded'
    })
    return user
  }

  login(request: LoginRequest): CurrentUserSnapshot {
    const record = this.repository.findByUsername(normalizeUsername(request.username))
    if (!record || !record.enabled || !verifyPassword(request.password, record)) {
      throw createAppError({
        code: SECURITY_ERROR_CODES.invalidCredentials,
        message: 'Username or password is invalid.',
        source: 'main:user-service'
      })
    }

    this.currentUserId = record.id
    return this.getCurrentSnapshot()
  }

  logout(): CurrentUserSnapshot {
    this.currentUserId = null
    return this.getCurrentSnapshot()
  }

  getCurrentUser(): UserDto | null {
    if (!this.currentUserId) {
      return null
    }

    const record = this.repository.findById(this.currentUserId)
    return record && record.enabled ? toUserDto(record) : null
  }

  listUsers(): UserListResult {
    this.permissions.authorize(this.getCurrentUser(), 'user:manage', 'users')
    return {
      users: this.repository.listUsers(),
      emittedAt: this.now()
    }
  }

  createUser(request: CreateUserRequest): UserDto {
    const operator = this.getCurrentUser()
    this.authorizeUserManagement(operator, 'users', 'User Create', null, toAuditedUserRequest(request))
    const created = this.createUserRecord(request)
    this.auditService?.record({
      user: operator,
      action: 'User Create',
      target: `user:${created.username}`,
      oldValue: null,
      newValue: toAuditedUser(created),
      result: 'Succeeded'
    })
    return created
  }

  updateUserRole(request: UpdateUserRoleRequest): UserDto {
    const operator = this.getCurrentUser()
    this.authorizeUserManagement(operator, `user:${request.userId}`, 'User Role Change', null, request)
    const before = this.repository.findById(request.userId)
    if (!before) {
      throwUserNotFound(request.userId)
    }

    const updated = this.repository.updateRole(request.userId, request.role, this.now())
    this.auditService?.record({
      user: operator,
      action: 'User Role Change',
      target: `user:${updated.username}`,
      oldValue: toAuditedUser(before),
      newValue: toAuditedUser(updated),
      result: 'Succeeded'
    })
    return updated
  }

  setUserEnabled(request: SetUserEnabledRequest): UserDto {
    const operator = this.getCurrentUser()
    this.authorizeUserManagement(
      operator,
      `user:${request.userId}`,
      request.enabled ? 'User Enable' : 'User Disable',
      null,
      request
    )
    const before = this.repository.findById(request.userId)
    if (!before) {
      throwUserNotFound(request.userId)
    }

    const updated = this.repository.setEnabled(request.userId, request.enabled, this.now())
    this.auditService?.record({
      user: operator,
      action: request.enabled ? 'User Enable' : 'User Disable',
      target: `user:${updated.username}`,
      oldValue: toAuditedUser(before),
      newValue: toAuditedUser(updated),
      result: 'Succeeded'
    })
    return updated
  }

  private authorizeUserManagement(
    operator: UserDto | null,
    target: string,
    action: string,
    oldValue: unknown,
    newValue: unknown
  ): void {
    try {
      this.permissions.authorize(operator, 'user:manage', target)
    } catch (error) {
      this.recordRejectedAudit(operator, action, target, oldValue, newValue, error)
      throw error
    }
  }

  private recordRejectedAudit(
    operator: UserDto | null,
    action: string,
    target: string,
    oldValue: unknown,
    newValue: unknown,
    error: unknown
  ): void {
    try {
      this.auditService?.record({
        user: operator,
        action,
        target,
        oldValue,
        newValue,
        result: 'Rejected',
        metadata: {
          error: error instanceof Error ? error.message : String(error)
        }
      })
    } catch (auditError) {
      if (!this.logger) {
        throw auditError
      }

      this.logger.write({
        category: 'error',
        level: 'error',
        message: 'Failed to audit rejected user management operation',
        source: 'main:user-service',
        context: {
          action,
          target,
          error: auditError instanceof Error ? auditError.message : String(auditError)
        }
      })
    }
  }

  private createUserRecord(request: CreateUserRequest): UserDto {
    const username = normalizeUsername(request.username)
    const displayName = request.displayName.trim()
    const password = request.password
    if (!username || !displayName || password.length < 6) {
      throw createAppError({
        code: 'SECURITY_INVALID_USER',
        message: 'User requires username, display name, and a password with at least 6 characters.',
        source: 'main:user-service'
      })
    }

    if (this.repository.findByUsername(username)) {
      throw createAppError({
        code: 'SECURITY_USER_EXISTS',
        message: 'Username already exists.',
        source: 'main:user-service',
        detail: `username=${username}`
      })
    }

    const credential = hashPassword(password)
    const timestamp = this.now()
    return this.repository.insert({
      id: randomUUID(),
      username,
      displayName,
      role: request.role,
      credentialHash: credential.hash,
      credentialSalt: credential.salt,
      createdAt: timestamp,
      updatedAt: timestamp
    })
  }
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex')
  return {
    salt,
    hash: scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex')
  }
}

function verifyPassword(password: string, record: UserRecord): boolean {
  const actual = Buffer.from(record.credentialHash, 'hex')
  const candidate = scryptSync(password, record.credentialSalt, PASSWORD_KEY_LENGTH)
  return actual.length === candidate.length && timingSafeEqual(actual, candidate)
}

function toUserDto(record: UserRecord): UserDto {
  return {
    id: record.id,
    username: record.username,
    displayName: record.displayName,
    role: record.role,
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
}

function toAuditedUser(user: UserDto): Record<string, unknown> {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    enabled: user.enabled
  }
}

function toAuditedUserRequest(request: CreateUserRequest): Record<string, unknown> {
  return {
    username: normalizeUsername(request.username),
    displayName: request.displayName.trim(),
    role: request.role
  }
}

function throwUserNotFound(userId: string): never {
  throw createAppError({
    code: SECURITY_ERROR_CODES.userNotFound,
    message: 'User was not found.',
    source: 'main:user-service',
    detail: `userId=${userId}`
  })
}
