import { Component, type ErrorInfo, type PropsWithChildren } from 'react'

import { createAppError, type AppErrorShape } from '../../shared/app-error'
import { useViewModels } from '../viewmodels/ViewModelContext'

interface ErrorBoundaryState {
  errorMessage: string | null
}

interface ErrorBoundaryProps extends PropsWithChildren {
  onError(error: Error, errorInfo: ErrorInfo): void
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    errorMessage: null
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      errorMessage: error.message
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError(error, errorInfo)
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

export function ViewModelErrorBoundary({ children }: PropsWithChildren): JSX.Element {
  const { app } = useViewModels()

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        app.reportError(createRendererErrorReport(error, errorInfo), errorInfo.componentStack ?? undefined)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

function createRendererErrorReport(error: Error, errorInfo: ErrorInfo): AppErrorShape {
  return createAppError({
    code: 'RENDERER_UNHANDLED_ERROR',
    message: error.message,
    detail: error.stack,
    source: 'renderer:error-boundary',
    cause: errorInfo.componentStack ?? undefined
  })
}
