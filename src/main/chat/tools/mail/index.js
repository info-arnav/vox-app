import { sendEmailMac, searchContactsMac } from './send/mac'
import { sendEmailWindows, searchContactsWindows } from './send/win'
import { sendEmailLinux, searchContactsLinux } from './send/linux'
import { readEmailsMac, getEmailBodyMac } from './read/mac'
import { readEmailsWindows, getEmailBodyWindows } from './read/win'
import { readEmailsLinux, getEmailBodyLinux } from './read/linux'

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

export const readEmails = async (payload) => {
  const folder = String(payload?.folder ?? 'INBOX').trim()
  const limit = Math.min(Math.max(1, Number(payload?.limit ?? 10)), 50)
  const unreadOnly = Boolean(payload?.unread_only ?? payload?.unreadOnly ?? false)
  const search = String(payload?.search ?? '').trim()
  const args = { folder, limit, unreadOnly, search }

  let messages = []
  if (process.platform === 'darwin') messages = await readEmailsMac(args)
  else if (process.platform === 'win32') messages = await readEmailsWindows(args)
  else messages = await readEmailsLinux(args)

  return { folder, count: messages.length, messages }
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

export const getEmailBody = async (payload) => {
  const sender = String(payload?.sender ?? payload?.from ?? '').trim()
  const subject = String(payload?.subject ?? '').trim()
  const args = { sender, subject }

  if (process.platform === 'darwin') return getEmailBodyMac(args)
  if (process.platform === 'win32') return getEmailBodyWindows(args)
  return getEmailBodyLinux(args)
}
