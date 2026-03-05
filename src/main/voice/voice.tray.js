import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { emitToWindows, VOICE_ACTIVATE_CHANNEL } from '../chat/chat.socket.state'

let tray = null
let _createWindow = null

const focusOrCreateMain = () => {
  const wins = BrowserWindow.getAllWindows()
  const main = wins.find((w) => !w.isDestroyed() && w.getTitle() === 'VOX AI')
  if (main) {
    if (main.isMinimized()) main.restore()
    main.show()
    main.focus()
  } else if (_createWindow) {
    _createWindow()
  }
}

export const createVoiceTray = (createWindow) => {
  _createWindow = createWindow
  const imgPath = join(__dirname, '../../resources/vox-tray.png')
  const img = nativeImage.createFromPath(imgPath).resize({ width: 22, height: 22 })

  tray = new Tray(img)
  tray.setToolTip('Vox')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Vox',
      click: focusOrCreateMain
    },
    {
      label: 'Start Voice Mode',
      click: () => emitToWindows(VOICE_ACTIVATE_CHANNEL, {})
    },
    { type: 'separator' },
    { label: 'Quit Vox', click: () => app.quit() }
  ])

  tray.setContextMenu(menu)
}

export const destroyVoiceTray = () => {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
