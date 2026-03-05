import { app, dialog } from 'electron'
import path from 'node:path'
import { stat } from 'node:fs/promises'
import { MAX_QUEUE_SIZE, WORKER_CONCURRENCY } from './indexing.constants'
import { normalizeFolderList } from './indexing.files'
import { createEmptyManifest } from './indexing.manifest'
import { BoundedAsyncQueue } from './indexing.queue'
import {
  appendEvent,
  cloneStatus,
  createInitialStatus,
  setStatus,
  state,
  waitForIndexingIdle
} from './indexing.state'
import {
  ensureManifestLoaded,
  queueManifestFlush,
  startManifestFlushTimer,
  stopManifestFlushTimer,
  scanFolders,
  workerLoop
} from './indexing.upsert'
import { kickPendingDeleteDrain, removeStaleIndexedPaths } from './indexing.cleanup'
export {
  getIndexedChildren,
  listIndexedFilesForTool,
  readIndexedFileForTool,
  removeIndexedFolderData
} from './indexing.api'

const runIndexing = async (folders) => {
  await ensureManifestLoaded()
  state.manifestDirty = false

  startManifestFlushTimer()

  const discoveredPaths = new Set()
  const queue = new BoundedAsyncQueue(MAX_QUEUE_SIZE)

  const workers = Array.from({ length: WORKER_CONCURRENCY }, () => workerLoop(queue))

  try {
    await scanFolders(folders, queue, discoveredPaths)
  } finally {
    queue.close()
  }

  await Promise.all(workers)

  await removeStaleIndexedPaths(folders, discoveredPaths)

  await stopManifestFlushTimer()
}

const validateFolders = async (foldersInput) => {
  const normalizedFolders = normalizeFolderList(foldersInput)

  const validFolders = []

  for (const folderPath of normalizedFolders) {
    try {
      const folderStats = await stat(folderPath)
      if (!folderStats.isDirectory()) {
        continue
      }

      validFolders.push(folderPath)
    } catch {
      continue
    }
  }

  return validFolders
}

const resolveDefaultFolders = async () => {
  const candidates = []

  for (const name of ['documents', 'downloads']) {
    try {
      const folderPath = app.getPath(name)
      if (folderPath) candidates.push(folderPath)
    } catch (error) {
      void error
    }
  }

  if (!candidates.length) {
    try {
      const homePath = app.getPath('home')
      if (homePath) candidates.push(homePath)
    } catch (error) {
      void error
    }
  }

  return validateFolders(candidates)
}

const finalizeRun = (message) => {
  setStatus({
    running: false,
    cancelling: false,
    queueSize: 0,
    finishedAt: new Date().toISOString(),
    message
  })
}

export const getIndexingStatus = () => {
  if (!state.indexingStatus.running && !state.indexingStatus.cancelling) {
    kickPendingDeleteDrain()
  }

  return cloneStatus()
}

export const pickIndexFolder = async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select folder to index',
    properties: ['openDirectory']
  })

  if (result.canceled || !result.filePaths?.length) {
    return { path: '' }
  }

  return {
    path: path.resolve(result.filePaths[0])
  }
}

export const getDefaultIndexFolders = async () => {
  return resolveDefaultFolders()
}

export const resetIndexingState = async () => {
  if (state.indexingStatus.running || state.indexingStatus.cancelling) {
    await stopIndexing()
    await waitForIndexingIdle()
  }

  state.cancelRequested = false

  if (state.manifestFlushTimer) {
    clearInterval(state.manifestFlushTimer)
    state.manifestFlushTimer = null
  }

  if (state.pendingDeleteDrainTimer) {
    clearTimeout(state.pendingDeleteDrainTimer)
    state.pendingDeleteDrainTimer = null
  }

  state.pendingFilePaths.clear()
  state.processingFilePaths.clear()
  state.deletionSweepByFolder.clear()

  state.activeManifest = createEmptyManifest()
  state.manifestDirty = true
  await queueManifestFlush()

  state.activeManifest = null
  state.manifestDirty = false

  state.indexingStatus = createInitialStatus()
  return getIndexingStatus()
}

export const stopIndexing = async () => {
  if (!state.indexingStatus.running) {
    return getIndexingStatus()
  }

  state.cancelRequested = true
  setStatus({ cancelling: true, message: 'Stopping indexing...' })
  appendEvent('warning', 'Stop requested by user.')

  return getIndexingStatus()
}

export const startIndexing = async (payload) => {
  if (state.indexingStatus.running) {
    throw new Error('Indexing is already running.')
  }

  let validFolders = await validateFolders(payload?.folders)
  if (!validFolders.length) {
    validFolders = await resolveDefaultFolders()
  }

  if (!validFolders.length) {
    throw new Error('Could not resolve any valid folders for indexing.')
  }

  state.cancelRequested = false
  state.pendingFilePaths.clear()
  state.processingFilePaths.clear()
  state.indexingStatus = {
    ...createInitialStatus(),
    running: true,
    startedAt: new Date().toISOString(),
    activeFolders: validFolders,
    message: ''
  }

  appendEvent('info', `Indexing started for ${validFolders.length} folder(s).`)

  void runIndexing(validFolders)
    .then(() => {
      if (state.cancelRequested) {
        finalizeRun('Indexing stopped.')
        appendEvent('warning', 'Indexing stopped before completion.')
      } else {
        finalizeRun('Indexing completed.')
        appendEvent('success', 'Indexing completed successfully.')
      }
    })
    .catch(async (error) => {
      await stopManifestFlushTimer()
      setStatus({
        failedFiles: state.indexingStatus.failedFiles + 1
      })
      finalizeRun('Indexing failed.')
      appendEvent('error', `Indexing failed: ${error?.message || 'Unknown error'}`)
    })
    .finally(() => {
      state.cancelRequested = false
      state.pendingFilePaths.clear()
      state.processingFilePaths.clear()
      state.activeManifest = null
      state.manifestDirty = false
      kickPendingDeleteDrain()
    })

  return getIndexingStatus()
}
