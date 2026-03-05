import { ipcMain } from 'electron'
import { authorizedRequestJson } from '../auth/auth.refresh'
import { sendTaskAbort, sendTaskResume } from '../chat/chat.service'

const formatError = (error) => ({
  code: error?.code || 'UNKNOWN_ERROR',
  message: error?.message || 'Unexpected error'
})

const registerHandler = (channel, handler) => {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

export const registerTaskIpc = () => {
  registerHandler('task:abort', async (_event, { taskId } = {}) => {
    try {
      const sent = sendTaskAbort(taskId)
      return { success: sent, data: { sent } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('task:resume', async (_event, { taskId } = {}) => {
    try {
      const sent = sendTaskResume(taskId)
      return { success: sent, data: { sent } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('task:list', async (_event, { offset_id, limit, status } = {}) => {
    try {
      const params = new URLSearchParams()
      if (offset_id) params.set('offset_id', offset_id)
      if (limit) params.set('limit', String(limit))
      if (status) params.set('status', status)
      const query = params.toString()
      const url = `/worker/tasks${query ? `?${query}` : ''}`
      const res = await authorizedRequestJson(url)
      const data = res?.data ?? res
      return { success: true, data }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('task:get', async (_event, { taskId } = {}) => {
    const id = String(taskId || '').trim()
    if (!id) {
      return {
        success: false,
        error: formatError({
          code: 'VALIDATION_ERROR',
          message: 'taskId is required.'
        })
      }
    }

    try {
      const res = await authorizedRequestJson(`/worker/tasks/${encodeURIComponent(id)}`)
      return { success: true, data: res?.data ?? res }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })
}
