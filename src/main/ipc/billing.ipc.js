import { ipcMain } from 'electron'
import { startCheckout } from '../billing/billing.service'

const formatError = (error) => ({
  code: error?.code || 'UNKNOWN_ERROR',
  message: error?.message || 'Unexpected error'
})

const registerHandler = (channel, handler) => {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

export const registerBillingIpc = () => {
  registerHandler('billing:start-checkout', async (_event, payload) => {
    try {
      const result = await startCheckout(payload?.credits)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: formatError(error) }
    }
  })
}
