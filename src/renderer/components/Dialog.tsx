import type { PropsWithChildren, ReactNode } from 'react'

interface DialogProps extends PropsWithChildren {
  open: boolean
  title: string
  onClose: () => void
  closeLabel: string
  footer?: ReactNode
  className?: string
}

export function Dialog({
  open,
  title,
  onClose,
  closeLabel,
  footer,
  className,
  children
}: DialogProps): JSX.Element | null {
  if (!open) {
    return null
  }

  const dialogClassName = className ? `dialog ${className}` : 'dialog'

  return (
    <div className="dialog-backdrop">
      <section className={dialogClassName} role="dialog" aria-modal="true" aria-label={title}>
        <header className="dialog-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label={closeLabel}>
            X
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer ? <footer className="dialog-footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
