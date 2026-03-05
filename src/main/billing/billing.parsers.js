import { createError } from '../auth/auth.error'

const MIN_CREDITS = 1000

export const parseCreditsRequest = (value) => {
  const credits = Number(value)

  if (!Number.isInteger(credits) || credits < MIN_CREDITS) {
    throw createError('VALIDATION_ERROR', `Credits must be an integer of at least ${MIN_CREDITS}.`)
  }

  return credits
}

export const parseCheckoutUrl = (payload) => {
  const url = payload?.data?.url

  if (!url || typeof url !== 'string') {
    throw createError('INVALID_RESPONSE', 'Missing checkout URL in billing response.')
  }

  return url
}
