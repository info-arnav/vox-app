import { loadManifest, saveManifest } from './indexing.manifest'
import { state } from './indexing.state'

export const ensureManifestLoaded = async () => {
  if (state.activeManifest?.entries) {
    return state.activeManifest
  }

  state.activeManifest = await loadManifest()
  if (!state.activeManifest.entries || typeof state.activeManifest.entries !== 'object') {
    state.activeManifest.entries = {}
  }

  if (
    !state.activeManifest.pendingDeletes ||
    typeof state.activeManifest.pendingDeletes !== 'object'
  ) {
    state.activeManifest.pendingDeletes = {}
  }

  return state.activeManifest
}

export const queueManifestFlush = () => {
  state.manifestFlushChain = state.manifestFlushChain
    .catch(() => {})
    .then(async () => {
      if (!state.manifestDirty || !state.activeManifest) {
        return
      }

      state.manifestDirty = false
      await saveManifest(state.activeManifest)
    })

  return state.manifestFlushChain
}

export const startManifestFlushTimer = () => {
  if (state.manifestFlushTimer) {
    clearInterval(state.manifestFlushTimer)
  }

  state.manifestFlushTimer = setInterval(() => {
    void queueManifestFlush()
  }, 2000)
}

export const stopManifestFlushTimer = async () => {
  if (state.manifestFlushTimer) {
    clearInterval(state.manifestFlushTimer)
    state.manifestFlushTimer = null
  }

  await queueManifestFlush()
}

export const updateManifestEntry = (job) => {
  state.activeManifest.entries[job.filePath] = {
    folderPath: job.folderPath,
    kind: job.kind,
    size: Number(job.fileStats.size),
    mtimeMs: Number(job.fileStats.mtimeMs),
    indexedAt: new Date().toISOString()
  }

  state.manifestDirty = true
}
