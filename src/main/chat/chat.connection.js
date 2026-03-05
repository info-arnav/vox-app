import WebSocket from 'ws'
import { createError } from '../auth/auth.error'
import { refreshAccessToken } from '../auth/auth.refresh'
import { getAccessToken } from '../auth/auth.state'
import { WS_BASE_URL } from '../config/env'

export const CONNECT_TIMEOUT_MS = 15000

export const normalizeCloseReason = (reason) => {
  if (typeof reason === 'string') return reason
  if (Buffer.isBuffer(reason)) return reason.toString('utf8')
  return ''
}

export const isAuthClose = (code, reason) => {
  const numericCode = Number(code) || 0
  if ([4001, 4003, 4401, 4403].includes(numericCode)) return true

  const normalizedReason = String(reason || '')
    .trim()
    .toLowerCase()

  if (!normalizedReason) return numericCode === 1008

  if (
    normalizedReason.includes('401') ||
    normalizedReason.includes('unauthorized') ||
    normalizedReason.includes('not authenticated') ||
    normalizedReason.includes('session expired') ||
    normalizedReason.includes('session ended') ||
    normalizedReason.includes('token expired') ||
    normalizedReason.includes('invalid token')
  ) {
    return true
  }

  return numericCode === 1008 && normalizedReason.includes('token')
}

export const isAuthErrorEvent = (event) => {
  const data = event?.data && typeof event.data === 'object' ? event.data : {}
  const numericStatus = Number(data?.status || data?.statusCode || 0) || 0
  const normalizedCode = String(data?.code || '')
    .trim()
    .toLowerCase()
  const normalizedMessage = String(data?.message || '')
    .trim()
    .toLowerCase()

  if (numericStatus === 401) return true

  if (
    normalizedCode === 'not_authenticated' ||
    normalizedCode === 'invalid_session' ||
    normalizedCode.includes('unauthorized') ||
    normalizedCode.includes('token_expired') ||
    normalizedCode.includes('session_expired')
  ) {
    return true
  }

  return isAuthClose(numericStatus, normalizedMessage)
}

export const buildWebSocketUrl = (token) => `${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}`

export const createHandshakeError = (statusCode) => {
  const status = Number(statusCode) || null
  if (status === 401) {
    return createError('NOT_AUTHENTICATED', 'Session expired. Please sign in again.', 401)
  }

  return createError(
    'REQUEST_FAILED',
    `Chat connection failed with status ${status || 'unknown'}.`,
    status
  )
}

export const openSocket = (accessToken) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(buildWebSocketUrl(accessToken))
    let settled = false

    const cleanup = () => {
      clearTimeout(timeout)
      socket.removeListener('open', handleOpen)
      socket.removeListener('unexpected-response', handleUnexpectedResponse)
      socket.removeListener('error', handleError)
      socket.removeListener('close', handleClose)
    }

    const resolveOnce = (value) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }

    const rejectOnce = (error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const handleOpen = () => resolveOnce(socket)

    const handleUnexpectedResponse = (_request, response) => {
      response?.resume?.()
      try {
        socket.terminate()
      } catch (error) {
        void error
      }
      rejectOnce(createHandshakeError(response?.statusCode))
    }

    const handleError = (error) =>
      rejectOnce(
        createError(
          'NETWORK_ERROR',
          error?.message || 'Unable to connect to Vox chat service. Check your connection.'
        )
      )

    const handleClose = (code, reason) => {
      const message = normalizeCloseReason(reason) || `Chat connection closed (${code}).`
      const closeError = createError(
        'CONNECTION_CLOSED',
        message,
        isAuthClose(code, message) ? 401 : null
      )
      closeError.closeCode = code
      rejectOnce(closeError)
    }

    const timeout = setTimeout(() => {
      try {
        socket.terminate()
      } catch (error) {
        void error
      }
      rejectOnce(createError('REQUEST_TIMEOUT', 'Chat connection timed out.'))
    }, CONNECT_TIMEOUT_MS)

    socket.once('open', handleOpen)
    socket.once('unexpected-response', handleUnexpectedResponse)
    socket.once('error', handleError)
    socket.once('close', handleClose)
  })

export const connectWithAuthRetry = async () => {
  const currentToken = getAccessToken() || (await refreshAccessToken())

  try {
    return await openSocket(currentToken)
  } catch (error) {
    const isAuthFailure = error?.status === 401 || isAuthClose(error?.closeCode, error?.message)
    if (!isAuthFailure) throw error
    const refreshedToken = await refreshAccessToken()
    return openSocket(refreshedToken)
  }
}
