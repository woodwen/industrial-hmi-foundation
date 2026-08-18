import { useEffect } from 'react'
import { observer } from 'mobx-react-lite'

import type { AuditRecord, AuditResult } from '../../shared/audit'
import { PageFrame } from '../components/PageFrame'
import { AUDIT_RESULT_OPTIONS, type AuditResultFilter } from '../viewmodels/AuditLogViewModel'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const AuditLogPage = observer(() => {
  const { app, auditLog } = useViewModels()

  useEffect(() => {
    void auditLog.initialize()
  }, [auditLog])

  return (
    <PageFrame
      title={app.t('navigation.auditLog')}
      description={app.t('audit.description')}
      eyebrow="Audit"
    >
      {!auditLog.canRead ? (
        <p className="inline-error" role="alert">当前用户没有审计日志查询权限。</p>
      ) : null}
      {auditLog.error ? (
        <p className="inline-error" role="alert">{auditLog.error.message}</p>
      ) : null}

      <section className="device-panel" aria-labelledby="audit-filter-title">
        <div className="device-panel-heading">
          <div>
            <h3 id="audit-filter-title">Audit Log</h3>
            <p>{auditLog.rows.length} rows</p>
          </div>
          <div className="device-toolbar">
            <button
              type="button"
              className="secondary-action"
              disabled={!auditLog.canPreviousPage}
              onClick={() => {
                void auditLog.previousPage()
              }}
            >
              Previous
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={!auditLog.canNextPage}
              onClick={() => {
                void auditLog.nextPage()
              }}
            >
              Next
            </button>
            <button
              type="button"
              className="primary-action"
              disabled={!auditLog.canRead || auditLog.isQuerying}
              onClick={() => {
                void auditLog.query()
              }}
            >
              Query
            </button>
          </div>
        </div>

        <div className="filter-grid">
          <label>
            <span>Start Time</span>
            <input
              type="datetime-local"
              value={auditLog.startTime}
              disabled={!auditLog.canRead}
              onChange={(event) => auditLog.setStartTime(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>End Time</span>
            <input
              type="datetime-local"
              value={auditLog.endTime}
              disabled={!auditLog.canRead}
              onChange={(event) => auditLog.setEndTime(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>User</span>
            <input
              value={auditLog.userFilter}
              disabled={!auditLog.canRead}
              onChange={(event) => auditLog.setUserFilter(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Action</span>
            <input
              value={auditLog.actionFilter}
              disabled={!auditLog.canRead}
              onChange={(event) => auditLog.setActionFilter(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Target</span>
            <input
              value={auditLog.targetFilter}
              disabled={!auditLog.canRead}
              onChange={(event) => auditLog.setTargetFilter(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>Result</span>
            <select
              value={auditLog.resultFilter}
              disabled={!auditLog.canRead}
              onChange={(event) => auditLog.setResultFilter(toAuditResultFilter(event.currentTarget.value))}
            >
              <option value="all">All</option>
              {AUDIT_RESULT_OPTIONS.map((result) => (
                <option value={result} key={result}>{result}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="data-table" role="table" aria-label="Audit log">
          <div role="row" className="data-table-row audit-table-row data-table-header">
            <span role="columnheader">Time</span>
            <span role="columnheader">User</span>
            <span role="columnheader">Action</span>
            <span role="columnheader">Target</span>
            <span role="columnheader">Result</span>
            <span role="columnheader">Old</span>
            <span role="columnheader">New</span>
          </div>
          {auditLog.hasRows ? auditLog.rows.map((row) => (
            <div role="row" className="data-table-row audit-table-row" key={row.id}>
              <span role="cell">{formatTime(row.timestamp)}</span>
              <span role="cell">{row.user}</span>
              <span role="cell">{row.action}</span>
              <span role="cell">{row.target}</span>
              <span role="cell">{row.result}</span>
              <span role="cell">{formatAuditValue(row.oldValue)}</span>
              <span role="cell">{formatNewValue(row)}</span>
            </div>
          )) : (
            <div role="row" className="data-table-row data-empty-row">
              <span role="cell">No audit records.</span>
            </div>
          )}
        </div>
      </section>
    </PageFrame>
  )
})

function toAuditResultFilter(value: string): AuditResultFilter {
  return value === 'all' || AUDIT_RESULT_OPTIONS.includes(value as AuditResult)
    ? value as AuditResultFilter
    : 'all'
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString()
}

function formatNewValue(row: AuditRecord): string {
  const steps = getRecipeDownloadStepSummary(row)
  return steps ?? formatAuditValue(row.newValue)
}

function getRecipeDownloadStepSummary(row: AuditRecord): string | null {
  if (row.action !== 'Recipe Download' || typeof row.newValue !== 'object' || row.newValue === null) {
    return null
  }

  const steps = (row.newValue as { steps?: unknown }).steps
  if (!Array.isArray(steps)) {
    return null
  }

  return steps.map((step) => {
    if (typeof step !== 'object' || step === null) {
      return null
    }

    const record = step as { parameterKey?: unknown; status?: unknown }
    return typeof record.parameterKey === 'string' && typeof record.status === 'string'
      ? `${record.parameterKey}:${record.status}`
      : null
  }).filter((item): item is string => item !== null).join(', ')
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-'
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return '[unserializable]'
  }
}
