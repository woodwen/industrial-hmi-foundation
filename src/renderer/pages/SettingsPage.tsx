import { observer } from 'mobx-react-lite'

import type { DeviceProtocolKind } from '../../shared/hmi-api'
import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const SettingsPage = observer(() => {
  const { app, device, simulators } = useViewModels()

  return (
    <PageFrame
      title={app.t('navigation.settings')}
      description={app.t('settings.description')}
      eyebrow={app.t('common.moduleFrame')}
    >
      <div className="settings-list">
        <label>
          <span>{app.t('settings.protocol')}</span>
          <select
            value={device.selectedProtocol}
            disabled={device.isBusy}
            onChange={(event) => device.setSelectedProtocol(event.currentTarget.value as DeviceProtocolKind)}
          >
            <option value="modbusTcp">{app.t('settings.protocol.modbusTcp')}</option>
            <option value="opcUa">{app.t('settings.protocol.opcUa')}</option>
          </select>
        </label>
        {device.selectedProtocol === 'modbusTcp' ? (
          <>
            <label>
              <span>{app.t('settings.modbusHost')}</span>
              <input
                type="text"
                value={device.modbusHostInput}
                disabled={device.isBusy}
                onChange={(event) => device.setModbusHostInput(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>{app.t('settings.modbusPort')}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={device.modbusPortInput}
                disabled={device.isBusy}
                onChange={(event) => device.setModbusPortInput(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>{app.t('settings.modbusUnitId')}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={device.modbusUnitIdInput}
                disabled={device.isBusy}
                onChange={(event) => device.setModbusUnitIdInput(event.currentTarget.value)}
              />
            </label>
          </>
        ) : (
          <label>
            <span>{app.t('settings.opcUaEndpoint')}</span>
            <input
              type="text"
              value={device.opcUaEndpointInput}
              disabled={device.isBusy}
              onChange={(event) => device.setOpcUaEndpointInput(event.currentTarget.value)}
            />
          </label>
        )}
        <button
          type="button"
          className="secondary-action"
          disabled={!device.canUpdateConfig}
          onClick={() => {
            void device.updateProtocolConfig()
          }}
        >
          {app.t('settings.applyProtocol')}
        </button>
        <label>
          <span>{app.t('settings.applicationLogs')}</span>
          <input type="checkbox" checked readOnly />
        </label>
        <label>
          <span>{app.t('settings.communicationLogs')}</span>
          <input type="checkbox" checked readOnly />
        </label>
        <label>
          <span>{app.t('settings.errorReporting')}</span>
          <input type="checkbox" checked readOnly />
        </label>
      </div>

      <section className="device-panel" aria-labelledby="simulator-settings-title">
        <div className="device-panel-heading">
          <div>
            <h3 id="simulator-settings-title">{app.t('simulator.title')}</h3>
            <p>{app.t('simulator.description')}</p>
          </div>
          <span>{app.t('simulator.managedHint')}</span>
        </div>

        <div className="simulator-list" role="table" aria-label={app.t('simulator.title')}>
          <div role="row" className="simulator-row simulator-header">
            <span role="columnheader">{app.t('simulator.protocol')}</span>
            <span role="columnheader">{app.t('simulator.endpoint')}</span>
            <span role="columnheader">{app.t('simulator.status')}</span>
            <span role="columnheader">{app.t('simulator.managed')}</span>
            <span role="columnheader">{app.t('simulator.actions')}</span>
          </div>
          {simulators.rows.map((row) => (
            <div role="row" className="simulator-row" key={row.kind}>
              <span role="cell">{row.protocolLabel}</span>
              <span role="cell">{row.endpointLabel}</span>
              <span role="cell">
                <span className={`status-pill simulator-status-${row.status.toLowerCase()}`}>
                  {app.t(row.statusKey)}
                </span>
              </span>
              <span role="cell">{app.t(row.managedLabelKey)}</span>
              <span role="cell" className="simulator-actions">
                <button
                  type="button"
                  className="primary-action"
                  disabled={!row.canStart}
                  onClick={() => {
                    void simulators.start(row.kind)
                  }}
                >
                  {app.t('simulator.start')}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={!row.canStop}
                  onClick={() => {
                    void simulators.stop(row.kind)
                  }}
                >
                  {app.t('simulator.stop')}
                </button>
              </span>
              {row.errorMessage ? (
                <span role="cell" className="simulator-error">{row.errorMessage}</span>
              ) : null}
            </div>
          ))}
        </div>
        {simulators.error ? (
          <p className="inline-error" role="alert">{simulators.error.message}</p>
        ) : null}
      </section>
    </PageFrame>
  )
})
