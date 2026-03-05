import { ipcMain } from 'electron'
import {
  getDefaultIndexFolders,
  getIndexedChildren,
  getIndexingStatus,
  pickIndexFolder,
  removeIndexedFolderData,
  resetIndexingState,
  startIndexing,
  stopIndexing
} from '../indexing/indexing.service'

const formatError = (error) => ({
  code: error?.code || 'UNKNOWN_ERROR',
  message: error?.message || 'Unexpected error'
})

const registerHandler = (channel, handler) => {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

export const registerIndexingIpc = () => {
  registerHandler('indexing:start', async (_event, payload) => {
    try {
      const status = await startIndexing(payload || {})
      return { success: true, data: { status } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('indexing:stop', async () => {
    try {
      const status = await stopIndexing()
      return { success: true, data: { status } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('indexing:get-status', async () => {
    try {
      const status = getIndexingStatus()
      return { success: true, data: { status } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('indexing:get-default-folders', async () => {
    try {
      const folders = await getDefaultIndexFolders()
      return { success: true, data: { folders } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('indexing:pick-folder', async () => {
    try {
      const result = await pickIndexFolder()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('indexing:get-indexed-children', async (_event, payload) => {
    try {
      const result = await getIndexedChildren(payload || {})
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('indexing:remove-folder-data', async (_event, payload) => {
    try {
      const result = await removeIndexedFolderData(payload || {})
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('indexing:reset-state', async () => {
    try {
      const status = await resetIndexingState()
      return { success: true, data: { status } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })
}
