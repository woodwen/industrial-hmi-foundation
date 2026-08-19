import { makeAutoObservable, runInAction } from 'mobx'

import { toAppError, type AppErrorShape, createAppError } from '../../shared/app-error'
import type {
  CurrentUserSnapshot,
  Permission,
  UserDto,
  UserRole
} from '../../shared/security'
import type { AppApplicationService } from '../application/AppApplicationService'

export const USER_ROLE_OPTIONS: readonly UserRole[] = ['Operator', 'Engineer', 'Admin']

const EMPTY_SNAPSHOT: CurrentUserSnapshot = {
  user: null,
  permissions: [],
  requiresInitialization: false
}

export class AuthViewModel {
  snapshot: CurrentUserSnapshot = EMPTY_SNAPSHOT
  users: UserDto[] = []
  initializeUsername = 'admin'
  initializeDisplayName = 'Local Admin'
  initializePassword = ''
  loginUsername = 'admin'
  loginPassword = ''
  newUsername = ''
  newDisplayName = ''
  newPassword = ''
  newRole: UserRole = 'Operator'
  isLoading = false
  isSubmitting = false
  isUserListLoading = false
  error: AppErrorShape | null = null

  constructor(private readonly appService: AppApplicationService) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get currentUser(): UserDto | null {
    return this.snapshot.user
  }

  get permissions(): readonly Permission[] {
    return this.snapshot.permissions
  }

  get requiresInitialization(): boolean {
    return this.snapshot.requiresInitialization
  }

  get isLoggedIn(): boolean {
    return this.currentUser !== null
  }

  get currentUserLabel(): string {
    return this.currentUser
      ? `${this.currentUser.displayName} / ${this.currentUser.role}`
      : this.requiresInitialization ? '需要初始化 Admin' : '未登录'
  }

  get canManageUsers(): boolean {
    return this.hasPermission('user:manage')
  }

  hasPermission(permission: Permission): boolean {
    return this.permissions.includes(permission)
  }

  canViewPermission(requiredPermission?: Permission): boolean {
    return requiredPermission === undefined || this.hasPermission(requiredPermission)
  }

  async initialize(): Promise<void> {
    if (this.isLoading) {
      return
    }

    this.isLoading = true
    this.error = null
    try {
      await this.refreshCurrentUser()
      if (this.canManageUsers) {
        await this.loadUsers()
      }
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:auth-initialize')
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  async refreshCurrentUser(): Promise<void> {
    const result = await this.appService.getCurrentUser()
    runInAction(() => {
      if (result.ok) {
        this.snapshot = result.data
        this.error = null
        return
      }

      this.error = result.error
    })
  }

  async createFirstAdmin(): Promise<void> {
    await this.submit(async () => {
      const result = await this.appService.createFirstAdmin({
        username: this.initializeUsername,
        displayName: this.initializeDisplayName,
        password: this.initializePassword
      })
      if (!result.ok) {
        this.error = result.error
        return
      }

      this.initializePassword = ''
      await this.refreshCurrentUser()
      await this.loadUsers()
    }, 'renderer:auth-create-admin')
  }

  async login(): Promise<void> {
    await this.submit(async () => {
      const result = await this.appService.login({
        username: this.loginUsername,
        password: this.loginPassword
      })
      if (!result.ok) {
        this.error = result.error
        return
      }

      this.snapshot = result.data
      this.loginPassword = ''
      if (this.canManageUsers) {
        await this.loadUsers()
      }
    }, 'renderer:auth-login')
  }

  async logout(): Promise<void> {
    await this.submit(async () => {
      const result = await this.appService.logout()
      if (!result.ok) {
        this.error = result.error
        return
      }

      this.snapshot = result.data
      this.users = []
    }, 'renderer:auth-logout')
  }

  async loadUsers(): Promise<void> {
    if (!this.canManageUsers) {
      this.users = []
      return
    }

    this.isUserListLoading = true
    try {
      const result = await this.appService.listUsers()
      runInAction(() => {
        if (result.ok) {
          this.users = result.data.users
          this.error = null
          return
        }

        this.error = result.error
      })
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:user-list')
      })
    } finally {
      runInAction(() => {
        this.isUserListLoading = false
      })
    }
  }

  async createUser(): Promise<void> {
    await this.submit(async () => {
      const result = await this.appService.createUser({
        username: this.newUsername,
        displayName: this.newDisplayName,
        role: this.newRole,
        password: this.newPassword
      })
      if (!result.ok) {
        this.error = result.error
        return
      }

      this.newUsername = ''
      this.newDisplayName = ''
      this.newPassword = ''
      this.newRole = 'Operator'
      await this.loadUsers()
    }, 'renderer:user-create')
  }

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    await this.submit(async () => {
      const result = await this.appService.updateUserRole({
        userId,
        role
      })
      if (!result.ok) {
        this.error = result.error
        return
      }

      await this.loadUsers()
    }, 'renderer:user-role')
  }

  async setUserEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.submit(async () => {
      const result = await this.appService.setUserEnabled({
        userId,
        enabled
      })
      if (!result.ok) {
        this.error = result.error
        return
      }

      await this.loadUsers()
      await this.refreshCurrentUser()
    }, 'renderer:user-enabled')
  }

  setInitializeUsername(value: string): void {
    this.initializeUsername = value
  }

  setInitializeDisplayName(value: string): void {
    this.initializeDisplayName = value
  }

  setInitializePassword(value: string): void {
    this.initializePassword = value
  }

  setLoginUsername(value: string): void {
    this.loginUsername = value
  }

  setLoginPassword(value: string): void {
    this.loginPassword = value
  }

  setNewUsername(value: string): void {
    this.newUsername = value
  }

  setNewDisplayName(value: string): void {
    this.newDisplayName = value
  }

  setNewPassword(value: string): void {
    this.newPassword = value
  }

  setNewRole(value: UserRole): void {
    this.newRole = value
  }

  private async submit(action: () => Promise<void>, source: string): Promise<void> {
    if (this.isSubmitting) {
      return
    }

    this.isSubmitting = true
    this.error = null
    try {
      await action()
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, source)
      })
    } finally {
      runInAction(() => {
        this.isSubmitting = false
      })
    }
  }
}

export function createPermissionError(permission: Permission): AppErrorShape {
  return createAppError({
    code: 'RENDERER_PERMISSION_DISABLED',
    message: '当前用户没有执行该操作的权限。',
    source: 'renderer:permission',
    detail: `permission=${permission}`
  })
}
