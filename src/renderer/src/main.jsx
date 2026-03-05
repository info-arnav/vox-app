import './assets/main.css'
import * as Sentry from '@sentry/electron/renderer'

import { Component, StrictMode } from 'react'

Sentry.init({ enabled: !import.meta.env.DEV })
import { createRoot } from 'react-dom/client'
import App from './App'

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '40px 24px',
            fontFamily: 'monospace',
            color: '#f8e7ef',
            background: '#262624',
            minHeight: '100dvh'
          }}
        >
          <p style={{ color: '#ec89b8', fontWeight: 700, fontSize: '1rem', margin: '0 0 16px' }}>
            App crashed — React rendering error
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              color: '#ffd5e5',
              fontSize: '0.84rem',
              margin: 0
            }}
          >
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>
)
