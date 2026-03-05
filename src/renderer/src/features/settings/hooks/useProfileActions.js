import { useCallback } from 'react'
import { getResponseErrorMessage } from '../../../shared/hooks/useSessionRecovery'

export const useProfileActions = ({ currentUser, onUserUpdated, syncSessionExpiry }) => {
  const saveProfile = useCallback(
    async (payload) => {
      const response = await window.api.auth.updateWorkspaceProfile(payload || {})
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
          message: getResponseErrorMessage(response, 'Unable to update profile settings.')
        }
      }

      const nextUser = response.data?.user || currentUser
      onUserUpdated?.(nextUser)

      return {
        success: true,
        user: nextUser,
        message: 'Settings saved.'
      }
    },
    [currentUser, onUserUpdated, syncSessionExpiry]
  )

  return {
    saveProfile
  }
}
