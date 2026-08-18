import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import type { Logger } from '../logging/logger'

export const HISTORIAN_SCHEMA_VERSION = '1'

export class HistorianDatabase {
  readonly db: Database.Database

  constructor(
    readonly databasePath: string,
    private readonly logger?: Logger
  ) {
    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true })
    }

    this.db = new Database(databasePath)
    this.initialize()
  }

  close(): void {
    if (this.db.open) {
      this.db.close()
    }
  }

  private initialize(): void {
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tag_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag_id TEXT NOT NULL,
        timestamp_ms INTEGER NOT NULL,
        value_type TEXT NOT NULL,
        value_numeric REAL,
        value_text TEXT,
        value_bool INTEGER,
        quality TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tag_history_tag_time
        ON tag_history (tag_id, timestamp_ms);

      CREATE TABLE IF NOT EXISTS alarm_history (
        id TEXT PRIMARY KEY,
        definition_id TEXT NOT NULL,
        code TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL,
        trigger_time_ms INTEGER NOT NULL,
        acknowledge_time_ms INTEGER,
        recover_time_ms INTEGER,
        trigger_value_type TEXT,
        trigger_value_numeric REAL,
        trigger_value_text TEXT,
        trigger_value_bool INTEGER,
        recover_value_type TEXT,
        recover_value_numeric REAL,
        recover_value_text TEXT,
        recover_value_bool INTEGER,
        acknowledge_user TEXT,
        condition_active INTEGER NOT NULL DEFAULT 0,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_alarm_history_time
        ON alarm_history (trigger_time_ms);

      CREATE INDEX IF NOT EXISTS idx_alarm_history_status_level
        ON alarm_history (status, level, trigger_time_ms);

      CREATE TABLE IF NOT EXISTS recipes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        version INTEGER NOT NULL,
        parameters_json TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        deleted_at_ms INTEGER,
        source_recipe_id TEXT,
        source_version INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_recipes_active_updated
        ON recipes (deleted_at_ms, updated_at_ms);

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        credential_hash TEXT NOT NULL,
        credential_salt TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_username
        ON users (username);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp_ms INTEGER NOT NULL,
        user TEXT NOT NULL,
        role TEXT,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        old_value_json TEXT NOT NULL,
        new_value_json TEXT NOT NULL,
        result TEXT NOT NULL,
        correlation_id TEXT,
        duration_ms INTEGER,
        error_summary TEXT,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_time
        ON audit_logs (timestamp_ms);

      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_result
        ON audit_logs (user, action, result, timestamp_ms);
    `)

    this.db
      .prepare('INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)')
      .run('schema_version', HISTORIAN_SCHEMA_VERSION)

    this.logger?.write({
      category: 'application',
      level: 'info',
      message: 'Historian SQLite schema initialized',
      source: 'main:historian-database',
      context: {
        databasePath: this.databasePath,
        schemaVersion: HISTORIAN_SCHEMA_VERSION
      }
    })
  }
}
