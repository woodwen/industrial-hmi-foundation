export const IPC_CHANNELS = {
  app: {
    getInfo: 'hmi:app:get-info'
  },
  log: {
    write: 'hmi:log:write'
  },
  errors: {
    report: 'hmi:errors:report'
  },
  updates: {
    checkForUpdates: 'hmi:updates:check-for-updates',
    downloadUpdate: 'hmi:updates:download-update',
    cancelUpdateDownload: 'hmi:updates:cancel-download',
    openUpdateDownloadPage: 'hmi:updates:open-download-page',
    quitAndInstallUpdate: 'hmi:updates:quit-and-install',
    event: 'hmi:updates:event'
  }
} as const
