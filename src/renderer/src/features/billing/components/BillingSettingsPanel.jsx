import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const MIN_CREDITS = 1000

const formatUsd = (credits) => {
  const amount = Number(credits) / 100
  if (!Number.isFinite(amount)) {
    return '$0.00'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

const parseCredits = (value) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  if (!Number.isInteger(parsed)) {
    return 0
  }

  return parsed
}

function BillingSettingsPanel({ creditsBalance, onRefreshCredits, onStartCheckout }) {
  const [creditsInput, setCreditsInput] = useState(String(MIN_CREDITS))
  const [runningAction, setRunningAction] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [justRefreshed, setJustRefreshed] = useState(false)
  const flashTimer = useRef(null)

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const selectedCredits = useMemo(() => parseCredits(creditsInput), [creditsInput])
  const isValidCredits = selectedCredits >= MIN_CREDITS

  const runAction = async (name, callback) => {
    setFeedback(null)
    setRunningAction(name)
    const result = await callback()
    setRunningAction('')

    if (!result?.success) {
      setFeedback({ type: 'error', message: result?.message || 'Billing action failed.' })
      return
    }

    if (name === 'refresh') {
      setJustRefreshed(true)
      clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setJustRefreshed(false), 2200)
    } else {
      setFeedback({ type: 'success', message: result?.message || 'Done.' })
    }
  }

  const handleCheckout = async () =>
    runAction('checkout', async () => {
      if (!isValidCredits) {
        return { success: false, message: `Minimum purchase is ${MIN_CREDITS} credits.` }
      }
      const result = await onStartCheckout(selectedCredits)
      if (!result?.success) return result
      return {
        success: true,
        message: 'Checkout opened in browser. Complete payment, then refresh balance.'
      }
    })

  const handleRefreshCredits = async () => runAction('refresh', async () => onRefreshCredits())

  const feedbackClassName = feedback
    ? `alert ${feedback.type === 'error' ? 'alert-error' : 'alert-success'}`
    : ''

  const isRefreshing = runningAction === 'refresh'

  return (
    <article className="workspace-panel-card">
      <h2>Billing</h2>

      <p className="alert alert-warning">
        Credit purchases are temporarily disabled while billing is being set up. Your existing credits work normally.
      </p>
      <div className="billing-balance-hero">
        <div className="billing-balance-left">
          <span className="billing-balance-label">Balance</span>
          <strong
            className={`billing-balance-amount${justRefreshed ? ' billing-balance-updated' : ''}`}
          >
            {Number(creditsBalance || 0).toFixed(2)}
            <span className="billing-balance-unit"> credits</span>
          </strong>
          {justRefreshed && <span className="billing-balance-flash">Updated</span>}
        </div>
        <button
          aria-label="Refresh balance"
          className={`billing-refresh-btn${isRefreshing ? ' billing-refresh-btn-spinning' : ''}`}
          disabled={Boolean(runningAction)}
          onClick={handleRefreshCredits}
          title="Refresh balance"
          type="button"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {feedback ? <p className={feedbackClassName}>{feedback.message}</p> : null}

      <div className="workspace-form billing-custom-form">
        <label htmlFor="billing-custom-credits">
          Credits to buy
          <input
            id="billing-custom-credits"
            min={MIN_CREDITS}
            name="billing-custom-credits"
            onChange={(event) => setCreditsInput(event.target.value)}
            step={1}
            type="number"
            value={creditsInput}
          />
        </label>

        <p className="billing-total-row">
          <span>Charge</span>
          <strong>{formatUsd(selectedCredits)}</strong>
        </p>

        <div className="billing-action-row">
          <button
            className="settings-save-button"
            disabled={true}
            onClick={handleCheckout}
            type="button"
          >
            {runningAction === 'checkout' ? 'Opening…' : 'Buy credits'}
          </button>
        </div>
      </div>
    </article>
  )
}

export default BillingSettingsPanel
