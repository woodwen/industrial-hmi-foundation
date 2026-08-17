import React from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ViewModelProvider } from './viewmodels/ViewModelContext'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Renderer root element was not found.')
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ViewModelProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ViewModelProvider>
  </React.StrictMode>
)
