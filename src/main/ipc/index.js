import { registerAuthIpc } from './auth.ipc'
import { registerBillingIpc } from './billing.ipc'
import { registerChatIpc } from './chat.ipc'
import { registerIndexingIpc } from './indexing.ipc'
import { registerTaskIpc } from './task.ipc'
import { registerVoiceIpc } from './voice.ipc'

export const registerIpcHandlers = () => {
  registerAuthIpc()
  registerBillingIpc()
  registerChatIpc()
  registerIndexingIpc()
  registerTaskIpc()
  registerVoiceIpc()
}
