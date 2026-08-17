import type { LanguageCode } from '../localization/messages'
import { Dialog } from '../components/Dialog'
import { userManualByLanguage } from './manual'

interface UserManualDialogProps {
  open: boolean
  language: LanguageCode
  title: string
  closeLabel: string
  onClose: () => void
}

export function UserManualDialog({
  open,
  language,
  title,
  closeLabel,
  onClose
}: UserManualDialogProps): JSX.Element | null {
  const sections = userManualByLanguage[language]

  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      closeLabel={closeLabel}
      className="manual-dialog"
      footer={(
        <button className="primary-button" type="button" onClick={onClose}>
          {closeLabel}
        </button>
      )}
    >
      <div className="manual-layout">
        <nav className="manual-nav" aria-label={title}>
          {sections.map((section) => (
            <a href={`#${section.id}`} key={section.id}>{section.title}</a>
          ))}
        </nav>
        <div className="manual-content">
          {sections.map((section) => (
            <section className="manual-section" id={section.id} key={section.id}>
              <h3>{section.title}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <ul>
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
