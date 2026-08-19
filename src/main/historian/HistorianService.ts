import type { TagValue } from '../../shared/tag'
import type { Logger } from '../logging/logger'
import type { TagCache } from '../tag'
import type { TagHistoryInput, TagHistoryRepository } from './TagHistoryRepository'

export const DEFAULT_HISTORIAN_FIXED_INTERVAL_MS = 5000

export const DEFAULT_HISTORIAN_TAG_IDS = [
  'currentTemperature',
  'currentLevel',
  'currentPressure',
  'motorRpm'
] as const

export const DEFAULT_HISTORIAN_DEADBANDS: Record<string, number> = {
  currentTemperature: 0.2,
  currentLevel: 0.5,
  currentPressure: 0.01,
  motorRpm: 10
}

interface PersistedTagState {
  timestampMs: number
  value: TagValue['value']
  quality: TagValue['quality']
}

export interface HistorianServiceOptions {
  tagIds?: readonly string[]
  deadbands?: Readonly<Record<string, number>>
  fixedIntervalMs?: number
  now?: () => string
}

export class HistorianService {
  private readonly trackedTagIds: readonly string[]
  private readonly deadbands: Readonly<Record<string, number>>
  private readonly fixedIntervalMs: number
  private readonly lastPersisted = new Map<string, PersistedTagState>()
  private readonly unsubscribe: () => void

  constructor(
    tagCache: TagCache,
    private readonly repository: TagHistoryRepository,
    private readonly logger: Logger,
    private readonly options: HistorianServiceOptions = {}
  ) {
    this.trackedTagIds = options.tagIds ?? DEFAULT_HISTORIAN_TAG_IDS
    this.deadbands = options.deadbands ?? DEFAULT_HISTORIAN_DEADBANDS
    this.fixedIntervalMs = options.fixedIntervalMs ?? DEFAULT_HISTORIAN_FIXED_INTERVAL_MS
    this.unsubscribe = tagCache.subscribe((values) => this.handleTagValues(values))
  }

  dispose(): void {
    this.unsubscribe()
  }

  flush(): void {
    // Writes are synchronous and committed during batch handling in this phase.
  }

  handleTagValues(values: readonly TagValue[]): TagHistoryInput[] {
    const points = values
      .filter((value) => this.trackedTagIds.includes(value.tagId))
      .filter((value) => this.shouldPersist(value))
      .map((value) => ({
        tagId: value.tagId,
        timestamp: value.timestamp,
        value: value.value,
        quality: value.quality,
        createdAt: this.now()
      }))

    if (points.length === 0) {
      return []
    }

    try {
      this.repository.insertBatch(points)
      for (const point of points) {
        this.lastPersisted.set(point.tagId, {
          timestampMs: Date.parse(point.timestamp),
          value: point.value,
          quality: point.quality
        })
      }
    } catch (error) {
      this.logger.write({
        category: 'error',
        level: 'error',
        message: 'Failed to persist Tag History batch',
        source: 'main:historian-service',
        context: {
          tagCount: points.length,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      return []
    }

    return points
  }

  private shouldPersist(value: TagValue): boolean {
    const timestampMs = Date.parse(value.timestamp)
    if (!Number.isFinite(timestampMs)) {
      return false
    }

    const previous = this.lastPersisted.get(value.tagId)
    if (!previous) {
      return true
    }

    if (previous.quality !== value.quality) {
      return true
    }

    if (timestampMs - previous.timestampMs >= this.fixedIntervalMs) {
      return true
    }

    if (typeof previous.value === 'number' && typeof value.value === 'number') {
      return Math.abs(value.value - previous.value) >= (this.deadbands[value.tagId] ?? 0)
    }

    return previous.value !== value.value
  }

  private now(): string {
    return this.options.now?.() ?? new Date().toISOString()
  }
}
