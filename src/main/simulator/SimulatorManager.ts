import { existsSync } from 'node:fs'
import { fork, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'

import { createAppError, toAppError, type AppErrorShape } from '../../shared/app-error'
import {
  DEFAULT_SIMULATOR_ENDPOINTS,
  SIMULATOR_KINDS,
  type SimulatorKind,
  type SimulatorLifecycleListener,
  type SimulatorRuntimeStatus,
  type SimulatorStatusChangedEvent,
  type SimulatorStatusSnapshot
} from '../../shared/simulator'
import type { Logger } from '../logging/logger'

const DEFAULT_START_TIMEOUT_MS = 5000
const DEFAULT_STOP_TIMEOUT_MS = 3000

type SimulatorEntryResolver = (kind: SimulatorKind) => string
type SimulatorProcessFactory = (entryPath: string, kind: SimulatorKind) => ChildProcess
type NowProvider = () => string

interface SimulatorManagerDependencies {
  logger: Logger
  resolveEntry?: SimulatorEntryResolver
  createProcess?: SimulatorProcessFactory
  now?: NowProvider
  startTimeoutMs?: number
  stopTimeoutMs?: number
}

interface ManagedSimulator {
  status: SimulatorRuntimeStatus
  process: ChildProcess | null
  stopRequested: boolean
}

export class SimulatorManager {
  private readonly simulators: Record<SimulatorKind, ManagedSimulator>
  private readonly listeners = new Set<SimulatorLifecycleListener>()
  private readonly resolveEntry: SimulatorEntryResolver
  private readonly createProcess: SimulatorProcessFactory
  private readonly now: NowProvider
  private readonly startTimeoutMs: number
  private readonly stopTimeoutMs: number

  constructor(private readonly dependencies: SimulatorManagerDependencies) {
    this.resolveEntry = dependencies.resolveEntry ?? resolveDefaultSimulatorEntry
    this.createProcess = dependencies.createProcess ?? createDefaultSimulatorProcess
    this.now = dependencies.now ?? (() => new Date().toISOString())
    this.startTimeoutMs = dependencies.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS
    this.stopTimeoutMs = dependencies.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS
    this.simulators = {
      modbusTcp: this.createInitialSimulator('modbusTcp'),
      opcUa: this.createInitialSimulator('opcUa')
    }
  }

  async startSimulator(kind: SimulatorKind): Promise<SimulatorRuntimeStatus> {
    const simulator = this.simulators[kind]
    if (simulator.status.status === 'Starting' || simulator.status.status === 'Running') {
      return simulator.status
    }

    if (simulator.status.status === 'Stopping') {
      throw createSimulatorError(
        'SIMULATOR_BUSY',
        'Simulator is stopping. Try again after it reaches Stopped.',
        'main:simulator-manager',
        `kind=${kind}`
      )
    }

    const entryPath = this.resolveEntry(kind)
    if (!existsSync(entryPath)) {
      const error = createSimulatorError(
        'SIMULATOR_RUNTIME_MISSING',
        'Simulator runtime entry was not found.',
        'main:simulator-manager',
        `kind=${kind}; entry=${entryPath}`
      )
      this.applyStatus(kind, {
        status: 'Fault',
        managed: false,
        pid: undefined,
        lastError: error
      })
      throw error
    }

    this.applyStatus(kind, {
      status: 'Starting',
      managed: true,
      lastError: undefined,
      stoppedAt: undefined
    })

    try {
      const child = this.createProcess(entryPath, kind)
      simulator.process = child
      simulator.stopRequested = false
      this.applyStatus(kind, {
        status: 'Starting',
        managed: true,
        pid: child.pid
      })
      this.attachProcessLifecycle(kind, child)

      await this.waitForReady(kind, child)
      if (simulator.process !== child) {
        return simulator.status
      }

      this.applyStatus(kind, {
        status: 'Running',
        managed: true,
        pid: child.pid,
        startedAt: this.now(),
        lastError: undefined
      })
      this.logLifecycle('info', 'Simulator started', kind, child.pid)
      return simulator.status
    } catch (error) {
      const appError = toSimulatorError(error, kind)
      await this.terminateProcess(kind, this.stopTimeoutMs)
      this.applyStatus(kind, {
        status: 'Fault',
        managed: false,
        pid: undefined,
        lastError: appError
      })
      this.logLifecycle('error', appError.message, kind, undefined, appError)
      throw appError
    }
  }

  async stopSimulator(kind: SimulatorKind): Promise<SimulatorRuntimeStatus> {
    const simulator = this.simulators[kind]

    if (!simulator.process) {
      this.applyStatus(kind, {
        status: 'Stopped',
        managed: false,
        pid: undefined,
        stoppedAt: this.now(),
        lastError: undefined
      })
      return simulator.status
    }

    if (simulator.status.status === 'Stopping') {
      return simulator.status
    }

    simulator.stopRequested = true
    this.applyStatus(kind, {
      status: 'Stopping',
      managed: true,
      lastError: undefined
    })

    await this.terminateProcess(kind, this.stopTimeoutMs)
    this.applyStatus(kind, {
      status: 'Stopped',
      managed: false,
      pid: undefined,
      stoppedAt: this.now(),
      lastError: undefined
    })
    this.logLifecycle('info', 'Simulator stopped', kind)

    return simulator.status
  }

  getStatus(): SimulatorStatusSnapshot {
    return {
      simulators: SIMULATOR_KINDS.map((kind) => this.simulators[kind].status),
      emittedAt: this.now()
    }
  }

  subscribe(listener: SimulatorLifecycleListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async dispose(): Promise<void> {
    for (const kind of SIMULATOR_KINDS) {
      try {
        await this.stopSimulator(kind)
      } catch (error) {
        const appError = toAppError(error, 'main:simulator-manager:dispose')
        this.dependencies.logger.write({
          category: 'error',
          level: 'error',
          message: 'Failed to stop managed Simulator during dispose',
          source: 'main:simulator-manager',
          context: {
            kind,
            code: appError.code,
            detail: appError.detail ?? null
          }
        })
      }
    }

    this.listeners.clear()
  }

  private createInitialSimulator(kind: SimulatorKind): ManagedSimulator {
    const updatedAt = this.now()

    return {
      process: null,
      stopRequested: false,
      status: {
        kind,
        status: 'Stopped',
        endpoint: DEFAULT_SIMULATOR_ENDPOINTS[kind],
        managed: false,
        updatedAt
      }
    }
  }

  private attachProcessLifecycle(kind: SimulatorKind, child: ChildProcess): void {
    child.once('exit', (code, signal) => {
      this.handleProcessExit(kind, child, code, signal)
    })

    child.once('error', (error) => {
      this.handleProcessError(kind, child, error)
    })

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim()
      if (text.length === 0) {
        return
      }

      this.dependencies.logger.write({
        category: 'communication',
        level: 'debug',
        message: 'Simulator stdout',
        source: 'main:simulator-manager',
        context: {
          kind,
          text: trimLogText(text)
        }
      })
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim()
      if (text.length === 0) {
        return
      }

      this.dependencies.logger.write({
        category: 'error',
        level: 'error',
        message: 'Simulator stderr',
        source: 'main:simulator-manager',
        context: {
          kind,
          text: trimLogText(text)
        }
      })
    })
  }

  private waitForReady(kind: SimulatorKind, child: ChildProcess): Promise<void> {
    return new Promise((resolve, reject) => {
      let stderrText = ''
      let settled = false
      const timeout = setTimeout(() => {
        settle(() => reject(createSimulatorError(
          'SIMULATOR_START_TIMEOUT',
          'Simulator did not report readiness before timeout.',
          'main:simulator-manager',
          `kind=${kind}`
        )))
      }, this.startTimeoutMs)

      const settle = (finish: () => void): void => {
        if (settled) {
          return
        }

        settled = true
        clearTimeout(timeout)
        child.stdout?.off('data', onStdout)
        child.stderr?.off('data', onStderr)
        child.off('exit', onExit)
        child.off('error', onError)
        finish()
      }

      const onStdout = (chunk: Buffer): void => {
        const text = chunk.toString('utf8')
        if (text.includes('listening at')) {
          settle(resolve)
        }
      }

      const onStderr = (chunk: Buffer): void => {
        stderrText += chunk.toString('utf8')
      }

      const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
        const simulator = this.simulators[kind]
        const expectedStop = simulator.process === child &&
          (simulator.stopRequested || simulator.status.status === 'Stopping')
        const alreadyStoppedByLifecycle = simulator.process !== child && simulator.status.status === 'Stopped'

        if (expectedStop || alreadyStoppedByLifecycle) {
          settle(resolve)
          return
        }

        settle(() => reject(createSimulatorError(
          'SIMULATOR_START_FAILED',
          'Simulator process exited before it was ready.',
          'main:simulator-manager',
          `kind=${kind}; code=${code ?? 'null'}; signal=${signal ?? 'null'}; stderr=${trimLogText(stderrText)}`
        )))
      }

      const onError = (error: Error): void => {
        settle(() => reject(createSimulatorError(
          'SIMULATOR_START_FAILED',
          'Simulator process failed to start.',
          'main:simulator-manager',
          `kind=${kind}`,
          error
        )))
      }

      child.stdout?.on('data', onStdout)
      child.stderr?.on('data', onStderr)
      child.once('exit', onExit)
      child.once('error', onError)
    })
  }

  private async terminateProcess(kind: SimulatorKind, timeoutMs: number): Promise<void> {
    const simulator = this.simulators[kind]
    const child = simulator.process
    if (!child) {
      return
    }

    if (child.exitCode !== null || child.killed) {
      simulator.process = null
      return
    }

    const exited = waitForExit(child, timeoutMs)
    child.kill('SIGTERM')

    if (await exited) {
      simulator.process = null
      return
    }

    const killed = waitForExit(child, timeoutMs)
    child.kill('SIGKILL')
    await killed
    simulator.process = null
  }

  private handleProcessExit(
    kind: SimulatorKind,
    child: ChildProcess,
    code: number | null,
    signal: NodeJS.Signals | null
  ): void {
    const simulator = this.simulators[kind]
    if (simulator.process !== child) {
      return
    }

    simulator.process = null
    const expected = simulator.stopRequested || simulator.status.status === 'Stopping'
    simulator.stopRequested = false

    if (expected) {
      this.applyStatus(kind, {
        status: 'Stopped',
        managed: false,
        pid: undefined,
        stoppedAt: this.now(),
        lastError: undefined
      })
      return
    }

    const error = createSimulatorError(
      'SIMULATOR_EXITED',
      'Simulator process exited unexpectedly.',
      'main:simulator-manager',
      `kind=${kind}; code=${code ?? 'null'}; signal=${signal ?? 'null'}`
    )
    this.applyStatus(kind, {
      status: 'Fault',
      managed: false,
      pid: undefined,
      lastError: error
    })
  }

  private handleProcessError(kind: SimulatorKind, child: ChildProcess, error: Error): void {
    const simulator = this.simulators[kind]
    if (simulator.process !== child) {
      return
    }

    simulator.process = null
    simulator.stopRequested = false
    const appError = createSimulatorError(
      'SIMULATOR_PROCESS_ERROR',
      'Simulator process failed.',
      'main:simulator-manager',
      `kind=${kind}`,
      error
    )
    this.applyStatus(kind, {
      status: 'Fault',
      managed: false,
      pid: undefined,
      lastError: appError
    })
  }

  private applyStatus(
    kind: SimulatorKind,
    patch: Partial<Omit<SimulatorRuntimeStatus, 'kind' | 'endpoint' | 'updatedAt'>>
  ): void {
    const simulator = this.simulators[kind]
    simulator.status = {
      ...simulator.status,
      ...patch,
      kind,
      endpoint: simulator.status.endpoint,
      updatedAt: this.now()
    }
    this.emitStatus(kind)
  }

  private emitStatus(kind: SimulatorKind): void {
    if (this.listeners.size === 0) {
      return
    }

    const event: SimulatorStatusChangedEvent = {
      ...this.getStatus(),
      changed: this.simulators[kind].status
    }

    this.listeners.forEach((listener) => listener(event))
  }

  private logLifecycle(
    level: 'info' | 'error',
    message: string,
    kind: SimulatorKind,
    pid?: number,
    error?: AppErrorShape
  ): void {
    this.dependencies.logger.write({
      category: level === 'error' ? 'error' : 'communication',
      level,
      message,
      source: 'main:simulator-manager',
      context: {
        kind,
        pid: pid ?? null,
        errorCode: error?.code ?? null
      }
    })
  }
}

