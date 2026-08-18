import type { TagQuality } from './tag'

export const TREND_RANGE_PRESETS = ['last1h', 'last8h', 'today', 'custom'] as const
export type TrendRangePreset = (typeof TREND_RANGE_PRESETS)[number]

export interface TrendPoint {
  tagId: string
  timestamp: string
  value: number
  quality: TagQuality
}

export interface AggregatedTrendPoint extends TrendPoint {
  min: number
  max: number
  last: number
}

export interface RealtimeTrendSnapshot {
  points: TrendPoint[]
  emittedAt: string
}

export type RealtimeTrendChangedEvent = RealtimeTrendSnapshot

export interface RealtimeTrendRequest {
  tagIds: string[]
}

export interface HistoricalTrendQuery {
  tagIds: string[]
  preset: TrendRangePreset
  startTime?: string
  endTime?: string
  maxPointsPerTag?: number
}

export interface HistoricalTrendResult {
  points: Array<TrendPoint | AggregatedTrendPoint>
  aggregated: boolean
  bucketMs?: number
  startTime: string
  endTime: string
  emittedAt: string
}

export const DEFAULT_REALTIME_TREND_SAMPLE_INTERVAL_MS = 1000
export const DEFAULT_REALTIME_TREND_MAX_POINTS = 1800
export const DEFAULT_HISTORICAL_TREND_MAX_POINTS_PER_TAG = 1000

export function isTrendRangePreset(value: unknown): value is TrendRangePreset {
  return typeof value === 'string' && (TREND_RANGE_PRESETS as readonly string[]).includes(value)
}
