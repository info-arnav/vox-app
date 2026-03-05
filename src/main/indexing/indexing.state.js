import { STATUS_EVENT_LIMIT } from './indexing.constants'

export const createInitialStatus = () => ({
  running: false,
  cancelling: false,
  startedAt: null,
  finishedAt: null,
  activeFolders: [],
  queueSize: 0,
  scannedFiles: 0,
  queuedFiles: 0,
  processedFiles: 0,
  indexedFiles: 0,
  skippedUnchanged: 0,
  skippedUnsupported: 0,
  failedFiles: 0,
  removedStale: 0,
  message: '',
  events: []
})

export const DELETION_SWEEP_COOLDOWN_MS = 30_000

export const state = {
  indexingStatus: createInitialStatus(),
  cancelRequested: false,
  activeManifest: null,
  manifestDirty: false,
  manifestFlushChain: Promise.resolve(),
  manifestFlushTimer: null,
  pendingDeleteDrainPromise: null,
  pendingDeleteDrainTimer: null,
  pendingFilePaths: new Set(),
  processingFilePaths: new Set(),
  deletionSweepByFolder: new Map()
}

export const cloneStatus = () => JSON.parse(JSON.stringify(state.indexingStatus))

export const setStatus = (patch) => {
  state.indexingStatus = {
    ...state.indexingStatus,
    ...patch
  }
}

export const appendEvent = (level, message) => {
  const nextEvents = [
    ...state.indexingStatus.events,
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level,
      message,
      at: new Date().toISOString()
    }
  ]

  setStatus({
    events: nextEvents.slice(-STATUS_EVENT_LIMIT)
  })
}

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const waitForIndexingIdle = async (timeoutMs = 5000) => {
  const startedAt = Date.now()
  while (state.indexingStatus.running || state.indexingStatus.cancelling) {
    if (Date.now() - startedAt >= timeoutMs) {
      break
    }

    await delay(100)
  }
}
