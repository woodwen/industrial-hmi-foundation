import { createAppError } from '../../shared/app-error'
import type {
  AlarmAcknowledgeRequest,
  AlarmChangedEvent,
  AlarmDefinition,
  AlarmOccurrence,
  AlarmSnapshot,
  AlarmValue
} from '../../shared/alarm'
import type { DeviceStateChangedEvent, DeviceStatus } from '../../shared/hmi-api'
import type { TagValue } from '../../shared/tag'
import type { DeviceManager } from '../device'
import type { Logger } from '../logging/logger'
import type { TagCache } from '../tag'
import { evaluateAlarmCondition, type AlarmSignal } from './alarm-condition'
import type { AlarmHistoryRepository } from './AlarmHistoryRepository'
import {
  DEFAULT_ALARM_DEFINITIONS,
  MOTOR_ABNORMAL_SIGNAL_ID,
  PLC_DISCONNECTED_SIGNAL_ID
} from './default-alarms'

export const DEFAULT_ALARM_ACKNOWLEDGE_USER = 'operator'
const RECENT_RECOVERED_WINDOW_MS = 5 * 60 * 1000

interface PendingActivation {
  timer: ReturnType<typeof setTimeout>
  triggerValue: AlarmValue
  triggerTime: string
}

interface PendingRecovery {
  timer: ReturnType<typeof setTimeout>
  recoverValue: AlarmValue
  recoverTime: string
}

interface AlarmRuntimeState {
  definition: AlarmDefinition
  occurrence?: AlarmOccurrence
  pendingActivation?: PendingActivation
  pendingRecovery?: PendingRecovery
}

export interface AlarmEngineOptions {
  definitions?: readonly AlarmDefinition[]
  now?: () => string
}

export class AlarmEngine {
  private readonly states = new Map<string, AlarmRuntimeState>()
  private readonly signals = new Map<string, AlarmSignal>()
  private readonly listeners = new Set<(event: AlarmChangedEvent) => void>()
  private readonly unsubscribeTagCache: () => void
  private readonly unsubscribeDeviceState: () => void

  constructor(
    tagCache: TagCache,
    deviceManager: DeviceManager,
    private readonly repository: AlarmHistoryRepository,
    private readonly logger: Logger,
    private readonly options: AlarmEngineOptions = {}
  ) {
    for (const definition of options.definitions ?? DEFAULT_ALARM_DEFINITIONS) {
      this.states.set(definition.id, {
        definition
      })
    }

    this.unsubscribeTagCache = tagCache.subscribe((values) => this.handleTagValues(values))
    this.unsubscribeDeviceState = deviceManager.subscribeState((event) => this.handleDeviceState(event))
    this.handleDeviceStatus(deviceManager.getDeviceStatus())
  }

  dispose(): void {
    this.unsubscribeTagCache()
    this.unsubscribeDeviceState()
    this.listeners.clear()
    this.states.forEach((state) => {
      this.cancelPendingActivation(state)
      this.cancelPendingRecovery(state)
    })
  }

