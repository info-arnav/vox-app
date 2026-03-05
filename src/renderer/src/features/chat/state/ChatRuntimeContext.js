import { createContext, useContext } from 'react'
import { EMPTY_CHAT_STATUS } from '../utils/chat.constants'

export const EMPTY_CONTEXT_VALUE = {
  chatStatus: EMPTY_CHAT_STATUS,
  messages: [],
  activityFeed: [],
  taskRecords: [],
  liveRuntimeStatus: '',
  sending: false,
  isConnecting: false,
  sendError: '',
  sendMessage: async () => ({ success: false }),
  clearSendError: () => {},
  abortTask: async () => ({ success: false }),
  resumeTask: async () => ({ success: false })
}

export const ChatRuntimeContext = createContext(EMPTY_CONTEXT_VALUE)

export const useChatRuntime = () => {
  const context = useContext(ChatRuntimeContext)
  if (!context) {
    throw new Error('useChatRuntime must be used inside ChatRuntimeProvider.')
  }

  return context
}
