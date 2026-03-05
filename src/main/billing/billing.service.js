import { shell } from 'electron'
import { authorizedRequestJson } from '../auth/auth.refresh'
import { parseCheckoutUrl, parseCreditsRequest } from './billing.parsers'

export const startCheckout = async (creditsInput) => {
  const credits = parseCreditsRequest(creditsInput)

  const payload = await authorizedRequestJson('/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credits })
  })

  const url = parseCheckoutUrl(payload)
  await shell.openExternal(url)

  return {
    url,
    credits
  }
}
