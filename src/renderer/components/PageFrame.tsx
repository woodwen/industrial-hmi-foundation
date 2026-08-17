import type { PropsWithChildren } from 'react'

interface PageFrameProps extends PropsWithChildren {
  title: string
  description: string
}

export function PageFrame({ title, description, children }: PageFrameProps): JSX.Element {
  return (
    <article className="page-frame">
      <header className="page-header">
        <div>
          <span className="eyebrow">Module Frame</span>
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </header>
      <div className="page-content">{children}</div>
    </article>
  )
}
