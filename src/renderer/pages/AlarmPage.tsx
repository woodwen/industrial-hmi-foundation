import { PageFrame } from '../components/PageFrame'

export function AlarmPage(): JSX.Element {
  return (
    <PageFrame title="Alarm" description="Alarm processing is reserved for a later change.">
      <div className="placeholder-panel">
        <h3>No alarm engine configured</h3>
        <p>This frame keeps the navigation surface ready without evaluating alarm rules.</p>
      </div>
    </PageFrame>
  )
}
