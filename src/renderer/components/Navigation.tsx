import { observer } from 'mobx-react-lite'

import { pageDefinitions } from '../viewmodels/pages'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const Navigation = observer(() => {
  const { app } = useViewModels()

  return (
    <nav className="navigation" aria-label="Primary">
      {pageDefinitions.map((page) => (
        <button
          key={page.id}
          type="button"
          className={app.activePage === page.id ? 'nav-item is-active' : 'nav-item'}
          onClick={() => app.navigate(page.id)}
        >
          <span className="nav-code">{page.shortLabel}</span>
          <span>{page.title}</span>
        </button>
      ))}
    </nav>
  )
})
