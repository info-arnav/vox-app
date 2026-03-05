import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/electron/renderer'
import VoiceWidget from './features/voice/VoiceWidget'
import './styles/voice.css'

Sentry.init({ enabled: !import.meta.env.DEV })

let lastIgnoreValue = null

document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const overUI = el && el !== document.documentElement && el !== document.body
  const nextIgnoreValue = !overUI

  if (nextIgnoreValue === lastIgnoreValue) {
    return
  }

  lastIgnoreValue = nextIgnoreValue
  window.api?.voice?.setIgnoreMouseEvents(nextIgnoreValue)
})

ReactDOM.createRoot(document.getElementById('voice-root')).render(
  <React.StrictMode>
    <VoiceWidget />
  </React.StrictMode>
)
