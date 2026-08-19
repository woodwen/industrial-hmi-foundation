import { useEffect } from 'react'
import { observer } from 'mobx-react-lite'

import { PageFrame } from '../components/PageFrame'
import { useViewModels } from '../viewmodels/ViewModelContext'

export const RecipePage = observer(() => {
  const { app, recipes } = useViewModels()

  useEffect(() => {
    void recipes.initialize()
  }, [recipes])

  return (
    <PageFrame
      title={app.t('navigation.recipe')}
      description={app.t('recipe.description')}
      eyebrow="Recipe Domain"
    >
      {!recipes.canRead ? (
        <p className="inline-error" role="alert">当前用户没有查看 Recipe 的权限。</p>
      ) : null}
      {recipes.error ? (
        <p className="inline-error" role="alert">{recipes.error.message}</p>
      ) : null}

      <section className="device-panel" aria-labelledby="recipe-list-title">
        <div className="device-panel-heading">
          <div>
            <h3 id="recipe-list-title">Recipe Management</h3>
            <p>{recipes.recipes.length} recipes</p>
          </div>
          <div className="device-toolbar">
            <button type="button" className="secondary-action" onClick={recipes.startNewRecipe}>
              New
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={!recipes.canWrite || recipes.selectedRecipeId === null}
              onClick={() => {
                void recipes.copySelectedRecipe()
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={!recipes.canWrite || recipes.selectedRecipeId === null}
              onClick={() => {
                void recipes.deleteSelectedRecipe()
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="primary-action"
              disabled={!recipes.canDownload || recipes.selectedRecipeId === null || recipes.isDownloading}
              onClick={() => {
                void recipes.downloadSelectedRecipe()
              }}
            >
              Download
            </button>
          </div>
        </div>

        <div className="data-table" role="table" aria-label="Recipe list">
          <div role="row" className="data-table-row recipe-table-row data-table-header">
            <span role="columnheader">Name</span>
            <span role="columnheader">Version</span>
            <span role="columnheader">Updated</span>
            <span role="columnheader">Action</span>
          </div>
          {recipes.hasRecipes ? recipes.recipes.map((recipe) => (
            <div
              role="row"
              className={`data-table-row recipe-table-row ${recipe.id === recipes.selectedRecipeId ? 'is-selected' : ''}`}
              key={recipe.id}
            >
              <span role="cell">{recipe.name}</span>
              <span role="cell">v{recipe.version}</span>
              <span role="cell">{formatTime(recipe.updatedAt)}</span>
              <span role="cell">
                <button
                  type="button"
                  className="secondary-action table-action"
                  onClick={() => recipes.loadRecipe(recipe.id)}
                >
                  Load
                </button>
              </span>
            </div>
          )) : (
            <div role="row" className="data-table-row data-empty-row">
              <span role="cell">No recipes.</span>
            </div>
          )}
        </div>
      </section>

      <section className="device-grid" aria-label="Recipe editor">
        <div className="device-panel">
          <div className="device-panel-heading">
            <div>
              <h3>Recipe Editor</h3>
              <p>{recipes.selectedRecipe ? `Loaded ${recipes.selectedRecipe.name}` : 'New recipe'}</p>
            </div>
            <button
              type="button"
              className="primary-action"
              disabled={!recipes.canSave}
              onClick={() => {
                void recipes.saveRecipe()
              }}
            >
              Save
            </button>
          </div>

          <div className="recipe-form">
            <label>
              <span>Name</span>
              <input
                value={recipes.nameInput}
                disabled={!recipes.canWrite}
                onChange={(event) => recipes.setNameInput(event.currentTarget.value)}
              />
              {recipes.getIssueForKey('name') ? <small>{recipes.getIssueForKey('name')}</small> : null}
            </label>
            <label>
              <span>Description</span>
              <textarea
                value={recipes.descriptionInput}
                disabled={!recipes.canWrite}
                onChange={(event) => recipes.setDescriptionInput(event.currentTarget.value)}
              />
            </label>
            {recipes.parameterDefinitions.map((definition) => (
              <label key={definition.key}>
                <span>{definition.label}</span>
                <input
                  type="number"
                  min={definition.min}
                  max={definition.max}
                  step={definition.key === 'targetTemperature' ? 0.1 : 1}
                  value={recipes.parameterInputs[definition.key]}
                  disabled={!recipes.canWrite}
                  onChange={(event) => recipes.setParameterInput(definition.key, event.currentTarget.value)}
                />
                <small>
                  {recipes.getIssueForKey(definition.key) ??
                    `${definition.min} - ${definition.max} ${definition.unit}`}
                </small>
              </label>
            ))}
          </div>
        </div>

        <div className="device-panel">
          <div className="device-panel-heading">
            <div>
              <h3>Download Result</h3>
              <p>{recipes.downloadResult?.status ?? 'No result'}</p>
            </div>
          </div>

          {recipes.downloadResult ? (
            <>
              <p className={recipes.downloadResult.status === 'Succeeded' ? 'operation-message' : 'inline-error'}>
                {recipes.downloadResult.message}
              </p>
              <div className="data-table" role="table" aria-label="Recipe download steps">
                <div role="row" className="data-table-row download-step-row data-table-header">
                  <span role="columnheader">Parameter</span>
                  <span role="columnheader">Value</span>
                  <span role="columnheader">Status</span>
                </div>
                {recipes.downloadResult.steps.map((step) => (
                  <div role="row" className="data-table-row download-step-row" key={step.parameterKey}>
                    <span role="cell">{step.parameterKey}</span>
                    <span role="cell">
                      {String(step.requestedValue)}
                      {step.verifiedValue !== undefined ? ` / ${String(step.verifiedValue)}` : ''}
                    </span>
                    <span role="cell">{step.status}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">No Recipe Download has been executed in this session.</p>
          )}
        </div>
      </section>
    </PageFrame>
  )
})

function formatTime(value: string): string {
  return new Date(value).toLocaleString()
}