  subscribe(listener: (event: AlarmChangedEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): AlarmSnapshot {
    return {
      occurrences: this.getVisibleOccurrences(),
      emittedAt: this.now()
    }
  }

  acknowledge(request: AlarmAcknowledgeRequest): AlarmOccurrence {
    const user = normalizeAcknowledgeUser(request.user)
    const state = Array.from(this.states.values()).find((candidate) => (
      candidate.occurrence?.id === request.occurrenceId
    ))
    const occurrence = state?.occurrence

    if (!state || !occurrence || occurrence.status === 'Recovered') {
      throw createAppError({
        code: 'ALARM_OCCURRENCE_NOT_FOUND',
        message: 'Alarm occurrence is not active or already recovered.',
        source: 'main:alarm-engine',
        detail: `occurrenceId=${request.occurrenceId}`
      })
    }

    const acknowledgedAt = this.now()
    const nextOccurrence: AlarmOccurrence = {
      ...occurrence,
      acknowledgeTime: acknowledgedAt,
      acknowledgeUser: user,
      status: occurrence.recoverTime ? 'Recovered' : 'Acknowledged',
      updatedAt: acknowledgedAt
    }

    this.persistAcknowledge(nextOccurrence)
    state.occurrence = nextOccurrence
    this.emit()
    return { ...nextOccurrence }
  }

  handleTagValues(values: readonly TagValue[]): void {
    for (const value of values) {
      this.signals.set(value.tagId, {
        id: value.tagId,
        value: value.value,
        quality: value.quality,
        timestamp: value.timestamp
      })
    }

    this.updateMotorAbnormalSignal(values)
    this.evaluateAll()
  }

  handleDeviceState(event: DeviceStateChangedEvent): void {
    this.handleDeviceStatus(event)
  }

  private handleDeviceStatus(status: Pick<DeviceStatus, 'connectionStatus'>): void {
    const connectionLost = status.connectionStatus === 'Reconnecting' || status.connectionStatus === 'Fault'
    this.signals.set(PLC_DISCONNECTED_SIGNAL_ID, {
      id: PLC_DISCONNECTED_SIGNAL_ID,
      value: connectionLost,
      quality: 'Good',
      timestamp: this.now()
    })
    this.evaluateDefinitionId('alarm-plc-disconnected')
  }

  private updateMotorAbnormalSignal(values: readonly TagValue[]): void {
    const relevant = values.some((value) => (
      value.tagId === 'deviceRunningStatus' || value.tagId === 'mixerMotorRunningStatus'
    ))
    if (!relevant) {
      return
    }

    const deviceRunning = this.signals.get('deviceRunningStatus')
    const motorRunning = this.signals.get('mixerMotorRunningStatus')
    const abnormal = deviceRunning?.quality === 'Good' &&
      motorRunning?.quality === 'Good' &&
      deviceRunning.value === true &&
      motorRunning.value === false

    this.signals.set(MOTOR_ABNORMAL_SIGNAL_ID, {
      id: MOTOR_ABNORMAL_SIGNAL_ID,
      value: abnormal,
      quality: 'Good',
      timestamp: this.now()
    })
  }

  private evaluateAll(): void {
    this.states.forEach((_state, definitionId) => {
      this.evaluateDefinitionId(definitionId)
    })
  }

  private evaluateDefinitionId(definitionId: string): void {
    const state = this.states.get(definitionId)
    if (!state) {
      return
    }

    const condition = evaluateAlarmCondition(state.definition, this.signals.get(state.definition.tagId), hasOpenOccurrence(state))
    if (condition === null) {
      this.cancelPendingActivation(state)
      this.cancelPendingRecovery(state)
      return
    }

    if (condition) {
      this.handleConditionActive(state)
      return
    }

    this.handleConditionInactive(state)
  }

  private handleConditionActive(state: AlarmRuntimeState): void {
    this.cancelPendingRecovery(state)

    if (hasOpenOccurrence(state)) {
      if (state.occurrence) {
        state.occurrence.conditionActive = true
        if (state.occurrence.status === 'Active' && state.occurrence.recoverTime) {
          state.occurrence.recoverTime = undefined
          state.occurrence.recoverValue = undefined
          state.occurrence.updatedAt = this.now()
          this.persistRecovery(state.occurrence)
          this.emit()
        }
      }
      return
    }

    if (state.pendingActivation) {
      return
    }

    const signal = this.signals.get(state.definition.tagId)
    const triggerTime = this.now()
    state.pendingActivation = {
      triggerValue: signal?.value ?? null,
      triggerTime,
      timer: setTimeout(() => this.activateIfStillAbnormal(state.definition.id), state.definition.delay)
    }
  }

  private handleConditionInactive(state: AlarmRuntimeState): void {
    this.cancelPendingActivation(state)

    if (!hasOpenOccurrence(state) || state.occurrence?.recoverTime) {
      return
    }

    if (state.pendingRecovery) {
      return
    }

    const recoveryDelayMs = state.definition.recoveryDelay ?? state.definition.delay
    const signal = this.signals.get(state.definition.tagId)
    state.pendingRecovery = {
      recoverValue: signal?.value ?? null,
      recoverTime: this.now(),
      timer: setTimeout(() => this.recoverIfStillNormal(state.definition.id), recoveryDelayMs)
    }
  }

  private activateIfStillAbnormal(definitionId: string): void {
    const state = this.states.get(definitionId)
    if (!state?.pendingActivation) {
      return
    }

    const pending = state.pendingActivation
    state.pendingActivation = undefined

    const condition = evaluateAlarmCondition(state.definition, this.signals.get(state.definition.tagId))
    if (condition !== true || hasOpenOccurrence(state)) {
      return
    }

    const occurrence: AlarmOccurrence = {
      id: createOccurrenceId(state.definition.id, pending.triggerTime),
      definitionId: state.definition.id,
      code: state.definition.code,
      tagId: state.definition.tagId,
      level: state.definition.level,
      message: state.definition.message,
      status: 'Active',
      triggerTime: pending.triggerTime,
      triggerValue: pending.triggerValue,
      conditionActive: true,
      updatedAt: this.now()
    }

    state.occurrence = occurrence
    this.persistCreate(occurrence)
    this.emit()
  }

  private recoverIfStillNormal(definitionId: string): void {
    const state = this.states.get(definitionId)
    if (!state?.pendingRecovery || !state.occurrence || state.occurrence.recoverTime) {
      return
    }

    const pending = state.pendingRecovery
    state.pendingRecovery = undefined

    const condition = evaluateAlarmCondition(state.definition, this.signals.get(state.definition.tagId), true)
    if (condition !== false) {
      return
    }

    const occurrence = state.occurrence
    occurrence.recoverTime = pending.recoverTime
    occurrence.recoverValue = pending.recoverValue
    occurrence.conditionActive = false
    occurrence.status = occurrence.status === 'Acknowledged' ? 'Recovered' : 'Active'
    occurrence.updatedAt = this.now()

    this.persistRecovery(occurrence)
    this.emit()
  }

  private getVisibleOccurrences(): AlarmOccurrence[] {
    const nowMs = Date.parse(this.now())
    return Array.from(this.states.values())
      .flatMap((state) => state.occurrence ? [state.occurrence] : [])
      .filter((occurrence) => (
        occurrence.status !== 'Recovered' ||
        nowMs - Date.parse(occurrence.updatedAt) <= RECENT_RECOVERED_WINDOW_MS
      ))
      .sort((left, right) => Date.parse(right.triggerTime) - Date.parse(left.triggerTime))
      .map((occurrence) => ({ ...occurrence }))
  }

  private persistCreate(occurrence: AlarmOccurrence): void {
    try {
      this.repository.createOccurrence(occurrence)
    } catch (error) {
      this.logPersistenceError('Failed to persist alarm trigger', error)
    }
  }

  private persistAcknowledge(occurrence: AlarmOccurrence): void {
    try {
      this.repository.updateAcknowledge(occurrence)
    } catch (error) {
      this.logPersistenceError('Failed to persist alarm acknowledge', error)
      throw createAppError({
        code: 'ALARM_HISTORY_WRITE_FAILED',
        message: 'Failed to persist alarm acknowledge.',
        source: 'main:alarm-engine',
        cause: error
      })
    }
  }

  private persistRecovery(occurrence: AlarmOccurrence): void {
    try {
      this.repository.updateRecovery(occurrence)
    } catch (error) {
      this.logPersistenceError('Failed to persist alarm recovery', error)
    }
  }

  private logPersistenceError(message: string, error: unknown): void {
    this.logger.write({
      category: 'error',
      level: 'error',
      message,
      source: 'main:alarm-engine',
      context: {
        error: error instanceof Error ? error.message : String(error)
      }
    })
  }

  private emit(): void {
    if (this.listeners.size === 0) {
      return
    }

    const event: AlarmChangedEvent = this.getSnapshot()
    this.listeners.forEach((listener) => {
      listener(event)
    })
  }

  private cancelPendingActivation(state: AlarmRuntimeState): void {
    if (!state.pendingActivation) {
      return
    }

    clearTimeout(state.pendingActivation.timer)
    state.pendingActivation = undefined
  }

  private cancelPendingRecovery(state: AlarmRuntimeState): void {
    if (!state.pendingRecovery) {
      return
    }

    clearTimeout(state.pendingRecovery.timer)
    state.pendingRecovery = undefined
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString()
  }
}

function hasOpenOccurrence(state: AlarmRuntimeState): boolean {
  return state.occurrence !== undefined && state.occurrence.status !== 'Recovered'
}

function normalizeAcknowledgeUser(user: string | undefined): string {
  const trimmed = user?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_ALARM_ACKNOWLEDGE_USER
}

function createOccurrenceId(definitionId: string, triggerTime: string): string {
  return `${definitionId}-${Date.parse(triggerTime)}`
}
