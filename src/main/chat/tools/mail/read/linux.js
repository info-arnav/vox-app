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
