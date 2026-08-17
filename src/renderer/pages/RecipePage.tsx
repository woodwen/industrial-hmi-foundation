import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const RecipePage = observer(() => {
  const { app } = useViewModels()

  return (
    <PageFrame
      title={app.t('navigation.recipe')}
      description={app.t('recipe.description')}
      eyebrow={app.t('common.moduleFrame')}
    >
      <div className="placeholder-panel">
        <h3>{app.t('recipe.empty.title')}</h3>
        <p>{app.t('recipe.empty.body')}</p>
      </div>
    </PageFrame>
  )
})
