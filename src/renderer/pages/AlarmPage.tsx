import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

const ALARM_LEVEL_OPTIONS = ['Info', 'Warning', 'High', 'Critical'] as const
const ALARM_STATUS_OPTIONS = ['Active', 'Acknowledged', 'Recovered'] as const

export const AlarmPage = observer(() => {
  const { alarm, app } = useViewModels()

  return (
    <PageFrame
      title={app.t('navigation.alarm')}
      description={app.t('alarm.description')}
      eyebrow="Alarm Engine"
    >
      <div className="segmented-control" role="tablist" aria-label="Alarm views">
        <button
          type="button"
          className={`segmented-button ${alarm.activeTab === 'realtime' ? 'is-active' : ''}`}
          onClick={() => alarm.setActiveTab('realtime')}
        >
          Real-time Alarm
        </button>
        <button
          type="button"
          className={`segmented-button ${alarm.activeTab === 'history' ? 'is-active' : ''}`}
          onClick={() => alarm.setActiveTab('history')}
        >
          History Alarm
        </button>
      </div>

      {alarm.error ? (
        <p className="inline-error" role="alert">{alarm.error.message}</p>
      ) : null}

      {alarm.activeTab === 'realtime' ? (
        <section className="device-panel" aria-labelledby="realtime-alarm-title">
          <div className="device-panel-heading">
            <div>
              <h3 id="realtime-alarm-title">Real-time Alarm</h3>
              <p>Current plant alarm list.</p>
            </div>
            <span>{alarm.realtimeRows.length} rows</span>
          </div>

          <div className="alarm-table" role="table" aria-label="Real-time Alarm">
            <div role="row" className="alarm-table-row alarm-table-header">
              <span role="columnheader">Level</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Time</span>
              <span role="columnheader">Tag</span>
              <span role="columnheader">Message</span>
              <span role="columnheader">Acknowledge User</span>
              <span role="columnheader">Action</span>
            </div>
            {alarm.hasRealtimeRows ? alarm.realtimeRows.map((row) => (
              <div role="row" className="alarm-table-row" key={row.id}>
                <span role="cell" className={`alarm-level alarm-level-${row.level.toLowerCase()}`}>{row.level}</span>
                <span role="cell">{row.status}</span>
                <span role="cell">{formatTime(row.triggerTime)}</span>
                <span role="cell">{row.tagId}</span>
                <span role="cell">{row.message}</span>
                <span role="cell">{row.acknowledgeUser ?? '-'}</span>
                <span role="cell">
                  <button
                    type="button"
                    className="secondary-action table-action"
                    disabled={alarm.isAcknowledging || Boolean(row.acknowledgeTime)}
                    onClick={() => {
                      void alarm.acknowledge(row.id)
                    }}
                  >
                    Acknowledge
                  </button>
                </span>
              </div>
            )) : (
              <div role="row" className="alarm-table-row alarm-empty-row">
                <span role="cell">No real-time alarms.</span>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="device-panel" aria-labelledby="history-alarm-title">
          <div className="device-panel-heading">
            <div>
              <h3 id="history-alarm-title">History Alarm</h3>
              <p>Persisted alarm occurrences.</p>
            </div>
            <span>{alarm.historyRows.length} rows</span>
          </div>

          <div className="filter-grid">
            <label>
              <span>Level</span>
              <select value={alarm.levelFilter} onChange={(event) => alarm.setLevelFilter(toAlarmLevelFilter(event.currentTarget.value))}>
                <option value="all">All</option>
                {ALARM_LEVEL_OPTIONS.map((level) => (
                  <option value={level} key={level}>{level}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={alarm.statusFilter} onChange={(event) => alarm.setStatusFilter(toAlarmStatusFilter(event.currentTarget.value))}>
                <option value="all">All</option>
                {ALARM_STATUS_OPTIONS.map((status) => (
                  <option value={status} key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Tag</span>
              <input value={alarm.tagFilter} onChange={(event) => alarm.setTagFilter(event.currentTarget.value)} />
            </label>
            <label>
              <span>Acknowledge User</span>
              <input
                value={alarm.acknowledgeUserFilter}
                onChange={(event) => alarm.setAcknowledgeUserFilter(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>Start Time</span>
              <input
                type="datetime-local"
                value={alarm.startTime}
                onChange={(event) => alarm.setStartTime(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>End Time</span>
              <input
                type="datetime-local"
                value={alarm.endTime}
                onChange={(event) => alarm.setEndTime(event.currentTarget.value)}
              />
            </label>
            <button
              type="button"
              className="primary-action"
              disabled={alarm.isQueryingHistory}
              onClick={() => {
                void alarm.queryHistory()
              }}
            >
              Query
            </button>
          </div>

          <div className="alarm-table" role="table" aria-label="History Alarm">
            <div role="row" className="alarm-table-row alarm-history-row alarm-table-header">
              <span role="columnheader">Level</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Trigger Time</span>
              <span role="columnheader">Recover Time</span>
              <span role="columnheader">Tag</span>
              <span role="columnheader">Trigger Value</span>
              <span role="columnheader">Acknowledge User</span>
            </div>
            {alarm.hasHistoryRows ? alarm.historyRows.map((row) => (
              <div role="row" className="alarm-table-row alarm-history-row" key={row.id}>
                <span role="cell" className={`alarm-level alarm-level-${row.level.toLowerCase()}`}>{row.level}</span>
                <span role="cell">{row.status}</span>
                <span role="cell">{formatTime(row.triggerTime)}</span>
                <span role="cell">{row.recoverTime ? formatTime(row.recoverTime) : '-'}</span>
                <span role="cell">{row.tagId}</span>
                <span role="cell">{String(row.triggerValue ?? '-')}</span>
                <span role="cell">{row.acknowledgeUser ?? '-'}</span>
              </div>
            )) : (
              <div role="row" className="alarm-table-row alarm-empty-row">
                <span role="cell">No alarm history records.</span>
              </div>
            )}
          </div>
        </section>
      )}
    </PageFrame>
  )
})

function formatTime(value: string): string {
  return new Date(value).toLocaleString()
}

function toAlarmLevelFilter(value: string): 'all' | typeof ALARM_LEVEL_OPTIONS[number] {
  if (value === 'all' || ALARM_LEVEL_OPTIONS.some((level) => level === value)) {
    return value as 'all' | typeof ALARM_LEVEL_OPTIONS[number]
  }

  return 'all'
}

function toAlarmStatusFilter(value: string): 'all' | typeof ALARM_STATUS_OPTIONS[number] {
  if (value === 'all' || ALARM_STATUS_OPTIONS.some((status) => status === value)) {
    return value as 'all' | typeof ALARM_STATUS_OPTIONS[number]
  }

  return 'all'
}
