import { PageFrame } from '../components/PageFrame'

export function TagManagementPage(): JSX.Element {
  return (
    <PageFrame title="Tag Management" description="Tag definitions and polling are reserved for a later change.">
      <div className="module-table" role="table" aria-label="Tag management frame">
        <div role="row" className="module-table-header">
          <span role="columnheader">Tag</span>
          <span role="columnheader">Address</span>
          <span role="columnheader">Quality</span>
        </div>
        <div role="row" className="module-table-row">
          <span role="cell">Reserved</span>
          <span role="cell">Not mapped</span>
          <span role="cell">No polling</span>
        </div>
      </div>
    </PageFrame>
  )
}
