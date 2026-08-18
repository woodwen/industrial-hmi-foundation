import { app, ipcMain, type IpcMainInvokeEvent } from 'electron'

import { toAppError } from '../../shared/app-error'
import type {
  DeviceCommandRequest,
  DeviceCommandResult,
  DeviceReadResponse,
  DeviceReadRequest,
  DeviceStateChangedEvent,
  DeviceStatus,
  DeviceWriteRequest,
  DeviceWriteResponse,
  HmiResult
} from '../../shared/hmi-api'
import type { TagSnapshot } from '../../shared/tag'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { createDefaultDeviceManager } from '../device'
import { TagCache, TagService } from '../tag'
import type { Logger } from '../logging/logger'
import { createDeviceError, DEVICE_ERROR_CODES } from '../protocol/errors'
import * as defaultUpdateManager from '../update-manager'
import {
  parseDeviceReadRequest,
  parseDeviceWriteRequest,
  parseDeviceCommandRequest,
  parseErrorReportInput,
  parseLogEntryInput,
  parseOptionalStringPayload
} from './input-validation'

type Handler<TResult> = (payload: unknown, event: IpcMainInvokeEvent) => Promise<TResult> | TResult

export interface UpdateManagerApi {
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  cancelUpdateDownload(): void
  openUpdateDownloadPage(version?: string): Promise<void>
  quitAndInstallUpdate(): void
}

export interface DeviceManagerApi {
  connectDevice(): Promise<DeviceStatus>
  disconnectDevice(): Promise<DeviceStatus>
  getDeviceStatus(): DeviceStatus
  subscribeState(listener: (event: DeviceStateChangedEvent) => void): () => void
  readDeviceRegisters(request: DeviceReadRequest): Promise<DeviceReadResponse>
  writeDeviceRegisters(request: DeviceWriteRequest): Promise<DeviceWriteResponse>
}

export interface CommandManagerApi {
  executeCommand(request: DeviceCommandRequest): Promise<DeviceCommandResult>
  writeDeviceRegisters(request: DeviceWriteRequest): Promise<DeviceWriteResponse>
}

export interface TagManagerApi {
  getTagSnapshot(): TagSnapshot
}

export interface TagSubscriptionApi {
  addSubscriber(webContents: IpcMainInvokeEvent['sender']): void
  removeSubscriber(webContentsId: number): void
}

export interface DeviceStateSubscriptionApi {
  addSubscriber(webContents: IpcMainInvokeEvent['sender']): void
  removeSubscriber(webContentsId: number): void
}

export function registerIpcHandlers(
  logger: Logger,
  updateManager: UpdateManagerApi = defaultUpdateManager,
  deviceManager: DeviceManagerApi = createDefaultDeviceManager(logger),
  tagManager: TagManagerApi = createDefaultTagManager(),
  tagSubscription: TagSubscriptionApi = createNoopTagSubscription(),
  commandManager: CommandManagerApi = createDefaultCommandManager(),
  deviceStateSubscription: DeviceStateSubscriptionApi = createNoopDeviceStateSubscription()
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

  handleIpc<DeviceStatus>(IPC_CHANNELS.devices.connect, logger, () => deviceManager.connectDevice())

  handleIpc<DeviceStatus>(IPC_CHANNELS.devices.disconnect, logger, () => deviceManager.disconnectDevice())

  handleIpc<DeviceStatus>(IPC_CHANNELS.devices.getStatus, logger, () => deviceManager.getDeviceStatus())

  handleIpc<void>(IPC_CHANNELS.devices.subscribeState, logger, (_payload, event) => {
    deviceStateSubscription.addSubscriber(event.sender)
  })

  handleIpc<void>(IPC_CHANNELS.devices.unsubscribeState, logger, (_payload, event) => {
    deviceStateSubscription.removeSubscriber(event.sender.id)
  })

  handleIpc<DeviceReadResponse>(IPC_CHANNELS.devices.readRegisters, logger, (payload) => (
    deviceManager.readDeviceRegisters(parseDeviceReadRequest(payload, `ipc:${IPC_CHANNELS.devices.readRegisters}`))
  ))

  handleIpc<DeviceWriteResponse>(IPC_CHANNELS.devices.writeRegisters, logger, (payload) => (
    commandManager.writeDeviceRegisters(parseDeviceWriteRequest(payload, `ipc:${IPC_CHANNELS.devices.writeRegisters}`))
  ))

  handleIpc<DeviceCommandResult>(IPC_CHANNELS.commands.execute, logger, (payload) => (
    commandManager.executeCommand(parseDeviceCommandRequest(payload, `ipc:${IPC_CHANNELS.commands.execute}`))
  ))

  handleIpc<TagSnapshot>(IPC_CHANNELS.tags.getSnapshot, logger, () => tagManager.getTagSnapshot())

  handleIpc<void>(IPC_CHANNELS.tags.subscribe, logger, (_payload, event) => {
    tagSubscription.addSubscriber(event.sender)
  })

  handleIpc<void>(IPC_CHANNELS.tags.unsubscribe, logger, (_payload, event) => {
    tagSubscription.removeSubscriber(event.sender.id)
  })
}

function handleIpc<TResult>(
  channel: string,
  logger: Logger,
  handler: Handler<TResult>
): void {
  ipcMain.handle(channel, async (event, payload: unknown): Promise<HmiResult<TResult>> => {
    try {
      const data = await handler(payload, event)
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

function createDefaultTagCache(): TagCache {
  const tagService = new TagService()
  return new TagCache(tagService.listTagDefinitions())
}

function createDefaultTagManager(): TagManagerApi {
  const tagCache = createDefaultTagCache()
  return {
    getTagSnapshot: () => tagCache.getSnapshot('simulated-mixer-plc')
  }
}

function createNoopTagSubscription(): TagSubscriptionApi {
  return {
    addSubscriber: () => undefined,
    removeSubscriber: () => undefined
  }
}

function createDefaultCommandManager(): CommandManagerApi {
  const createNotConfiguredError = () => createDeviceError(
    DEVICE_ERROR_CODES.commandRejected,
    'CommandService is not configured.',
    'main:ipc-register'
  )

  return {
    executeCommand: async () => ({
      commandId: 'start',
      deviceId: 'simulated-mixer-plc',
      targetPointId: 'deviceStartCommand',
      status: 'rejected',
      writeAccepted: false,
      verificationStatus: 'failed',
      durationMs: 0,
      message: 'CommandService is not configured.',
      error: createNotConfiguredError(),
      timestamp: new Date().toISOString()
    }),
    writeDeviceRegisters: () => {
      throw createNotConfiguredError()
    }
  }
}

function createNoopDeviceStateSubscription(): DeviceStateSubscriptionApi {
  return {
    addSubscriber: () => undefined,
    removeSubscriber: () => undefined
  }
}
