import type { HistoricalTrendQuery, HistoricalTrendResult } from '../../shared/trend'
import { DEFAULT_HISTORICAL_TREND_MAX_POINTS_PER_TAG } from '../../shared/trend'
import type { TagHistoryRepository } from './TagHistoryRepository'

export class TrendQueryService {
  constructor(
    private readonly repository: TagHistoryRepository,
    private readonly now: () => number = () => Date.now()
  ) {}

  queryHistorical(query: HistoricalTrendQuery): HistoricalTrendResult {
    const range = resolveHistoricalRange(query, this.now())
    const tagIds = Array.from(new Set(query.tagIds))
    const maxPointsPerTag = normalizeMaxPoints(query.maxPointsPerTag)
    const counts = this.repository.countByTag({
      tagIds,
      startMs: range.startMs,
      endMs: range.endMs
    })
    const requiresAggregation = tagIds.some((tagId) => (counts[tagId] ?? 0) > maxPointsPerTag)

    if (!requiresAggregation) {
      return {
        points: this.repository.queryRaw({
          tagIds,
          startMs: range.startMs,
          endMs: range.endMs
        }),
        aggregated: false,
        startTime: new Date(range.startMs).toISOString(),
        endTime: new Date(range.endMs).toISOString(),
        emittedAt: new Date(this.now()).toISOString()
      }
    }

    const bucketMs = Math.max(1, Math.floor((range.endMs - range.startMs) / maxPointsPerTag) + 1)
    return {
      points: this.repository.queryAggregated({
        tagIds,
        startMs: range.startMs,
        endMs: range.endMs
      }, bucketMs),
      aggregated: true,
      bucketMs,
      startTime: new Date(range.startMs).toISOString(),
      endTime: new Date(range.endMs).toISOString(),
      emittedAt: new Date(this.now()).toISOString()
    }
  }
}

function resolveHistoricalRange(query: HistoricalTrendQuery, now: number): { startMs: number; endMs: number } {
  if (query.preset === 'custom') {
    const startMs = Date.parse(query.startTime ?? '')
    const endMs = Date.parse(query.endTime ?? '')
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
      throw new Error('Custom trend range requires valid startTime and endTime.')
    }

    return {
      startMs,
      endMs
    }
  }

  if (query.preset === 'last1h') {
    return {
      startMs: now - 60 * 60 * 1000,
      endMs: now
    }
  }

  if (query.preset === 'last8h') {
    return {
      startMs: now - 8 * 60 * 60 * 1000,
      endMs: now
    }
  }

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return {
    startMs: today.getTime(),
    endMs: now
  }
}

function normalizeMaxPoints(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_HISTORICAL_TREND_MAX_POINTS_PER_TAG
  }

  return Math.max(1, Math.min(DEFAULT_HISTORICAL_TREND_MAX_POINTS_PER_TAG, Math.floor(value)))
}
