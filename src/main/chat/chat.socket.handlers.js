import { createError } from '../auth/auth.error'
import { runDesktopTool } from './tools'
import { isAuthClose, isAuthErrorEvent, normalizeCloseReason } from './chat.connection'
import {
  TOOL_LOG_CHANNEL,
  state,
  toErrorPayload,
  emitStatus,
  emitEvent,
  emitVoiceAudio,
  emitToWindows,
  sendDefaultToolDeclaration,
  sendTaskResult,
  flushPendingMessages,
  detachSocketListeners
} from './chat.socket.state'

const shouldIgnoreBackendErrorEvent = (event) => {
  const message = String(event?.data?.message || '')
    .trim()
    .toLowerCase()
  if (message !== 'invalid message') {
    return false
  }

  return Date.now() - Number(state.lastDesktopResultSentAt || 0) <= 2500
}

const handleTaskRequest = (taskRequest) => {
  const requestId = String(taskRequest?.requestId || '').trim()
  const taskId = String(taskRequest?.taskId || requestId).trim()
  const toolName = String(taskRequest?.tool || '').trim()
  const payload =
    taskRequest?.payload && typeof taskRequest.payload === 'object' ? taskRequest.payload : {}

  if (!taskId || !toolName) {
    return
  }

  void (async () => {
    const startedAt = Date.now()
    const logId = `tl-${startedAt}-${Math.random().toString(36).slice(2, 7)}`
    const truncate = (value, max = 2000) => {
      try {
        const normalized = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
        return normalized.length > max ? `${normalized.slice(0, max)}\n…(truncated)` : normalized
      } catch {
        return String(value)
      }
    }

    try {
      const result = await runDesktopTool(toolName, payload)
      sendTaskResult({
        taskId,
        requestId: requestId || undefined,
        status: 'completed',
        result
      })

      emitToWindows(TOOL_LOG_CHANNEL, {
        id: logId,
        at: new Date().toISOString(),
        toolName,
        taskId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        payload: truncate(payload),
        result: truncate(result)
      })
    } catch (error) {
      sendTaskResult({
        taskId,
        requestId: requestId || undefined,
        status: 'failed',
        result: null,
        message: error?.message || `Desktop tool failed: ${toolName}`
      })

      emitToWindows(TOOL_LOG_CHANNEL, {
        id: logId,
        at: new Date().toISOString(),
        toolName,
        taskId,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        payload: truncate(payload),
        result: null,
        error: error?.message || `Desktop tool failed: ${toolName}`
      })
    }
  })()
}

export const createSocketHandlers = ({ reconnect }) => {
  const handleSocketMessage = (raw, isBinary) => {
    if (isBinary) {
      emitVoiceAudio(raw)
      return
    }

    let event
    try {
      event = JSON.parse(raw.toString('utf8'))
    } catch {
      return
    }

    emitEvent(event)

    if (event?.type === 'session' && event?.data?.status === 'initialized') {
      state.sessionReady = true
      state.status = 'ready'
      state.lastError = null
      emitStatus()

      try {
        sendDefaultToolDeclaration()
      } catch (error) {
        state.lastError = toErrorPayload(error)
        state.status = 'error'
        emitStatus()
        return
      }

      flushPendingMessages()
      return
    }

    if (event?.type === 'mode' && typeof event?.data?.mode === 'string') {
      state.mode = event.data.mode
      emitStatus()
      return
    }

    if (event?.type === 'task.request') {
      handleTaskRequest(event?.data || {})
      return
    }

    if (event?.type !== 'error') {
      return
    }

    if (shouldIgnoreBackendErrorEvent(event)) {
      return
    }

    if (isAuthErrorEvent(event)) {
      const activeSocket = state.socket
      detachSocketListeners()
      state.socket = null
      state.sessionReady = false
      state.pendingMessages = []

      if (activeSocket) {
        try {
          activeSocket.terminate()
        } catch (error) {
          void error
        }
      }

      reconnect()
      return
    }

    state.lastError = {
      code: 'CHAT_EVENT_ERROR',
      message: event?.data?.message || 'Chat request failed.'
    }
    emitStatus()
  }

  const handleSocketClose = (code, reason) => {
    const wasManualDisconnect = state.manualDisconnect
    const closeReason = normalizeCloseReason(reason)

    detachSocketListeners()
    state.socket = null
    state.sessionReady = false
    state.pendingMessages = []

    if (wasManualDisconnect) {
      state.manualDisconnect = false
      state.status = 'idle'
      state.lastError = null
      emitStatus()
      return
    }

    if (isAuthClose(code, closeReason)) {
      reconnect()
      return
    }

    const message = closeReason || `Chat disconnected (${code}).`
    state.status = 'error'
    state.lastError = toErrorPayload(createError('CHAT_DISCONNECTED', message))
    emitStatus()
  }

  const handleSocketError = (error) => {
    state.lastError = toErrorPayload(
      createError('NETWORK_ERROR', error?.message || 'Chat connection encountered a network error.')
    )
    emitStatus()
  }

  const attachSocket = (socket) => {
    state.socket = socket
    state.socketListeners = {
      message: handleSocketMessage,
      close: handleSocketClose,
      error: handleSocketError
    }

    socket.on('message', state.socketListeners.message)
    socket.on('close', state.socketListeners.close)
    socket.on('error', state.socketListeners.error)
  }

  return {
    attachSocket
  }
}
