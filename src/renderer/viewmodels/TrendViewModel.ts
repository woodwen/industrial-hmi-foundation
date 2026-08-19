import { makeAutoObservable, runInAction } from 'mobx'

import { toAppError, type AppErrorShape } from '../../shared/app-error'
import type {
  HistoricalTrendResult,
  RealtimeTrendChangedEvent,
  Unsubscribe
} from '../../shared/hmi-api'
import {
  DEFAULT_HISTORICAL_TREND_MAX_POINTS_PER_TAG,
  DEFAULT_REALTIME_TREND_MAX_POINTS,
  type TrendPoint,
  type TrendRangePreset
} from '../../shared/trend'
import type { AppApplicationService } from '../application/AppApplicationService'

export type TrendMode = 'realtime' | 'historical'

export const DEFAULT_TREND_TAG_IDS = [
  'currentTemperature',
  'currentLevel',
  'currentPressure',
  'motorRpm'
] as const

export const TREND_TAG_LABELS: Record<string, string> = {
  currentTemperature: 'Temperature',
  currentLevel: 'Level',
  currentPressure: 'Pressure',
  motorRpm: 'RPM'
}

export class TrendViewModel {
  mode: TrendMode = 'realtime'
  preset: TrendRangePreset = 'last1h'
  selectedTagIds = new Set<string>(DEFAULT_TREND_TAG_IDS)
  realtimePoints = new Map<string, TrendPoint[]>()
  historicalPoints = new Map<string, TrendPoint[]>()
  historicalResult: HistoricalTrendResult | null = null
  customStartTime = ''
  customEndTime = ''
  isInitialized = false
  isLoading = false
  isQueryingHistorical = false
  error: AppErrorShape | null = null
  private unsubscribe: Unsubscribe | null = null

  constructor(private readonly appService: AppApplicationService) {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get selectedTags(): string[] {
    return DEFAULT_TREND_TAG_IDS.filter((tagId) => this.selectedTagIds.has(tagId))
  }

  get visiblePoints(): Map<string, TrendPoint[]> {
    return this.mode === 'realtime' ? this.realtimePoints : this.historicalPoints
  }

  get hasVisiblePoints(): boolean {
    return Array.from(this.visiblePoints.values()).some((points) => points.length > 0)
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || this.isLoading) {
      return
    }

    this.isLoading = true
    try {
      const snapshot = await this.appService.getRealtimeTrendSnapshot({
        tagIds: [...DEFAULT_TREND_TAG_IDS]
      })
      if (!snapshot.ok) {
        runInAction(() => {
          this.error = snapshot.error
        })
        return
      }

      runInAction(() => {
        this.applyRealtimePoints(snapshot.data.points)
        this.isInitialized = true
        this.error = null
      })

      this.unsubscribe = this.appService.subscribeRealtimeTrend({
        tagIds: [...DEFAULT_TREND_TAG_IDS]
      }, this.applyRealtimeTrendEvent)
      await this.queryHistorical()
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:trend-initialize')
      })
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  dispose(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.isInitialized = false
  }

  setMode(mode: TrendMode): void {
    this.mode = mode
  }

  setPreset(preset: TrendRangePreset): void {
    this.preset = preset
  }

  setCustomStartTime(value: string): void {
    this.customStartTime = value
  }

  setCustomEndTime(value: string): void {
    this.customEndTime = value
  }

  toggleTag(tagId: string): void {
    if (this.selectedTagIds.has(tagId)) {
      if (this.selectedTagIds.size > 1) {
        this.selectedTagIds.delete(tagId)
      }
      return
    }

    this.selectedTagIds.add(tagId)
  }

  async queryHistorical(): Promise<void> {
    this.isQueryingHistorical = true
    this.error = null

    try {
      const result = await this.appService.queryHistoricalTrend({
        tagIds: this.selectedTags,
        preset: this.preset,
        startTime: normalizeDateTimeInput(this.customStartTime),
        endTime: normalizeDateTimeInput(this.customEndTime),
        maxPointsPerTag: DEFAULT_HISTORICAL_TREND_MAX_POINTS_PER_TAG
      })

      runInAction(() => {
        if (result.ok) {
          this.historicalResult = result.data
          this.historicalPoints = groupPoints(result.data.points)
          this.error = null
          return
        }

        this.error = result.error
      })
    } catch (error) {
      runInAction(() => {
        this.error = toAppError(error, 'renderer:trend-history')
      })
    } finally {
      runInAction(() => {
        this.isQueryingHistorical = false
      })
    }
  }

  applyRealtimeTrendEvent(event: RealtimeTrendChangedEvent): void {
    runInAction(() => {
      this.applyRealtimePoints(event.points)
      this.error = null
    })
  }

  private applyRealtimePoints(points: readonly TrendPoint[]): void {
    for (const point of points) {
      const current = this.realtimePoints.get(point.tagId) ?? []
      current.push(point)
      if (current.length > DEFAULT_REALTIME_TREND_MAX_POINTS) {
        current.splice(0, current.length - DEFAULT_REALTIME_TREND_MAX_POINTS)
      }
      this.realtimePoints.set(point.tagId, current)
    }
  }
}

function groupPoints(points: readonly TrendPoint[]): Map<string, TrendPoint[]> {
  const grouped = new Map<string, TrendPoint[]>()
  for (const point of points) {
    const current = grouped.get(point.tagId) ?? []
    current.push(point)
    if (current.length > DEFAULT_HISTORICAL_TREND_MAX_POINTS_PER_TAG) {
      current.splice(0, current.length - DEFAULT_HISTORICAL_TREND_MAX_POINTS_PER_TAG)
    }
    grouped.set(point.tagId, current)
  }

  return grouped
}

function normalizeDateTimeInput(value: string): string | undefined {
  if (!value) {
    return undefined
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined
}
