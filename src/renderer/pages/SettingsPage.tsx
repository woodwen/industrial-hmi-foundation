import { observer } from 'mobx-react-lite'

import type { DeviceProtocolKind } from '../../shared/hmi-api'
import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const SettingsPage = observer(() => {
  const { app, device } = useViewModels()

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
    </PageFrame>
  )
})
