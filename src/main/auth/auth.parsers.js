import { createError } from './auth.error'

const toTrimmedString = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

const toNumber = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

const toOptionalModel = (value) => {
  if (!value || typeof value !== 'object') {
    return null
  }

  if (!value.id) {
    return null
  }

  return {
    id: value.id,
    provider: toTrimmedString(value.provider),
    modelId: toTrimmedString(value.model_id || value.modelId),
    displayName: toTrimmedString(value.display_name || value.displayName)
  }
}

export const parseUserProfile = (user, context) => {
  if (!user?.id || !user?.email) {
    throw createError('INVALID_RESPONSE', `Missing user profile in ${context} response.`)
  }

  return {
    id: user.id,
    email: user.email,
    verified: Boolean(user.verified),
    firstName: toTrimmedString(user.first_name || user.firstName),
    lastName: toTrimmedString(user.last_name || user.lastName),
    creditsBalance: toNumber(user.credits_balance || user.creditsBalance),
    preferredModelId: user.preferred_model_id || user.preferredModelId || '',
    preferredModel: toOptionalModel(user.preferred_model || user.preferredModel)
  }
}

export const parseModelList = (value, context = 'model list') => {
  if (!Array.isArray(value)) {
    throw createError('INVALID_RESPONSE', `Missing ${context} response payload.`)
  }

  return value
    .filter((item) => item && typeof item === 'object' && item.id)
    .map((item) => ({
      id: item.id,
      provider: toTrimmedString(item.provider),
      modelId: toTrimmedString(item.model_id || item.modelId),
      displayName: toTrimmedString(item.display_name || item.displayName),
      active: item.active !== false
    }))
}

export const parseLoginPayload = (payload) => {
  const accessToken = payload?.data?.access_token
  const user = parseUserProfile(payload?.data?.data, 'login')

  if (!accessToken) {
    throw createError('INVALID_RESPONSE', 'Missing access token in login response.')
  }

  return { accessToken, user }
}
