import { Component, type ErrorInfo, type PropsWithChildren } from 'react'

import { createAppError } from '../../shared/app-error'

interface ErrorBoundaryState {
  errorMessage: string | null
}

export class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    errorMessage: null
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      errorMessage: error.message
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const report = createAppError({
      code: 'RENDERER_UNHANDLED_ERROR',
      message: error.message,
      detail: error.stack,
      source: 'renderer:error-boundary',
      cause: errorInfo.componentStack
    })

    void window.hmi.errors.report({
      ...report,
      componentStack: errorInfo.componentStack ?? undefined
    })
  }

  render(): React.ReactNode {
    if (this.state.errorMessage) {
      return (
        <main className="fatal-error">
          <h1>Renderer Error</h1>
          <p>{this.state.errorMessage}</p>
        </main>
      )
    }

    return this.props.children
  }
}
