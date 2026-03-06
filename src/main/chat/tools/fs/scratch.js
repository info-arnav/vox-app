import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

function voxCacheBase() {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Caches', 'Vox')
    case 'win32':
      return path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
        'Vox',
        'cache'
      )
    default:
      return path.join(os.homedir(), '.cache', 'vox')
  }
}

export const getScratchDir = async ({ id } = {}) => {
  const dirId = (id || '').trim() || randomUUID()
  const dirPath = path.join(voxCacheBase(), dirId)
  await fs.mkdir(dirPath, { recursive: true })
  return { path: dirPath }
}
