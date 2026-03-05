import { useMemo, useState } from 'react'
import { FolderPlus, Pause, Play, X } from 'lucide-react'

const EMPTY_STATUS = {
  running: false,
  cancelling: false,
  message: ''
}

function FolderSettingsPanel({
  folders,
  isPaused,
  onPauseIndexing,
  onPickAndAddFolder,
  onRemoveFolder,
  onResumeIndexing,
  status
}) {
  const [feedback, setFeedback] = useState(null)
  const [busyAction, setBusyAction] = useState('')

  const normalizedStatus = useMemo(
    () => ({
      ...EMPTY_STATUS,
      ...(status || {})
    }),
    [status]
  )

  const runAction = async (actionName, callback) => {
    setFeedback(null)
    setBusyAction(actionName)

    const result = await callback()

    setBusyAction('')

    if (!result?.success) {
      setFeedback({ type: 'error', message: result?.message || 'Action failed.' })
      return
    }

    setFeedback({ type: 'success', message: result?.message || 'Done.' })
  }

  const addWithPicker = async () => {
    await runAction('add-picker', async () => {
      return onPickAndAddFolder()
    })
  }

  const removeFolder = async (folderPath) => {
    await runAction(`remove:${folderPath}`, async () => {
      return onRemoveFolder(folderPath)
    })
  }

  const toggleIndexing = async () => {
    const actionName = normalizedStatus.running ? 'pause-indexing' : 'resume-indexing'
    await runAction(actionName, async () => {
      if (normalizedStatus.running) {
        return onPauseIndexing()
      }

      return onResumeIndexing()
    })
  }

  const isActionBusy = Boolean(busyAction)

  const indexingStateLabel = normalizedStatus.running
    ? normalizedStatus.cancelling
      ? 'Stopping'
      : 'Running'
    : isPaused
      ? 'Paused'
      : 'Idle'

  const dotClass = normalizedStatus.running
    ? 'knowledge-rail-dot-running'
    : isPaused
      ? 'knowledge-rail-dot-paused'
      : 'knowledge-rail-dot-idle'

  return (
    <aside className="knowledge-rail">
      <div className="knowledge-rail-header">
        <p className="knowledge-rail-title">Knowledge</p>
        <div className="knowledge-rail-status">
          <span className={`knowledge-rail-dot ${dotClass}`} aria-hidden="true" />
          <p className="knowledge-rail-state">{indexingStateLabel}</p>
        </div>
      </div>

      <ul className="knowledge-folder-list">
        {folders.length ? (
          folders.map((folderPath) => {
            const parts = folderPath.replace(/\/+$/, '').split('/')
            const name = parts[parts.length - 1] || folderPath
            return (
              <li className="knowledge-folder-row" key={folderPath}>
                <div className="knowledge-folder-body">
                  <p className="knowledge-folder-name" title={folderPath}>
                    {name}
                  </p>
                  <p className="knowledge-folder-path" title={folderPath}>
                    {folderPath}
                  </p>
                </div>
                <button
                  aria-label={`Remove ${name}`}
                  className="knowledge-folder-remove"
                  disabled={isActionBusy}
                  onClick={() => void removeFolder(folderPath)}
                  title="Remove folder"
                  type="button"
                >
                  <X size={13} />
                </button>
              </li>
            )
          })
        ) : (
          <li className="knowledge-folder-empty">No folders added yet.</li>
        )}
      </ul>

      <div className="knowledge-rail-footer">
        {feedback ? (
          <p className={`knowledge-rail-feedback knowledge-rail-feedback-${feedback.type}`}>
            {feedback.message}
          </p>
        ) : null}

        <button
          className="knowledge-rail-add"
          disabled={isActionBusy}
          onClick={addWithPicker}
          type="button"
        >
          <FolderPlus size={14} />
          {busyAction === 'add-picker' ? 'Opening…' : 'Add folder'}
        </button>

        <button
          className={`knowledge-rail-toggle${
            normalizedStatus.running ? ' knowledge-rail-toggle-pause' : ''
          }`}
          disabled={isActionBusy || normalizedStatus.cancelling}
          onClick={toggleIndexing}
          type="button"
        >
          {normalizedStatus.running ? <Pause size={13} /> : <Play size={13} />}
          {busyAction === 'pause-indexing'
            ? 'Pausing…'
            : busyAction === 'resume-indexing'
              ? 'Starting…'
              : normalizedStatus.running
                ? 'Pause indexing'
                : 'Start indexing'}
        </button>
      </div>
    </aside>
  )
}

export default FolderSettingsPanel
