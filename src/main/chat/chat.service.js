import { randomUUID } from 'crypto'
import { createError } from '../auth/auth.error'
import { connectWithAuthRetry } from './chat.connection'
import { createSocketHandlers } from './chat.socket.handlers'
import {
  VALID_MODES,
  state,
  toErrorPayload,
  isSocketOpen,
  normalizeMessageContent,
  getChatStatus,
  emitStatus,
  sendPayloadNow,
  queueOrSendPayload,
  sendSessionInit,
  detachSocketListeners
} from './chat.socket.state'

const reconnectForAuth = () => {
  if (state.connectPromise) {
    return
  }

  state.status = 'connecting'
  state.lastError = null
  emitStatus()

  void connectChat().catch((error) => {
    state.status = 'error'
    state.lastError = toErrorPayload(error)
    emitStatus()
  })
}

const { attachSocket } = createSocketHandlers({ reconnect: reconnectForAuth })

export { getChatStatus }

export const connectChat = async () => {
  if (isSocketOpen()) {
    return getChatStatus()
  }

  if (state.connectPromise) {
    return state.connectPromise
  }

  state.status = 'connecting'
  state.lastError = null
  emitStatus()

  state.connectPromise = (async () => {
    const socket = await connectWithAuthRetry()
    attachSocket(socket)

    state.sessionReady = false
    state.status = 'connected'
    state.lastError = null
    emitStatus()

    sendSessionInit()
    return getChatStatus()
  })()
    .catch((error) => {
      state.socket = null
      state.sessionReady = false
      state.pendingMessages = []
      state.status = 'error'
      state.lastError = toErrorPayload(error)
      emitStatus()
      throw error
    })
    .finally(() => {
      state.connectPromise = null
    })

  return state.connectPromise
}

export const disconnectChat = async () => {
  state.pendingMessages = []
  state.sessionReady = false
  state.lastError = null

  if (!state.socket) {
    state.status = 'idle'
    emitStatus()
    return getChatStatus()
  }

  state.manualDisconnect = true
  const activeSocket = state.socket
  detachSocketListeners()
  state.socket = null

  try {
    activeSocket.close(1000, 'Client disconnected')
  } catch (error) {
    void error
  }

  state.manualDisconnect = false
  state.status = 'idle'
  emitStatus()
  return getChatStatus()
}

export const sendChatMessage = async (payload = {}) => {
  const content = normalizeMessageContent(payload?.content)
  if (!content) {
    throw createError('VALIDATION_ERROR', 'Message content is required.')
  }

  if (!isSocketOpen()) {
    await connectChat()
  }

  const requestId = randomUUID()
  const streamId = randomUUID()
  const queued = queueOrSendPayload({
    type: 'message',
    content,
    requestId,
    streamId
  })

  return {
    requestId,
    streamId,
    queued
  }
}

export const sendTaskAbort = (taskId) => {
  const id = String(taskId || '').trim()
  if (!id || !isSocketOpen()) return false

  try {
    sendPayloadNow({ type: 'task.abort', taskId: id })
    return true
  } catch {
    return false
  }
}

export const sendTaskResume = (taskId) => {
  const id = String(taskId || '').trim()
  if (!id || !isSocketOpen()) return false

  try {
    queueOrSendPayload({ type: 'task.resume', taskId: id })
    return true
  } catch {
    return false
  }
}

export const sendAudioBuffer = (buffer) => {
  if (!isSocketOpen()) return

  try {
    state.socket.send(buffer)
  } catch (error) {
    void error
  }
}

export const setChatMode = async (payload = {}) => {
  const mode = String(payload?.mode || '')
    .trim()
    .toLowerCase()
  if (!VALID_MODES.has(mode)) {
    throw createError('VALIDATION_ERROR', 'Mode must be one of: text, voice, or both.')
  }

  if (!isSocketOpen()) {
    await connectChat()
  }

  const requestId = randomUUID()
  const queued = queueOrSendPayload({
    type: 'mode',
    requestId,
    data: { mode }
  })

  state.mode = mode
  emitStatus()

  return {
    mode,
    requestId,
    queued
  }
}
