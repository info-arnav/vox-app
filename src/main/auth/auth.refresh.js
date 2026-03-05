import { createError } from './auth.error'
import { requestJson } from './auth.http'
import { parseUserProfile } from './auth.parsers'
import { expireAuthSession, getAccessToken, setAccessToken, setUser } from './auth.state'

const INVALID_SESSION_CODES = new Set([
  'NOT_AUTHENTICATED',
  'INVALID_SESSION',
  'INVALID_DEVICE',
  'VALIDATION_ERROR'
])

const PROACTIVE_REFRESH_MS = 13 * 60 * 1000

let _refreshPromise = null
let _refreshTimer = null

export const scheduleProactiveRefresh = () => {
  if (_refreshTimer) clearTimeout(_refreshTimer)
  _refreshTimer = setTimeout(async () => {
    _refreshTimer = null
    try {
      await refreshAccessToken()
    } catch (error) {
      void error
    }
  }, PROACTIVE_REFRESH_MS)
}

export const cancelScheduledRefresh = () => {
  if (_refreshTimer) {
    clearTimeout(_refreshTimer)
    _refreshTimer = null
  }
}

const requireAccessToken = () => {
  const accessToken = getAccessToken()
  if (!accessToken) {
    throw createError('NOT_AUTHENTICATED', 'Session expired. Please sign in again.')
  }

  return accessToken
}

export const refreshAccessToken = async () => {
  if (_refreshPromise) return _refreshPromise

  _refreshPromise = (async () => {
    try {
      const payload = await requestJson('/auth/session/refresh', {
        method: 'POST'
      })

      const accessToken = payload?.data?.access_token
      const user = payload?.data?.user

      if (!accessToken) {
        throw createError('INVALID_RESPONSE', 'Missing access token in refresh response.')
      }

      if (user) {
        setUser(parseUserProfile(user, 'refresh'))
      }

      setAccessToken(accessToken)
      scheduleProactiveRefresh()
      return accessToken
    } catch (error) {
      const isSessionExpired = error?.status === 401 || INVALID_SESSION_CODES.has(error?.code)
      if (isSessionExpired) {
        expireAuthSession()
        throw createError('NOT_AUTHENTICATED', 'Session expired. Please sign in again.', 401)
      }

      throw error
    } finally {
      _refreshPromise = null
    }
  })()

  return _refreshPromise
}

export const authorizedRequestJson = async (path, options = {}, canRetry = true) => {
  if (!getAccessToken()) {
    await refreshAccessToken()
  }

  try {
    return await requestJson(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${requireAccessToken()}`
      }
    })
  } catch (error) {
    if (!canRetry || error?.status !== 401) {
      throw error
    }

    await refreshAccessToken()
    return authorizedRequestJson(path, options, false)
  }
}
