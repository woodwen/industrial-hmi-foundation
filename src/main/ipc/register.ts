import { app, ipcMain } from 'electron'

import { toAppError } from '../../shared/app-error'
import type { HmiResult } from '../../shared/hmi-api'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { Logger } from '../logging/logger'
import * as defaultUpdateManager from '../update-manager'
import { parseErrorReportInput, parseLogEntryInput, parseOptionalStringPayload } from './input-validation'

type Handler<TResult> = (payload: unknown) => Promise<TResult> | TResult

export interface UpdateManagerApi {
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  cancelUpdateDownload(): void
  openUpdateDownloadPage(version?: string): Promise<void>
  quitAndInstallUpdate(): void
}

export function registerIpcHandlers(
  logger: Logger,
  updateManager: UpdateManagerApi = defaultUpdateManager
): void {
  handleIpc(IPC_CHANNELS.app.getInfo, logger, () => ({
    name: app.getName(),
    version: app.getVersion(),
    environment: process.env.NODE_ENV === 'test'
      ? 'test'
      : app.isPackaged
        ? 'production'
        : 'development'
  }))

  handleIpc<void>(IPC_CHANNELS.log.write, logger, (payload) => {
    const entry = parseLogEntryInput(payload, `ipc:${IPC_CHANNELS.log.write}`)

    logger.write({
      ...entry,
      source: entry.source ?? 'renderer'
    })
  })

  handleIpc<void>(IPC_CHANNELS.errors.report, logger, (payload) => {
    const error = parseErrorReportInput(payload, `ipc:${IPC_CHANNELS.errors.report}`)

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

  handleIpc<void>(IPC_CHANNELS.updates.checkForUpdates, logger, () => updateManager.checkForUpdates())

  handleIpc<void>(IPC_CHANNELS.updates.downloadUpdate, logger, () => updateManager.downloadUpdate())

  handleIpc<void>(IPC_CHANNELS.updates.cancelUpdateDownload, logger, () => {
    updateManager.cancelUpdateDownload()
  })

  handleIpc<void>(IPC_CHANNELS.updates.openUpdateDownloadPage, logger, (payload) => {
    const version = parseOptionalStringPayload(
      payload,
      'Update download page version must be a string.',
      `ipc:${IPC_CHANNELS.updates.openUpdateDownloadPage}`
    )

    return updateManager.openUpdateDownloadPage(version)
  })

  handleIpc<void>(IPC_CHANNELS.updates.quitAndInstallUpdate, logger, () => {
    updateManager.quitAndInstallUpdate()
  })
}

function handleIpc<TResult>(
  channel: string,
  logger: Logger,
  handler: Handler<TResult>
): void {
  ipcMain.handle(channel, async (_event, payload: unknown): Promise<HmiResult<TResult>> => {
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
