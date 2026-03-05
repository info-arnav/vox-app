import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { clampNumber, resolveLocalPath } from './desktop.tool.shared'

export const listLocalDirectory = async (payload) => {
  const targetPath = payload?.path ? resolveLocalPath(payload.path) : os.homedir()
  const includeHidden = Boolean(payload?.includeHidden)
  const includeDetails = payload?.includeDetails !== false
  const limit = clampNumber(payload?.limit, 300, 1, 2000)

  const directoryStats = await fs.stat(targetPath)
  if (!directoryStats.isDirectory()) {
    throw new Error('Path is not a directory.')
  }

  const rawEntries = await fs.readdir(targetPath, { withFileTypes: true })
  const visibleEntries = rawEntries.filter((entry) => includeHidden || !entry.name.startsWith('.'))

  visibleEntries.sort((first, second) => {
    const firstTypeScore = first.isDirectory() ? 0 : 1
    const secondTypeScore = second.isDirectory() ? 0 : 1
    if (firstTypeScore !== secondTypeScore) {
      return firstTypeScore - secondTypeScore
    }

    return first.name.localeCompare(second.name)
  })

  const selectedEntries = visibleEntries.slice(0, limit)
  const entries = await Promise.all(
    selectedEntries.map(async (entry) => {
      const entryPath = path.join(targetPath, entry.name)
      const type = entry.isDirectory()
        ? 'directory'
        : entry.isFile()
          ? 'file'
          : entry.isSymbolicLink()
            ? 'symlink'
            : 'other'
      const item = {
        name: entry.name,
        path: entryPath,
        type
      }

      if (!includeDetails) {
        return item
      }

      try {
        const entryStats = await fs.stat(entryPath)
        return {
          ...item,
          size: entryStats.size,
          modifiedAt: entryStats.mtime.toISOString()
        }
      } catch {
        return item
      }
    })
  )

  return {
    path: targetPath,
    includeHidden,
    total: visibleEntries.length,
    returned: entries.length,
    truncated: visibleEntries.length > entries.length,
    entries
  }
}

export const deleteLocalPath = async (payload) => {
  const targetPath = resolveLocalPath(payload?.path)
  const recursive = payload?.recursive !== false
  const force = Boolean(payload?.force)
  const dryRun = Boolean(payload?.dryRun)

  let existingStats = null
  try {
    existingStats = await fs.lstat(targetPath)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        path: targetPath,
        existed: false,
        deleted: false,
        type: 'missing',
        dryRun
      }
    }

    throw error
  }

  const type = existingStats.isDirectory()
    ? 'directory'
    : existingStats.isFile()
      ? 'file'
      : existingStats.isSymbolicLink()
        ? 'symlink'
        : 'other'

  if (dryRun) {
    return {
      path: targetPath,
      existed: true,
      deleted: false,
      type,
      dryRun: true,
      recursive: existingStats.isDirectory() ? recursive : false,
      force
    }
  }

  if (existingStats.isDirectory()) {
    if (!recursive) {
      throw new Error('Path is a directory. Set recursive=true to delete directories.')
    }

    await fs.rm(targetPath, { recursive: true, force })
  } else {
    try {
      await fs.unlink(targetPath)
    } catch (error) {
      if (!(force && error?.code === 'ENOENT')) {
        throw error
      }
    }
  }

  return {
    path: targetPath,
    existed: true,
    deleted: true,
    type,
    recursive: existingStats.isDirectory() ? recursive : false,
    force
  }
}
