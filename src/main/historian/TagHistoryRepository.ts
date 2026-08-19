import type Database from 'better-sqlite3'

import type { TagQuality, TagValueData } from '../../shared/tag'
import type { AggregatedTrendPoint, TrendPoint } from '../../shared/trend'
import { decodePersistedValue, encodePersistedValue } from './value-codec'

export interface TagHistoryInput {
  tagId: string
  timestamp: string
  value: TagValueData
  quality: TagQuality
  createdAt?: string
}

export interface TagHistoryQueryInput {
  tagIds: readonly string[]
  startMs: number
  endMs: number
}

export type TagHistoryCountByTag = Record<string, number>

interface TagHistoryRowRecord {
  tag_id: string
  timestamp_ms: number
  value_type: string
  value_numeric: number | null
  value_text: string | null
  value_bool: number | null
  quality: TagQuality
}

interface AggregatedTagHistoryRecord {
  tag_id: string
  timestamp_ms: number
  avg_value: number
  min_value: number
  max_value: number
  last_value: number
  quality: TagQuality
}

interface CountRecord {
  tag_id: string
  count: number
}

export class TagHistoryRepository {
  private readonly insertStatement: Database.Statement

  constructor(private readonly db: Database.Database) {
    this.insertStatement = this.db.prepare(`
      INSERT INTO tag_history (
        tag_id,
        timestamp_ms,
        value_type,
        value_numeric,
        value_text,
        value_bool,
        quality,
        created_at_ms
      ) VALUES (
        @tagId,
        @timestampMs,
        @valueType,
        @valueNumeric,
        @valueText,
        @valueBool,
        @quality,
        @createdAtMs
      )
    `)
  }

  insertBatch(points: readonly TagHistoryInput[]): void {
    if (points.length === 0) {
      return
    }

    const insertMany = this.db.transaction((rows: readonly TagHistoryInput[]) => {
      for (const row of rows) {
        const encoded = encodePersistedValue(row.value)
        this.insertStatement.run({
          tagId: row.tagId,
          timestampMs: toEpochMs(row.timestamp),
          valueType: encoded.valueType,
          valueNumeric: encoded.valueNumeric,
          valueText: encoded.valueText,
          valueBool: encoded.valueBool,
          quality: row.quality,
          createdAtMs: toEpochMs(row.createdAt ?? row.timestamp)
        })
      }
    })

    insertMany(points)
  }

  countByTag(query: TagHistoryQueryInput): TagHistoryCountByTag {
    if (query.tagIds.length === 0) {
      return {}
    }

    const statement = this.db.prepare<Record<string, unknown>, CountRecord>(`
      SELECT tag_id, COUNT(*) AS count
      FROM tag_history
      WHERE tag_id IN (${createNamedPlaceholders('tagId', query.tagIds.length)})
        AND timestamp_ms >= @startMs
        AND timestamp_ms <= @endMs
        AND value_numeric IS NOT NULL
      GROUP BY tag_id
    `)
    const rows = statement.all(toQueryParams(query))

    return rows.reduce<TagHistoryCountByTag>((counts, row) => {
      counts[row.tag_id] = row.count
      return counts
    }, {})
  }

  queryRaw(query: TagHistoryQueryInput): TrendPoint[] {
    if (query.tagIds.length === 0) {
      return []
    }

    const statement = this.db.prepare<Record<string, unknown>, TagHistoryRowRecord>(`
      SELECT tag_id, timestamp_ms, value_type, value_numeric, value_text, value_bool, quality
      FROM tag_history
      WHERE tag_id IN (${createNamedPlaceholders('tagId', query.tagIds.length)})
        AND timestamp_ms >= @startMs
        AND timestamp_ms <= @endMs
        AND value_numeric IS NOT NULL
      ORDER BY tag_id ASC, timestamp_ms ASC
    `)

    return statement.all(toQueryParams(query)).flatMap((row) => {
      const value = decodePersistedValue(row.value_type, row.value_numeric, row.value_text, row.value_bool)
      return typeof value === 'number'
        ? [{
            tagId: row.tag_id,
            timestamp: new Date(row.timestamp_ms).toISOString(),
            value,
            quality: row.quality
          }]
        : []
    })
  }

  queryAggregated(query: TagHistoryQueryInput, bucketMs: number): AggregatedTrendPoint[] {
    if (query.tagIds.length === 0) {
      return []
    }

    const statement = this.db.prepare<Record<string, unknown>, AggregatedTagHistoryRecord>(`
      WITH bucketed AS (
        SELECT
          tag_id,
          CAST((timestamp_ms - @startMs) / @bucketMs AS INTEGER) AS bucket,
          timestamp_ms,
          value_numeric,
          quality
        FROM tag_history
        WHERE tag_id IN (${createNamedPlaceholders('tagId', query.tagIds.length)})
          AND timestamp_ms >= @startMs
          AND timestamp_ms <= @endMs
          AND value_numeric IS NOT NULL
      ),
      latest AS (
        SELECT b.tag_id, b.bucket, b.timestamp_ms, b.value_numeric
        FROM bucketed b
        INNER JOIN (
          SELECT tag_id, bucket, MAX(timestamp_ms) AS max_timestamp_ms
          FROM bucketed
          GROUP BY tag_id, bucket
        ) m
          ON b.tag_id = m.tag_id
          AND b.bucket = m.bucket
          AND b.timestamp_ms = m.max_timestamp_ms
      )
      SELECT
        b.tag_id AS tag_id,
        MIN(b.timestamp_ms) AS timestamp_ms,
        AVG(b.value_numeric) AS avg_value,
        MIN(b.value_numeric) AS min_value,
        MAX(b.value_numeric) AS max_value,
        l.value_numeric AS last_value,
        CASE
          WHEN SUM(CASE WHEN b.quality = 'Bad' THEN 1 ELSE 0 END) > 0 THEN 'Bad'
          WHEN SUM(CASE WHEN b.quality = 'Uncertain' THEN 1 ELSE 0 END) > 0 THEN 'Uncertain'
          ELSE 'Good'
        END AS quality
      FROM bucketed b
      INNER JOIN latest l
        ON b.tag_id = l.tag_id
        AND b.bucket = l.bucket
      GROUP BY b.tag_id, b.bucket, l.value_numeric
      ORDER BY b.tag_id ASC, timestamp_ms ASC
    `)

    return statement.all({
      ...toQueryParams(query),
      bucketMs
    }).map((row) => ({
      tagId: row.tag_id,
      timestamp: new Date(row.timestamp_ms).toISOString(),
      value: roundTrendValue(row.avg_value),
      min: roundTrendValue(row.min_value),
      max: roundTrendValue(row.max_value),
      last: roundTrendValue(row.last_value),
      quality: row.quality
    }))
  }
}

function toQueryParams(query: TagHistoryQueryInput): Record<string, string | number> {
  return query.tagIds.reduce<Record<string, string | number>>((params, tagId, index) => {
    params[`tagId${index}`] = tagId
    return params
  }, {
    startMs: query.startMs,
    endMs: query.endMs
  })
}

function createNamedPlaceholders(prefix: string, count: number): string {
  return Array.from({ length: count }, (_entry, index) => `@${prefix}${index}`).join(', ')
}

function toEpochMs(timestamp: string): number {
  const ms = Date.parse(timestamp)
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid history timestamp: ${timestamp}`)
  }

  return ms
}

function roundTrendValue(value: number): number {
  return Math.round(value * 1000) / 1000
}
