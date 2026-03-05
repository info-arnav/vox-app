import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

let getWindow = null

export function initUpdater(windowGetter) {
  if (is.dev) return

  getWindow = windowGetter

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    getWindow()?.webContents.send('update:available', info)
  })

  autoUpdater.on('update-downloaded', (info) => {
    getWindow()?.webContents.send('update:downloaded', info)
  })

  autoUpdater.on('error', (err) => {
    getWindow()?.webContents.send('update:error', { message: err.message })
  })

  setTimeout(() => autoUpdater.checkForUpdates(), 10_000)
}

export function installAndRestart() {
  autoUpdater.quitAndInstall()
}
