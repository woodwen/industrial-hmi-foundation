import { PageFrame } from '../components/PageFrame'

export function TrendPage(): JSX.Element {
  return (
    <PageFrame title="Trend" description="Trend storage and queries are reserved for a later change.">
      <div className="placeholder-panel trend-grid">
        <div className="trend-line trend-line-a" />
        <div className="trend-line trend-line-b" />
        <p>No historian data source configured.</p>
      </div>
    </PageFrame>
  )
}
