import { Dialog } from '../components/Dialog'
import { MarkdownDocument } from './MarkdownDocument'
import { projectManualContent } from './project-manual'

interface ProjectManualDialogProps {
  open: boolean
  title: string
  closeLabel: string
  emptyLabel: string
  onClose: () => void
}

export function ProjectManualDialog({
  open,
  title,
  closeLabel,
  emptyLabel,
  onClose
}: ProjectManualDialogProps): JSX.Element | null {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      closeLabel={closeLabel}
      className="manual-dialog project-manual-dialog"
      footer={(
        <button className="primary-button" type="button" onClick={onClose}>
          {closeLabel}
        </button>
      )}
    >
      <MarkdownDocument content={projectManualContent} emptyLabel={emptyLabel} />
    </Dialog>
  )
}
