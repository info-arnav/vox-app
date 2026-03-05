import fs from 'fs/promises'
import path from 'path'
import {
  LEGACY_OFFICE_EXTENSIONS,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  readTextFileForIndex
} from '../../indexing/indexing.files'
import { resolveLocalPath } from './desktop.tool.shared'

export const writeLocalFile = async (payload) => {
  const targetPath = resolveLocalPath(payload?.path)
  const requestedEncoding = String(payload?.encoding || 'utf8')
    .trim()
    .toLowerCase()
  const encoding = requestedEncoding === 'base64' ? 'base64' : 'utf8'
  const rawContent = payload?.content == null ? '' : String(payload.content)
  const contentBuffer =
    encoding === 'base64' ? Buffer.from(rawContent, 'base64') : Buffer.from(rawContent, 'utf8')
  const shouldAppend = Boolean(payload?.append)
  const shouldCreateParents = payload?.createParents !== false

  if (shouldCreateParents) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
  }

  if (shouldAppend) {
    await fs.appendFile(targetPath, contentBuffer)
  } else {
    await fs.writeFile(targetPath, contentBuffer)
  }

  const stats = await fs.stat(targetPath)
  return {
    path: targetPath,
    bytesWritten: contentBuffer.length,
    fileSize: stats.size,
    mode: shouldAppend ? 'append' : 'overwrite',
    encoding
  }
}

export const readLocalFile = async (payload) => {
  const targetPath = resolveLocalPath(payload?.path)
  const requestedEncoding = String(payload?.encoding || 'utf8')
    .trim()
    .toLowerCase()
  const encoding = requestedEncoding === 'base64' ? 'base64' : 'utf8'
  const requestedMaxChars = Number(payload?.maxChars)
  const requestedMaxBytes = Number(payload?.maxBytes)
  const maxChars =
    Number.isFinite(requestedMaxChars) && requestedMaxChars > 0
      ? Math.min(Math.floor(requestedMaxChars), 120000)
      : 60000
  const maxBytes =
    Number.isFinite(requestedMaxBytes) && requestedMaxBytes > 0
      ? Math.min(Math.floor(requestedMaxBytes), 500000)
      : 120000

  const ext = path.extname(targetPath).toLowerCase()
  const fileStats = await fs.stat(targetPath)

  if (encoding !== 'base64' && LEGACY_OFFICE_EXTENSIONS.has(ext)) {
    const modern = ext.startsWith('.doc') ? '.docx' : ext.startsWith('.ppt') ? '.pptx' : '.xlsx'
    return {
      path: targetPath,
      content: '',
      encoding: 'utf8',
      format: ext.slice(1),
      truncated: false,
      size: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString(),
      message: `Legacy format ${ext} is not supported for text extraction. Convert the file to ${modern} to read its contents.`
    }
  }

  if (encoding !== 'base64' && SUPPORTED_DOCUMENT_EXTENSIONS.has(ext)) {
    const readResult = await readTextFileForIndex(targetPath)
    if (readResult?.unsupported) {
      return {
        path: targetPath,
        content: '',
        encoding: 'utf8',
        format: ext.slice(1),
        truncated: false,
        size: fileStats.size,
        modifiedAt: fileStats.mtime.toISOString(),
        message: readResult.unsupportedReason || `Could not extract text from ${ext}.`
      }
    }

    const fullText = String(readResult?.text || '')
    const content = fullText.slice(0, maxChars)
    return {
      path: targetPath,
      content,
      encoding: 'utf8',
      format: ext.slice(1),
      truncated: readResult?.truncated || fullText.length > maxChars,
      size: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString()
    }
  }

  const fileBuffer = await fs.readFile(targetPath)
  if (encoding === 'base64') {
    const truncatedBuffer = fileBuffer.slice(0, maxBytes)
    return {
      path: targetPath,
      content: truncatedBuffer.toString('base64'),
      encoding,
      truncated: fileBuffer.length > truncatedBuffer.length,
      returnedBytes: truncatedBuffer.length,
      size: fileStats.size,
      modifiedAt: fileStats.mtime.toISOString()
    }
  }

  const textContent = fileBuffer.toString('utf8')
  const truncatedText = textContent.slice(0, maxChars)
  return {
    path: targetPath,
    content: truncatedText,
    encoding,
    truncated: textContent.length > truncatedText.length,
    size: fileStats.size,
    modifiedAt: fileStats.mtime.toISOString()
  }
}
