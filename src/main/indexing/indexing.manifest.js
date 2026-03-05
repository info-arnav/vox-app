import { app } from 'electron'
import path from 'node:path'
import { mkdir, rename, writeFile, readFile } from 'node:fs/promises'

const MANIFEST_VERSION = 1
const MANIFEST_FILE_NAME = 'index-manifest.json'

export const createEmptyManifest = () => ({
  version: MANIFEST_VERSION,
  entries: {},
  pendingDeletes: {}
})

const getManifestPath = () => {
  return path.join(app.getPath('userData'), MANIFEST_FILE_NAME)
}

export const loadManifest = async () => {
  const manifestPath = getManifestPath()

  try {
    const rawValue = await readFile(manifestPath, 'utf8')
    const parsedValue = JSON.parse(rawValue)

    if (!parsedValue || typeof parsedValue !== 'object') {
      return createEmptyManifest()
    }

    if (!parsedValue.entries || typeof parsedValue.entries !== 'object') {
      return createEmptyManifest()
    }

    return {
      version: MANIFEST_VERSION,
      entries: parsedValue.entries,
      pendingDeletes:
        parsedValue.pendingDeletes && typeof parsedValue.pendingDeletes === 'object'
          ? parsedValue.pendingDeletes
          : {}
    }
  } catch {
    return createEmptyManifest()
  }
}

export const saveManifest = async (manifest) => {
  const manifestPath = getManifestPath()
  const directoryPath = path.dirname(manifestPath)
  const tempPath = `${manifestPath}.tmp`

  await mkdir(directoryPath, { recursive: true })

  await writeFile(tempPath, JSON.stringify(manifest, null, 2), 'utf8')
  await rename(tempPath, manifestPath)
}
