import { ipcMain } from 'electron'
import { installAndRestart } from '../updater/updater'

export const registerUpdaterIpc = () => {
  ipcMain.removeHandler('update:install')
  ipcMain.handle('update:install', () => installAndRestart())
}
