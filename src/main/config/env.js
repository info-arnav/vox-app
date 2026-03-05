import { app } from 'electron'

const DEV_API_BASE_URL = 'http://localhost:8000'
const PROD_API_BASE_URL = 'https://api.vox-ai.chat'
const DEV_WS_BASE_URL = 'ws://localhost:17300'

const isDevelopment = () => !app.isPackaged || process.env.NODE_ENV === 'development'

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '')

const toWebSocketBaseUrl = (baseUrl) => {
  try {
    const parsed = new URL(baseUrl)
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    return trimTrailingSlash(parsed.toString())
  } catch {
    return trimTrailingSlash(baseUrl).replace(/^http/i, 'ws')
  }
}

export const API_BASE_URL =
  import.meta.env.VOX_API_BASE_URL ||
  process.env.VOX_API_BASE_URL ||
  (isDevelopment() ? DEV_API_BASE_URL : PROD_API_BASE_URL)

export const WS_BASE_URL = trimTrailingSlash(
  import.meta.env.VOX_WS_BASE_URL ||
    process.env.VOX_WS_BASE_URL ||
    (isDevelopment() ? DEV_WS_BASE_URL : toWebSocketBaseUrl(PROD_API_BASE_URL))
)

export { DEV_API_BASE_URL, PROD_API_BASE_URL }
