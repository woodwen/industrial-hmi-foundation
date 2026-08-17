import changelogMarkdown from '../../../CHANGELOG.md?raw'

import { Dialog } from '../components/Dialog'
import { parseChangelog } from './changelog'

const changelogEntries = parseChangelog(changelogMarkdown)

interface VersionUpdatesDialogProps {
  open: boolean
  title: string
  note: string
  emptyLabel: string
  closeLabel: string
  onClose: () => void
}

export function VersionUpdatesDialog({
  open,
  title,
  note,
  emptyLabel,
  closeLabel,
  onClose
}: VersionUpdatesDialogProps): JSX.Element | null {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      closeLabel={closeLabel}
      className="version-dialog"
      footer={(
        <button className="primary-button" type="button" onClick={onClose}>
          {closeLabel}
        </button>
      )}
    >
      <p className="dialog-note">{note}</p>
      {changelogEntries.length > 0 ? (
        <div className="version-list">
          {changelogEntries.map((entry) => (
            <section className="version-entry" id={entry.id} key={entry.id}>
              <header>
                <h3>{entry.title}</h3>
                {entry.date ? <span>{entry.date}</span> : null}
              </header>
              {entry.groups.map((group) => (
                <div className="version-group" key={`${entry.id}-${group.title}`}>
                  <h4>{group.title}</h4>
                  <ul>
                    {group.items.map((item) => (
                      <li key={`${entry.id}-${group.title}-${item.text}`}>{item.text}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <p className="empty-state">{emptyLabel}</p>
      )}
    </Dialog>
  )
}
