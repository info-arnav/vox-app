import { createError } from './auth.error'
import { requestJson } from './auth.http'
import { parseLoginPayload, parseModelList, parseUserProfile } from './auth.parsers'
import {
  authorizedRequestJson,
  cancelScheduledRefresh,
  refreshAccessToken,
  scheduleProactiveRefresh
} from './auth.refresh'
import { clearState, createSession, setAuthSession, setUser } from './auth.state'

const normalizeCredentials = ({ email, password }) => {
  const normalizedEmail = String(email || '').trim()
  const normalizedPassword = String(password || '')

  if (!normalizedEmail || !normalizedPassword) {
    throw createError('VALIDATION_ERROR', 'Email and password are required.')
  }

  return {
    email: normalizedEmail,
    password: normalizedPassword
  }
}

const authenticateWithPassword = async (path, credentials) => {
  const payload = await requestJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  })

  const { accessToken, user } = parseLoginPayload(payload)
  const session = setAuthSession({ accessToken, user })
  scheduleProactiveRefresh()
  return session
}

export const login = async (credentials) =>
  authenticateWithPassword('/auth/password/login', normalizeCredentials(credentials))

export const register = async (credentials) =>
  authenticateWithPassword('/auth/password/register', normalizeCredentials(credentials))

export const resendVerification = async () => {
  const payload = await authorizedRequestJson('/auth/verification/resend', {
    method: 'POST'
  })

  return {
    message: payload?.data?.message || 'Verification email sent.'
  }
}

export const refreshVerificationStatus = async () => {
  const payload = await authorizedRequestJson('/user/get-info')
  setUser(parseUserProfile(payload?.data, 'user info'))
  return createSession()
}

const normalizeOptionalString = (value) => (typeof value === 'string' ? value.trim() : undefined)

export const getWorkspaceBootstrap = async () => {
  const [userPayload, modelsPayload] = await Promise.all([
    authorizedRequestJson('/user/get-info'),
    requestJson('/models')
  ])

  const user = parseUserProfile(userPayload?.data, 'workspace user')
  setUser(user)

  const models = parseModelList(modelsPayload?.data, 'models')

  return {
    user,
    models
  }
}

export const updateWorkspaceProfile = async (payload) => {
  const firstName = normalizeOptionalString(payload?.firstName)
  const lastName = normalizeOptionalString(payload?.lastName)
  const preferredModelId = payload?.preferredModelId || ''

  const requestBody = {
    preferred_model_id: preferredModelId || null
  }

  if (firstName !== undefined) {
    requestBody.first_name = firstName
  }

  if (lastName !== undefined) {
    requestBody.last_name = lastName
  }

  const response = await authorizedRequestJson('/user', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  const user = parseUserProfile(response?.data, 'workspace profile update')
  setUser(user)
  return { user }
}

export const logout = async () => {
  cancelScheduledRefresh()

  try {
    await requestJson('/auth/session/logout', {
      method: 'POST'
    })
  } catch (error) {
    void error
  }

  clearState()
  return createSession()
}

export const getSession = async () => {
  const currentSession = createSession()
  if (currentSession.authenticated) {
    return currentSession
  }

  try {
    await refreshAccessToken()
  } catch (error) {
    if (error?.status !== 401 && error?.code !== 'NOT_AUTHENTICATED') {
      throw error
    }
  }

  return createSession()
}
