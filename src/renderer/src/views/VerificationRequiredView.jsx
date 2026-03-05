import { useState } from 'react'

const FEEDBACK_TYPES = {
  SUCCESS: 'success',
  PENDING: 'pending',
  ERROR: 'error'
}

function VerificationRequiredView({
  session,
  onLogout,
  onRefreshVerification,
  onRequestVerification
}) {
  const [requestingCode, setRequestingCode] = useState(false)
  const [refreshingStatus, setRefreshingStatus] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const setErrorFeedback = (message) => {
    setFeedback({
      type: FEEDBACK_TYPES.ERROR,
      message: message || 'Something went wrong. Please try again.'
    })
  }

  const handleRequestCode = async () => {
    setFeedback(null)
    setRequestingCode(true)
    const result = await onRequestVerification?.()
    setRequestingCode(false)

    if (!result?.success) {
      setErrorFeedback(result?.message || 'Failed to send verification email.')
      return
    }

    setFeedback({
      type: FEEDBACK_TYPES.SUCCESS,
      message: result?.message || 'Verification email sent.'
    })
  }

  const handleRefreshVerification = async () => {
    setFeedback(null)
    setRefreshingStatus(true)
    const result = await onRefreshVerification?.()
    setRefreshingStatus(false)

    if (!result?.success) {
      setErrorFeedback(result?.message || 'Failed to refresh verification status.')
      return
    }

    setFeedback({
      type: result?.verified ? FEEDBACK_TYPES.SUCCESS : FEEDBACK_TYPES.PENDING,
      message:
        result?.message ||
        (result?.verified ? 'Email verified. Unlocking workspace...' : 'Email is still unverified.')
    })
  }

  const isBusy = requestingCode || refreshingStatus
  const feedbackClassName = feedback
    ? `alert ${
        feedback.type === FEEDBACK_TYPES.ERROR
          ? 'alert-error'
          : feedback.type === FEEDBACK_TYPES.SUCCESS
            ? 'alert-success'
            : 'alert-pending'
      }`
    : ''

  return (
    <section className="screen-shell verification-shell">
      <article className="status-card">
        <p className="status-badge status-badge-pending">Verification required</p>
        <h1>Verify your email before continuing</h1>
        <p className="status-copy">
          Account <strong>{session.user?.email}</strong> is signed in but not verified yet. Complete
          email verification, then refresh status here.
        </p>

        {feedback ? <p className={feedbackClassName}>{feedback.message}</p> : null}

        <div className="status-actions">
          <button
            className="secondary-button"
            disabled={isBusy}
            onClick={handleRequestCode}
            type="button"
          >
            {requestingCode ? 'Sending verification email...' : 'Request verification code'}
          </button>
          <button
            className="secondary-button secondary-button-strong"
            disabled={isBusy}
            onClick={handleRefreshVerification}
            type="button"
          >
            {refreshingStatus ? 'Refreshing status...' : 'I verified, refresh app'}
          </button>
          <button
            className="secondary-button secondary-button-danger"
            disabled={isBusy}
            onClick={onLogout}
            type="button"
          >
            Log out
          </button>
        </div>
      </article>
    </section>
  )
}

export default VerificationRequiredView
