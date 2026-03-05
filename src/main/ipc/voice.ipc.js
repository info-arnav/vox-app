import { ipcMain } from 'electron'
import { sendAudioBuffer } from '../chat/chat.service'
import { pauseWakeWord, resumeWakeWord } from '../voice/voice.service'
import { getVoiceWindow } from '../voice/voice.window'

const registerHandler = (channel, handler) => {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

export const registerVoiceIpc = () => {
  registerHandler('voice:send-audio', (_event, arrayBuffer) => {
    try {
      sendAudioBuffer(Buffer.from(arrayBuffer))
    } catch (error) {
      void error
    }
  })

  registerHandler('voice:session-start', () => {
    pauseWakeWord()
  })

  registerHandler('voice:session-end', () => {
    resumeWakeWord()
  })

  ipcMain.removeAllListeners('voice:mouse-ignore')
  ipcMain.on('voice:mouse-ignore', (_event, ignore) => {
    const win = getVoiceWindow()
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, { forward: true })
    }
  })
}
