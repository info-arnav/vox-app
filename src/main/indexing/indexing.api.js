import path from 'node:path'
import { detectFileKind, readTextFileForIndex } from './indexing.files'
import { appendEvent, state } from './indexing.state'
import { isInsideFolder, isInsideOrSamePath } from './indexing.utils'
import { ensureManifestLoaded, queueManifestFlush } from './indexing.upsert'
import { schedulePendingDeleteDrain } from './indexing.cleanup'

export { getIndexedChildren } from './indexing.children'

export const removeIndexedFolderData = async (payload) => {
  const rawFolderPath = String(payload?.folderPath || '').trim()
  if (!rawFolderPath) {
    throw new Error('Folder path is required.')
  }

  if (state.indexingStatus.running || state.indexingStatus.cancelling) {
    throw new Error('Pause indexing before removing a folder.')
  }

  const normalizedFolderPath = path.resolve(rawFolderPath)
  const manifest = await ensureManifestLoaded()

  const folderIndexedPaths = Object.keys(manifest.entries).filter((indexedPath) =>
    isInsideFolder(indexedPath, normalizedFolderPath)
  )
  const folderQueuedPaths = Object.keys(manifest.pendingDeletes).filter((indexedPath) =>
    isInsideFolder(indexedPath, normalizedFolderPath)
  )

  if (!folderIndexedPaths.length && !folderQueuedPaths.length) {
    return {
      folderPath: normalizedFolderPath,
      queuedCount: 0,
      pendingCount: 0
    }
  }

  const queuedAt = new Date().toISOString()
  for (const indexedPath of folderIndexedPaths) {
    delete manifest.entries[indexedPath]
    manifest.pendingDeletes[indexedPath] = {
      folderPath: normalizedFolderPath,
      queuedAt
    }
  }
  state.manifestDirty = true

  const pendingCount = Object.keys(manifest.pendingDeletes).filter((indexedPath) =>
    isInsideFolder(indexedPath, normalizedFolderPath)
  ).length

  appendEvent(
    'info',
    `Queued ${folderIndexedPaths.length} indexed files for background deletion (${normalizedFolderPath}).`
  )

  await queueManifestFlush()
  state.deletionSweepByFolder.delete(normalizedFolderPath)
  schedulePendingDeleteDrain(0)

  return {
    folderPath: normalizedFolderPath,
    queuedCount: folderIndexedPaths.length,
    pendingCount
  }
}

export const listIndexedFilesForTool = async (payload = {}) => {
  const manifest = await ensureManifestLoaded()
  const prefix = String(payload?.prefix || '').trim()
  const normalizedPrefix = prefix ? path.resolve(prefix) : ''
  const query = String(payload?.query || '')
    .trim()
    .toLowerCase()
  const page = Math.max(1, Number(payload?.page || 1))
  const pageSize = Math.min(200, Math.max(1, Number(payload?.pageSize || 50)))

  const allItems = Object.entries(manifest.entries)
    .map(([filePath, entry]) => ({
      path: filePath,
      folderPath: entry.folderPath,
      kind: entry.kind,
      size: Number(entry.size || 0),
      mtimeMs: Number(entry.mtimeMs || 0),
      indexedAt: entry.indexedAt || null
    }))
    .filter((item) => {
      if (normalizedPrefix && !isInsideOrSamePath(path.resolve(item.path), normalizedPrefix)) {
        return false
      }

      if (!query) {
        return true
      }

      const normalizedItemPath = String(item.path || '').toLowerCase()
      const fileName = path.basename(item.path).toLowerCase()
      return normalizedItemPath.includes(query) || fileName.includes(query)
    })
    .sort((left, right) => {
      if (query) {
        const leftPath = String(left.path || '').toLowerCase()
        const rightPath = String(right.path || '').toLowerCase()
        const leftName = path.basename(left.path).toLowerCase()
        const rightName = path.basename(right.path).toLowerCase()

        const rank = (fileName, filePath) => {
          if (fileName === query) return 0
          if (fileName.startsWith(query)) return 1
          if (fileName.includes(query)) return 2
          if (filePath.includes(query)) return 3
          return 4
        }

        const leftRank = rank(leftName, leftPath)
        const rightRank = rank(rightName, rightPath)
        if (leftRank !== rightRank) {
          return leftRank - rightRank
        }
      }

      const leftTime = new Date(left.indexedAt || 0).getTime()
      const rightTime = new Date(right.indexedAt || 0).getTime()
      return rightTime - leftTime
    })

  const total = allItems.length
  const offset = (page - 1) * pageSize
  const items = allItems.slice(offset, offset + pageSize)

  return {
    page,
    pageSize,
    total,
    query: query || null,
    items
  }
}

export const readIndexedFileForTool = async (payload = {}) => {
  const rawPath = String(payload?.path || '').trim()
  if (!rawPath) {
    throw new Error('Path is required.')
  }

  const normalizedPath = path.resolve(rawPath)
  const manifest = await ensureManifestLoaded()
  const entry = manifest.entries[normalizedPath]
  if (!entry) {
    throw new Error('Path is not indexed.')
  }

  const fileKind = detectFileKind(normalizedPath)
  if (fileKind !== 'text') {
    return {
      path: normalizedPath,
      kind: fileKind || entry.kind || 'unknown',
      content: '',
      truncated: false,
      message: 'File is indexed as non-text. Use semantic context search for this file.'
    }
  }

  const maxChars = Math.min(120_000, Math.max(1_000, Number(payload?.maxChars || 60_000)))
  const readResult = await readTextFileForIndex(normalizedPath)

  if (readResult?.unsupported) {
    return {
      path: normalizedPath,
      kind: fileKind,
      content: '',
      truncated: false,
      message: readResult.unsupportedReason || 'File format not supported for text extraction.',
      indexedAt: entry.indexedAt || null
    }
  }

  if (readResult?.containsBinary) {
    return {
      path: normalizedPath,
      kind: fileKind,
      content: '',
      truncated: false,
      message: 'Text extraction failed: file appears to be binary.',
      indexedAt: entry.indexedAt || null
    }
  }

  const fullText = String(readResult?.text || '')
  const content = fullText.length > maxChars ? fullText.slice(0, maxChars) : fullText

  return {
    path: normalizedPath,
    kind: fileKind,
    content,
    truncated: Boolean(readResult?.truncated || fullText.length > maxChars),
    indexedAt: entry.indexedAt || null
  }
}
