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
    updateConfig: 'hmi:devices:update-config',
    subscribeState: 'hmi:devices:subscribe-state',
    unsubscribeState: 'hmi:devices:unsubscribe-state',
    stateChanged: 'hmi:devices:state-changed',
    readRegisters: 'hmi:devices:read-registers',
    writeRegisters: 'hmi:devices:write-registers'
  },
  commands: {
    execute: 'hmi:commands:execute'
  },
  auth: {
    getCurrentUser: 'hmi:auth:get-current-user',
    createFirstAdmin: 'hmi:auth:create-first-admin',
    login: 'hmi:auth:login',
    logout: 'hmi:auth:logout',
    listUsers: 'hmi:auth:list-users',
    createUser: 'hmi:auth:create-user',
    updateUserRole: 'hmi:auth:update-user-role',
    setUserEnabled: 'hmi:auth:set-user-enabled'
  },
  recipes: {
    list: 'hmi:recipes:list',
    getParameterDefinitions: 'hmi:recipes:get-parameter-definitions',
    validate: 'hmi:recipes:validate',
    create: 'hmi:recipes:create',
    update: 'hmi:recipes:update',
    copy: 'hmi:recipes:copy',
    delete: 'hmi:recipes:delete',
    download: 'hmi:recipes:download'
  },
  audit: {
    query: 'hmi:audit:query'
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
  },
  simulators: {
    getStatus: 'hmi:simulators:get-status',
    start: 'hmi:simulators:start',
    stop: 'hmi:simulators:stop',
    subscribeStatus: 'hmi:simulators:subscribe-status',
    unsubscribeStatus: 'hmi:simulators:unsubscribe-status',
    statusChanged: 'hmi:simulators:status-changed'
  }
} as const
