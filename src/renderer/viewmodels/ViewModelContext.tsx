import { createContext, type PropsWithChildren, useContext, useState } from 'react'

import { createRootViewModel, type RootViewModel } from './RootViewModel'

const ViewModelContext = createContext<RootViewModel | null>(null)

interface ViewModelProviderProps extends PropsWithChildren {
  value?: RootViewModel
}

export function ViewModelProvider({ children, value }: ViewModelProviderProps): JSX.Element {
  const [rootViewModel] = useState(() => value ?? createRootViewModel())

  return (
    <ViewModelContext.Provider value={rootViewModel}>
      {children}
    </ViewModelContext.Provider>
  )
}

export function useViewModels(): RootViewModel {
  const context = useContext(ViewModelContext)
  if (!context) {
    throw new Error('ViewModelProvider is missing.')
  }

  return context
}
