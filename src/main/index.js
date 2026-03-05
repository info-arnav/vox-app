import * as Sentry from '@sentry/electron/main'
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc/index'
import { initVoiceService, destroyVoiceService } from './voice/voice.service'
import { createVoiceWindow, destroyVoiceWindow } from './voice/voice.window'
import { createVoiceTray, destroyVoiceTray } from './voice/voice.tray'
import {
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH
} from './config/window'

Sentry.init({
  dsn: 'https://1729aa72a022c943cf2a529ee0e196a9@o487448.ingest.us.sentry.io/4510991364390912',
  enabled: !is.dev && !process.env.SENTRY_DISABLED
})

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')
}

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: 'VOX AI',
    backgroundColor: '#262624',
    show: false,
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hidden' } : {}),
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  initVoiceService()

  createWindow()
  createVoiceWindow()
  createVoiceTray()

  app.on('activate', function () {
    if (!mainWindow) createWindow()
    else mainWindow.focus()
  })
})

app.on('before-quit', () => {
  destroyVoiceService()
  destroyVoiceWindow()
  destroyVoiceTray()
})

app.on('window-all-closed', () => {
  app.quit()
})
