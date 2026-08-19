import type { RealtimeTrendChangedEvent, RealtimeTrendSnapshot, TrendPoint } from '../../shared/trend'
import {
  DEFAULT_REALTIME_TREND_MAX_POINTS,
  DEFAULT_REALTIME_TREND_SAMPLE_INTERVAL_MS
} from '../../shared/trend'
import type { TagCache } from '../tag'
import { DEFAULT_HISTORIAN_TAG_IDS } from './HistorianService'
import { RingBuffer } from './RingBuffer'

export type RealtimeTrendListener = (event: RealtimeTrendChangedEvent) => void

export interface TrendServiceOptions {
  tagIds?: readonly string[]
  sampleIntervalMs?: number
  maxPointsPerTag?: number
  autoStart?: boolean
  now?: () => string
}

export class TrendService {
  private readonly tagIds: readonly string[]
  private readonly buffers = new Map<string, RingBuffer<TrendPoint>>()
  private readonly listeners = new Set<RealtimeTrendListener>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly tagCache: TagCache,
    private readonly options: TrendServiceOptions = {}
  ) {
    this.tagIds = options.tagIds ?? DEFAULT_HISTORIAN_TAG_IDS
    const maxPointsPerTag = options.maxPointsPerTag ?? DEFAULT_REALTIME_TREND_MAX_POINTS
    for (const tagId of this.tagIds) {
      this.buffers.set(tagId, new RingBuffer<TrendPoint>(maxPointsPerTag))
    }

    if (options.autoStart !== false) {
      this.start()
    }
  }

  start(): void {
    if (this.timer) {
      return
    }

    this.timer = setInterval(() => {
      this.sampleOnce()
    }, this.options.sampleIntervalMs ?? DEFAULT_REALTIME_TREND_SAMPLE_INTERVAL_MS)
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.listeners.clear()
    this.buffers.forEach((buffer) => buffer.clear())
  }

  subscribe(listener: RealtimeTrendListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(tagIds: readonly string[] = this.tagIds): RealtimeTrendSnapshot {
    return {
      points: this.getPoints(tagIds),
      emittedAt: this.now()
    }
  }

  getPoints(tagIds: readonly string[] = this.tagIds): TrendPoint[] {
    return normalizeTagIds(tagIds, this.tagIds).flatMap((tagId) => (
      this.buffers.get(tagId)?.toArray() ?? []
    ))
  }

  sampleOnce(timestamp = this.now()): TrendPoint[] {
    const points = this.tagIds.flatMap((tagId) => {
      const value = this.tagCache.getValue(tagId)
      if (!value || typeof value.value !== 'number') {
        return []
      }

      return [{
        tagId,
        timestamp,
        value: value.value,
        quality: value.quality
      }]
    })

    for (const point of points) {
      this.buffers.get(point.tagId)?.push(point)
    }

    if (points.length > 0) {
      this.emit(points)
    }

    return points
  }

  private emit(points: readonly TrendPoint[]): void {
    if (this.listeners.size === 0) {
      return
    }

    const event: RealtimeTrendChangedEvent = {
      points: points.map((point) => ({ ...point })),
      emittedAt: this.now()
    }

    this.listeners.forEach((listener) => {
      listener(event)
    })
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString()
  }
}

function normalizeTagIds(requestedTagIds: readonly string[], allowedTagIds: readonly string[]): string[] {
  const allowed = new Set(allowedTagIds)
  const unique = Array.from(new Set(requestedTagIds))
  return unique.filter((tagId) => allowed.has(tagId))
}
