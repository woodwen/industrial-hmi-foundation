export const IPC_CHANNELS = {
  app: {
    getInfo: 'hmi:app:get-info'
  },
  log: {
    write: 'hmi:log:write'
  },
  errors: {
    report: 'hmi:errors:report'
  }
} as const
