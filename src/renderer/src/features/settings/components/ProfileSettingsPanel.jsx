import { useMemo, useState } from 'react'

const getModelLabel = (model) => {
  const provider = model?.provider ? ` (${model.provider})` : ''
  return `${model?.displayName || model?.modelId || 'Unknown model'}${provider}`
}

const normalizeName = (value) => String(value || '').trim()

function ProfileSettingsPanel({ models, onSave, user }) {
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [preferredModelId, setPreferredModelId] = useState(user?.preferredModelId || '')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const canSubmit = useMemo(() => {
    const normalizedFirstName = normalizeName(firstName)
    const normalizedLastName = normalizeName(lastName)

    return (
      normalizedFirstName !== normalizeName(user?.firstName) ||
      normalizedLastName !== normalizeName(user?.lastName) ||
      preferredModelId !== (user?.preferredModelId || '')
    )
  }, [
    firstName,
    lastName,
    preferredModelId,
    user?.firstName,
    user?.lastName,
    user?.preferredModelId
  ])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFeedback(null)

    if (!canSubmit) {
      setFeedback({ type: 'pending', message: 'No changes to save.' })
      return
    }

    setSubmitting(true)
    const result = await onSave({
      firstName: normalizeName(firstName),
      lastName: normalizeName(lastName),
      preferredModelId
    })
    setSubmitting(false)

    if (!result?.success) {
      setFeedback({
        type: 'error',
        message: result?.message || 'Failed to update profile.'
      })
      return
    }

    setFeedback({
      type: 'success',
      message: result?.message || 'Settings saved.'
    })
  }

  const feedbackClassName = feedback
    ? `alert ${
        feedback.type === 'error'
          ? 'alert-error'
          : feedback.type === 'success'
            ? 'alert-success'
            : 'alert-pending'
      }`
    : ''

  return (
    <article className="workspace-panel-card">
      <h2>Profile</h2>
      <p className="workspace-panel-subtitle">Update your name and default AI model.</p>

      {feedback ? <p className={feedbackClassName}>{feedback.message}</p> : null}

      <form className="workspace-form" onSubmit={handleSubmit}>
        <div className="settings-name-row">
          <label htmlFor="workspace-first-name">
            First name
            <input
              id="workspace-first-name"
              name="workspace-first-name"
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="James"
              type="text"
              value={firstName}
            />
          </label>

          <label htmlFor="workspace-last-name">
            Last name
            <input
              id="workspace-last-name"
              name="workspace-last-name"
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Smith"
              type="text"
              value={lastName}
            />
          </label>
        </div>

        <label htmlFor="workspace-model">
          Preferred model
          <select
            id="workspace-model"
            name="workspace-model"
            onChange={(event) => setPreferredModelId(event.target.value)}
            value={preferredModelId}
          >
            <option value="">Default model (auto)</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {getModelLabel(model)}
              </option>
            ))}
          </select>
        </label>

        <div className="settings-form-footer">
          <button
            className="settings-save-button"
            disabled={submitting || !canSubmit}
            type="submit"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </article>
  )
}

export default ProfileSettingsPanel
