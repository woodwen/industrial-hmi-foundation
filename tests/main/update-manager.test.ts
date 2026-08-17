import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class TestCancellationToken {
    cancelled = false

    cancel(): void {
      this.cancelled = true
    }
  }

  const updateListeners = new Map<string, (...args: unknown[]) => void>()
  const autoUpdaterMock = {
    autoDownload: true,
    checkForUpdates: vi.fn(async () => undefined),
    downloadUpdate: vi.fn<(token?: TestCancellationToken) => Promise<string[]>>(async () => [] as string[]),
    logger: null as unknown,
    on: vi.fn((eventName: string, listener: (...args: unknown[]) => void) => {
      updateListeners.set(eventName, listener)
    }),
    quitAndInstall: vi.fn()
  }
  const appMock = {
    getVersion: () => '0.1.0',
    isPackaged: false
  }
  const shellMock = {
    openExternal: vi.fn(async () => undefined)
  }

  return { appMock, autoUpdaterMock, shellMock, TestCancellationToken, updateListeners }
})

vi.mock('electron', () => ({
  app: mocks.appMock,
  shell: mocks.shellMock
}))

vi.mock('builder-util-runtime', () => ({
  CancellationToken: mocks.TestCancellationToken
}))

vi.mock('electron-updater', () => ({
  default: {
    autoUpdater: mocks.autoUpdaterMock
  }
}))

describe('update manager', () => {
  const windowMock = {
    webContents: {
      send: vi.fn()
    }
  }
  const loggerMock = {
    write: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mocks.updateListeners.clear()
    mocks.autoUpdaterMock.autoDownload = true
    mocks.appMock.isPackaged = false
  })

  it('skips real update checks in development', async () => {
    const manager = await import('../../src/main/update-manager')
    manager.configureUpdateManager(windowMock as never, loggerMock)

    await manager.checkForUpdates()

    expect(mocks.autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
    expect(windowMock.webContents.send).toHaveBeenCalledWith('hmi:updates:event', { type: 'checking' })
    expect(windowMock.webContents.send).toHaveBeenCalledWith(
      'hmi:updates:event',
      { type: 'not-available', version: '0.1.0', development: true }
    )
  })

  it('maps network updater errors to typed update events', async () => {
    const manager = await import('../../src/main/update-manager')
    manager.configureUpdateManager(windowMock as never, loggerMock)

    mocks.updateListeners.get('error')?.(new Error('net::ERR_CONNECTION_CLOSED'))

    expect(windowMock.webContents.send).toHaveBeenCalledWith(
      'hmi:updates:event',
      expect.objectContaining({
        type: 'error',
        reason: 'network'
      })
    )
  })

  it('cancels an active update download', async () => {
    mocks.appMock.isPackaged = true
    const manager = await import('../../src/main/update-manager')
    manager.configureUpdateManager(windowMock as never, loggerMock)
    let finishDownload: (value: string[]) => void = () => undefined
    mocks.autoUpdaterMock.downloadUpdate.mockImplementationOnce(
      async () =>
        new Promise<string[]>((resolve) => {
          finishDownload = resolve
        })
    )

    const downloadPromise = manager.downloadUpdate({ forceAutomaticInstall: true })
    await Promise.resolve()
    await Promise.resolve()
    const cancellationToken = mocks.autoUpdaterMock.downloadUpdate.mock.calls[0]?.[0]

    expect(cancellationToken).toBeDefined()
    if (!cancellationToken) {
      throw new Error('Expected cancellation token')
    }
    expect(cancellationToken.cancelled).toBe(false)

    manager.cancelUpdateDownload()

    expect(cancellationToken.cancelled).toBe(true)
    expect(windowMock.webContents.send).toHaveBeenCalledWith('hmi:updates:event', { type: 'cancelled' })

    finishDownload([])
    await downloadPromise
  })

  it('uses manual installation for packaged unsigned macOS builds', async () => {
    const manager = await import('../../src/main/update-manager')

    expect(manager.shouldUseManualMacUpdateInstall('darwin', true, false)).toBe(true)
    expect(manager.shouldUseManualMacUpdateInstall('darwin', true, true)).toBe(false)
    expect(manager.shouldUseManualMacUpdateInstall('win32', true, false)).toBe(false)
    expect(manager.shouldUseManualMacUpdateInstall('darwin', false, false)).toBe(false)
  })

  it('opens this project GitHub release download page', async () => {
    const manager = await import('../../src/main/update-manager')

    await manager.openUpdateDownloadPage('0.1.1')

    expect(mocks.shellMock.openExternal).toHaveBeenCalledWith(
      'https://github.com/woodwen/industrial-hmi-foundation/releases/tag/v0.1.1'
    )
    expect(manager.getReleaseDownloadUrl()).toBe('https://github.com/woodwen/industrial-hmi-foundation/releases')
  })
})
