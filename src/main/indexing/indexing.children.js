import path from 'node:path'
import { opendir, stat } from 'node:fs/promises'
import { IGNORED_DIRECTORIES } from './indexing.constants'
import { detectFileKind, isUnchangedFile } from './indexing.files'
import { state } from './indexing.state'
import { isInsideOrSamePath } from './indexing.utils'
import { ensureManifestLoaded } from './indexing.upsert'
import { sweepDeletedIndexedPaths } from './indexing.cleanup'

export const getIndexedChildren = async (payload) => {
  const rawFolderPath = String(payload?.folderPath || '').trim()
  if (!rawFolderPath) {
    throw new Error('Folder path is required.')
  }
  const normalizedFolderPath = path.resolve(rawFolderPath)

  const requestedBasePath = String(payload?.basePath || '').trim()
  const normalizedBasePath = requestedBasePath
    ? path.resolve(requestedBasePath)
    : normalizedFolderPath

  if (!isInsideOrSamePath(normalizedBasePath, normalizedFolderPath)) {
    throw new Error('Base path must be inside the selected folder.')
  }

  await sweepDeletedIndexedPaths(normalizedFolderPath)

  const manifestEntries = (await ensureManifestLoaded()).entries || {}
  const activeIndexFolders = Array.isArray(state.indexingStatus.activeFolders)
    ? state.indexingStatus.activeFolders.map((folderPath) => path.resolve(folderPath))
    : []

  const isInActiveIndexScope = (candidatePath) => {
    if (!state.indexingStatus.running || !activeIndexFolders.length) {
      return false
    }

    return activeIndexFolders.some((activeFolderPath) =>
      isInsideOrSamePath(candidatePath, activeFolderPath)
    )
  }

  const fileManifestByPath = new Map()
  const indexedDescendantsByChildName = new Set()

  for (const [indexedPath, manifestEntry] of Object.entries(manifestEntries)) {
    if (!isInsideOrSamePath(indexedPath, normalizedBasePath)) {
      continue
    }

    const relativeToBasePath = path.relative(normalizedBasePath, indexedPath)
    if (
      !relativeToBasePath ||
      relativeToBasePath.startsWith('..') ||
      path.isAbsolute(relativeToBasePath)
    ) {
      continue
    }

    const pathSegments = relativeToBasePath.split(path.sep).filter(Boolean)
    if (!pathSegments.length) {
      continue
    }

    const childName = pathSegments[0]
    if (pathSegments.length === 1) {
      fileManifestByPath.set(path.join(normalizedBasePath, childName), manifestEntry)
    } else {
      indexedDescendantsByChildName.add(childName)
    }
  }

  const collectChildNamesFromSet = (pathsSet) => {
    const childNames = new Set()

    for (const indexedPath of pathsSet) {
      if (!isInsideOrSamePath(indexedPath, normalizedBasePath)) {
        continue
      }

      const relativeToBasePath = path.relative(normalizedBasePath, indexedPath)
      if (
        !relativeToBasePath ||
        relativeToBasePath.startsWith('..') ||
        path.isAbsolute(relativeToBasePath)
      ) {
        continue
      }

      const pathSegments = relativeToBasePath.split(path.sep).filter(Boolean)
      if (!pathSegments.length) {
        continue
      }

      childNames.add(pathSegments[0])
    }

    return childNames
  }

  const pendingChildNames = collectChildNamesFromSet(state.pendingFilePaths)
  const processingChildNames = collectChildNamesFromSet(state.processingFilePaths)

  const directoryEntries = []
  let directoryHandle
  try {
    directoryHandle = await opendir(normalizedBasePath)
  } catch {
    throw new Error('Unable to read folder contents.')
  }

  for await (const entry of directoryHandle) {
    directoryEntries.push(entry)
  }
  directoryEntries.sort((left, right) => left.name.localeCompare(right.name))

  const children = []

  for (const entry of directoryEntries) {
    const childPath = path.join(normalizedBasePath, entry.name)

    if (entry.isSymbolicLink()) {
      children.push({
        path: childPath,
        name: entry.name,
        type: 'file',
        fileKind: null,
        size: 0,
        indexedAt: null,
        status: 'out_of_scope',
        statusReason: 'symbolic-link'
      })
      continue
    }

    if (entry.isDirectory()) {
      const isIgnoredDirectory = IGNORED_DIRECTORIES.has(entry.name)
      const directoryStatus = isIgnoredDirectory
        ? 'out_of_scope'
        : processingChildNames.has(entry.name)
          ? 'indexing'
          : pendingChildNames.has(entry.name)
            ? 'pending'
            : indexedDescendantsByChildName.has(entry.name)
              ? 'indexed'
              : isInActiveIndexScope(childPath)
                ? 'pending'
                : 'not_indexed'

      children.push({
        path: childPath,
        name: entry.name,
        type: 'directory',
        status: directoryStatus,
        statusReason: isIgnoredDirectory ? 'ignored-directory' : ''
      })
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    let fileStats
    try {
      fileStats = await stat(childPath)
    } catch {
      continue
    }

    const detectedFileKind = detectFileKind(childPath)
    const manifestEntry = fileManifestByPath.get(childPath)
    const isSupportedFile = Boolean(detectedFileKind)

    const fileStatus = !isSupportedFile
      ? 'out_of_scope'
      : state.processingFilePaths.has(childPath)
        ? 'indexing'
        : state.pendingFilePaths.has(childPath)
          ? 'pending'
          : manifestEntry && isUnchangedFile(manifestEntry, fileStats, detectedFileKind)
            ? 'indexed'
            : isInActiveIndexScope(childPath)
              ? 'pending'
              : 'not_indexed'

    children.push({
      path: childPath,
      name: entry.name,
      type: 'file',
      fileKind: detectedFileKind || manifestEntry?.kind || null,
      size: Number(fileStats.size || 0),
      mtimeMs: Number(fileStats.mtimeMs || 0),
      indexedAt: manifestEntry?.indexedAt || null,
      status: fileStatus,
      statusReason: isSupportedFile ? '' : 'unsupported-extension'
    })
  }

  children.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  })

  return {
    folderPath: normalizedFolderPath,
    basePath: normalizedBasePath,
    children
  }
}
