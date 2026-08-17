import { PageFrame } from '../components/PageFrame'

export function SettingsPage(): JSX.Element {
  return (
    <PageFrame title="Settings" description="Application settings frame for future desktop configuration.">
      <div className="settings-list">
        <label>
          <span>Application logs</span>
          <input type="checkbox" checked readOnly />
        </label>
        <label>
          <span>Communication logs</span>
          <input type="checkbox" checked readOnly />
        </label>
        <label>
          <span>Error reporting</span>
          <input type="checkbox" checked readOnly />
        </label>
      </div>
    </PageFrame>
  )
}
