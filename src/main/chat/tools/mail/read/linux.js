import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec)

const findMboxFiles = async (folder) => {
  const home = os.homedir()
  const folderLower = folder.toLowerCase()
  const candidates = [
    path.join(home, '.thunderbird'),
    path.join(home, 'snap', 'thunderbird', 'current', '.thunderbird'),
    path.join(home, '.var', 'app', 'org.mozilla.Thunderbird', '.thunderbird')
  ]

  for (const base of candidates) {
    try {
      const { stdout } = await execAsync(
        `find "${base}" -maxdepth 4 -type f ! -name "*.msf" ! -name "*.sqlite" 2>/dev/null | grep -i "${folderLower}" | head -5`,
        { timeout: 5_000 }
      )
      const files = stdout.trim().split('\n').filter(Boolean)
      if (files.length) return files
    } catch {
      // directory doesn't exist or find failed
    }
  }

  const systemMbox = path.join('/var/mail', os.userInfo().username)
  try {
    await fs.access(systemMbox)
    return [systemMbox]
  } catch {
    // no system mbox
  }

  return []
}

const parseMbox = (content, { limit, unreadOnly, search }) => {
  const lower = search.toLowerCase()
  const results = []
  const messages = content.split(/^From /m).slice(1)

  for (const raw of messages) {
    if (results.length >= limit) break
    const [headerBlock = ''] = raw.split(/^\r?\n/m)
    const headers = {}
    for (const line of headerBlock.split('\n')) {
      const m = line.match(/^([\w-]+):\s*(.+)/)
      if (m) headers[m[1].toLowerCase()] = m[2].trim()
    }
    const sender = headers['from'] || ''
    const subject = headers['subject'] || '(no subject)'
    const date = headers['date'] || ''
    const read = headers['status']?.includes('R') ? 'read' : 'unread'

    if (unreadOnly && read !== 'unread') continue
    if (lower && !sender.toLowerCase().includes(lower) && !subject.toLowerCase().includes(lower))
      continue

    results.push({ sender, subject, date, read })
  }

  return results
}

export const readEmailsLinux = async ({ folder, limit, unreadOnly, search }) => {
  const files = await findMboxFiles(folder)
  if (!files.length) {
    throw new Error(
      'No local mail store found. Thunderbird, Evolution, or a system mbox is required.'
    )
  }

  const results = []
  for (const file of files) {
    if (results.length >= limit) break
    try {
      const content = await fs.readFile(file, 'utf8')
      const parsed = parseMbox(content, { limit: limit - results.length, unreadOnly, search })
      results.push(...parsed)
    } catch {
      // unreadable file, skip
    }
  }

  return results
}

export const getEmailBodyLinux = async ({ sender = '', subject = '' } = {}) => {
  const mboxRoots = [
    path.join(os.homedir(), 'Maildir'),
    '/var/mail',
    path.join(os.homedir(), 'mail')
  ]

  const sQ = sender.toLowerCase()
  const subQ = subject.toLowerCase()

  for (const dir of mboxRoots) {
    try {
      await fs.access(dir)
    } catch {
      continue
    }
    const files = await findMboxFiles(dir)
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8')
        const messages = content.split(/^From /m).slice(1)
        for (const msg of messages) {
          const headerEnd = msg.indexOf('\n\n')
          if (headerEnd === -1) continue
          const headers = msg.slice(0, headerEnd).toLowerCase()
          const body = msg.slice(headerEnd + 2)
          const senderOk = !sQ || headers.includes(sQ)
          const subjectOk = !subQ || headers.includes(subQ)
          if (senderOk && subjectOk) return { found: true, body: body.slice(0, 8000) }
        }
      } catch {
        // unreadable
      }
    }
  }
  return { found: false, body: null }
}
