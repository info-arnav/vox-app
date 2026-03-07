import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let voiceWindow = null

export const createVoiceWindow = () => {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize

  voiceWindow = new BrowserWindow({
    width: 400,
    height: 140,
    x: screenWidth - 416,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    hasShadow: false,
    focusable: true,
    roundedCorners: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false
    }
  })

  if (process.platform === 'darwin') {
    voiceWindow.setWindowButtonVisibility(false)
    voiceWindow.setAlwaysOnTop(true, 'screen-saver')
    voiceWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else if (process.platform === 'linux') {
    voiceWindow.setAlwaysOnTop(true, 'pop-up-menu')
    voiceWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else if (process.platform === 'win32') {
    voiceWindow.setAlwaysOnTop(true, 'screen-saver')
  }

  voiceWindow.once('ready-to-show', () => {
    voiceWindow.setIgnoreMouseEvents(true, { forward: true })
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const baseUrl = process.env['ELECTRON_RENDERER_URL'].replace(/\/[^/]*\.html$/, '')
    voiceWindow.loadURL(`${baseUrl}/voice.html`)
  } else {
    voiceWindow.loadFile(join(__dirname, '../renderer/voice.html'))
  }

  return voiceWindow
}

export const getVoiceWindow = () => voiceWindow

export const destroyVoiceWindow = () => {
  if (voiceWindow) {
    voiceWindow.destroy()
    voiceWindow = null
  }
}
