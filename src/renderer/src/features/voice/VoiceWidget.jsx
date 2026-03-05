import { useVoiceMode } from './useVoiceMode'

function VoiceOrb({ phase }) {
  return (
    <div className={`voice-orb voice-orb-${phase}`}>
      <div className="voice-orb-ring" />
      <div className="voice-orb-ring voice-orb-ring-2" />
      <div className="voice-orb-core" />
    </div>
  )
}

function CloseIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function VoiceWidget() {
  const { phase, transcript, responseText, isActive, dismiss } = useVoiceMode()

  if (!isActive) {
    return null
  }

  const bodyText = () => {
    if (phase === 'speaking' && responseText) return responseText
    if (phase === 'speaking') return 'Speaking…'
    if (phase === 'thinking' && responseText) return responseText
    if (phase === 'thinking') return 'Thinking…'
    if (transcript) return transcript
    return 'Listening…'
  }

  const subText = () => {
    if ((phase === 'thinking' || phase === 'speaking') && transcript) return transcript
    return null
  }

  return (
    <div className="voice-widget" role="dialog" aria-label="Voice mode active">
      <div className="voice-widget-inner">
        <VoiceOrb phase={phase} />
        <div className="voice-widget-text">
          <span className="voice-widget-primary">{bodyText()}</span>
          {subText() && <span className="voice-widget-secondary">{subText()}</span>}
        </div>
        <button
          className="voice-dismiss-btn"
          onClick={dismiss}
          title="Stop voice mode"
          type="button"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
