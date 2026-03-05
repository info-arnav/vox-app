const state = {
  accessToken: null,
  user: null,
  lastLoginAt: null
}

let _expiredListeners = []

export const onAuthExpired = (cb) => {
  _expiredListeners.push(cb)
  return () => {
    _expiredListeners = _expiredListeners.filter((l) => l !== cb)
  }
}

export const createSession = () => ({
  authenticated: Boolean(state.accessToken && state.user),
  user: state.user,
  lastLoginAt: state.lastLoginAt
})

export const clearState = () => {
  state.accessToken = null
  state.user = null
  state.lastLoginAt = null
}

export const expireAuthSession = () => {
  const wasAuthenticated = Boolean(state.accessToken)
  clearState()
  if (wasAuthenticated) {
    _expiredListeners.forEach((cb) => cb())
  }
}

export const setAuthSession = ({ accessToken, user }) => {
  state.accessToken = accessToken
  state.user = user
  state.lastLoginAt = new Date().toISOString()

  return createSession()
}

export const setAccessToken = (accessToken) => {
  state.accessToken = accessToken || null
}

export const setUser = (user) => {
  state.user = user || null
}

export const getAccessToken = () => state.accessToken
