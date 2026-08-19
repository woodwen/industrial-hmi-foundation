import { useEffect } from 'react'
import { observer } from 'mobx-react-lite'

import type { UserRole } from '../../shared/security'
import { PageFrame } from '../components/PageFrame'
import { USER_ROLE_OPTIONS } from '../viewmodels/AuthViewModel'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const UserManagementPage = observer(() => {
  const { app, auth } = useViewModels()

  useEffect(() => {
    void auth.loadUsers()
  }, [auth])

  return (
    <PageFrame
      title={app.t('navigation.userManagement')}
      description={app.t('user.description')}
      eyebrow="Local Users"
    >
      {!auth.canManageUsers ? (
        <p className="inline-error" role="alert">当前用户没有用户管理权限。</p>
      ) : null}
      {auth.error ? (
        <p className="inline-error" role="alert">{auth.error.message}</p>
      ) : null}

      <section className="device-panel" aria-labelledby="create-user-title">
        <div className="device-panel-heading">
          <div>
            <h3 id="create-user-title">Create User</h3>
            <p>Local account for this desktop application.</p>
          </div>
          <button
            type="button"
            className="primary-action"
            disabled={!auth.canManageUsers || auth.isSubmitting}
            onClick={() => {
              void auth.createUser()
            }}
          >
            Create
          </button>
        </div>

        <div className="filter-grid">
          <label>
            <span>Username</span>
            <input
              value={auth.newUsername}
              disabled={!auth.canManageUsers}
              onChange={(event) => auth.setNewUsername(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Display Name</span>
            <input
              value={auth.newDisplayName}
              disabled={!auth.canManageUsers}
              onChange={(event) => auth.setNewDisplayName(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Role</span>
            <select
              value={auth.newRole}
              disabled={!auth.canManageUsers}
              onChange={(event) => auth.setNewRole(toUserRole(event.currentTarget.value))}
            >
              {USER_ROLE_OPTIONS.map((role) => (
                <option value={role} key={role}>{role}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={auth.newPassword}
              disabled={!auth.canManageUsers}
              onChange={(event) => auth.setNewPassword(event.currentTarget.value)}
            />
          </label>
        </div>
      </section>

      <section className="device-panel" aria-labelledby="user-list-title">
        <div className="device-panel-heading">
          <div>
            <h3 id="user-list-title">Users</h3>
            <p>{auth.users.length} rows</p>
          </div>
          <button
            type="button"
            className="secondary-action"
            disabled={!auth.canManageUsers || auth.isUserListLoading}
            onClick={() => {
              void auth.loadUsers()
            }}
          >
            Refresh
          </button>
        </div>

        <div className="data-table" role="table" aria-label="Local users">
          <div role="row" className="data-table-row user-table-row data-table-header">
            <span role="columnheader">Username</span>
            <span role="columnheader">Display Name</span>
            <span role="columnheader">Role</span>
            <span role="columnheader">Enabled</span>
            <span role="columnheader">Action</span>
          </div>
          {auth.users.length > 0 ? auth.users.map((user) => (
            <div role="row" className="data-table-row user-table-row" key={user.id}>
              <span role="cell">{user.username}</span>
              <span role="cell">{user.displayName}</span>
              <span role="cell">
                <select
                  value={user.role}
                  disabled={!auth.canManageUsers}
                  onChange={(event) => {
                    void auth.updateUserRole(user.id, toUserRole(event.currentTarget.value))
                  }}
                >
                  {USER_ROLE_OPTIONS.map((role) => (
                    <option value={role} key={role}>{role}</option>
                  ))}
                </select>
              </span>
              <span role="cell">{user.enabled ? 'Yes' : 'No'}</span>
              <span role="cell">
                <button
                  type="button"
                  className="secondary-action table-action"
                  disabled={!auth.canManageUsers}
                  onClick={() => {
                    void auth.setUserEnabled(user.id, !user.enabled)
                  }}
                >
                  {user.enabled ? 'Disable' : 'Enable'}
                </button>
              </span>
            </div>
          )) : (
            <div role="row" className="data-table-row data-empty-row">
              <span role="cell">No users.</span>
            </div>
          )}
        </div>
      </section>
    </PageFrame>
  )
})

function toUserRole(value: string): UserRole {
  return USER_ROLE_OPTIONS.includes(value as UserRole) ? value as UserRole : 'Operator'
}
