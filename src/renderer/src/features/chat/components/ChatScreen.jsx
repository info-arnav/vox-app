import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, CheckCircle, CircleAlert } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChatRuntime, useChatLive } from '../state/ChatRuntimeContext'

const SUGGESTION_CHIPS = [
  'Summarize my recent documents',
  'Draft an email for me',
  'Search my files for...',
  'Create a to-do list for...'
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

function runtimeLabel(status) {
  if (!status) return ''
  const s = status.toLowerCase()
  if (s.includes('thinking') || s.includes('connecting')) return status
  if (s.includes('search') || s.includes('context')) return 'Looking through your data...'
  if (s.includes('launching') || s.includes('agent')) return 'Launching agent...'
  if (s.includes('writing') || s.includes('file')) return 'Writing file...'
  if (s.includes('running') || s.includes('code')) return 'Running code...'
  if (s.includes('fetching') || s.includes('reading')) return 'Fetching data...'
  return 'Working on your request...'
}

const NotificationMessage = memo(function NotificationMessage({ message }) {
  const isOk = message.status === 'completed'
  const Icon = isOk ? CheckCircle : CircleAlert
  return (
    <div className="chat-message-row chat-message-row-notification">
      <article className={`chat-notification-card chat-notification-card-${message.status}`}>
        <div className="chat-notification-header">
          <Icon aria-hidden="true" size={13} />
          <span>
            {isOk
              ? 'Agent completed'
              : message.status === 'aborted'
                ? 'Agent stopped'
                : 'Agent failed'}
          </span>
        </div>
        {message.content && <p className="chat-notification-content">{message.content}</p>}
      </article>
    </div>
  )
})

const ChatMessage = memo(function ChatMessage({ message }) {
  if (message.role === 'notification') return <NotificationMessage message={message} />
  const isAssistant = message.role === 'assistant'
  return (
    <div className={`chat-message-row chat-message-row-${message.role}`}>
      <article className={`chat-message-bubble${message.pending ? ' is-pending' : ''}`}>
        {isAssistant && !message.pending ? (
          <div className="chat-message-content chat-message-content-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="chat-message-content">{message.content}</p>
        )}
      </article>
    </div>
  )
})

function ChatScreen({ user }) {
  const { messages, sendError, sending, isConnecting, sendMessage, clearSendError } =
    useChatRuntime()
  const { liveRuntimeStatus } = useChatLive()

  const inputRef = useRef(null)
  const [hasContent, setHasContent] = useState(false)
  const chatStageRef = useRef(null)
  const scrollRafRef = useRef(null)
  const scrollTimerRef = useRef(null)

  const runtimeCopy = useMemo(() => {
    if (!liveRuntimeStatus || isConnecting) return ''
    return runtimeLabel(liveRuntimeStatus)
  }, [liveRuntimeStatus, isConnecting])

  useEffect(() => {
    const el = chatStageRef.current
    if (!el) return
    clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      scrollRafRef.current = window.requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }, 80)
    return () => {
      clearTimeout(scrollTimerRef.current)
      window.cancelAnimationFrame(scrollRafRef.current)
    }
  }, [messages, runtimeCopy])

  const canSend = !sending && hasContent

  const handleSend = useCallback(async () => {
    const el = inputRef.current
    const content = el ? el.value.trim() : ''
    if (!content || sending) return
    if (el) {
      el.value = ''
      el.style.height = 'auto'
    }
    setHasContent(false)
    if (sendError) clearSendError()
    await sendMessage(content)
  }, [clearSendError, sendError, sendMessage, sending])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend]
  )

  const handleInput = useCallback(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    const val = el?.value.trim() ?? ''
    setHasContent(val.length > 0)
  }, [])

  const handleChip = useCallback((chip) => {
    const val = chip.endsWith('...') ? chip.slice(0, -3) : chip
    if (inputRef.current) {
      inputRef.current.value = val
      inputRef.current.focus()
    }
    setHasContent(val.length > 0)
  }, [])

  return (
    <section className="chat-screen">
      <article className="chat-stage" ref={chatStageRef}>
        {messages.length === 0 ? (
          <div className="chat-stage-empty">
            <p>
              {getGreeting()}, {String(user?.firstName || '').trim() || 'there'}.
            </p>
            <div className="chat-suggestion-chips">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  className="chat-suggestion-chip"
                  key={chip}
                  onClick={() => handleChip(chip)}
                  type="button"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div
              className="chat-message-row chat-message-row-assistant"
              style={{ visibility: runtimeCopy ? 'visible' : 'hidden' }}
            >
              <article className="chat-message-bubble chat-message-bubble-runtime">
                <span aria-hidden="true" className="chat-runtime-loader" />
                <p className="chat-message-content">{runtimeCopy || '\u00A0'}</p>
              </article>
            </div>
          </div>
        )}
      </article>

      <article className="chat-composer">
        <label className="chat-composer-label" htmlFor="chat-message-input">
          Ask anything
        </label>
        <textarea
          className="chat-composer-input"
          id="chat-message-input"
          name="chat-message-input"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Type your prompt..."
          ref={inputRef}
          rows={1}
        />
        <div className="chat-composer-toolbar">
          <div className="chat-composer-group">
            <button
              aria-label="Send message"
              className="workspace-icon-button workspace-send-button"
              disabled={!canSend}
              onClick={() => void handleSend()}
              type="button"
            >
              {isConnecting || sending ? (
                <span aria-hidden="true" className="workspace-button-loader" />
              ) : (
                <ArrowUp size={16} />
              )}
            </button>
          </div>
        </div>
      </article>
    </section>
  )
}

export default ChatScreen
