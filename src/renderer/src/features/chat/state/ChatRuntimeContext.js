import { createContext, useContext } from 'react'
import { EMPTY_CHAT_STATUS } from '../utils/chat.constants'

export const EMPTY_CONTEXT_VALUE = {
  chatStatus: EMPTY_CHAT_STATUS,
  messages: [],
  sending: false,
  isConnecting: false,
  sendError: '',
  sendMessage: async () => ({ success: false }),
  clearSendError: () => {},
  abortTask: async () => ({ success: false }),
  abortCurrentTask: async () => ({ success: false }),
  resumeTask: async () => ({ success: false })
}

export const EMPTY_LIVE_VALUE = {
  activityFeed: [],
  taskRecords: []
}

export const EMPTY_STATUS_VALUE = {
  liveRuntimeStatus: ''
}

export const ChatRuntimeContext = createContext(EMPTY_CONTEXT_VALUE)
export const ChatLiveContext = createContext(EMPTY_LIVE_VALUE)
export const ChatStatusContext = createContext(EMPTY_STATUS_VALUE)

export const useChatRuntime = () => {
  const context = useContext(ChatRuntimeContext)
  if (!context) {
    throw new Error('useChatRuntime must be used inside ChatRuntimeProvider.')
  }
  return context
}

export const useChatLive = () => useContext(ChatLiveContext)
export const useChatStatus = () => useContext(ChatStatusContext)
