import { ipcMain } from 'electron'
import {
  connectChat,
  disconnectChat,
  getChatStatus,
  sendChatMessage,
  setChatMode
} from '../chat/chat.service'

const formatError = (error) => ({
  code: error?.code || 'UNKNOWN_ERROR',
  message: error?.message || 'Unexpected error'
})

const registerHandler = (channel, handler) => {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

export const registerChatIpc = () => {
  registerHandler('chat:connect', async () => {
    try {
      const status = await connectChat()
      return { success: true, data: { status } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('chat:disconnect', async () => {
    try {
      const status = await disconnectChat()
      return { success: true, data: { status } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('chat:get-status', async () => {
    try {
      const status = getChatStatus()
      return { success: true, data: { status } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('chat:send-message', async (_event, payload) => {
    try {
      const result = await sendChatMessage(payload || {})
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('chat:set-mode', async (_event, payload) => {
    try {
      const result = await setChatMode(payload || {})
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })
}
