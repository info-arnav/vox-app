import { sendEmailMac, searchContactsMac } from './mac'
import { sendEmailWindows, searchContactsWindows } from './win'
import { sendEmailLinux, searchContactsLinux } from './linux'

const normalizeList = (v) => {
  if (!v) return []
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean)
  return String(v)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export const sendEmail = async (payload) => {
  const to = normalizeList(payload?.to)
  if (!to.length) throw new Error('"to" is required.')

  const args = {
    to,
    cc: normalizeList(payload?.cc),
    bcc: normalizeList(payload?.bcc),
    subject: String(payload?.subject || '').trim(),
    body: String(payload?.body ?? payload?.text ?? payload?.content ?? '').trim(),
    attachments: normalizeList(payload?.attachments ?? payload?.attachment)
  }

  if (process.platform === 'darwin') return sendEmailMac(args)
  if (process.platform === 'win32') return sendEmailWindows(args)
  return sendEmailLinux(args)
}

export const searchContacts = async (payload) => {
  const query = String(payload?.query ?? payload?.name ?? payload?.q ?? '').trim()
  if (!query) throw new Error('"query" is required.')

  let contacts = []
  if (process.platform === 'darwin') contacts = await searchContactsMac(query)
  else if (process.platform === 'win32') contacts = await searchContactsWindows(query)
  else contacts = await searchContactsLinux(query)

  return { query, count: contacts.length, contacts }
}
