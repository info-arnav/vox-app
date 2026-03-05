import { useCallback, useEffect, useState } from 'react'
import { getResponseErrorMessage } from '../../shared/hooks/useSessionRecovery'

export const useWorkspaceBootstrap = ({ sessionUser, syncSessionExpiry }) => {
  const [bootingWorkspace, setBootingWorkspace] = useState(true)
  const [workspaceError, setWorkspaceError] = useState('')
  const [user, setUser] = useState(sessionUser || null)
  const [models, setModels] = useState([])

  const loadWorkspace = useCallback(async () => {
    setWorkspaceError('')
    setBootingWorkspace(true)

    const response = await window.api.auth.getWorkspaceBootstrap()

    if (!response?.success) {
      const didExpire = await syncSessionExpiry(response)
      if (!didExpire) {
        setWorkspaceError(getResponseErrorMessage(response, 'Failed to load workspace data.'))
      }
      setBootingWorkspace(false)
      return {
        success: false
      }
    }

    setUser(response.data?.user || sessionUser || null)
    setModels(response.data?.models || [])
    setBootingWorkspace(false)

    return {
      success: true,
      user: response.data?.user || sessionUser || null,
      models: response.data?.models || []
    }
  }, [sessionUser, syncSessionExpiry])

  const refreshWorkspace = useCallback(async () => {
    const response = await window.api.auth.getWorkspaceBootstrap()

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
        message: getResponseErrorMessage(response, 'Unable to refresh workspace data.')
      }
    }

    const nextUser = response.data?.user || sessionUser || null
    const nextModels = response.data?.models || []

    setUser(nextUser)
    setModels(nextModels)

    return {
      success: true,
      user: nextUser,
      models: nextModels
    }
  }, [sessionUser, syncSessionExpiry])

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser || null)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWorkspace()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadWorkspace])

  return {
    bootingWorkspace,
    workspaceError,
    user,
    models,
    loadWorkspace,
    refreshWorkspace,
    updateUser
  }
}
