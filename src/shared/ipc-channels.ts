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
  },
  devices: {
    connect: 'hmi:devices:connect',
    disconnect: 'hmi:devices:disconnect',
    getStatus: 'hmi:devices:get-status',
    subscribeState: 'hmi:devices:subscribe-state',
    unsubscribeState: 'hmi:devices:unsubscribe-state',
    stateChanged: 'hmi:devices:state-changed',
    readRegisters: 'hmi:devices:read-registers',
    writeRegisters: 'hmi:devices:write-registers'
  },
  commands: {
    execute: 'hmi:commands:execute'
  },
  tags: {
    getSnapshot: 'hmi:tags:get-snapshot',
    subscribe: 'hmi:tags:subscribe',
    unsubscribe: 'hmi:tags:unsubscribe',
    valuesChanged: 'hmi:tags:values-changed'
  },
  alarms: {
    getSnapshot: 'hmi:alarms:get-snapshot',
    subscribe: 'hmi:alarms:subscribe',
    unsubscribe: 'hmi:alarms:unsubscribe',
    changed: 'hmi:alarms:changed',
    acknowledge: 'hmi:alarms:acknowledge',
    queryHistory: 'hmi:alarms:query-history'
  },
  trends: {
    getRealtimeSnapshot: 'hmi:trends:get-realtime-snapshot',
    subscribeRealtime: 'hmi:trends:subscribe-realtime',
    unsubscribeRealtime: 'hmi:trends:unsubscribe-realtime',
    realtimeChanged: 'hmi:trends:realtime-changed',
    queryHistorical: 'hmi:trends:query-historical'
  }
} as const
