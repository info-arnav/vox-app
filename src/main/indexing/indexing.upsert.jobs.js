import path from 'node:path'
import { stat } from 'node:fs/promises'
import { authorizedRequestJson } from '../auth/auth.refresh'
import { MAX_RETRY_ATTEMPTS } from './indexing.constants'
import {
  detectFileKind,
  getImageMimeType,
  isUnchangedFile,
  readImageFileForIndex,
  readTextFileForIndex
} from './indexing.files'
import { walkFiles } from './indexing.walker'
import { appendEvent, delay, setStatus, state } from './indexing.state'
import { isRetriableError } from './indexing.utils'
import { queueManifestFlush, updateManifestEntry } from './indexing.manifest.flush'

const upsertTextDocument = async (job) => {
  const textReadResult = await readTextFileForIndex(job.filePath)

  if (textReadResult.containsBinary || !String(textReadResult.text || '').trim()) {
    setStatus({
      skippedUnsupported: state.indexingStatus.skippedUnsupported + 1
    })

    return { indexed: false }
  }

  await authorizedRequestJson('/index/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: job.filePath,
      text: textReadResult.text,
      metadata: {
        source: 'electron-desktop',
        truncated: textReadResult.truncated,
        file_size: Number(job.fileStats.size),
        mtime_ms: Number(job.fileStats.mtimeMs)
      }
    })
  })

  updateManifestEntry(job)
  return { indexed: true }
}

const upsertImageDocument = async (job) => {
  const imageReadResult = await readImageFileForIndex(job.filePath, Number(job.fileStats.size))
  if (imageReadResult.skipped) {
    setStatus({
      skippedUnsupported: state.indexingStatus.skippedUnsupported + 1
    })

    appendEvent(
      'warning',
      `Skipped image: ${path.basename(job.filePath)} (${imageReadResult.reason})`
    )
    return { indexed: false }
  }

  await authorizedRequestJson('/index/upsert-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: job.filePath,
      image: imageReadResult.base64,
      mimeType: getImageMimeType(job.filePath),
      metadata: {
        source: 'electron-desktop',
        file_size: Number(job.fileStats.size),
        mtime_ms: Number(job.fileStats.mtimeMs)
      }
    })
  })

  updateManifestEntry(job)
  return { indexed: true }
}

export const processJobWithRetry = async (job) => {
  let attempt = 0

  while (attempt <= MAX_RETRY_ATTEMPTS) {
    if (state.cancelRequested) {
      return
    }

    try {
      let processResult
      if (job.kind === 'image') {
        processResult = await upsertImageDocument(job)
      } else {
        processResult = await upsertTextDocument(job)
      }

      if (processResult?.indexed) {
        setStatus({
          indexedFiles: state.indexingStatus.indexedFiles + 1
        })
      }

      return
    } catch (error) {
      const canRetry = attempt < MAX_RETRY_ATTEMPTS && isRetriableError(error)
      if (canRetry) {
        attempt += 1
        appendEvent('warning', `Retrying ${path.basename(job.filePath)} (attempt ${attempt + 1})`)
        await delay(300 * 2 ** attempt)
        continue
      }

      setStatus({
        failedFiles: state.indexingStatus.failedFiles + 1
      })
      appendEvent(
        'error',
        `Failed ${path.basename(job.filePath)}: ${error?.message || 'Unknown error'}`
      )
      return
    }
  }
}

export const workerLoop = async (queue) => {
  while (true) {
    const nextJob = await queue.pop()
    if (!nextJob) {
      return
    }

    state.pendingFilePaths.delete(nextJob.filePath)
    state.processingFilePaths.add(nextJob.filePath)

    setStatus({
      queueSize: queue.size()
    })

    try {
      await processJobWithRetry(nextJob)
    } finally {
      state.processingFilePaths.delete(nextJob.filePath)
    }

    setStatus({
      processedFiles: state.indexingStatus.processedFiles + 1,
      queueSize: queue.size()
    })

    if (state.indexingStatus.processedFiles % 20 === 0) {
      await queueManifestFlush()
    }
  }
}

export const pathExists = async (filePath) => {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

export const scanFolders = async (folders, queue, discoveredPaths) => {
  for (const folderPath of folders) {
    if (state.cancelRequested) {
      return
    }

    appendEvent('info', `Scanning ${folderPath}`)

    for await (const filePath of walkFiles(folderPath)) {
      if (state.cancelRequested) {
        return
      }

      const fileKind = detectFileKind(filePath)
      if (!fileKind) {
        setStatus({
          skippedUnsupported: state.indexingStatus.skippedUnsupported + 1
        })
        continue
      }

      let fileStats
      try {
        fileStats = await stat(filePath)
      } catch {
        continue
      }

      discoveredPaths.add(filePath)

      setStatus({
        scannedFiles: state.indexingStatus.scannedFiles + 1
      })

      if (isUnchangedFile(state.activeManifest.entries[filePath], fileStats, fileKind)) {
        setStatus({
          skippedUnchanged: state.indexingStatus.skippedUnchanged + 1
        })
        continue
      }

      await queue.push({
        filePath,
        folderPath,
        kind: fileKind,
        fileStats
      })

      state.pendingFilePaths.add(filePath)

      setStatus({
        queuedFiles: state.indexingStatus.queuedFiles + 1,
        queueSize: queue.size()
      })
    }
  }
}
