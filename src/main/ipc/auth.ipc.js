import { BrowserWindow, ipcMain } from 'electron'
import {
  getSession,
  getWorkspaceBootstrap,
  login,
  logout,
  refreshVerificationStatus,
  register,
  resendVerification,
  updateWorkspaceProfile
} from '../auth/auth.service'
import { onAuthExpired } from '../auth/auth.state'

const formatError = (error) => ({
  code: error?.code || 'UNKNOWN_ERROR',
  message: error?.message || 'Unexpected error'
})

const registerHandler = (channel, handler) => {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

export const registerAuthIpc = () => {
  onAuthExpired(() => {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send('auth:expired')
    })
  })

  registerHandler('auth:login', async (_event, payload) => {
    try {
      const session = await login(payload || {})
      return { success: true, data: { session } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('auth:logout', async () => {
    try {
      const session = await logout()
      return { success: true, data: { session } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('auth:register', async (_event, payload) => {
    try {
      const session = await register(payload || {})
      return { success: true, data: { session } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('auth:get-session', async () => {
    try {
      const session = await getSession()
      return { success: true, data: { session } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('auth:resend-verification', async () => {
    try {
      const result = await resendVerification()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('auth:refresh-verification', async () => {
    try {
      const session = await refreshVerificationStatus()
      return { success: true, data: { session } }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('auth:get-workspace-bootstrap', async () => {
    try {
      const workspace = await getWorkspaceBootstrap()
      return { success: true, data: workspace }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })

  registerHandler('auth:update-workspace-profile', async (_event, payload) => {
    try {
      const result = await updateWorkspaceProfile(payload || {})
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })
}