export function createDefaultSimulatorManager(logger: Logger): SimulatorManager {
  return new SimulatorManager({
    logger
  })
}

function createDefaultSimulatorProcess(entryPath: string): ChildProcess {
  return fork(entryPath, [], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: process.versions.electron ? '1' : process.env.ELECTRON_RUN_AS_NODE
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  })
}

function resolveDefaultSimulatorEntry(kind: SimulatorKind): string {
  const relativeEntry = kind === 'opcUa'
    ? join('out', 'simulator', 'simulator', 'opcua-index.js')
    : join('out', 'simulator', 'simulator', 'index.js')

  if (process.env.HMI_SIMULATOR_RUNTIME_DIR) {
    return join(process.env.HMI_SIMULATOR_RUNTIME_DIR, 'simulator', kind === 'opcUa' ? 'opcua-index.js' : 'index.js')
  }

  const workspaceEntry = join(process.cwd(), relativeEntry)
  if (existsSync(workspaceEntry)) {
    return workspaceEntry
  }

  if (process.versions.electron && process.resourcesPath) {
    return join(process.resourcesPath, 'app.asar.unpacked', relativeEntry)
  }

  return workspaceEntry
}

function createSimulatorError(
  code: string,
  message: string,
  source: string,
  detail?: string,
  cause?: unknown
): AppErrorShape {
  return createAppError({
    code,
    message,
    detail,
    source,
    cause
  })
}

function toSimulatorError(error: unknown, kind: SimulatorKind): AppErrorShape {
  const appError = toAppError(error, 'main:simulator-manager')
  if (appError.code === 'APP_UNKNOWN_ERROR') {
    return createSimulatorError(
      'SIMULATOR_START_FAILED',
      'Simulator failed to start.',
      'main:simulator-manager',
      `kind=${kind}; cause=${appError.message}`,
      appError.message
    )
  }

  return appError
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.killed) {
    return Promise.resolve(true)
  }

  return new Promise((resolve) => {
    let settled = false
    const timeout = setTimeout(() => {
      settle(false)
    }, timeoutMs)

    const settle = (exited: boolean): void => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      child.off('exit', onExit)
      resolve(exited)
    }

    const onExit = (): void => {
      settle(true)
    }

    child.once('exit', onExit)
  })
}

function trimLogText(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length > 240 ? `${compact.slice(0, 237)}...` : compact
}
