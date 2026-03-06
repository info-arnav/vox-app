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
      const telMatch = card.match(/^TEL[^:]*:(.+)$/im)
      const orgMatch = card.match(/^ORG[^:]*:(.+)$/im)
      const titleMatch = card.match(/^TITLE[^:]*:(.+)$/im)
      const phone = telMatch ? telMatch[1].trim() : ''
      const company = orgMatch ? orgMatch[1].trim().split(';')[0] : ''
      const jobTitle = titleMatch ? titleMatch[1].trim() : ''
      const emailMatches = [...card.matchAll(/^EMAIL[^:]*:(.+)$/gim)]
      if (emailMatches.length > 0) {
        for (const m of emailMatches) {
          const email = m[1].trim()
          if (email) {
            const contact = { name, email }
            if (phone) contact.phone = phone
            if (company) contact.company = company
            if (jobTitle) contact.jobTitle = jobTitle
            results.push(contact)
          }
        }
      } else if (phone || company) {
        const contact = { name, email: '' }
        if (phone) contact.phone = phone
        if (company) contact.company = company
        if (jobTitle) contact.jobTitle = jobTitle
        results.push(contact)
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
      if (nameMatch) {
        const name = nameMatch[1].trim()
        if (name.toLowerCase().includes(q)) {
          const email = emailMatch ? emailMatch[1].trim() : ''
          const phoneMatch = entry.match(/^phone=(.+)$/im)
          const contact = { name, email }
          if (phoneMatch) contact.phone = phoneMatch[1].trim()
          results.push(contact)
        }
      }
    }
  } catch {
    // abook not present
  }

  return results
}
