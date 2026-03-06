import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'
import { createError } from '../auth/auth.error'
import { DESKTOP_TOOL_DECLARATIONS } from './tools'

export const CHAT_STATUS_CHANNEL = 'chat:status'
export const CHAT_EVENT_CHANNEL = 'chat:event'
export const TOOL_LOG_CHANNEL = 'chat:tool-log'
export const VOICE_ACTIVATE_CHANNEL = 'voice:activate'
export const VOICE_AUDIO_CHANNEL = 'voice:audio'
export const VALID_MODES = new Set(['text', 'voice', 'both'])

export const state = {
  socket: null,
  socketListeners: null,
  connectPromise: null,
  pendingMessages: [],
  manualDisconnect: false,
  status: 'idle',
  sessionReady: false,
  mode: 'text',
  lastError: null,
  lastDesktopResultSentAt: 0
}

export const toErrorPayload = (error) => ({
  code: error?.code || 'UNKNOWN_ERROR',
  message: error?.message || 'Unexpected error'
})

export const emitToWindows = (channel, payload) => {
  const windows = BrowserWindow.getAllWindows()
  for (const window of windows) {
    if (window.isDestroyed()) {
      continue
    }

    const { webContents } = window
    if (webContents?.isDestroyed()) {
      continue
    }

    webContents.send(channel, payload)
  }
}

export const isSocketOpen = () => Boolean(state.socket && state.socket.readyState === 1)

export const normalizeMessageContent = (content) => String(content || '').trim()

export const getChatStatus = () => ({
  state: state.status,
  connected: isSocketOpen(),
  sessionReady: state.sessionReady,
  mode: state.mode,
  queuedMessages: state.pendingMessages.length,
  lastError: state.lastError
})

export const emitStatus = () => {
  emitToWindows(CHAT_STATUS_CHANNEL, getChatStatus())
}

export const emitEvent = (event) => {
  emitToWindows(CHAT_EVENT_CHANNEL, event)
}

export const emitVoiceAudio = (buffer) => {
  emitToWindows(VOICE_AUDIO_CHANNEL, buffer)
}

export const sendPayloadNow = (payload) => {
  if (!isSocketOpen()) {
    throw createError('CHAT_DISCONNECTED', 'Chat is disconnected. Reconnect and try again.')
  }

  state.socket.send(JSON.stringify(payload))
}

export const queueOrSendPayload = (payload) => {
  const shouldQueue = payload.type !== 'session' && !state.sessionReady
  if (shouldQueue) {
    state.pendingMessages.push(payload)
    emitStatus()
    return true
  }

  sendPayloadNow(payload)
  return false
}

export const flushPendingMessages = () => {
  if (!state.sessionReady || !isSocketOpen() || state.pendingMessages.length === 0) {
    return
  }

  while (state.pendingMessages.length > 0) {
    const nextPayload = state.pendingMessages.shift()
    try {
      sendPayloadNow(nextPayload)
    } catch (error) {
      state.pendingMessages.unshift(nextPayload)
      state.lastError = toErrorPayload(error)
      state.status = 'error'
      emitStatus()
      return
    }
  }

  emitStatus()
}

export const sendSessionInit = () => {
  sendPayloadNow({
    type: 'session',
    requestId: randomUUID()
  })
}

export const sendDefaultToolDeclaration = () => {
  sendPayloadNow({
    type: 'tools_declare',
    requestId: randomUUID(),
    data: {
      tools: DESKTOP_TOOL_DECLARATIONS
    }
  })
}

export const sendTaskResult = ({ taskId, requestId, status, result, message }) => {
  if (!isSocketOpen()) {
    return
  }

  state.lastDesktopResultSentAt = Date.now()

  sendPayloadNow({
    type: 'task.result',
    taskId,
    ...(requestId ? { requestId } : {}),
    status,
    result,
    message
  })
}

export const detachSocketListeners = () => {
  if (!state.socket || !state.socketListeners) {
    return
  }

  state.socket.removeListener('message', state.socketListeners.message)
  state.socket.removeListener('close', state.socketListeners.close)
  state.socket.removeListener('error', state.socketListeners.error)
  state.socketListeners = null
}
