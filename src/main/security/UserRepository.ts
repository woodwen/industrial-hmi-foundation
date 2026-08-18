import type Database from 'better-sqlite3'

import type { UserDto, UserRole } from '../../shared/security'

interface UserRow {
  id: string
  username: string
  display_name: string
  role: UserRole
  enabled: number
  credential_hash: string
  credential_salt: string
  created_at_ms: number
  updated_at_ms: number
}

export interface UserRecord extends UserDto {
  credentialHash: string
  credentialSalt: string
}

export interface CreateUserRecordInput {
  id: string
  username: string
  displayName: string
  role: UserRole
  credentialHash: string
  credentialSalt: string
  createdAt: string
  updatedAt: string
}

export class UserRepository {
  constructor(private readonly db: Database.Database) {}

  countUsers(): number {
    const row = this.db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM users').get()
    return row?.count ?? 0
  }

  listUsers(): UserDto[] {
    return this.db.prepare<[], UserRow>(`
      SELECT *
      FROM users
      ORDER BY username ASC
    `).all().map(toUserDto)
  }

  findById(userId: string): UserRecord | null {
    const row = this.db.prepare<[string], UserRow>('SELECT * FROM users WHERE id = ?').get(userId)
    return row ? toUserRecord(row) : null
  }

  findByUsername(username: string): UserRecord | null {
    const row = this.db.prepare<[string], UserRow>('SELECT * FROM users WHERE username = ?').get(username)
    return row ? toUserRecord(row) : null
  }

  insert(input: CreateUserRecordInput): UserDto {
    this.db.prepare(`
      INSERT INTO users (
        id,
        username,
        display_name,
        role,
        enabled,
        credential_hash,
        credential_salt,
        created_at_ms,
        updated_at_ms
      ) VALUES (
        @id,
        @username,
        @displayName,
        @role,
        1,
        @credentialHash,
        @credentialSalt,
        @createdAtMs,
        @updatedAtMs
      )
    `).run({
      ...input,
      createdAtMs: toEpochMs(input.createdAt),
      updatedAtMs: toEpochMs(input.updatedAt)
    })

    const created = this.findById(input.id)
    if (!created) {
      throw new Error(`Created user was not found: ${input.id}`)
    }

    return toUserDtoFromRecord(created)
  }

  updateRole(userId: string, role: UserRole, updatedAt: string): UserDto {
    this.db.prepare(`
      UPDATE users
      SET role = @role,
        updated_at_ms = @updatedAtMs
      WHERE id = @userId
    `).run({
      userId,
      role,
      updatedAtMs: toEpochMs(updatedAt)
    })

    const updated = this.findById(userId)
    if (!updated) {
      throw new Error(`User was not found: ${userId}`)
    }

    return toUserDtoFromRecord(updated)
  }

  setEnabled(userId: string, enabled: boolean, updatedAt: string): UserDto {
    this.db.prepare(`
      UPDATE users
      SET enabled = @enabled,
        updated_at_ms = @updatedAtMs
      WHERE id = @userId
    `).run({
      userId,
      enabled: enabled ? 1 : 0,
      updatedAtMs: toEpochMs(updatedAt)
    })

    const updated = this.findById(userId)
    if (!updated) {
      throw new Error(`User was not found: ${userId}`)
    }

    return toUserDtoFromRecord(updated)
  }
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    ...toUserDto(row),
    credentialHash: row.credential_hash,
    credentialSalt: row.credential_salt
  }
}

function toUserDto(row: UserRow): UserDto {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    enabled: row.enabled === 1,
    createdAt: new Date(row.created_at_ms).toISOString(),
    updatedAt: new Date(row.updated_at_ms).toISOString()
  }
}

function toUserDtoFromRecord(record: UserRecord): UserDto {
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

function toEpochMs(timestamp: string): number {
  const ms = Date.parse(timestamp)
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid user timestamp: ${timestamp}`)
  }

  return ms
}
