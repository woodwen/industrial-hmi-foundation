import { PageFrame } from '../components/PageFrame'

export function RecipePage(): JSX.Element {
  return (
    <PageFrame title="Recipe" description="Recipe management is reserved for a later change.">
      <div className="placeholder-panel">
        <h3>No recipe workflow configured</h3>
        <p>This frame does not load, edit, validate, or download recipes.</p>
      </div>
    </PageFrame>
  )
}
