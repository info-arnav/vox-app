import { promisify } from 'util'
import { exec } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { resolveLocalPath } from '../../shared'

const execAsync = promisify(exec)

export const sendEmailLinux = async ({ to, cc, bcc, subject, body, attachments }) => {
  const hasThunderbird = await execAsync('which thunderbird', { timeout: 3_000 })
    .then(() => true)
    .catch(() => false)

  if (hasThunderbird) {
    const parts = [
      `to='${to.join(',')}'`,
      subject ? `subject='${subject.replace(/'/g, "\\'")}'` : null,
      body ? `body='${body.replace(/'/g, "\\'")}'` : null,
      cc.length ? `cc='${cc.join(',')}'` : null,
      bcc.length ? `bcc='${bcc.join(',')}'` : null,
      ...attachments.map((p) => `attachment='file://${resolveLocalPath(p)}'`)
    ]
      .filter(Boolean)
      .join(',')

    await execAsync(`thunderbird -compose "${parts}"`, { timeout: 5_000 }).catch(() => {})
    return { status: 'opened', to, subject, platform: 'Linux Thunderbird (compose window opened)' }
  }

  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  if (cc.length) params.set('cc', cc.join(','))
  if (bcc.length) params.set('bcc', bcc.join(','))
  const mailtoUrl = `mailto:${to.join(',')}?${params.toString()}`
  await execAsync(`xdg-open '${mailtoUrl.replace(/'/g, "'\\''")}'`, { timeout: 5_000 })

  return {
    status: 'opened',
    to,
    subject,
    platform: 'Linux default mail client via xdg-open (draft opened — please click Send)'
  }
}

export const searchContactsLinux = async (query) => {
  const q = query.toLowerCase()
  const results = []

  const vcfRoots = [
    path.join(os.homedir(), '.local/share/gnome-contacts'),
    path.join(os.homedir(), '.local/share/evolution/addressbook'),
    path.join(os.homedir(), 'Contacts')
  ]

  const parseVcfContent = (content) => {
    const cards = content.split(/BEGIN:VCARD/i).slice(1)
    for (const card of cards) {
      const fnMatch = card.match(/^FN[^:]*:(.+)$/im)
      const name = fnMatch ? fnMatch[1].trim() : null
      if (!name || !name.toLowerCase().includes(q)) continue
      for (const m of [...card.matchAll(/^EMAIL[^:]*:(.+)$/gim)]) {
        const email = m[1].trim()
        if (email) results.push({ name, email })
      }
    }
  }

  const walkDir = async (dir) => {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walkDir(full)
      } else if (entry.name.endsWith('.vcf')) {
        const content = await fs.readFile(full, 'utf8').catch(() => null)
        if (content) parseVcfContent(content)
      }
    }
  }

  for (const root of vcfRoots) {
    await walkDir(root)
  }

  try {
    const abookPath = path.join(os.homedir(), '.abook/addressbook')
    const content = await fs.readFile(abookPath, 'utf8')
    for (const entry of content.split(/^\[/m).slice(1)) {
      const nameMatch = entry.match(/^name=(.+)$/im)
      const emailMatch = entry.match(/^email=(.+)$/im)
      if (nameMatch && emailMatch) {
        const name = nameMatch[1].trim()
        const email = emailMatch[1].trim()
        if (name.toLowerCase().includes(q)) results.push({ name, email })
      }
    }
  } catch {
    // abook not present
  }

  return results
}
