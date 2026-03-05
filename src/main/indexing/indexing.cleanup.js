import { authorizedRequestJson } from '../auth/auth.refresh'
import { DELETE_DRAIN_RETRY_DELAY_MS, REMOVE_BATCH_SIZE } from './indexing.constants'
import { appendEvent, DELETION_SWEEP_COOLDOWN_MS, setStatus, state } from './indexing.state'
import { chunkArray, isInsideFolder } from './indexing.utils'
import { ensureManifestLoaded, pathExists, queueManifestFlush } from './indexing.upsert'

export const removeIndexedPaths = async (
  paths,
  {
    incrementRemovedStale = false,
    reportErrorsAsFailedFiles = false,
    contextLabel = 'cleanup'
  } = {}
) => {
  if (!paths.length || state.cancelRequested) {
    return {
      removedCount: 0,
      failedCount: 0
    }
  }

  await ensureManifestLoaded()

  let removedCount = 0
  let failedCount = 0

  const pathChunks = chunkArray(paths, REMOVE_BATCH_SIZE)
  for (const chunk of pathChunks) {
    if (state.cancelRequested) {
      break
    }

    try {
      const payload = await authorizedRequestJson('/index/remove-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: chunk })
      })

      const errors = Array.isArray(payload?.data?.errors) ? payload.data.errors : []
      const erroredPaths = new Set(errors.map((entry) => entry.path))

      for (const indexedPath of chunk) {
        if (erroredPaths.has(indexedPath)) {
          continue
        }

        const hadManifestEntry = Boolean(state.activeManifest.entries[indexedPath])
        const hadPendingDelete = Boolean(state.activeManifest.pendingDeletes[indexedPath])

        if (hadManifestEntry) {
          delete state.activeManifest.entries[indexedPath]
        }
        if (hadPendingDelete) {
          delete state.activeManifest.pendingDeletes[indexedPath]
        }

        if (hadManifestEntry || hadPendingDelete) {
          removedCount += 1
        }
      }

      if (errors.length) {
        failedCount += errors.length
        appendEvent('warning', `${errors.length} paths failed to remove during ${contextLabel}.`)
      }
    } catch (error) {
      failedCount += chunk.length
      appendEvent('error', `Failed ${contextLabel}: ${error?.message || 'Unknown error'}`)
    }
  }

  if (removedCount > 0) {
    state.manifestDirty = true
  }

  if (incrementRemovedStale && removedCount > 0) {
    setStatus({
      removedStale: state.indexingStatus.removedStale + removedCount
    })
  }

  if (reportErrorsAsFailedFiles && failedCount > 0) {
    setStatus({
      failedFiles: state.indexingStatus.failedFiles + failedCount
    })
  }

  return {
    removedCount,
    failedCount
  }
}

export const schedulePendingDeleteDrain = (delayMs = 0) => {
  if (state.pendingDeleteDrainTimer) {
    clearTimeout(state.pendingDeleteDrainTimer)
    state.pendingDeleteDrainTimer = null
  }

  if (delayMs <= 0) {
    void drainPendingDeletes()
    return
  }

  state.pendingDeleteDrainTimer = setTimeout(() => {
    state.pendingDeleteDrainTimer = null
    void drainPendingDeletes()
  }, delayMs)
}

export const drainPendingDeletes = async () => {
  if (state.pendingDeleteDrainPromise) {
    return state.pendingDeleteDrainPromise
  }

  state.pendingDeleteDrainPromise = (async () => {
    if (state.indexingStatus.running || state.indexingStatus.cancelling) {
      schedulePendingDeleteDrain(DELETE_DRAIN_RETRY_DELAY_MS)
      return
    }

    await ensureManifestLoaded()

    const queuedPaths = Object.keys(state.activeManifest.pendingDeletes)
    if (!queuedPaths.length) {
      return
    }

    const cleanupResult = await removeIndexedPaths(queuedPaths, {
      contextLabel: 'queued folder cleanup'
    })
    await queueManifestFlush()

    const remainingCount = Object.keys(state.activeManifest.pendingDeletes).length
    if (remainingCount > 0) {
      const retryDelay = cleanupResult.failedCount > 0 ? DELETE_DRAIN_RETRY_DELAY_MS : 0
      schedulePendingDeleteDrain(retryDelay)
    }
  })()
    .catch((error) => {
      appendEvent('error', `Queued folder cleanup failed: ${error?.message || 'Unknown error'}`)
      schedulePendingDeleteDrain(DELETE_DRAIN_RETRY_DELAY_MS)
    })
    .finally(() => {
      state.pendingDeleteDrainPromise = null
    })

  return state.pendingDeleteDrainPromise
}

export const kickPendingDeleteDrain = () => {
  if (state.pendingDeleteDrainTimer || state.pendingDeleteDrainPromise) {
    return
  }

  void drainPendingDeletes()
}

export const removeStaleIndexedPaths = async (folders, discoveredPaths) => {
  const stalePaths = Object.keys(state.activeManifest.entries).filter((indexedPath) => {
    const isTrackedFolderPath = folders.some((folderPath) =>
      isInsideFolder(indexedPath, folderPath)
    )
    if (!isTrackedFolderPath) {
      return false
    }

    return !discoveredPaths.has(indexedPath)
  })

  if (!stalePaths.length || state.cancelRequested) {
    return
  }

  appendEvent('info', `Removing ${stalePaths.length} stale indexed files`)
  await removeIndexedPaths(stalePaths, {
    incrementRemovedStale: true,
    reportErrorsAsFailedFiles: true,
    contextLabel: 'stale cleanup'
  })
}

export const sweepDeletedIndexedPaths = async (folderPath) => {
  if (!folderPath || state.indexingStatus.running || state.indexingStatus.cancelling) {
    return
  }

  const now = Date.now()
  const lastSweepAt = Number(state.deletionSweepByFolder.get(folderPath) || 0)
  if (now - lastSweepAt < DELETION_SWEEP_COOLDOWN_MS) {
    return
  }
  state.deletionSweepByFolder.set(folderPath, now)

  const manifest = await ensureManifestLoaded()
  const indexedPaths = Object.keys(manifest.entries).filter((indexedPath) =>
    isInsideFolder(indexedPath, folderPath)
  )
  if (!indexedPaths.length) {
    return
  }

  const missingPaths = []
  for (const pathChunk of chunkArray(indexedPaths, REMOVE_BATCH_SIZE)) {
    const checks = await Promise.all(
      pathChunk.map(async (indexedPath) => ({
        indexedPath,
        exists: await pathExists(indexedPath)
      }))
    )

    for (const checkResult of checks) {
      if (!checkResult.exists) {
        missingPaths.push(checkResult.indexedPath)
      }
    }
  }

  if (!missingPaths.length) {
    return
  }

  appendEvent('info', `Removing ${missingPaths.length} deleted indexed files`)
  await removeIndexedPaths(missingPaths, {
    incrementRemovedStale: true,
    reportErrorsAsFailedFiles: true,
    contextLabel: 'deleted-file cleanup'
  })
  await queueManifestFlush()
}
