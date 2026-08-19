import { observer } from 'mobx-react-lite'

import type { TrendPoint, TrendRangePreset } from '../../shared/trend'
import { PageFrame } from '../components/PageFrame'
import {
  DEFAULT_TREND_TAG_IDS,
  TREND_TAG_LABELS,
  type TrendMode
} from '../viewmodels/TrendViewModel'
import { useViewModels } from '../viewmodels/ViewModelContext'

const TREND_COLORS: Record<string, string> = {
  currentTemperature: '#2563eb',
  currentLevel: '#0f766e',
  currentPressure: '#b45309',
  motorRpm: '#7c3aed'
}
const TREND_RANGE_OPTIONS = ['last1h', 'last8h', 'today', 'custom'] as const

export const TrendPage = observer(() => {
  const { app, trend } = useViewModels()

  return (
    <PageFrame
      title={app.t('navigation.trend')}
      description={app.t('trend.description')}
      eyebrow="Trend Analysis"
    >
      {trend.error ? (
        <p className="inline-error" role="alert">{trend.error.message}</p>
      ) : null}

      <section className="device-panel" aria-labelledby="trend-controls-title">
        <div className="device-panel-heading">
          <div>
            <h3 id="trend-controls-title">Trend Controls</h3>
            <p>Temperature, Level, Pressure, and RPM.</p>
          </div>
          <span>{trend.mode === 'realtime' ? 'Ring Buffer' : trend.historicalResult?.aggregated ? 'Aggregated' : 'Raw'}</span>
        </div>

        <div className="segmented-control" role="tablist" aria-label="Trend modes">
          {(['realtime', 'historical'] as const).map((mode) => (
            <button
              type="button"
              className={`segmented-button ${trend.mode === mode ? 'is-active' : ''}`}
              key={mode}
              onClick={() => trend.setMode(mode)}
            >
              {mode === 'realtime' ? 'Real-time' : 'Historical'}
            </button>
          ))}
        </div>

        <div className="trend-tag-controls">
          {DEFAULT_TREND_TAG_IDS.map((tagId) => (
            <label className="trend-tag-option" key={tagId}>
              <input
                type="checkbox"
                checked={trend.selectedTagIds.has(tagId)}
                onChange={() => trend.toggleTag(tagId)}
              />
              <span className="trend-swatch" style={{ background: TREND_COLORS[tagId] }} />
              <span>{TREND_TAG_LABELS[tagId]}</span>
            </label>
          ))}
        </div>

        {trend.mode === 'historical' ? (
          <div className="filter-grid">
            <label>
              <span>Range</span>
              <select value={trend.preset} onChange={(event) => trend.setPreset(toTrendPreset(event.currentTarget.value))}>
                <option value="last1h">Last 1 hour</option>
                <option value="last8h">Last 8 hours</option>
                <option value="today">Today</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label>
              <span>Start Time</span>
              <input
                type="datetime-local"
                value={trend.customStartTime}
                disabled={trend.preset !== 'custom'}
                onChange={(event) => trend.setCustomStartTime(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>End Time</span>
              <input
                type="datetime-local"
                value={trend.customEndTime}
                disabled={trend.preset !== 'custom'}
                onChange={(event) => trend.setCustomEndTime(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              className="primary-action"
              disabled={trend.isQueryingHistorical}
              onClick={() => {
                void trend.queryHistorical()
              }}
            >
              Query
            </button>
          </div>
        ) : null}
      </section>

      <section className="device-panel" aria-labelledby="trend-chart-title">
        <div className="device-panel-heading">
          <div>
            <h3 id="trend-chart-title">{trend.mode === 'realtime' ? 'Real-time Trend' : 'Historical Trend'}</h3>
            <p>{trend.mode === 'realtime' ? 'Live process data.' : 'Persisted historian data.'}</p>
          </div>
          <span>{trend.hasVisiblePoints ? 'Data Available' : 'No Data'}</span>
        </div>
        <TrendChart
          mode={trend.mode}
          pointsByTag={trend.visiblePoints}
          selectedTagIds={trend.selectedTags}
        />
      </section>
    </PageFrame>
  )
})

function TrendChart({
  mode,
  pointsByTag,
  selectedTagIds
}: {
  mode: TrendMode
  pointsByTag: ReadonlyMap<string, TrendPoint[]>
  selectedTagIds: readonly string[]
}) {
  const width = 800
  const height = 280
  const padding = 34
  const series = selectedTagIds.map((tagId) => ({
    tagId,
    points: pointsByTag.get(tagId) ?? []
  }))
  const allPoints = series.flatMap((entry) => entry.points)

  if (allPoints.length === 0) {
    return (
      <div className="trend-chart-empty">
        <span>{mode === 'realtime' ? 'Waiting for samples.' : 'No points in selected range.'}</span>
      </div>
    )
  }

  const timeValues = allPoints.map((point) => Date.parse(point.timestamp)).filter(Number.isFinite)
  const valueValues = allPoints.map((point) => point.value)
  const minTime = Math.min(...timeValues)
  const maxTime = Math.max(...timeValues)
  const minValue = Math.min(...valueValues)
  const maxValue = Math.max(...valueValues)
  const timeSpan = Math.max(1, maxTime - minTime)
  const valueSpan = Math.max(1, maxValue - minValue)

  const toX = (point: TrendPoint) => padding + ((Date.parse(point.timestamp) - minTime) / timeSpan) * (width - padding * 2)
  const toY = (point: TrendPoint) => height - padding - ((point.value - minValue) / valueSpan) * (height - padding * 2)

  return (
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
      {[0, 1, 2, 3, 4].map((line) => {
        const y = padding + ((height - padding * 2) / 4) * line
        return <line className="trend-grid-line" x1={padding} x2={width - padding} y1={y} y2={y} key={line} />
      })}
      {series.map(({ tagId, points }) => {
        if (points.length === 0) {
          return null
        }

        const path = points.map((point, index) => (
          `${index === 0 ? 'M' : 'L'} ${toX(point).toFixed(1)} ${toY(point).toFixed(1)}`
        )).join(' ')

        return (
          <g key={tagId}>
            <path className="trend-path" d={path} stroke={TREND_COLORS[tagId]} />
            {points.filter((point) => point.quality !== 'Good').map((point) => (
              <circle
                className={`trend-quality-point quality-${point.quality.toLowerCase()}`}
                cx={toX(point)}
                cy={toY(point)}
                r="4"
                key={`${tagId}-${point.timestamp}`}
              />
            ))}
          </g>
        )
      })}
      <text className="trend-axis-label" x={padding} y={20}>{maxValue.toFixed(1)}</text>
      <text className="trend-axis-label" x={padding} y={height - padding + 16}>{minValue.toFixed(1)}</text>
      <text className="trend-axis-label" x={padding} y={height - 8}>{formatAxisTime(minTime)}</text>
      <text className="trend-axis-label" x={width - padding - 92} y={height - 8}>{formatAxisTime(maxTime)}</text>
    </svg>
  )
}

function formatAxisTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString()
}

function toTrendPreset(value: string): TrendRangePreset {
  if (TREND_RANGE_OPTIONS.some((preset) => preset === value)) {
    return value as TrendRangePreset
  }

  return 'last1h'
}
