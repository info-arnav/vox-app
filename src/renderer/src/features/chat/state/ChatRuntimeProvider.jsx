import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MAX_ACTIVITY_ITEMS } from '../utils/chat.constants'
import {
  getChatStorageKey,
  getMessageId,
  readLocalChatMessages,
  writeLocalChatMessages
} from '../utils/chat.messages'
import { activityFromEvent } from '../utils/chat.activity'
import { ChatRuntimeContext, EMPTY_CONTEXT_VALUE } from './ChatRuntimeContext'
import { useChatStream } from './useChatStream'
import { useChatEventHandler } from './useChatEventHandler'

const toStatusState = (status) => ({
  ...EMPTY_CONTEXT_VALUE.chatStatus,
  ...(status || {})
})

const isSameStatus = (left, right) => {
  if (!left || !right) {
    return false
  }

  const leftError = left.lastError || null
  const rightError = right.lastError || null

  return (
    left.state === right.state &&
    left.connected === right.connected &&
    left.sessionReady === right.sessionReady &&
    left.mode === right.mode &&
    left.queuedMessages === right.queuedMessages &&
    leftError?.code === rightError?.code &&
    leftError?.message === rightError?.message
  )
}

export function ChatRuntimeProvider({ chatUserId, children }) {
  const chatStorageKey = useMemo(() => getChatStorageKey(chatUserId), [chatUserId])
  const [chatStatus, setChatStatus] = useState(EMPTY_CONTEXT_VALUE.chatStatus)
  const [messages, setMessages] = useState(() => readLocalChatMessages(chatStorageKey))
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [activityFeed, setActivityFeed] = useState([])
  const [taskRecords, setTaskRecords] = useState([])
  const [liveRuntimeStatus, setLiveRuntimeStatus] = useState('')
  const pendingSpawnCallsRef = useRef([])
  const liveStatusTimerRef = useRef(null)

  const { markStreamStarted, appendAssistantChunk, markStreamComplete } = useChatStream(setMessages)

  const clearLiveStatusTimer = useCallback(() => {
    if (liveStatusTimerRef.current) {
      window.clearTimeout(liveStatusTimerRef.current)
      liveStatusTimerRef.current = null
    }
  }, [])

  const setRuntimeStatus = useCallback(
    (message, autoClearMs = 0) => {
      clearLiveStatusTimer()
      setLiveRuntimeStatus(message || '')
      if (!message || autoClearMs <= 0) return
      liveStatusTimerRef.current = window.setTimeout(() => {
        setLiveRuntimeStatus((current) => (current === message ? '' : current))
        liveStatusTimerRef.current = null
      }, autoClearMs)
    },
    [clearLiveStatusTimer]
  )

  const appendActivity = useCallback((event) => {
    const item = activityFromEvent(event)
    if (!item) return
    setActivityFeed((current) => {
      const deduped = current.filter((entry) => entry.id !== item.id)
      return [item, ...deduped].slice(0, MAX_ACTIVITY_ITEMS)
    })
  }, [])

  const handleChatEvent = useChatEventHandler({
    setMessages,
    appendActivity,
    markStreamStarted,
    appendAssistantChunk,
    markStreamComplete,
    setRuntimeStatus,
    setTaskRecords,
    setSendError,
    setSending,
    pendingSpawnCallsRef
  })

  useEffect(() => {
    let active = true

    const unsubscribeStatus = window.api.chat.onStatus((status) => {
      if (!active) return
      const nextStatus = toStatusState(status)
      setChatStatus((current) => (isSameStatus(current, nextStatus) ? current : nextStatus))
      if (nextStatus.state === 'connecting') {
        setRuntimeStatus('Connecting...')
      } else if (nextStatus.state === 'error' || nextStatus.state === 'idle') {
        setSending(false)
        setRuntimeStatus('', 0)
      } else if (nextStatus.sessionReady) {
        setRuntimeStatus('', 0)
      }
    })

    const unsubscribeEvent = window.api.chat.onEvent((event) => {
      if (!active) return
      handleChatEvent(event)
    })

    const bootstrapChat = async () => {
      const statusResponse = await window.api.chat.getStatus()
      if (active && statusResponse?.success) {
        const nextStatus = toStatusState(statusResponse?.data?.status)
        setChatStatus((current) => (isSameStatus(current, nextStatus) ? current : nextStatus))
      }

      const connectResponse = await window.api.chat.connect()
      if (!active) return

      if (!connectResponse?.success) {
        setSendError(connectResponse?.error?.message || 'Unable to connect to chat.')
        return
      }

      const nextStatus = toStatusState(connectResponse?.data?.status)
      setChatStatus((current) => (isSameStatus(current, nextStatus) ? current : nextStatus))
    }

    void bootstrapChat()

    return () => {
      active = false
      unsubscribeStatus?.()
      unsubscribeEvent?.()
      clearLiveStatusTimer()
    }
  }, [clearLiveStatusTimer, handleChatEvent, setRuntimeStatus])

  useEffect(() => {
    const timer = window.setTimeout(() => writeLocalChatMessages(chatStorageKey, messages), 220)
    return () => window.clearTimeout(timer)
  }, [chatStorageKey, messages])

  const sendMessage = useCallback(
    async (rawContent) => {
      const content = String(rawContent || '').trim()
      if (!content || sending) return { success: false }

      setSending(true)
      setSendError('')
      setRuntimeStatus('Thinking...')
      pendingSpawnCallsRef.current = []

      const localMessageId = `local-${getMessageId()}`
      setMessages((current) => [
        ...current,
        { id: localMessageId, role: 'user', content, pending: false, streamId: null }
      ])

      try {
        const response = await window.api.chat.sendMessage(content)
        if (!response?.success) {
          const message = response?.error?.message || 'Failed to send message.'
          setSendError(message)
          setSending(false)
          setRuntimeStatus('', 0)
        }
        return response
      } catch (err) {
        setSending(false)
        setRuntimeStatus('', 0)
        throw err
      }
    },
    [sending, setSending, setRuntimeStatus]
  )

  const clearSendError = useCallback(() => setSendError(''), [])

  const abortTask = useCallback(async (taskId) => {
    const id = String(taskId || '').trim()
    if (!id) return { success: false }
    return window.api.tasks.abort(id)
  }, [])

  const resumeTask = useCallback(async (taskId) => {
    const id = String(taskId || '').trim()
    if (!id) return { success: false }
    return window.api.tasks.resume(id)
  }, [])

  const isConnecting =
    chatStatus.state === 'connecting' ||
    (chatStatus.state === 'connected' && !chatStatus.sessionReady)

  const contextValue = useMemo(
    () => ({
      chatStatus,
      messages,
      activityFeed,
      taskRecords,
      liveRuntimeStatus,
      sending,
      isConnecting,
      sendError,
      sendMessage,
      clearSendError,
      abortTask,
      resumeTask
    }),
    [
      abortTask,
      activityFeed,
      chatStatus,
      clearSendError,
      isConnecting,
      liveRuntimeStatus,
      messages,
      resumeTask,
      sendError,
      sendMessage,
      sending,
      taskRecords
    ]
  )

  return <ChatRuntimeContext.Provider value={contextValue}>{children}</ChatRuntimeContext.Provider>
}
