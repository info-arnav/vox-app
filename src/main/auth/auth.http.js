import { net } from 'electron'
import { API_BASE_URL } from '../config/env'
import { createError } from './auth.error'

const REQUEST_TIMEOUT_MS = 15000

const parseJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export const requestJson = async (path, options = {}) => {
  const { headers = {}, ...requestOptions } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response
  try {
    response = await net.fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers,
      credentials: 'include',
      signal: controller.signal
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createError('REQUEST_TIMEOUT', 'Request timed out. Please try again.')
    }

    throw createError(
      'NETWORK_ERROR',
      'Unable to reach Vox API. Check your connection and try again.'
    )
  } finally {
    clearTimeout(timeout)
  }

  const payload = await parseJson(response)

  if (!response.ok) {
    const serverError = payload?.error
    throw createError(
      serverError?.code || 'REQUEST_FAILED',
      serverError?.message || `Request failed with status ${response.status}`,
      response.status
    )
  }

  return payload
}
