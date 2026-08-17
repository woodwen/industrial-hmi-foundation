import { app, ipcMain } from 'electron'

import { toAppError } from '../../shared/app-error'
import type { ErrorReportInput, HmiResult, LogEntryInput } from '../../shared/hmi-api'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { Logger } from '../logging/logger'

type Handler<TPayload, TResult> = (payload: TPayload) => Promise<TResult> | TResult

export function registerIpcHandlers(logger: Logger): void {
  handleIpc(IPC_CHANNELS.app.getInfo, logger, () => ({
    name: app.getName(),
    version: app.getVersion(),
    environment: process.env.NODE_ENV === 'test'
      ? 'test'
      : app.isPackaged
        ? 'production'
        : 'development'
  }))

  handleIpc<LogEntryInput, void>(IPC_CHANNELS.log.write, logger, (entry) => {
    logger.write({
      ...entry,
      source: entry.source ?? 'renderer'
    })
  })

  handleIpc<ErrorReportInput, void>(IPC_CHANNELS.errors.report, logger, (error) => {
    logger.write({
      category: 'error',
      level: 'error',
      message: error.message,
      source: error.source ?? 'renderer',
      context: {
        code: error.code,
        detail: error.detail ?? null,
        cause: error.cause ?? null,
        componentStack: error.componentStack ?? null
      }
    })
  })
}

function handleIpc<TPayload, TResult>(
  channel: string,
  logger: Logger,
  handler: Handler<TPayload, TResult>
): void {
  ipcMain.handle(channel, async (_event, payload: TPayload): Promise<HmiResult<TResult>> => {
    try {
      const data = await handler(payload)
      return {
        ok: true,
        data
      }
    } catch (error) {
      const appError = toAppError(error, `ipc:${channel}`)
      logger.write({
        category: 'error',
        level: 'error',
        message: appError.message,
        source: appError.source,
        context: {
          code: appError.code,
          detail: appError.detail ?? null,
          cause: appError.cause ?? null
        }
      })

      return {
        ok: false,
        error: appError
      }
    }
  })
}
