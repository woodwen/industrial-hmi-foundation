import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'

import { registerIpcHandlers } from './ipc/register'
import { createMainLogger } from './logging/logger'
import { configureUpdateManager } from './update-manager'

const logger = createMainLogger()
let mainWindow: BrowserWindow | null = null

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: 'Industrial HMI Foundation',
    backgroundColor: '#f4f7fb',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  window.on('closed', () => {
    mainWindow = null
  })

  return window
}

void app.whenReady().then(() => {
  registerIpcHandlers(logger)
  logger.write({
    category: 'application',
    level: 'info',
    message: 'Application main process is ready',
    source: 'main'
  })

  if (process.env.HMI_SMOKE_TEST === '1') {
    app.quit()
    return
  }

  mainWindow = createMainWindow()
  configureUpdateManager(mainWindow, logger)

  app.on('activate', () => {
    if (mainWindow === null || mainWindow.isDestroyed()) {
      mainWindow = createMainWindow()
      configureUpdateManager(mainWindow, logger)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('uncaughtException', (error) => {
  logger.write({
    category: 'error',
    level: 'error',
    message: error.message,
    source: 'main:uncaughtException',
    context: {
      stack: error.stack ?? null
    }
  })
})

process.on('unhandledRejection', (reason) => {
  logger.write({
    category: 'error',
    level: 'error',
    message: 'Unhandled promise rejection',
    source: 'main:unhandledRejection',
    context: {
      reason: reason instanceof Error ? reason.message : String(reason)
    }
  })
})
