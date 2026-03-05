import { CHAT_STORAGE_KEY_PREFIX, MAX_STORED_MESSAGES } from './chat.constants'

export const getMessageId = () =>
  typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`

const toMessageFingerprint = (message) =>
  `${String(message?.role || '')}::${String(message?.content || '').trim()}`

export const asPersistedMessage = (message) => ({
  role: message.role,
  content: String(message.content || '')
})

export const asRenderableMessage = (message, idPrefix = 'history') => ({
  id: `${idPrefix}-${getMessageId()}`,
  role: message.role,
  content: String(message.content || ''),
  pending: false,
  streamId: null
})

export const isRenderableChatMessage = (message) =>
  (message?.role === 'user' || message?.role === 'assistant') &&
  typeof message?.content === 'string' &&
  message.content.length > 0

export const getChatStorageKey = (chatUserId) =>
  `${CHAT_STORAGE_KEY_PREFIX}:${chatUserId || 'anonymous'}`

export const readLocalChatMessages = (storageKey) => {
  if (typeof window === 'undefined') return []
  try {
    const rawValue = window.localStorage.getItem(storageKey)
    if (!rawValue) return []
    const parsedValue = JSON.parse(rawValue)
    if (!Array.isArray(parsedValue)) return []
    return parsedValue
      .filter(isRenderableChatMessage)
      .map((message) => asRenderableMessage(message, 'local'))
  } catch {
    return []
  }
}

export const writeLocalChatMessages = (storageKey, messages) => {
  if (typeof window === 'undefined') return
  const persisted = messages
    .filter(isRenderableChatMessage)
    .slice(-MAX_STORED_MESSAGES)
    .map(asPersistedMessage)
  window.localStorage.setItem(storageKey, JSON.stringify(persisted))
}

const areSequencesEqual = (left, right) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (toMessageFingerprint(left[index]) !== toMessageFingerprint(right[index])) return false
  }
  return true
}

export const mergeWithServerTail = (localMessages, serverMessages) => {
  if (!serverMessages.length) return localMessages
  if (!localMessages.length) return serverMessages

  const maxOverlap = Math.min(localMessages.length, serverMessages.length)
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    const localTail = localMessages.slice(localMessages.length - overlap)
    const serverHead = serverMessages.slice(0, overlap)
    if (areSequencesEqual(localTail, serverHead)) {
      return [...localMessages, ...serverMessages.slice(overlap)]
    }
  }

  const localLastWindow = localMessages.slice(-serverMessages.length)
  if (areSequencesEqual(localLastWindow, serverMessages)) return localMessages

  const firstServerFP = toMessageFingerprint(serverMessages[0])
  for (let index = localMessages.length - 1; index >= 0; index -= 1) {
    if (toMessageFingerprint(localMessages[index]) === firstServerFP) {
      return [...localMessages.slice(0, index), ...serverMessages]
    }
  }

  return [...localMessages, ...serverMessages]
}

export const normalizeHistoryMessages = (history = []) => {
  if (!Array.isArray(history)) return []
  return history
    .filter(isRenderableChatMessage)
    .map((message) => asRenderableMessage(message, 'server'))
}
