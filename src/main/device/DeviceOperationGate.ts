export class DeviceOperationGate {
  private readonly activeDevices = new Set<string>()

  isBusy(deviceId: string): boolean {
    return this.activeDevices.has(deviceId)
  }

  async runExclusive<T>(deviceId: string, operation: () => Promise<T>): Promise<T> {
    if (this.activeDevices.has(deviceId)) {
      throw new DeviceOperationBusyError(deviceId)
    }

    this.activeDevices.add(deviceId)
    try {
      return await operation()
    } finally {
      this.activeDevices.delete(deviceId)
    }
  }

  dispose(): void {
    this.activeDevices.clear()
  }
}

export class DeviceOperationBusyError extends Error {
  constructor(readonly deviceId: string) {
    super(`Device ${deviceId} already has an active protocol operation.`)
    this.name = 'DeviceOperationBusyError'
  }
}
