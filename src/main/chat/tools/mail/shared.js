import fs from 'fs/promises'
import os from 'os'
import path from 'path'

export const EXEC_TIMEOUT = 120_000

export const writeTempScript = async (content, ext) => {
  const file = path.join(
    os.tmpdir(),
    `vox_mail_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  )
  await fs.writeFile(file, content, 'utf8')
  return file
}

export const cleanupTemp = (file) => fs.unlink(file).catch(() => {})

export const parseTabSeparated = (stdout) =>
  String(stdout || '')
    .split('\n')
    .map((line) => {
      const [name, email, phone, company, jobTitle] = line.split('\t')
      const contact = { name: name?.trim(), email: email?.trim() || '' }
      if (phone?.trim()) contact.phone = phone.trim()
      if (company?.trim()) contact.company = company.trim()
      if (jobTitle?.trim()) contact.jobTitle = jobTitle.trim()
      return contact
    })
    .filter((r) => r.name)
