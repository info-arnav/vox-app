import { useCallback } from 'react'

const AUTH_RECOVERY_ERROR_CODES = new Set([
  'NOT_AUTHENTICATED',
  'INVALID_SESSION',
  'INVALID_DEVICE'
])

export const getResponseErrorMessage = (response, fallbackMessage) =>
  response?.error?.message || fallbackMessage

export const isAuthExpiredResponse = (response) =>
  AUTH_RECOVERY_ERROR_CODES.has(response?.error?.code)

export const useSessionRecovery = (onSessionExpired) => {
  return useCallback(
    async (response) => {
      if (!isAuthExpiredResponse(response)) {
        return false
      }

      await onSessionExpired?.()
      return true
    },
    [onSessionExpired]
  )
}
