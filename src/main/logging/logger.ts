import type { LogCategory, LogEntryInput, LogLevel } from '../../shared/hmi-api'

export interface LogRecord extends LogEntryInput {
  timestamp: string
}

export interface Logger {
  write(entry: LogEntryInput): void
}

export class ConsoleLogger implements Logger {
  write(entry: LogEntryInput): void {
    const record: LogRecord = {
      ...entry,
      timestamp: new Date().toISOString()
    }

    const line = formatLogRecord(record)
    if (record.level === 'error') {
      console.error(line)
      return
    }

    if (record.level === 'warn') {
      console.warn(line)
      return
    }

    console.info(line)
  }
}

export function createMainLogger(): Logger {
  return new ConsoleLogger()
}

function formatLogRecord(record: LogRecord): string {
  const context = record.context ? ` ${JSON.stringify(record.context)}` : ''
  return `${record.timestamp} [${record.category}] [${record.level}] ${record.source ?? 'application'} - ${record.message}${context}`
}

export function createLogEntry(
  category: LogCategory,
  level: LogLevel,
  message: string,
  source: string
): LogEntryInput {
  return {
    category,
    level,
    message,
    source
  }
}
