import { useCallback, useEffect, useState } from 'react'
import { getResponseErrorMessage } from '../../../shared/hooks/useSessionRecovery'

export const FOLDERS_STORAGE_KEY = 'vox.workspace.folders'

const readStoredFolders = () => {
  if (typeof window === 'undefined') {
    return {
      hasValue: false,
      folders: []
    }
  }

  const rawValue = window.localStorage.getItem(FOLDERS_STORAGE_KEY)
  if (rawValue === null) {
    return {
      hasValue: false,
      folders: []
    }
  }

  try {
    const parsedValue = JSON.parse(rawValue)
    if (!Array.isArray(parsedValue)) {
      return {
        hasValue: true,
        folders: []
      }
    }

    return {
      hasValue: true,
      folders: parsedValue.filter((item) => typeof item === 'string' && item.trim())
    }
  } catch {
    return {
      hasValue: false,
      folders: []
    }
  }
}

const writeFoldersToStorage = (folders) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders))
}

export const useFoldersStore = ({ syncSessionExpiry }) => {
  const [storedResult] = useState(readStoredFolders)
  const [folders, setFolders] = useState(storedResult.folders)
  const [foldersInitialized, setFoldersInitialized] = useState(storedResult.hasValue)

  const addFolder = useCallback(
    (folderPath) => {
      const normalizedPath = String(folderPath || '').trim()

      if (!normalizedPath) {
        return {
          success: false,
          message: 'Folder path is required.'
        }
      }

      const alreadyExists = folders.some(
        (folder) => folder.toLowerCase() === normalizedPath.toLowerCase()
      )
      if (alreadyExists) {
        return {
          success: false,
          message: 'Folder already exists in access list.'
        }
      }

      const nextFolders = [...folders, normalizedPath]
      setFolders(nextFolders)
      writeFoldersToStorage(nextFolders)
      setFoldersInitialized(true)

      return {
        success: true,
        message: 'Folder added.'
      }
    },
    [folders]
  )

  const removeFolder = useCallback(
    async (folderPath) => {
      const nextFolders = folders.filter((folder) => folder !== folderPath)

      if (nextFolders.length === folders.length) {
        return {
          success: false,
          message: 'Folder not found.'
        }
      }

      const response = await window.api.indexing.removeFolderData(folderPath)
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
          message: getResponseErrorMessage(response, 'Unable to remove indexed folder data.')
        }
      }

      setFolders(nextFolders)
      writeFoldersToStorage(nextFolders)
      setFoldersInitialized(true)

      return {
        success: true,
        message: 'Folder removed. Indexed data cleanup queued in background.'
      }
    },
    [folders, syncSessionExpiry]
  )

  const pickAndAddFolder = useCallback(async () => {
    const response = await window.api.indexing.pickFolder()
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
        message: getResponseErrorMessage(response, 'Unable to open folder picker.')
      }
    }

    const pickedPath = String(response.data?.path || '').trim()
    if (!pickedPath) {
      return {
        success: false,
        message: 'Folder selection cancelled.'
      }
    }

    return addFolder(pickedPath)
  }, [addFolder, syncSessionExpiry])

  useEffect(() => {
    if (foldersInitialized) {
      return
    }

    let disposed = false

    const seedDefaultFolders = async () => {
      const response = await window.api.indexing.getDefaultFolders()
      if (!response?.success) {
        if (!disposed) {
          setFoldersInitialized(true)
        }
        return
      }

      const defaultFolders = Array.isArray(response.data?.folders)
        ? response.data.folders.filter((item) => typeof item === 'string' && item.trim())
        : []

      if (disposed) {
        return
      }

      setFolders(defaultFolders)
      writeFoldersToStorage(defaultFolders)
      setFoldersInitialized(true)
    }

    void seedDefaultFolders()

    return () => {
      disposed = true
    }
  }, [foldersInitialized])

  return {
    folders,
    foldersInitialized,
    addFolder,
    removeFolder,
    pickAndAddFolder
  }
}
