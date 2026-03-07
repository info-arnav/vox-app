import { useCallback, useEffect, useRef, useState } from 'react'
import { getResponseErrorMessage } from '../../../shared/hooks/useSessionRecovery'

export const INDEXING_PAUSED_STORAGE_KEY = 'vox.workspace.indexing.paused'
const STATUS_POLL_INTERVAL_MS = 3000
const AUTO_INDEX_SCAN_INTERVAL_MS = 15000

const EMPTY_INDEXING_STATUS = {
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
}

const readPausedFromStorage = () => {
  if (typeof window === 'undefined') {
    return false
  }

  const rawValue = window.localStorage.getItem(INDEXING_PAUSED_STORAGE_KEY)
  return String(rawValue || '').toLowerCase() === 'true'
}

const writePausedToStorage = (isPaused) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(INDEXING_PAUSED_STORAGE_KEY, isPaused ? 'true' : 'false')
}

const normalizeIndexingStatus = (status) => ({
  ...EMPTY_INDEXING_STATUS,
  ...(status || {}),
  events: Array.isArray(status?.events) ? status.events : []
})

export const useIndexingController = ({
  bootingWorkspace,
  folders,
  foldersInitialized,
  syncSessionExpiry
}) => {
  const [indexingPaused, setIndexingPaused] = useState(() => readPausedFromStorage())
  const [indexingStatus, setIndexingStatus] = useState(EMPTY_INDEXING_STATUS)
  const autoStartInFlightRef = useRef(false)
  const indexingStatusRef = useRef(EMPTY_INDEXING_STATUS)

  const refreshIndexingStatus = useCallback(async () => {
    const response = await window.api.indexing.getStatus()
    if (!response?.success) {
      await syncSessionExpiry(response)
      return {
        success: false,
        message: getResponseErrorMessage(response, 'Unable to read indexing status.')
      }
    }

    setIndexingStatus(normalizeIndexingStatus(response.data?.status))

    return {
      success: true
    }
  }, [syncSessionExpiry])

  const startFolderIndexing = useCallback(
    async (inputFolders = folders) => {
      const response = await window.api.indexing.start(inputFolders)
      if (!response?.success) {
        const didExpire = await syncSessionExpiry(response)
        if (didExpire) {
          return {
            success: false,
            message: 'Session expired. Please sign in again.'
          }
        }

        return {
          success: false,
          message: getResponseErrorMessage(response, 'Unable to start indexing.')
        }
      }

      const nextStatus = normalizeIndexingStatus(response.data?.status)
      setIndexingStatus(nextStatus)

      return {
        success: true,
        message: nextStatus.message || 'Indexing started.'
      }
    },
    [folders, syncSessionExpiry]
  )

  const pauseIndexing = useCallback(async () => {
    const response = await window.api.indexing.stop()
    if (!response?.success) {
      const didExpire = await syncSessionExpiry(response)
      if (didExpire) {
        return {
          success: false,
          message: 'Session expired. Please sign in again.'
        }
      }

      return {
        success: false,
        message: getResponseErrorMessage(response, 'Unable to pause indexing.')
      }
    }

    setIndexingPaused(true)
    writePausedToStorage(true)
    setIndexingStatus(normalizeIndexingStatus(response.data?.status))

    return {
      success: true,
      message: 'Indexing paused.'
    }
  }, [syncSessionExpiry])

  const resumeIndexing = useCallback(async () => {
    setIndexingPaused(false)
    writePausedToStorage(false)

    if (indexingStatus.running) {
      return {
        success: true,
        message: 'Indexing is already running.'
      }
    }

    return startFolderIndexing(folders)
  }, [folders, indexingStatus.running, startFolderIndexing])

  const getIndexedChildren = useCallback(
    async (folderPath, basePath = '') => {
      const response = await window.api.indexing.getIndexedChildren(folderPath, basePath)
      if (!response?.success) {
        const didExpire = await syncSessionExpiry(response)
        if (didExpire) {
          return {
            success: false,
            message: 'Session expired. Please sign in again.',
            children: []
          }
        }

        return {
          success: false,
          message: getResponseErrorMessage(response, 'Unable to load indexed files.'),
          children: []
        }
      }

      return {
        success: true,
        folderPath: response.data?.folderPath || folderPath,
        basePath: response.data?.basePath || basePath || folderPath,
        children: Array.isArray(response.data?.children) ? response.data.children : []
      }
    },
    [syncSessionExpiry]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshIndexingStatus()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [refreshIndexingStatus])

  useEffect(() => {
    const statusPollInterval = window.setInterval(() => {
      const s = indexingStatusRef.current
      if (s.running || s.cancelling) {
        void refreshIndexingStatus()
      }
    }, STATUS_POLL_INTERVAL_MS)

    return () => window.clearInterval(statusPollInterval)
  }, [refreshIndexingStatus])

  useEffect(() => {
    indexingStatusRef.current = indexingStatus
  }, [indexingStatus])

  useEffect(() => {
    if (bootingWorkspace || !foldersInitialized || indexingPaused) {
      return
    }

    let disposed = false

    const runAutoStart = async () => {
      if (disposed || autoStartInFlightRef.current) {
        return
      }

      const latestStatus = indexingStatusRef.current
      if (latestStatus.running || latestStatus.cancelling) {
        return
      }

      autoStartInFlightRef.current = true
      try {
        await startFolderIndexing(folders)
      } finally {
        autoStartInFlightRef.current = false
      }
    }

    void runAutoStart()

    const intervalId = window.setInterval(() => {
      void runAutoStart()
    }, AUTO_INDEX_SCAN_INTERVAL_MS)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [bootingWorkspace, folders, foldersInitialized, indexingPaused, startFolderIndexing])

  return {
    indexingPaused,
    indexingStatus,
    refreshIndexingStatus,
    startFolderIndexing,
    pauseIndexing,
    resumeIndexing,
    getIndexedChildren
  }
}
