import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const DevicePage = observer(() => {
  const { app, device } = useViewModels()

  return (
    <PageFrame
      title={app.t('navigation.device')}
      description={app.t(device.descriptionKey)}
      eyebrow={app.t('common.moduleFrame')}
    >
      <section className="device-panel" aria-labelledby="device-connection-title">
        <div className="device-panel-heading">
          <div>
            <h3 id="device-connection-title">{app.t('device.connection.title')}</h3>
            <p>{device.endpointLabel}</p>
          </div>
          <span className={`status-pill status-${device.status.connectionStatus.toLowerCase()}`}>
            {app.t(device.connectionStatusKey)}
          </span>
        </div>

        <div className="device-toolbar" aria-label={app.t('device.actions.aria')}>
          <button
            type="button"
            className="primary-action"
            disabled={device.isBusy || device.isConnected}
            onClick={() => {
              void device.connect()
            }}
          >
            {app.t('device.actions.connect')}
          </button>
          <button
            type="button"
            className="secondary-action"
            disabled={device.isBusy || !device.isConnected}
            onClick={() => {
              void device.disconnect()
            }}
          >
            {app.t('device.actions.disconnect')}
          </button>
          <button
            type="button"
            className="secondary-action"
            disabled={device.isBusy}
            onClick={() => {
              void device.refreshStatus()
            }}
          >
            {app.t('device.actions.refreshStatus')}
          </button>
          <button
            type="button"
            className="secondary-action"
            disabled={device.isBusy || !device.isConnected}
            onClick={() => {
              void device.readConfiguredPoints()
            }}
          >
            {app.t('device.actions.readValues')}
          </button>
        </div>

        <dl className="device-status-grid">
          <div>
            <dt>{app.t('device.status.deviceName')}</dt>
            <dd>{device.status.name}</dd>
          </div>
          <div>
            <dt>{app.t('device.status.protocol')}</dt>
            <dd>Modbus TCP</dd>
          </div>
          <div>
            <dt>{app.t('device.status.lastSuccess')}</dt>
            <dd>{device.status.lastSuccessfulAt ?? '-'}</dd>
          </div>
          <div>
            <dt>{app.t('device.status.lastError')}</dt>
            <dd>{device.status.lastError?.message ?? '-'}</dd>
          </div>
        </dl>

        {device.operationMessageKey ? (
          <p className="operation-message">{app.t(device.operationMessageKey)}</p>
        ) : null}
        {device.statusErrorMessage ? (
          <p className="inline-error" role="alert">{device.statusErrorMessage}</p>
        ) : null}
      </section>

      <section className="device-panel" aria-labelledby="tag-monitor-title">
        <div className="device-panel-heading">
          <div>
            <h3 id="tag-monitor-title">{app.t('device.tagMonitor.title')}</h3>
            <p>{app.t('device.tagMonitor.source')}</p>
          </div>
          <span>{app.t('device.tagMonitor.realtime')}</span>
        </div>
        <div className="tag-monitor-list" role="table" aria-label={app.t('device.tagMonitor.title')}>
          <div role="row" className="tag-monitor-row tag-monitor-header">
            <span role="columnheader">{app.t('device.tagMonitor.name')}</span>
            <span role="columnheader">{app.t('device.tagMonitor.value')}</span>
            <span role="columnheader">{app.t('device.tagMonitor.unit')}</span>
            <span role="columnheader">{app.t('device.tagMonitor.quality')}</span>
            <span role="columnheader">{app.t('device.tagMonitor.timestamp')}</span>
          </div>
          {device.tagMonitorRows.map((row) => (
            <div role="row" className="tag-monitor-row" key={row.tagId}>
              <span role="cell">{row.name}</span>
              <span role="cell">{row.value}</span>
              <span role="cell">{row.unit || '-'}</span>
              <span role="cell" className={`quality-text quality-${row.quality.toLowerCase()}`}>{row.quality}</span>
              <span role="cell">{row.timestamp ?? '-'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="device-grid" aria-label={app.t('device.values.title')}>
        <div className="device-panel">
          <div className="device-panel-heading">
            <h3>{app.t('device.values.title')}</h3>
            <span>{app.t('device.values.manual')}</span>
          </div>
          <div className="device-value-list" role="table" aria-label={app.t('device.values.title')}>
            <div role="row" className="device-value-row device-value-header">
              <span role="columnheader">{app.t('device.values.point')}</span>
              <span role="columnheader">{app.t('device.values.address')}</span>
              <span role="columnheader">{app.t('device.values.value')}</span>
              <span role="columnheader">{app.t('device.values.raw')}</span>
            </div>
            {device.valueRows.map((row) => (
              <div role="row" className="device-value-row" key={row.pointId}>
                <span role="cell">{row.label}</span>
                <span role="cell">{row.referenceAddress}</span>
                <span role="cell">{row.value}</span>
                <span role="cell">{row.rawValues}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="device-panel">
          <div className="device-panel-heading">
            <h3>{app.t('device.write.title')}</h3>
            <span>{app.t('device.write.allowedOnly')}</span>
          </div>

          <label className="field-row">
            <span>{app.t('device.write.targetTemperature')}</span>
            <input
              type="number"
              min="20"
              max="90"
              step="0.1"
              value={device.targetTemperatureInput}
              disabled={!device.isConnected || device.writingPointId === 'targetTemperature'}
              onChange={(event) => device.setTargetTemperatureInput(event.currentTarget.value)}
            />
            <button
              type="button"
              className="secondary-action"
              disabled={!device.isConnected || device.writingPointId !== null}
              onClick={() => {
                void device.writeTargetTemperature()
              }}
            >
              {app.t('device.write.apply')}
            </button>
          </label>

          <label className="field-row">
            <span>{app.t('device.write.manualRpm')}</span>
            <input
              type="number"
              min="0"
              max="1800"
              step="1"
              value={device.manualMotorRpmInput}
              disabled={!device.isConnected || device.writingPointId === 'manualMotorRpmSetpoint'}
              onChange={(event) => device.setManualMotorRpmInput(event.currentTarget.value)}
            />
            <button
              type="button"
              className="secondary-action"
              disabled={!device.isConnected || device.writingPointId !== null}
              onClick={() => {
                void device.writeManualMotorRpm()
              }}
            >
              {app.t('device.write.apply')}
            </button>
          </label>
        </div>
      </section>

      <section className="device-grid" aria-label={app.t('device.controls.title')}>
        <div className="device-panel">
          <div className="device-panel-heading">
            <h3>{app.t('device.controls.title')}</h3>
            <span>{app.t('device.controls.coils')}</span>
          </div>
          <div className="coil-control-list">
            {device.coilControls.map((control) => (
              <label className="coil-control-row" key={control.pointId}>
                <input
                  type="checkbox"
                  checked={control.checked}
                  disabled={control.disabled}
                  onChange={(event) => {
                    void device.writeCoil(control.pointId, event.currentTarget.checked)
                  }}
                />
                <span>{control.label}</span>
                <small>{control.referenceAddress}</small>
              </label>
            ))}
          </div>
        </div>

        <div className="device-panel">
          <div className="device-panel-heading">
            <h3>{app.t('device.feedback.title')}</h3>
            <span>{app.t('device.values.manual')}</span>
          </div>
          <div className="device-value-list compact" role="table" aria-label={app.t('device.feedback.title')}>
            {device.feedbackRows.map((row) => (
              <div role="row" className="device-value-row" key={row.pointId}>
                <span role="cell">{row.label}</span>
                <span role="cell">{row.referenceAddress}</span>
                <span role="cell">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageFrame>
  )
})
