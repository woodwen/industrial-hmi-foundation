import { app, shell, type BrowserWindow } from 'electron'
import { CancellationToken } from 'builder-util-runtime'
import electronUpdater from 'electron-updater'

import type { AppUpdateEvent, UpdateErrorReason } from '../shared/hmi-api'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type { Logger } from './logging/logger'

const { autoUpdater } = electronUpdater
const RELEASES_URL = 'https://github.com/woodwen/industrial-hmi-foundation/releases'
const MACOS_SIGNED_AUTO_UPDATE_ENABLED = false

type UpdateError = Error & {
  code?: string
}

interface DownloadUpdateOptions {
  forceAutomaticInstall?: boolean
}

interface UpdaterLogger {
  debug(...messages: unknown[]): void
  info(...messages: unknown[]): void
  warn(...messages: unknown[]): void
  error(...messages: unknown[]): void
}

let mainWindow: BrowserWindow | null = null
let logger: Logger | null = null
let listenersConfigured = false
let latestAvailableVersion: string | undefined
let downloadCancellationToken: CancellationToken | null = null
let downloadPromise: Promise<void> | null = null
let downloadCancellationNotified = false

export function configureUpdateManager(window: BrowserWindow, mainLogger: Logger): void {
  mainWindow = window
  logger = mainLogger
  autoUpdater.autoDownload = false
  autoUpdater.logger = createUpdaterLogger(mainLogger)

  if (listenersConfigured) {
    return
  }

  listenersConfigured = true

  autoUpdater.on('checking-for-update', () => {
    writeLog('info', 'Checking for updates')
    sendUpdateEvent({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    writeLog('info', 'Update available', { version: info.version })
    latestAvailableVersion = info.version
    if (shouldUseManualMacUpdateInstall()) {
      sendUpdateEvent({ type: 'manual-download', version: info.version })
      return
    }

    sendUpdateEvent({ type: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    writeLog('info', 'No update available', { version: info.version })
    latestAvailableVersion = undefined
    sendUpdateEvent({ type: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateEvent({
      type: 'progress',
      progress: {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond
      }
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    resetDownloadCancellation()
    writeLog('info', 'Update downloaded', { version: info.version })
    sendUpdateEvent({ type: 'downloaded', version: info.version })
  })

  autoUpdater.on('update-cancelled', () => {
    resetDownloadCancellation()
    sendDownloadCancelledEvent()
  })

  autoUpdater.on('error', (error) => {
    if (isCancellationError(error)) {
      resetDownloadCancellation()
      sendDownloadCancelledEvent()
      return
    }

    resetDownloadCancellation()
    const details = getUpdateErrorDetails(error)
    writeLog('error', 'Update error', { reason: details.reason, message: details.message })
    sendUpdateEvent({ type: 'error', reason: details.reason, message: details.message })
  })
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    writeLog('info', 'Skipping real update check in development')
    sendUpdateEvent({ type: 'checking' })
    sendUpdateEvent({ type: 'not-available', version: app.getVersion(), development: true })
    return
  }

  await autoUpdater.checkForUpdates()
}

export async function downloadUpdate(options: DownloadUpdateOptions = {}): Promise<void> {
  if (!app.isPackaged) {
    sendUpdateEvent({
      type: 'error',
      reason: 'development-download',
      message: 'Development builds do not download update packages.'
    })
    return
  }

  if (!options.forceAutomaticInstall && shouldUseManualMacUpdateInstall()) {
    sendUpdateEvent({ type: 'manual-download', version: latestAvailableVersion })
    return
  }

  if (downloadPromise) {
    await downloadPromise
    return
  }

  const cancellationToken = new CancellationToken()
  downloadCancellationToken = cancellationToken
  downloadCancellationNotified = false

  const promise = autoUpdater
    .downloadUpdate(cancellationToken)
    .then(() => undefined)
    .catch((error: unknown) => {
      if (isCancellationError(error)) {
        sendDownloadCancelledEvent()
        return
      }

      throw error
    })
    .finally(() => {
      if (downloadCancellationToken === cancellationToken) {
        downloadCancellationToken = null
      }
      if (downloadPromise === promise) {
        downloadPromise = null
      }
    })

  downloadPromise = promise
  await promise
}

export function cancelUpdateDownload(): void {
  if (!downloadCancellationToken || downloadCancellationToken.cancelled) {
    return
  }

  downloadCancellationToken.cancel()
  sendDownloadCancelledEvent()
}

export async function openUpdateDownloadPage(version?: string): Promise<void> {
  await shell.openExternal(getReleaseDownloadUrl(version ?? latestAvailableVersion))
}

export function quitAndInstallUpdate(): void {
  if (!app.isPackaged) {
    writeLog('info', 'Skipping quitAndInstall in development')
    return
  }

  autoUpdater.quitAndInstall()
}

export function shouldUseManualMacUpdateInstall(
  platform: NodeJS.Platform = process.platform,
  isPackaged = app.isPackaged,
  signedAutoUpdateEnabled = MACOS_SIGNED_AUTO_UPDATE_ENABLED
): boolean {
  return isPackaged && platform === 'darwin' && !signedAutoUpdateEnabled
}

export function getReleaseDownloadUrl(version?: string): string {
  if (!version) {
    return RELEASES_URL
  }

  return `${RELEASES_URL}/tag/v${encodeURIComponent(version)}`
}

function sendUpdateEvent(event: AppUpdateEvent): void {
  mainWindow?.webContents.send(IPC_CHANNELS.updates.event, event)
}

function sendDownloadCancelledEvent(): void {
  if (downloadCancellationNotified) {
    return
  }

  downloadCancellationNotified = true
  sendUpdateEvent({ type: 'cancelled' })
}

function resetDownloadCancellation(): void {
  downloadCancellationToken = null
  downloadPromise = null
}

function getUpdateErrorDetails(error: unknown): { reason: UpdateErrorReason; message: string } {
  const rawMessage = getRawUpdateErrorMessage(error)
  const updateError = error instanceof Error ? error as UpdateError : undefined

  if (
    updateError?.code === 'ERR_UPDATER_ZIP_FILE_NOT_FOUND' ||
    rawMessage.includes('ZIP file not provided')
  ) {
    return {
      reason: 'incomplete-package',
      message: 'Update package metadata is incomplete.'
    }
  }

  if (isNetworkUpdateError(updateError, rawMessage)) {
    return {
      reason: 'network',
      message: rawMessage || 'Unable to reach the update server.'
    }
  }

  return {
    reason: 'unknown',
    message: rawMessage || 'Update check failed.'
  }
}

function isNetworkUpdateError(error: UpdateError | undefined, rawMessage: string): boolean {
  const networkErrorSignals = [
    'net::ERR_CONNECTION_CLOSED',
    'net::ERR_CONNECTION_RESET',
    'net::ERR_CONNECTION_TIMED_OUT',
    'net::ERR_INTERNET_DISCONNECTED',
    'net::ERR_NAME_NOT_RESOLVED',
    'net::ERR_NETWORK_CHANGED',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EAI_AGAIN'
  ]
  const text = `${error?.code ?? ''} ${rawMessage}`
  return networkErrorSignals.some((signal) => text.includes(signal))
}

function isCancellationError(error: unknown): boolean {
  return error instanceof Error && error.message === 'cancelled'
}

function getRawUpdateErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || (error as UpdateError).code || ''
  }

  return String(error ?? '')
}

function createUpdaterLogger(mainLogger: Logger): UpdaterLogger {
  return {
    debug: (...messages) => writeViaLogger(mainLogger, 'debug', messages),
    info: (...messages) => writeViaLogger(mainLogger, 'info', messages),
    warn: (...messages) => writeViaLogger(mainLogger, 'warn', messages),
    error: (...messages) => writeViaLogger(mainLogger, 'error', messages)
  }
}

function writeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, string>): void {
  logger?.write({
    category: level === 'error' ? 'error' : 'application',
    level,
    message,
    source: 'main:update-manager',
    context
  })
}

function writeViaLogger(
  mainLogger: Logger,
  level: 'debug' | 'info' | 'warn' | 'error',
  messages: unknown[]
): void {
  mainLogger.write({
    category: level === 'error' ? 'error' : 'application',
    level,
    message: messages.map(formatLogValue).join(' '),
    source: 'electron-updater'
  })
}

function formatLogValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Error) {
    return value.message
  }

  return JSON.stringify(value)
}
