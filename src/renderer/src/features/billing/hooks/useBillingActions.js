import { useCallback } from 'react'
import { getResponseErrorMessage } from '../../../shared/hooks/useSessionRecovery'

export const useBillingActions = ({ refreshWorkspace, syncSessionExpiry }) => {
  const refreshCredits = useCallback(async () => {
    const result = await refreshWorkspace()

    if (!result?.success) {
      return {
        success: false,
        message: result?.message || 'Unable to refresh credits.'
      }
    }

    return {
      success: true,
      message: 'Credits refreshed.'
    }
  }, [refreshWorkspace])

  const startCheckout = useCallback(
    async (credits) => {
      const response = await window.api.billing.startCheckout(credits)
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
          message: getResponseErrorMessage(response, 'Unable to start checkout.')
        }
      }

      return {
        success: true,
        url: response.data?.url || '',
        credits: response.data?.credits || credits,
        message: 'Checkout opened in your browser.'
      }
    },
    [syncSessionExpiry]
  )

  return {
    refreshCredits,
    startCheckout
  }
}
