import type { PropsWithChildren } from 'react'

interface PageFrameProps extends PropsWithChildren {
  title: string
  description: string
  eyebrow: string
}

export function PageFrame({ title, description, eyebrow, children }: PageFrameProps): JSX.Element {
  return (
    <article className="page-frame">
      <header className="page-header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </header>
      <div className="page-content">{children}</div>
    </article>
  )
}
