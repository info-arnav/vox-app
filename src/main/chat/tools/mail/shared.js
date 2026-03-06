import fs from 'fs/promises'
import os from 'os'
import path from 'path'

export const EXEC_TIMEOUT = 30_000

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
      const [name, email] = line.split('\t')
      return { name: name?.trim(), email: email?.trim() }
    })
    .filter((r) => r.name && r.email)
