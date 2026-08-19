import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { SimulatorManager } from '../../../src/main/simulator'
import type { Logger } from '../../../src/main/logging/logger'
import type { SimulatorKind } from '../../../src/shared/simulator'

const existingEntryPath = fileURLToPath(import.meta.url)

describe('SimulatorManager', () => {
  it('starts a Modbus TCP simulator and ignores duplicate starts', async () => {
    const factory = createProcessFactory()
    const manager = createManager(factory)

    const start = manager.startSimulator('modbusTcp')
    factory.lastProcess?.stdout.emit('data', Buffer.from('PLC Simulator listening at 127.0.0.1:1502/unit-1'))
    const status = await start
    const secondStatus = await manager.startSimulator('modbusTcp')

    expect(status).toMatchObject({
      kind: 'modbusTcp',
      status: 'Running',
      managed: true,
      pid: 4001
    })
    expect(secondStatus.pid).toBe(4001)
    expect(factory.createProcess).toHaveBeenCalledTimes(1)
  })

  it('starts an OPC UA simulator from the fixed runtime entry', async () => {
    const factory = createProcessFactory()
    const manager = createManager(factory)

    const start = manager.startSimulator('opcUa')
    factory.lastProcess?.stdout.emit(
      'data',
      Buffer.from('OPC UA Simulator listening at opc.tcp://127.0.0.1:4840/industrial-hmi-simulator')
    )
    const status = await start

    expect(status).toMatchObject({
      kind: 'opcUa',
      status: 'Running',
      managed: true
    })
    expect(factory.createProcess).toHaveBeenCalledWith(existingEntryPath, 'opcUa')
  })

  it('stops only the process managed by the app', async () => {
    const factory = createProcessFactory()
    const manager = createManager(factory)

    const start = manager.startSimulator('modbusTcp')
    factory.lastProcess?.stdout.emit('data', Buffer.from('PLC Simulator listening at 127.0.0.1:1502/unit-1'))
    await start
    const child = factory.lastProcess
    const stop = manager.stopSimulator('modbusTcp')
    child?.emitExit(0, null)
    const stopped = await stop

    expect(stopped).toMatchObject({
      status: 'Stopped',
      managed: false,
      pid: undefined
    })
    expect(child?.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('keeps a stop during startup from becoming a Fault', async () => {
    const factory = createProcessFactory()
    const manager = createManager(factory)

    const start = manager.startSimulator('modbusTcp')
    const child = factory.lastProcess
    const stop = manager.stopSimulator('modbusTcp')
    child?.emitExit(0, 'SIGTERM')
    const started = await start
    const stopped = await stop

    expect(started).toMatchObject({
      status: 'Stopped',
      managed: false,
      lastError: undefined
    })
    expect(stopped).toMatchObject({
      status: 'Stopped',
      managed: false,
      lastError: undefined
    })
    expect(child?.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('stops managed simulator processes during dispose', async () => {
    const factory = createProcessFactory()
    const manager = createManager(factory)

    const start = manager.startSimulator('opcUa')
    factory.lastProcess?.stdout.emit(
      'data',
      Buffer.from('OPC UA Simulator listening at opc.tcp://127.0.0.1:4840/industrial-hmi-simulator')
    )
    await start
    const child = factory.lastProcess
    const dispose = manager.dispose()
    await Promise.resolve()
    child?.emitExit(0, 'SIGTERM')
    await dispose

    expect(manager.getStatus().simulators[1]).toMatchObject({
      status: 'Stopped',
      managed: false,
      pid: undefined
    })
    expect(child?.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('enters Fault without creating a process when the runtime entry is missing', async () => {
    const factory = createProcessFactory()
    const manager = new SimulatorManager({
      logger: createLogger(),
      resolveEntry: () => '/tmp/missing-simulator-entry.js',
      createProcess: factory.createProcess,
      now: () => '2026-08-19T00:00:00.000Z',
      startTimeoutMs: 20,
      stopTimeoutMs: 20
    })

    await expect(manager.startSimulator('modbusTcp')).rejects.toMatchObject({
      code: 'SIMULATOR_RUNTIME_MISSING'
    })

    expect(factory.createProcess).not.toHaveBeenCalled()
    expect(manager.getStatus().simulators[0]).toMatchObject({
      status: 'Fault',
      lastError: {
        code: 'SIMULATOR_RUNTIME_MISSING'
      }
    })
  })

  it('publishes Fault when a running simulator exits unexpectedly', async () => {
    const factory = createProcessFactory()
    const manager = createManager(factory)
    const listener = vi.fn()
    manager.subscribe(listener)

    const start = manager.startSimulator('modbusTcp')
    factory.lastProcess?.stdout.emit('data', Buffer.from('PLC Simulator listening at 127.0.0.1:1502/unit-1'))
    await start
    factory.lastProcess?.emitExit(1, null)

    expect(manager.getStatus().simulators[0]).toMatchObject({
      status: 'Fault',
      managed: false,
      lastError: {
        code: 'SIMULATOR_EXITED'
      }
    })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      changed: expect.objectContaining({
        status: 'Fault'
      })
    }))
  })
})

function createManager(factory: ReturnType<typeof createProcessFactory>): SimulatorManager {
  return new SimulatorManager({
    logger: createLogger(),
    resolveEntry: () => existingEntryPath,
    createProcess: factory.createProcess,
    now: () => '2026-08-19T00:00:00.000Z',
    startTimeoutMs: 20,
    stopTimeoutMs: 20
  })
}

function createProcessFactory(): {
  createProcess: ReturnType<typeof vi.fn<(entryPath: string, kind: SimulatorKind) => ChildProcess>>
  lastProcess: FakeChildProcess | null
} {
  const state: {
    lastProcess: FakeChildProcess | null
  } = {
    lastProcess: null
  }
  let pid = 4000
  const createProcess = vi.fn((entryPath: string) => {
    const child = new FakeChildProcess(++pid, entryPath)
    state.lastProcess = child
    return child as unknown as ChildProcess
  })

  return {
    createProcess,
    get lastProcess() {
      return state.lastProcess
    }
  }
}

class FakeChildProcess extends EventEmitter {
  readonly stdout = new EventEmitter()
  readonly stderr = new EventEmitter()
  exitCode: number | null = null
  killed = false
  readonly kill = vi.fn((signal?: NodeJS.Signals) => {
    this.killed = signal === 'SIGKILL'
    return true
  })

  constructor(
    readonly pid: number,
    readonly entryPath: string
  ) {
    super()
  }

  emitExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.exitCode = code
    this.emit('exit', code, signal)
  }
}

function createLogger(): Logger {
  return {
    write: vi.fn()
  }
}
